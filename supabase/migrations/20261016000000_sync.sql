-- Chess Trainer: what is shared between devices (phone, PC) for a signed-in
-- player (Google). Paste into the Supabase SQL editor once.
--
-- analyses:  one row per analysed game (the games themselves are
--            re-fetched from chess.com on each device).
-- documents: the app's small stores, one row per storage key: exercise and
--            repertoire progress, the day's session, level, streak…
-- Every row belongs to its user (row level security); updated_at is set by
-- the server, so that each device can pull what changed since its last sync.

create table if not exists public.analyses (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,                  -- the game's URL
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.documents (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,                  -- the storage key (chess.progress.v1…)
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists analyses_updated on public.analyses (user_id, updated_at);
create index if not exists documents_updated on public.documents (user_id, updated_at);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists analyses_touch on public.analyses;
create trigger analyses_touch before insert or update on public.analyses
  for each row execute function public.touch_updated_at();
drop trigger if exists documents_touch on public.documents;
create trigger documents_touch before insert or update on public.documents
  for each row execute function public.touch_updated_at();

alter table public.analyses enable row level security;
alter table public.documents enable row level security;

drop policy if exists "own analyses" on public.analyses;
create policy "own analyses" on public.analyses
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own documents" on public.documents;
create policy "own documents" on public.documents
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
