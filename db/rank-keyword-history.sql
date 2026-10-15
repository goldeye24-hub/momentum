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
