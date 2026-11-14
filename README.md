# iStellify

Precious Church's private member growth and ministry application. The pilot includes authentication, roster import, habit logs, scoped groups, independent verification, tithe declarations/reconciliation, guardian-assisted Kids logging and administration, with the module structure from the supplied wireframes.

## Member experience

The main sidebar contains iStellify, StelliKids, StelliCare, StelliShare, StelliChurch, StelliTithes, StelliSet and StelliAd. Experience tags determine the adult or Kids landing page. Restricted modules remain visibly locked. Adult sub-modules are StelliGreet, StelliLight, StelliLife, StelliStat, StelliLink, StelliSave, StelliBEST, StelliGoal and StelliRate. Kids have separate SkidiGreet/Light/Life/Stat/Link/Goal/Rate views; linked guardians can assist only their assigned children.

StelliSave records the date and account of salvation, understanding, confirmation and supporting references. StelliB.E.S.T. records Before, Event that Led, Salvation Day and Today. Both are private by default; a member can deliberately publish a B.E.S.T. testimony to their Care Group or church and withdraw it later. Salvation entries do not automatically change a spiritual state. Administrators assign the source-defined SBG/sP2S/P2S/AOS state explicitly.

Stelli uses the original supplied PNG, pops out after sign-in, smiles, changes the monitor to WELCOME, greets the member and returns to the dock. The greeting can be replayed or dismissed and honors reduced-motion preferences. The original logo and character artwork are unchanged; monitor expressions are a UI overlay.

Care and Share provide scoped session records, leader-published icebreakers/strategies, assignments, a name picker, prayers, voluntarily shared testimonies and leader task boards. Church provides member content, slides links, dates, prayers, private counsel/help requests, leadership goals/tasks and aggregate activity counts. Personal goals and private dated health/growth checkpoints persist in the database. Statistics support date ranges and an owner-only CSV report. These are pilot workflows; they do not imply every advanced feature in the full PRD is complete.

## Deploy to Render

1. Use the **Precious Church** workspace on the **Hobby** workspace plan. Add the payment method in Render; never put card details or credentials in GitHub.
2. Choose **New > Blueprint**, connect GitHub and select **Precious-Church-Dev/iStellify**, branch `main`, Blueprint path `render.yaml`.
3. Review the two resources: a 512 MB paid Node web service and a 256 MB paid PostgreSQL database, both in Singapore. The initial compute estimate is USD 7 + USD 6 monthly, plus storage, tax and usage. Review Render's displayed total before deploying. Hobby workspace fees are separate from service compute.
4. Render supplies the service origin automatically through `RENDER_EXTERNAL_URL`. No URL entry is needed for the default onrender.com address. If you later add a custom domain, set `APP_URL` to that exact HTTPS origin in the Environment page.
5. Deploy. The Blueprint injects the private database URL and generates a setup secret. It runs `npm run db:migrate` before starting the server. Database public network access is disabled.
6. Once the service is live, open the app. Copy `SETUP_SECRET` **privately** from Render's web-service Environment page into the setup form. Choose your administrator name and a unique password of at least 12 characters. The first account is `PCM0001`. Do not share the setup secret in chat, screenshots or issues.
7. Sign in as `PCM0001`. Open **StelliAd > Roster import**, upload the workbook, review every record and warning, and explicitly decide whether to grant proposed group leadership roles. Health details and spreadsheet passwords are excluded.
8. In **Members**, issue an activation code for each person and deliver it privately. Codes expire after 24 hours and work once. Members choose their own password through **Activate your account**.
9. Assign `PCM0002` the Pastor role using **Manage access**. Check all Care Servant, Sharing Captain and finance Auditor assignments. The finance group is separate from a person's ordinary Care Group.
10. Link only explicitly consented guardians to children. Complete synthetic staging checks before real member onboarding. Verify the database recovery procedure and obtain the church's approval for enabled workflows.

The Render dashboard is the authority for the service's actual URL, price and deployment status. This repository is not itself evidence of a live deployment.

## Local development

Use Node 22 LTS (or Node 24) and npm. Commands run from this repository directory:

```sh
npm ci
npm run db:migrate
npm run dev
```

Set `APP_URL=http://localhost:3000` in `.env.local`. For local bootstrap also set `SETUP_SECRET` to a random value of at least 32 characters. Next.js loads `.env.local`; the standalone migration command reads process environment, so set `DATABASE_URL` in the shell when migrating an external database.

Without `DATABASE_URL`, development uses a disk-backed PGlite PostgreSQL database in ignored `data/local`. Production on Render **requires** `DATABASE_URL`; there is no in-memory production fallback. Local data and credentials are never committed. Use `DATABASE_SSL=true` only when the database provider requires TLS and presents a certificate trusted by Node. Do not disable certificate verification.

Optional synthetic demo accounts:

```powershell
$env:DEMO_PASSWORD = 'choose-a-local-test-password'
npm run seed:demo
```

The seed refuses Render, production and external databases. It creates PCM0001 (Admin), PCM0002 (Pastor), PCM0003 (Member), PCM0004 (Servant), PCM0005 (Auditor), PCM0006 (Guardian), PCM0007 (Child) and PCM0008 (Other Group). All use the local password you supply. Never run the demo seed for real deployment.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

