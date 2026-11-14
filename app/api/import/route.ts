import { query, transaction } from '@/lib/db.mjs';
import { audit, digest, HttpError, requireUser, sameOrigin, token } from '@/lib/security';
import { isAdmin } from '@/lib/domain';
import { parseRoster, type ImportPreview } from '@/lib/importer';
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireUser();
    if (!isAdmin(user)) throw new HttpError(403, 'Administrator access required.');
    if (req.headers.get('content-type')?.includes('multipart/form-data')) {
      if (Number(req.headers.get('content-length') || 0) > 5_500_000)
        throw new HttpError(413, 'Maximum workbook size is 5 MB.');
      const form = await req.formData(),
        file = form.get('file');
      if (
        !(file instanceof File) ||
        file.size > 5_000_000 ||
        !file.name.toLowerCase().endsWith('.xlsx')
      )
        throw new HttpError(400, 'Select an XLSX workbook under 5 MB.');
      const bytes = Buffer.from(await file.arrayBuffer());
      const hash = digest(bytes.toString('base64'));
      const existing = await query(
        'SELECT id FROM imports WHERE file_hash=$1 AND committed_at IS NOT NULL',
        [hash],
      );
      if (existing.rows.length)
        throw new HttpError(409, 'This exact workbook has already been imported.');
      const payload = await parseRoster(bytes);
      const id = token();
      await query('INSERT INTO imports(id,actor_id,file_hash,payload) VALUES($1,$2,$3,$4)', [
        id,
        user.id,
        hash,
        JSON.stringify(payload),
      ]);
      return Response.json({ id, ...payload });
    }
    const b = await req.json();
    let count = 0;
    await transaction(async (db: any) => {
      await db.query('SELECT pg_advisory_xact_lock(88242)');
      const r = await db.query('SELECT * FROM imports WHERE id=$1 AND actor_id=$2 FOR UPDATE', [
        b.id,
        user.id,
      ]);
      const item = r.rows[0];
      if (!item || item.committed_at)
        throw new HttpError(409, 'Preview not found or already committed.');
      const p = item.payload as ImportPreview;
      if (p.errors.length) throw new HttpError(400, 'Resolve the import errors first.');
      for (const row of p.members) {
        const existing = await db.query('SELECT id FROM members WHERE pcm=$1', [row.pcm]);
        const id = existing.rows[0]?.id || token();
        // Bootstrap identity and authority are never overwritten from a spreadsheet.
        if (row.pcm !== 'PCM0001')
          await db.query(
            'INSERT INTO members(id,pcm,name,tag,email) VALUES($1,$2,$3,$4,$5) ON CONFLICT(pcm) DO UPDATE SET name=excluded.name,tag=excluded.tag,email=excluded.email',
            [id, row.pcm, row.name, row.tag, row.email],
          );
        if (row.pcm === 'PCM0001') continue;
        for (const group of row.groups) {
          const code = group.kind + ':' + group.code;
          const g = await db.query(
            'INSERT INTO groups(id,code,name,kind) VALUES($1,$2,$3,$4) ON CONFLICT(code) DO UPDATE SET name=excluded.name RETURNING id',
            [token(), code, group.code, group.kind],
          );
          const role = b.grantRoles === true ? group.role : 'member';
          await db.query(
            'INSERT INTO memberships(member_id,group_id,roles) VALUES($1,$2,$3) ON CONFLICT(member_id,group_id) DO NOTHING',
            [id, g.rows[0].id, [role]],
          );
        }
        count++;
      }
      await db.query('UPDATE imports SET committed_at=now() WHERE id=$1', [b.id]);
      await audit(user.id, 'import.commit', b.id, { count, grantRoles: b.grantRoles === true }, db);
    });
    return Response.json({
      ok: true,
      message: `${count} member records imported. Issue private activation codes from Members.`,
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof HttpError ? e.message : e instanceof Error ? e.message : 'Import failed.',
      },
      { status: e instanceof HttpError ? e.status : 400 },
    );
  }
}
