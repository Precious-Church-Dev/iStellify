// Changes synthetic local account credentials only, then restores them.
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://localhost:3000';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Localhost only');
const password = process.env.DEMO_PASSWORD;
if (!password) throw Error('DEMO_PASSWORD required');
const temporary = 'Synthetic-Temp-' + Date.now(),
  personal = 'Synthetic-Personal-' + Date.now();
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
async function login(pcm, p = password) {
  const r = await call('/api/auth', '', { action: 'login', pcm, password: p });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.cookie;
}
let passed = 0;
const ok = (name) => {
  passed++;
  console.log('PASS ' + name);
};
const admin = await login('PCM0001'),
  member = await login('PCM0003');
assert.equal(
  (
    await call('/api/app', member, {
      action: 'bulkTestingPassword',
      password: temporary,
      confirm: 'yes',
    })
  ).status,
  403,
);
ok('Ordinary member cannot bulk reset passwords');
assert.equal(
  (
    await call('/api/app', admin, {
      action: 'bulkTestingPassword',
      password: 'short',
      confirm: 'yes',
    })
  ).status,
  400,
);
assert.equal(
  (await call('/api/app', admin, { action: 'bulkTestingPassword', password: temporary })).status,
  400,
);
ok('Length and explicit replacement confirmation enforced');
let promoted = false,
  changed = false;
try {
  let r = await call('/api/app', admin, {
    action: 'memberAccess',
    id: 'demo-PCM0008',
    active: true,
    roles: ['admin'],
  });
  assert.equal(r.status, 200);
  promoted = true;
  const secondAdmin = await login('PCM0008');
  const activation = await call('/api/app', admin, { action: 'reset', id: 'demo-PCM0003' });
  assert.equal(activation.status, 200);
  const staleSession = await login('PCM0003');
  r = await call('/api/app', admin, {
    action: 'bulkTestingPassword',
    password: temporary,
    confirm: 'yes',
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  changed = true;
  assert.ok(r.body.count >= 6);
  ok('Administrator bulk operation updates non-admin accounts');
  assert.equal((await call('/api/app', admin)).status, 200);
  assert.equal((await call('/api/app', secondAdmin)).status, 200);
  await login('PCM0001');
  await login('PCM0008');
  ok('Primary and additional Admin passwords and sessions are unchanged');
  assert.equal((await call('/api/app', staleSession)).status, 401);
  assert.equal(
    (await call('/api/auth', '', { action: 'login', pcm: 'PCM0003', password })).status,
    401,
  );
  assert.equal(
    (
      await call('/api/auth', '', {
        action: 'activate',
        token: activation.body.activationToken,
        password: personal,
      })
    ).status,
    400,
  );
  ok('Old passwords, sessions and unused activation codes are invalidated');
  const familiarity = await login('PCM0003', temporary);
  assert.equal((await call('/api/app', familiarity)).status, 200);
  assert.equal(
    (
      await call('/api/auth', familiarity, {
        action: 'changeTemporaryPassword',
        password: personal,
      })
    ).status,
    400,
  );
  ok('Familiarity sign-in opens the app normally without forcing a password change');
  assert.equal(
    (
      await call('/api/app', familiarity, {
        action: 'bulkRequirePersonalPasswords',
        confirm: 'yes',
      })
    ).status,
    403,
  );
  assert.equal(
    (await call('/api/app', admin, { action: 'bulkRequirePersonalPasswords' })).status,
    400,
  );
  assert.equal(
    (await call('/api/app', admin, { action: 'bulkRequirePersonalPasswords', confirm: 'yes' }))
      .status,
    200,
  );
  assert.equal((await call('/api/app', familiarity)).status, 401);
  assert.equal((await call('/api/app', admin)).status, 200);
  assert.equal((await call('/api/app', secondAdmin)).status, 200);
  ok('Only the admin can end testing; member sessions end and all Admin accounts remain unchanged');
  const restricted = await login('PCM0003', temporary),
    another = await login('PCM0003', temporary);
  for (const path of [
    '/api/app',
    '/api/personal',
    '/api/ministry?module=church',
    '/api/attachments',
  ])
    assert.equal((await call(path, restricted)).status, 403, path);
  ok('Temporary sign-in cannot access member records before changing password');
  assert.equal(
    (
      await call('/api/auth', restricted, {
        action: 'changeTemporaryPassword',
        password: temporary,
      })
    ).status,
    400,
  );
  assert.equal(
    (await call('/api/auth', restricted, { action: 'changeTemporaryPassword', password: personal }))
      .status,
    200,
  );
  assert.equal((await call('/api/app', restricted)).status, 200);
  assert.equal((await call('/api/app', another)).status, 401);
  await login('PCM0003', personal);
  assert.equal(
    (await call('/api/auth', '', { action: 'login', pcm: 'PCM0003', password: temporary })).status,
    401,
  );
  ok('Choosing a personal password unlocks the account and invalidates the shared password');
  const audit = JSON.stringify((await call('/api/app', admin)).body.admin.audit);
  assert.ok(!audit.includes(temporary) && !audit.includes(personal));
  ok('Audit records contain no testing or personal password');
} finally {
  if (promoted)
    assert.equal(
      (
        await call('/api/app', admin, {
          action: 'memberAccess',
          id: 'demo-PCM0008',
          active: true,
          roles: [],
        })
      ).status,
      200,
    );
  if (changed)
    for (const pcm of ['PCM0002', 'PCM0003', 'PCM0004', 'PCM0005', 'PCM0006', 'PCM0007']) {
      const r = await call('/api/app', admin, { action: 'reset', id: 'demo-' + pcm });
      assert.equal(r.status, 200);
      assert.equal(
        (
          await call('/api/auth', '', {
            action: 'activate',
            token: r.body.activationToken,
            password,
          })
        ).status,
        200,
      );
    }
}
console.log(`${passed} testing-password integration checks passed; local credentials restored.`);
