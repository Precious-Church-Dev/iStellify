import { query, transaction } from '@/lib/db.mjs';
import { requireUser, sameOrigin, HttpError, token, audit } from '@/lib/security';
export const dynamic = 'force-dynamic';
function error(e: unknown) {
  return Response.json(
    { error: e instanceof HttpError ? e.message : 'Unable to process this image.' },
    { status: e instanceof HttpError ? e.status : 500 },
  );
}
export async function GET(req: Request) {
  try {
    const u = await requireUser(),
      p = new URL(req.url).searchParams;
    let row: any;
    if (p.get('kind') === 'event')
      row = (await query('SELECT body,mime FROM event_images WHERE id=$1', [p.get('id')])).rows[0];
    else if (p.get('kind') === 'cover') {
      const r = (
        await query(
          'SELECT cover_body,cover_mime FROM coach_resources WHERE id=$1 AND (archived=false OR $2::boolean)',
          [p.get('id'), u.roles.includes('admin')],
        )
      ).rows[0];
      if (r?.cover_body) row = { body: r.cover_body, mime: r.cover_mime };
    } else {
      const r = (await query('SELECT avatar FROM members WHERE id=$1', [u.id])).rows[0];
      if (r?.avatar) row = { body: r.avatar, mime: 'image/jpeg' };
    }
    if (!row) throw new HttpError(404, 'Image not found.');
    return new Response(new Uint8Array(row.body), {
      headers: {
        'Content-Type': row.mime,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return error(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    if (Number(req.headers.get('content-length') || 0) > 6 * 1024 * 1024)
      throw new HttpError(413, 'Maximum image size is 5 MB.');
    const form = await req.formData(),
      file = form.get('file');
    if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || file.size === 0)
      throw new HttpError(400, 'Choose a JPEG or PNG image up to 5 MB.');
    const bytes = Buffer.from(await file.arrayBuffer()),
      png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!png && !jpg) throw new HttpError(400, 'Only JPEG and PNG images are supported.');
    const mime = png ? 'image/png' : 'image/jpeg';
    if (form.get('kind') === 'cover') {
      if (!u.roles.includes('admin'))
        throw new HttpError(403, 'Only Admin can upload resource covers.');
      const r = await query(
        'UPDATE coach_resources SET cover_body=$1,cover_mime=$2 WHERE id=$3 RETURNING id',
        [bytes, mime, form.get('resourceId')],
      );
      if (!r.rows.length) throw new HttpError(404, 'Resource not found.');
      return Response.json({ ok: true });
    }
    if (form.get('kind') === 'event') {
      if (!u.roles.includes('admin'))
        throw new HttpError(403, 'Only Admin can upload event images.');
      const id = token(),
        event = Number(form.get('eventId'));
      await transaction(async (db: any) => {
        const exists = await db.query('SELECT id FROM church_events WHERE id=$1 FOR UPDATE', [
          event,
        ]);
        if (!exists.rows.length) throw new HttpError(404, 'Event not found.');
        const count = (
          await db.query('SELECT count(*)::int AS n FROM event_images WHERE event_id=$1', [event])
        ).rows[0].n;
        if (count >= 3) throw new HttpError(400, 'Each event supports up to three images.');
        await db.query(
          'INSERT INTO event_images(id,event_id,body,mime,owner_id) VALUES($1,$2,$3,$4,$5)',
          [id, event, bytes, mime, u.id],
        );
        await audit(u.id, 'event.image', String(event), {}, db);
      });
      return Response.json({ ok: true, id });
    }
    if (!jpg) throw new HttpError(400, 'Save the cropped profile photo as JPEG.');
    await query('UPDATE members SET avatar=$1 WHERE id=$2', [bytes, u.id]);
    await audit(u.id, 'profile.photo', u.id);
    return Response.json({ ok: true });
  } catch (e) {
    return error(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    if (!u.roles.includes('admin')) throw new HttpError(403, 'Only Admin can remove event images.');
    const b = await req.json();
    await query('DELETE FROM event_images WHERE id=$1', [b.id]);
    await audit(u.id, 'event.image.remove', String(b.id));
    return Response.json({ ok: true });
  } catch (e) {
    return error(e);
  }
}
