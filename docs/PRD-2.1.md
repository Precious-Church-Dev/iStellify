# iStellify 2.1 operations

The update keeps the existing Render application and PostgreSQL database. The deployment migration adds tables and columns without deleting member accounts, logs, or attachments.

## Account integrations

Church Number sign-in remains available. Configure the following in the Render service Environment page to activate optional integrations. Never commit their values.

| Feature | Required settings | Setup |
| --- | --- | --- |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Create a Google web OAuth client. Register `https://istellify.onrender.com/api/auth/google/callback` as the redirect URI, adjusted if the app uses a custom domain. Only one active registered member may match the verified Google email. |
| Email password recovery | `RESEND_API_KEY`, `MAIL_FROM` | Verify the sending domain/address with Resend. Recovery links expire after 30 minutes and work once. Shared or ambiguous email matches do not receive a link. Admin-issued private activation/reset codes remain available. |
| Church Drive notes | `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Enable the Drive API and grant the service account access to the church Shared Drive/folder. Uploads inherit that folder's permissions; the app never makes notes public. |

Google sign-in and email recovery show a useful message until configured. Notes continue to support private database attachments up to 2 MB. Configured Drive uploads accept JPEG, PNG, HEIC and WEBP up to 10 MB and use `iNoteCard_YYYY` folders and `YYYY-MM-DD_PCM####_LastName_iNote.ext` filenames. HEIC preview depends on browser support; an authorized download remains available.

## Cards and review

Daily cards use the member's saved IANA timezone (default Asia/Manila). Only the current day is open. Past and future daily columns are read-only. Daily submissions are auto-verified. Weekly submissions belong to their Sunday service, including submissions made the preceding Saturday.

| Card | Submission closes | Sunday review |
| --- | --- | --- |
| iRate, iTithes | Sunday 08:00 | iRate 08:00–08:30; iTithes 08:00–17:30 |
| iPraise | Sunday 10:00 | 10:00–14:00 |
| iCare | Sunday 12:00 | 10:00–18:00 |
| iSpeak, iNote | Sunday 17:00 | 10:00–18:00 |
| iShare | Last Sunday 08:00 | Last Sunday 08:00–18:00 |

The PRD schedule table takes precedence over the older 23:00 iSpeak text in the PDF. iSpeak/iNote open Sunday at midnight. The later PRD review workflow takes precedence over the earlier Admin/Pastor-only unlock paragraph: assigned Servants/Captains and Admin/Pastor may approve. Nobody can approve their own unlock. Exceptions expire after 24 hours and are consumed by submission; authorized follow-up review remains possible within the original exception's 24-hour lifetime.

Stellar Fragment credit is stored once per log. Corrections replace that log's score rather than adding it again. Prayer awards one point per checked prayer activity; reading awards one per distinct supported activity. StelliNudge allows one sender/recipient/card/window reminder, skips already-submitted or closed cards, and records successful completion during the normal submission window. The annual impact report ranks successful follow-through then reminders sent. The final weighted Brother's Keeper award formula needs a church decision before assigning an automatic winner.

StelliAd and StelliTithes are visible only to Admin/Auditor accounts. Auditors receive scoped finance tools and do not gain member-administration privileges. Personal iTithesCard submissions remain available within StelliLight. Counseling requests are visible to their author and the specifically selected recipient.

## New workspaces

StelliStat/SkidiStat consolidate the greeting and analytics. StelliBase and StelliGrade replace the old adult names. StelliLOT is a Latest of Today placeholder for 2028. StelliCleanse stores Admin-recorded baptism details, links to church-issued signed certificates, and photo galleries; it does not invent a minister's signature.

StelliCoach provides searchable StelliApp and StelliLearn resources with Admin publishing, editing, ordering and archiving. StelliLife includes the 17 PRD presets. Profile photos support centering, cropping and JPEG/PNG upload; private profile fields include bio, contact number, birthdate, email, and timezone.

The PWA provides favicons, Apple touch icons, Android/maskable icons, install prompts where supported, and an offline notice. Member pages, API responses and private media are never cached by the service worker. On iOS, use Safari's Share menu and Add to Home Screen.

## Verification

Run `npm run typecheck`, `npm test`, and `npm run build`. GitHub Actions also seeds a synthetic local database and runs `node scripts/check-v21.mjs` against localhost. The script refuses non-localhost URLs and must never target the Render service. Test live integrations separately after configuring the relevant provider credentials.
