// Browser checks use synthetic localhost accounts only.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://127.0.0.1:3000';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw Error('Localhost only');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
async function shot(name) {
  const b = await page.screenshot({ type: 'jpeg', quality: 65, fullPage: false });
  console.log('UI_IMAGE_' + name + '=' + b.toString('base64'));
}
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  await shot('login');
  await page.locator('input[name=pcm]').fill('PCM0003');
  await page.locator('input[name=password]').fill(process.env.DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'StelliStat', exact: true, level: 1 }).waitFor();
  await page.getByRole('heading', { name: 'StelliPath', exact: true }).waitFor();
  assert.equal(await page.locator('.stellipath-countdowns li').count(), 4);
  assert.equal(await page.locator('.stellipath-code').textContent(), 'PCM0003');
  const profileResponse = await page.request.get(base + '/api/app');
  assert.ok(profileResponse.ok());
  const { profile } = await profileResponse.json();
  const fragments = page.locator('.stellipath-identity .stellipath-fragments');
  assert.equal(await fragments.locator('span').textContent(), 'Stellar Fragments Earned:');
  assert.equal(
    await fragments.locator('b').textContent(),
    profile.stellar_fragments.toLocaleString('en-US'),
  );
  assert.equal(
    await page.locator('.sidebar').getByRole('button', { name: 'StelliAd', exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .locator('.sidebar')
      .getByRole('button', { name: 'StelliTithes', exact: true })
      .count(),
    0,
  );
  const welcome = page.locator('.stelli-companion.is-welcoming');
  await welcome.getByRole('status').filter({ hasText: /Welcome to iStellify/ }).waitFor();
  await page.waitForFunction(() =>
    document.querySelector('.stelli-companion.is-welcoming')?.getBoundingClientRect().width > 230
  );
  await page.waitForFunction(() =>
    document.querySelector('.stelli-companion.is-docked')?.getBoundingClientRect().width < 110
  );
  await shot('dashboard');
  await page.getByRole('button', { name: 'StelliCoach', exact: true }).click();
  await page.getByRole('heading', { name: 'Synthetic guide' }).waitFor();
  await shot('coach');
  await page.locator('.sidebar').getByRole('button', { name: 'iStellify', exact: true }).click();
  await page.getByRole('button', { name: 'StelliLight', exact: true }).click();
  await page.locator('.habit-card').filter({ hasText: 'iRead' }).click();
  await page.getByRole('heading', { name: 'iReadCard', exact: true }).waitFor();
  assert.ok((await page.locator('.weekly-matrix .yes-no:disabled').count()) > 0);
  await shot('weekly');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot('mobile');
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2),
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS browser sign-in, role visibility, Coach resources, weekly matrix, mobile overflow and runtime errors',
  );
} finally {
  await browser.close();
}
