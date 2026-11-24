'use client';
import { useState } from 'react';
import { X, Upload, Clock3, Check } from 'lucide-react';
import {cardPeriod,submissionOpen} from '@/lib/cards';
type Props = {
  state:any;
  habit: string;
  title?: string;
  existing?: any;
  date: string;
  subject: string;
  question: any;
  onClose: () => void;
  onSaved: () => void;
  act: (data: any) => Promise<any>;
};
export default function HabitForm({
  habit,
  state,
  title,
  existing,
  date,
  subject,
  question,
  onClose,
  onSaved,
  act,
}: Props) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [attachment, setAttachment] = useState(existing?.data?.attachmentId || ''),
    [uploading, setUploading] = useState(false),[unlock,setUnlock]=useState(false),[reason,setReason]=useState(''),[care,setCare]=useState('');
  const period=cardPeriod(habit,date);
  const editable=submissionOpen(habit,period,new Date(),state.timezone)||state.unlocks.some((r:any)=>r.member_id===subject&&r.habit===habit&&r.period===period&&r.status==='approved'&&Date.parse(r.expires_at)>Date.now());
  const d = existing?.data || {};
  async function upload(file: File) {
    setUploading(true);
    setError('');
    try {
      const f = new FormData();
      f.set('file', file);
      f.set('subject', subject);
      f.set('habit',habit);
      const r = await fetch('/api/attachments', { method: 'POST', body: f });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setAttachment(b.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const draft =
      ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)?.value === 'draft';
    const data: any = Object.fromEntries(new FormData(e.currentTarget));
    for (const k of ['morning', 'adhoc', 'evening', 'done']) data[k] = data[k] === 'on';
    if (attachment) data.attachmentId = attachment;
    const support={kind:data.careKind,recipient:data.careRecipient,details:data.careDetails,category:data.careCategory,format:data.careFormat,level:data.careLevel};
    Object.keys(data).filter(k=>k.startsWith('care')).forEach(k=>delete data[k]);
    try {
      await act({ action: 'log', habit, date, subject, version: existing?.version, draft, data });
      if(!draft&&support.kind)await act({action:'pastoralRequest',...support});
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal standard-stellicard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">YOUR STELLICARD · {date}</span>
            <h2 id="habit-heading">{title || habit}</h2>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <fieldset className="card-form-fields" disabled={!editable}>
          <div className="ibal-label">
            <span>1</span>
            <strong>iBlock</strong>
            <p>Make room for your habit</p>
          </div>
          <div className="form-grid">
            <label>
              Planned time
              <input type="time" name="plannedTime" defaultValue={d.plannedTime} />
            </label>
            <label>
              Planned minutes
              <input
                name="plannedDuration"
                type="number"
                min="1"
                max="1440"
                defaultValue={d.plannedDuration || 15}
              />
            </label>
          </div>
          <div className="ibal-label">
            <span>2</span>
            <strong>iAct</strong>
            <p>Record what you completed</p>
          </div>
          {habit === 'iRead' && (
            <>
              <label>
                Reading or devotional activity
                <select name="type" defaultValue={d.type || ''} required>
                  <option value="">Choose activity</option>
                  {[
                    'Read the Bible',
                    'Listen to audio Bible',
                    'Review Sunday slides',
                    'Watch message recording',
                    'Approved spiritual literature',
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Actual minutes
                <input
                  name="duration"
                  type="number"
                  min="1"
                  max="1440"
                  required
                  defaultValue={d.duration || 15}
                />
              </label>
              <label>
                Devotional journal <span className="muted">· private</span>
                <textarea
                  name="notes"
                  defaultValue={d.notes}
                  maxLength={12000}
                  placeholder="What stood out to you today?"
                />
              </label>
            </>
          )}
          {habit === 'iPray' && (
            <div className="prayer-options">
              {[
                ['morning', 'Morning prayer', 'Start the day in prayer'],
                ['adhoc', 'Adhoc prayer', 'Meals, travel, and moments throughout the day'],
                ['evening', 'Evening prayer', 'Reflect and give thanks'],
              ].map(([key, name, sub]) => (
                <label className="check-card" key={key}>
                  <input name={key} type="checkbox" defaultChecked={d[key]} />
                  <div>
                    <strong>{name}</strong>
                    <small>{sub}</small>
                  </div>
                </label>
              ))}
            </div>
          )}
          {habit === 'iPraise' && (
            <label>
              Worship attendance
              <select name="attendance" defaultValue={d.attendance || ''} required>
                <option value="">Choose attendance</option>
                <option>Online</option>
                <option>Onsite</option>
                <option>Absent</option>
              </select>
            </label>
          )}
          {habit === 'iCare' && (
            <>
              <label>
                Did you attend Care Group?
                <select name="attendance" defaultValue={d.attendance || ''} required>
                  <option value="">Choose attendance</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </label>
              <label>
                Reason if absent
                <select name="reason" defaultValue={d.reason || ''}>
                  <option value="">Not applicable</option>
                  <option>Sick</option>
                  <option>Work-related</option>
                  <option>Academic-related</option>
                  <option>Other</option>
                </select>
              </label>
            </>
          )}
          {(habit === 'iNote' || habit === 'iSpeak') && (
            <>
              {habit === 'iSpeak' && (
                <p className="question">
                  {question?.text || 'A leader has not published this week’s question yet.'}
                </p>
              )}
              <label>
                {habit === 'iNote' ? 'Message notes' : 'Your answer and reflection'}
                <textarea
                  name={habit === 'iNote' ? 'notes' : 'answer'}
                  rows={6}
                  defaultValue={d.notes || d.answer}
                  maxLength={12000}
                />
              </label>
              <label className="upload-field">
                <Upload size={18} />
                {uploading
                  ? 'Uploading…'
                  : attachment
                    ? 'Attachment ready · replace file'
                    : 'Attach handwritten notes'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
              </label>
              <small className="muted">
                PNG, JPEG, WEBP or HEIC up to 10 MB with church Drive configured; otherwise PNG/JPEG/PDF up to 2 MB. Authorized reviewers only.
              </small>
            </>
          )}
          {habit === 'iTithes' && (
            <>
              <div className="form-grid">
                {[
                  ['gift', 'Gift'],
                  ['offering', 'Offering'],
                  ['tithes', 'Tithes'],
                  ['bob', 'Breaking of Bread'],
                ].map(([key, name]) => (
                  <label key={key}>
                    {name} (PHP)
                    <input
                      type="number"
                      name={key}
                      min="0"
                      step="0.01"
                      defaultValue={d[key] ?? '0'}
                      required
                    />
                  </label>
                ))}
              </div>
              <label>
                Reason if tithes are zero
                <input
                  name="zeroReason"
                  defaultValue={d.zeroReason}
                  placeholder="For example, unemployed"
                />
              </label>
              <label>
                Breaking of Bread reason
                <select name="bobReason" defaultValue={d.bobReason || ''}>
                  <option value="">None</option>
                  {[
                    'Medical',
                    'Academic',
                    'Internet Allowance',
                    'Travel Allowance',
                    'Crisis',
                    'Financial',
                    'Sharing',
                    'Food',
                    'Other',
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Remittance method
                <select name="method" defaultValue={d.method || 'Cash'}>
                  {['Cash', 'E-Wallet', 'Bank Transfer', 'None'].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <p className="fine-print">
                Net remittance = Gift + Offering + Tithes − Breaking of Bread. This records a
                declaration; it does not transfer money.
              </p>
            </>
          )}
          {habit === 'iRate' && (
            <>
              <fieldset>
                <legend>How are you this week?</legend>
                <div className="rating-options">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n}>
                      <input
                        name="rating"
                        type="radio"
                        value={n}
                        defaultChecked={Number(d.rating) === n}
                        required
                      />
                      <span>{n}</span>
                    </label>
                  ))}
                </div>
                <small className="muted">
                  1 · Struggling &nbsp; 5 · Thriving. Assigned Care Servants can see this rating.
                </small>
              </fieldset>
              <div className="pastoral-actions"><h3>Reach out for support</h3><label>Action<select name="careKind" value={care} onChange={e=>setCare(e.target.value)}><option value="">No request</option><option value="prayer">Ask for Prayer</option><option value="counsel">Ask for Counseling</option><option value="review">Ask for Review / Breaking of Bread</option></select></label>{care&&<><label>Recipient{care==='counsel'?' · confidential':''}<select name="careRecipient" required={care==='counsel'}><option value="">Assigned leaders</option>{state.leaders.map((l:any)=><option key={l.id} value={l.id}>{l.name} · {l.pcm}</option>)}</select></label>{care==='prayer'&&<label>Prayer category<select name="careCategory">{['Health / Healing','Family / Relationships','Work / Finances','Spiritual Growth','Thanksgiving','Other'].map(x=><option key={x}>{x}</option>)}</select></label>}{care==='counsel'&&<label>Preferred format<select name="careFormat"><option>In-person</option><option>Online</option></select></label>}{care==='review'&&<label>Breaking of Bread level<select name="careLevel"><option value="member">Member · one-on-one</option><option value="group">Care Group</option></select></label>}<label>Request details<textarea name="careDetails" maxLength={4000}/></label><small>Sent with your submitted weekly rating. Counseling details are visible only to the recipient you select.</small></>}</div>
              <label>
                Anything you would like your leaders to know?
                <textarea name="notes" defaultValue={d.notes} />
              </label>
            </>
          )}
          {habit === 'iShare' && (
            <>
              <label>
                Monthly huddle attendance
                <select name="attendance" defaultValue={d.attendance || 'No'}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </label>
              <label>
                Sharing strategy
                <textarea name="strategy" required defaultValue={d.strategy} />
              </label>
              <label>
                Person or alias
                <input name="sharee" defaultValue={d.sharee} />
              </label>
              <label>
                Actions, results, learnings and support needed
                <textarea name="results" defaultValue={d.results} />
              </label>
              <small className="muted">Use an alias when a full name is unnecessary.</small>
            </>
          )}
          {![
            'iRead',
            'iPray',
            'iPraise',
            'iCare',
            'iNote',
            'iSpeak',
            'iTithes',
            'iRate',
            'iShare',
          ].includes(habit) && (
            <>
              <label className="check-card">
                <input type="checkbox" name="done" required defaultChecked={d.done} />
                <strong>I completed this habit</strong>
              </label>
              <label>
                Actual minutes
                <input
                  type="number"
                  name="duration"
                  min="1"
                  max="1440"
                  required
                  defaultValue={d.duration || 15}
                />
              </label>
              <label>
                Reflection
                <textarea name="notes" defaultValue={d.notes} />
              </label>
            </>
          )}
          <div className="ibal-label">
            <span>3</span>
            <strong>iLog</strong>
            <p>Save your completion for this period</p>
          </div>
          {existing && (
            <p className="fine-print">
              Correcting this entry creates a new revision and resets its verification.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              type="submit"
              value="draft"
              formNoValidate
              disabled={busy || uploading}
            >
              Save draft
            </button>
            <button className="button primary" disabled={busy || uploading}>
              <Check size={17} />
              {busy ? 'Saving…' : 'Submit activity'}
            </button>
          </div>
          </fieldset>
        </form>
        <div className="card-unlock-bar"><p className="fine-print">{editable?'Submission window open':'Locked / read-only'} · {period} · {state.timezone}</p><button className="text-button" onClick={()=>setUnlock(!unlock)}>Request Unlock</button></div>
        {unlock&&<form onSubmit={async e=>{e.preventDefault();setError('');setBusy(true);try{await act({action:'requestUnlock',subject,habit,date,reason});setUnlock(false)}catch(err){setError((err as Error).message)}finally{setBusy(false)}}}><label>Justification · at least 20 words<textarea required maxLength={4000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="button primary" disabled={busy}>Send unlock request</button></form>}
      </section>
    </div>
  );
}
