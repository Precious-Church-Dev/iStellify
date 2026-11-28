'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { STELLI_MOODS, appIconFilename, type StelliMood } from '@/lib/stelli-mascot';
import Mascot from './Mascot';

const GREETING_DURATION = 5500;
const MESSAGE_DURATION = 8500;

export default function StelliCompanion({
  name,
  mood,
  kids,
}: {
  name: string;
  mood: StelliMood;
  kids: boolean;
}) {
  const [greeting, setGreeting] = useState(false);
  const [open, setOpen] = useState(mood !== 'happy');
  const previousMood = useRef(mood);
  const talking = greeting || open;

  useEffect(() => {
    if (sessionStorage.getItem('istelli-greeting-pending') !== 'yes') return;
    sessionStorage.removeItem('istelli-greeting-pending');
    setOpen(false);
    setGreeting(true);
  }, []);

  useEffect(() => {
    const icon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) return;
    icon.href = '/assets/icons/' + appIconFilename(mood);
    return () => {
      icon.href = '/assets/icons/' + appIconFilename('happy');
    };
  }, [mood]);

  useEffect(() => {
    if (previousMood.current === mood) return;
    previousMood.current = mood;
    setOpen(!greeting && mood !== 'happy');
  }, [mood, greeting]);

  useEffect(() => {
    if (!talking) return;
    const dismiss = () => {
      setGreeting(false);
      setOpen(false);
    };
    const timeout = window.setTimeout(dismiss, greeting ? GREETING_DURATION : MESSAGE_DURATION);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', onEscape);
    };
  }, [talking, greeting]);

  const appName = kids ? 'StelliKids' : 'iStellify';
  const speech = greeting
    ? `Hi, ${name}! Welcome to ${appName}.`
    : kids && mood === 'happy'
      ? 'Welcome to StelliKids'
      : STELLI_MOODS[mood].message;

  return (
    <div
      className={
        'stelli-companion ' + (greeting ? 'is-welcoming' : open ? 'is-speaking' : 'is-docked')
      }
    >
      {talking && (
        <div className="stelli-speech">
          <strong role="status">{speech}</strong>
          <button
            aria-label={greeting ? 'Dismiss Stelli greeting' : 'Dismiss Stelli message'}
            className="stelli-dismiss"
            onClick={() => {
              setGreeting(false);
              setOpen(false);
            }}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <button
        className="stelli-character"
        onClick={() => {
          if (greeting) setGreeting(false);
          else setOpen(!open);
        }}
        aria-label="Stelli the Bot"
        aria-expanded={talking}
      >
        <Mascot mood={greeting ? 'happy' : mood} />
      </button>
    </div>
  );
}
