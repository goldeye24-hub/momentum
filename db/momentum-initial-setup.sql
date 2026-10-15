-- Momentum Marketing — first-time Supabase installation
-- Intended only for the freshly created, separate momentum-marketing project.
-- Existing unrelated Supabase projects are NOT affected.
-- All 4 modules are applied in one SQL Editor execution.
-- Do not paste service-role API keys into this script.
-- Source: https://github.com/goldeye24-hub/momentum
-- Re-run only after reviewing migration changes; this is an initial install.
BEGIN;


-- ================================================================
-- MODULE 1: db/rank-watch.sql
-- ================================================================
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


-- ================================================================
-- MODULE 2: db/rank-live-cache.sql
-- ================================================================
-- Optional shared traffic protection for Momentum rank beta.
-- Run in the SAME private Supabase project as db/rank-watch.sql.
-- Tables are service-role only; no frontend/anon/authenticated policies.
create table if not exists public.rank_live_snapshots (
 cache_key text primary key check (cache_key ~ '^[a-f0-9]{64}$'),
 payload jsonb not null,
 recorded_at timestamptz not null,
 expires_at timestamptz not null,
 updated_at timestamptz not null default now()
);
create index if not exists rank_live_snapshots_expiry_idx on public.rank_live_snapshots(expires_at);
alter table public.rank_live_snapshots enable row level security;
create table if not exists public.rank_live_source_gate (
 source text primary key check (source in ('mobile','map','integrated')),
 blocked_until timestamptz not null default '-infinity'::timestamptz,
 next_request_at timestamptz not null default '-infinity'::timestamptz
);
alter table public.rank_live_source_gate enable row level security;

