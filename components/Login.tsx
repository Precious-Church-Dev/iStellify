'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck, Star } from 'lucide-react';
import Mascot from './Mascot';
import Brand from './Brand';
export default function Login({ needsSetup }: { needsSetup: boolean }) {
  const [mode, setMode] = useState(needsSetup ? 'setup' : 'login'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),[resetToken,setResetToken]=useState('');
  useEffect(()=>{const p=new URLSearchParams(location.search);const reset=p.get('reset');if(reset){setResetToken(reset);setMode('resetPassword');history.replaceState(null,'','/')}const err=p.get('authError');if(err)setError(err==='unregistered'?'This Google email is not linked to a unique registered member. Sign in with your Church Number or contact your administrator.':err==='google_unavailable'?'Google sign-in has not been configured yet. Please use your Church Number.':'Google sign-in could not be completed. Please try your Church Number.');},[]);
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
        body: JSON.stringify({ ...data, token:mode==='resetPassword'?resetToken:data.token, action: mode }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      if (mode === 'login') {
        sessionStorage.setItem('istelli-greeting-pending', 'yes');
        location.reload();
      } else {
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
          <span className="eyebrow light">JESUS THE MOST PRECIOUS NAME CHURCH<br/>CHURCH MINISTERIAL PROGRAM</span>
          <h1 className="scripture-hero">“so that you may become <em>blameless and pure,</em> ‘children of God without fault in a warped and crooked generation.’ Then you will <em>shine among them like stars in the sky</em>”</h1>
          <p className="scripture-reference">Philippians 2:15 (NIV)</p>
          <p className="program-footnote">iStellify is both life and computer program (app) which allows member of the Precious Church to shine like stars, for the glory of our God.</p>
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
            {mode === 'requestReset' ? 'Reset your password' : mode === 'resetPassword' ? 'Choose a new password' : mode === 'setup'
              ? 'Set up your church'
              : mode === 'activate'
                ? 'Activate your account'
                : 'Welcome back'}
          </h2>
          <p className="muted">
            {mode === 'requestReset' ? 'Enter your registered email or Church Number. A reset link will be sent to the registered email.' : mode === 'resetPassword' ? 'Use a unique password of at least 12 characters.' : mode === 'setup'
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
                  placeholder="PCM1234"
                  pattern="[Pp][Cc][Mm][0-9]{4}"
                  maxLength={7}
                  autoComplete="username"
                  required
                />
                <small className="muted">Precious Church Number, PCM, followed by the 4 digits</small>
              </label>
            )}
            {mode === 'activate' && (
              <label>
                Activation code
                <input name="token" required autoComplete="off" />
              </label>
            )}
            {mode==='requestReset'&&<label>Registered email or Church Number<input name="identity" required autoComplete="username"/></label>}
            {mode!=='requestReset' && <label>
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
            }
            {mode==='login'&&<button className="text-button reset-link" type="button" onClick={()=>{setMode('requestReset');setError('')}}>Forgot password? / Reset Password</button>}
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
                : mode === 'requestReset' ? 'Send reset link' : mode === 'resetPassword' ? 'Reset password' : mode === 'setup'
                  ? 'Create administrator'
                  : mode === 'activate'
                    ? 'Set password'
                    : 'Sign in'}
              <ArrowRight size={17} />
            </button>
          </form>
          {mode==='login'&&<a className="button secondary full google-signin" href="/api/auth/google"><span className="google-g" aria-hidden="true">G</span>Sign in with Google</a>}
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
          <p className="fine-print">Need help signing in? Contact your administrator or email <a href="mailto:info@preciouschurch.com">info@preciouschurch.com</a></p>
        </div>
      </section>
    </main>
  );
}
