import { localClock } from '@/lib/cards';
import { query } from '@/lib/db.mjs';
import { HttpError, requireUser } from '@/lib/security';
import { stelliPath, stelliState } from '@/lib/stellipath';

export async function GET(request: Request) {
  try {
    const user = await requireUser(false, request);
    const {
      rows: [profile],
    } = await query(
      'SELECT timezone,gender,avatar IS NOT NULL AS has_avatar FROM members WHERE id=$1',
      [user.id],
    );
    const { day } = localClock(new Date(), profile.timezone);
    const path = stelliPath(day);
    return Response.json(
      {
        churchNumber: user.pcm,
        nickname: user.nickname || user.name.split(' ')[0],
        stelliState: stelliState(user.spiritual_state),
        gender: profile.gender,
        avatarUrl: profile.has_avatar ? '/api/media?kind=avatar' : '',
        day,
        phase: path.phase.key,
        position: path.position,
        daysRemaining: path.days,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof HttpError ? error.message : 'Unable to load StelliPath.' },
      { status: error instanceof HttpError ? error.status : 500 },
    );
  }
}
