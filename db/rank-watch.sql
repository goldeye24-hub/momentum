-- Momentum private keyword rank monitoring (run once in your Supabase SQL Editor).
-- Service-role only; do not create anonymous user-facing read/write policies.
create table if not exists public.rank_watch_targets (
 id uuid primary key default gen_random_uuid(),
 label text not null check (length(label) between 1 and 70),
 keyword text not null check (length(keyword) between 2 and 60),
 place_id text check (place_id ~ '^[0-9]{6,20}$'),
 target_name text check (length(target_name) between 2 and 70),
 scope text not null check (scope in ('mobile','map','integrated')),
 active boolean not null default true,
 last_run_at timestamptz,
 created_at timestamptz not null default now(),
 constraint rank_watch_targets_target_check check (
  (place_id is not null and target_name is null) or
  (place_id is null and target_name is not null)
 ),
 unique(keyword,place_id,scope)
);

create table if not exists public.rank_watch_observations (
 id bigint generated always as identity primary key,
 target_id uuid not null references public.rank_watch_targets(id) on delete cascade,
 rank integer check (rank is null or rank between 1 and 500),
 rank_approximate boolean not null default false,
 status text not null check (status in ('ranked','not_in_block','no_place_block','blocked','unavailable')),
 observed_count integer not null default 0 check (observed_count between 0 and 500),
 source text not null,
 scope text not null check (scope in ('mobile','map','integrated')),
 observed_at timestamptz not null default now()
);
create index if not exists rank_watch_observations_target_at_idx on public.rank_watch_observations(target_id,observed_at desc);
alter table public.rank_watch_targets enable row level security;
alter table public.rank_watch_observations enable row level security;
-- Existing pilot installations: idempotent upgrades, never delete observations.
alter table public.rank_watch_observations add column if not exists rank_approximate boolean not null default false;
alter table public.rank_watch_targets add column if not exists target_name text;
alter table public.rank_watch_targets alter column place_id drop not null;
alter table public.rank_watch_targets drop constraint if exists rank_watch_targets_scope_check;
alter table public.rank_watch_targets add constraint rank_watch_targets_scope_check check (scope in ('mobile','map','integrated'));
alter table public.rank_watch_observations drop constraint if exists rank_watch_observations_scope_check;
alter table public.rank_watch_observations add constraint rank_watch_observations_scope_check check (scope in ('mobile','map','integrated'));
alter table public.rank_watch_targets drop constraint if exists rank_watch_targets_target_check;
alter table public.rank_watch_targets add constraint rank_watch_targets_target_check check (
 (place_id is not null and place_id ~ '^[0-9]{6,20}$' and target_name is null) or
 (place_id is null and target_name is not null and length(target_name) between 2 and 70)
);
create unique index if not exists rank_watch_targets_name_scope_unique
 on public.rank_watch_targets(keyword,target_name,scope) where target_name is not null;
