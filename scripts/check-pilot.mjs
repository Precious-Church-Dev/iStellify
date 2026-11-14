// Run against an isolated local server with the synthetic seed only.
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
const base = process.env.TEST_URL || 'http://localhost:3000';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))
  throw new Error('Integration checks are restricted to localhost.');
const password = process.env.DEMO_PASSWORD;
if (!password) throw new Error('Set DEMO_PASSWORD used by the local seed.');
let passed = 0;
const check = (name) => {
  passed++;
  console.log('PASS ' + name);
};
async function call(path, data, cookie = '', origin = base) {
  const r = await fetch(base + path, {
    method: data ? 'POST' : 'GET',
    headers: {
      ...(data ? { 'Content-Type': 'application/json', Origin: origin } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  return {
    status: r.status,
    body: await r.json(),
    cookie: r.headers.get('set-cookie')?.split(';')[0] || '',
  };
}
async function login(pcm) {
  const r = await call('/api/auth', { action: 'login', pcm, password });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.cookie);
  return r.cookie;
}
async function state(c, extra = '') {
  const r = await call('/api/app' + extra, null, c);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
assert.equal((await call('/api/app')).status, 401);
check('Anonymous requests denied');
assert.equal(
  (
    await call(
      '/api/auth',
      { action: 'login', pcm: 'PCM0003', password },
      '',
      'https://another.example',
    )
  ).status,
  403,
);
check('Cross-origin sign-in denied');
const alex = await login('PCM0003'),
  servant = await login('PCM0004'),
  auditor = await login('PCM0005'),
  guardian = await login('PCM0006'),
  other = await login('PCM0008'),
  admin = await login('PCM0001');
let a = await state(alex),
  today = a.today;
assert.equal(a.user.name, 'Alex Sample');
check('Member sign-in and dashboard');
let own = a.logs.find((l) => l.habit === 'iRead');
let r = await call(
  '/api/app',
  {
    action: 'log',
    habit: 'iRead',
    date: today,
    version: own?.version,
    data: { type: 'Read the Bible', duration: 15, notes: 'PRIVATE JOURNAL FOR OWNER ONLY' },
  },
  alex,
);
assert.equal(r.status, 200, JSON.stringify(r.body));
a = await state(alex);
assert.equal(a.logs.find((l) => l.habit === 'iRead').data.duration, 15);
check('Daily log persists');
const servantView = await state(servant);
assert.ok(!JSON.stringify(servantView).includes('PRIVATE JOURNAL FOR OWNER ONLY'));
check('Private devotional notes excluded from leader responses');
own = (await state(alex)).logs.find((l) => l.habit === 'iPray');
r = await call(
  '/api/app',
  {
    action: 'log',
    habit: 'iPray',
    date: today,
    version: own?.version,
    draft: true,
    data: { morning: true, adhoc: false, evening: false },
  },
  alex,
);
assert.equal(r.status, 200, JSON.stringify(r.body));
let draft = (await state(alex)).logs.find((l) => l.habit === 'iPray');
assert.equal(draft.status, 'draft');
assert.equal(draft.data.morning, true);
assert.ok(
  !(await state(servant)).review.some((l) => l.habit === 'iPray' && l.member_id === 'demo-PCM0003'),
);
check('Partial prayer draft persists privately and stays out of review');
assert.equal(
  (
    await call(
      '/api/app',
      {
        action: 'log',
        habit: 'iPray',
        date: today,
        version: draft.version,
        data: { morning: true },
      },
      alex,
    )
  ).status,
  400,
);
check('Incomplete prayer cannot be submitted as complete');
r = await call(
  '/api/app',
  {
    action: 'log',
    habit: 'iPray',
    date: today,
    version: draft.version,
    data: { morning: true, adhoc: true, evening: true },
  },
  alex,
);
assert.equal(r.status, 200);
check('Completed prayer draft submits for review');
assert.ok(!(await state(auditor)).peers.some((p) => p.pcm === 'PCM0003'));
check('Financial scope alone does not grant peer progress access');
own = a.logs.find((l) => l.habit === 'iPraise');
r = await call(
  '/api/app',
  {
    action: 'log',
    habit: 'iPraise',
    date: today,
    version: own?.version,
    data: { attendance: 'Onsite' },
  },
  alex,
);
assert.equal(r.status, 200, JSON.stringify(r.body));
let queue = (await state(servant)).review;
let worship = queue.find((l) => l.habit === 'iPraise' && l.pcm === 'PCM0003');
assert.ok(worship);
check('Assigned Servant receives weekly entry');
assert.equal(
  (
    await call(
      '/api/app',
      { action: 'review', id: worship.id, version: worship.version, decision: 'confirmed' },
      other,
    )
  ).status,
  403,
);
check('Wrong-group review denied');
assert.equal(
  (
    await call(
      '/api/app',
      { action: 'review', id: worship.id, version: worship.version, decision: 'confirmed' },
      alex,
    )
  ).status,
  403,
);
check('Self-review denied');
assert.equal(
  (
    await call(
      '/api/app',
      { action: 'review', id: worship.id, version: worship.version, decision: 'confirmed' },
      servant,
    )
  ).status,
  200,
);
check('Independent review saved');
assert.equal(
  (
    await call(
      '/api/app',
      {
        action: 'review',
        id: worship.id,
        version: worship.version,
        decision: 'flagged',
        reason: 'stale',
      },
      servant,
    )
  ).status,
  409,
);
check('Stale review rejected');
own = (await state(alex)).logs.find((l) => l.habit === 'iPraise');
assert.equal(own.status, 'confirmed');
r = await call(
  '/api/app',
  {
    action: 'log',
    habit: 'iPraise',
    date: today,
    version: own.version,
    data: { attendance: 'Online' },
  },
  alex,
);
assert.equal(r.status, 200);
assert.equal((await state(alex)).logs.find((l) => l.habit === 'iPraise').status, 'pending');
check('Correction resets verification');
assert.equal(
  (
    await call(
      '/api/app',
      {
        action: 'log',
        habit: 'iPraise',
        date: today,
        version: own.version,
        data: { attendance: 'Online' },
      },
      alex,
    )
  ).status,
  409,
);
check('Stale correction rejected');
own = (await state(alex)).logs.find((l) => l.habit === 'iTithes');
r = await call(
  '/api/app',
  {
    action: 'log',
    habit: 'iTithes',
    date: today,
    version: own?.version,
    data: {
      gift: '100',
      offering: '50',
      tithes: '200',
      bob: '75',
      bobReason: 'Medical',
      method: 'Cash',
    },
  },
  alex,
);
assert.equal(r.status, 200, JSON.stringify(r.body));
let financial = (await state(auditor)).review.find(
  (l) => l.habit === 'iTithes' && l.pcm === 'PCM0003',
);
assert.equal(financial.data.amounts.net, 27500);
assert.ok(!(await state(servant)).review.some((l) => l.habit === 'iTithes' && l.pcm === 'PCM0003'));
check('Financial group scope enforced');
assert.equal(
  (
    await call(
      '/api/app',
      {
        action: 'review',
        id: financial.id,
        version: financial.version,
        decision: 'confirmed',
        received: '250',
      },
      auditor,
    )
  ).status,
  400,
);
check('Receipt discrepancy blocks confirmation');
assert.equal(
  (
    await call(
      '/api/app',
      {
        action: 'review',
        id: financial.id,
        version: financial.version,
        decision: 'confirmed',
        received: '275',
      },
      auditor,
    )
  ).status,
  200,
);
check('Matching tithe receipt reconciles');
const child = 'demo-PCM0007';
assert.equal((await call('/api/app?subject=' + child, null, alex)).status, 403);
let family = await state(guardian, '?subject=' + child);
assert.equal(family.subject.tag, 'StelliKids');
check('Guardian link enforced');
let childLog = family.logs.find((l) => l.habit === 'iRead');
r = await call(
  '/api/app',
  {
    action: 'log',
    subject: child,
    habit: 'iRead',
    date: today,
    version: childLog?.version,
    data: { type: 'Read the Bible', duration: 5 },
  },
  guardian,
);
assert.equal(r.status, 200);
family = await state(guardian, '?subject=' + child);
assert.equal(family.logs.find((l) => l.habit === 'iRead').entered_by, 'demo-PCM0006');
check('Assisted logging records guardian actor');
let kidTithe = (await state(guardian, '?subject=' + child)).logs.find((l) => l.habit === 'iTithes');
r = await call(
  '/api/app',
  {
    action: 'log',
    subject: child,
    habit: 'iTithes',
    date: today,
    version: kidTithe?.version,
    data: { tithes: '20', method: 'Cash' },
  },
  guardian,
);
assert.equal(r.status, 200, JSON.stringify(r.body));
check('Kids iTithes card records guardian-assisted giving privately');
r = await call(
  '/api/app',
  { action: 'commitment', name: 'Test habit ' + Date.now(), frequency: 'daily', duration: 10 },
  alex,
);
assert.equal(r.status, 200, JSON.stringify(r.body));
const commitment = (await state(alex)).commitments.at(-1);
assert.ok(commitment);
check('Custom personal habit persisted');
assert.equal(
  (await call('/api/app', { action: 'createMember', name: 'Should not create' }, alex)).status,
  403,
);
check('Member cannot administer accounts');
const old = new Date(today + 'T12:00:00Z');
old.setUTCDate(old.getUTCDate() - 30 - Math.floor(Math.random() * 500));
const oldDay = old.toISOString().slice(0, 10);
let oldState = await state(alex, '?date=' + oldDay),
  oldLog = oldState.logs.find((l) => l.habit === 'iRead');
assert.equal(
  (
    await call(
      '/api/app',
      {
        action: 'log',
        habit: 'iRead',
        date: oldDay,
        version: oldLog?.version,
        data: { type: 'Read the Bible', duration: 10 },
      },
      alex,
    )
  ).status,
  400,
);
check('Closed periods require an exception');
r = await call(
  '/api/app',
  {
    action: 'unlockPeriod',
    id: 'demo-PCM0003',
    habit: 'iRead',
    date: oldDay,
    reason: 'Synthetic test of a pastoral exception',
  },
  admin,
);
assert.equal(r.status, 200);
assert.equal(
  (
    await call(
      '/api/app',
      {
        action: 'log',
        habit: 'iRead',
        date: oldDay,
        version: oldLog?.version,
        data: { type: 'Read the Bible', duration: 10 },
      },
      alex,
    )
  ).status,
  200,
);
check('Audited time-limited administrator exception works');
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Member Profile');
sheet.getCell('B1').value = 'Church Number';
sheet.getCell('B2').value = 'PCM0900';
sheet.getCell('C2').value = 'iStellify';
sheet.getCell('D2').value = 'Synthetic';
sheet.getCell('E2').value = 'Import ' + Date.now();
const bytes = await workbook.xlsx.writeBuffer();
const form = new FormData();
form.set(
  'file',
  new File([bytes], 'synthetic.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }),
);
let ir = await fetch(base + '/api/import', {
  method: 'POST',
  headers: { Cookie: admin, Origin: base },
  body: form,
});
let ib = await ir.json();
assert.equal(ir.status, 200, JSON.stringify(ib));
assert.equal(ib.members[0].pcm, 'PCM0900');
assert.equal(ib.errors.length, 0);
check('XLSX roster preview parses schema');
r = await call('/api/import', { id: ib.id, grantRoles: false }, admin);
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.equal((await call('/api/import', { id: ib.id }, admin)).status, 409);
check('Roster commit is atomic and repeat-protected');
const adminState = await state(admin),
  created = adminState.admin.members.find((m) => m.pcm === 'PCM0900');
r = await call('/api/app', { action: 'reset', id: created.id }, admin);
assert.equal(r.status, 200);
const activation = r.body.activationToken;
assert.ok(activation);
r = await call('/api/auth', { action: 'activate', token: activation, password });
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.equal(
  (await call('/api/auth', { action: 'activate', token: activation, password })).status,
  400,
);
check('One-use activation code consumed once');
const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGm0AAAAASUVORK5CYII=',
    'base64',
  ),
  upload = new FormData();
upload.set('file', new File([png], 'sample.png', { type: 'image/png' }));
const ar = await fetch(base + '/api/attachments', {
  method: 'POST',
  headers: { Cookie: alex, Origin: base },
  body: upload,
});
const ab = await ar.json();
assert.equal(ar.status, 200, JSON.stringify(ab));
assert.equal(
  (await fetch(base + '/api/attachments?id=' + ab.id, { headers: { Cookie: other } })).status,
  403,
);
check('Unrelated users cannot download private attachments');
await call('/api/auth', { action: 'logout' }, other);
assert.equal((await call('/api/app', null, other)).status, 401);
check('Sign-out revokes server session');
console.log(`\n${passed} pilot integration checks passed.`);
