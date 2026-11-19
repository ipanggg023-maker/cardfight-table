-- Vanguard Table · step 8: boss events
-- Run after 007: SQL Editor → New query → paste all of this → Run. Safe to run again.
-- An admin opens a boss (the bot with a deck copied into the event, a level and advantages) for a limited time.
-- A player who beats it gets the reward once per event, only while it is open; coins are decided here, never in the browser.

create table if not exists public.bosses (
  id bigserial primary key,
  name text not null check (char_length(name) between 1 and 60),
  blurb text not null default '',
  deck jsonb not null,                                  -- the deck layout {name, format, energy, ride[], main[], g[], starter} with card ids
  level text not null default 'normal' check (level in ('easy', 'normal')),
  adv jsonb not null default '{}'::jsonb,               -- advantages {maxDamage?, extraDraw?, vcPower?}
  reward int not null default 0 check (reward >= 0 and reward <= 100000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default now() + interval '7 days',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.bosses enable row level security;
revoke all on public.bosses from anon, authenticated;
grant select on public.bosses to authenticated;
grant insert, update, delete on public.bosses to authenticated;   -- the policies below let only admins write
grant usage, select on sequence public.bosses_id_seq to authenticated;
drop policy if exists "bosses: signed in read" on public.bosses;
create policy "bosses: signed in read" on public.bosses for select to authenticated using (true);
drop policy if exists "bosses: admins insert" on public.bosses;
create policy "bosses: admins insert" on public.bosses for insert to authenticated with check (public.is_admin());
drop policy if exists "bosses: admins update" on public.bosses;
create policy "bosses: admins update" on public.bosses for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "bosses: admins delete" on public.bosses;
create policy "bosses: admins delete" on public.bosses for delete to authenticated using (public.is_admin());

-- one row per player who was paid for a boss (the primary key makes a second payout impossible)
create table if not exists public.boss_wins (
  boss_id bigint not null references public.bosses on delete cascade,
  owner uuid not null references public.profiles on delete cascade,
  turns int not null default 0,
  coins int not null default 0,
  at timestamptz not null default now(),
  primary key (boss_id, owner)
);
alter table public.boss_wins enable row level security;
revoke all on public.boss_wins from anon, authenticated;
grant select on public.boss_wins to authenticated;
drop policy if exists "boss_wins: own or admin" on public.boss_wins;
create policy "boss_wins: own or admin" on public.boss_wins for select to authenticated
  using (owner = (select auth.uid()) or public.is_admin());

-- The player's browser calls this once after beating a boss.
-- Returns {status: 'paid' | 'already' | 'closed' | 'short' | 'guest', coins, balance}.
create or replace function public.claim_boss_reward(boss bigint, turns int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  b public.bosses;
  bal int;
  added int;
begin
  if me is null then return jsonb_build_object('status', 'guest', 'coins', 0); end if;
  if coalesce((select banned from public.profiles where id = me), true) then return jsonb_build_object('status', 'closed', 'coins', 0); end if;
  select * into b from public.bosses where id = boss;
  if not found or not b.active or now() < b.starts_at or now() > b.ends_at then
    return jsonb_build_object('status', 'closed', 'coins', 0);
  end if;
  if coalesce(turns, 0) < 3 then return jsonb_build_object('status', 'short', 'coins', 0); end if;

  select coins into bal from public.profiles where id = me for update;   -- one claim at a time per player
  insert into public.boss_wins (boss_id, owner, turns, coins) values (boss, me, turns, b.reward)
    on conflict (boss_id, owner) do nothing;
  get diagnostics added = row_count;
  if added = 0 then return jsonb_build_object('status', 'already', 'coins', 0, 'balance', bal); end if;

  update public.profiles set coins = coins + b.reward where id = me returning coins into bal;
  return jsonb_build_object('status', 'paid', 'coins', b.reward, 'balance', bal);
end $$;
revoke all on function public.claim_boss_reward(bigint, int) from public, anon;
grant execute on function public.claim_boss_reward(bigint, int) to authenticated;
