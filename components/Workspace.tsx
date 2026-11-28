'use client';
import WeeklyCard from './WeeklyCard';
import Profile from './Profile';
import RosterGenderImport from './RosterGenderImport';
import CommitmentForm from './CommitmentForm';
import Baptism from './Baptism';
import { Coach, ChurchCalendar, ReviewDashboard, UnlockQueue, NudgePanel } from './Updates';
import { LIFE_CARDS, cardPeriod, localClock, reviewOpen } from '@/lib/cards';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Users,
  Wallet,
  X,
  Download,
  Bell,
  CalendarDays,
  Upload,
  LockKeyhole,
  Moon,
} from 'lucide-react';
import { DAILY, WEEKLY, MONTHLY, periodFor, weekStart } from '@/lib/domain';
import HabitForm from './HabitForm';
import Mascot from './Mascot';
import Brand from './Brand';
import MemberOverview from './MemberOverview';
import PersonalSections from './PersonalSections';
import MinistryModule from './MinistryModule';
import StelliCompanion from './StelliCompanion';
import MemberAvatar from './MemberAvatar';
import { InstallControl } from './Pwa';
import { resolveMascotMood } from '@/lib/stelli-mascot';
import {
  MODULES,
  landingModule,
  memberSections,
  moduleAllowed,
  type ModuleId,
} from '@/lib/navigation';
const names: Record<string, string> = {
  iRead: 'Read & reflect',
  iPray: 'Make time for prayer',
  iPraise: 'Worship together',
  iNote: 'Capture the message',
  iCare: 'Connect with your Care Group',
  iSpeak: 'Answer the weekly challenge',
  iTithes: 'Record your giving',
  iRate: 'Share your weekly rating',
  iShare: 'Share and encourage',
};
const money = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format((v || 0) / 100);
const icons: Record<string, any> = {
  iRead: BookOpen,
  iPray: Heart,
  iPraise: Sun,
  iNote: BookOpen,
  iCare: Users,
  iSpeak: MessageCircle,
  iTithes: Wallet,
  iRate: Star,
  iShare: Sparkles,
};
const Badge = ({ status }: { status: string }) => (
  <span className={'badge ' + status}>
    {status === 'pending'
      ? 'Awaiting verification'
      : status === 'confirmed'
        ? 'Verified'
        : status === 'flagged'
          ? 'Needs correction'
          : status === 'draft'
            ? 'In progress'
            : status}
  </span>
);
function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="empty">
      <Sparkles size={26} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function SimpleForm({
  children,
  onSubmit,
  label = 'Save',
  className = '',
}: {
  children: React.ReactNode;
  onSubmit: (data: any) => Promise<any>;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className={className}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? 'Saving…' : label}
      </button>
    </form>
  );
}
export default function Workspace() {
  const [state, setState] = useState<any>(null),
    [view, setView] = useState('home'),
    [activeModule, setActiveModule] = useState<ModuleId | null>(null),
    [now, setNow] = useState(() => new Date()),
    [date, setDate] = useState(''),
    [subject, setSubject] = useState(''),
    [modal, setModal] = useState<any>(null),
    [toast, setToast] = useState(''),
    [error, setError] = useState(''),
    [menu, setMenu] = useState(false),
    [adminTab, setAdminTab] = useState('members'),
    [preview, setPreview] = useState<any>(null),
    [activation, setActivation] = useState<any>(null),
    [theme, setTheme] = useState('light'),
    [reviewing, setReviewing] = useState<any>(null),
    [busyImport, setBusyImport] = useState(false);
  const lastActivity = useRef(Date.now()),
    lastHeartbeat = useRef(Date.now()),
    expired = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (date) p.set('date', date);
      if (subject) p.set('subject', subject);
      const r = await fetch('/api/app?' + p, { cache: 'no-store' });
      const b = await r.json();
      if (r.status === 401) {
        location.reload();
        return;
      }
      if (!r.ok) throw new Error(b.error);
      setState(b);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [date, subject]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 15000);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, []);
  const clock = localClock(now, state?.profile?.timezone);
  const progressDay = state?.dailyProgress?.day;
  useEffect(() => {
    if (progressDay && progressDay !== clock.day) refresh();
  }, [clock.day, progressDay, refresh]);
  useEffect(() => {
    const t = localStorage.getItem('istelli-theme') || 'light';
    setTheme(t);
    document.documentElement.dataset.theme = t;
  }, []);
  const expire = useCallback(async () => {
    if (expired.current) return;
    expired.current = true;
    setState(null);
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    location.reload();
  }, []);
  useEffect(() => {
    const activity = (e: Event) => {
      if (!e.isTrusted) return;
      const now = Date.now();
      if (now - lastActivity.current >= 300000) {
        expire();
        return;
      }
      lastActivity.current = now;
      if (now - lastHeartbeat.current > 20000) {
        lastHeartbeat.current = now;
        fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'heartbeat' }),
        })
          .then((r) => {
            if (r.status === 401) expire();
          })
          .catch(() => {});
      }
    };
    ['pointerdown', 'keydown', 'scroll'].forEach((x) =>
      window.addEventListener(x, activity, { passive: true }),
    );
    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current >= 300000) expire();
    }, 1000);
    return () => {
      clearInterval(interval);
      ['pointerdown', 'keydown', 'scroll'].forEach((x) => window.removeEventListener(x, activity));
    };
  }, [expire]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  async function act(data: any) {
    const r = await fetch('/api/app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const b = await r.json();
    if (r.status === 401) {
      await expire();
      throw new Error('Session ended.');
    }
    if (!r.ok) throw new Error(b.error);
    if (b.message) setToast(b.message);
    await refresh();
    return b;
  }
  function go(v: string) {
    setView(v);
    setMenu(false);
    setReviewing(null);
  }
  function toggleTheme() {
    const t = theme === 'light' ? 'dark' : 'light';
    setTheme(t);
    localStorage.setItem('istelli-theme', t);
    document.documentElement.dataset.theme = t;
  }
  if (!state)
    return (
      <div className="connection-screen">
        <span className="brand-mark">✦</span>
        <h1>Opening your space</h1>
        <p>{error || 'A moment for your growth journey.'}</p>
        {error && (
          <button className="button primary" onClick={refresh}>
            Try again
          </button>
        )}
      </div>
    );
  const s = state,
    u = s.user,
    kids = s.subject.tag === 'StelliKids',
    activeDate = date || s.today;
  const allHabits = kids
    ? ['iRead', 'iPray', 'iPraise', 'iNote', 'iTithes']
    : DAILY.concat(WEEKLY, MONTHLY);
  const entry = (habit: string, frequency?: string) =>
    s.logs.find(
      (l: any) => l.habit === habit && l.period === cardPeriod(habit, activeDate, frequency),
    );
  const dayDone = DAILY.filter((h) => entry(h) && entry(h).status !== 'draft').length,
    weekDone = allHabits.filter(
      (h) => WEEKLY.includes(h) && entry(h) && entry(h).status !== 'draft',
    ).length;
  const moduleId = activeModule || landingModule(u.tag);
  const moduleInfo = MODULES.find((m) => m.id === moduleId)!;
  const coreModule = moduleId === 'individual' || moduleId === 'kids';
  const sections = memberSections(kids);
  const pending = s.review.filter(
    (l: any) =>
      l.status === 'pending' &&
      (moduleId === 'care'
        ? !['iShare', 'iTithes'].includes(l.habit)
        : moduleId === 'share'
          ? l.habit === 'iShare'
          : moduleId === 'finance'
            ? l.habit === 'iTithes'
            : true),
  );
  const navigation = MODULES.filter(
    (m) => !['finance', 'admin'].includes(m.id) || moduleAllowed(m.id, u, s.children.length),
  ).map((m) => [
    m.id,
    m.label,
    (
      {
        individual: Star,
        kids: Heart,
        care: Users,
        share: Sparkles,
        church: BookOpen,
        coach: BookOpen,
        finance: Wallet,
        settings: Settings,
        admin: LockKeyhole,
      } as any
    )[m.id],
  ]);
  function openModule(id: ModuleId) {
    if (!moduleAllowed(id, u, s.children.length)) return;
    setActiveModule(id);
    setMenu(false);
    setReviewing(null);
    setModal(null);
    if (id === 'kids' && u.tag !== 'StelliKids') {
      setSubject('');
      setView('kids');
      return;
    }
    if (subject) {
      setSubject('');
      setState(null);
    }
    setView(
      id === 'individual' || id === 'kids'
        ? 'home'
        : id === 'care' || id === 'share' || id === 'church'
          ? 'ministry'
          : id === 'finance'
            ? 'tithes'
            : id === 'settings'
              ? 'settings'
              : id === 'coach'
                ? 'coach'
                : 'admin',
    );
  }
  const sectionName =
    view === 'notifications'
      ? 'Notifications'
      : view === 'review'
        ? moduleId === 'care'
          ? 'iStellCheck'
          : moduleId === 'share'
            ? 'iShareCheck'
            : 'iTithesCheck'
        : coreModule
          ? sections.find((t) => t.id === view)?.label || 'StelliKids'
          : moduleInfo.label;
  const openHabit = (habit: string, title?: string, frequency?: string) =>
    setModal({ habit, title, existing: entry(habit, frequency) });
  const Card = ({
    habit,
    frequency,
    title,
  }: {
    habit: string;
    frequency?: string;
    title?: string;
  }) => {
    const log = entry(habit, frequency),
      Icon = icons[habit] || Leaf;
    return (
      <button
        className={'habit-card ' + (log && log.status !== 'draft' ? 'completed' : '')}
        onClick={() => openHabit(habit, title, frequency)}
      >
        <div className="habit-top">
          <span className="habit-icon">
            <Icon size={21} />
          </span>
          {log && log.status !== 'draft' ? (
            <span className="round-check">
              <Check size={15} />
            </span>
          ) : (
            <span className="habit-frequency">
              {frequency ||
                (DAILY.includes(habit) ? 'DAILY' : MONTHLY.includes(habit) ? 'MONTHLY' : 'WEEKLY')}
            </span>
          )}
        </div>
        <div>
          <h3>{title || habit}</h3>
          <p>{names[habit] || 'A small step toward a meaningful goal'}</p>
        </div>
        <div className="habit-bottom">
          {log ? <Badge status={log.status} /> : <span className="muted">Ready when you are</span>}
          <ArrowRight size={16} />
        </div>
      </button>
    );
  };
  return (
    <div className={'workspace ' + (kids ? 'kids-mode' : '')}>
      <aside className={'sidebar ' + (menu ? 'open' : '')}>
        <Brand />
        <div className="church-label">PRECIOUS CHURCH</div>
        <div className="nav-caption">CHURCH MODULES</div>
        <nav>
          {navigation.map(([key, label, Icon]: any) => (
            <button
              key={key}
              className={moduleId === key ? 'active' : ''}
              disabled={!moduleAllowed(key as ModuleId, u, s.children.length)}
              onClick={() => openModule(key as ModuleId)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {!moduleAllowed(key as ModuleId, u, s.children.length) && (
                <LockKeyhole size={11} className="module-lock" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="community-note">
            <span>✧</span>
            <p>
              Grow in faith.
              <br />
              Shine in life.
            </p>
          </div>
          <button className="signout" onClick={expire}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu />
            </button>
            <span>{moduleInfo.label}</span>
            <ChevronRight size={14} />
            <strong>{sectionName}</strong>
          </div>
          <div className="topbar-right">
            <span className="private-label">
              <ShieldCheck size={14} />
              Church members only
            </span>
            <button className="icon-button" aria-label="Toggle theme" onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              className="notification-button"
              aria-label="Notifications"
              onClick={() => go('notifications')}
            >
              <Bell size={19} />
              {s.notifications.some((n: any) => !n.read_at) && <i />}
            </button>
            <button
              type="button"
              className="avatar"
              onClick={() => openModule('settings')}
              aria-label="Open your profile"
            >
              <MemberAvatar
                src={s.profile.has_avatar ? '/api/media?kind=avatar&v=' + s.serverNow : undefined}
                label="Your profile picture"
              />
            </button>
          </div>
        </header>
        <main className="content">
          {error && (
            <p className="error" role="alert">
              {error}
              <button onClick={refresh}>Retry</button>
            </p>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {kids ? 'LITTLE STEPS, BRIGHT STARS' : 'A LITTLE GROWTH, EVERY DAY'}
              </span>
              <h1>{sectionName}</h1>
              <p className="muted">
                {view === 'home'
                  ? 'Make space for faith, purpose, and the people around you.'
                  : view === 'light'
                    ? 'Plan your time, complete your activity, and log your growth.'
                    : view === 'review'
                      ? 'Review the entries entrusted to your care.'
                      : 'Precious Church · iStellify'}
              </p>
            </div>
            {!(kids && view === 'home') &&
              !['admin', 'settings', 'kids', 'notifications'].includes(view) && (
                <label className="date-picker">
                  <CalendarDays size={17} />
                  <input
                    aria-label="Selected date"
                    type="date"
                    value={activeDate}
                    max={s.today}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              )}
          </div>
          {subject && subject !== u.id && (
            <div className="assisted-banner">
              <Heart size={18} />
              Assisting {s.subject.name}. Your name is recorded as the person entering each
              activity.
              <button onClick={() => openModule(landingModule(u.tag))}>Return to my account</button>
            </div>
          )}
          {coreModule && view !== 'kids' && view !== 'notifications' && (
            <nav className="module-tabs member-tabs" aria-label={moduleInfo.label + ' sub-modules'}>
              {sections.map((t) => (
                <button
                  key={t.id}
                  className={view === t.id ? 'active' : ''}
                  onClick={() => go(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          )}
          {coreModule && view === 'home' && (
            <>
              <MemberOverview
                state={s}
                onOpen={go}
                onHabit={openHabit}
                journeyDay={clock.day}
                onProfile={() => openModule('settings')}
              />
              <PersonalSections
                view="stat"
                state={s}
                date={activeDate}
                onRefresh={refresh}
                onWeeklyRate={() => openHabit('iRate')}
              />
            </>
          )}
          {view === 'lot' && (
            <section className="panel">
              <span className="eyebrow">STELLILOT</span>
              <h2>Latest of Today</h2>
              <p className="muted">Coming in 2028.</p>
            </section>
          )}
          {view === 'cleanse' && <Baptism state={s} act={act} />}
          {moduleId === 'coach' && view === 'coach' && <Coach state={s} act={act} />}
          {moduleId === 'church' && view === 'ministry' && <ChurchCalendar state={s} act={act} />}
          {coreModule &&
            (['stat', 'goals', 'save', 'best'].includes(view) || (kids && view === 'rate')) && (
              <PersonalSections
                view={view}
                state={s}
                date={activeDate}
                onRefresh={refresh}
                onWeeklyRate={() => openHabit('iRate')}
              />
            )}
          {['care', 'share', 'church'].includes(moduleId) && view === 'ministry' && (
            <MinistryModule
              module={moduleId as 'care' | 'share' | 'church'}
              state={s}
              onReview={() => go('review')}
            />
          )}
          {view === 'light' && (
            <>
              <div className="week-strip">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(weekStart(activeDate) + 'T12:00:00Z');
                  d.setUTCDate(d.getUTCDate() + i);
                  const value = d.toISOString().slice(0, 10);
                  return (
                    <button
                      disabled={value > s.today}
                      key={i}
                      className={value === activeDate ? 'selected' : ''}
                      onClick={() => setDate(value)}
                    >
                      <span>{['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][i]}</span>
                      <strong>{d.getUTCDate()}</strong>
                      <i>{value === activeDate ? <Sun size={13} /> : null}</i>
                    </button>
                  );
                })}
              </div>
              <div className="section-heading">
                <div>
                  <h2>Daily Light</h2>
                  <p className="muted">iBlock. iAct. iLog.</p>
                </div>
                <span className="frequency-note">
                  <Clock3 size={15} /> Daily lock · midnight
                </span>
              </div>
              <div className="habit-grid">
                {DAILY.map((h) => (
                  <Card key={h} habit={h} />
                ))}
              </div>
              <div className="section-heading">
                <div>
                  <h2>Weekly Light</h2>
                  <p className="muted">Worship, learn, and connect.</p>
                </div>
                <span className="frequency-note">Sunday submission deadlines</span>
              </div>
              <div className="habit-grid">
                {WEEKLY.filter((h) => allHabits.includes(h)).map((h) => (
                  <Card key={h} habit={h} />
                ))}
              </div>
              {!kids && (
                <>
                  <div className="section-heading">
                    <h2>Monthly Light</h2>
                    <span className="frequency-note">Last Sunday deadline</span>
                  </div>
                  <div className="habit-grid">
                    <Card habit="iShare" />
                  </div>
                </>
              )}
            </>
          )}
          {view === 'life' && (
            <>
              <section className="panel">
                <h2>StelliLife card library</h2>
                <p className="muted">Choose a card to add to your personal habits.</p>
                <div className="life-library">
                  {LIFE_CARDS.map(([name, description]) => (
                    <button
                      key={name}
                      className="life-preset"
                      onClick={() => {
                        const plan =
                          description ||
                          prompt('Describe your ' + name + ' habit (optional)') ||
                          '';
                        act({
                          action: 'adoptLifeCard',
                          habit: name,
                          plan,
                          subject: s.subject.id,
                        }).catch((e) => setToast(e.message));
                      }}
                    >
                      <strong>{name}</strong>
                      <small>{description || 'Personalize your plan'}</small>
                      <Plus size={14} />
                    </button>
                  ))}
                </div>
              </section>
              <section className="panel">
                <h2>Make a personal commitment</h2>
                <p className="muted">
                  Choose a habit you want to build. Its schedule stays locked through its commitment
                  window.
                </p>
                <CommitmentForm subject={s.subject.id} act={act} />
              </section>
              <div className="section-heading">
                <h2>Your committed habits</h2>
              </div>
              {s.commitments.length ? (
                <div className="habit-grid">
                  {s.commitments.map((c: any) => (
                    <div key={c.id}>
                      <Card habit={c.id} title={c.habit} frequency={c.frequency} />
                      <p className="fine-print">
                        Locked through {String(c.lock_until).slice(0, 10)} · {c.plan}
                      </p>
                      <button
                        className="text-button"
                        disabled={String(c.lock_until).slice(0, 10) >= s.today}
                        onClick={() =>
                          act({
                            action: 'archiveCommitment',
                            id: c.id,
                            subject: s.subject.id,
                          }).catch((e) => setToast(e.message))
                        }
                      >
                        Archive habit
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title="Your next habit starts here">
                  Create a personal commitment above, then log your progress.
                </Empty>
              )}
            </>
          )}
          {view === 'groups' && (
            <>
              <div className="group-memberships">
                {s.scope.map((g: any) => (
                  <div className="group-chip" key={g.group_id}>
                    <Users size={17} />
                    <div>
                      <strong>{g.name}</strong>
                      <span>
                        {g.kind} · {g.roles.join(', ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <GroupPanels
                peers={s.peers}
                expanded
                onNudge={(id) => act({ action: 'nudge', id })}
              />
              <p className="fine-print">
                Peers see completion summaries. Private journals, ratings, giving amounts and health
                details are not shared here.
              </p>
            </>
          )}
          {view === 'review' && (
            <ReviewDashboard state={s} date={activeDate} onReview={setReviewing} act={act} />
          )}
          {view === 'tithes' && (
            <>
              <section className="finance-intro">
                <div>
                  <Wallet size={28} />
                  <h2>Your giving, thoughtfully recorded</h2>
                  <p className="muted">
                    Record Gift, Offering, Tithes and Breaking of Bread. Your amounts are private to
                    you and authorized financial reviewers.
                  </p>
                  <button className="button primary" onClick={() => openHabit('iTithes')}>
                    {entry('iTithes') ? 'View or correct this week' : 'Record this week’s giving'}
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className="finance-total">
                  <span>YOUR DECLARED NET · SELECTED WEEK</span>
                  <strong>{money(entry('iTithes')?.data?.amounts?.net)}</strong>
                  {entry('iTithes') ? (
                    <Badge status={entry('iTithes').status} />
                  ) : (
                    <small>No declaration yet</small>
                  )}
                </div>
              </section>
              {(s.finance.length > 0 ||
                (s.roleScope || s.scope).some((g: any) => g.roles.includes('auditor')) ||
                u.roles.includes('pastor')) && (
                <section className="panel spaced leader-workspace">
                  <span className="eyebrow">AUDITOR SECTION</span>
                  <h2>StelliTithesDash</h2>
                  <p className="muted">
                    Declared and verified totals are shown separately for your authorized financial
                    groups.
                  </p>
                  <button className="button primary" onClick={() => go('review')}>
                    iTithesCheck
                    <ShieldCheck size={16} />
                  </button>
                </section>
              )}
              {s.finance.length > 0 && (
                <FinanceTable
                  logs={[
                    ...s.finance,
                    ...s.logs
                      .filter((l: any) => l.habit === 'iTithes' && l.status !== 'draft')
                      .map((l: any) => ({ ...l, name: s.subject.name, pcm: s.subject.pcm })),
                  ]}
                  onReview={(l: any) =>
                    l.member_id === u.id ? openHabit('iTithes') : setReviewing(l)
                  }
                />
              )}
            </>
          )}
          {view === 'kids' && (
            <div className="habit-grid">
              {!s.children.length && (
                <section className="panel">
                  <h2>StelliKids</h2>
                  <p className="muted">
                    Children tagged StelliKids land directly on their SkidiStat dashboard after
                    login. To help a child from your account, first record the guardian relationship
                    in StelliAd.
                  </p>
                  {s.admin && (
                    <button
                      className="button primary"
                      onClick={() => {
                        openModule('admin');
                        setAdminTab('guardians');
                      }}
                    >
                      Manage guardian links
                    </button>
                  )}
                </section>
              )}
              {s.children.map((child: any) => (
                <button
                  key={child.id}
                  className="panel child-card"
                  onClick={() => {
                    setSubject(child.id);
                    setActiveModule('kids');
                    setState(null);
                    go('home');
                  }}
                >
                  <Mascot small />
                  <h2>{child.nickname || child.name}</h2>
                  <p>{child.pcm}</p>
                  <span className="button secondary">
                    Open child’s space
                    <ArrowRight size={16} />
                  </span>
                </button>
              ))}
            </div>
          )}
          {view === 'notifications' && (
            <section className="panel">
              <div className="section-heading">
                <h2>A little encouragement</h2>
                <button
                  className="text-button"
                  onClick={() => act({ action: 'readNotifications' })}
                >
                  Mark all read
                </button>
              </div>
              {s.notifications.length ? (
                s.notifications.map((n: any) => (
                  <div className="notification" key={n.id}>
                    <Heart size={20} />
                    <div>
                      <p>{n.message}</p>
                      <small className="muted">{new Date(n.created_at).toLocaleString()}</small>
                    </div>
                  </div>
                ))
              ) : (
                <Empty title="A quiet moment">
                  Encouragement from your linked peers will appear here.
                </Empty>
              )}
            </section>
          )}
          {view === 'settings' && (
            <div className="settings-grid">
              <Profile state={s} act={act} refresh={refresh} />
              <section className="panel">
                <h2>Make yourself comfortable</h2>
                <p className="muted">Choose the appearance that works for you.</p>
                <button className="button secondary" onClick={toggleTheme}>
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}Switch to{' '}
                  {theme === 'light' ? 'dark' : 'light'} mode
                </button>
                <h3 className="spaced">App installation</h3>
                <InstallControl />
                <h3 className="spaced">Your privacy</h3>
                <p className="muted">
                  Your personal notes stay private. Relevant entries are available only to assigned
                  reviewers. Sessions end after five minutes of inactivity.
                </p>
              </section>
            </div>
          )}
          {view === 'admin' && !s.admin && (
            <section className="panel">
              <h2>Auditor workspace</h2>
              <p className="muted">
                Your access is limited to assigned financial review. Member and church
                administration require Admin permission.
              </p>
              <button className="button primary" onClick={() => openModule('finance')}>
                Open StelliTithes
              </button>
            </section>
          )}
          {view === 'admin' && s.admin && (
            <>
              <div className="tabs">
                {['members', 'testing', 'import', 'groups', 'guardians', 'exceptions', 'audit'].map(
                  (t) => (
                    <button
                      key={t}
                      className={adminTab === t ? 'selected' : ''}
                      onClick={() => setAdminTab(t)}
                    >
                      {t === 'import' ? 'Roster import' : t[0].toUpperCase() + t.slice(1)}
                    </button>
                  ),
                )}
              </div>
              {adminTab === 'testing' && (
                <section className="panel">
                  <h2>Bulk temporary testing password</h2>
                  <p className="muted">
                    Set one temporary password for all{' '}
                    {
                      s.admin.members.filter(
                        (m: any) => m.pcm !== 'PCM0001' && !m.roles.includes('admin'),
                      ).length
                    }{' '}
                    non-admin members, including accounts pending activation. Every administrator
                    account is excluded.
                  </p>
                  <p>
                    Familiarity testing: November 15–18, 2026. Members can sign in normally with
                    this shared password. It stays in place until you manually end testing below.
                  </p>
                  <p>
                    This replaces their current passwords, signs them out, and cancels unused
                    activation codes. It does not erase their entries.
                  </p>
                  <SimpleForm
                    label="Set temporary password for all non-admin members"
                    onSubmit={async (d) => {
                      const result = await act({ ...d, action: 'bulkTestingPassword' });
                      setAdminTab('members');
                      return result;
                    }}
                  >
                    <label>
                      Temporary testing password
                      <input
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        maxLength={128}
                        required
                      />
                    </label>
                    <label className="check-label">
                      <input name="confirm" type="checkbox" value="yes" required />I understand this
                      replaces existing non-admin passwords. Admin passwords stay unchanged.
                    </label>
                  </SimpleForm>
                  <hr className="spaced" />
                  <h3>When familiarity testing is complete</h3>
                  <p>
                    Use this after November 18 when you are ready. All non-admin members will be
                    signed out. They sign in with their current testing password, then choose a
                    different personal password before opening their account.
                  </p>
                  <SimpleForm
                    label="End testing / require personal passwords"
                    onSubmit={async (d) => {
                      const result = await act({ ...d, action: 'bulkRequirePersonalPasswords' });
                      setAdminTab('members');
                      return result;
                    }}
                  >
                    <label className="check-label">
                      <input name="confirm" type="checkbox" value="yes" required />
                      Testing is complete. Require all non-admin members to choose their own
                      password.
                    </label>
                  </SimpleForm>
                </section>
              )}
              {adminTab === 'exceptions' && (
                <section className="panel">
                  <h2>Allow a period correction</h2>
                  <p className="muted">
                    Give one member 24 hours to enter or correct a closed spiritual activity period.
                    The reason is recorded in the audit trail.
                  </p>
                  <SimpleForm
                    label="Authorize exception"
                    onSubmit={(d) => act({ ...d, action: 'unlockPeriod' })}
                  >
                    <label>
                      Member
                      <select name="id">
                        {s.admin.members.map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.pcm} · {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Activity
                      <select name="habit">
                        {DAILY.concat(WEEKLY, MONTHLY).map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Period date
                      <input name="date" type="date" max={s.today} required />
                    </label>
                    <label>
                      Reason
                      <textarea name="reason" required />
                    </label>
                  </SimpleForm>
                </section>
              )}
              {adminTab === 'members' && (
                <>
                  <section className="panel">
                    <h2>Add a member</h2>
                    <SimpleForm
                      className="inline-form"
                      label="Create member"
                      onSubmit={(d) => act({ ...d, action: 'createMember' })}
                    >
                      <label>
                        Name
                        <input name="name" required />
                      </label>
                      <label>
                        Experience
                        <select name="tag">
                          <option>iStellify</option>
                          <option>StelliKids</option>
                        </select>
                      </label>
                    </SimpleForm>
                  </section>
                  <div className="table-wrap spaced">
                    <table>
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Experience</th>
                          <th>Status</th>
                          <th>Access</th>
                          <th>Account</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.admin.members.map((m: any) => (
                          <tr key={m.id}>
                            <td>
                              <strong>{m.name}</strong>
                              <small>{m.pcm}</small>
                            </td>
                            <td>{m.tag}</td>
                            <td>
                              {m.active ? 'Active' : 'Disabled'} ·{' '}
                              {m.activated ? 'Activated' : 'Pending activation'}
                            </td>
                            <td>
                              {m.roles.join(', ') || 'Member'}
                              {m.id !== u.id && (
                                <button
                                  className="text-button"
                                  onClick={() => setModal({ access: m })}
                                >
                                  Manage
                                </button>
                              )}
                            </td>
                            <td>
                              <button
                                className="text-button"
                                onClick={async () => {
                                  try {
                                    const r = await act({ action: 'reset', id: m.id });
                                    setActivation(r);
                                  } catch (e) {
                                    setToast((e as Error).message);
                                  }
                                }}
                              >
                                Issue activation code
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {adminTab === 'import' && <RosterGenderImport onComplete={refresh} />}
              {adminTab === 'import' && (
                <section className="panel">
                  <h2>Import the church roster</h2>
                  <p className="muted">
                    Upload your existing XLSX file. Preview every change before committing.
                    Passwords and private health data are excluded.
                  </p>
                  <label className="upload-field">
                    <Upload size={20} />
                    {busyImport ? 'Reading workbook…' : 'Choose roster workbook'}
                    <input
                      type="file"
                      accept=".xlsx"
                      disabled={busyImport}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setBusyImport(true);
                        try {
                          const f = new FormData();
                          f.set('file', file);
                          const r = await fetch('/api/import', { method: 'POST', body: f });
                          const b = await r.json();
                          if (!r.ok) throw new Error(b.error);
                          setPreview(b);
                        } catch (e) {
                          setToast((e as Error).message);
                        } finally {
                          setBusyImport(false);
                        }
                      }}
                    />
                  </label>
                  {preview && (
                    <>
                      <h3 className="spaced">{preview.members.length} member records found</h3>
                      {preview.errors.map((e: string) => (
                        <p className="error" key={e}>
                          {e}
                        </p>
                      ))}
                      {preview.warnings.map((e: string) => (
                        <p className="import-warning" key={e}>
                          {e}
                        </p>
                      ))}
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>PCM</th>
                              <th>Name</th>
                              <th>Experience</th>
                              <th>Groups and proposed roles</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.members.map((m: any) => (
                              <tr key={m.pcm}>
                                <td>{m.pcm}</td>
                                <td>{m.name}</td>
                                <td>{m.tag}</td>
                                <td>
                                  {m.groups
                                    .map((g: any) => `${g.kind} ${g.code} (${g.role})`)
                                    .join(', ')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <SimpleForm
                        label="Commit reviewed import"
                        onSubmit={async (d) => {
                          const r = await fetch('/api/import', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              id: preview.id,
                              grantRoles: d.grantRoles === 'on',
                            }),
                          });
                          const b = await r.json();
                          if (!r.ok) throw new Error(b.error);
                          setToast(b.message);
                          setPreview(null);
                          await refresh();
                        }}
                      >
                        <label className="check-card">
                          <input type="checkbox" name="grantRoles" />
                          <span>
                            I reviewed the proposed group leader and auditor permissions and
                            authorize those grants.
                          </span>
                        </label>
                        <label className="check-card">
                          <input type="checkbox" required />
                          <span>I reviewed these records and authorize this import.</span>
                        </label>
                      </SimpleForm>
                    </>
                  )}
                </section>
              )}
              {adminTab === 'groups' && (
                <>
                  <section className="panel">
                    <h2>Create a group</h2>
                    <SimpleForm
                      className="inline-form"
                      label="Create group"
                      onSubmit={(d) => act({ ...d, action: 'group' })}
                    >
                      <label>
                        Code
                        <input name="code" required placeholder="FCG007" />
                      </label>
                      <label>
                        Name
                        <input name="name" required />
                      </label>
                      <label>
                        Type
                        <select name="kind">
                          {['family', 'care', 'share', 'finance'].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                    </SimpleForm>
                  </section>
                  <section className="panel spaced">
                    <h2>Assign membership and role</h2>
                    <SimpleForm
                      className="inline-form"
                      onSubmit={(d) => act({ ...d, action: 'membership' })}
                    >
                      <label>
                        Member
                        <select name="id">
                          {s.admin.members.map((m: any) => (
                            <option key={m.id} value={m.id}>
                              {m.pcm} · {m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Group
                        <select name="group">
                          {s.admin.groups.map((g: any) => (
                            <option key={g.id} value={g.id}>
                              {g.name} · {g.kind}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Role
                        <select name="role">
                          {['member', 'leader', 'servant', 'captain', 'auditor'].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                    </SimpleForm>
                  </section>
                  <div className="table-wrap spaced">
                    <table>
                      <thead>
                        <tr>
                          <th>Group</th>
                          <th>Member</th>
                          <th>Roles</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {s.admin.memberships.map((m: any) => (
                          <tr key={m.member_id + m.group_id}>
                            <td>{s.admin.groups.find((g: any) => g.id === m.group_id)?.name}</td>
                            <td>{s.admin.members.find((u: any) => u.id === m.member_id)?.name}</td>
                            <td>{m.roles.join(', ')}</td>
                            <td>
                              <button
                                className="text-button"
                                onClick={() =>
                                  act({
                                    action: 'removeMembership',
                                    id: m.member_id,
                                    group: m.group_id,
                                  }).catch((e) => setToast(e.message))
                                }
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {adminTab === 'guardians' && (
                <section className="panel">
                  <h2>Link a guardian and child</h2>
                  <p className="muted">
                    A family group assignment alone does not grant guardian access. Confirm consent
                    with the guardian before linking.
                  </p>
                  <SimpleForm
                    onSubmit={(d) => act({ ...d, action: 'guardian', consent: d.consent === 'on' })}
                  >
                    <label>
                      Guardian
                      <select name="guardian">
                        {s.admin.members
                          .filter((m: any) => m.tag !== 'StelliKids')
                          .map((m: any) => (
                            <option key={m.id} value={m.id}>
                              {m.name} · {m.pcm}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Child
                      <select name="child">
                        {s.admin.members
                          .filter((m: any) => m.tag === 'StelliKids')
                          .map((m: any) => (
                            <option key={m.id} value={m.id}>
                              {m.name} · {m.pcm}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="check-card">
                      <input name="consent" type="checkbox" required />
                      <span>
                        The guardian has consented to assisted logging and access for this child.
                      </span>
                    </label>
                  </SimpleForm>
                </section>
              )}
              {adminTab === 'guardians' && s.admin.guardians.length > 0 && (
                <div className="table-wrap spaced">
                  <table>
                    <thead>
                      <tr>
                        <th>Guardian</th>
                        <th>Child</th>
                        <th>Access</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.admin.guardians.map((g: any) => (
                        <tr key={g.guardian_id + g.child_id}>
                          <td>{s.admin.members.find((m: any) => m.id === g.guardian_id)?.name}</td>
                          <td>{s.admin.members.find((m: any) => m.id === g.child_id)?.name}</td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() =>
                                act({
                                  action: 'removeGuardian',
                                  guardian: g.guardian_id,
                                  child: g.child_id,
                                }).catch((e) => setToast(e.message))
                              }
                            >
                              Revoke access
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {adminTab === 'audit' && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Actor</th>
                        <th>Action</th>
                        <th>Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.admin.audit.map((a: any, i: number) => (
                        <tr key={i}>
                          <td>{new Date(a.created_at).toLocaleString()}</td>
                          <td>{a.pcm}</td>
                          <td>{a.action}</td>
                          <td className="truncate">{a.target}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {['admin', 'care', 'share'].includes(moduleId) &&
            view !== 'review' &&
            u.roles.some((r: string) => ['admin', 'pastor', 'servant', 'captain'].includes(r)) && (
              <UnlockQueue state={s} act={act} />
            )}
          {(['light', 'groups', 'review'].includes(view) ||
            (['care', 'share'].includes(moduleId) && view === 'ministry')) && (
            <NudgePanel state={s} act={act} />
          )}
          <footer className="content-footer">
            <span>iStellify · Precious Church</span>
            <span>One small step. Every day.</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button aria-label="Dismiss" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
      <StelliCompanion
        name={u.nickname || u.name.split(' ')[0]}
        kids={u.tag === 'StelliKids'}
        mood={resolveMascotMood(
          Math.floor(clock.minutes / 60),
          progressDay === clock.day && s.dailyProgress.hasCompletedHabitsToday,
        )}
      />
      {modal?.habit &&
        (DAILY.includes(modal.habit) || s.commitments.some((c: any) => c.id === modal.habit)) && (
          <WeeklyCard
            {...modal}
            date={activeDate}
            state={s}
            act={act}
            onClose={() => setModal(null)}
            onSaved={() => {}}
          />
        )}
      {modal?.habit &&
        !DAILY.includes(modal.habit) &&
        !s.commitments.some((c: any) => c.id === modal.habit) && (
          <HabitForm
            {...modal}
            date={activeDate}
            subject={s.subject.id}
            question={s.question}
            state={s}
            act={act}
            onClose={() => setModal(null)}
            onSaved={() => setModal(null)}
          />
        )}
      {reviewing && (
        <div className="modal-backdrop" onClick={() => setReviewing(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Review entry"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <div>
                <span className="eyebrow">STELLICHECK</span>
                <h2>
                  {reviewing.habit} · {reviewing.nickname || reviewing.name}
                </h2>
                <p className="muted">
                  {reviewing.period} · Revision {reviewing.version}
                </p>
              </div>
              <button className="icon-button" aria-label="Close" onClick={() => setReviewing(null)}>
                <X />
              </button>
            </header>
            <EntryDetails log={reviewing} />
            {reviewing.data.attachmentId && (
              <a
                href={'/api/attachments?id=' + reviewing.data.attachmentId + '&preview=true'}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  style={{ maxWidth: 250, maxHeight: 220, objectFit: 'contain' }}
                  src={'/api/attachments?id=' + reviewing.data.attachmentId + '&preview=true'}
                  alt="Handwritten notes preview"
                />
              </a>
            )}
            {reviewing.status === 'pending' &&
            (reviewOpen(
              reviewing.habit,
              reviewing.period,
              new Date(),
              reviewing.timezone || s.timezone,
            ) ||
              Date.parse(reviewing.grace_expires_at || '') > Date.now()) ? (
              <SimpleForm
                label="Save review"
                onSubmit={async (d) => {
                  await act({
                    ...d,
                    action: 'review',
                    id: reviewing.id,
                    version: reviewing.version,
                  });
                  setReviewing(null);
                }}
              >
                <label>
                  Decision
                  <select name="decision">
                    <option value="confirmed">Confirm</option>
                    <option value="flagged">Flag for correction</option>
                  </select>
                </label>
                {reviewing.habit === 'iTithes' && (
                  <label>
                    Actual amount received (PHP)
                    <input
                      type="number"
                      step="0.01"
                      name="received"
                      min="0"
                      required
                      defaultValue={(reviewing.data.amounts.net / 100).toFixed(2)}
                    />
                  </label>
                )}
                <label>
                  Comment or reason
                  <textarea name="reason" placeholder="Required when flagging an entry" />
                </label>
              </SimpleForm>
            ) : (
              <Badge status={reviewing.status} />
            )}
          </section>
        </div>
      )}
      {activation && (
        <div className="modal-backdrop">
          <section
            className="modal compact"
            role="dialog"
            aria-modal="true"
            aria-label="Account activation code"
          >
            <h2>Private activation code</h2>
            <p>
              For {activation.pcm}. Deliver this directly to the member. It expires in 24 hours and
              works only once.
            </p>
            <textarea
              readOnly
              value={activation.activationToken}
              aria-label="Activation code"
              onFocus={(e) => e.target.select()}
            />
            <button className="button primary" onClick={() => setActivation(null)}>
              I’ve saved the code privately
            </button>
          </section>
        </div>
      )}
      {modal?.access && (
        <div className="modal-backdrop">
          <section
            className="modal compact"
            role="dialog"
            aria-modal="true"
            aria-label="Manage account access"
          >
            <h2>Access for {modal.access.pcm}</h2>
            <SimpleForm
              onSubmit={async (d) => {
                await act({
                  action: 'memberAccess',
                  id: modal.access.id,
                  active: d.active === 'on',
                  tag: d.tag,
                  spiritualState: d.spiritualState,
                  roles: [
                    ...(d.admin === 'on' ? ['admin'] : []),
                    ...(d.pastor === 'on' ? ['pastor'] : []),
                  ],
                });
                setModal(null);
              }}
            >
              <label>
                StelliTag
                <select name="tag" defaultValue={modal.access.tag}>
                  <option>iStellify</option>
                  <option>StelliKids</option>
                </select>
              </label>
              <label>
                StelliState
                <select name="spiritualState" defaultValue={modal.access.spiritual_state || 'SBG'}>
                  <option>SBG</option>
                  <option>sP2S</option>
                  <option>P2S</option>
                  <option>AOS</option>
                </select>
              </label>
              <label className="check-card">
                <input name="active" type="checkbox" defaultChecked={modal.access.active} />
                Account active
              </label>
              <label className="check-card">
                <input
                  name="admin"
                  type="checkbox"
                  defaultChecked={modal.access.roles.includes('admin')}
                />
                Administrator
              </label>
              {modal.access.pcm === 'PCM0002' && (
                <label className="check-card">
                  <input
                    name="pastor"
                    type="checkbox"
                    defaultChecked={modal.access.roles.includes('pastor')}
                  />
                  Pastor
                </label>
              )}
            </SimpleForm>
            <button className="text-button" onClick={() => setModal(null)}>
              Cancel
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function GroupPanels({
  peers,
  onNudge,
  expanded = false,
}: {
  peers: any[];
  onNudge: (id: string) => Promise<any>;
  expanded?: boolean;
}) {
  const [message, setMessage] = useState('');
  const groups = [
    ...new Map(peers.map((p: any) => [p.group_id, { name: p.group_name, kind: p.kind }])).entries(),
  ];
  if (!groups.length)
    return (
      <Empty title="Your community is taking shape">
        Your administrator will link you to your family, Care Group and Sharing Huddle.
      </Empty>
    );
  return (
    <>
      <div className="group-panels">
        {groups.slice(0, expanded ? 100 : 3).map(([id, g]) => (
          <section className="panel" key={id}>
            <span className="eyebrow">
              {g.kind === 'family'
                ? 'STELLIFAM'
                : g.kind === 'care'
                  ? 'STELLICARE'
                  : g.kind === 'share'
                    ? 'STELLISHARE'
                    : 'FINANCE GROUP'}
            </span>
            <h3>{g.name}</h3>
            {peers
              .filter((p) => p.group_id === id)
              .slice(0, expanded ? 100 : 3)
              .map((p) => (
                <div className="peer" key={p.id}>
                  <span className="avatar soft">{(p.nickname || p.name)[0]}</span>
                  <div>
                    <strong>{p.nickname || p.name}</strong>
                    <small>
                      {p.daily_count >= 2
                        ? 'Daily activities submitted'
                        : `${p.daily_count}/2 daily activities submitted`}
                    </small>
                  </div>
                  {p.daily_count < 2 ? (
                    <button
                      title="Send encouragement"
                      aria-label={'Encourage ' + p.name}
                      className="nudge"
                      onClick={async () => {
                        try {
                          await onNudge(p.id);
                          setMessage('Encouragement sent.');
                        } catch (e) {
                          setMessage((e as Error).message);
                        }
                      }}
                    >
                      <Heart size={15} />
                    </button>
                  ) : (
                    <CheckCheck size={18} className="green" />
                  )}
                </div>
              ))}
          </section>
        ))}
      </div>
      {message && (
        <p role="status" className="fine-print">
          {message}
        </p>
      )}
    </>
  );
}
function EntryDetails({ log }: { log: any }) {
  const d = log.data;
  return (
    <div className="entry-details">
      {Object.entries(d)
        .filter(([k]) => !['amounts', 'attachmentId'].includes(k))
        .map(([k, v]) => (
          <div key={k}>
            <span>{k.replace(/([A-Z])/g, ' $1')}</span>
            <p>
              {typeof v === 'boolean'
                ? v
                  ? 'Complete'
                  : 'Incomplete'
                : typeof v === 'object'
                  ? JSON.stringify(v)
                  : String(v)}
            </p>
          </div>
        ))}
      {d.amounts && (
        <div className="amount-breakdown">
          {Object.entries(d.amounts).map(([k, v]) => (
            <div key={k}>
              <span>{k}</span>
              <strong>{money(v as number)}</strong>
            </div>
          ))}
        </div>
      )}
      {log.attachment_drive_url && (
        <a className="text-button" href={log.attachment_drive_url} target="_blank" rel="noreferrer">
          Open notes in church Google Drive
        </a>
      )}
      {d.attachmentId && (
        <a className="button secondary" href={'/api/attachments?id=' + d.attachmentId}>
          <Download size={17} />
          Download attached notes
        </a>
      )}
    </div>
  );
}
function FinanceTable({ logs, onReview }: { logs: any[]; onReview: (l: any) => void }) {
  const declared = logs.reduce((a, l) => a + l.data.amounts.net, 0),
    verified = logs
      .filter((l) => l.status === 'confirmed')
      .reduce((a, l) => a + l.data.amounts.net, 0);
  function download() {
    const safe = (v: unknown) =>
      '"' +
      String(v)
        .replace(/^[=+@-]/, "'")
        .replaceAll('"', '""') +
      '"';
    const csv = [
      [
        'PCM',
        'Name',
        'Period',
        'Status',
        'Gift PHP',
        'Offering PHP',
        'Tithes PHP',
        'BOB PHP',
        'Net PHP',
      ],
      ...logs.map((l) => [
        l.pcm,
        l.name,
        l.period,
        l.status,
        ...['gift', 'offering', 'tithes', 'bob', 'net'].map((k) =>
          (l.data.amounts[k] / 100).toFixed(2),
        ),
      ]),
    ]
      .map((row) => row.map(safe).join(','))
      .join('\r\n');
    const a = document.createElement('a'),
      url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.href = url;
    a.download = 'istellify-finance.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="panel spaced">
      <div className="section-heading">
        <div>
          <h2>Authorized financial records</h2>
          <p className="muted">
            Declared {money(declared)} · Verified {money(verified)} · {logs.length} records
          </p>
        </div>
        <button className="button secondary" onClick={download}>
          <Download size={16} />
          Export CSV
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Period</th>
              <th>Declared net</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.name}
                  <small>{l.pcm}</small>
                </td>
                <td>{l.period}</td>
                <td>{money(l.data.amounts.net)}</td>
                <td>
                  <Badge status={l.status} />
                </td>
                <td>
                  <button className="text-button" onClick={() => onReview(l)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
