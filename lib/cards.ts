import { weekStart } from './domain.ts';

export const READ_TYPES = [
  'Read the Bible',
  'Watch Recordings',
  'Review Slides',
  'Listen to Audiobook',
  'Read Book/s',
  'Watch Self-Help Video',
];
export const PRAYER_TYPES = ['Morning Prayer', 'Adhoc Prayer', 'Night Prayer'];
export const LIFE_CARDS = [
  ['iEat', 'Proper Nutrition'],
  ['iDrink', 'Proper Hydration'],
  ['iSleep', 'Proper Sleep'],
  ['iZone', 'Meditation'],
  ['iMeds', 'Medication'],
  ['iHerb', 'Herbs and Supplements'],
  ['iFast', 'Fasting'],
  ['iGain', 'Weekly check weight'],
  ['iLose', 'Weekly check weight'],
  ['iFit', ''],
  ['iStretch', 'Stretching'],
  ['iWeigh', 'Weekly check weight'],
  ['iCount', 'Calorie Count'],
  ['iSweat', ''],
  ['iLearn', ''],
  ['iEarn', ''],
  ['iStop', ''],
] as const;
export function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
export function localClock(now = new Date(), timeZone = 'Asia/Manila') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
    weekday: new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`).getUTCDay(),
  };
}
export function addDays(day: string, n: number) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function lastSunday(month: string) {
  const d = new Date(month + '-01T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return addDays(d.toISOString().slice(0, 10), -d.getUTCDay());
}
// Weekly cards belong to the Sunday service, including the preceding Saturday submission window.
export function cardPeriod(habit: string, day: string, frequency?: string) {
  if (['iRead', 'iPray'].includes(habit) || frequency === 'daily') return day;
  if (habit === 'iShare' || frequency === 'monthly') return day.slice(0, 7);
  if (
    frequency === 'weekly' &&
    !['iRate', 'iTithes', 'iPraise', 'iCare', 'iSpeak', 'iNote'].includes(habit)
  )
    return weekStart(day);
  return new Date(day + 'T12:00:00Z').getUTCDay() === 6 ? addDays(day, 1) : weekStart(day);
}
export const REVIEW_HOURS: Record<string, [number, number]> = {
  iRate: [480, 510],
  iTithes: [480, 1050],
  iPraise: [600, 840],
  iCare: [600, 1080],
  iSpeak: [600, 1080],
  iNote: [600, 1080],
  iShare: [480, 1080],
};
export function submissionOpen(
  habit: string,
  period: string,
  now = new Date(),
  zone = 'Asia/Manila',
  frequency?: string,
) {
  const c = localClock(now, zone);
  if (['iRead', 'iPray'].includes(habit) || frequency === 'daily') return period === c.day;
  if (habit === 'iShare')
    return (
      period === c.day.slice(0, 7) &&
      (c.day < lastSunday(period) || (c.day === lastSunday(period) && c.minutes < 480))
    );
  if (frequency === 'monthly') return period === c.day.slice(0, 7);
  if (!REVIEW_HOURS[habit]) return period === weekStart(c.day);
  const cutoff = (
    { iRate: 480, iTithes: 480, iPraise: 600, iCare: 720, iSpeak: 1020, iNote: 1020 } as Record<
      string,
      number
    >
  )[habit];
  const openDay = addDays(period, ['iSpeak', 'iNote'].includes(habit) ? 0 : -1);
  return c.day >= openDay && (c.day < period || (c.day === period && c.minutes < cutoff));
}
export function reviewOpen(habit: string, period: string, now = new Date(), zone = 'Asia/Manila') {
  const range = REVIEW_HOURS[habit];
  if (!range) return false;
  const c = localClock(now, zone);
  const day = habit === 'iShare' ? lastSunday(period) : period;
  return c.day === day && c.minutes >= range[0] && c.minutes < range[1];
}
export function fragments(habit: string, data: Record<string, any>) {
  if (habit === 'iRead')
    return READ_TYPES.filter((t) =>
      Array.isArray(data.activities) ? data.activities.includes(t) : data.type === t,
    ).length;
  if (habit === 'iPray')
    return ['morning', 'adhoc', 'evening'].filter((k) => data[k] === true).length;
  return data.done === true ? 1 : 0;
}
export function mood(hour: number, completed = false): 'happy' | 'sad' | 'disappointed' {
  return completed || hour < 21 ? 'happy' : hour < 22 ? 'sad' : 'disappointed';
}
export function privileged(roles: string[], scope: { roles: string[] }[] = []) {
  return (
    roles.includes('admin') ||
    roles.includes('auditor') ||
    scope.some((g) => g.roles.includes('auditor'))
  );
}
export function scheduled(day: string, frequency: string, schedule: { slots?: number[] } = {}) {
  if (!schedule.slots?.length) return true;
  const d = new Date(day + 'T12:00:00Z');
  const sunday = weekStart(day);
  const first = sunday.slice(0, 7) + '-01';
  const firstSunday = addDays(first, (7 - new Date(first + 'T12:00:00Z').getUTCDay()) % 7);
  const index =
    frequency === 'daily'
      ? d.getUTCDay()
      : frequency === 'monthly'
        ? d.getUTCMonth() % 3
        : Math.floor((Date.parse(sunday) - Date.parse(firstSunday)) / 604800000);
  return schedule.slots.includes(index);
}
