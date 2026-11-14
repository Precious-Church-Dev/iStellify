import { migrate, database } from '../lib/db.mjs';
await migrate();
console.log('Database schema ready.');
const db = await database();
if (db.end) await db.end();
else await db.close();
