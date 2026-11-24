export const MODULES = [
  { id: 'individual', label: 'iStellify', caption: 'Your spiritual and personal growth' },
  { id: 'kids', label: 'StelliKids', caption: 'A growing journey for little stars' },
  { id: 'care', label: 'StelliCare', caption: 'Caring and Bearing Ministry' },
  { id: 'share', label: 'StelliShare', caption: 'Sharing and Bearing Ministry' },
  { id: 'church', label: 'StelliChurch', caption: 'Our church community' },
  { id: 'coach', label: 'StelliCoach', caption: 'Guides and holistic life learning' },
  { id: 'finance', label: 'StelliTithes', caption: 'Stewardship and reconciliation' },
  { id: 'settings', label: 'StelliSet', caption: 'Your profile and preferences' },
  { id: 'admin', label: 'StelliAd', caption: 'Church administration' },
] as const;
export type ModuleId = (typeof MODULES)[number]['id'];
export function landingModule(tag: string): ModuleId {
  return tag === 'StelliKids' ? 'kids' : 'individual';
}
export function memberSections(kids: boolean) {
  return [
    { id: 'home', label: kids ? 'SkidiStat' : 'StelliStat' },
    { id: 'light', label: kids ? 'SkidiLight' : 'StelliLight' },
    { id: 'life', label: kids ? 'SkidiLife' : 'StelliLife' },
    { id: 'groups', label: kids ? 'SkidiLink' : 'StelliLink' },
    ...(!kids
      ? [
          { id: 'save', label: 'StelliSave' },
          { id: 'best', label: 'StelliBEST' },
          { id: 'cleanse', label: 'StelliCleanse' },
          { id: 'lot', label: 'StelliLOT' },
        ]
      : []),
    { id: 'goals', label: kids ? 'SkidiBase' : 'StelliBase' },
    { id: 'rate', label: kids ? 'SkidiGrade' : 'StelliGrade' },
  ];
}
export function moduleAllowed(
  id: ModuleId,
  user: { tag: string; roles: string[] },
  children: number,
) {
  if (id === 'admin' || id === 'finance')
    return user.roles.some((r) => ['admin', 'auditor'].includes(r));
  if (id === 'individual') return user.tag !== 'StelliKids';
  if (id === 'kids')
    return user.tag === 'StelliKids' || children > 0 || user.roles.includes('admin');
  return true;
}
