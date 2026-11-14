import { query } from '@/lib/db.mjs';
import { requireUser, memberships, sameOrigin, HttpError, token, audit } from '@/lib/security';
import { leadsMinistry, readsMinistryItem } from '@/lib/ministry-access';
import { churchDate, weekStart } from '@/lib/domain';
export const dynamic = 'force-dynamic';
const KINDS: Record<string, string[]> = {
  care: ['icebreaker', 'assignment', 'prayer', 'task', 'session'],
  share: ['assignment', 'prayer', 'task', 'strategy', 'session'],
  church: ['slides', 'view', 'board', 'dates', 'prayer', 'counsel', 'help', 'goal', 'task'],
};
async function context(user: any, module: string) {
  if (!KINDS[module]) throw new HttpError(400, 'Unknown module.');
  const scope = await memberships(user.id),
    global = user.roles.includes('admin') || user.roles.includes('pastor');
  const groups =
    module === 'church'
      ? []
      : (
          await query(
            'SELECT g.id,g.name,g.code,g.kind FROM groups g WHERE g.kind=$1 AND ($2::boolean OR g.id=ANY($3::text[])) ORDER BY g.name',
            [module, global, scope.map((s) => s.group_id)],
          )
        ).rows;
  return { scope, groups, global };
}
export async function GET(req: Request) {
  try {
    const u = await requireUser(),
      p = new URL(req.url).searchParams,
      module = p.get('module') || 'care',
      c = await context(u, module),
      selected = p.get('group') || c.groups[0]?.id || null;
    if (selected && !c.groups.some((g: any) => g.id === selected))
      throw new HttpError(403, 'This group is outside your ministry scope.');
    const leader = leadsMinistry(u, c.scope, module, selected),
      publisher = leader || u.roles.includes('admin');
    const all = (
      await query(
        'SELECT i.*,m.name AS author_name,m.pcm AS author_pcm FROM ministry_items i JOIN members m ON m.id=i.owner_id WHERE i.module=$1 AND (i.group_id=$2 OR (i.group_id IS NULL AND $2::text IS NULL)) ORDER BY i.updated_at DESC LIMIT 300',
        [module, selected],
      )
    ).rows;
    const items = all.filter((i: any) => readsMinistryItem(u, c.scope, i));
    const members = selected
      ? (
          await query(
            `SELECT m.id,m.name,m.nickname,m.pcm,m.tag,mg.roles,
 (SELECT count(*)::int FROM logs l WHERE l.member_id=m.id AND l.period=$2 AND l.status<>'draft') AS weekly_entries
 FROM memberships mg JOIN members m ON m.id=mg.member_id WHERE mg.group_id=$1 AND m.active=true AND (m.tag<>'StelliKids' OR $3::boolean OR m.id=$4) ORDER BY m.name`,
            [selected, weekStart(churchDate()), leader || u.roles.includes('admin'), u.id],
          )
        ).rows
      : [];
    const testimonials = (
      await query(
        `SELECT p.id,p.title,p.data,p.updated_at,m.name AS author_name FROM personal_items p JOIN members m ON m.id=p.member_id WHERE p.kind='testimony' AND (p.visibility='church' OR (p.visibility='care' AND p.group_ids && $1::text[])) ORDER BY p.updated_at DESC LIMIT 30`,
        [c.scope.filter((s) => s.kind === 'care').map((s) => s.group_id)],
      )
    ).rows;
    const analytics =
      module === 'church' && (u.roles.includes('pastor') || u.roles.includes('admin'))
        ? (
            await query(
              'SELECT habit,status,count(*)::int AS count FROM logs WHERE period IN ($1,$2,$3) GROUP BY habit,status ORDER BY habit',
              [churchDate(), weekStart(churchDate()), churchDate().slice(0, 7)],
            )
          ).rows
        : [];
    return Response.json({
      module,
      groups: c.groups,
      selected,
      leader,
      publisher,
      items,
      members,
      testimonials,
      analytics,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof HttpError ? e.message : 'Unable to load this ministry.' },
      { status: e instanceof HttpError ? e.status : 500 },
    );
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    if (Number(req.headers.get('content-length') || 0) > 30000)
      throw new HttpError(413, 'Please shorten this entry.');
    const b = await req.json(),
      module = String(b.module),
      c = await context(u, module),
      group = module === 'church' ? null : String(b.group || '');
    if (module !== 'church' && !c.groups.some((g: any) => g.id === group))
      throw new HttpError(403, 'This group is outside your ministry scope.');
    const leader = leadsMinistry(u, c.scope, module, group),
      publisher = leader || u.roles.includes('admin');
    if (b.action === 'state') {
      const old = (
        await query('SELECT * FROM ministry_items WHERE id=$1 AND module=$2', [b.id, module])
      ).rows[0] as any;
      if (
        !old ||
        old.group_id !== group ||
        !readsMinistryItem(u, c.scope, old) ||
        (old.owner_id !== u.id && !publisher)
      )
        throw new HttpError(403, 'You cannot change this item.');
      if (!['todo', 'doing', 'done'].includes(b.state)) throw new HttpError(400, 'Invalid status.');
      await query('UPDATE ministry_items SET state=$1,updated_at=now() WHERE id=$2', [
        b.state,
        b.id,
      ]);
      await audit(u.id, 'ministry.state', b.id, { state: b.state });
      return Response.json({ ok: true });
    }
    const kind = String(b.kind),
      title = String(b.title || '')
        .trim()
        .slice(0, 140),
      body = String(b.body || '')
        .trim()
        .slice(0, 12000),
      data = b.data || {};
    if (!KINDS[module].includes(kind) || !title)
      throw new HttpError(400, 'Choose an entry type and title.');
    if (!['prayer', 'counsel', 'help'].includes(kind) && !publisher)
      throw new HttpError(403, 'Your ministry leader manages this section.');
    if (JSON.stringify(data).length > 8000) throw new HttpError(400, 'This entry is too long.');
    const visibility = ['counsel', 'help'].includes(kind)
      ? 'private'
      : kind === 'task'
        ? 'leaders'
        : kind === 'prayer'
          ? b.visibility === 'members'
            ? 'members'
            : 'private'
          : 'members';
    if (kind === 'assignment') {
      const selected = [data.facilitator, data.firstAnswer, data.prayer].filter(Boolean);
      if (selected.length) {
        const r = await query(
          'SELECT member_id FROM memberships WHERE group_id=$1 AND member_id=ANY($2::text[])',
          [group, selected],
        );
        if (r.rows.length !== new Set(selected).size)
          throw new HttpError(400, 'Choose people assigned to this group.');
      }
    }
    const id = token();
    await query(
      'INSERT INTO ministry_items(id,module,group_id,kind,title,body,data,visibility,owner_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [id, module, group, kind, title, body, JSON.stringify(data), visibility, u.id],
    );
    await audit(u.id, 'ministry.' + kind + '.create', id, { module, group, visibility });
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json(
      { error: e instanceof HttpError ? e.message : 'Unable to save this ministry entry.' },
      { status: e instanceof HttpError ? e.status : 500 },
    );
  }
}
