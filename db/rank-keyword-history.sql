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
