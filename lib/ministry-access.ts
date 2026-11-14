import type { Membership, Person } from './domain';
export function leadsMinistry(
  user: Pick<Person, 'roles'>,
  scope: Membership[],
  module: string,
  group: string | null,
) {
  return (
    user.roles.includes('pastor') ||
    scope.some(
      (s) => s.group_id === group && s.roles.includes(module === 'share' ? 'captain' : 'servant'),
    )
  );
}
export function readsMinistryItem(
  user: Pick<Person, 'id' | 'roles'>,
  scope: Membership[],
  item: { module: string; group_id: string | null; owner_id: string; visibility: string },
) {
  const related =
    item.module === 'church' ||
    scope.some((s) => s.group_id === item.group_id) ||
    user.roles.includes('pastor') ||
    user.roles.includes('admin');
  if (!related) return false;
  if (item.visibility === 'members' || item.owner_id === user.id) return true;
  return leadsMinistry(user, scope, item.module, item.group_id);
}
