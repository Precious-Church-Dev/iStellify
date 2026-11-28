import ExcelJS from 'exceljs';
export type ImportMember = {
  pcm: string;
  name: string;
  tag: string;
  email: string;
  gender?: RosterGender;
  groups: { code: string; kind: string; role: string }[];
};
type RosterGender = 'male' | 'female';

export type ImportPreview = { members: ImportMember[]; errors: string[]; warnings: string[] };
function clean(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    if ('text' in v) return String((v as any).text);
    if ('result' in v) return String((v as any).result ?? '');
    if ('richText' in v) return (v as any).richText.map((r: any) => r.text).join('');
  }
  return String(v).trim();
}
async function memberProfileSheet(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const profile = workbook.getWorksheet('Member Profile');
  if (!profile) throw new Error('Expected a Member Profile sheet.');
  if (profile.rowCount > 2000)
    throw new Error('Roster is too large. Limit the workbook to 2000 rows.');
  return profile;
}

function rosterGender(value: unknown): RosterGender | undefined {
  const text = clean(value).trim().toLowerCase();
  if (text === 'male' || text === 'm') return 'male';
  if (text === 'female' || text === 'f') return 'female';
}

function genderColumn(profile: ExcelJS.Worksheet) {
  let column: number | undefined;
  profile.getRow(1).eachCell((cell, index) => {
    if (/^gender\b/i.test(clean(cell.value).trim())) column = index;
  });
  return column;
}

export async function parseRosterGenders(buffer: Buffer) {
  const profile = await memberProfileSheet(buffer);
  const column = genderColumn(profile);
  if (!column) throw new Error('Expected a Gender column in the Member Profile sheet.');
  const found = new Map<string, RosterGender>();
  const conflicts = new Set<string>();
  let missingGender = 0;
  profile.eachRow((row, index) => {
    if (index === 1) return;
    const pcm = clean(row.getCell(2).value).toUpperCase();
    if (!/^PCM\d{4}$/.test(pcm)) return;
    const gender = rosterGender(row.getCell(column).value);
    if (!gender) {
      missingGender++;
      return;
    }
    if (found.has(pcm) && found.get(pcm) !== gender) conflicts.add(pcm);
    found.set(pcm, gender);
  });
  for (const pcm of conflicts) found.delete(pcm);
  return { rows: [...found], conflicts: conflicts.size, missingGender };
}

export async function parseRoster(buffer: Buffer): Promise<ImportPreview> {
  const profile = await memberProfileSheet(buffer);
  const genderIndex = genderColumn(profile);
  const members: ImportMember[] = [],
    errors: string[] = [],
    warnings: string[] = [];
  const seen = new Set<string>(),
    emails = new Map<string, string>();
  profile.eachRow((r, n) => {
    if (n === 1) return;
    const val = (c: number) => clean(r.getCell(c).value);
    const pcm = val(2).toUpperCase();
    if (!pcm) return;
    if (!/^PCM\d{4}$/.test(pcm)) {
      errors.push(`Member Profile row ${n}: invalid church number.`);
      return;
    }
    if (seen.has(pcm)) {
      errors.push(`Member Profile row ${n}: duplicate ${pcm}.`);
      return;
    }
    seen.add(pcm);
    const name = [val(5), val(6), val(4)].filter(Boolean).join(' ');
    if (!name) {
      errors.push(`Member Profile row ${n}: name is missing.`);
      return;
    }
    const tag = val(3);
    if (!['iStellify', 'StelliKids', ''].includes(tag))
      errors.push(`${pcm}: unknown experience tag ${tag}.`);
    const email = val(27).toLowerCase() === 'n/a' ? '' : val(27).toLowerCase();
    if (email && emails.has(email))
      warnings.push(
        `${pcm} and ${emails.get(email)} share an email; accounts will remain separate.`,
      );
    if (email) emails.set(email, pcm);
    const groups: ImportMember['groups'] = [];
    for (const [column, roleColumn, kind] of [
      [13, 14, 'family'],
      [15, 16, 'care'],
      [17, 18, 'share'],
      [19, 20, 'finance'],
    ] as const) {
      const code = val(column);
      if (!code) continue;
      for (const raw of code.split(/[,;]/)) {
        const norm = raw.trim().replace(/\.$/, '').replace(/\s+/g, ' ').toUpperCase();
        if (!norm) continue;
        const text = val(roleColumn).toLowerCase();
        let role = 'member';
        if (kind === 'care' && text.includes('servant')) role = 'servant';
        if (kind === 'share' && text.includes('captain')) role = 'captain';
        if (kind === 'finance' && text.includes('auditor')) role = 'auditor';
        if (kind === 'family' && text.includes('leader')) role = 'leader';
        groups.push({ code: norm.replace(/^HIS\s*KIDS$/, 'HISKIDS'), kind, role });
      }
    }
    if (!tag && pcm !== 'PCM0001')
      warnings.push(`${pcm}: no experience tag; defaults to adult pending correction.`);
    if (val(21).includes('Auditor'))
      warnings.push(
        `${pcm}: church-level auditor scope requires explicit per-group grants after import.`,
      );
    members.push({
      pcm,
      name,
      tag: tag || 'iStellify',
      email,
      groups,
      gender: genderIndex ? rosterGender(r.getCell(genderIndex).value) : undefined,
    });
  });
  warnings.push(
    'Passwords, health details, emergency contacts and spiritual-status fields are intentionally excluded from this pilot import.',
  );
  warnings.push(
    'Auxiliary sheets are reference material. Review Servant, Captain and Auditor permissions before granting them. Group memberships import as ordinary membership; leader roles require the explicit checkbox.',
  );
  return { members, errors, warnings };
}
