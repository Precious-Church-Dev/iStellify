import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { token } from '@/lib/security';
export async function GET() {
  const origin = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (!origin || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    return Response.redirect(
      new URL('/?authError=google_unavailable', origin || 'http://localhost:3000'),
    );
  const state = token(),
    verifier = token(),
    jar = await cookies();
  jar.set('istelli_oauth', JSON.stringify({ state, verifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.LOCAL_DATABASE !== 'true',
    sameSite: 'lax',
    path: '/api/auth/google',
    maxAge: 600,
  });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: new URL('/api/auth/google/callback', origin).href,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return Response.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params);
}
