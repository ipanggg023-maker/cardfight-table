-- Vanguard Table · step 4: coins from online matches
-- Run after 003: SQL Editor → New query → paste all of this → Run. Safe to run again.
-- Both players' browsers report the result. Coins are paid only when both reports agree,
-- the game lasted at least 3 turns, and the player is under the daily limit (app_settings.daily_match_cap).

create table if not exists public.matches (
  id uuid primary key,
  p1 uuid not null references public.profiles on delete cascade,   -- the two accounts, smaller id first
  p2 uuid not null references public.profiles on delete cascade,
  report1 jsonb,                                                   -- what p1 said: {winner, turns, at}
  report2 jsonb,
  status text not null default 'waiting' check (status in ('waiting', 'paid', 'mismatch', 'short')),
  winner uuid,
  coins1 int not null default 0,
  coins2 int not null default 0,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check (p1 < p2)
);
create index if not exists matches_p1 on public.matches (p1, settled_at);
create index if not exists matches_p2 on public.matches (p2, settled_at);
alter table public.matches enable row level security;
revoke all on public.matches from anon, authenticated;
grant select on public.matches to authenticated;
drop policy if exists "matches: own or admin" on public.matches;
create policy "matches: own or admin" on public.matches for select to authenticated
  using ((select auth.uid()) in (p1, p2) or public.is_admin());

-- winner: the winner's account id, or null for a draw. Calling again is safe (returns the current result).
create or replace function public.report_match(match uuid, opponent uuid, winner uuid, turns int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  a uuid; b uuid;
  m public.matches;
  s public.app_settings;
  rep jsonb;
  w uuid; t1 int; t2 int;
  pay1 int := 0; pay2 int := 0;
  today1 int; today2 int;
  mine int; bal int;
begin
  if me is null then raise exception 'sign in first'; end if;
  if opponent is null or opponent = me then raise exception 'you need a different account as your opponent'; end if;
  if (select banned from public.profiles where id = me) then raise exception 'this account is banned'; end if;
  if not exists (select 1 from public.profiles where id = opponent) then raise exception 'unknown opponent'; end if;
  if winner is not null and winner not in (me, opponent) then raise exception 'the winner must be one of the two players'; end if;
  a := least(me, opponent); b := greatest(me, opponent);

  insert into public.matches (id, p1, p2) values (match, a, b) on conflict (id) do nothing;
  select * into m from public.matches where id = match for update;
  if m.p1 <> a or m.p2 <> b then raise exception 'this match belongs to other players'; end if;

  if m.status = 'waiting' then
    rep := jsonb_build_object('winner', winner, 'turns', greatest(coalesce(turns, 0), 0), 'at', now());
    if me = m.p1 and m.report1 is null then m.report1 := rep; end if;  -- first report counts, it can't be changed
    if me = m.p2 and m.report2 is null then m.report2 := rep; end if;
    if m.report1 is not null and m.report2 is not null then
      w := nullif(m.report1 ->> 'winner', '')::uuid;
      t1 := (m.report1 ->> 'turns')::int; t2 := (m.report2 ->> 'turns')::int;
      if w is distinct from nullif(m.report2 ->> 'winner', '')::uuid then
        m.status := 'mismatch';
      elsif least(t1, t2) < 3 then
        m.status := 'short';
      else
        select * into s from public.app_settings where id = 1;
        select count(*) into today1 from public.matches x where x.status = 'paid' and m.p1 in (x.p1, x.p2) and x.settled_at >= date_trunc('day', now());
        select count(*) into today2 from public.matches x where x.status = 'paid' and m.p2 in (x.p1, x.p2) and x.settled_at >= date_trunc('day', now());
        if today1 < s.daily_match_cap then pay1 := case when w = m.p1 then s.win_coins else s.loss_coins end; end if;
        if today2 < s.daily_match_cap then pay2 := case when w = m.p2 then s.win_coins else s.loss_coins end; end if;
        update public.profiles set coins = coins + pay1 where id = m.p1;
        update public.profiles set coins = coins + pay2 where id = m.p2;
        m.status := 'paid'; m.coins1 := pay1; m.coins2 := pay2;
      end if;
      m.winner := w;
      m.settled_at := now();
    end if;
    update public.matches set report1 = m.report1, report2 = m.report2, status = m.status, winner = m.winner,
      coins1 = m.coins1, coins2 = m.coins2, settled_at = m.settled_at where id = match;
  end if;

  mine := case when me = m.p1 then m.coins1 else m.coins2 end;
  select coins into bal from public.profiles where id = me;
  return jsonb_build_object('status', m.status, 'coins', mine, 'balance', bal,
    'capped', m.status = 'paid' and (select count(*) from public.matches x where x.status = 'paid' and me in (x.p1, x.p2)
      and x.settled_at >= date_trunc('day', now())) > (select daily_match_cap from public.app_settings where id = 1));
end $$;

revoke execute on function public.report_match(uuid, uuid, uuid, int) from public, anon;
grant execute on function public.report_match(uuid, uuid, uuid, int) to authenticated;
