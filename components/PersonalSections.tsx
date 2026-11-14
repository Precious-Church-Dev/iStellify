'use client';
import { useEffect, useState } from 'react';
import { BookOpen, Check, Download, Heart, Plus, Star, Target } from 'lucide-react';
const checkpoints = [
  'Baseline · November 27 2026',
  'iRate 1 · January 17 2027',
  'iRate 2 · April 17 2027',
  'iRate 3 · July 17 2027',
  'iRate 4 · October 17 2027',
  'iRate 5 · December 26 2027',
];
export default function PersonalSections({
  view,
  state,
  date,
  onRefresh,
  onWeeklyRate,
}: {
  view: string;
  state: any;
  date: string;
  onRefresh: () => Promise<void>;
  onWeeklyRate: () => void;
}) {
  const [payload, setPayload] = useState<any>(null),
    [range, setRange] = useState('week'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  const subject = state.subject.id,
    kids = state.subject.tag === 'StelliKids';
  useEffect(() => {
    let current = true;
    setPayload(null);
    setError('');
    fetch('/api/personal?' + new URLSearchParams({ subject, date, range }))
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        if (current) setPayload(b);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [subject, date, range, version]);
  async function save(
    e: React.FormEvent<HTMLFormElement>,
    kind: string,
    fixedTitle?: string,
    id?: string,
  ) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const all: any = Object.fromEntries(new FormData(e.currentTarget)),
      { title, visibility, ...data } = all;
    try {
      const r = await fetch('/api/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, subject, id, title: fixedTitle || title, visibility, data }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setNotice(b.message);
      setVersion((v) => v + 1);
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const items = payload?.items || [],
    salvation = items.find((r: any) => r.kind === 'salvation'),
    best = items.find((r: any) => r.kind === 'testimony');
  const feedback = (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
    </>
  );
  const saveButton = (
    <button className="button primary" disabled={busy}>
      <Check size={16} />
      {busy ? 'Saving…' : 'Save changes'}
    </button>
  );
  if (!payload)
    return (
      <section className="panel">
        <p className="muted">Loading your private records…</p>
        {feedback}
      </section>
    );
  if (view === 'save')
    return (
      <section className="panel faith-section">
        <span className="eyebrow">STELLISAVE · THE BEGINNING OF FAITH</span>
        <h2>Your salvation journey</h2>
        <p className="muted">
          Record when and how you came to understand salvation, and how you confirmed the beginning
          of your faith.
        </p>
        {feedback}
        <form
          key={salvation?.updated_at || 'new'}
          onSubmit={(e) => save(e, 'salvation', 'My salvation journey', salvation?.id)}
        >
          <div className="form-grid">
            <label>
              Salvation date
              <input
                type="date"
                name="salvationDate"
                max={state.today}
                required
                defaultValue={salvation?.data.salvationDate}
              />
            </label>
            <label>
              When did you confirm your faith?
              <input
                type="date"
                name="confirmationDate"
                max={state.today}
                defaultValue={salvation?.data.confirmationDate}
              />
            </label>
          </div>
          <label>
            How did you come to understand salvation?
            <textarea
              name="understanding"
              rows={5}
              required
              defaultValue={salvation?.data.understanding}
              placeholder="Describe how your understanding and faith began."
            />
          </label>
          <label>
            How did you confirm the beginning of your faith?
            <textarea
              name="confirmation"
              rows={5}
              required
              defaultValue={salvation?.data.confirmation}
              placeholder="Describe the basis of your assurance and the experience you want to remember."
            />
          </label>
          <label>
            People, passages or events that helped you
            <textarea name="references" defaultValue={salvation?.data.references} />
          </label>
          <p className="fine-print">
            These details are private to your account. Saving your story does not automatically
            change a church-approved spiritual state.
          </p>
          {saveButton}
        </form>
      </section>
    );
  if (view === 'best')
    return (
      <section className="panel faith-section">
        <span className="eyebrow">STELLIB.E.S.T. · YOUR TESTIMONY</span>
        <h2>Before. Event that Led. Salvation Day. Today.</h2>
        <p className="muted">
          Share your experience in these four parts. You decide who can read it.
        </p>
        {feedback}
        <form
          key={best?.updated_at || 'new'}
          onSubmit={(e) => save(e, 'testimony', 'My B.E.S.T. testimony', best?.id)}
        >
          {[
            [
              'before',
              'B',
              'Before',
              'What was your life like before the beginning of your faith?',
            ],
            ['event', 'E', 'Event that Led', 'What event or experience led you toward salvation?'],
            ['salvationDay', 'S', 'Salvation Day', 'What happened on the day your faith began?'],
            ['today', 'T', 'Today', 'How is your faith shaping your life today?'],
          ].map(([key, letter, label, prompt]) => (
            <label className="testimony-field" key={key}>
              <span>
                <b>{letter}</b>
                {label}
              </span>
              <textarea
                name={key}
                rows={4}
                required
                defaultValue={best?.data[key]}
                placeholder={prompt}
              />
            </label>
          ))}
          <label>
            Who can read this testimony?
            <select name="visibility" defaultValue={best?.visibility || 'private'}>
              <option value="private">Only me</option>
              <option value="care">My Care Group</option>
              <option value="church">Church members</option>
            </select>
          </label>
          <p className="fine-print">
            Choosing a group or church makes all four testimony fields visible to that audience. You
            can return to Only me at any time.
          </p>
          {saveButton}
        </form>
      </section>
    );
  if (view === 'stat') {
    const logs = payload.logs.filter((l: any) => l.status !== 'draft'),
      habits = [...new Set<string>(logs.map((l: any) => l.habit))];
    const exported = () => {
      const rows = [
        ['Habit', 'Period', 'Status'],
        ...logs.map((l: any) => [
          state.commitments.find((c: any) => c.id === l.habit)?.habit || l.habit,
          l.period,
          l.status,
        ]),
      ];
      const csv = rows
        .map((row) =>
          row
            .map(
              (v: any) =>
                '"' +
                String(v)
                  .replace(/^[=+@-]/, "'")
                  .replaceAll('"', '""') +
                '"',
            )
            .join(','),
        )
        .join('\r\n');
      const a = document.createElement('a'),
        url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.href = url;
      a.download = 'my-stellistat.csv';
      a.click();
      URL.revokeObjectURL(url);
    };
    return (
      <>
        <div className="section-heading">
          <div>
            <h2>{kids ? 'SkidiStat' : 'StelliStat'}</h2>
            <p className="muted">
              {payload.from} to {payload.to}
            </p>
          </div>
          <div className="stat-controls">
            <select
              aria-label="Statistics range"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              {['week', 'month', 'quarter', 'year'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <button className="button secondary" onClick={exported}>
              <Download size={15} />
              Report
            </button>
          </div>
        </div>
        <div className="stats-row">
          {[
            ['Submitted', logs.length],
            ['Verified', logs.filter((l: any) => l.status === 'confirmed').length],
            ['Awaiting verification', logs.filter((l: any) => l.status === 'pending').length],
          ].map(([label, value]) => (
            <div className="stat-card" key={label}>
              <span className="stat-label">{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <section className="panel spaced">
          <h2>Spiritual and personal activity</h2>
          {habits.length ? (
            habits.map((h) => {
              const entries = logs.filter((l: any) => l.habit === h),
                confirmed = entries.filter((l: any) => l.status === 'confirmed').length;
              return (
                <div className="stat-habit-row" key={h}>
                  <strong>{state.commitments.find((c: any) => c.id === h)?.habit || h}</strong>
                  <div>
                    <span
                      style={{
                        width: `${Math.max(5, (entries.length / Math.max(...habits.map((k) => logs.filter((l: any) => l.habit === k).length))) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>
                    {entries.length} submitted · {confirmed} verified
                  </small>
                </div>
              );
            })
          ) : (
            <p className="muted">
              Your submitted activities will appear here for the selected period.
            </p>
          )}
        </section>
      </>
    );
  }
  if (view === 'goals')
    return (
      <>
        <section className="panel">
          <h2>{kids ? 'SkidiGoal' : 'StelliGoal'}</h2>
          <p className="muted">Give your goal a name, a target and a date.</p>
          {feedback}
          <form className="inline-form" onSubmit={(e) => save(e, 'goal')}>
            <label className="wide">
              Goal
              <input
                name="title"
                required
                maxLength={140}
                placeholder="What would you like to work toward?"
              />
            </label>
            <label>
              Category
              <select name="category">
                {['Spiritual', 'Personal', 'Learning', 'Physical', 'Family'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Target date
              <input name="targetDate" type="date" required />
            </label>
            <label>
              Target or result
              <input name="target" required />
            </label>
            <label>
              Baseline
              <input name="baseline" />
            </label>
            <label>
              Unit
              <input name="unit" placeholder="Minutes, sessions, or another unit" />
            </label>
            <label className="wide">
              Plan of action
              <textarea name="plan" />
            </label>
            <button className="button primary" disabled={busy}>
              <Plus size={16} />
              Save goal
            </button>
          </form>
        </section>
        <div className="goal-cards spaced">
          {items
            .filter((i: any) => i.kind === 'goal')
            .map((g: any) => (
              <article className="panel" key={g.id}>
                <Target size={21} />
                <h3>{g.title}</h3>
                <p>{g.data.plan}</p>
                <div className="goal-values">
                  <span>
                    Baseline<strong>{g.data.baseline || '—'}</strong>
                  </span>
                  <span>
                    Target
                    <strong>
                      {g.data.target} {g.data.unit}
                    </strong>
                  </span>
                </div>
                <small className="muted">
                  {g.data.category} · {g.data.targetDate}
                </small>
              </article>
            ))}
        </div>
      </>
    );
  return (
    <>
      <section className="panel rating-intro">
        <div>
          <span className="eyebrow">{kids ? 'SKIDIRATE' : 'STELLIRATE'}</span>
          <h2>Notice how you are growing</h2>
          <p className="muted">
            {kids
              ? 'Record private growth check-ins with your guardian against your checkpoints.'
              : 'Share your weekly iRate, then record private check-ins against your growth checkpoints.'}
          </p>
        </div>
        {!kids && (
          <button className="button primary" onClick={onWeeklyRate}>
            Open weekly iRate
            <Star size={16} />
          </button>
        )}
      </section>
      <section className="panel spaced">
        <h2>Growth assessment</h2>
        {feedback}
        <form
          className="assessment-form"
          onSubmit={(e) => save(e, 'assessment', 'Growth checkpoint')}
        >
          <label>
            Checkpoint
            <select name="checkpoint">
              {checkpoints.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Measurement date
              <input type="date" name="measuredOn" max={state.today} required defaultValue={date} />
            </label>
            <label>
              Weight (kg)
              <input type="number" min="1" max="1000" step="0.1" name="weight" />
            </label>
            {!kids && (
              <label>
                Height (cm)
                <input type="number" min="1" max="300" step="0.1" name="height" />
              </label>
            )}
            <label>
              Blood pressure systolic
              <input type="number" min="1" max="400" name="systolic" />
            </label>
            <label>
              Blood pressure diastolic
              <input type="number" min="1" max="400" name="diastolic" />
            </label>
          </div>
          <label>
            Health conditions or changes you want to record
            <textarea name="conditions" />
          </label>
          <label>
            Reflection on your goals
            <textarea name="reflection" />
          </label>
          <p className="fine-print">
            Health details and checkpoint notes remain private. These are personal records, not a
            medical assessment.
          </p>
          {saveButton}
        </form>
      </section>
      <section className="panel spaced">
        <h2>Previous check-ins</h2>
        {items.filter((i: any) => i.kind === 'assessment').length ? (
          items
            .filter((i: any) => i.kind === 'assessment')
            .map((a: any) => {
              const bmi =
                !kids && Number(a.data.height) > 0 && Number(a.data.weight) > 0
                  ? Number(a.data.weight) / (Number(a.data.height) / 100) ** 2
                  : null;
              return (
                <article className="assessment-record" key={a.id}>
                  <strong>{a.data.checkpoint}</strong>
                  <span>{a.data.measuredOn}</span>
                  <p>
                    {a.data.weight ? `Weight ${a.data.weight} kg. ` : ''}
                    {bmi ? `BMI ${bmi.toFixed(1)}. ` : ''}
                    {a.data.systolic && a.data.diastolic
                      ? `Blood pressure ${a.data.systolic}/${a.data.diastolic}.`
                      : ''}
                  </p>
                  <p>{a.data.reflection}</p>
                </article>
              );
            })
        ) : (
          <p className="muted">Your saved assessment check-ins will appear here.</p>
        )}
      </section>
    </>
  );
}
