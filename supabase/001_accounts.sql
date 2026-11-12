-- Vanguard Table · step 1: accounts, roles and coins
-- Run once in Supabase: SQL Editor → New query → paste all of this → Run.
-- Safe to run again (it drops and recreates its own functions/policies, keeps the data).

-- ---------- profiles: one row per account ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default 'Fighter' check (char_length(name) between 1 and 20),
  color text not null default '#5fd0ff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  role text not null default 'player' check (role in ('player', 'admin')),
  coins integer not null default 0 check (coins >= 0),
  banned boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ---------- admin log: every admin action is written here ----------
create table if not exists public.admin_log (
  id bigint generated always as identity primary key,
  admin uuid references public.profiles on delete set null,
  action text not null,
  target uuid,
  detail jsonb,
  at timestamptz not null default now()
);
alter table public.admin_log enable row level security;

-- ---------- helpers ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not banned)
$$;

-- ---------- who can read / change what ----------
-- Everyone signed in can see fighter names, colors, roles and coins (for opponents and leaderboards later).
drop policy if exists "profiles: read" on public.profiles;
create policy "profiles: read" on public.profiles for select to authenticated using (true);

-- Players may only change their own name and color. Role, coins and bans only change through the admin functions below.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, color) on public.profiles to authenticated;
drop policy if exists "profiles: edit own" on public.profiles;
create policy "profiles: edit own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

revoke all on public.admin_log from anon, authenticated;
grant select on public.admin_log to authenticated;
drop policy if exists "admin_log: admins read" on public.admin_log;
create policy "admin_log: admins read" on public.admin_log for select to authenticated using (public.is_admin());

-- ---------- new account → profile (the very first account becomes admin) ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, color, role)
  values (
    new.id,
    coalesce(left(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 20), 'Fighter'),
    case when (new.raw_user_meta_data ->> 'color') ~ '^#[0-9a-fA-F]{6}$' then new.raw_user_meta_data ->> 'color' else '#5fd0ff' end,
    case when exists (select 1 from public.profiles) then 'player' else 'admin' end
  );
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- accounts made before this file was run get a profile now; the oldest becomes admin if there is no admin yet
insert into public.profiles (id, name, color, created_at)
select u.id,
  coalesce(left(nullif(trim(u.raw_user_meta_data ->> 'name'), ''), 20), 'Fighter'),
  case when (u.raw_user_meta_data ->> 'color') ~ '^#[0-9a-fA-F]{6}$' then u.raw_user_meta_data ->> 'color' else '#5fd0ff' end,
  u.created_at
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
update public.profiles set role = 'admin'
where not exists (select 1 from public.profiles where role = 'admin')
  and id = (select id from public.profiles order by created_at, id limit 1);

-- ---------- admin tools (checked on the server, players get "admins only") ----------
create or replace function public.admin_set_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if new_role not in ('player', 'admin') then raise exception 'unknown role %', new_role; end if;
  if target = auth.uid() and new_role <> 'admin' then raise exception 'you cannot remove your own admin role'; end if;
  update public.profiles set role = new_role where id = target;
  insert into public.admin_log (admin, action, target, detail) values (auth.uid(), 'set_role', target, jsonb_build_object('role', new_role));
end $$;

create or replace function public.admin_add_coins(target uuid, amount integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare left_coins integer;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.profiles set coins = greatest(0, coins + amount) where id = target returning coins into left_coins;
  insert into public.admin_log (admin, action, target, detail) values (auth.uid(), 'add_coins', target, jsonb_build_object('amount', amount, 'now', left_coins));
  return left_coins;
end $$;

create or replace function public.admin_set_banned(target uuid, value boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if target = auth.uid() then raise exception 'you cannot ban yourself'; end if;
  update public.profiles set banned = value where id = target;
  insert into public.admin_log (admin, action, target, detail) values (auth.uid(), 'set_banned', target, jsonb_build_object('banned', value));
end $$;

revoke execute on function public.is_admin(), public.handle_new_user(),
  public.admin_set_role(uuid, text), public.admin_add_coins(uuid, integer), public.admin_set_banned(uuid, boolean) from public, anon;
grant execute on function public.is_admin(), public.admin_set_role(uuid, text),
  public.admin_add_coins(uuid, integer), public.admin_set_banned(uuid, boolean) to authenticated;
