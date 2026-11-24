'use client';
import { useEffect, useRef, useState } from 'react';
import Mascot from './Mascot';
import { X, Sparkles } from 'lucide-react';
type Face = 'smile' | 'welcome' | 'wave' | 'cheer';
export default function StelliCompanion({
  memberId,
  name,
  kids,
  celebration,
  completed,
}: {
  memberId: string;
  name: string;
  kids: boolean;
  celebration: number;
  completed: boolean;
}) {
  const [open, setOpen] = useState(false),
    [face, setFace] = useState<Face>('smile'),
    [message, setMessage] = useState(''),
    [motion, setMotion] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    lastCelebration = useRef(celebration),
    shouldGreet = useRef<boolean | null>(null);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  function greet() {
    clear();
    setMessage(`Hi, ${name}! Welcome to ${kids ? 'StelliKids' : 'iStellify'}.`);
    setFace('smile');
    setOpen(true);
    timers.current.push(
      setTimeout(() => setFace('welcome'), 1400),
      setTimeout(() => setFace('wave'), 3900),
      setTimeout(() => setOpen(false), 8500),
    );
  }
  useEffect(() => {
    setMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (shouldGreet.current === null) {
      shouldGreet.current =
        sessionStorage.getItem('istelli-greeting-pending') === 'yes' ||
        sessionStorage.getItem('istelli-greeted-member') !== memberId;
      sessionStorage.removeItem('istelli-greeting-pending');
      sessionStorage.setItem('istelli-greeted-member', memberId);
    }
    if (shouldGreet.current) greet();
    return clear;
  }, []);
  useEffect(() => {
    if (celebration === lastCelebration.current) return;
    lastCelebration.current = celebration;
    clear();
    setFace('cheer');
    setMessage('Well done! You made time for your growth today.');
    setOpen(true);
    timers.current.push(
      setTimeout(() => setFace('smile'), 2500),
      setTimeout(() => setOpen(false), 6000),
    );
  }, [celebration]);
  return (
    <div
      className={
        'stelli-companion ' +
        (open ? 'is-greeting' : 'is-docked') +
        (motion ? ' reduce-motion' : '')
      }
    >
      {open && (
        <div className="stelli-speech" role="status" aria-live="polite">
          <span className="eyebrow">{kids ? 'SKIDISTAT' : 'STELLISTAT'}</span>
          <strong>{message}</strong>
          <p>
            {face === 'cheer'
              ? 'Every step counts. Keep it up!'
              : 'I’m Stelli. Let’s make a little room for growth.'}
          </p>
          <button
            aria-label="Dismiss Stelli greeting"
            className="stelli-dismiss"
            onClick={() => {
              clear();
              setOpen(false);
            }}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <button
        className="stelli-character"
        onClick={greet}
        aria-label={open ? 'Replay Stelli greeting' : 'Open Stelli greeting'}
      >
        <Mascot completed={completed} />
        {open && (
          <span className={'stelli-screen face-' + face} aria-hidden="true">
            {face === 'welcome' ? (
              <span className="screen-word">WELCOME</span>
            ) : face === 'cheer' ? (
              <span className="screen-word">
                GOOD
                <br />
                JOB!
              </span>
            ) : (
              <svg viewBox="0 0 120 74">
                <path className="bot-eyes" d="M18 28 Q29 9 40 28 M80 28 Q91 9 102 28" />
                <path className="bot-smile" d="M44 48 Q60 64 77 48" />
                <circle cx="17" cy="44" r="3" />
                <circle cx="104" cy="44" r="3" />
              </svg>
            )}
          </span>
        )}
      </button>
      {!open && (
        <span className="stelli-dock-label">
          Stelli <Sparkles size={11} />
        </span>
      )}
    </div>
  );
}
