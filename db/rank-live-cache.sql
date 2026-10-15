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
