import { cookies } from 'next/headers';
import { query, transaction } from '@/lib/db.mjs';
import {
  audit,
  digest,
  HttpError,
  passwordHash,
  requireUser,
  sameOrigin,
  throttle,
  token,
  verifyPassword,
} from '@/lib/security';
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const data = await req.json();
    const action = data.action;
    if (action === 'logout') {
      const c = await cookies();
      const v = c.get('istelli_session')?.value;
      if (v) await query('DELETE FROM sessions WHERE token_hash=$1', [digest(v)]);
      c.delete('istelli_session');
      return Response.json({ ok: true });
    }
    if (action === 'heartbeat') {
      await requireUser();
      const v = (await cookies()).get('istelli_session')?.value;
      await query('UPDATE sessions SET last_active=now() WHERE token_hash=$1', [digest(v!)]);
      return Response.json({ ok: true });
    }
    if (action === 'setup') {
      await throttle('bootstrap', 10);
      if (
        !process.env.SETUP_SECRET ||
        process.env.SETUP_SECRET.length < 32 ||
        digest(String(data.secret)) !== digest(process.env.SETUP_SECRET)
      )
        throw new HttpError(403, 'Invalid setup key.');
      const hash = await passwordHash(String(data.password || ''));
      await transaction(async (db: any) => {
        await db.query('SELECT pg_advisory_xact_lock(88241)');
        const existing = await db.query('SELECT id FROM members LIMIT 1');
        if (existing.rows.length) throw new HttpError(409, 'Setup has already been completed.');
        const id = token();
        await db.query(
          "INSERT INTO members(id,pcm,name,password_hash,roles) VALUES($1,'PCM0001',$2,$3,'{admin}')",
          [id, String(data.name || 'Administrator').slice(0, 100), hash],
        );
        await audit(id, 'bootstrap', 'PCM0001', {}, db);
      });
      return Response.json({ ok: true, message: 'Administrator created. Sign in as PCM0001.' });
    }
    if (action === 'activate') {
      const raw = String(data.token || '');
      await throttle('activate:' + digest(raw), 5);
      const hash = await passwordHash(String(data.password || ''));
      await transaction(async (db: any) => {
        const r = await db.query(
          'SELECT member_id FROM activation_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',
          [digest(raw)],
        );
        if (!r.rows.length) throw new HttpError(400, 'This activation code is invalid or expired.');
        const id = r.rows[0].member_id;
        await db.query('UPDATE members SET password_hash=$1 WHERE id=$2', [hash, id]);
        await db.query('UPDATE activation_tokens SET used_at=now() WHERE token_hash=$1', [
          digest(raw),
        ]);
        await db.query('DELETE FROM sessions WHERE member_id=$1', [id]);
        await audit(id, 'activate', id, {}, db);
      });
      return Response.json({
        ok: true,
        message: 'Password set. You can now sign in with your church number.',
      });
    }
    if (action !== 'login') throw new HttpError(400, 'Unknown action.');
    const pcm = String(data.pcm || '')
      .trim()
      .toUpperCase();
    await throttle('login:' + digest(pcm));
    const r = await query('SELECT * FROM members WHERE pcm=$1 AND active=true', [pcm]);
    const member = r.rows[0];
    // Equal-cost hashing prevents revealing inactive or unknown accounts by timing.
    const dummy = '00000000000000000000000000000000:' + '00'.repeat(64);
    const ok = await verifyPassword(String(data.password || ''), member?.password_hash || dummy);
    if (!member?.password_hash || !ok)
      throw new HttpError(401, 'Church number or password is incorrect.');
    const raw = token();
    await query('INSERT INTO sessions(token_hash,member_id) VALUES($1,$2)', [
      digest(raw),
      member.id,
    ]);
    (await cookies()).set('istelli_session', raw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.LOCAL_DATABASE !== 'true',
      sameSite: 'strict',
      path: '/',
      maxAge: 43200,
    });
    return Response.json({ ok: true });
  } catch (e) {
    const error = e as Error;
    return Response.json(
      {
        error:
          error instanceof HttpError
            ? error.message
            : 'Unable to complete sign-in. Check your input and try again.',
      },
      { status: error instanceof HttpError ? error.status : 400 },
    );
  }
}
