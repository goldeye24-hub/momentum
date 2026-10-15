-- Momentum private keyword rank monitoring (run once in your own Supabase SQL Editor).
-- Service-role only: no public read policies. Never put service-role key in frontend.
create table if not exists public.rank_watch_targets (
 id uuid primary key default gen_random_uuid(),
 label text not null check (length(label) between 1 and 70),
 keyword text not null check (length(keyword) between 2 and 60),
 place_id text not null check (place_id ~ '^[0-9]{6,20}$'),
 scope text not null check (scope in ('map','integrated')),
 active boolean not null default true,
 last_run_at timestamptz,
 created_at timestamptz not null default now(),
 unique(keyword,place_id,scope)
);
create table if not exists public.rank_watch_observations (
 id bigint generated always as identity primary key,
 target_id uuid not null references public.rank_watch_targets(id) on delete cascade,
 rank integer check (rank is null or (rank between 1 and 500)),
 rank_approximate boolean not null default false,
 status text not null check (status in ('ranked','not_in_block','no_place_block','blocked','unavailable')),
 observed_count integer not null default 0 check (observed_count between 0 and 500),
 source text not null,
 scope text not null check (scope in ('map','integrated')),
 observed_at timestamptz not null default now()
);
create index if not exists rank_watch_observations_target_at_idx on public.rank_watch_observations(target_id,observed_at desc);
alter table public.rank_watch_targets enable row level security;
alter table public.rank_watch_observations enable row level security;
-- No anon/authenticated policies: only service-role server API may access these tables.

-- Safe upgrade for previously created pilot table.
alter table public.rank_watch_observations add column if not exists rank_approximate boolean not null default false;
