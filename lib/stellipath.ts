export const STELLI_MILESTONES = [
  {
    key: 'stelliPent',
    title: 'StelliPent',
    phase: 'StelliPent',
    start: '2026-11-28',
    deadline: '2027-01-17',
  },
  { key: 'year1', title: 'Year 1', phase: '2027', start: '2027-01-17', deadline: '2027-12-26' },
  { key: 'year2', title: 'Year 2', phase: '2028', start: '2027-12-27', deadline: '2028-12-31' },
  { key: 'year3', title: 'Year 3', phase: '2029', start: '2029-01-01', deadline: '2029-12-30' },
] as const;

export const STELLI_STATES = {
  SbG: { label: 'Saved by Grace', symbol: '★' },
  sP2S: { label: 'Stellified Permitted to Share', symbol: '★ ▴' },
  AoS: { label: 'Assured of Salvation', symbol: '★ ★' },
} as const;

export type StelliStateTag = keyof typeof STELLI_STATES;
export type MemberGender = 'male' | 'female' | 'unspecified';

export function stelliState(value?: string): StelliStateTag {
  switch (value?.toLowerCase()) {
    case 'sp2s':
      return 'sP2S';
    case 'aos':
      return 'AoS';
    default:
      return 'SbG';
  }
}

// Inputs are local calendar dates in YYYY-MM-DD form. UTC arithmetic keeps
// a calendar day the same length even across daylight saving time changes.
export function daysRemaining(deadline: string, day: string) {
  return Math.max(0, (Date.parse(deadline) - Date.parse(day)) / 86_400_000);
}

export function stelliPath(day: string) {
  const nextPhase = STELLI_MILESTONES.findIndex((milestone) => day < milestone.start);
  const index = nextPhase === -1 ? STELLI_MILESTONES.length - 1 : Math.max(0, nextPhase - 1);
  const phase = STELLI_MILESTONES[index];
  const end = STELLI_MILESTONES[index + 1]?.start ?? phase.deadline;
  const elapsed = Math.min(daysRemaining(day, phase.start), daysRemaining(end, phase.start));
  const position = (index + elapsed / daysRemaining(end, phase.start)) / STELLI_MILESTONES.length;
  const days = {
    stelliPent: daysRemaining(STELLI_MILESTONES[0].deadline, day),
    year1: daysRemaining(STELLI_MILESTONES[1].deadline, day),
    year2: daysRemaining(STELLI_MILESTONES[2].deadline, day),
    year3: daysRemaining(STELLI_MILESTONES[3].deadline, day),
  };
  return { phase, position, days };
}