With the seeded local server running and `DEMO_PASSWORD` set, `node scripts/check-pilot.mjs` exercises authentication, scoped reads, private notes, review, revisions, financial reconciliation, guardian logging, import, activation and attachment authorization. `node scripts/check-modules.mjs` checks personal record persistence, testimony sharing/withdrawal, child access, ministry publishing, assignments and leader-only task boards. Both scripts mutate **synthetic localhost data only** and refuse non-localhost URLs. GitHub Actions runs type checks, unit checks and the production build.

## Implemented security and privacy behavior

In **StelliAd > Testing**, an administrator can set a shared familiarity-testing password (12–128 characters) for all non-admin members, including accounts pending activation. The planned familiarity period is November 15–18, 2026. There is no automatic 24-hour expiration or forced password change during familiarity testing. The administrator manually selects **End testing / require personal passwords** afterward; members then sign in with their current password and choose a different personal password before accessing records. Both bulk actions exclude PCM0001 and every Admin-role account, revoke affected member sessions, invalidate unused activation codes and record counts in the audit trail without passwords. Entries are preserved; existing passwords are replaced, not recoverable. No testing password is applied automatically by deployment.

- PCM is an identifier; passwords use salted scrypt hashes. Sessions are opaque random tokens, stored hashed in PostgreSQL, with HttpOnly and SameSite cookies and Secure cookies in production.
- Five-minute inactivity expiration is enforced on the server. Browser events send bounded activity heartbeats; background polling does not extend sessions. Sessions have a 12-hour absolute limit. Logout/reset/deactivation revoke them.
- Cookie-authenticated writes require the configured same origin. Login and activation have database-backed attempt limits.
- Authorization happens on the server for every operation. A member cannot approve their own entry. Daily devotional review exposes completion metadata only; journals remain private. Personal habit reflections remain private. Financial values are restricted to the member, scoped auditors and Pastor.
- Group membership is distinct from financial scope. Private child records require explicit guardian links or the relevant authorized weekly review role. Guardians can be revoked immediately.
- Corrections create immutable prior revisions and return to pending review. Concurrent versions cannot silently overwrite an existing record. Tithe calculation uses integer cents and an independently recorded receipt amount; discrepancies block confirmation.
- Workbook import previews changes, excludes plaintext passwords and health fields, keeps accounts separate when email is shared and protects exact-file/repeated-commit retries. Existing group roles are not overwritten by reimport. Auxiliary sheets require manual scope review.
- Audit events record administrative and record actions without private journal text or passwords. No destructive production purge is included.

## Pilot boundaries and decisions

This is a working **pilot**, not the full PRD implementation or a production compliance certification.

- Currency is PHP and Sunday begins the week in Asia/Manila. Daily schedules lock to a calendar week, weekly to a month, monthly to a quarter. Closed spiritual periods require an audited, time-limited administrator exception. Owner confirmation is still needed for excusal, grace and theological progression policies.
- iRead, iPray, iPraise, iNote, iCare, iSpeak, iTithes, weekly iRate and monthly iShare are available. Daily prayer supports private partial drafts. Custom habits support daily/weekly/monthly frequency; arbitrary weekday schedules and the premade library are future work.
- Digital notes are enabled for the pilot rather than implementing the final selected-member entitlement and full BUP/BSF structured editor. Generic personal custom habits are self-reported; spiritual activities have independent review queues.
- Children have iRead/iPray/iPraise/iTithes/iNote and custom habits, matching the Kids wireframe. Guardian-assisted giving records retain the same private financial authorization. Kids links show family scope only. The experience tag is not age verification or a legal consent determination.
- Tithe reasons provisionally include both source lists. There are declarations and manual receipt reconciliation; no payment gateway or automatic bank matching.
- Automatic scheduled reminders, external email/push, AI chat, automatic theological progression, StelliCoach, advanced historical analytics and full PRD reporting remain on the backlog. Ministry resources use text and links; an embedded slide presentation editor is not included. Health values are private self-reported records, with an adult numeric BMI calculation and no clinical interpretation.
- In-app peer nudges have one-per-sender/recipient/day and three-per-recipient/day limits. Notification preferences, quiet-hour delivery scheduling and automatic reminders are later work.
- Attachments are privately stored in PostgreSQL for this small pilot (PNG/JPEG/PDF, 2 MB each, limited daily uploads), so they survive deploys and are covered by database backups. This deliberately avoids Render's ephemeral filesystem. Downloads use `application/octet-stream` and authorization. A malware scanner and external object/Drive storage adapter are **not** implemented; restrict pilot uploads to trusted testers until these are reviewed. Limit total media growth on the small database.
- MFA, account recovery outside administrator-issued codes, Google login, privacy consent text/versioning, formal retention/erasure procedures, public rate-limit abuse review and a full accessibility audit remain launch-hardening work. No real financial/medical/child-data launch should be inferred from a successful build.

## Architecture

Next.js App Router with React and TypeScript, PostgreSQL through a bounded `pg` pool, ExcelJS roster parsing, CSS and Lucide icons. PGlite is used only for local development/testing. There are no external AI dependencies or public member-data endpoints. The application and database share Render Singapore private networking. Schema setup is idempotent; future schema changes should be explicit versioned migrations.

## Hosting references

- [Render Blueprint reference](https://render.com/docs/blueprint-spec)
- [Render pricing](https://render.com/pricing)
- [Database backups and recovery](https://render.com/docs/postgresql-backups)
- [Free-plan limits](https://render.com/docs/free)

Never commit `.env` files, databases, roster exports, source spreadsheets, credentials or private attachments. Keep this repository code-only even if GitHub visibility is public.

