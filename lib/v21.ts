import { query, transaction } from './db.mjs';
import { audit, HttpError, memberships, token } from './security';
import { cardPeriod, localClock, submissionOpen, validTimezone, LIFE_CARDS } from './cards';
import { DAILY, WEEKLY, MONTHLY, validDay } from './domain';

const allHabits=[...DAILY,...WEEKLY,...MONTHLY];
const rows=async(sql:string,p:unknown[]=[]) => (await query(sql,p)).rows as any[];
function deny(s:string,status=400):never{throw new HttpError(status,s)}
export async function v21State(u:any,scope:any[],subject:any,day:string) {
  const profile=(await rows('SELECT name,nickname,email,bio,phone,birthdate::text,timezone,google_sub IS NOT NULL AS google_linked,avatar IS NOT NULL AS has_avatar,stellar_fragments FROM members WHERE id=$1',[u.id]))[0];
  const zone=(await rows('SELECT timezone FROM members WHERE id=$1',[subject.id]))[0]?.timezone||'Asia/Manila';
  const clock=localClock(new Date(),zone);
  const d=new Date(day+'T12:00:00Z'),sun=new Date(d);sun.setUTCDate(d.getUTCDate()-d.getUTCDay());const end=new Date(sun);end.setUTCDate(end.getUTCDate()+7);
  const quarter=Math.floor(d.getUTCMonth()/3)*3;const from=day.slice(0,4)+'-'+String(quarter+1).padStart(2,'0');const until=new Date(Date.UTC(d.getUTCFullYear(),quarter+3,0,12)).toISOString().slice(0,10);
  const logs=await rows("SELECT l.*,(SELECT a.drive_web_view_link FROM attachments a WHERE a.id=l.data->>'attachmentId' AND a.owner_id=l.member_id) AS attachment_drive_url FROM logs l WHERE member_id=$1 AND period>=$2 AND period<=$3 ORDER BY updated_at DESC",[subject.id,from,until]);
  const candidates=await rows(`SELECT r.*,m.name,m.pcm FROM unlock_requests r JOIN members m ON m.id=r.member_id WHERE r.member_id=$1 OR $2::boolean OR EXISTS(SELECT 1 FROM memberships a JOIN memberships t ON t.group_id=a.group_id WHERE a.member_id=$1 AND t.member_id=r.member_id AND a.roles && ARRAY['servant','captain']::text[]) ORDER BY r.created_at DESC LIMIT 200`,[u.id,u.roles.some((r:string)=>['admin','pastor'].includes(r))]);
  const unlocks=candidates.map(r=>({...r,can_review:r.member_id!==u.id&&(u.roles.some((x:string)=>['admin','pastor'].includes(x))||scope.some(g=>g.roles.some((x:string)=>['servant','captain'].includes(x))))}));
  const leaders=await rows(`SELECT DISTINCT m.id,m.name,m.pcm,m.roles FROM members m WHERE m.active=true AND ('pastor'=ANY(m.roles) OR EXISTS(SELECT 1 FROM memberships lead JOIN memberships mine ON mine.group_id=lead.group_id WHERE lead.member_id=m.id AND mine.member_id=$1 AND lead.roles && ARRAY['servant','captain']::text[]))`,[u.id]);
  const requests=await rows(`SELECT p.*,m.name,m.pcm FROM pastoral_requests p JOIN members m ON m.id=p.member_id WHERE p.member_id=$1 OR p.recipient_id=$1 OR (p.kind<>'counsel' AND p.recipient_id IS NULL AND ($2::boolean OR EXISTS(SELECT 1 FROM memberships a JOIN memberships t ON a.group_id=t.group_id WHERE a.member_id=$1 AND t.member_id=p.member_id AND a.roles && ARRAY['servant','captain']::text[]))) ORDER BY p.created_at DESC LIMIT 100`,[u.id,u.roles.includes('pastor')]);
  const nudgeScope=u.roles.some((r:string)=>['admin','pastor'].includes(r))?[]:scope.filter(g=>g.roles.some((r:string)=>['servant','captain'].includes(r))).map(g=>g.group_id);
  const nudgeStats=(u.roles.some((r:string)=>['admin','pastor'].includes(r))||nudgeScope.length)?await rows(`SELECT m.id,m.name,m.pcm,count(*)::int AS sent,count(*) FILTER(WHERE n.recipient_completed_after_nudge)::int AS followed_through FROM stellinudge_logs n JOIN members m ON m.id=n.sender_church_id WHERE extract(year FROM n.created_at AT TIME ZONE $1)=extract(year FROM now() AT TIME ZONE $1) AND ($2::boolean OR n.group_id=ANY($3::text[])) GROUP BY m.id ORDER BY followed_through DESC,sent DESC`,[zone,u.roles.some((r:string)=>['admin','pastor'].includes(r)),nudgeScope]):[];
  return {profile,logs,today:clock.day,timezone:zone,serverNow:new Date().toISOString(),unlocks,leaders,pastoralRequests:requests,nudgeStats,
    resources:await rows('SELECT * FROM coach_resources WHERE archived=false OR $1::boolean ORDER BY position,title',[u.roles.includes('admin')]),
    events:await rows('SELECT e.*,COALESCE((SELECT json_agg(i.id) FROM event_images i WHERE i.event_id=e.id),\'[]\') AS image_ids FROM church_events e ORDER BY starts_at LIMIT 300'),
    eventRequests:await rows('SELECT r.*,m.name AS member_name,m.pcm FROM church_event_requests r JOIN members m ON m.id=r.member_id WHERE r.member_id=$1 OR $2::boolean ORDER BY r.created_at DESC LIMIT 100',[u.id,u.roles.includes('admin')]),
    baptism:(await rows('SELECT b.*,baptism_date::text AS baptism_date FROM baptism_records b WHERE member_id=$1',[subject.id]))[0]||null,
    user:{...u,roles:[...new Set([...u.roles,...scope.flatMap(g=>g.roles.filter((r:string)=>['auditor','servant','captain'].includes(r)))])]},
    nudgeHistory:await rows('SELECT recipient_church_id,stellicard_type,period FROM stellinudge_logs WHERE sender_church_id=$1 AND created_at>now()-interval \'40 days\'',[u.id]),
  };
}
export async function canUnlock(u:any,scope:any[],id:string,db:any={query}) {
  if(u.roles.some((r:string)=>['admin','pastor'].includes(r)))return true;
  const target=(await db.query('SELECT group_id,roles FROM memberships WHERE member_id=$1',[id])).rows;
  return scope.some(g=>g.roles.some((r:string)=>['servant','captain'].includes(r))&&target.some((t:any)=>t.group_id===g.group_id));
}
export function mediaUrl(value:unknown,document=false) {
  const s=String(value||'').trim();if(!s)return '';
  let u:URL;try{u=new URL(s)}catch{ return deny('Enter a valid media URL.'); }
  if(u.protocol!=='https:' || !(document?['drive.google.com','docs.google.com']:['youtube.com','www.youtube.com','youtu.be','drive.google.com','docs.google.com']).includes(u.hostname))deny('Use an HTTPS YouTube or Google Drive link.');
  return u.href;
}
export async function v21Action(b:any,u:any,scope:any[],subject:any):Promise<Response|null> {
  const zone=(await rows('SELECT timezone FROM members WHERE id=$1',[subject.id]))[0]?.timezone||'Asia/Manila';
  const today=localClock(new Date(),zone).day;
  if(b.action==='eventRequest'){
    if(!String(b.name||'').trim()||String(b.name).length>100||!Number.isFinite(Date.parse(b.startsAt))||String(b.details||'').length>12000)deny('Enter an event name, date/time and details.');
    await query('INSERT INTO church_event_requests(id,member_id,name,starts_at,details) VALUES($1,$2,$3,$4,$5)',[token(),u.id,String(b.name).trim(),new Date(b.startsAt).toISOString(),String(b.details||'')]);
    return Response.json({ok:true,message:'Event request sent to the administrator.'});
  }
  if(b.action==='reviewEventRequest'){
    if(!u.roles.includes('admin'))deny('Only Admin can review event requests.',403);
    if(!['published','declined'].includes(b.decision))deny('Choose publish or decline.');
    await transaction(async(db:any)=>{const r=(await db.query("SELECT * FROM church_event_requests WHERE id=$1 AND status='pending' FOR UPDATE",[b.id])).rows[0];if(!r)deny('This event request has already changed.',409);if(b.decision==='published')await db.query('INSERT INTO church_events(name,starts_at,details,owner_id) VALUES($1,$2,$3,$4)',[r.name,r.starts_at,r.details,u.id]);await db.query('UPDATE church_event_requests SET status=$1 WHERE id=$2',[b.decision,r.id]);await audit(u.id,'event.request.'+b.decision,r.id,{},db)});
    return Response.json({ok:true,message:'Event request reviewed.'});
  }
  if(b.action==='unlockPeriod'){
    if(!u.roles.includes('admin'))deny('Administrator access required.',403);
    if(!validDay(String(b.date))||b.date>today||!allHabits.includes(b.habit)||!String(b.reason||'').trim())deny('Choose a past/current date, StelliCard and exception reason.');
    const period=cardPeriod(b.habit,b.date);
    await transaction(async(db:any)=>{await db.query("UPDATE unlock_requests SET status='declined',reviewer_id=$1,reviewed_at=now() WHERE member_id=$2 AND habit=$3 AND period=$4 AND status='pending'",[u.id,b.id,b.habit,period]);await db.query("INSERT INTO unlock_requests(id,member_id,habit,period,reason,status,reviewer_id,reviewed_at,expires_at) VALUES($1,$2,$3,$4,$5,'approved',$6,now(),now()+interval '24 hours')",[token(),b.id,b.habit,period,String(b.reason).slice(0,4000),u.id]);await audit(u.id,'unlock.direct',b.id,{habit:b.habit,period},db)});
    return Response.json({ok:true,message:'The selected period is editable for 24 hours, until its next submission.'});
  }
  if(b.action==='pastoralRequest') {
    if(!['prayer','counsel','review'].includes(b.kind))deny('Choose a pastoral action.');
    const period=cardPeriod('iRate',today);
    const log=(await rows("SELECT id FROM logs WHERE member_id=$1 AND habit='iRate' AND period=$2 AND status<>'draft'",[u.id,period]))[0];
    if(!log)deny('Submit your iRateCard before sending this request.');
    const recipient=String(b.recipient||'');
    const leaders=await rows(`SELECT DISTINCT m.id FROM members m WHERE m.active=true AND ('pastor'=ANY(m.roles) OR EXISTS(SELECT 1 FROM memberships a JOIN memberships mine ON a.group_id=mine.group_id WHERE a.member_id=m.id AND mine.member_id=$1 AND a.roles && ARRAY['servant','captain']::text[]))`,[u.id]);
    if((b.kind==='counsel'||b.confidential)&&!recipient)deny('Choose the leader who should receive this private request.');
    if(recipient&&!leaders.some(m=>m.id===recipient))deny('Choose your assigned Servant, Captain or Pastor.',403);
    const data={details:String(b.details||'').slice(0,4000),category:String(b.category||'Other').slice(0,100),format:b.format==='Online'?'Online':'In-person',level:b.level==='group'?'Care Group':'Member',logId:log.id};
    await query('INSERT INTO pastoral_requests(id,member_id,period,kind,recipient_id,data) VALUES($1,$2,$3,$4,$5,$6)',[token(),u.id,period,b.kind,recipient||null,JSON.stringify(data)]);
    return Response.json({ok:true,message:'Your request was sent to the selected pastoral care recipient.'});
  }
  if(b.action==='nudge') {
    const habit=String(b.habit||'iPray');if(!allHabits.includes(habit))deny('Choose a StelliCard.');
    const group=scope.find(g=>g.group_id===b.group&&['family','care','share'].includes(g.kind));
    const peers=await rows(`SELECT DISTINCT m.id,g.id AS group_id,g.kind,m.timezone FROM memberships a JOIN memberships z ON a.group_id=z.group_id JOIN groups g ON g.id=a.group_id JOIN members m ON m.id=z.member_id WHERE a.member_id=$1 AND m.id<>$1 AND m.active=true AND m.tag<>'StelliKids' AND g.kind IN ('family','care','share') AND (($2::text<>'' AND g.id=$2) OR ($2::text='' AND m.id=$3))`,[u.id,group?.group_id||'',b.id||'']);
    if(!peers.length)deny('Choose a member of your Family, Care Group or Share Group.',403);
    const unique=[...new Map(peers.map(p=>[p.id,p])).values()];let sent=0;
    await transaction(async(db:any)=>{
      for(const p of unique) {
        const day=localClock(new Date(),p.timezone).day,period=cardPeriod(habit,day);
        if(!submissionOpen(habit,period,new Date(),p.timezone))continue;
        if((await db.query("SELECT id FROM logs WHERE member_id=$1 AND habit=$2 AND period=$3 AND status<>'draft'",[p.id,habit,period])).rows.length)continue;
        const message=String(b.message||`${u.nickname||u.name} is cheering you on. Make time for your ${habit}Card before it locks.`).trim().slice(0,500);if(!message)deny('Enter an encouragement message.');
        const added=await db.query('INSERT INTO stellinudge_logs(nudge_id,sender_church_id,recipient_church_id,group_context,group_id,stellicard_type,period,message) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(sender_church_id,recipient_church_id,stellicard_type,period) DO NOTHING RETURNING nudge_id',[token(),u.id,p.id,p.kind,p.group_id,habit,period,message]);
        if(!added.rows.length)continue;
        await db.query('INSERT INTO notifications(id,sender_id,recipient_id,message,day) VALUES($1,NULL,$2,$3,$4)',[token(),p.id,message,day]);sent++;
      }
      await audit(u.id,'nudge.send',habit,{sent},db);
    });
    return Response.json({ok:true,message:sent?`StelliNudge sent to ${sent} pending member${sent>1?'s':''}.`:'No reminders sent: members already submitted, were nudged in this window, or their cards are locked.'});
  }
  if(b.action==='requestUnlock') {
    const habit=String(b.habit),day=String(b.date),reason=String(b.reason||'').trim();
    if(!validDay(day)||day>today||reason.split(/\s+/).length<20||reason.length>4000)deny('Choose a past/current date and explain the request in at least 20 words (maximum 4,000 characters).');
    const c=allHabits.includes(habit)?null:(await rows('SELECT frequency FROM commitments WHERE id=$1 AND member_id=$2 AND archived=false',[habit,subject.id]))[0];
    if(!allHabits.includes(habit)&&!c)deny('Habit not found.',404);
    const period=cardPeriod(habit,day,c?.frequency);
    if(submissionOpen(habit,period,new Date(),zone,c?.frequency))deny('This submission window is already open.');
    const active=await rows("SELECT id FROM unlock_requests WHERE member_id=$1 AND habit=$2 AND period=$3 AND (status='pending' OR (status='approved' AND expires_at>now()))",[subject.id,habit,period]);
    if(active.length)deny('An unlock request is already pending or approved.',409);
    await transaction(async(db:any)=>{
      await db.query('INSERT INTO unlock_requests(id,member_id,habit,period,reason) VALUES($1,$2,$3,$4,$5)',[token(),subject.id,habit,period,reason]);
      await audit(u.id,'unlock.request',subject.id,{habit,period},db);
    });
    return Response.json({ok:true,message:'Unlock requested. Your assigned leader or Admin/Pastor can review it.'});
  }
  if(b.action==='reviewUnlock') {
    if(!['approved','declined'].includes(b.decision))deny('Choose approve or decline.');
    await transaction(async(db:any)=>{
      const r=(await db.query('SELECT * FROM unlock_requests WHERE id=$1 FOR UPDATE',[b.id])).rows[0];
      if(!r||!await canUnlock(u,scope,r.member_id,db))deny('You cannot review this request.',403);
      if(r.member_id===u.id)deny('Another authorized leader must approve your own request.',403);
      if(r.status!=='pending')deny('This request has already been reviewed.',409);
      await db.query("UPDATE unlock_requests SET status=$1,reviewer_id=$2,reviewed_at=now(),expires_at=CASE WHEN $1='approved' THEN now()+interval '24 hours' ELSE NULL END WHERE id=$3",[b.decision,u.id,r.id]);
      await db.query('INSERT INTO notifications(id,sender_id,recipient_id,message,day) VALUES($1,NULL,$2,$3,$4)',[token(),r.member_id,`${r.habit} unlock ${b.decision}. ${b.decision==='approved'?'Submit within 24 hours; the exception is used on submission.':''}`,today]);
      await audit(u.id,'unlock.'+b.decision,r.id,{},db);
    });
    return Response.json({ok:true,message:'Unlock request reviewed.'});
  }
  if(b.action==='profile') {
    const name=String(b.name||u.name).trim(),bio=String(b.bio||''),phone=String(b.phone||'').trim(),email=String(b.email||'').trim().toLowerCase();
    if(!name||name.length>100||bio.length>250)deny('Enter your name (maximum 100 characters) and a bio under 251 characters.');
    if(phone&&!/^\+?[0-9 ()-]{7,25}$/.test(phone))deny('Enter a valid contact number.');
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))deny('Enter a valid email.');
    if(b.birthdate&&(!validDay(b.birthdate)||b.birthdate>today))deny('Enter a valid past birthdate.');
    const timeZone=String(b.timezone||zone);if(!validTimezone(timeZone))deny('Choose a valid IANA timezone.');
    const old=(await rows('SELECT google_sub,email FROM members WHERE id=$1',[u.id]))[0];
    if(old.google_sub&&email!==old.email)deny('Your Google-linked email is read-only.');
    await query('UPDATE members SET name=$1,nickname=$2,bio=$3,phone=$4,email=$5,birthdate=$6,timezone=$7 WHERE id=$8',[name,String(b.nickname||'').slice(0,50),bio,phone,email||null,b.birthdate||null,timeZone,u.id]);
    await audit(u.id,'profile.update',u.id);
    return Response.json({ok:true,message:'Profile saved.'});
  }
  if(b.action==='adoptLifeCard') {
    const preset=LIFE_CARDS.find(c=>c[0]===b.habit);if(!preset)deny('Unknown StelliLife card.');
    const frequency=['iGain','iLose','iWeigh'].includes(preset[0])?'weekly':'daily';
    const found=await rows('SELECT id FROM commitments WHERE member_id=$1 AND habit=$2 AND archived=false',[subject.id,preset[0]]);
    if(!found.length)await query('INSERT INTO commitments(id,member_id,habit,frequency,plan,start_date,lock_until) VALUES($1,$2,$3,$4,$5,$6,$6)',[token(),subject.id,preset[0],frequency,String(b.plan||preset[1]).slice(0,2000),today]);
    return Response.json({ok:true,message:preset[0]+' added to your habits.'});
  }
  if(b.action==='resource') {
    if(!u.roles.includes('admin'))deny('Only Admin can manage StelliCoach resources.',403);
    const id=b.id||token();
    if(b.remove){await query('DELETE FROM coach_resources WHERE id=$1',[id]);}
    else {
      if(!['StelliApp','StelliLearn'].includes(b.section)||!String(b.title||'').trim()||String(b.title).length>140||String(b.description||'').length>4000)deny('Select a section, title and description.');
      const video=mediaUrl(b.videoUrl),doc=mediaUrl(b.documentUrl,true),cover=mediaUrl(b.coverUrl);
      const pos=Number(b.position||0);if(!Number.isInteger(pos)||Math.abs(pos)>100000)deny('Enter a valid display order.');
      await query(`INSERT INTO coach_resources(id,section,title,description,category,video_url,document_url,cover_url,position,archived,owner_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET section=excluded.section,title=excluded.title,description=excluded.description,category=excluded.category,video_url=excluded.video_url,document_url=excluded.document_url,cover_url=excluded.cover_url,position=excluded.position,archived=excluded.archived,updated_at=now()`,[id,b.section,String(b.title).trim(),b.description||'',String(b.category||'').slice(0,80),video,doc,cover,pos,Boolean(b.archived),u.id]);
    }
    await audit(u.id,b.remove?'coach.delete':'coach.save',id);
    return Response.json({ok:true,message:'Resource updated.'});
  }
  if(b.action==='event') {
    if(!u.roles.includes('admin'))deny('Only Admin can manage church events.',403);
    if(b.remove){await query('DELETE FROM church_events WHERE id=$1',[b.id]);await audit(u.id,'event.delete',String(b.id));return Response.json({ok:true});}
    if(!String(b.name||'').trim()||String(b.name).length>100||!Number.isFinite(Date.parse(b.startsAt))||String(b.details||'').length>12000)deny('Enter an event name, valid date/time and details.');
    const params=[String(b.name).trim(),new Date(b.startsAt).toISOString(),b.details||'',mediaUrl(b.mediaUrl)];
    const result=b.id?await rows('UPDATE church_events SET name=$1,starts_at=$2,details=$3,media_url=$4,updated_at=now() WHERE id=$5 RETURNING id',[...params,b.id]):await rows('INSERT INTO church_events(name,starts_at,details,media_url,owner_id) VALUES($1,$2,$3,$4,$5) RETURNING id',[...params,u.id]);
    if(!result.length)deny('Event not found.',404);
    await audit(u.id,'event.save',String(result[0].id));return Response.json({ok:true,id:result[0].id,message:'Church event saved.'});
  }
  if(b.action==='baptism') {
    if(!u.roles.includes('admin'))deny('Only Admin can record verified baptisms.',403);
    if(!validDay(String(b.date))||b.date>today||!String(b.location||'').trim()||!String(b.minister||'').trim())deny('Enter baptism date, location and minister.');
    const photos=Array.isArray(b.photos)?b.photos.slice(0,12).map((v:unknown)=>mediaUrl(v,true)):[];
    await query('INSERT INTO baptism_records(id,member_id,baptism_date,location,minister,certificate_url,photos,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(member_id) DO UPDATE SET baptism_date=excluded.baptism_date,location=excluded.location,minister=excluded.minister,certificate_url=excluded.certificate_url,photos=excluded.photos,recorded_by=excluded.recorded_by,updated_at=now()',[token(),b.member||u.id,b.date,String(b.location).slice(0,200),String(b.minister).slice(0,100),mediaUrl(b.certificateUrl,true),JSON.stringify(photos),u.id]);
    await audit(u.id,'baptism.record',b.member||u.id);return Response.json({ok:true,message:'Baptism record saved.'});
  }
  return null;
}
