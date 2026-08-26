# Turquoise Orders

Cafeteria floor-service app for **Turquoise Bakery & Brunch**. One Expo codebase that runs in the
browser (Android + iOS + desktop) and can also be built as a native app.

- Floor plans with drag-and-drop table layout (Salon, Terasa, or any floor you add)
- Per-table orders with item notes, order notes and payment method
- Order history grouped per day, with a full daily breakdown (top products, categories, waiters, revenue per hour)
- Work calendar: clock in/out, attendance per day, hours worked, orders served and revenue per employee
- Two roles: **admin** (everything) and **employee** (orders + read-only history/calendar)
- **Offline first**: every change is written to local storage immediately and pushed to Supabase when the connection is back

---

## 1. Run it locally

```bash
npm install
npm run web        # browser
npm start          # Expo Go / native
```

Without Supabase keys the app starts in **local mode** — everything is stored on the device and two demo
accounts are available:

| Email | PIN | Role |
| --- | --- | --- |
| `admin@local` | `1234` | admin |
| `staff@local` | `1111` | employee |

## 2. Connect the free Supabase backend

1. Create a free project at <https://supabase.com> (Free tier: 500 MB database, unlimited API requests).
2. Open **SQL Editor → New query**, paste the contents of [supabase/schema.sql](supabase/schema.sql) and run it.
   This creates every table, the `updated_at` triggers, row-level security policies and realtime publication.
3. Go to **Project Settings → API** and copy the *Project URL* and the *anon public* key.
4. Create a `.env.local` file next to `package.json`:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

5. Create your first user in **Authentication → Users → Add user** (email + password), then promote it:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

6. Restart `npm run web`. The header pill now shows **Synced** instead of **Local mode**.

Every additional employee is created the same way (Authentication → Users). New accounts default to the
`employee` role; an admin can flip roles from **Manage → Team**.

### How offline works

- All reads come from a local cache (`localStorage` on web, `AsyncStorage` on native).
- All writes update the cache instantly and are appended to an **outbox** queue.
- A background loop flushes the outbox every 20 s, whenever the browser fires an `online` event, and on
  demand from the sync pill in the header.
- Supabase Realtime pushes other devices' changes into the cache as they happen.
- Conflicts resolve by `updated_at` (last write wins).

The header pill shows the live state: `Synced`, `Syncing`, `Offline · N` (N = queued changes), `Sync issue`
or `Local mode`.

## 3. Deploy free on Vercel

The repository already contains [vercel.json](vercel.json), which builds a static web export into `dist/`
and serves it as a single-page app.

### Option A — dashboard (no CLI)

1. Push this folder to a GitHub repository.
2. Go to <https://vercel.com/new>, import the repository.
3. Framework preset: **Other**. Build command and output directory are picked up from `vercel.json`.
4. Add the two environment variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) for the
   Production, Preview and Development environments.
5. **Deploy**. Every push to `main` redeploys automatically.

### Option B — CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel env add EXPO_PUBLIC_SUPABASE_URL
vercel env add EXPO_PUBLIC_SUPABASE_ANON_KEY
vercel --prod
```

> The Supabase anon key is meant to be public — access is controlled by the row-level security policies in
> `supabase/schema.sql`. Never ship the `service_role` key.

After the first deploy, add the Vercel URL to **Supabase → Authentication → URL Configuration → Site URL**
so password resets and email links point at the right domain.

### Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Header still says **Local mode** after adding keys | `EXPO_PUBLIC_*` values are inlined at build time | Restart `npm run web`; on Vercel trigger a **redeploy** after adding the variables |
| Sign in fails with *Invalid login credentials* | The dashboard user was created without confirming the email | Supabase → Authentication → Users → **Auto Confirm User** |
| Signed in, but no floors/tables/menu appear | Seed data was created while in local mode and never uploaded | Sign in as admin, **Me → Reset local cache**, then **Sync now** |
| Admin actions missing | Profile row still says `employee` | `update public.profiles set role = 'admin' where email = '…';` |
| `P0001: Only administrators can change roles` in the SQL Editor | Old version of `guard_profile_changes()` blocked direct SQL | Re-run `supabase/schema.sql` (it is idempotent), then retry the update |
| *Sync issue* pill with a `42501` error | An RLS policy rejected the write | Confirm `supabase/schema.sql` ran completely and the account is the intended role |
| Project unreachable after a week | Free projects pause after 7 days of inactivity | Resume it from the Supabase dashboard |

## 4. Roles

| Capability | Admin | Employee |
| --- | :---: | :---: |
| Take and edit orders | ✅ | ✅ |
| Finish orders / clock in / clock out | ✅ | ✅ |
| Read history and daily breakdown | ✅ | ✅ |
| Open a calendar day and see own shift + own orders | ✅ | ✅ |
| Open a calendar day and see **every** employee who worked, with their shifts and orders | ✅ | ❌ |
| Add or edit shifts for anyone | ✅ | ❌ |
| Edit / delete history | ✅ | ❌ |
| Edit menu, floors, tables | ✅ | ❌ |
| Create accounts and promote/demote admins | ✅ | ❌ |

Roles are enforced twice: the UI hides admin actions, and the Supabase RLS policies reject unauthorised
writes even if someone calls the API directly. New accounts are always created as `employee` — the signup
trigger ignores any client-supplied role, so an account cannot self-promote.

### Adding team members from the app

**Manage → Team → Add team member** creates the Supabase login and the profile in one step, using a
throw-away client so your own session is untouched. Give the new person the temporary password you set.
For them to sign in immediately, turn off **Supabase → Authentication → Providers → Email → Confirm email**;
otherwise they must click the confirmation link first.

Use **Make admin** / **Make employee** on any row to change a role. You cannot change your own role, which
prevents locking yourself out of the last admin account.

## 5. Project structure

```
App.js                    entry point, hydrates the offline cache
src/
  AppShell.js             navigation shell (bottom tabs / side rail)
  theme.js                design tokens
  components/             UI kit, header, nav bar, floor plan
  context/                AuthContext (roles) and DataContext (reactive data)
  data/
    store.js              offline cache, outbox and Supabase sync engine
    api.js                domain operations (orders, history, shifts, menu…)
    seed.js               default floors, tables and menu
  hooks/, lib/            responsive helpers, dates, storage, connectivity
supabase/schema.sql       database, RLS policies, triggers
legacy/                   the previous single-file implementation, kept for reference
```

## 6. Native builds

The Android/iOS configuration is unchanged; `eas build` still works via [eas.json](eas.json).
