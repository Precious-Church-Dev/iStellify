import pg from 'pg';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const globalDb = globalThis;
export async function database() {
  if (!globalDb.__istelliDb)
    globalDb.__istelliDb = (async () => {
      if (process.env.DATABASE_URL)
        return new pg.Pool({
          connectionString: process.env.DATABASE_URL,
          max: 5,
          ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
        });
      if (
        process.env.RENDER ||
        (process.env.NODE_ENV === 'production' && process.env.LOCAL_DATABASE !== 'true')
      )
        throw new Error('DATABASE_URL must be configured');
      const { PGlite } = await import('@electric-sql/pglite');
      const dir = path.resolve('data/local');
      await mkdir(dir, { recursive: true });
      const db = new PGlite(dir);
      await db.waitReady;
      return db;
    })();
  return globalDb.__istelliDb;
}
export async function query(sql, params = []) {
  return (await database()).query(sql, params);
}
export async function transaction(fn) {
  const db = await database();
  if (db instanceof pg.Pool) {
    const c = await db.connect();
    try {
      await c.query('BEGIN');
      const r = await fn(c);
      await c.query('COMMIT');
      return r;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  return db.transaction(fn);
}
export async function migrate() {
  const db = await database();
  const sql = await readFile(path.resolve('db/schema.sql'), 'utf8');
  if (db instanceof pg.Pool) await db.query(sql);
  else await db.exec(sql);
}
