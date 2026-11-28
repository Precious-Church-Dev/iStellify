'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { STELLI_MOODS, appIconFilename, type StelliMood } from '@/lib/stelli-mascot';
import Mascot from './Mascot';

export default function StelliCompanion({ mood, kids }: { mood: StelliMood; kids: boolean }) {
  const [open, setOpen] = useState(mood !== 'happy');
  const previousMood = useRef(mood);
  const speech = STELLI_MOODS[mood].message;

  useEffect(() => {
    if (!kids) return;
    if (sessionStorage.getItem('istelli-greeting-pending') === 'yes') {
      setOpen(true);
      sessionStorage.removeItem('istelli-greeting-pending');
    }
  }, [kids]);

  useEffect(() => {
    const icon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) return;
    icon.href = '/assets/icons/' + appIconFilename(mood);
    return () => {
      icon.href = '/assets/icons/' + appIconFilename('happy');
    };
  }, [mood]);

  useEffect(() => {
    if (previousMood.current !== mood) {
      previousMood.current = mood;
      setOpen(mood !== 'happy');
    }
  }, [mood]);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => setOpen(false), 8500);
    return () => window.clearTimeout(timeout);
  }, [open, mood]);

  return (
    <div className={'stelli-companion ' + (open ? 'is-speaking' : 'is-docked')}>
      {open && (
        <div className="stelli-speech">
          <strong role="status">
            {kids && mood === 'happy' ? 'Welcome to StelliKids' : speech}
          </strong>
          <button
            aria-label="Dismiss Stelli message"
            className="stelli-dismiss"
            onClick={() => setOpen(false)}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <button
        className="stelli-character"
        onClick={() => setOpen(!open)}
        aria-label="Stelli the Bot"
        aria-expanded={open}
      >
        <Mascot mood={mood} />
      </button>
    </div>
  );
}
