'use client';
import { useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck, Star } from 'lucide-react';
import Mascot from './Mascot';
import Brand from './Brand';
export default function Login({ needsSetup }: { needsSetup: boolean }) {
  const [mode, setMode] = useState(needsSetup ? 'setup' : 'login'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, action: mode }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      if (mode === 'login') location.reload();
      else {
        setMode('login');
        setNotice(b.message);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-story">
        <Brand />
        <div className="login-copy">
          <span className="eyebrow light">PRECIOUS CHURCH</span>
          <h1>
            Small steps.
            <br />A brighter journey.
          </h1>
          <p>
            Make time for what matters. Grow in faith, build meaningful habits, and encourage one
            another.
          </p>
          <div className="login-illustration">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <Mascot />
            <span className="floating-star one">✦</span>
            <span className="floating-star two">✧</span>
          </div>
        </div>
        <div className="login-footer">
          <Star size={14} /> Growing together, one day at a time.
        </div>
      </section>
      <section className="login-panel">
        <div className="login-form">
          <span className="eyebrow">YOUR GROWTH STARTS HERE</span>
          <h2>
            {mode === 'setup'
              ? 'Set up your church'
              : mode === 'activate'
                ? 'Activate your account'
                : 'Welcome back'}
          </h2>
          <p className="muted">
            {mode === 'setup'
              ? 'Create the first administrator using the setup key in your Render environment.'
              : mode === 'activate'
                ? 'Use the private activation code supplied by your church administrator.'
                : 'Sign in to continue your iStellify journey.'}
          </p>
          <form onSubmit={submit}>
            {mode === 'setup' && (
              <>
                <label>
                  Your name
                  <input name="name" required autoComplete="name" />
                </label>
                <label>
                  Setup key
                  <input name="secret" type="password" required autoComplete="off" />
                </label>
              </>
            )}
            {mode === 'login' && (
              <label>
                Church number
                <input
                  name="pcm"
                  placeholder="PCM0003"
                  pattern="[Pp][Cc][Mm][0-9]{4}"
                  maxLength={7}
                  autoComplete="username"
                  required
                />
              </label>
            )}
            {mode === 'activate' && (
              <label>
                Activation code
                <input name="token" required autoComplete="off" />
              </label>
            )}
            <label>
              {mode === 'login' ? 'Password' : 'Choose a password'}
              <input
                name="password"
                type="password"
                minLength={mode === 'login' ? 1 : 12}
                maxLength={128}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </label>
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
            <button className="button primary full" disabled={busy}>
              {busy
                ? 'Please wait…'
                : mode === 'setup'
                  ? 'Create administrator'
                  : mode === 'activate'
                    ? 'Set password'
                    : 'Sign in'}
              <ArrowRight size={17} />
            </button>
          </form>
          {!needsSetup && (
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === 'login' ? 'activate' : 'login');
                setError('');
              }}
            >
              {mode === 'login'
                ? 'First time here? Activate your account'
                : 'Already activated? Sign in'}
            </button>
          )}
          <div className="privacy-note">
            <ShieldCheck size={19} />
            <span>
              A private space for your church community.
              <br />
              Sessions end after 5 minutes of inactivity.
            </span>
          </div>
          <p className="fine-print">Need help signing in? Contact your church administrator.</p>
        </div>
      </section>
    </main>
  );
}
