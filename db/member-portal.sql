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
