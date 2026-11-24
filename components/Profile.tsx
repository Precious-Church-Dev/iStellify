'use client';
import { useState } from 'react';
export default function Profile({ state, act }: { state: any; act: (b: any) => Promise<any> }) {
  const p = state.profile;
  const [image, setImage] = useState(''),
    [zoom, setZoom] = useState(1),
    [x, setX] = useState(50),
    [y, setY] = useState(50),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function photo() {
    setBusy(true);
    setError('');
    try {
      const img = new Image();
      img.src = image;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 512;
      const side = Math.min(img.naturalWidth, img.naturalHeight) / zoom;
      canvas
        .getContext('2d')!
        .drawImage(
          img,
          ((img.naturalWidth - side) * x) / 100,
          ((img.naturalHeight - side) * y) / 100,
          side,
          side,
          0,
          0,
          512,
          512,
        );
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) throw Error('Unable to crop photo.');
      const form = new FormData();
      form.set('file', new File([blob], 'profile.jpg', { type: 'image/jpeg' }));
      const r = await fetch('/api/media', { method: 'POST', body: form });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      setImage('');
      await act({ action: 'readNotifications' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Your profile</h2>
      <div className="profile-picture">
        <img
          src={
            p.has_avatar
              ? '/api/media?kind=avatar&v=' + state.serverNow
              : '/assets/mascot/stelli_happy.png'
          }
          alt="Your profile"
        />
      </div>
      <label>
        Profile image · JPEG/PNG · up to 5 MB
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!['image/jpeg', 'image/png'].includes(file.type)) {
              setError('Choose a JPEG or PNG image.');
              return;
            }
            if (file.size > 5 * 1024 * 1024) {
              setError('Choose an image under 5 MB.');
              return;
            }
            const r = new FileReader();
            r.onload = () => {
              setImage(String(r.result));
              setZoom(1);
              setX(50);
              setY(50);
            };
            r.readAsDataURL(file);
          }}
        />
      </label>
      {image && (
        <div className="photo-crop">
          <div className="crop-preview">
            <img
              src={image}
              style={{
                objectPosition: `${x}% ${y}%`,
                transform: `scale(${zoom})`,
                transformOrigin: `${x}% ${y}%`,
              }}
              alt="Crop preview"
            />
          </div>
          <label>
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <label>
            Horizontal centering
            <input
              type="range"
              min={0}
              max={100}
              value={x}
              onChange={(e) => setX(Number(e.target.value))}
            />
          </label>
          <label>
            Vertical centering
            <input
              type="range"
              min={0}
              max={100}
              value={y}
              onChange={(e) => setY(Number(e.target.value))}
            />
          </label>
          <button className="button secondary" disabled={busy} onClick={photo}>
            Save cropped photo
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await act({ action: 'profile', ...Object.fromEntries(new FormData(e.currentTarget)) });
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Full name
          <input name="name" required maxLength={100} defaultValue={p.name} />
        </label>
        <label>
          Preferred nickname
          <input name="nickname" maxLength={50} defaultValue={p.nickname} />
        </label>
        <label>
          Personal bio / faith testimony
          <textarea name="bio" maxLength={250} defaultValue={p.bio} />
        </label>
        <label>
          Contact number
          <input name="phone" type="tel" maxLength={25} defaultValue={p.phone} />
        </label>
        <label>
          Email address{p.google_linked ? ' · Google linked' : ''}
          <input
            name="email"
            type="email"
            readOnly={p.google_linked}
            defaultValue={p.email || ''}
          />
        </label>
        <label>
          Birthdate
          <input name="birthdate" type="date" max={state.today} defaultValue={p.birthdate || ''} />
        </label>
        <label>
          Your timezone
          <input name="timezone" required defaultValue={p.timezone} list="timezones" />
          <datalist id="timezones">
            {[
              'Asia/Manila',
              'Asia/Bangkok',
              'Asia/Singapore',
              'Asia/Tokyo',
              'Europe/London',
              'America/New_York',
              'America/Los_Angeles',
              'Australia/Sydney',
            ].map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </label>
        <p className="fine-print">Card submission windows use your saved timezone.</p>
        <button className="button primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </section>
  );
}
