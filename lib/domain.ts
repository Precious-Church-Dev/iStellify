export type Person = {
  id: string;
  pcm: string;
  name: string;
  nickname: string;
  tag: string;
  roles: string[];
  active: boolean;
  spiritual_state?: string;
  password_change_required?: boolean;
};
export type Membership = {
  group_id: string;
  roles: string[];
  kind: string;
  code: string;
  name: string;
};
export const DAILY = ['iRead', 'iPray'];
export const WEEKLY = ['iPraise', 'iNote', 'iCare', 'iSpeak', 'iTithes', 'iRate'];
export const MONTHLY = ['iShare'];
export const hashableHabits = [...DAILY, ...WEEKLY, ...MONTHLY];
export function churchDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function weekStart(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}
export function periodFor(habit: string, day: string, frequency?: string) {
  const f =
    frequency || (DAILY.includes(habit) ? 'daily' : MONTHLY.includes(habit) ? 'monthly' : 'weekly');
  return f === 'daily' ? day : f === 'monthly' ? day.slice(0, 7) : weekStart(day);
}
export function lockEnd(day: string, frequency: string) {
  const d = new Date(`${day}T12:00:00Z`);
  if (frequency === 'daily') d.setUTCDate(d.getUTCDate() + 6 - d.getUTCDay());
  else if (frequency === 'weekly') d.setUTCMonth(d.getUTCMonth() + 1, 0);
  else d.setUTCMonth(Math.floor(d.getUTCMonth() / 3) * 3 + 3, 0);
  return d.toISOString().slice(0, 10);
}
export function cents(value: unknown): number {
  const text = String(value ?? '0');
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(text))
    throw new Error('Use a nonnegative amount with at most two decimal places.');
  const [a, b = ''] = text.split('.');
  return Number(a) * 100 + Number(b.padEnd(2, '0'));
}
export function tithe(data: Record<string, unknown>) {
  const gift = cents(data.gift),
    offering = cents(data.offering),
    tithes = cents(data.tithes),
    bob = cents(data.bob);
  if (bob > gift + offering + tithes)
    throw new Error('Breaking of Bread cannot exceed Gift + Offering + Tithes.');
  if (!tithes && !data.zeroReason) throw new Error('Please provide a reason for zero tithes.');
  if (bob && !data.bobReason) throw new Error('Please provide a Breaking of Bread reason.');
  const net = gift + offering + tithes - bob;
  if (net && !['Cash', 'E-Wallet', 'Bank Transfer'].includes(String(data.method)))
    throw new Error('Select the remittance method.');
  return { gift, offering, tithes, bob, net };
}
export function canReview(
  user: Person,
  scope: Membership[],
  log: { member_id: string; habit: string; group_ids: string[] },
) {
  if (user.id === log.member_id || !DAILY.concat(WEEKLY, MONTHLY).includes(log.habit)) return false;
  if (user.roles.includes('pastor')) return true;
  const roles =
    log.habit === 'iTithes' ? ['auditor'] : log.habit === 'iShare' ? ['captain'] : ['servant'];
  return scope.some(
    (s) => log.group_ids.includes(s.group_id) && s.roles.some((r) => roles.includes(r)),
  );
}
export function canFinance(
  user: Person,
  scope: Membership[],
  log: { member_id: string; group_ids: string[] },
) {
  return (
    user.id === log.member_id ||
    user.roles.includes('pastor') ||
    scope.some((s) => s.roles.includes('auditor') && log.group_ids.includes(s.group_id))
  );
}
export function isAdmin(u: Person) {
  return u.roles.includes('admin');
}
export function validDay(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value
  );
}
