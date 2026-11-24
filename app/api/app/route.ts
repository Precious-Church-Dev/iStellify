import { v21Action, v21State } from '@/lib/v21';
import { cardPeriod, localClock, submissionOpen, reviewOpen, fragments, READ_TYPES, scheduled } from '@/lib/cards';
import { query, transaction } from '@/lib/db.mjs';
import {
  audit,
  digest,
  HttpError,
  memberships,
  requireUser,
  sameOrigin,
  token,
  passwordHash,
} from '@/lib/security';
import {
  canFinance,
  canReview,
  churchDate,
  DAILY,
  isAdmin,
  lockEnd,
  MONTHLY,
  periodFor,
  tithe,
  validDay,
  WEEKLY,
  weekStart,
} from '@/lib/domain';
export const dynamic = 'force-dynamic';
const run = async (sql: string, p: unknown[] = []) => (await query(sql, p)).rows as any[];
function fail(message: string, status = 400): never {
  throw new HttpError(status, message);
}
function outError(e: unknown) {
  const duplicate = (e as any)?.code === '23505';
  if (!(e instanceof HttpError) && !duplicate)
    console.error('pilot_request_failed', { code: (e as any)?.code || 'unknown' });
  return Response.json(
    {
      error:
        e instanceof HttpError
          ? e.message
          : duplicate
            ? 'This record already exists. Reload to see its latest version.'
            : 'The request could not be saved. Please try again or contact your administrator.',
    },
    { status: e instanceof HttpError ? e.status : duplicate ? 409 : 500 },
  );
}
async function subjectFor(u: any, id: string) {
  if (!id || id === u.id) return u;
  const child = await run(
    'SELECT m.id,m.pcm,m.name,m.nickname,m.tag,m.roles,m.spiritual_state FROM guardian_links gl JOIN members m ON m.id=gl.child_id WHERE gl.guardian_id=$1 AND gl.child_id=$2 AND m.active=true',
    [u.id, id],
  );
  if (!child.length) fail('This member is not linked to your account.', 403);
  return child[0];
}
export async function GET(req: Request) {
  try {
    const user = await requireUser(),
      url = new URL(req.url),
      subject = await subjectFor(user, url.searchParams.get('subject') || user.id);
    const scope = await memberships(user.id),
      subjectScope = subject.id === user.id ? scope : await memberships(subject.id);
    const memberTimezone=(await run('SELECT timezone FROM members WHERE id=$1',[subject.id]))[0]?.timezone||'Asia/Manila';
    const today = localClock(new Date(),memberTimezone).day,
      day = url.searchParams.get('date') || today;
    if (!validDay(day)) fail('Invalid date.');
    const own = await run(
      'SELECT * FROM logs WHERE member_id=$1 AND period IN ($2,$3,$4) ORDER BY updated_at DESC',
      [subject.id, day, weekStart(day), day.slice(0, 7)],
    );
    const all = await run(
      `SELECT l.*,m.name,m.nickname,m.pcm,m.timezone,(SELECT max(expires_at) FROM unlock_requests r WHERE r.member_id=l.member_id AND r.habit=l.habit AND r.period=l.period AND r.status='used' AND r.expires_at>now()) AS grace_expires_at,(SELECT a.drive_web_view_link FROM attachments a WHERE a.id=l.data->>'attachmentId' AND a.owner_id=l.member_id) AS attachment_drive_url FROM logs l JOIN members m ON m.id=l.member_id WHERE l.period IN ($1,$2,$3) AND l.status<>'draft' AND l.member_id<>$4 AND (l.group_ids && $5::text[] OR $6::boolean) ORDER BY l.updated_at DESC LIMIT 300`,
      [
        day,
        weekStart(day),
        day.slice(0, 7),
        user.id,
        scope.map((s) => s.group_id),
        user.roles.some(r=>['admin','pastor'].includes(r)),
      ],
    );
    const review = all
      .filter((l) => canReview(user, scope, l))
      .map((l) =>
        DAILY.includes(l.habit)
          ? {
              ...l,
              data: {
                type: l.data.type,
                duration: l.data.duration,
                morning: l.data.morning,
                adhoc: l.data.adhoc,
                evening: l.data.evening,
                privacy: 'Private journal content is hidden. Review completion metadata only.',
              },
            }
          : l,
      );
    const peers = await run(
      `SELECT DISTINCT m.id,m.name,m.nickname,m.pcm,g.id AS group_id,g.name AS group_name,g.kind,
 (SELECT count(*)::int FROM logs l WHERE l.member_id=m.id AND l.period=$2 AND l.status<>'draft' AND l.habit IN ('iRead','iPray')) AS daily_count
 FROM memberships mg JOIN memberships mine ON mine.group_id=mg.group_id JOIN members m ON m.id=mg.member_id JOIN groups g ON g.id=mg.group_id
 WHERE (mine.member_id=$1 OR $4::boolean) AND m.id<>$1 AND m.active=true AND m.tag<>'StelliKids' AND g.kind IN ('family','care','share') AND ($3::boolean=false OR g.kind='family') ORDER BY g.kind,m.name`,
      [subject.id, day, subject.tag === 'StelliKids',user.roles.some(r=>['admin','pastor'].includes(r))],
    );
    const notes = await run(
      'SELECT id,message,created_at,read_at FROM notifications WHERE recipient_id=$1 ORDER BY created_at DESC LIMIT 30',
      [user.id],
    );
    const children = await run(
      'SELECT m.id,m.pcm,m.name,m.nickname,m.tag FROM guardian_links gl JOIN members m ON m.id=gl.child_id WHERE gl.guardian_id=$1 AND m.active=true',
      [user.id],
    );
    const commitments = await run(
      'SELECT c.*,c.start_date::text AS start_date,c.lock_until::text AS lock_until FROM commitments c WHERE c.member_id=$1 AND c.archived=false ORDER BY c.start_date',
      [subject.id],
    );
    const question =
      (await run('SELECT value FROM settings WHERE key=$1', ['question:' + cardPeriod('iSpeak',day)]))[0]
        ?.value || null;
    const admin = isAdmin(user)
      ? {
          members: await run(
            'SELECT id,pcm,name,nickname,tag,email,roles,active,spiritual_state,password_hash IS NOT NULL AS activated FROM members ORDER BY pcm',
          ),
          groups: await run('SELECT * FROM groups ORDER BY kind,code'),
          memberships: await run('SELECT * FROM memberships'),
          guardians: await run('SELECT guardian_id,child_id,consent_at FROM guardian_links'),
          audit: await run(
            'SELECT a.action,a.target,a.created_at,m.pcm FROM audit_events a LEFT JOIN members m ON m.id=a.actor_id ORDER BY a.created_at DESC LIMIT 30',
          ),
        }
      : null;
    const finance = all.filter((l) => l.habit === 'iTithes' && canFinance(user, scope, l));
    return Response.json({
      subject,
      date: day,
      scope: subjectScope,
      review,
      peers,
      notifications: notes,
      children,
      commitments,
      question,
      admin,
      finance,
      roleScope: scope,
      ...(await v21State(user, scope, subject, day)),
      personalItems: await run(
        'SELECT id,kind,title,data,created_at,updated_at FROM personal_items WHERE member_id=$1 ORDER BY updated_at DESC LIMIT 200',
        [subject.id],
      ),
    });
  } catch (e) {
    return outError(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    if (Number(req.headers.get('content-length') || 0) > 150000) fail('Request is too large.', 413);
    const u = await requireUser(),
      b = await req.json(),
      scope = await memberships(u.id),
      today = churchDate();
    const subject = await subjectFor(u, b.subject || u.id);
    const result = await v21Action(b,u,scope,subject);
    if(result) return result;
    const zone = (await run('SELECT timezone FROM members WHERE id=$1',[subject.id]))[0]?.timezone || 'Asia/Manila';
    const localToday = localClock(new Date(),zone).day;
    if (b.action === 'log') {
      const habit = String(b.habit),
        day = String(b.date || localToday),
        data = b.data || {};
      if (!validDay(day) || day > localToday) fail('Choose today or an earlier date.');
      let frequency = DAILY.includes(habit)
        ? 'daily'
        : MONTHLY.includes(habit)
          ? 'monthly'
          : 'weekly';
      if (!DAILY.concat(WEEKLY, MONTHLY).includes(habit)) {
        const c = await run(
          'SELECT c.*,c.start_date::text AS start_date FROM commitments c WHERE c.id=$1 AND c.member_id=$2 AND c.archived=false',
          [habit, subject.id],
        );
        if (!c.length) fail('Habit is unavailable.');
        frequency = c[0].frequency;
        if(!scheduled(day,frequency,c[0].schedule))fail('This habit is not scheduled for this day or period.');
        if(day<String(c[0].start_date).slice(0,10)&&(frequency==='daily'||cardPeriod(habit,day,frequency)!==cardPeriod(habit,String(c[0].start_date).slice(0,10),frequency)))fail('This habit had not started yet.');
      }
      const period = cardPeriod(habit, day, frequency);
      const grace = (await run("SELECT * FROM unlock_requests WHERE member_id=$1 AND habit=$2 AND period=$3 AND status='approved' AND expires_at>now()",[subject.id,habit,period]))[0];
      if(!submissionOpen(habit,period,new Date(),zone,frequency) && !grace)
        fail('This card is locked. Request an unlock to submit or correct a closed period.',403);
      if (
        subject.tag === 'StelliKids' &&
        !['iRead', 'iPray', 'iPraise', 'iNote', 'iTithes'].includes(habit) &&
        DAILY.concat(WEEKLY, MONTHLY).includes(habit)
      )
        fail('This activity is not enabled for children in the pilot.');
      if (!b.draft) {
        if (
          habit === 'iRead' &&
          (!(READ_TYPES.includes(String(data.type)) || (Array.isArray(data.activities)&&data.activities.some((t:string)=>READ_TYPES.includes(t)))) ||
            !Number.isInteger(Number(data.duration)) ||
            Number(data.duration) < 1 ||
            Number(data.duration) > 1440)
        )
          fail('Choose a reading type and duration from 1 to 1440 minutes.');
        if (habit === 'iPray' && ![data.morning,data.adhoc,data.evening].some(v=>v===true))
          fail('Log at least one prayer activity before submitting.');
        if (habit === 'iPraise' && !['Online', 'Onsite', 'Absent'].includes(data.attendance))
          fail('Select your attendance.');
        if (
          habit === 'iCare' &&
          (!['Yes', 'No'].includes(data.attendance) || (data.attendance === 'No' && !data.reason))
        )
          fail('Select attendance and a reason when absent.');
        if (habit === 'iNote' && !String(data.notes || '').trim() && !data.attachmentId && !Object.entries(data).some(([k,v])=>/^bsf\d+$/.test(k)&&String(v||'').trim()))
          fail('Add notes or a handwritten notes attachment.');
        if (habit === 'iSpeak' && !String(data.answer || '').trim() && !data.attachmentId)
          fail('Add your answer or an attachment.');
        if (habit === 'iSpeak') {
          const q = await run('SELECT value FROM settings WHERE key=$1', [
            'question:' + weekStart(day),
          ]);
          if (!q.length) fail('A leader has not published this week’s question yet.');
          data.question = q[0].value;
        }
        if (
          habit === 'iRate' &&
          (!Number.isInteger(Number(data.rating)) ||
            Number(data.rating) < 1 ||
            Number(data.rating) > 5)
        )
          fail('Choose a rating from 1 to 5.');
        if (habit === 'iShare' && !data.strategy) fail('Add your sharing strategy.');
        if (habit === 'iTithes') {
          try {
            data.amounts = tithe(data);
          } catch (e) {
            fail((e as Error).message);
          }
        }
        if (
          !DAILY.concat(WEEKLY, MONTHLY).includes(habit) &&
          (!data.done ||
            !Number.isInteger(Number(data.duration)) ||
            Number(data.duration) < 1 ||
            Number(data.duration) > 1440)
        )
          fail('Confirm completion and enter actual minutes.');
      }
      if (data.notes?.length > 12000 || data.answer?.length > 12000)
        fail('Please keep notes under 12,000 characters.');
      const groups = await memberships(subject.id);
      const groupsForHabit = groups.filter((s) =>
        habit === 'iShare'
          ? s.kind === 'share'
          : habit === 'iTithes'
            ? s.kind === 'finance'
            : s.kind === 'care',
      );
      await transaction(async (db: any) => {
        if(grace){const g=(await db.query("SELECT id FROM unlock_requests WHERE id=$1 AND status='approved' AND expires_at>now() FOR UPDATE",[grace.id])).rows[0];if(!g)fail('This unlock has expired or was already used.',409)}
        if (data.attachmentId) {
          const a = await db.query('SELECT id FROM attachments WHERE id=$1 AND owner_id=$2', [
            data.attachmentId,
            subject.id,
          ]);
          if (!a.rows.length) fail('Attachment is unavailable.');
        }
        const prior = await db.query(
          'SELECT * FROM logs WHERE member_id=$1 AND habit=$2 AND period=$3 FOR UPDATE',
          [subject.id, habit, period],
        );
        const log = prior.rows[0];
        if (log && Number(b.version) !== log.version)
          fail('This entry changed. Reload before submitting again.', 409);
        const id = log?.id || token();
        if (log) {
          await db.query(
            'INSERT INTO log_versions(id,log_id,version,data,status,actor_id) VALUES($1,$2,$3,$4,$5,$6)',
            [token(), id, log.version, JSON.stringify(log.data), log.status, u.id],
          );
          await db.query(
            'UPDATE logs SET data=$1,status=$4,version=version+1,updated_at=now(),entered_by=$2 WHERE id=$3',
            [JSON.stringify(data), u.id, id, b.draft ? 'draft' : (DAILY.includes(habit) || !DAILY.concat(WEEKLY,MONTHLY).includes(habit)) ? 'confirmed' : 'pending'],
          );
        } else
          await db.query(
            'INSERT INTO logs(id,member_id,entered_by,habit,period,data,group_ids,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [
              id,
              subject.id,
              u.id,
              habit,
              period,
              JSON.stringify(data),
              groupsForHabit.map((s) => s.group_id),
              b.draft ? 'draft' : (DAILY.includes(habit) || !DAILY.concat(WEEKLY,MONTHLY).includes(habit)) ? 'confirmed' : 'pending',
            ],
          );
        if(!b.draft) {
          const points=fragments(habit,data);
          await db.query('INSERT INTO fragment_credits(log_id,member_id,points) VALUES($1,$2,$3) ON CONFLICT(log_id) DO UPDATE SET points=excluded.points',[id,subject.id,points]);
          await db.query('UPDATE members SET stellar_fragments=(SELECT COALESCE(sum(points),0) FROM fragment_credits WHERE member_id=$1) WHERE id=$1',[subject.id]);
          if(grace) await db.query("UPDATE unlock_requests SET status='used' WHERE id=$1",[grace.id]);
          if(submissionOpen(habit,period,new Date(),zone,frequency)) await db.query('UPDATE stellinudge_logs SET recipient_completed_after_nudge=true WHERE recipient_church_id=$1 AND stellicard_type=$2 AND period=$3 AND created_at<now()',[subject.id,habit,period]);
        }
        if (data.attachmentId)
          await db.query('UPDATE attachments SET log_id=$1 WHERE id=$2', [id, data.attachmentId]);
        await audit(
          u.id,
          log ? 'log.correct' : 'log.submit',
          id,
          { habit, period, version: log ? log.version + 1 : 1 },
          db,
        );
      });
      return Response.json({
        ok: true,
        message: b.draft
          ? 'Draft saved. Return when you’re ready to complete it.'
          : 'Saved. Daily logs are auto-verified; weekly/monthly cards enter the review queue.',
      });
    }
    if (b.action === 'review') {
      if (!['confirmed', 'flagged'].includes(b.decision)) fail('Choose confirm or flag.');
      if (b.decision === 'flagged' && !String(b.reason || '').trim())
        fail('A flag needs a reason.');
      await transaction(async (db: any) => {
        const r = await db.query('SELECT * FROM logs WHERE id=$1 FOR UPDATE', [b.id]);
        const log = r.rows[0];
        if (!log || !canReview(u, scope, log)) fail('You cannot review this entry.', 403);
        const memberZone=(await db.query('SELECT timezone FROM members WHERE id=$1',[log.member_id])).rows[0]?.timezone || 'Asia/Manila';
        const graceReview=(await db.query("SELECT id FROM unlock_requests WHERE member_id=$1 AND habit=$2 AND period=$3 AND status='used' AND expires_at>now()",[log.member_id,log.habit,log.period])).rows.length>0;
        if(!reviewOpen(log.habit,log.period,new Date(),memberZone)&&!graceReview) fail('This review window is closed. The record is read-only.',403);
        if (log.version !== Number(b.version) || log.status !== 'pending')
          fail('This entry has already changed. Reload the queue.', 409);
        let received = null;
        if (log.habit === 'iTithes' && b.decision === 'confirmed') {
          const { cents } = await import('@/lib/domain');
          received = cents(b.received);
          if (received !== log.data.amounts.net)
            fail('Received amount must equal the declared net. Flag discrepancies for resolution.');
        }
        await db.query(
          'INSERT INTO reviews(id,log_id,version,reviewer_id,decision,reason,received_cents) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [
            token(),
            log.id,
            log.version,
            u.id,
            b.decision,
            String(b.reason || '').slice(0, 2000),
            received,
          ],
        );
        await db.query('UPDATE logs SET status=$1,updated_at=now() WHERE id=$2', [
          b.decision,
          log.id,
        ]);
        await audit(u.id, 'review.' + b.decision, log.id, { version: log.version }, db);
      });
      return Response.json({ ok: true, message: 'Review saved.' });
    }
    if (b.action === 'commitment') {
      const name = String(b.name || '').trim();
      if (!name || name.length > 100 || !['daily', 'weekly', 'monthly'].includes(b.frequency))
        fail('Enter a habit name and valid frequency.');
      const duration = Number(b.duration);
      if (!Number.isInteger(duration) || duration < 1 || duration > 1440)
        fail('Duration must be 1 to 1440 minutes.');
      const schedule=b.schedule||{};
      if(schedule.slots&&(!Array.isArray(schedule.slots)||!schedule.slots.length||schedule.slots.some((n:unknown)=>!Number.isInteger(n)||Number(n)<0||Number(n)>(b.frequency==='daily'?6:b.frequency==='weekly'?5:2))))fail('Choose a valid custom schedule.');
      await query(
        'INSERT INTO commitments(id,member_id,habit,frequency,planned_time,duration,plan,start_date,lock_until,schedule) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [
          token(),
          subject.id,
          name,
          b.frequency,
          String(b.time || '').slice(0, 5),
          duration,
          String(b.plan || '').slice(0, 2000),
          today,
          lockEnd(today, b.frequency),
          JSON.stringify(schedule),
        ],
      );
      return Response.json({
        ok: true,
        message: 'Habit committed. Its schedule is locked for this commitment window.',
      });
    }
    if (b.action === 'archiveCommitment') {
      const rows = await run(
        'SELECT id,lock_until::text AS lock_until FROM commitments WHERE id=$1 AND member_id=$2',
        [b.id, subject.id],
      );
      if (!rows.length) fail('Habit not found.', 404);
      if (String(rows[0].lock_until).slice(0, 10) >= today && !isAdmin(u))
        fail('This commitment is still locked. An administrator can authorize an exception.');
      if (isAdmin(u) && !b.reason) fail('Enter a reason for the exception.');
      await query('UPDATE commitments SET archived=true WHERE id=$1', [b.id]);
      await audit(u.id, 'commitment.archive', b.id, { reason: b.reason || 'window ended' });
      return Response.json({ ok: true });
    }
    if (b.action === 'nudge') {
      const peer = await run(
        `SELECT DISTINCT m.id FROM memberships a JOIN memberships z ON a.group_id=z.group_id JOIN members m ON m.id=z.member_id WHERE a.member_id=$1 AND z.member_id=$2 AND m.tag<>'StelliKids' AND m.active=true`,
        [u.id, b.id],
      );
      if (!peer.length || b.id === u.id)
        fail('You can only encourage an adult linked to your groups.', 403);
      await transaction(async (db: any) => {
        await db.query('SELECT id FROM members WHERE id=$1 FOR UPDATE', [b.id]);
        const done = await db.query(
          "SELECT count(*)::int AS n FROM logs WHERE member_id=$1 AND period=$2 AND status<>'draft' AND habit IN ('iRead','iPray')",
          [b.id, today],
        );
        if (done.rows[0].n >= 2) fail('They have already completed today’s daily activities.');
        const duplicate = await db.query(
          'SELECT id FROM notifications WHERE sender_id=$1 AND recipient_id=$2 AND day=$3',
          [u.id, b.id, today],
        );
        if (duplicate.rows.length) fail('You have already encouraged this member today.');
        const n = await db.query(
          'SELECT count(*)::int AS n FROM notifications WHERE recipient_id=$1 AND day=$2',
          [b.id, today],
        );
        if (n.rows[0].n >= 3) fail('This member has received enough encouragement today.');
        await db.query(
          'INSERT INTO notifications(id,sender_id,recipient_id,message,day) VALUES($1,$2,$3,$4,$5)',
          [
            token(),
            u.id,
            b.id,
            `${u.nickname || u.name} is cheering you on. Take a moment for your growth today.`,
            today,
          ],
        );
        await audit(u.id, 'nudge.send', b.id, {}, db);
      });
      return Response.json({ ok: true, message: 'Encouragement sent.' });
    }
    if (b.action === 'profile') {
      await query('UPDATE members SET nickname=$1 WHERE id=$2', [
        String(b.nickname || '')
          .trim()
          .slice(0, 50),
        u.id,
      ]);
      return Response.json({ ok: true, message: 'Profile updated.' });
    }
    if (b.action === 'readNotifications') {
      await query('UPDATE notifications SET read_at=now() WHERE recipient_id=$1', [u.id]);
      return Response.json({ ok: true });
    }
    if (b.action === 'question') {
      if (!u.roles.includes('pastor') && !isAdmin(u))
        fail('Pastor or administrator permission required.', 403);
      if (!String(b.question || '').trim()) fail('Enter a question.');
      await query(
        'INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        [
          'question:' + weekStart(today),
          JSON.stringify({
            text: String(b.question).slice(0, 4000),
            publishedAt: new Date().toISOString(),
          }),
        ],
      );
      await audit(u.id, 'question.publish', weekStart(today));
      return Response.json({ ok: true, message: 'Weekly question published.' });
    }
    if (!isAdmin(u)) fail('Administrator permission required.', 403);
    if (b.action === 'unlockPeriod') {
      if (
        !validDay(String(b.date)) ||
        b.date > today ||
        !DAILY.concat(WEEKLY, MONTHLY).includes(String(b.habit))
      )
        fail('Choose an existing spiritual habit and past or current date.');
      if (!String(b.reason || '').trim()) fail('A reason is required for this exception.');
      const period = periodFor(b.habit, b.date),
        key = 'unlock:' + b.id + ':' + b.habit + ':' + period;
      const value = {
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        reason: String(b.reason).slice(0, 2000),
      };
      await query(
        'INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        [key, JSON.stringify(value)],
      );
      await audit(u.id, 'period.unlock', b.id, { habit: b.habit, period, reason: value.reason });
      return Response.json({
        ok: true,
        message: 'This member may correct the selected period for the next 24 hours.',
      });
    }
    if (b.action === 'removeGuardian') {
      await query('DELETE FROM guardian_links WHERE guardian_id=$1 AND child_id=$2', [
        b.guardian,
        b.child,
      ]);
      await audit(u.id, 'guardian.revoke', b.child, { guardian: b.guardian });
      return Response.json({ ok: true, message: 'Guardian access revoked.' });
    }
    if (b.action === 'createMember') {
      const name = String(b.name || '').trim();
      if (!name || name.length > 100) fail('Enter a name.');
      const id = token();
      let pcm = '';
      await transaction(async (db: any) => {
        await db.query('SELECT pg_advisory_xact_lock(88242)');
        const r = await db.query(
          'SELECT COALESCE(max(substring(pcm from 4)::int),0)+1 AS next FROM members',
        );
        const n = Number(r.rows[0].next);
        if (n > 9999) fail('Church-number range exhausted.');
        pcm = 'PCM' + String(n).padStart(4, '0');
        await db.query('INSERT INTO members(id,pcm,name,tag) VALUES($1,$2,$3,$4)', [
          id,
          pcm,
          name,
          b.tag === 'StelliKids' ? 'StelliKids' : 'iStellify',
        ]);
        await audit(u.id, 'member.create', id, { pcm }, db);
      });
      return Response.json({
        ok: true,
        message: `${pcm} created. Issue an activation code from Members.`,
      });
    }
    if (b.action === 'bulkTestingPassword') {
      if (!isAdmin(u)) fail('Administrator access required.', 403);
      if (b.confirm !== 'yes') fail('Confirm that existing non-admin passwords will be replaced.');
      const password = String(b.password || '');
      if (password.length < 12 || password.length > 128)
        fail('Use a temporary password between 12 and 128 characters.');
      const hash = await passwordHash(password);
      let count = 0;
      await transaction(async (db: any) => {
        const changed = await db.query(
          "UPDATE members SET password_hash=$1,password_change_required=false WHERE pcm<>'PCM0001' AND NOT ('admin'=ANY(roles)) RETURNING id",
          [hash],
        );
        const ids = changed.rows.map((m: any) => m.id);
        count = ids.length;
        await db.query('DELETE FROM sessions WHERE member_id=ANY($1::text[])', [ids]);
        await db.query(
          'UPDATE activation_tokens SET used_at=now() WHERE member_id=ANY($1::text[]) AND used_at IS NULL',
          [ids],
        );
        await audit(
          u.id,
          'account.bulk_testing_password',
          'non-admin-members',
          { count, purpose: 'Nov 15–18 familiarity testing; admin ends testing manually' },
          db,
        );
      });
      return Response.json({
        ok: true,
        count,
        message: `Testing password set for ${count} non-admin members. They can sign in normally until you trigger End testing. Admin accounts were excluded.`,
      });
    }
    if (b.action === 'bulkRequirePersonalPasswords') {
      if (!isAdmin(u)) fail('Administrator access required.', 403);
      if (b.confirm !== 'yes') fail('Confirm that testing is complete.');
      let count = 0;
      await transaction(async (db: any) => {
        const changed = await db.query(
          "UPDATE members SET password_change_required=true WHERE pcm<>'PCM0001' AND NOT ('admin'=ANY(roles)) RETURNING id",
        );
        const ids = changed.rows.map((m: any) => m.id);
        count = ids.length;
        await db.query('DELETE FROM sessions WHERE member_id=ANY($1::text[])', [ids]);
        await db.query(
          'UPDATE activation_tokens SET used_at=now() WHERE member_id=ANY($1::text[]) AND used_at IS NULL',
          [ids],
        );
        await audit(
          u.id,
          'account.bulk_require_personal_passwords',
          'non-admin-members',
          { count },
          db,
        );
      });
      return Response.json({
        ok: true,
        count,
        message: `Testing ended for ${count} non-admin members. At their next sign-in they must replace their current password with a different personal password. Admin accounts were excluded.`,
      });
    }
    if (b.action === 'reset') {
      const member = (await run('SELECT * FROM members WHERE id=$1', [b.id]))[0];
      if (!member) fail('Member not found.');
      const raw = token();
      await transaction(async (db: any) => {
        await db.query(
          'UPDATE activation_tokens SET used_at=now() WHERE member_id=$1 AND used_at IS NULL',
          [b.id],
        );
        await db.query(
          "INSERT INTO activation_tokens(token_hash,member_id,expires_at) VALUES($1,$2,now()+interval '24 hours')",
          [digest(raw), b.id],
        );
        await db.query('DELETE FROM sessions WHERE member_id=$1', [b.id]);
        await audit(u.id, 'account.activation_issue', b.id, {}, db);
      });
      return Response.json({
        ok: true,
        activationToken: raw,
        pcm: member.pcm,
        message: 'Deliver this one-use code privately. It expires in 24 hours.',
      });
    }
    if (b.action === 'memberAccess') {
      if (b.id === u.id) fail('Use a second administrator to change your own access.');
      const target = (await run('SELECT * FROM members WHERE id=$1', [b.id]))[0];
      if (!target) fail('Member not found.');
      if (!Array.isArray(b.roles) || b.roles.some((r: string) => !['admin', 'pastor'].includes(r)))
        fail('Invalid role.');
      if (b.roles.includes('pastor') && target.pcm !== 'PCM0002')
        fail('The pilot reserves the Pastor role for PCM0002.');
      if (b.tag && !['iStellify', 'StelliKids'].includes(b.tag))
        fail('Choose iStellify or StelliKids.');
      if (b.spiritualState && !['SBG', 'P2S', 'sP2S', 'AOS'].includes(b.spiritualState))
        fail('Choose a valid spiritual state.');
      await transaction(async (db: any) => {
        await db.query(
          'UPDATE members SET active=$1,roles=$2,tag=COALESCE($4,tag),spiritual_state=COALESCE($5,spiritual_state) WHERE id=$3',
          [Boolean(b.active), b.roles, b.id, b.tag || null, b.spiritualState || null],
        );
        await db.query('DELETE FROM sessions WHERE member_id=$1', [b.id]);
        await audit(
          u.id,
          'member.access',
          b.id,
          { roles: b.roles, active: b.active, tag: b.tag, spiritualState: b.spiritualState },
          db,
        );
      });
      return Response.json({ ok: true, message: 'Access updated.' });
    }
    if (b.action === 'group') {
      const code = String(b.code || '')
          .trim()
          .toUpperCase(),
        kind = String(b.kind);
      if (!code || !['family', 'care', 'share', 'finance'].includes(kind))
        fail('Enter a code and group type.');
      const id = token();
      await query('INSERT INTO groups(id,code,name,kind) VALUES($1,$2,$3,$4)', [
        id,
        code,
        String(b.name || code).slice(0, 100),
        kind,
      ]);
      await audit(u.id, 'group.create', id);
      return Response.json({ ok: true, message: 'Group created.' });
    }
    if (b.action === 'membership') {
      const role = String(b.role || 'member');
      if (!['member', 'leader', 'servant', 'captain', 'auditor'].includes(role))
        fail('Invalid group role.');
      const g = (await run('SELECT * FROM groups WHERE id=$1', [b.group]))[0];
      if (!g) fail('Group not found.');
      if (
        (role === 'auditor' && g.kind !== 'finance') ||
        (role === 'servant' && g.kind !== 'care') ||
        (role === 'captain' && g.kind !== 'share')
      )
        fail('This role does not match the group type.');
      await query(
        'INSERT INTO memberships(member_id,group_id,roles) VALUES($1,$2,$3) ON CONFLICT(member_id,group_id) DO UPDATE SET roles=excluded.roles',
        [b.id, b.group, [role]],
      );
      await audit(u.id, 'membership.assign', b.id, { group: b.group, role });
      return Response.json({ ok: true, message: 'Group assignment saved.' });
    }
    if (b.action === 'removeMembership') {
      await query('DELETE FROM memberships WHERE member_id=$1 AND group_id=$2', [b.id, b.group]);
      await audit(u.id, 'membership.remove', b.id, { group: b.group });
      return Response.json({ ok: true });
    }
    if (b.action === 'guardian') {
      if (!b.consent) fail('Record guardian consent before linking accounts.');
      const target = (await run('SELECT tag FROM members WHERE id=$1', [b.child]))[0];
      if (!target || target.tag !== 'StelliKids' || b.guardian === b.child)
        fail('Choose a child and a separate guardian.');
      await query(
        'INSERT INTO guardian_links(guardian_id,child_id,consent_at) VALUES($1,$2,now()) ON CONFLICT DO NOTHING',
        [b.guardian, b.child],
      );
      await audit(u.id, 'guardian.link', b.child, { guardian: b.guardian });
      return Response.json({ ok: true, message: 'Guardian linked with recorded consent.' });
    }
    fail('Unknown operation.');
  } catch (e) {
    return outError(e);
  }
}
