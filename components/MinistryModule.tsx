'use client';
import { useEffect, useState } from 'react';
import {
  Check,
  Plus,
  Shuffle,
  Users,
  ShieldCheck,
  CalendarDays,
  Heart,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
const careTabs = [
  ['home', 'iCareDash'],
  ['icebreaker', 'iCareBreak'],
  ['assignment', 'iCareSet'],
  ['wheel', 'iCareWheel'],
  ['prayer', 'Prayer'],
  ['testimony', 'Testimonies'],
];
const shareTabs = [
  ['home', 'iShareDash'],
  ['strategy', 'Sharing strategy'],
  ['assignment', 'iShareSet'],
  ['wheel', 'Sharing wheel'],
  ['prayer', 'iSharePray'],
  ['testimony', 'Testimonies'],
];
const churchTabs = [
  ['home', 'ChurchView'],
  ['slides', 'ChurchSlide'],
  ['board', 'ChurchBoard'],
  ['dates', 'ChurchDates'],
  ['prayer', 'StelliPray'],
  ['counsel', 'StelliCounsel'],
  ['help', 'StelliHelp'],
  ['testimony', 'Testimonies'],
];
export default function MinistryModule({
  module,
  state,
  onReview,
}: {
  module: 'care' | 'share' | 'church';
  state: any;
  onReview: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [group, setGroup] = useState(''),
    [tab, setTab] = useState('home'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0),
    [picked, setPicked] = useState(''),
    [spinning, setSpinning] = useState(false);
  useEffect(() => {
    setGroup('');
    setTab('home');
    setData(null);
    setPicked('');
  }, [module]);
  useEffect(() => {
    let current = true;
    setError('');
    setData(null);
    fetch('/api/ministry?' + new URLSearchParams({ module, ...(group ? { group } : {}) }))
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        if (current) setData(b);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [module, group, version]);
  async function submit(e: React.FormEvent<HTMLFormElement>, kind: string) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = e.currentTarget,
      all: any = Object.fromEntries(new FormData(form)),
      { title, body, visibility, ...fields } = all;
    try {
      const r = await fetch('/api/ministry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          group: data.selected,
          kind,
          title,
          body,
          visibility,
          data: fields,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      form.reset();
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changeState(id: string, next: string) {
    try {
      const r = await fetch('/api/ministry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, group: data.selected, action: 'state', id, state: next }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const label =
    module === 'care' ? 'StelliCare' : module === 'share' ? 'StelliShare' : 'StelliChurch';
  if (!data)
    return (
      <section className="panel">
        <p className="muted">Opening {label}…</p>
        {error && <p className="error">{error}</p>}
      </section>
    );
  const tabs = module === 'care' ? careTabs : module === 'share' ? shareTabs : churchTabs,
    items = data.items.filter((i: any) => i.kind === tab),
    canPublish = data.publisher;
  const requests = ['prayer', 'counsel', 'help'].includes(tab),
    allowEntry = requests || canPublish;
  const box = (kind: string) => {
    const entries = data.items.filter((i: any) => i.kind === kind);
    return entries.length ? (
      entries.map((i: any) => (
        <article className="ministry-entry" key={i.id}>
          <div>
            <span className="eyebrow">{kind}</span>
            <h3>{i.title}</h3>
            <small>
              {i.author_name} · {new Date(i.updated_at).toLocaleDateString()} ·{' '}
              {i.visibility === 'members'
                ? 'Shared with members'
                : i.visibility === 'private'
                  ? 'Private request'
                  : 'Leader section'}
            </small>
          </div>
          {i.body && <p>{i.body}</p>}
          {i.data.date && (
            <p className="entry-date">
              <CalendarDays size={14} />
              {i.data.date}
            </p>
          )}
          {i.data.url && /^https?:\/\//i.test(i.data.url) && (
            <a href={i.data.url} target="_blank" rel="noreferrer" className="text-button">
              Open resource
              <ArrowRight size={14} />
            </a>
          )}
          {kind === 'assignment' && (
            <dl className="assignment-list">
              {[
                ['facilitator', 'Facilitator'],
                ['firstAnswer', 'First to answer'],
                ['prayer', 'Prayer'],
              ].map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {data.members.find((m: any) => m.id === i.data[key])?.name || 'Not assigned'}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {['counsel', 'help', 'prayer'].includes(kind) &&
            (i.owner_id === state.user.id || data.leader) && (
              <label>
                Status
                <select value={i.state} onChange={(e) => changeState(i.id, e.target.value)}>
                  <option value="todo">Open</option>
                  <option value="doing">In progress</option>
                  <option value="done">Completed</option>
                </select>
              </label>
            )}
        </article>
      ))
    ) : (
      <p className="muted">
        No{' '}
        {kind === 'board'
          ? 'announcements'
          : kind === 'dates'
            ? 'church dates'
            : kind === 'assignment'
              ? 'session assignments'
              : kind === 'icebreaker'
                ? 'icebreaker questions'
                : kind === 'slides'
                  ? 'message slides'
                  : kind === 'prayer'
                    ? 'prayer entries'
                    : kind === 'strategy'
                      ? 'sharing strategies'
                      : 'entries'}{' '}
        have been shared here yet.
      </p>
    );
  };
  return (
    <div className="ministry-module">
      <section className="module-intro">
        <div>
          <span className="eyebrow">
            {module === 'care'
              ? 'CARING AND BEARING MINISTRY'
              : module === 'share'
                ? 'SHARING AND BEARING MINISTRY'
                : 'OUR CHURCH COMMUNITY'}
          </span>
          <h2>{label}</h2>
          <p className="muted">
            {module === 'church'
              ? 'Church resources, dates, prayer and support.'
              : module === 'care'
                ? 'Care for one another, prepare your sessions, and grow together.'
                : 'Pray, prepare, share, and support one another in outreach.'}
          </p>
        </div>
        {module !== 'church' && (
          <label>
            My {module === 'care' ? 'Care Group' : 'Sharing Huddle'}
            <select
              value={group || data.selected || ''}
              onChange={(e) => {
                setGroup(e.target.value);
                setPicked('');
              }}
            >
              {data.groups.map((g: any) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      {module !== 'church' && !data.selected ? (
        <section className="panel">
          <Users size={25} />
          <h3>Your group connection</h3>
          <p className="muted">
            Your administrator will assign you to a{' '}
            {module === 'care' ? 'Care Group' : 'Sharing Huddle'}. Its member sections will then
            appear here.
          </p>
        </section>
      ) : (
        <>
          <div className="ministry-level">
            <span>
              <Users size={15} />
              {module === 'church' ? 'Member section' : 'Group member section'}
            </span>
            {data.leader && (
              <span>
                <ShieldCheck size={15} />
                {module === 'care'
                  ? 'Care Servant'
                  : module === 'share'
                    ? 'Sharing Captain'
                    : 'Pastor'}{' '}
                access
              </span>
            )}
          </div>
          <nav className="module-tabs ministry-tabs" aria-label={label + ' sections'}>
            {module==='care'&&(data.leader||state.user.roles.some((r:string)=>['admin','pastor'].includes(r)))&&<button onClick={onReview}>iStellCheck</button>}
            {tabs.map(([key, name]) => (
              <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                {name}
              </button>
            ))}
            {canPublish && (
              <button className={tab === 'task' ? 'active' : ''} onClick={() => setTab('task')}>
                {label}Task
              </button>
            )}
            {module === 'church' && canPublish && (
              <button className={tab === 'goal' ? 'active' : ''} onClick={() => setTab('goal')}>
                Church goals
              </button>
            )}
          </nav>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {tab === 'home' && (
            <>
              <div className="ministry-overview-grid">
                <section className="panel">
                  <h2>
                    {module === 'care'
                      ? 'iCareDash'
                      : module === 'share'
                        ? 'iShareDash'
                        : 'ChurchView'}
                  </h2>
                  {module !== 'church' ? (
                    <div className="ministry-member-list">
                      {data.members.map((m: any) => (
                        <div key={m.id}>
                          <span className="avatar soft">{m.name[0]}</span>
                          <div>
                            <strong>{m.nickname || m.name}</strong>
                            <small>
                              {m.pcm} · {m.roles.join(', ')}
                            </small>
                          </div>
                          <span>{m.weekly_entries} weekly entries</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {box('view')}
                      {box('board')}
                    </>
                  )}
                </section>
                <section className="panel">
                  <h2>{module === 'church' ? 'ChurchDates' : 'Next group session'}</h2>
                  {box(module === 'church' ? 'dates' : 'session')}
                  {canPublish && module !== 'church' && (
                    <form onSubmit={(e) => submit(e, 'session')}>
                      <label>
                        Session title
                        <input name="title" required />
                      </label>
                      <label>
                        Date
                        <input type="date" name="date" required />
                      </label>
                      <label>
                        Notes
                        <textarea name="body" />
                      </label>
                      <button className="button secondary" disabled={busy}>
                        Save session
                      </button>
                    </form>
                  )}
                </section>
              </div>
              {module === 'church' && data.analytics.length > 0 && (
                <section className="panel spaced">
                  <span className="eyebrow">LEADERSHIP SECTION</span>
                  <h2>Congregation activity</h2>
                  <div className="church-summary-grid">
                    {data.analytics.map((a: any) => (
                      <div key={a.habit + a.status}>
                        <strong>{a.count}</strong>
                        <span>{a.habit}</span>
                        <small>{a.status}</small>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {(data.leader || canPublish) && module !== 'church' && (
                <section className="panel spaced leader-workspace">
                  <span className="eyebrow">
                    {module === 'care' ? 'SERVANT ONLY SECTION' : 'CAPTAIN ONLY SECTION'}
                  </span>
                  <h2>{module === 'care' ? 'StelliCareDash' : 'StelliShareDash'}</h2>
                  <p className="muted">
                    Review the submissions in your assigned scope and record follow-up actions.
                  </p>
                  <div className="leader-actions">
                    {data.leader && (
                      <button className="button primary" onClick={onReview}>
                        {module === 'care' ? 'iStellCheck' : 'iShareCheck'}
                        <ShieldCheck size={16} />
                      </button>
                    )}
                    <button className="button secondary" onClick={() => setTab('task')}>
                      {label}Task
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
          {tab === 'wheel' && (
            <section className="panel name-wheel">
              <span className="eyebrow">CHOOSE SOMEONE FROM YOUR GROUP</span>
              <h2>{module === 'care' ? 'iCareWheel' : 'Sharing wheel'}</h2>
              <div className={'wheel-display ' + (spinning ? 'spinning' : '')}>
                {picked || 'Who’s next?'}
              </div>
              <button
                className="button primary"
                disabled={!data.members.length || spinning}
                onClick={() => {
                  setSpinning(true);
                  const names = data.members.map((m: any) => m.nickname || m.name);
                  let count = 0;
                  const timer = setInterval(() => {
                    setPicked(names[Math.floor(Math.random() * names.length)]);
                    if (++count >= 12) {
                      clearInterval(timer);
                      setSpinning(false);
                    }
                  }, 85);
                }}
              >
                <Shuffle size={17} />
                Choose a name
              </button>
              <p className="fine-print">
                Save the final session assignment in {module === 'care' ? 'iCareSet' : 'iShareSet'}.
              </p>
            </section>
          )}
          {tab === 'testimony' && (
            <section className="panel">
              <h2>Shared B.E.S.T. testimonies</h2>
              {data.testimonials.length ? (
                data.testimonials.map((t: any) => (
                  <article className="ministry-entry" key={t.id}>
                    <h3>{t.author_name}</h3>
                    {[
                      ['before', 'Before'],
                      ['event', 'Event that Led'],
                      ['salvationDay', 'Salvation Day'],
                      ['today', 'Today'],
                    ].map(([k, l]) => (
                      <div className="shared-testimony-part" key={k}>
                        <strong>{l}</strong>
                        <p>{t.data[k]}</p>
                      </div>
                    ))}
                  </article>
                ))
              ) : (
                <p className="muted">
                  Members’ testimonies appear here when they choose to share them with your group or
                  church.
                </p>
              )}
            </section>
          )}
          {tab === 'task' && (
            <>
              <section className="panel">
                <span className="eyebrow">LEADER SECTION · QUARTERLY REVIEW ACTIONS</span>
                <h2>{label}Task</h2>
                <form className="inline-form" onSubmit={(e) => submit(e, 'task')}>
                  <label>
                    Action
                    <input name="title" required />
                  </label>
                  <label>
                    Due date
                    <input name="date" type="date" />
                  </label>
                  <label className="wide">
                    Next steps
                    <textarea name="body" />
                  </label>
                  <button className="button primary" disabled={busy}>
                    <Plus size={15} />
                    Add action
                  </button>
                </form>
              </section>
              <div className="task-board spaced">
                {[
                  ['todo', 'To do'],
                  ['doing', 'In progress'],
                  ['done', 'Completed'],
                ].map(([key, title]) => (
                  <section className="task-column" key={key}>
                    <h3>{title}</h3>
                    {data.items
                      .filter((i: any) => i.kind === 'task' && i.state === key)
                      .map((i: any) => (
                        <article className="panel" key={i.id}>
                          <h3>{i.title}</h3>
                          <p>{i.body}</p>
                          <small className="muted">{i.data.date}</small>
                          <select
                            aria-label={'Status of ' + i.title}
                            value={i.state}
                            onChange={(e) => changeState(i.id, e.target.value)}
                          >
                            <option value="todo">To do</option>
                            <option value="doing">In progress</option>
                            <option value="done">Completed</option>
                          </select>
                        </article>
                      ))}
                  </section>
                ))}
              </div>
            </>
          )}
          {!['home', 'wheel', 'testimony', 'task'].includes(tab) && (
            <>
              <section className="panel">
                <h2>{tabs.find((t) => t[0] === tab)?.[1] || 'Church goals'}</h2>
                {box(tab)}
              </section>
              {allowEntry && (
                <section className="panel spaced">
                  <h2>
                    {requests
                      ? 'Add your ' +
                        (tab === 'prayer'
                          ? 'prayer'
                          : tab === 'counsel'
                            ? 'counsel request'
                            : 'help request')
                      : 'Add ' +
                        (tab === 'assignment'
                          ? 'a session assignment'
                          : tab === 'icebreaker'
                            ? 'an icebreaker question'
                            : tab === 'goal'
                              ? 'a church goal'
                              : 'a resource')}
                  </h2>
                  <form onSubmit={(e) => submit(e, tab)}>
                    <label>
                      {tab === 'icebreaker' ? 'Icebreaker question' : 'Title'}
                      <input name="title" required maxLength={140} />
                    </label>
                    {['dates', 'assignment', 'goal'].includes(tab) && (
                      <label>
                        Date
                        <input name="date" type="date" required />
                      </label>
                    )}
                    {tab === 'assignment' && (
                      <div className="form-grid">
                        {[
                          ['facilitator', 'Facilitator'],
                          ['firstAnswer', 'First to answer'],
                          ['prayer', 'Prayer'],
                        ].map(([key, title]) => (
                          <label key={key}>
                            {title}
                            <select name={key}>
                              <option value="">Choose a member</option>
                              {data.members.map((m: any) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                    )}
                    {['slides', 'view'].includes(tab) && (
                      <label>
                        Resource URL
                        <input type="url" name="url" placeholder="https://" />
                      </label>
                    )}
                    <label>
                      {tab === 'strategy' ? 'Strategy, questions, and support needed' : 'Details'}
                      <textarea name="body" rows={4} />
                    </label>
                    {tab === 'prayer' && (
                      <label>
                        Visibility
                        <select name="visibility">
                          <option value="private">Me and the responsible ministry leader</option>
                          <option value="members">Share with members in this section</option>
                        </select>
                      </label>
                    )}
                    {['counsel', 'help'].includes(tab) && (
                      <p className="fine-print">This request is private to you and the Pastor.</p>
                    )}
                    <button className="button primary" disabled={busy}>
                      <Check size={16} />
                      {busy ? 'Saving…' : 'Save entry'}
                    </button>
                  </form>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
