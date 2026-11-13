-- 007: Store products are booster packs or decks.
-- A deck product holds a whole deck (its layout in boxes.deck, the copies of each card in box_cards.qty).
-- Buying it takes the price once, adds every card to the buyer's collection, and the page copies the deck into the buyer's decks.
-- Run once in the Supabase SQL Editor after 001–006.

alter table public.boxes add column if not exists kind text not null default 'booster';
alter table public.boxes drop constraint if exists boxes_kind_check;
alter table public.boxes add constraint boxes_kind_check check (kind in ('booster', 'deck'));
alter table public.boxes add column if not exists deck jsonb;             -- deck products: {name, format, energy, ride[], main[], g[], starter}

alter table public.box_cards add column if not exists qty int not null default 1;   -- deck products: copies of this card
alter table public.box_cards drop constraint if exists box_cards_qty_check;
alter table public.box_cards add constraint box_cards_qty_check check (qty between 1 and 60);

-- ---------- buy a deck: coins are taken and every card is added on the server ----------
create or replace function public.buy_deck(box bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.boxes;
  me public.profiles;
  got jsonb := '[]';
  r record;
begin
  select * into me from public.profiles where id = auth.uid() for update;
  if me.id is null then raise exception 'sign in first'; end if;
  if me.banned then raise exception 'this account is banned'; end if;
  select * into b from public.boxes where id = box;
  if b.id is null or (not b.active and me.role <> 'admin') then raise exception 'this deck is not in the Store'; end if;
  if b.kind <> 'deck' then raise exception 'this is a booster box: open packs instead'; end if;
  if not exists (select 1 from public.box_cards where box_id = box) then raise exception 'this deck has no cards yet'; end if;
  if me.coins < b.price then raise exception 'not enough coins'; end if;
  update public.profiles set coins = coins - b.price where id = me.id;
  for r in select card_id, qty from public.box_cards where box_id = box loop
    insert into public.collection (owner, card_id, count) values (me.id, r.card_id, r.qty)
      on conflict (owner, card_id) do update set count = public.collection.count + r.qty;
    got := got || jsonb_build_object('card', r.card_id, 'qty', r.qty);
  end loop;
  insert into public.pack_log (owner, box_id, cost, cards) values (me.id, box, b.price, got);
  return jsonb_build_object('cards', got, 'deck', b.deck, 'coins', (select coins from public.profiles where id = me.id));
end $$;
revoke all on function public.buy_deck(bigint) from public, anon;
grant execute on function public.buy_deck(bigint) to authenticated;

-- open_pack refuses deck products (the 003 function with one more check)
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
  if b.kind = 'deck' then raise exception 'this is a deck: buy it instead of opening packs'; end if;
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
