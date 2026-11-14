'use client';
import { useState } from 'react';
import Brand from './Brand';
export default function ChangeTemporaryPassword({ pcm }: { pcm: string }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const data = new FormData(e.currentTarget);
    if (data.get('password') !== data.get('confirm')) {
      setError('The two passwords must match.');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'changeTemporaryPassword', password: data.get('password') }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      sessionStorage.setItem('istelli-greeting-pending', 'yes');
      location.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="connection-screen">
      <div className="panel" style={{ width: 'min(460px, 100%)', textAlign: 'left' }}>
        <Brand />
        <h1>Choose your own password</h1>
        <p className="muted">
          {pcm} · You signed in with a temporary testing password. Choose a different password
          before opening your account.
        </p>
        <form onSubmit={submit}>
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save password and continue'}
          </button>
        </form>
        <button
          className="text-button spaced"
          onClick={async () => {
            await fetch('/api/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'logout' }),
            });
            location.reload();
          }}
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
