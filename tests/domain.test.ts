import test from 'node:test';
import assert from 'node:assert/strict';
import {
  churchDate,
  weekStart,
  periodFor,
  lockEnd,
  cents,
  tithe,
  canReview,
  canFinance,
  validDay,
  type Person,
  type Membership,
} from '../lib/domain.ts';
const member: Person = {
  id: 'one',
  pcm: 'PCM0003',
  name: 'Member',
  nickname: '',
  tag: 'iStellify',
  roles: [],
  active: true,
};
const scope: Membership[] = [
  { group_id: 'care1', roles: ['servant'], kind: 'care', code: 'FCG1', name: 'Care 1' },
  { group_id: 'finance1', roles: ['auditor'], kind: 'finance', code: 'FIN1', name: 'Finance 1' },
];
test('Manila dates and year boundaries are consistent', () => {
  assert.equal(churchDate(new Date('2026-11-14T16:01:00Z')), '2026-11-15');
  assert.equal(weekStart('2027-01-01'), '2026-12-27');
  assert.equal(periodFor('iShare', '2027-02-28'), '2027-02');
  assert.equal(validDay('2027-02-30'), false);
});
test('lock windows end at calendar boundaries', () => {
  assert.equal(lockEnd('2026-11-14', 'daily'), '2026-11-14');
  assert.equal(lockEnd('2026-11-15', 'daily'), '2026-11-21');
  assert.equal(lockEnd('2026-11-14', 'weekly'), '2026-11-30');
  assert.equal(lockEnd('2026-11-14', 'monthly'), '2026-12-31');
});
test('money is calculated in integer cents with validation', () => {
  assert.equal(cents('0.29'), 29);
  assert.equal(
    tithe({
      gift: '100',
      offering: '50',
      tithes: '200',
      bob: '75',
      bobReason: 'Medical',
      method: 'Cash',
    }).net,
    27500,
  );
  assert.throws(() => cents('1.001'));
  assert.throws(() => cents('-1'));
  assert.throws(() => tithe({ tithes: '0' }));
  assert.throws(() => tithe({ gift: '1', tithes: '1', bob: '3', bobReason: 'Other' }));
});
test('group scope and self-review are protected', () => {
  assert.equal(
    canReview(member, scope, { member_id: 'two', habit: 'iPraise', group_ids: ['care1'] }),
    true,
  );
  assert.equal(
    canReview(member, scope, { member_id: 'one', habit: 'iPraise', group_ids: ['care1'] }),
    false,
  );
  assert.equal(
    canReview(member, scope, { member_id: 'two', habit: 'iPraise', group_ids: ['care2'] }),
    false,
  );
  assert.equal(
    canReview(member, scope, { member_id: 'two', habit: 'iRead', group_ids: ['care1'] }),
    true,
  );
  assert.equal(
    canReview(member, scope, { member_id: 'two', habit: 'iTithes', group_ids: ['care1'] }),
    false,
  );
  assert.equal(
    canReview(member, scope, { member_id: 'two', habit: 'iTithes', group_ids: ['finance1'] }),
    true,
  );
  assert.equal(canFinance(member, scope, { member_id: 'two', group_ids: ['finance2'] }), false);
});
