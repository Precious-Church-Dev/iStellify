import { scrypt, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { query } from './db.mjs';
import type { Person, Membership } from './domain';
const derive = promisify(scrypt);
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export async function passwordHash(password: string) {
  if (password.length < 12 || password.length > 128)
    throw new Error('Use a password between 12 and 128 characters.');
  const salt = randomBytes(16).toString('hex');
  const hash = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(':');
  if (!salt || !hex || password.length > 128) return false;
  const hash = (await derive(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hex, 'hex');
  return expected.length === hash.length && timingSafeEqual(hash, expected);
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function sameOrigin(req: Request) {
  const expected = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (!expected) throw new HttpError(503, 'APP_URL is not configured.');
  let target;
  try {
    target = new URL(expected).origin;
  } catch {
    throw new HttpError(503, 'APP_URL is invalid.');
  }
  if (req.headers.get('origin') !== target)
    throw new HttpError(403, 'Refresh the app and try again from its own address.');
}
export async function currentUser(): Promise<Person | null> {
  const key = (await cookies()).get('istelli_session')?.value;
  if (!key) return null;
  const result = await query(
    `SELECT m.id,m.pcm,m.name,m.nickname,m.tag,m.roles,m.active,m.spiritual_state FROM sessions s JOIN members m ON m.id=s.member_id WHERE s.token_hash=$1 AND s.last_active>now()-interval '5 minutes' AND s.created_at>now()-interval '12 hours' AND m.active=true`,
    [digest(key)],
  );
  return (result.rows[0] as Person) || null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, 'Your session has ended. Please sign in again.');
  return user;
}
export async function memberships(id: string): Promise<Membership[]> {
  const r = await query(
    `SELECT mg.group_id,mg.roles,g.kind,g.code,g.name FROM memberships mg JOIN groups g ON g.id=mg.group_id WHERE mg.member_id=$1`,
    [id],
  );
  return r.rows as Membership[];
}
export async function throttle(key: string, max = 10) {
  const r = await query(
    `INSERT INTO rate_limits(key,attempts,reset_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN rate_limits.reset_at<now() THEN 1 ELSE rate_limits.attempts+1 END, reset_at=CASE WHEN rate_limits.reset_at<now() THEN now()+interval '15 minutes' ELSE rate_limits.reset_at END RETURNING attempts`,
    [key],
  );
  if (Number(r.rows[0].attempts) > max)
    throw new HttpError(429, 'Too many attempts. Please try again in 15 minutes.');
}
export async function audit(
  actor: string | null,
  action: string,
  target: string,
  detail: Record<string, unknown> = {},
  db = { query },
) {
  await db.query(
    'INSERT INTO audit_events(id,actor_id,action,target,detail) VALUES($1,$2,$3,$4,$5)',
    [token(), actor, action, target, JSON.stringify(detail)],
  );
}
