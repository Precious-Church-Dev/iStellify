'use client';
import {
  ArrowRight,
  BookOpen,
  Heart,
  Leaf,
  Star,
  Sun,
  Users,
  Target,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import Mascot from './Mascot';
import StelliPath from './StelliPath';
import { stelliState } from '@/lib/stellipath';
export default function MemberOverview({
  state,
  onOpen,
  onHabit,
  journeyDay,
  onProfile,
}: {
  state: any;
  onOpen: (view: string) => void;
  onHabit: (habit: string) => void;
  journeyDay: string;
  onProfile: () => void;
}) {
  const s = state,
    kids = s.subject.tag === 'StelliKids',
    person = s.subject,
    prefix = kids ? 'Skidi' : 'Stelli';
  const daily = ['iRead', 'iPray'].filter((h) =>
    s.logs.some((l: any) => l.habit === h && l.status !== 'draft' && l.period === s.date),
  ).length;
  const light = s.logs.filter(
      (l: any) => !s.commitments.some((c: any) => c.id === l.habit) && l.status !== 'draft',
    ),
    life = s.logs.filter(
      (l: any) => s.commitments.some((c: any) => c.id === l.habit) && l.status !== 'draft',
    );
  const stateLabel = person.spiritual_state || 'SBG';
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: s.timezone || 'Asia/Manila',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
  );
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const goals = s.personalItems?.filter((r: any) => r.kind === 'goal') || [];
  return (
    <div className={'member-overview ' + (kids ? 'kids-overview' : '')}>
      {!kids ? (
        <StelliPath
          day={journeyDay}
          onProfile={onProfile}
          member={{
            churchNumber: person.pcm,
            nickname: person.nickname || person.name.split(' ')[0],
            stellarFragments: s.profile.stellar_fragments,
            avatarUrl: s.profile.has_avatar ? '/api/media?kind=avatar&v=' + s.serverNow : undefined,
            gender: s.profile.gender,
            stelliState: stelliState(stateLabel),
          }}
        />
      ) : (
        <section className="greet-panel">
          <div className="greet-character">
            <Mascot />
            <span>{prefix}Stat</span>
          </div>
          <div className="greet-message">
            <span className="eyebrow">A LITTLE GROWTH FOR LITTLE STARS</span>
            <h2>
              {greeting},<br />
              <strong>{person.nickname || person.name.split(' ')[0]}!</strong>
            </h2>
            <p>Little acts of kindness and faith make a bright day.</p>
            <span className="member-code">{person.pcm}</span>
          </div>
          <div className="greet-profile">
            <div className="profile-orbit">
              <div className="profile-initial">{(person.nickname || person.name)[0]}</div>
            </div>
            <strong>{person.name}</strong>
            <span>StelliKids</span>
          </div>
          <div className="state-ladder">
            <span className="eyebrow">{prefix}State</span>
            <div className="lit">
              <Star size={23} />
              <span>
                <strong>SBG</strong>
                <small>Saved by Grace</small>
              </span>
            </div>
          </div>
        </section>
      )}
      {kids && (
        <div className="fragment-banner">
          ✦ {s.profile.stellar_fragments} Stellar Fragments earned
        </div>
      )}
      {s.badges.map((b: any) => (
        <div className="fragment-banner" key={b.year}>
          🏅 Brother’s Keeper · {b.year}
          <strong>{b.score} impact points</strong>
        </div>
      ))}
      <div className="overview-scorebar">
        <div>
          <Sun size={19} />
          <span>
            Daily Light<strong>{daily} / 2 submitted today</strong>
          </span>
        </div>
        <div>
          <ShieldCheck size={19} />
          <span>
            {prefix}Stat
            <strong>
              {s.logs.filter((l: any) => l.status === 'confirmed').length} verified entries in this
              view
            </strong>
          </span>
        </div>
        <button onClick={() => onOpen('light')}>
          Open StelliCards <ArrowRight size={16} />
        </button>
      </div>
      <div className="member-panel-grid">
        <section className="panel overview-panel">
          <header>
            <div>
              <span className="section-symbol">
                <Sun size={19} />
              </span>
              <h2>{prefix}Light</h2>
            </div>
            <button className="text-button" onClick={() => onOpen('light')}>
              Open
              <ArrowRight size={14} />
            </button>
          </header>
          <div className="frequency-columns">
            {[
              ['Daily Light', ['iRead', 'iPray']],
              [
                'Weekly Light',
                kids
                  ? ['iPraise', 'iTithes', 'iNote']
                  : ['iPraise', 'iTithes', 'iNote', 'iCare', 'iSpeak', 'iRate'],
              ],
              ...(!kids ? [['Monthly Light', ['iShare']]] : []),
            ].map(([title, habits]: any) => (
              <div key={title}>
                <h3>{title}</h3>
                {habits.map((habit: string) => {
                  const l = s.logs.find((r: any) => r.habit === habit);
                  return (
                    <button key={habit} onClick={() => onHabit(habit)}>
                      <span>{habit}</span>
                      <i className={l && l.status !== 'draft' ? 'done' : ''}>
                        {l && l.status !== 'draft' ? '✓' : '○'}
                      </i>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <footer>
            {prefix}Light Stat{' '}
            <strong>
              {light.length} submitted · {light.filter((r: any) => r.status === 'confirmed').length}{' '}
              verified
            </strong>
          </footer>
        </section>
        <section className="panel overview-panel">
          <header>
            <div>
              <span className="section-symbol life">
                <Leaf size={19} />
              </span>
              <h2>{prefix}Life</h2>
            </div>
            <button className="text-button" onClick={() => onOpen('life')}>
              Habit selector
              <ArrowRight size={14} />
            </button>
          </header>
          <div className="frequency-columns">
            {['daily', 'weekly', 'monthly'].map((f) => (
              <div key={f}>
                <h3>{f[0].toUpperCase() + f.slice(1)} Life</h3>
                {s.commitments.filter((c: any) => c.frequency === f).length ? (
                  s.commitments
                    .filter((c: any) => c.frequency === f)
                    .slice(0, 4)
                    .map((c: any) => (
                      <button key={c.id} onClick={() => onOpen('life')}>
                        <span>{c.habit}</span>
                        <i>○</i>
                      </button>
                    ))
                ) : (
                  <p className="muted">Choose your {f} habits.</p>
                )}
              </div>
            ))}
          </div>
          <footer>
            {prefix}Life Stat{' '}
            <strong>
              {s.commitments.length} active habits · {life.length} submitted
            </strong>
          </footer>
        </section>
        <section className="panel overview-panel link-overview">
          <header>
            <div>
              <span className="section-symbol">
                <Users size={19} />
              </span>
              <h2>{prefix}Link</h2>
            </div>
            <button className="text-button" onClick={() => onOpen('groups')}>
              Open
              <ArrowRight size={14} />
            </button>
          </header>
          <div className="link-group-columns">
            {(kids ? ['family'] : ['family', 'care', 'share']).map((kind) => (
              <div key={kind}>
                <h3>
                  {kind === 'family' ? 'StelliFam' : kind === 'care' ? 'StelliCare' : 'StelliShare'}
                </h3>
                {s.peers
                  .filter((p: any) => p.kind === kind)
                  .slice(0, 3)
                  .map((p: any) => (
                    <div className="mini-peer" key={p.id + p.group_id}>
                      <span>{p.pcm}</span>
                      <strong>{p.nickname || p.name}</strong>
                      <small>{p.daily_count}/2 today</small>
                    </div>
                  ))}
                {!s.peers.some((p: any) => p.kind === kind) && (
                  <p className="muted">Your assigned group appears here.</p>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="panel overview-panel">
          <header>
            <div>
              <span className="section-symbol">
                <Target size={19} />
              </span>
              <h2>{prefix}Base</h2>
            </div>
            <button className="text-button" onClick={() => onOpen('goals')}>
              Open
              <ArrowRight size={14} />
            </button>
          </header>
          {goals.length ? (
            <ul className="overview-goals">
              {goals.slice(0, 3).map((g: any) => (
                <li key={g.id}>
                  <Star size={13} />
                  {g.title}
                  <small>{g.data.targetDate || 'Ongoing'}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Name a goal, make a plan, and keep track of the small steps along the way.
            </p>
          )}
          {kids && (
            <button className="rating-summary" onClick={() => onOpen('rate')}>
              <Activity size={19} />
              <span>
                <strong>SkidiGrade</strong>
                <small>Private growth checkpoints</small>
              </span>
              <ArrowRight size={16} />
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
