import { migrate, query, database, transaction } from '../lib/db.mjs';
import { randomBytes, scryptSync } from 'node:crypto';
if (process.env.RENDER || process.env.DATABASE_URL || process.env.NODE_ENV === 'production')
  throw new Error('Demo seeding is restricted to the local database.');
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12)
  throw new Error('Set DEMO_PASSWORD to at least 12 characters.');
await migrate();
const sample = [
  ['PCM0001', 'Test Administrator', ['admin'], 'iStellify'],
  ['PCM0002', 'Test Pastor', ['pastor'], 'iStellify'],
  ['PCM0003', 'Alex Sample', [], 'iStellify'],
  ['PCM0004', 'Jordan Servant', [], 'iStellify'],
  ['PCM0005', 'Taylor Auditor', [], 'iStellify'],
  ['PCM0006', 'Casey Guardian', [], 'iStellify'],
  ['PCM0007', 'Jamie Child', [], 'StelliKids'],
  ['PCM0008', 'Morgan Other Group', [], 'iStellify'],
];
await transaction(async (db) => {
  for (const [pcm, name, roles, tag] of sample) {
    const salt = randomBytes(16).toString('hex');
    const hash = salt + ':' + scryptSync(password, salt, 64).toString('hex');
    await db.query(
      'INSERT INTO members(id,pcm,name,roles,tag,password_hash) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(pcm) DO NOTHING',
      ['demo-' + pcm, pcm, name, roles, tag, hash],
    );
  }
  for (const [id, name, kind] of [
    ['demo-care', 'Sample Care Group', 'care'],
    ['demo-care2', 'Other Care Group', 'care'],
    ['demo-finance', 'Sample Financial Group', 'finance'],
    ['demo-family', 'Sample Family', 'family'],
    ['demo-kids', 'Sample Kids Group', 'care'],
    ['demo-share', 'Sample Sharing Group', 'share'],
  ])
    await db.query(
      'INSERT INTO groups(id,code,name,kind) VALUES($1,$1,$2,$3) ON CONFLICT DO NOTHING',
      [id, name, kind],
    );
  for (const [pcm, group, role] of [
    ['PCM0003', 'demo-care', 'member'],
    ['PCM0004', 'demo-care', 'servant'],
    ['PCM0006', 'demo-care', 'member'],
    ['PCM0008', 'demo-care2', 'member'],
    ['PCM0003', 'demo-finance', 'member'],
    ['PCM0005', 'demo-finance', 'auditor'],
    ['PCM0006', 'demo-family', 'leader'],
    ['PCM0007', 'demo-family', 'member'],
    ['PCM0007', 'demo-kids', 'member'],
    ['PCM0003', 'demo-share', 'member'],
    ['PCM0004', 'demo-share', 'captain'],
  ])
    await db.query(
      'INSERT INTO memberships(member_id,group_id,roles) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      ['demo-' + pcm, group, [role]],
    );
  await db.query(
    'INSERT INTO guardian_links(guardian_id,child_id,consent_at) VALUES($1,$2,now()) ON CONFLICT DO NOTHING',
    ['demo-PCM0006', 'demo-PCM0007'],
  );
});
console.log('Eight synthetic accounts ready. No real member information was imported.');
const db = await database();
await db.close();
