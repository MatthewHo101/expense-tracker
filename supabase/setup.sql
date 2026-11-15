-- Jam family workspace. Run this entire file once in the Supabase SQL Editor.
-- Safe to rerun: no personal data is removed.
begin;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.jam_families (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(name) between 1 and 60),
 currency text not null check (currency in ('USD','HKD','EUR','GBP')),
 monthly_budget bigint not null default 300000 check (monthly_budget between 0 and 100000000000),
 owner_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.jam_memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 family_id uuid not null references public.jam_families(id) on delete cascade,
 display_name text not null check (char_length(display_name) between 1 and 30),
 role text not null check (role in ('owner','member')),
 joined_at timestamptz not null default now()
);
create index if not exists jam_memberships_family_idx on public.jam_memberships(family_id);
create table if not exists public.jam_member_data (
 user_id uuid primary key references public.jam_memberships(user_id) on delete cascade,
 state jsonb not null check (jsonb_typeof(state)='object' and state->>'version'='1' and octet_length(state::text)<2000000),
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
create table if not exists public.jam_invites (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.jam_families(id) on delete cascade,
 email text not null,
 token_hash text not null unique,
 expires_at timestamptz not null default now()+interval '7 days',
 used_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);

-- Definer helpers avoid recursive membership RLS. No caller-supplied user ID.
create or replace function public.jam_family_id() returns uuid
language sql stable security definer set search_path=public,pg_temp
as $$ select family_id from public.jam_memberships where user_id=auth.uid() $$;

alter table public.jam_families enable row level security;
alter table public.jam_memberships enable row level security;
alter table public.jam_member_data enable row level security;
alter table public.jam_invites enable row level security;

drop policy if exists family_read on public.jam_families;
create policy family_read on public.jam_families for select to authenticated using (id=public.jam_family_id());
drop policy if exists members_read on public.jam_memberships;
create policy members_read on public.jam_memberships for select to authenticated using (family_id=public.jam_family_id());
drop policy if exists ledger_read on public.jam_member_data;
create policy ledger_read on public.jam_member_data for select to authenticated using (
 exists(select 1 from public.jam_memberships m where m.user_id=jam_member_data.user_id and m.family_id=public.jam_family_id())
);
-- Writes and invite access go through the authenticated, bounded RPC functions.
revoke all on public.jam_families,public.jam_memberships,public.jam_member_data,public.jam_invites from anon,authenticated;
grant select on public.jam_families,public.jam_memberships,public.jam_member_data to authenticated;

create or replace function public.jam_initial_state(p_name text,p_currency text) returns jsonb
language sql immutable set search_path=public,pg_temp as $$
 select jsonb_build_object('version',1,'name',p_name,'currency',p_currency,'budget',300000,'transactions','[]'::jsonb,'goals','[]'::jsonb,'demo',false)
$$;

create or replace function public.jam_create_family(p_name text,p_currency text,p_display_name text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 if exists(select 1 from public.jam_memberships where user_id=auth.uid()) then raise exception 'You already belong to a family.'; end if;
 insert into public.jam_families(name,currency,owner_id) values(trim(p_name),p_currency,auth.uid()) returning id into v_id;
 insert into public.jam_memberships(user_id,family_id,display_name,role) values(auth.uid(),v_id,trim(p_display_name),'owner');
 insert into public.jam_member_data(user_id,state) values(auth.uid(),public.jam_initial_state(trim(p_display_name),p_currency));
 return v_id;
end $$;

create or replace function public.jam_create_invite(p_email text) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_family uuid; v_token text; v_email text;
begin
 select family_id into v_family from public.jam_memberships where user_id=auth.uid() and role='owner';
 if v_family is null then raise exception 'Only the family owner can invite members.'; end if;
 v_email=lower(trim(p_email));
 if char_length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address.'; end if;
 v_token=encode(extensions.gen_random_bytes(24),'hex');
 insert into public.jam_invites(family_id,email,token_hash) values(v_family,v_email,encode(extensions.digest(v_token,'sha256'),'hex'));
 return v_token;
end $$;

create or replace function public.jam_accept_invite(p_token text,p_display_name text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_invite public.jam_invites%rowtype; v_email text; v_confirmed timestamptz; v_currency text;
begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 select lower(email),email_confirmed_at into v_email,v_confirmed from auth.users where id=auth.uid();
 if v_confirmed is null then raise exception 'Confirm your email address before joining a family.'; end if;
 if exists(select 1 from public.jam_memberships where user_id=auth.uid()) then raise exception 'You already belong to a family.'; end if;
 if char_length(p_token)<>48 then raise exception 'This invitation is invalid or expired.'; end if;
 select * into v_invite from public.jam_invites where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found or v_invite.expires_at<=now() or v_invite.used_by is not null or v_invite.email<>v_email then raise exception 'This invitation is invalid, expired, or belongs to a different email address.'; end if;
 select currency into v_currency from public.jam_families where id=v_invite.family_id;
 insert into public.jam_memberships(user_id,family_id,display_name,role) values(auth.uid(),v_invite.family_id,trim(p_display_name),'member');
 insert into public.jam_member_data(user_id,state) values(auth.uid(),public.jam_initial_state(trim(p_display_name),v_currency));
 update public.jam_invites set used_by=auth.uid() where id=v_invite.id;
 return v_invite.family_id;
end $$;

-- Validate the entire ledger so a malformed upload cannot break family reports.
create or replace function public.jam_valid_state(s jsonb) returns boolean
language plpgsql immutable set search_path=public,pg_temp as $$
declare t jsonb; g jsonb;
begin
 if jsonb_typeof(s) is distinct from 'object' or s->'version' is distinct from '1'::jsonb or s->'demo' is distinct from 'false'::jsonb or jsonb_typeof(s->'name') is distinct from 'string' or char_length(trim(s->>'name')) not between 1 and 30 or s->>'currency' not in ('USD','HKD','EUR','GBP') or jsonb_typeof(s->'budget') is distinct from 'number' or (s->>'budget') !~ '^[0-9]+$' or (s->>'budget')::numeric>100000000000 then return false; end if;
 if jsonb_typeof(s->'transactions') is distinct from 'array' or jsonb_typeof(s->'goals') is distinct from 'array' then return false; end if;
 if jsonb_array_length(s->'transactions')>20000 or jsonb_array_length(s->'goals')>200 then return false; end if;
 if exists(select 1 from jsonb_array_elements(s->'transactions') x group by x->>'id' having count(*)>1) or exists(select 1 from jsonb_array_elements(s->'goals') x group by x->>'id' having count(*)>1) then return false; end if;
 for g in select * from jsonb_array_elements(s->'goals') loop
  if jsonb_typeof(g->'id') is distinct from 'string' or char_length(g->>'id') not between 1 and 128 or jsonb_typeof(g->'name') is distinct from 'string' or char_length(g->>'name') not between 1 and 40 or jsonb_typeof(g->'emoji') is distinct from 'string' or char_length(g->>'emoji') not between 1 and 24 or jsonb_typeof(g->'saved') is distinct from 'number' or (g->>'saved') !~ '^[0-9]+$' or (g->>'saved')::numeric>100000000000 or jsonb_typeof(g->'target') is distinct from 'number' or (g->>'target') !~ '^[0-9]+$' or (g->>'target')::numeric not between 1 and 100000000000 then return false; end if;
 end loop;
 for t in select * from jsonb_array_elements(s->'transactions') loop
  if jsonb_typeof(t->'id') is distinct from 'string' or char_length(t->>'id') not between 1 and 128 or jsonb_typeof(t->'title') is distinct from 'string' or char_length(t->>'title') not between 1 and 100 or jsonb_typeof(t->'note') is distinct from 'string' or char_length(t->>'note')>300 or jsonb_typeof(t->'amount') is distinct from 'number' or (t->>'amount') !~ '^[0-9]+$' or (t->>'amount')::numeric not between 1 and 100000000000 or (t->>'type') is null or (t->>'type') not in ('income','expense','saving','withdrawal') or (t->>'category') is null or (t->>'category') not in ('Food & drink','Shopping','Home','Transport','Entertainment','Health','Other') or (t->>'date') is null or (t->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char((t->>'date')::date,'YYYY-MM-DD')<>t->>'date' then return false; end if;
  if t->>'type' in ('saving','withdrawal') and not exists(select 1 from jsonb_array_elements(s->'goals') x where x->>'id'=t->>'goalId') then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;

create or replace function public.jam_save_state(p_state jsonb,p_expected_revision integer) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_revision integer; v_currency text;
begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 select f.currency into v_currency from public.jam_families f where f.id=public.jam_family_id();
 if v_currency is null then raise exception 'Join a family first.'; end if;
 if not public.jam_valid_state(p_state) then raise exception 'Invalid Jam data. Restore a valid backup.'; end if;
 if p_state->>'version' is distinct from '1' or p_state->>'currency' is distinct from v_currency or jsonb_typeof(p_state->'transactions') is distinct from 'array' or jsonb_typeof(p_state->'goals') is distinct from 'array' or jsonb_typeof(p_state->'name') is distinct from 'string' or char_length(trim(p_state->>'name')) not between 1 and 30 or p_state->>'demo' is distinct from 'false' or jsonb_typeof(p_state->'budget') is distinct from 'number' or (p_state->>'budget') !~ '^[0-9]+$' then raise exception 'Invalid Jam data or a different family currency.'; end if;
 if exists(select 1 from jsonb_array_elements(p_state->'transactions') t where jsonb_typeof(t->'amount') is distinct from 'number' or (t->>'amount') !~ '^[0-9]+$' or (t->>'type') not in ('income','expense','saving','withdrawal') or t->>'type' is null) then raise exception 'Invalid transaction data.'; end if;
 update public.jam_member_data set state=p_state,revision=revision+1,updated_at=now() where user_id=auth.uid() and revision=p_expected_revision returning revision into v_revision;
 if v_revision is null then raise exception 'Another device has newer changes. Reload before saving again.'; end if;
 update public.jam_memberships set display_name=trim(p_state->>'name') where user_id=auth.uid();
 return v_revision;
end $$;

create or replace function public.jam_update_family_budget(p_budget bigint) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_budget<0 or p_budget>100000000000 then raise exception 'Enter a valid budget.'; end if;
 update public.jam_families set monthly_budget=p_budget where id=public.jam_family_id() and owner_id=auth.uid();
 if not found then raise exception 'Only the family owner can change the shared budget.'; end if;
end $$;

revoke execute on function public.jam_valid_state(jsonb),public.jam_family_id(),public.jam_initial_state(text,text),public.jam_create_family(text,text,text),public.jam_create_invite(text),public.jam_accept_invite(text,text),public.jam_save_state(jsonb,integer),public.jam_update_family_budget(bigint) from public,anon;
grant execute on function public.jam_family_id(),public.jam_create_family(text,text,text),public.jam_create_invite(text),public.jam_accept_invite(text,text),public.jam_save_state(jsonb,integer),public.jam_update_family_budget(bigint) to authenticated;
commit;
notify pgrst,'reload schema';
