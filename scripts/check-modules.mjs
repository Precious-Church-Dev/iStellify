// Synthetic localhost checks only; never run against the church database.
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://localhost:3000';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Localhost only');
const password = process.env.DEMO_PASSWORD;
if (!password) throw Error('DEMO_PASSWORD required');
let passed = 0;
const ok = (name) => {
  passed++;
  console.log('PASS ' + name);
};
async function call(path, cookie, data) {
  const r = await fetch(base + path, {
    method: data ? 'POST' : 'GET',
    headers: {
      Cookie: cookie || '',
      ...(data ? { 'Content-Type': 'application/json', Origin: base } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  return {
    status: r.status,
    body: await r.json(),
    cookie: r.headers.get('set-cookie')?.split(';')[0],
  };
}
async function login(pcm) {
  const r = await call('/api/auth', '', { action: 'login', pcm, password });
  assert.equal(r.status, 200);
  return r.cookie;
}
const alex = await login('PCM0003'),
  servant = await login('PCM0004'),
  other = await login('PCM0008'),
  guardian = await login('PCM0006'),
  admin = await login('PCM0001'),
  kid = await login('PCM0007');
const app = (await call('/api/app', alex)).body,
  today = app.today;
assert.equal((await call('/api/personal')).status, 401);
ok('Personal sections require sign-in');
const salvation = {
  kind: 'salvation',
  title: 'My beginning of faith',
  data: {
    salvationDate: today,
    understanding: 'SYNTHETIC PRIVATE SALVATION',
    confirmation: 'A personal account of faith',
  },
};
let r = await call('/api/personal', alex, salvation);
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.ok(
  JSON.stringify((await call('/api/personal', alex)).body).includes('SYNTHETIC PRIVATE SALVATION'),
);
ok('StelliSave persists privately');
assert.equal((await call('/api/personal?subject=demo-PCM0003', servant)).status, 403);
ok('Leaders cannot open private salvation or health records');
const testimony = {
  kind: 'testimony',
  title: 'Synthetic B.E.S.T.',
  data: {
    before: 'SYNTHETIC PRIVATE BEFORE',
    event: 'An event that led',
    salvationDay: 'My salvation day',
    today: 'My journey today',
  },
};
r = await call('/api/personal', alex, testimony);
assert.equal(r.status, 200);
const testimonyId = r.body.id;
let ministry = (await call('/api/ministry?module=church', other)).body;
assert.ok(!JSON.stringify(ministry).includes('SYNTHETIC PRIVATE BEFORE'));
ok('B.E.S.T. is private by default');
r = await call('/api/personal', alex, { ...testimony, id: testimonyId, visibility: 'care' });
assert.equal(r.status, 200);
assert.ok(
  (await call('/api/ministry?module=care&group=demo-care', servant)).body.testimonials.some(
    (x) => x.id === testimonyId,
  ),
);
assert.ok(
  !(await call('/api/ministry?module=church', other)).body.testimonials.some(
    (x) => x.id === testimonyId,
  ),
);
ok('Care testimony sharing respects group scope');
assert.equal((await call('/api/personal', other, { ...testimony, id: testimonyId })).status, 403);
ok('Another member cannot overwrite a testimony');
await call('/api/personal', alex, { ...testimony, id: testimonyId, visibility: 'church' });
assert.ok(
  (await call('/api/ministry?module=church', other)).body.testimonials.some(
    (x) => x.id === testimonyId,
  ),
);
await call('/api/personal', alex, { ...testimony, id: testimonyId, visibility: 'private' });
assert.ok(
  !(await call('/api/ministry?module=church', other)).body.testimonials.some(
    (x) => x.id === testimonyId,
  ),
);
ok('Church sharing is explicit and can be withdrawn');
const assessment = {
  kind: 'assessment',
  subject: 'demo-PCM0007',
  title: 'Synthetic child checkpoint',
  data: { measuredOn: today, weight: '25', reflection: 'PRIVATE CHILD CHECKPOINT' },
};
assert.equal((await call('/api/personal', guardian, assessment)).status, 200);
assert.equal((await call('/api/personal', alex, assessment)).status, 403);
assert.equal((await call('/api/personal', kid, salvation)).status, 403);
ok('Child assessment requires the child or linked guardian; adult testimony forms stay adult');
assert.ok(
  (await call('/api/app?subject=demo-PCM0007', guardian)).body.peers.every(
    (p) => p.kind === 'family',
  ),
);
ok('Kids links show family scope only');
assert.equal((await call('/api/ministry?module=care&group=demo-care', other)).status, 403);
ok('Other-group ministry access denied');
const entry = {
  module: 'care',
  group: 'demo-care',
  kind: 'icebreaker',
  title: 'Synthetic icebreaker',
  body: 'A group discussion',
};
assert.equal((await call('/api/ministry', alex, entry)).status, 403);
r = await call('/api/ministry', servant, entry);
assert.equal(r.status, 200, JSON.stringify(r.body));
ok('Care Servant publishes; ordinary members cannot');
assert.equal(
  (
    await call('/api/ministry', servant, {
      ...entry,
      kind: 'assignment',
      data: { facilitator: 'demo-PCM0008' },
    })
  ).status,
  400,
);
ok('Assignments reject people outside the group');
r = await call('/api/ministry', servant, {
  ...entry,
  kind: 'task',
  title: 'Synthetic private leader task',
});
assert.equal(r.status, 200);
const task = r.body.id;
assert.ok(
  !(await call('/api/ministry?module=care&group=demo-care', alex)).body.items.some(
    (x) => x.id === task,
  ),
);
assert.equal(
  (
    await call('/api/ministry', alex, {
      module: 'care',
      group: 'demo-care',
      action: 'state',
      id: task,
      state: 'done',
    })
  ).status,
  403,
);
assert.equal(
  (
    await call('/api/ministry', servant, {
      module: 'care',
      group: 'demo-care',
      action: 'state',
      id: task,
      state: 'doing',
    })
  ).status,
  200,
);
ok('Leader Kanban stays private and enforces editing scope');
assert.equal(
  (
    await call('/api/ministry', servant, {
      module: 'share',
      group: 'demo-share',
      kind: 'strategy',
      title: 'Synthetic sharing strategy',
    })
  ).status,
  200,
);
ok('Sharing Captain manages StelliShare content');
r = await call('/api/ministry', alex, {
  module: 'church',
  kind: 'counsel',
  title: 'SYNTHETIC PRIVATE COUNSEL',
  body: 'A private request',
  visibility: 'members',
});
assert.equal(r.status, 200);
assert.ok(
  !(await call('/api/ministry?module=church', admin)).body.items.some((x) => x.id === r.body.id),
);
ok('Counsel cannot be made public and is hidden from unassigned administrators');
assert.equal(
  (await call('/api/personal', alex, { ...testimony, data: { before: 'Incomplete' } })).status,
  400,
);
ok('All four B.E.S.T. fields are required');
const custom = app.commitments.find((c) => c.frequency === 'daily');
assert.ok(custom);
const previous = app.logs.find((l) => l.habit === custom.id);
r = await call('/api/app', alex, {
  action: 'log',
  habit: custom.id,
  date: today,
  version: previous?.version,
  data: { done: true, duration: 10, notes: 'Synthetic personal habit' },
});
assert.equal(r.status, 200, JSON.stringify(r.body));
ok('Custom habits log correctly with PostgreSQL date values');
console.log(`${passed} module integration checks passed.`);
