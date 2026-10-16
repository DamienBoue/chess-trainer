# Sync between devices (Supabase + Google)

The app shares a player's analyses, exercise and repertoire progress, the day's session, level and streak between devices (phone, PC) through a Supabase project. Offline first: each device keeps working on its own storage and syncs at launch, when it comes back to the foreground, and a few seconds after each change. Code: `src/sync/engine.ts` (merge rules, tested), `native/lib/cloud.ts` (Supabase, Google sign-in), schema in `supabase/migrations/`.

## Setup (once)

1. **Database** — Supabase → SQL editor → paste and run `supabase/migrations/20261016000000_sync.sql` (tables `analyses` and `documents`, row level security: each user only sees their rows).
2. **Google** — Google Cloud console → APIs & Services → Credentials → *Create credentials* → *OAuth client ID* → type *Web application*.
   - Authorized redirect URI: `https://cnkzuyjacxgdkjdurpvj.supabase.co/auth/v1/callback`
   - (The consent screen can stay in "Testing" with your Google address as test user.)
   Then Supabase → Authentication → Sign In / Providers → **Google**: enable, paste the client ID and secret.
3. **Redirect URLs** — Supabase → Authentication → URL Configuration:
   - Site URL: `https://damienboue.github.io/chess-trainer/`
   - Redirect URLs: `https://damienboue.github.io/chess-trainer/**`, `chesstrainer://**`, `exp://**` (Expo Go), `http://localhost:8081/**` (local web)
4. **Keys** — Supabase → Project Settings → API Keys: the **publishable key** (`sb_publishable_…`). Never the secret key.
   - Local: `native/.env.local` (see `native/.env.example`).
   - Website: GitHub → Settings → Secrets and variables → Actions → **Variables**: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.

## Notes

- Free plan: plenty of room (analyses are tens of kilobytes each). A project with no activity for 7 days is paused (restore it from the dashboard); daily use keeps it awake.
- Without the two values, the app works as before, on the device only; the sync card doesn't show.