-- One database transaction serializes first-party requests across server instances.
-- A claim deliberately does NOT circumvent a provider's restriction.
create or replace function public.momentum_rank_claim(
 p_source text,
 p_gap_seconds integer default 60
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
 v_gate public.rank_live_source_gate%rowtype;
 v_now timestamptz := clock_timestamp();
 v_wait integer;
begin
 if p_source not in ('mobile','map','integrated') or p_gap_seconds not between 30 and 3600 then
  raise exception 'invalid gate request';
 end if;
 insert into public.rank_live_source_gate(source) values (p_source) on conflict do nothing;
 select * into v_gate from public.rank_live_source_gate where source=p_source for update;
 if v_gate.blocked_until>v_now then
  v_wait:=greatest(1,ceil(extract(epoch from v_gate.blocked_until-v_now))::integer);
  return jsonb_build_object('state','blocked','retryAfterSeconds',v_wait);
 end if;
 if v_gate.next_request_at>v_now then
  v_wait:=greatest(1,ceil(extract(epoch from v_gate.next_request_at-v_now))::integer);
  return jsonb_build_object('state','busy','retryAfterSeconds',v_wait);
 end if;
 update public.rank_live_source_gate
   set next_request_at=v_now+make_interval(secs=>p_gap_seconds)
   where source=p_source;
 return jsonb_build_object('state','allowed');
end;
$$;

create or replace function public.momentum_rank_block(
 p_source text,
 p_seconds integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_until timestamptz;
begin
 if p_source not in ('mobile','map','integrated') or p_seconds not between 60 and 86400 then
  raise exception 'invalid cooldown request';
 end if;
 insert into public.rank_live_source_gate(source) values (p_source) on conflict do nothing;
 update public.rank_live_source_gate
   set blocked_until=greatest(blocked_until,clock_timestamp()+make_interval(secs=>p_seconds))
   where source=p_source
   returning blocked_until into v_until;
 return jsonb_build_object('state','blocked','blockedUntil',v_until);
end;
$$;

revoke all on public.rank_live_snapshots from PUBLIC,anon,authenticated;
revoke all on public.rank_live_source_gate from PUBLIC,anon,authenticated;
revoke all on function public.momentum_rank_claim(text,integer) from PUBLIC,anon,authenticated;
revoke all on function public.momentum_rank_block(text,integer) from PUBLIC,anon,authenticated;
grant select,insert,update on public.rank_live_snapshots to service_role;
grant select,insert,update on public.rank_live_source_gate to service_role;
grant execute on function public.momentum_rank_claim(text,integer) to service_role;
grant execute on function public.momentum_rank_block(text,integer) to service_role;


-- ================================================================
-- MODULE 3: db/rank-keyword-history.sql
-- ================================================================
-- Internal, evidence-backed mobile keyword snapshots for Momentum.
-- Apply privately in the SAME Supabase project as db/rank-live-cache.sql.
-- Only the server service_role can read or write. No direct customer access.
create table if not exists public.rank_keyword_snapshots (
 id uuid primary key default gen_random_uuid(),
 keyword text not null check (length(keyword) between 2 and 60),
 scope text not null default 'mobile' check (scope='mobile'),
 observed_at timestamptz not null,
 observed_count integer not null check (observed_count between 1 and 100),
 max_observed_rank integer check (max_observed_rank between 1 and 500),
 source text not null default 'browser_observed' check (source='browser_observed'),
 created_at timestamptz not null default now(),
 unique(keyword,scope,observed_at)
);
create index if not exists rank_keyword_snapshots_find_idx
 on public.rank_keyword_snapshots(keyword,scope,observed_at desc);

create table if not exists public.rank_keyword_entries (
 snapshot_id uuid not null references public.rank_keyword_snapshots(id) on delete cascade,
 place_id text not null check (place_id ~ '^[0-9]{6,20}$'),
 place_name text not null check (length(place_name) between 1 and 70),
 rank integer not null check (rank between 1 and 500),
 rank_approximate boolean not null default false,
 rank_basis text not null check (rank_basis in ('provider_list_position','visible_list_position_estimate')),
 primary key(snapshot_id,place_id)
);
create index if not exists rank_keyword_entries_place_idx on public.rank_keyword_entries(place_id,snapshot_id);
alter table public.rank_keyword_snapshots enable row level security;
alter table public.rank_keyword_entries enable row level security;
revoke all on public.rank_keyword_snapshots from PUBLIC,anon,authenticated;
revoke all on public.rank_keyword_entries from PUBLIC,anon,authenticated;
grant select,insert on public.rank_keyword_snapshots to service_role;
grant select,insert on public.rank_keyword_entries to service_role;

-- Store a complete list atomically and idempotently. Never accept a guessed rank.
create or replace function public.momentum_save_keyword_snapshot(
 p_keyword text, p_observed_at timestamptz, p_entries jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare
 v_id uuid;
 v_entry jsonb;
 v_count integer;
 v_place_id text;
 v_name text;
 v_rank integer;
 v_basis text;
 v_approx boolean;
begin
 if p_keyword is null or length(trim(p_keyword)) not between 2 and 60
    or p_observed_at is null or p_observed_at>clock_timestamp()+interval '5 minutes'
    or p_entries is null or jsonb_typeof(p_entries)<>'array' then
  raise exception 'invalid keyword snapshot';
 end if;
 v_count:=jsonb_array_length(p_entries);
 if v_count<1 or v_count>100 then raise exception 'invalid observation count';end if;
 insert into public.rank_keyword_snapshots(keyword,scope,observed_at,observed_count,max_observed_rank)
 values(trim(p_keyword),'mobile',p_observed_at,v_count,null)
 on conflict (keyword,scope,observed_at) do nothing returning id into v_id;
 if v_id is null then
  select id into v_id from public.rank_keyword_snapshots
    where keyword=trim(p_keyword) and scope='mobile' and observed_at=p_observed_at;
  return v_id;
 end if;
 for v_entry in select value from jsonb_array_elements(p_entries)
 loop
  v_place_id:=v_entry->>'placeId';
  v_name:=left(trim(coalesce(v_entry->>'name','')),70);
  v_basis:=v_entry->>'rankBasis';
  v_approx:=coalesce((v_entry->>'approximate')::boolean,false);
  if v_place_id is null or v_place_id !~ '^[0-9]{6,20}$'
     or length(v_name)<1 or (v_entry->>'rank') !~ '^[0-9]{1,3}$'
     or v_basis not in ('provider_list_position','visible_list_position_estimate') then
   raise exception 'invalid observed entry';
  end if;
  v_rank:=(v_entry->>'rank')::integer;
  if v_rank<1 or v_rank>500 then raise exception 'invalid observed rank';end if;
  insert into public.rank_keyword_entries(snapshot_id,place_id,place_name,rank,rank_approximate,rank_basis)
   values(v_id,v_place_id,v_name,v_rank,v_approx,v_basis)
   on conflict(snapshot_id,place_id) do nothing;
 end loop;
 update public.rank_keyword_snapshots
  set max_observed_rank=(select max(rank) from public.rank_keyword_entries where snapshot_id=v_id)
  where id=v_id;
 return v_id;
end;
$$;
revoke all on function public.momentum_save_keyword_snapshot(text,timestamptz,jsonb)
 from PUBLIC,anon,authenticated;
grant execute on function public.momentum_save_keyword_snapshot(text,timestamptz,jsonb)
 to service_role;

-- Latest valid observation per Korea-local calendar date.
-- This avoids accidentally truncating older dates when many observations
-- are captured on one day; only actual saved snapshots are returned.
create or replace function public.momentum_keyword_latest_days(
 p_keyword text,p_days integer default 7
) returns table(
 id uuid,keyword text,scope text,observed_at timestamptz,
 observed_count integer,max_observed_rank integer
) language sql stable security definer set search_path=public as $$
 select d.id,d.keyword,d.scope,d.observed_at,d.observed_count,d.max_observed_rank
 from (
  select distinct on ((s.observed_at at time zone 'Asia/Seoul')::date)
    s.id,s.keyword,s.scope,s.observed_at,s.observed_count,s.max_observed_rank,
    (s.observed_at at time zone 'Asia/Seoul')::date as local_day
  from public.rank_keyword_snapshots s
  where s.keyword=trim(p_keyword) and s.scope='mobile'
    and p_days in (7,30,90)
    and (s.observed_at at time zone 'Asia/Seoul')::date >=
      ((now() at time zone 'Asia/Seoul')::date-(p_days-1))
    and (s.observed_at at time zone 'Asia/Seoul')::date <=
      (now() at time zone 'Asia/Seoul')::date
  order by (s.observed_at at time zone 'Asia/Seoul')::date desc,s.observed_at desc
 ) d order by d.observed_at desc limit p_days;
$$;
revoke all on function public.momentum_keyword_latest_days(text,integer)
 from PUBLIC,anon,authenticated;
grant execute on function public.momentum_keyword_latest_days(text,integer)
 to service_role;

-- Compare two exact Place IDs using the SAME latest observed snapshot for each
-- keyword. A NULL rank means "not found among observed rows", NOT "unranked".
create or replace function public.momentum_compare_places(
 p_place_a text,p_place_b text,p_days integer default 30
) returns table(
 keyword text,observed_at timestamptz,
 rank_a integer,rank_b integer,
 approximate_a boolean,approximate_b boolean,
 name_a text,name_b text
) language sql stable security definer set search_path=public as $$
 with latest as (
  select distinct on (s.keyword) s.id,s.keyword,s.observed_at
  from public.rank_keyword_snapshots s
  where s.scope='mobile'
    and p_days in (7,30,90)
    and p_place_a ~ '^[0-9]{6,20}$' and p_place_b ~ '^[0-9]{6,20}$'
    and p_place_a<>p_place_b
    and (s.observed_at at time zone 'Asia/Seoul')::date >=
     ((now() at time zone 'Asia/Seoul')::date-(p_days-1))
  order by s.keyword,s.observed_at desc
 )
 select s.keyword,s.observed_at,
  max(e.rank) filter(where e.place_id=p_place_a)::integer as rank_a,
  max(e.rank) filter(where e.place_id=p_place_b)::integer as rank_b,
  bool_or(e.rank_approximate) filter(where e.place_id=p_place_a) as approximate_a,
  bool_or(e.rank_approximate) filter(where e.place_id=p_place_b) as approximate_b,
  max(e.place_name) filter(where e.place_id=p_place_a) as name_a,
  max(e.place_name) filter(where e.place_id=p_place_b) as name_b
 from latest s join public.rank_keyword_entries e on e.snapshot_id=s.id
  and e.place_id in (p_place_a,p_place_b)
 group by s.keyword,s.observed_at
 order by s.keyword asc
 limit 300;
$$;
revoke all on function public.momentum_compare_places(text,text,integer)
 from PUBLIC,anon,authenticated;
grant execute on function public.momentum_compare_places(text,text,integer)
 to service_role;

-- What keywords actually have any observations of this exact Place ID?
-- Consider the last TWO full snapshots for each keyword, including cases
-- where this Place ID is absent in the latest snapshot.
create or replace function public.momentum_place_keyword_insights(
 p_place_id text,p_days integer default 30
) returns table(
 keyword text,
 latest_observed_at timestamptz,previous_observed_at timestamptz,
 latest_rank integer,previous_rank integer,
 latest_approximate boolean,previous_approximate boolean,
 matched_name text
) language sql stable security definer set search_path=public as $$
 with eligible as (
  select distinct s.keyword
  from public.rank_keyword_entries e
  join public.rank_keyword_snapshots s on s.id=e.snapshot_id
  where e.place_id=p_place_id
   and p_place_id ~ '^[0-9]{6,20}$'
   and p_days in (7,30,90)
   and (s.observed_at at time zone 'Asia/Seoul')::date >=
     ((now() at time zone 'Asia/Seoul')::date-(p_days-1))
 ),
 numbered as (
  select s.keyword,s.observed_at,e.rank,e.rank_approximate,e.place_name,
   row_number() over (partition by s.keyword order by s.observed_at desc) as seq
  from public.rank_keyword_snapshots s
  join eligible k on k.keyword=s.keyword
  left join public.rank_keyword_entries e on e.snapshot_id=s.id and e.place_id=p_place_id
  where s.scope='mobile'
   and (s.observed_at at time zone 'Asia/Seoul')::date >=
     ((now() at time zone 'Asia/Seoul')::date-(p_days-1))
 ),
 paired as (
  select keyword,
   max(observed_at) filter(where seq=1) as latest_observed_at,
   max(observed_at) filter(where seq=2) as previous_observed_at,
   max(rank) filter(where seq=1) as latest_rank,
   max(rank) filter(where seq=2) as previous_rank,
   bool_or(rank_approximate) filter(where seq=1) as latest_approximate,
   bool_or(rank_approximate) filter(where seq=2) as previous_approximate,
   max(place_name) as matched_name
  from numbered where seq<=2 group by keyword
 )
 select p.keyword,p.latest_observed_at,p.previous_observed_at,
  p.latest_rank,p.previous_rank,p.latest_approximate,p.previous_approximate,
  p.matched_name
 from paired p
 order by case when p.latest_rank is null then 1 else 0 end,
  p.latest_rank nulls last,p.keyword
 limit 300;
$$;
revoke all on function public.momentum_place_keyword_insights(text,integer)
 from PUBLIC,anon,authenticated;
grant execute on function public.momentum_place_keyword_insights(text,integer)
 to service_role;


-- ================================================================
-- MODULE 4: db/member-portal.sql
-- ================================================================
-- Momentum member accounts and subscription slot foundation.
-- Install in Supabase AFTER db/rank-keyword-history.sql.
-- ALL customer data is accessed only by server service_role after verifying
-- an HMAC-signed HttpOnly member session. No anon/authenticated table policies.
create table if not exists public.momentum_member_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null check(length(email) between 3 and 254),
 plan text not null default 'free' check(plan in ('free','basic','pro','agency')),
 slot_limit integer not null default 1 check(slot_limit between 1 and 10000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.momentum_member_targets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.momentum_member_accounts(user_id) on delete cascade,
 label text not null check(length(label) between 1 and 70),
 keyword text not null check(length(keyword) between 2 and 60),
 place_id text check(place_id ~ '^[0-9]{6,20}$'),
 target_name text check(length(target_name) between 2 and 70),
 scope text not null default 'mobile' check(scope in ('mobile','map','integrated')),
 created_at timestamptz not null default now(),
 constraint member_target_exactly_one check(
  (place_id is not null and target_name is null) or
  (place_id is null and target_name is not null and scope='mobile')
 )
);
create unique index if not exists member_targets_unique_key on public.momentum_member_targets
 (owner_id,keyword,scope,coalesce(place_id,lower(target_name)));
create index if not exists member_targets_owner_idx on public.momentum_member_targets(owner_id,created_at desc);
alter table public.momentum_member_accounts enable row level security;
alter table public.momentum_member_targets enable row level security;
revoke all on public.momentum_member_accounts from PUBLIC,anon,authenticated;
revoke all on public.momentum_member_targets from PUBLIC,anon,authenticated;
grant select,insert,update,delete on public.momentum_member_accounts to service_role;
grant select,insert,update,delete on public.momentum_member_targets to service_role;

-- Registration creates a free account. No customer-facing function can change
-- the plan or slot limit. Those require a separate audited admin/billing action.
create or replace function public.momentum_member_ensure(
 p_user uuid,p_email text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_member public.momentum_member_accounts%rowtype;
begin
 if p_user is null or p_email is null or length(trim(p_email)) not between 3 and 254
 then raise exception 'invalid member identity';end if;
 insert into public.momentum_member_accounts(user_id,email)
 values(p_user,lower(trim(p_email)))
 on conflict(user_id) do update
  set email=excluded.email,updated_at=now();
 select * into v_member from public.momentum_member_accounts where user_id=p_user;
 return jsonb_build_object('userId',v_member.user_id,'email',v_member.email,
  'plan',v_member.plan,'slotLimit',v_member.slot_limit);
end;
$$;

-- A per-owner transaction advisory lock guarantees two concurrent submissions
-- cannot consume the same final slot.
create or replace function public.momentum_member_add_target(
 p_user uuid,p_label text,p_keyword text,p_place_id text,
 p_target_name text,p_scope text default 'mobile'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_limit integer;v_used integer;v_row public.momentum_member_targets%rowtype;
begin
 if p_user is null then raise exception 'invalid user';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select slot_limit into v_limit from public.momentum_member_accounts where user_id=p_user;
 if v_limit is null then raise exception 'member_not_found';end if;
 select count(*) into v_used from public.momentum_member_targets where owner_id=p_user;
 if v_used>=v_limit then raise exception 'slot_limit_reached';end if;
 if p_label is null or length(trim(p_label)) not between 1 and 70
  or p_keyword is null or length(trim(p_keyword)) not between 2 and 60
  or p_scope not in ('mobile','map','integrated')
  or not (
   (p_place_id ~ '^[0-9]{6,20}$' and p_target_name is null) or
   (p_place_id is null and p_scope='mobile'
    and p_target_name is not null and length(trim(p_target_name)) between 2 and 70)
  )
 then raise exception 'invalid_target';end if;
 insert into public.momentum_member_targets(
  owner_id,label,keyword,place_id,target_name,scope
 ) values(p_user,trim(p_label),trim(p_keyword),p_place_id,
          nullif(trim(p_target_name),''),p_scope)
 returning * into v_row;
 return to_jsonb(v_row);
end;
$$;

create or replace function public.momentum_member_remove_target(
 p_user uuid,p_target uuid
) returns boolean language plpgsql security definer set search_path=public as $$
declare v_deleted integer;
begin
 if p_user is null or p_target is null then return false;end if;
 delete from public.momentum_member_targets
  where owner_id=p_user and id=p_target;
 get diagnostics v_deleted=row_count;
 return v_deleted=1;
end;
$$;

-- Show only the member's saved targets, with the LAST OBSERVED keyword-list
-- snapshot when one exists; missing Place IDs are NOT assigned fictitious ranks.
create or replace function public.momentum_member_overview(
 p_user uuid
) returns table(
 id uuid,label text,keyword text,place_id text,target_name text,
 scope text,created_at timestamptz,observed_at timestamptz,
 observed_count integer,rank integer,rank_approximate boolean
) language sql stable security definer set search_path=public as $$
 select t.id,t.label,t.keyword,t.place_id,t.target_name,t.scope,t.created_at,
  s.observed_at,s.observed_count,e.rank,e.rank_approximate
 from public.momentum_member_targets t
 left join lateral (
  select snap.id,snap.observed_at,snap.observed_count
  from public.rank_keyword_snapshots snap
  where snap.keyword=t.keyword and snap.scope='mobile' and t.scope='mobile'
  order by snap.observed_at desc limit 1
 ) s on true
 left join public.rank_keyword_entries e on e.snapshot_id=s.id and e.place_id=t.place_id
 where t.owner_id=p_user and p_user is not null
 order by t.created_at desc;
$$;

revoke all on function public.momentum_member_ensure(uuid,text) from PUBLIC,anon,authenticated;
revoke all on function public.momentum_member_add_target(uuid,text,text,text,text,text)
 from PUBLIC,anon,authenticated;
revoke all on function public.momentum_member_remove_target(uuid,uuid)
 from PUBLIC,anon,authenticated;
revoke all on function public.momentum_member_overview(uuid)
 from PUBLIC,anon,authenticated;
grant execute on function public.momentum_member_ensure(uuid,text) to service_role;
grant execute on function public.momentum_member_add_target(uuid,text,text,text,text,text) to service_role;
grant execute on function public.momentum_member_remove_target(uuid,uuid) to service_role;
grant execute on function public.momentum_member_overview(uuid) to service_role;


-- Internal operator-only pilot controls. These do not charge customers,
-- confirm a subscription, or change the billing plan.
create table if not exists public.momentum_member_slot_audit (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.momentum_member_accounts(user_id) on delete cascade,
 old_limit integer not null,
 new_limit integer not null,
 reason text not null check(length(reason) between 5 and 200),
 performed_by text not null default 'momentum_admin',
 created_at timestamptz not null default now()
);
alter table public.momentum_member_slot_audit enable row level security;
revoke all on public.momentum_member_slot_audit from PUBLIC,anon,authenticated;
grant select,insert on public.momentum_member_slot_audit to service_role;
grant usage,select on sequence public.momentum_member_slot_audit_id_seq to service_role;

create or replace function public.momentum_admin_member_summary()
returns table(
 user_id uuid,email text,plan text,slot_limit integer,
 used_slots bigint,created_at timestamptz
) language sql stable security definer set search_path=public as $$
 select a.user_id,a.email,a.plan,a.slot_limit,
  (select count(*) from public.momentum_member_targets t where t.owner_id=a.user_id),
  a.created_at
 from public.momentum_member_accounts a
 order by a.created_at desc limit 100;
$$;

create or replace function public.momentum_admin_set_pilot_slots(
 p_user uuid,p_limit integer,p_reason text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_previous integer;v_used integer;v_plan text;
begin
 if p_user is null or p_limit is null or p_limit<1 or p_limit>200
  or p_reason is null or length(trim(p_reason)) not between 5 and 200
 then raise exception 'invalid_pilot_slot_change';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select slot_limit,plan into v_previous,v_plan from public.momentum_member_accounts
  where user_id=p_user for update;
 if not found then raise exception 'member_not_found';end if;
 -- Only free beta accounts can receive manual test slots. Paid entitlements
 -- must later be based on verified payment events, never an operator shortcut.
 if v_plan<>'free' then raise exception 'paid_plan_managed_by_billing';end if;
 select count(*) into v_used from public.momentum_member_targets where owner_id=p_user;
 if p_limit<v_used then raise exception 'pilot_limit_below_existing_use';end if;
 if p_limit<>v_previous then
  update public.momentum_member_accounts set slot_limit=p_limit,updated_at=now()
   where user_id=p_user;
  insert into public.momentum_member_slot_audit(user_id,old_limit,new_limit,reason)
   values(p_user,v_previous,p_limit,trim(p_reason));
 end if;
 return jsonb_build_object('userId',p_user,'plan','free',
  'slotLimit',p_limit,'usedSlots',v_used,'previousLimit',v_previous);
end;
$$;
revoke all on function public.momentum_admin_member_summary()
 from PUBLIC,anon,authenticated;
revoke all on function public.momentum_admin_set_pilot_slots(uuid,integer,text)
 from PUBLIC,anon,authenticated;
grant execute on function public.momentum_admin_member_summary() to service_role;
grant execute on function public.momentum_admin_set_pilot_slots(uuid,integer,text)
 to service_role;


-- Owner-scoped daily history from the same real mobile keyword-list snapshots.
-- Includes unobserved calendar days as NULL: never backfill guessed rankings.
create or replace function public.momentum_member_daily_history(
 p_user uuid,p_target uuid,p_days integer default 30
) returns table(
 observation_date date,observed_at timestamptz,observed_count integer,
 rank integer,rank_approximate boolean,rank_basis text
) language sql stable security definer set search_path=public as $$
 with owned as (
  select t.keyword,t.place_id
  from public.momentum_member_targets t
  where t.owner_id=p_user and t.id=p_target
    and t.scope='mobile' and t.place_id is not null
    and p_days in (7,30,90)
 ), calendar as (
  select generate_series(
   (now() at time zone 'Asia/Seoul')::date - (p_days-1),
   (now() at time zone 'Asia/Seoul')::date,interval '1 day'
  )::date as observation_date
  where exists(select 1 from owned)
 ), daily as (
  select distinct on ((s.observed_at at time zone 'Asia/Seoul')::date)
    (s.observed_at at time zone 'Asia/Seoul')::date as local_day,
    s.id,s.observed_at,s.observed_count
  from public.rank_keyword_snapshots s
  join owned t on s.keyword=t.keyword and s.scope='mobile'
  where (s.observed_at at time zone 'Asia/Seoul')::date >=
    ((now() at time zone 'Asia/Seoul')::date-(p_days-1))
  order by (s.observed_at at time zone 'Asia/Seoul')::date desc,s.observed_at desc
 )
 select c.observation_date,d.observed_at,d.observed_count,
  e.rank,e.rank_approximate,e.rank_basis
 from calendar c
 left join daily d on d.local_day=c.observation_date
 left join owned t on true
 left join public.rank_keyword_entries e
  on e.snapshot_id=d.id and e.place_id=t.place_id
 order by c.observation_date asc;
$$;
revoke all on function public.momentum_member_daily_history(uuid,uuid,integer)
 from PUBLIC,anon,authenticated;
grant execute on function public.momentum_member_daily_history(uuid,uuid,integer)
 to service_role;

COMMIT;
