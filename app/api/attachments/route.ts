import { driveConfigured, saveDriveNotes, driveToken } from '@/lib/drive-storage';
import { localClock } from '@/lib/cards';
import { query } from '@/lib/db.mjs';
import { audit, HttpError, memberships, requireUser, sameOrigin, token } from '@/lib/security';
import { canReview } from '@/lib/domain';
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    if (Number(req.headers.get('content-length') || 0) > 10_600_000)
      throw new HttpError(413, 'Maximum file size is 10 MB.');
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
    if (!(file instanceof File) || file.size > 10_485_760)
      throw new HttpError(400, 'Choose an image or PDF under 10 MB.');
    const bytes = Buffer.from(await file.arrayBuffer());
    let mime = '';
    if (bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) mime = 'image/png';
    if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) mime = 'image/jpeg';
    if (bytes.subarray(0, 5).toString() === '%PDF-') mime = 'application/pdf';
    if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP')
      mime = 'image/webp';
    if (
      bytes.subarray(4, 8).toString() === 'ftyp' &&
      /heic|heix|hevc|hevx|mif1/.test(bytes.subarray(8, 32).toString())
    )
      mime = 'image/heic';
    if (!mime) throw new HttpError(400, 'Only PNG, JPEG, WEBP, HEIC and PDF files are accepted.');
    const recent = await query(
      "SELECT count(*)::int AS n FROM attachments WHERE owner_id=$1 AND created_at>now()-interval '1 day'",
      [subject],
    );
    if (Number(recent.rows[0].n) > 20) throw new HttpError(429, 'Daily upload limit reached.');
    const id = token();
    let drive: any = null;
    if (f.get('habit') === 'iNote' && mime.startsWith('image/') && driveConfigured()) {
      const member = (await query('SELECT pcm,name,timezone FROM members WHERE id=$1', [subject]))
        .rows[0];
      const day = localClock(new Date(), member.timezone).day,
        ext = (
          {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/webp': 'webp',
            'image/heic': 'heic',
          } as any
        )[mime];
      const last = String(member.name)
        .trim()
        .split(/\s+/)
        .at(-1)!
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      drive = await saveDriveNotes(
        bytes,
        mime,
        day + '_' + member.pcm + '_' + last + '_iNote.' + ext,
        day.slice(0, 4),
      );
    }
    if (!drive && file.size > 2_000_000)
      throw new HttpError(
        503,
        'Files above 2 MB require the church Google Drive integration. Ask your administrator to configure it.',
      );
    await query('INSERT INTO attachments(id,owner_id,name,mime,body) VALUES($1,$2,$3,$4,$5)', [
      id,
      subject,
      file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120),
      mime,
      drive ? Buffer.alloc(0) : bytes,
    ]);
    if (drive)
      await query(
        'UPDATE attachments SET drive_file_id=$1,drive_file_name=$2,drive_web_view_link=$3 WHERE id=$4',
        [drive.id, drive.name, drive.webViewLink, id],
      );
    await audit(u.id, 'attachment.upload', id);
    return Response.json({
      id,
      name: drive?.name || file.name,
      webViewLink: drive?.webViewLink || null,
    });
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
    let body = a.body as Buffer;
    if (a.drive_file_id) {
      const r = await fetch(
        'https://www.googleapis.com/drive/v3/files/' +
          encodeURIComponent(a.drive_file_id) +
          '?alt=media&supportsAllDrives=true',
        { headers: { Authorization: 'Bearer ' + (await driveToken()) } },
      );
      if (!r.ok) throw new HttpError(503, 'Drive file is temporarily unavailable.');
      body = Buffer.from(await r.arrayBuffer());
    }
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type':
          new URL(req.url).searchParams.get('preview') === 'true' && a.mime.startsWith('image/')
            ? a.mime
            : 'application/octet-stream',
        'Content-Disposition': `${new URL(req.url).searchParams.get('preview') === 'true' && a.mime.startsWith('image/') ? 'inline' : 'attachment'}; filename="${a.name}"`,
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
