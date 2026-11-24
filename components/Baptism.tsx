'use client';
import { useState } from 'react';
export default function Baptism({ state, act }: { state: any; act: (b: any) => Promise<any> }) {
  const b = state.baptism;
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel faith-section">
      <span className="eyebrow">STELLICLEANSE</span>
      <h2>Your baptism milestone</h2>
      {b ? (
        <>
          <h3>
            {b.baptism_date} · {b.location}
          </h3>
          <p>Officiating minister: {b.minister}</p>
          {b.certificate_url && (
            <a
              className="button secondary"
              href={b.certificate_url}
              target="_blank"
              rel="noreferrer"
            >
              Open signed baptism certificate
            </a>
          )}
          <div className="event-gallery spaced">
            {b.photos.map((url: string, i: number) => (
              <a href={url} key={i} target="_blank" rel="noreferrer">
                Baptism photo {i + 1}
              </a>
            ))}
          </div>
        </>
      ) : (
        <p className="muted">
          Your administrator can record your baptism and attach the church-issued signed certificate
          and gallery.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {state.user.roles.includes('admin') && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const d = Object.fromEntries(new FormData(e.currentTarget));
              await act({
                action: 'baptism',
                ...d,
                photos: String(d.photoUrls || '')
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean),
              });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>Record a verified baptism</h3>
          <label>
            Member
            <select name="member" defaultValue={state.subject.id}>
              {state.admin.members.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.pcm} · {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Baptism date
            <input
              name="date"
              type="date"
              required
              max={state.today}
              defaultValue={b?.baptism_date}
            />
          </label>
          <label>
            Location
            <input name="location" required maxLength={200} defaultValue={b?.location} />
          </label>
          <label>
            Officiating minister
            <input name="minister" required maxLength={100} defaultValue={b?.minister} />
          </label>
          <label>
            Signed certificate · Google Drive URL
            <input name="certificateUrl" type="url" defaultValue={b?.certificate_url} />
          </label>
          <label>
            Photo gallery · Google Drive URLs, one per line
            <textarea name="photoUrls" defaultValue={b?.photos?.join('\n')} />
          </label>
          <button className="button primary" disabled={busy}>
            Save baptism record
          </button>
        </form>
      )}
    </section>
  );
}
