import { STELLI_MOODS, type StelliMood } from '@/lib/stelli-mascot';

export default function Mascot({
  small = false,
  mood = 'happy',
}: {
  small?: boolean;
  mood?: StelliMood;
}) {
  return (
    <span className={'mood-mascot mood-' + mood + (small ? ' small' : '')}>
      <img
        className={small ? 'mascot official-mascot small' : 'mascot official-mascot'}
        src={'/assets/mascot/UIUX_' + STELLI_MOODS[mood].variant + '_Stelli.png'}
        alt={'Stelli feeling ' + mood}
        width={512}
        height={512}
      />
    </span>
  );
}
