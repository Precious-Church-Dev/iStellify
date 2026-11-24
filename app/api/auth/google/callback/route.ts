import { cookies } from 'next/headers';
import { query, transaction } from '@/lib/db.mjs';
import { audit, digest, throttle, token } from '@/lib/security';
export async function GET(req: Request) {
  const origin = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000',
    jar = await cookies();
  try {
    const saved = JSON.parse(jar.get('istelli_oauth')?.value || '{}'),
      p = new URL(req.url).searchParams;
    jar.set('istelli_oauth', '', { maxAge: 0, path: '/api/auth/google' });
    if (!saved.state || p.get('state') !== saved.state || !p.get('code'))
      throw Error('oauth_state');
    await throttle('google:' + digest(saved.state), 2);
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code: p.get('code')!,
        code_verifier: saved.verifier,
        redirect_uri: new URL('/api/auth/google/callback', origin).href,
        grant_type: 'authorization_code',
      }),
    });
    if (!r.ok) throw Error('oauth_exchange');
    const auth = await r.json();
    const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: 'Bearer ' + auth.access_token },
    });
    if (!info.ok) throw Error('oauth_identity');
    const identity = await info.json();
    if (identity.email_verified !== true || !identity.sub || !identity.email)
      throw Error('oauth_email');
    const raw = token();
    await transaction(async (db: any) => {
      const matches = (
        await db.query(
          'SELECT id,google_sub FROM members WHERE lower(email)=lower($1) AND active=true FOR UPDATE',
          [identity.email],
        )
      ).rows;
      if (matches.length !== 1 || (matches[0].google_sub && matches[0].google_sub !== identity.sub))
        throw Error('unregistered');
      const id = matches[0].id;
      await db.query('UPDATE members SET google_sub=$1 WHERE id=$2', [identity.sub, id]);
      await db.query('INSERT INTO sessions(token_hash,member_id) VALUES($1,$2)', [digest(raw), id]);
      await audit(id, 'account.google_login', id, {}, db);
    });
    jar.set('istelli_session', raw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.LOCAL_DATABASE !== 'true',
      sameSite: 'lax',
      path: '/',
      maxAge: 43200,
    });
    return Response.redirect(new URL('/', origin));
  } catch (e) {
    const reason = (e as Error).message === 'unregistered' ? 'unregistered' : 'google_failed';
    return Response.redirect(new URL('/?authError=' + reason, origin));
  }
}
