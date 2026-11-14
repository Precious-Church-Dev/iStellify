import { query, transaction } from '@/lib/db.mjs';
import { requireUser, sameOrigin, HttpError, token, audit, memberships } from '@/lib/security';
import { churchDate, validDay, weekStart } from '@/lib/domain';
export const dynamic = 'force-dynamic';
async function subjectFor(user: any, id: string) {
  if (!id || id === user.id) return user;
  const r = await query(
    'SELECT m.id,m.tag FROM guardian_links g JOIN members m ON m.id=g.child_id WHERE guardian_id=$1 AND child_id=$2 AND m.active=true',
    [user.id, id],
  );
  if (!r.rows.length) throw new HttpError(403, 'Guardian access required.');
  return r.rows[0];
}
export async function GET(req: Request) {
  try {
    const u = await requireUser(),
      params = new URL(req.url).searchParams,
      subject = await subjectFor(u, params.get('subject') || u.id),
      today = churchDate(),
      day = params.get('date') || today,
      range = params.get('range') || 'week';
    if (!validDay(day)) throw new HttpError(400, 'Invalid date.');
    let from = weekStart(day),
      to = day;
    const d = new Date(day + 'T12:00:00Z');
    if (range === 'month') from = day.slice(0, 7) + '-01';
    if (range === 'quarter')
      from =
        day.slice(0, 4) +
        '-' +
        String(Math.floor(d.getUTCMonth() / 3) * 3 + 1).padStart(2, '0') +
        '-01';
    if (range === 'year') from = day.slice(0, 4) + '-01-01';
    const logs = await query(
      "SELECT habit,period,status,created_at,updated_at FROM logs WHERE member_id=$1 AND (CASE WHEN length(period)=7 THEN period||'-01' ELSE period END)>=$2 AND (CASE WHEN length(period)=7 THEN period||'-01' ELSE period END)<=$3 ORDER BY period",
      [subject.id, from, to],
    );
    const items = await query(
      'SELECT id,kind,title,data,visibility,created_at,updated_at FROM personal_items WHERE member_id=$1 ORDER BY updated_at DESC LIMIT 500',
      [subject.id],
    );
    return Response.json({ items: items.rows, logs: logs.rows, from, to, range });
  } catch (e) {
    return Response.json(
      { error: e instanceof HttpError ? e.message : 'Unable to load this private section.' },
      { status: e instanceof HttpError ? e.status : 500 },
    );
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    if (Number(req.headers.get('content-length') || 0) > 70000)
      throw new HttpError(413, 'Please shorten this entry.');
    const b = await req.json(),
      subject = await subjectFor(u, b.subject || u.id),
      kind = String(b.kind),
      data = b.data || {},
      title = String(b.title || '')
        .trim()
        .slice(0, 140);
    if (!['goal', 'assessment', 'salvation', 'testimony'].includes(kind) || !title)
      throw new HttpError(400, 'Choose a section and enter its title.');
    if (subject.tag === 'StelliKids' && ['salvation', 'testimony'].includes(kind))
      throw new HttpError(403, 'This section belongs to the adult experience.');
    if (JSON.stringify(data).length > 50000)
      throw new HttpError(400, 'Please keep this entry under 50,000 characters.');
    if (kind === 'goal' && (!data.targetDate || !validDay(data.targetDate)))
      throw new HttpError(400, 'Choose a goal target date.');
    if (
      kind === 'salvation' &&
      (!data.salvationDate ||
        !validDay(data.salvationDate) ||
        data.salvationDate > churchDate() ||
        !String(data.understanding || '').trim() ||
        !String(data.confirmation || '').trim())
    )
      throw new HttpError(
        400,
        'Enter a past or current salvation date, your understanding of salvation and how you confirmed your faith.',
      );
    if (kind === 'assessment') {
      if (!validDay(String(data.measuredOn)) || data.measuredOn > churchDate())
        throw new HttpError(400, 'Choose a past or current measurement date.');
      for (const [key, max] of [
        ['weight', 1000],
        ['height', 300],
        ['systolic', 400],
        ['diastolic', 400],
      ] as const) {
        if (
          data[key] !== '' &&
          data[key] != null &&
          (!Number.isFinite(Number(data[key])) || Number(data[key]) <= 0 || Number(data[key]) > max)
        )
          throw new HttpError(400, 'Enter a valid positive value for ' + key + '.');
      }
    }
    if (
      kind === 'testimony' &&
      ['before', 'event', 'salvationDay', 'today'].some((k) => !String(data[k] || '').trim())
    )
      throw new HttpError(400, 'Complete all four B.E.S.T. testimony fields.');
    const visibility =
      kind === 'testimony' && ['care', 'church'].includes(b.visibility) ? b.visibility : 'private';
    const groups =
      visibility === 'care'
        ? (await memberships(subject.id)).filter((s) => s.kind === 'care').map((s) => s.group_id)
        : [];
    if (visibility === 'care' && !groups.length)
      throw new HttpError(400, 'You need a Care Group before sharing with it.');
    const id = b.id || token();
    await transaction(async (db: any) => {
      if (b.id) {
        const own = await db.query(
          'SELECT member_id,kind FROM personal_items WHERE id=$1 FOR UPDATE',
          [id],
        );
        if (!own.rows.length || own.rows[0].member_id !== subject.id)
          throw new HttpError(403, 'This entry belongs to another member.');
        if (own.rows[0].kind !== kind) throw new HttpError(400, 'Entry type cannot be changed.');
        await db.query(
          'UPDATE personal_items SET title=$1,data=$2,visibility=$3,group_ids=$4,updated_at=now() WHERE id=$5',
          [title, JSON.stringify(data), visibility, groups, id],
        );
      } else
        await db.query(
          'INSERT INTO personal_items(id,member_id,kind,title,data,visibility,group_ids) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [id, subject.id, kind, title, JSON.stringify(data), visibility, groups],
        );
      await audit(
        u.id,
        'personal.' + kind + '.save',
        id,
        { visibility, assisted: subject.id !== u.id },
        db,
      );
    });
    return Response.json({
      ok: true,
      id,
      message:
        'Saved to your ' +
        (kind === 'salvation'
          ? 'StelliSave'
          : kind === 'testimony'
            ? 'StelliBEST'
            : kind === 'goal'
              ? 'goals'
              : 'assessment') +
        '.',
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof HttpError ? e.message : 'Unable to save this entry.' },
      { status: e instanceof HttpError ? e.status : 500 },
    );
  }
}
