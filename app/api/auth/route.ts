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
    if (action === 'changeTemporaryPassword') {
      const user = await requireUser(true);
      if (!user.password_change_required)
        throw new HttpError(400, 'No temporary password change is required.');
      const password = String(data.password || '');
      if (password.length < 12 || password.length > 128)
        throw new HttpError(400, 'Use a password between 12 and 128 characters.');
      const hash = await passwordHash(password);
      const session = (await cookies()).get('istelli_session')?.value;
      await transaction(async (db: any) => {
        const member = (
          await db.query(
            'SELECT password_hash,password_change_required FROM members WHERE id=$1 FOR UPDATE',
            [user.id],
          )
        ).rows[0];
        const liveSession = await db.query(
          'SELECT token_hash FROM sessions WHERE token_hash=$1 AND member_id=$2',
          [digest(session!), user.id],
        );
        if (!liveSession.rows.length)
          throw new HttpError(401, 'Your session has ended. Please sign in again.');
        if (!member?.password_change_required)
          throw new HttpError(400, 'No password change is required. Please sign in again.');
        if (await verifyPassword(password, member.password_hash))
          throw new HttpError(
            400,
            'Choose a different password from the temporary testing password.',
          );
        await db.query(
          'UPDATE members SET password_hash=$1,password_change_required=false WHERE id=$2',
          [hash, user.id],
        );
        await db.query('DELETE FROM sessions WHERE member_id=$1 AND token_hash<>$2', [
          user.id,
          digest(session!),
        ]);
        await db.query('UPDATE sessions SET last_active=now() WHERE token_hash=$1', [
          digest(session!),
        ]);
        await audit(user.id, 'account.temporary_password_changed', user.id, {}, db);
      });
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
        await db.query(
          'UPDATE members SET password_hash=$1,password_change_required=false WHERE id=$2',
          [hash, id],
        );
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
    await transaction(async (db: any) => {
      const current = (
        await db.query('SELECT password_hash FROM members WHERE id=$1 AND active=true FOR UPDATE', [
          member.id,
        ])
      ).rows[0];
      if (!current || current.password_hash !== member.password_hash)
        throw new HttpError(401, 'The account changed. Please sign in again.');
      await db.query('INSERT INTO sessions(token_hash,member_id) VALUES($1,$2)', [
        digest(raw),
        member.id,
      ]);
    });
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
