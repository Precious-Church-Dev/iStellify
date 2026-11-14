import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, landingModule, memberSections, moduleAllowed } from '../lib/navigation.ts';
import { leadsMinistry, readsMinistryItem } from '../lib/ministry-access.ts';
const member = { id: 'member', roles: [], tag: 'iStellify' };
const servant = { id: 'servant', roles: [], tag: 'iStellify' };
const scope = [
  { group_id: 'care1', kind: 'care', roles: ['servant'], code: 'FCG1', name: 'Care One' },
];
test('the eight main modules match the wireframe and habits are nested', () => {
  assert.deepEqual(
    MODULES.map((m) => m.label),
    [
      'iStellify',
      'StelliKids',
      'StelliCare',
      'StelliShare',
      'StelliChurch',
      'StelliTithes',
      'StelliSet',
      'StelliAd',
    ],
  );
  assert.equal(landingModule('StelliKids'), 'kids');
  assert.equal(landingModule('iStellify'), 'individual');
  assert.ok(memberSections(false).some((s) => s.label === 'StelliBEST'));
  assert.ok(memberSections(true).some((s) => s.label === 'SkidiLight'));
  assert.ok(!memberSections(true).some((s) => s.label === 'StelliBEST'));
});
test('experience tags and admin roles control module access', () => {
  assert.equal(moduleAllowed('individual', { ...member, tag: 'StelliKids' }, 0), false);
  assert.equal(moduleAllowed('kids', member, 0), false);
  assert.equal(moduleAllowed('kids', member, 1), true);
  assert.equal(moduleAllowed('admin', member, 0), false);
});
test('leader sections never become ordinary group content', () => {
  const item = { module: 'care', group_id: 'care1', owner_id: 'someone', visibility: 'leaders' };
  assert.equal(leadsMinistry(servant, scope, 'care', 'care1'), true);
  assert.equal(leadsMinistry(servant, scope, 'share', 'care1'), false);
  assert.equal(readsMinistryItem(member, [{ ...scope[0], roles: ['member'] }], item), false);
  assert.equal(readsMinistryItem(servant, scope, item), true);
  assert.equal(readsMinistryItem(servant, [], item), false);
  assert.equal(
    readsMinistryItem({ id: 'admin', roles: ['admin'] }, [], {
      ...item,
      module: 'church',
      group_id: null,
      visibility: 'private',
    }),
    false,
  );
});
