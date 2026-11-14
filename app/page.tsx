import { currentUser } from '@/lib/security';
import { query } from '@/lib/db.mjs';
import Login from '@/components/Login';
import Workspace from '@/components/Workspace';
export const dynamic = 'force-dynamic';
export default async function Page() {
  try {
    const user = await currentUser();
    if (user) return <Workspace />;
    const r = await query('SELECT id FROM members LIMIT 1');
    return <Login needsSetup={!r.rows.length} />;
  } catch {
    return (
      <main className="connection-screen">
        <div className="brand-mark">✦</div>
        <h1>iStellify is getting ready</h1>
        <p>
          The database connection is not ready yet. Run the database migration, then refresh this
          page.
        </p>
        <a href="/">Try again</a>
      </main>
    );
  }
}
