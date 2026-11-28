export const STELLI_MOODS = {
  happy: { variant: 'Happy', message: 'Welcome to iStellify App' },
  sad: { variant: 'Sad', message: 'Please don’t forget to log your progress' },
  disappointed: { variant: 'Disappointed', message: 'Don’t Lose your Streak' },
  blissful: { variant: 'BlissFul', message: 'Awesome work' },
} as const;

export type StelliMood = keyof typeof STELLI_MOODS;

export function resolveMascotMood(hour: number, completed: boolean): StelliMood {
  if (completed) return 'blissful';
  if (hour >= 23) return 'disappointed';
  if (hour >= 21) return 'sad';
  return 'happy';
}

export function appIconFilename(mood: StelliMood) {
  return 'App_Icon_' + STELLI_MOODS[mood].variant + '_Stelli.png';
}
