-- Vanguard Table · step 3: collection, Store boxes (gacha) and game settings
-- Run after 002: SQL Editor → New query → paste all of this → Run. Safe to run again.
-- Coins only come from playing (and admins). Never sell coins or packs for real money.

-- ---------- settings (one row, admins change it) ----------
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  start_coins int not null default 1000 check (start_coins >= 0),   -- coins a new account starts with
  require_collection boolean not null default true,                -- players can only put cards they own in decks
  win_coins int not null default 100 check (win_coins >= 0),       -- match rewards (used in the next step)
  loss_coins int not null default 30 check (loss_coins >= 0),
  daily_match_cap int not null default 10 check (daily_match_cap >= 0)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
grant select, update on public.app_settings to authenticated;
drop policy if exists "settings: read" on public.app_settings;
create policy "settings: read" on public.app_settings for select to authenticated using (true);
drop policy if exists "settings: admins change" on public.app_settings;
create policy "settings: admins change" on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- new accounts start with start_coins (the first account ever is admin)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, color, role, coins)
  values (
    new.id,
    coalesce(left(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 20), 'Fighter'),
    case when (new.raw_user_meta_data ->> 'color') ~ '^#[0-9a-fA-F]{6}$' then new.raw_user_meta_data ->> 'color' else '#5fd0ff' end,
    case when exists (select 1 from public.profiles) then 'player' else 'admin' end,
    coalesce((select start_coins from public.app_settings where id = 1), 0)
  );
  return new;
end $$;

-- ---------- collection: how many copies of each card an account owns ----------
create table if not exists public.collection (
  owner uuid not null references public.profiles on delete cascade,
  card_id text not null,
  count int not null default 0 check (count >= 0),
  primary key (owner, card_id)
);
alter table public.collection enable row level security;
revoke all on public.collection from anon, authenticated;
grant select on public.collection to authenticated;
drop policy if exists "collection: own or admin" on public.collection;
create policy "collection: own or admin" on public.collection for select to authenticated
  using (owner = (select auth.uid()) or public.is_admin());

