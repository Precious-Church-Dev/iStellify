export default function Mascot({ small = false }: { small?: boolean }) {
  return (
    <img
      className={small ? 'mascot official-mascot small' : 'mascot official-mascot'}
      src="/brand/stelli-bot.png"
      alt="Stelli the bot"
      width={611}
      height={642}
    />
  );
}
