// Synthetic localhost integration tests. Never run against the Render service.
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://127.0.0.1:3000';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw Error('Localhost only');
const password = process.env.DEMO_PASSWORD;
if (!password) throw Error('DEMO_PASSWORD is required');
async function call(cookie, data, date) {
  const url = new URL('/api/app', base);
  if (date) url.searchParams.set('date', date);
  const r = await fetch(url, {
    method: data ? 'POST' : 'GET',
    signal: AbortSignal.timeout(15000),
    headers: {
      Cookie: cookie || '',
      ...(data ? { 'Content-Type': 'application/json', Origin: base } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  return { status: r.status, body: await r.json() };
}
async function login(pcm) {
  const r = await fetch(base + '/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ action: 'login', pcm, password }),
  });
  assert.equal(r.status, 200, await r.clone().text());
  return r.headers.get('set-cookie').split(';')[0];
}
const admin = await login('PCM0001'),
  member = await login('PCM0003'),
  servant = await login('PCM0004'),
  outsider = await login('PCM0008');
let r = await call(member);
assert.equal(r.status, 200, JSON.stringify(r.body));
const today = r.body.today;
assert.ok(r.body.profile && r.body.resources && r.body.events && r.body.unlocks);
console.log('PASS member state and additive schema');
const previous = new Date(today + 'T12:00:00Z');
previous.setUTCDate(previous.getUTCDate() - 1);
const past = previous.toISOString().slice(0, 10);
r = await call(member, {
  action: 'log',
  habit: 'iRead',
  date: past,
  data: { type: 'Read the Bible', activities: ['Read the Bible'], duration: 15 },
});
assert.equal(r.status, 403, JSON.stringify(r.body));
r = await call(member, { action: 'requestUnlock', habit: 'iRead', date: past, reason: 'short' });
assert.equal(r.status, 400);
const reason =
  'I could not submit my daily reflection because my connection was interrupted while travelling and I am requesting access to complete the missed record honestly.';
r = await call(member, { action: 'requestUnlock', habit: 'iRead', date: past, reason });
assert.equal(r.status, 200, JSON.stringify(r.body));
r = await call(member, { action: 'requestUnlock', habit: 'iRead', date: past, reason });
assert.equal(r.status, 409);
const snapshot = (await call(member)).body,
  request = snapshot.unlocks.find((q) => q.habit === 'iRead' && q.period === past);
assert.ok(request);
assert.ok(!(await call(outsider)).body.unlocks.some((q) => q.id === request.id));
assert.equal(
  (await call(outsider, { action: 'reviewUnlock', id: request.id, decision: 'approved' })).status,
  403,
);
assert.equal(
  (await call(member, { action: 'reviewUnlock', id: request.id, decision: 'approved' })).status,
  403,
);
r = await call(servant, { action: 'reviewUnlock', id: request.id, decision: 'approved' });
assert.equal(r.status, 200, JSON.stringify(r.body));
r = await call(member, {
  action: 'log',
  habit: 'iRead',
  date: past,
  data: {
    type: 'Read the Bible',
    activities: ['Read the Bible', 'Watch Recordings'],
    duration: 15,
  },
});
assert.equal(r.status, 200, JSON.stringify(r.body));
r = await call(member, {
  action: 'log',
  habit: 'iRead',
  date: past,
  data: { type: 'Read the Bible', duration: 15 },
});
assert.equal(r.status, 403, JSON.stringify(r.body));
console.log('PASS locking, scoped approval and single-use grace');
r = await call(member, {
  action: 'log',
  habit: 'iPray',
  date: today,
  data: { morning: true, adhoc: false, evening: false, duration: 10 },
});
assert.equal(r.status, 200, JSON.stringify(r.body));
let s = (await call(member)).body;
const log = s.logs.find((l) => l.habit === 'iPray' && l.period === today),
  points = s.profile.stellar_fragments;
assert.equal(log.status, 'confirmed');
r = await call(member, {
  action: 'log',
  habit: 'iPray',
  date: today,
  version: log.version,
  data: { morning: true, adhoc: false, evening: false, duration: 10 },
});
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.equal((await call(member)).body.profile.stellar_fragments, points);
console.log('PASS daily auto-verification and idempotent fragment credit');
assert.equal(
  (await call(member, { action: 'resource', section: 'StelliApp', title: 'Forbidden' })).status,
  403,
);
r = await call(admin, {
  action: 'resource',
  section: 'StelliApp',
  title: 'Synthetic guide',
  description: 'Test only',
  videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
});
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.ok((await call(member)).body.resources.some((c) => c.title === 'Synthetic guide'));
assert.equal(
  (
    await call(admin, {
      action: 'resource',
      section: 'StelliApp',
      title: 'Unsafe',
      videoUrl: 'javascript:alert(1)',
    })
  ).status,
  400,
);
assert.equal(
  (await call(member, { action: 'event', name: 'Forbidden', startsAt: new Date().toISOString() }))
    .status,
  403,
);
r = await call(admin, {
  action: 'event',
  name: 'Synthetic church event',
  startsAt: new Date().toISOString(),
  details: 'Test only',
});
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.ok((await call(member)).body.events.some((e) => e.name === 'Synthetic church event'));
console.log('PASS Coach and calendar publish authorization');
r = await call(member, {
  action: 'profile',
  name: 'Alex Sample',
  nickname: 'Alex',
  bio: 'A short testimony',
  phone: '+639171234567',
  email: 'alex@example.test',
  timezone: 'Asia/Manila',
});
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.equal((await call(member)).body.profile.bio, 'A short testimony');
assert.equal((await call(member, { action: 'profile', bio: 'x'.repeat(251) })).status, 400);
r = await call(member, { action: 'adoptLifeCard', habit: 'iDrink' });
assert.equal(r.status, 200);
assert.ok((await call(member)).body.commitments.some((c) => c.habit === 'iDrink'));
console.log('PASS profile validation and preconfigured life card');
r = await call(servant, {
  action: 'nudge',
  id: 'demo-PCM0003',
  habit: 'iRead',
  message: 'A gentle reminder to read and reflect today.',
});
assert.equal(r.status, 200, JSON.stringify(r.body));
await call(servant, { action: 'nudge', id: 'demo-PCM0003', habit: 'iRead' });
r = await call(member, {
  action: 'log',
  habit: 'iRead',
  date: today,
  data: { type: 'Read the Bible', activities: ['Read the Bible'], duration: 10 },
});
assert.equal(r.status, 200, JSON.stringify(r.body));
s = (await call(admin)).body;
const nudger = s.nudgeStats.find((n) => n.id === 'demo-PCM0004');
assert.equal(nudger.sent, 1);
assert.equal(nudger.followed_through, 1);
assert.equal(nudger.score, 3);
assert.equal(s.nudgeReceived.find((n) => n.id === 'demo-PCM0003').received, 1);
console.log('PASS per-card nudge cooldown and approved impact scoring');
r = await call(admin, {
  action: 'unlockPeriod',
  id: 'demo-PCM0003',
  habit: 'iRate',
  date: today,
  reason: 'Synthetic test of the missed weekly card and follow-up review.',
});
assert.equal(r.status, 200, JSON.stringify(r.body));
r = await call(member, {
  action: 'log',
  habit: 'iRate',
  date: today,
  data: { rating: 2, notes: 'Synthetic weekly reflection' },
});
assert.equal(r.status, 200, JSON.stringify(r.body));
r = await call(member, {
  action: 'pastoralRequest',
  kind: 'counsel',
  recipient: 'demo-PCM0004',
  details: 'Synthetic confidential support request',
});
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.equal((await call(outsider)).body.pastoralRequests.length, 0);
assert.equal((await call(admin)).body.pastoralRequests.length, 0);
assert.ok((await call(servant)).body.pastoralRequests.some((p) => p.kind === 'counsel'));
console.log('PASS selected-recipient counseling confidentiality');
// On Saturdays, the weekly card belongs to the upcoming Sunday service.
const reviewDay = new Date(today + 'T12:00:00Z');
if (reviewDay.getUTCDay() === 6) reviewDay.setUTCDate(reviewDay.getUTCDate() + 1);
const reviewDate = reviewDay.toISOString().slice(0, 10);
const review = (await call(servant, undefined, reviewDate)).body.review.find(
  (l) => l.habit === 'iRate' && l.member_id === 'demo-PCM0003',
);
assert.ok(review);
r = await call(servant, {
  action: 'review',
  id: review.id,
  version: review.version,
  decision: 'confirmed',
});
assert.equal(r.status, 200, JSON.stringify(r.body));
console.log('PASS grace submission follow-up verification');
console.log('All PRD 2.1 synthetic integration checks passed.');