-- ---------- boxes ----------
-- rates: chance per card slot for each rarity, e.g. {"C":70,"R":20,"RR":7,"RRR":2.5,"SP":0.5}
-- guarantee: the last card of every pack is at least this rarity (null = no guarantee)
create table if not exists public.boxes (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '',
  cover text not null default '',              -- a card id (its picture is the box cover)
  price int not null default 100 check (price >= 0),
  cards_per_pack int not null default 5 check (cards_per_pack between 1 and 20),
  rates jsonb not null default '{"C":70,"R":20,"RR":7,"RRR":2.5,"SP":0.5}',
  guarantee text default 'R',
  active boolean not null default false,       -- players only see active boxes
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.box_cards (
  box_id bigint not null references public.boxes on delete cascade,
  card_id text not null,
  rarity text not null default 'C' check (rarity in ('C', 'R', 'RR', 'RRR', 'SP', 'SEC')),
  primary key (box_id, card_id)
);
alter table public.boxes enable row level security;
alter table public.box_cards enable row level security;
revoke all on public.boxes, public.box_cards from anon, authenticated;
grant select, insert, update, delete on public.boxes, public.box_cards to authenticated;
drop policy if exists "boxes: read" on public.boxes;
create policy "boxes: read" on public.boxes for select to authenticated using (active or public.is_admin());
drop policy if exists "boxes: admins write" on public.boxes;
create policy "boxes: admins write" on public.boxes for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "box_cards: read" on public.box_cards;
create policy "box_cards: read" on public.box_cards for select to authenticated
  using (public.is_admin() or exists (select 1 from public.boxes b where b.id = box_id and b.active));
drop policy if exists "box_cards: admins write" on public.box_cards;
create policy "box_cards: admins write" on public.box_cards for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- every pack opened is recorded
create table if not exists public.pack_log (
  id bigint generated always as identity primary key,
  owner uuid references public.profiles on delete cascade,
  box_id bigint references public.boxes on delete set null,
  cost int not null,
  cards jsonb not null,
  at timestamptz not null default now()
);
alter table public.pack_log enable row level security;
revoke all on public.pack_log from anon, authenticated;
grant select on public.pack_log to authenticated;
drop policy if exists "pack_log: own or admin" on public.pack_log;
create policy "pack_log: own or admin" on public.pack_log for select to authenticated
  using (owner = (select auth.uid()) or public.is_admin());

-- ---------- open packs: coins are taken and cards rolled on the server ----------
create or replace function public.open_pack(box bigint, packs int default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.boxes;
  me public.profiles;
  ranks text[] := array['C', 'R', 'RR', 'RRR', 'SP', 'SEC'];
  result jsonb := '[]';
  pack jsonb;
  p int; i int;
  allowed text[];
  total numeric; roll numeric; acc numeric;
  pick_rarity text; pick_card text; r text;
begin
  if packs < 1 or packs > 10 then raise exception 'open 1 to 10 packs at a time'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  if me.id is null then raise exception 'sign in first'; end if;
  if me.banned then raise exception 'this account is banned'; end if;
  select * into b from public.boxes where id = box;
  if b.id is null or (not b.active and me.role <> 'admin') then raise exception 'this box is not in the Store'; end if;
  if not exists (select 1 from public.box_cards where box_id = box) then raise exception 'this box has no cards yet'; end if;
  if me.coins < b.price * packs then raise exception 'not enough coins'; end if;
  update public.profiles set coins = coins - b.price * packs where id = me.id;

  for p in 1 .. packs loop
    pack := '[]';
    for i in 1 .. b.cards_per_pack loop
      -- rarities this slot can give: ones with cards in the box (the last slot respects the guarantee)
      select array_agg(distinct bc.rarity) into allowed from public.box_cards bc
       where bc.box_id = box
         and (i < b.cards_per_pack or b.guarantee is null
              or array_position(ranks, bc.rarity) >= coalesce(array_position(ranks, b.guarantee), 1));
      if allowed is null then -- no card meets the guarantee: any rarity
        select array_agg(distinct bc.rarity) into allowed from public.box_cards bc where bc.box_id = box;
      end if;
      total := 0;
      foreach r in array allowed loop total := total + greatest(coalesce((b.rates ->> r)::numeric, 0), 0); end loop;
      pick_rarity := null;
      if total > 0 then
        roll := random() * total; acc := 0;
        foreach r in array allowed loop
          acc := acc + greatest(coalesce((b.rates ->> r)::numeric, 0), 0);
          if pick_rarity is null and roll < acc then pick_rarity := r; end if;
        end loop;
      end if;
      if pick_rarity is null then pick_rarity := allowed[1 + floor(random() * array_length(allowed, 1))::int]; end if;
      select bc.card_id into pick_card from public.box_cards bc
       where bc.box_id = box and bc.rarity = pick_rarity order by random() limit 1;
      insert into public.collection (owner, card_id, count) values (me.id, pick_card, 1)
        on conflict (owner, card_id) do update set count = public.collection.count + 1;
      pack := pack || jsonb_build_object('card', pick_card, 'rarity', pick_rarity);
    end loop;
    insert into public.pack_log (owner, box_id, cost, cards) values (me.id, box, b.price, pack);
    result := result || jsonb_build_array(pack);
  end loop;
  return jsonb_build_object('packs', result, 'coins', (select coins from public.profiles where id = me.id));
end $$;

-- admins: give or take cards
create or replace function public.admin_give_card(target uuid, card text, amount int) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  insert into public.collection (owner, card_id, count) values (target, card, greatest(amount, 0))
    on conflict (owner, card_id) do update set count = greatest(0, public.collection.count + amount)
    returning count into n;
  insert into public.admin_log (admin, action, target, detail) values (auth.uid(), 'give_card', target, jsonb_build_object('card', card, 'amount', amount, 'now', n));
  return n;
end $$;

revoke execute on function public.open_pack(bigint, int), public.admin_give_card(uuid, text, int) from public, anon;
grant execute on function public.open_pack(bigint, int), public.admin_give_card(uuid, text, int) to authenticated;
