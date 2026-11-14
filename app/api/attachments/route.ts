import { query } from '@/lib/db.mjs';
import { audit, HttpError, memberships, requireUser, sameOrigin, token } from '@/lib/security';
import { canReview } from '@/lib/domain';
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    if (Number(req.headers.get('content-length') || 0) > 2_200_000)
      throw new HttpError(413, 'Maximum file size is 2 MB.');
    const f = await req.formData(),
      file = f.get('file'),
      subject = String(f.get('subject') || u.id);
    if (subject !== u.id) {
      const g = await query('SELECT 1 FROM guardian_links WHERE guardian_id=$1 AND child_id=$2', [
        u.id,
        subject,
      ]);
      if (!g.rows.length) throw new HttpError(403, 'Guardian access required.');
    }
    if (!(file instanceof File) || file.size > 2_000_000)
      throw new HttpError(400, 'Choose an image or PDF under 2 MB.');
    const bytes = Buffer.from(await file.arrayBuffer());
    let mime = '';
    if (bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) mime = 'image/png';
    if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) mime = 'image/jpeg';
    if (bytes.subarray(0, 5).toString() === '%PDF-') mime = 'application/pdf';
    if (!mime) throw new HttpError(400, 'Only PNG, JPEG and PDF files are accepted.');
    const recent = await query(
      "SELECT count(*)::int AS n FROM attachments WHERE owner_id=$1 AND created_at>now()-interval '1 day'",
      [subject],
    );
    if (Number(recent.rows[0].n) > 20) throw new HttpError(429, 'Daily upload limit reached.');
    const id = token();
    await query('INSERT INTO attachments(id,owner_id,name,mime,body) VALUES($1,$2,$3,$4,$5)', [
      id,
      subject,
      file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120),
      mime,
      bytes,
    ]);
    await audit(u.id, 'attachment.upload', id);
    return Response.json({ id, name: file.name });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Upload failed.' },
      { status: e instanceof HttpError ? e.status : 400 },
    );
  }
}
export async function GET(req: Request) {
  try {
    const u = await requireUser(),
      id = new URL(req.url).searchParams.get('id');
    const r = await query(
      'SELECT a.*,l.member_id,l.habit,l.group_ids FROM attachments a LEFT JOIN logs l ON l.id=a.log_id WHERE a.id=$1',
      [id],
    );
    const a = r.rows[0];
    if (!a) throw new HttpError(404, 'File not found.');
    const g = await query('SELECT 1 FROM guardian_links WHERE guardian_id=$1 AND child_id=$2', [
      u.id,
      a.owner_id,
    ]);
    if (
      a.owner_id !== u.id &&
      !g.rows.length &&
      (!a.log_id ||
        !['iNote', 'iSpeak'].includes(String(a.habit)) ||
        !canReview(u, await memberships(u.id), a as any))
    )
      throw new HttpError(403, 'This attachment is private.');
    return new Response(new Uint8Array(a.body as Buffer), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${a.name}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'File unavailable.' },
      { status: e instanceof HttpError ? e.status : 400 },
    );
  }
}
