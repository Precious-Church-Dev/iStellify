'use client';
import { useEffect, useState } from 'react';
import { mood } from '@/lib/cards';
export default function Mascot({
  small = false,
  completed = false,
}: {
  small?: boolean;
  completed?: boolean;
}) {
  const [state, setState] = useState<'happy' | 'sad' | 'disappointed'>('happy');
  useEffect(() => {
    const update = () => setState(mood(new Date().getHours(), completed));
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, [completed]);
  return (
    <span className={'mood-mascot mood-' + state + (small ? ' small' : '')}>
      <img
        className={small ? 'mascot official-mascot small' : 'mascot official-mascot'}
        src={'/assets/mascot/stelli_' + state + '.svg'}
        alt={'Stelli feeling ' + state}
        width={611}
        height={642}
      />
    </span>
  );
}
