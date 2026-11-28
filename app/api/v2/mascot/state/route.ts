import { query } from '@/lib/db.mjs';
import { HttpError, requireUser, sameOrigin } from '@/lib/security';
import { appIconFilename, resolveMascotMood } from '@/lib/stelli-mascot';
import { memberDailyProgress } from '@/lib/stelli-progress';

export async function POST(request: Request) {
  try {
    if (!request.headers.has('authorization')) sameOrigin(request);
    const user = await requireUser(false, request);
    let body;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, 'Send a JSON request.');
    }
    if (body?.action !== 'LOG_PROGRESS') throw new HttpError(400, 'Unknown mascot action.');
    if (body.churchNumber !== user.pcm)
      throw new HttpError(403, 'This member does not match your session.');
    const {
      rows: [profile],
    } = await query('SELECT timezone FROM members WHERE id=$1', [user.id]);
    const progress = await memberDailyProgress(user.id, profile.timezone);
    const mood = resolveMascotMood(progress.hour, progress.hasCompletedHabitsToday);
    return Response.json({
      newMood: mood[0].toUpperCase() + mood.slice(1),
      updatedIcon: appIconFilename(mood),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof HttpError ? error.message : 'Unable to load Stelli’s state.' },
      { status: error instanceof HttpError ? error.status : 500 },
    );
  }
}
