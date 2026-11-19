# Supabase migration for Hamahangi

This branch starts the migration from Firebase to Supabase Cloud. It is intentionally separate from `main`; no Firebase production configuration or existing data is deleted by this change.

## Target architecture

- Supabase Auth: email + password sign-up/sign-in, sign-out, password recovery.
- Supabase Postgres: profiles, workspaces, memberships, meeting/task/event items, invitations, notifications.
- Row Level Security (RLS): workspace membership and role-based data access.
- Capacitor Local Notifications: retain local reminders on Android.
- Remote push: separate follow-up task; do not carry over Firebase Messaging or FCM token storage.

## Current migration status

1. [x] Create an isolated migration branch.
2. [x] Add initial PostgreSQL schema and RLS migration.
3. [x] Add follow-up RLS hardening migration (must be applied after the initial schema).
4. [ ] Configure email/password auth in the Supabase Cloud project.
5. [ ] Add Supabase JS client and environment variables.
6. [ ] Replace the Firebase auth UI with email/password sign-up, sign-in and password recovery.
7. [ ] Replace Firestore listeners and CRUD operations with Postgres queries/realtime.
8. [ ] Port invitations and workspace membership to secure RPCs / RLS.
9. [ ] Remove Firebase packages, configuration, rules, functions and messaging worker after parity tests.
10. [ ] Test web and Android builds; test RLS with multiple users and roles.
11. [ ] Plan and verify data migration before switching any existing users.

## Supabase project setup

Create a project in the Supabase dashboard. For the beta, select a region with reliable connectivity for the intended users. Store the database password privately; never commit it.

In **Authentication → Providers → Email**:
- Enable email/password sign-up.
- For the first local beta only, email confirmation may be disabled to avoid requiring SMTP during initial UI testing. Enable confirmation and configure SMTP before inviting real users or using production data.
- Configure password recovery redirect URLs for the web origin and Capacitor app once those URLs are known.

In **Project Settings → API**, copy:
- Project URL → `VITE_SUPABASE_URL`
- Publishable/anon key → `VITE_SUPABASE_ANON_KEY`

Only the publishable/anon key belongs in the client. Never expose the service-role key or database password in frontend code, GitHub, screenshots, or chat.

Create a local `.env.local` (not committed):
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Apply these files in order in the Supabase SQL Editor:
1. `supabase/migrations/202611190001_initial_schema.sql`
2. `supabase/migrations/202611190002_security_hardening.sql`

The first migration creates the schema. The second tightens column permissions and invitation, membership, and notification policies. Do not load real or sensitive organization data until RLS has been tested with multiple accounts and roles.

## Important migration safeguards

- Do not delete or overwrite the Firebase project yet.
- Do not point the current production app at the new schema until all CRUD, invitation and access-control tests pass.
- Preserve legacy Firebase UIDs during data migration as a mapping field if the old data must be imported; Supabase Auth user UUIDs are not automatically the same as Firebase UIDs.
- Keep local Android reminders independent from remote push.
- The initial SQL is a foundation and must be validated in a disposable Supabase project before production use. It is not yet a completed app migration.
