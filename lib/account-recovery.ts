import { query, transaction } from './db.mjs';
import { audit, digest, HttpError, passwordHash, throttle, token } from './security';
export async function recoveryAction(data: any): Promise<Response | null> {
  if (data.action === 'requestReset') {
    if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
      throw new HttpError(
        503,
        'Email recovery is not configured yet. Contact your administrator for a private activation/reset code.',
      );
    const identity = String(data.identity || '').trim();
    await throttle('reset:' + digest(identity.toLowerCase()), 3);
    const matches = (
      await query(
        'SELECT id,email FROM members WHERE active=true AND (lower(email)=lower($1) OR pcm=upper($1))',
        [identity],
      )
    ).rows;
    if (matches.length === 1 && matches[0].email) {
      const member = matches[0],
        raw = token();
      await transaction(async (db: any) => {
        await db.query(
          'UPDATE password_resets SET used_at=now() WHERE member_id=$1 AND used_at IS NULL',
          [member.id],
        );
        await db.query(
          "INSERT INTO password_resets(token_hash,member_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')",
          [digest(raw), member.id],
        );
      });
      const origin = new URL(process.env.APP_URL || process.env.RENDER_EXTERNAL_URL!).origin;
      const url = origin + '/?reset=' + encodeURIComponent(raw);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM,
          to: [member.email],
          subject: 'Reset your iStellify password',
          text: `You requested a password reset. Open this link within 30 minutes: ${url}\nIf you did not request this, ignore this email.`,
        }),
      });
      if (!response.ok) {
        await query('UPDATE password_resets SET used_at=now() WHERE token_hash=$1', [digest(raw)]);
        console.error('password_reset_delivery_failed', { status: response.status });
      }
    }
    return Response.json({
      ok: true,
      message:
        'If a unique active account matches and has a registered email, a reset link will be sent. It expires in 30 minutes. You can also request a private reset code from your administrator.',
    });
  }
  if (data.action === 'resetPassword') {
    const raw = String(data.token || '');
    await throttle('reset-token:' + digest(raw), 5);
    const hash = await passwordHash(String(data.password || ''));
    await transaction(async (db: any) => {
      const r = (
        await db.query(
          'SELECT member_id FROM password_resets WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',
          [digest(raw)],
        )
      ).rows[0];
      if (!r) throw new HttpError(400, 'This password reset link is invalid or expired.');
      await db.query(
        'UPDATE members SET password_hash=$1,password_change_required=false WHERE id=$2',
        [hash, r.member_id],
      );
      await db.query(
        'UPDATE password_resets SET used_at=now() WHERE member_id=$1 AND used_at IS NULL',
        [r.member_id],
      );
      await db.query(
        'UPDATE activation_tokens SET used_at=now() WHERE member_id=$1 AND used_at IS NULL',
        [r.member_id],
      );
      await db.query('DELETE FROM sessions WHERE member_id=$1', [r.member_id]);
      await audit(r.member_id, 'account.password_reset', r.member_id, {}, db);
    });
    return Response.json({
      ok: true,
      message: 'Password reset. Sign in with your Church Number and new password.',
    });
  }
  return null;
}
