import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://localhost:3000';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))
  throw new Error('Idle check is restricted to localhost.');
const r = await fetch(base + '/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: base },
  body: JSON.stringify({ action: 'login', pcm: 'PCM0008', password: process.env.DEMO_PASSWORD }),
});
assert.equal(r.status, 200);
const cookie = r.headers.get('set-cookie').split(';')[0];
console.log(
  'Isolated synthetic session started. Checking server expiration after five minutes without activity.',
);
await new Promise((resolve) => setTimeout(resolve, 302000));
const expired = await fetch(base + '/api/app', { headers: { Cookie: cookie } });
assert.equal(expired.status, 401);
console.log('PASS server rejected the idle session after five minutes.');
