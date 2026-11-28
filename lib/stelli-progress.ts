import { query } from './db.mjs';
import { localClock, scheduled } from './cards';
import { DAILY } from './domain';

export async function memberDailyProgress(memberId: string, timezone: string, now = new Date()) {
  const { day, minutes } = localClock(now, timezone);
  const [commitments, logs] = await Promise.all([
    query(
      "SELECT id,schedule FROM commitments WHERE member_id=$1 AND archived=false AND frequency='daily' AND start_date<=$2",
      [memberId, day],
    ),
    query(
      "SELECT habit,updated_at FROM logs WHERE member_id=$1 AND period=$2 AND status<>'draft' ORDER BY updated_at DESC",
      [memberId, day],
    ),
  ]);
  const dailyCommitments = commitments.rows as { id: string; schedule: { slots?: number[] } }[];
  const dailyLogs = logs.rows as { habit: string; updated_at: string | Date }[];
  const required = [
    ...DAILY,
    ...dailyCommitments.filter((row) => scheduled(day, 'daily', row.schedule)).map((row) => row.id),
  ];
  const completed = new Set(dailyLogs.map((row) => row.habit));
  return {
    day,
    hour: Math.floor(minutes / 60),
    hasCompletedHabitsToday: required.every((habit) => completed.has(habit)),
    lastProgressTimestamp: dailyLogs[0]?.updated_at,
  };
}
