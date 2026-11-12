-- Vanguard Table · step 2: one shared card library (admins edit) + decks saved per account
-- Run after 001_accounts.sql: SQL Editor → New query → paste all of this → Run. Safe to run again.

-- ---------- cards: the whole card object is kept as JSON (same shape as the editor's card) ----------
-- Deleted cards stay as a row with deleted = true so every browser learns about the delete on its next sync.
create table if not exists public.cards (
  id text primary key,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles on delete set null
);
create index if not exists cards_updated_at on public.cards (updated_at);
alter table public.cards enable row level security;

-- ---------- decks: owned by one account ----------
create table if not exists public.decks (
  owner uuid not null references public.profiles on delete cascade default auth.uid(),
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);
alter table public.decks enable row level security;

-- the server sets the time and the editor (browsers can't fake them)
create or replace function public.touch_row() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  if tg_table_name = 'cards' then new.updated_by := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists cards_touch on public.cards;
create trigger cards_touch before insert or update on public.cards for each row execute function public.touch_row();
drop trigger if exists decks_touch on public.decks;
create trigger decks_touch before insert or update on public.decks for each row execute function public.touch_row();

-- ---------- rules ----------
revoke all on public.cards, public.decks from anon, authenticated;
grant select, insert, update on public.cards to authenticated;
grant select, insert, update, delete on public.decks to authenticated;

drop policy if exists "cards: everyone signed in reads" on public.cards;
create policy "cards: everyone signed in reads" on public.cards for select to authenticated using (true);
drop policy if exists "cards: admins add" on public.cards;
create policy "cards: admins add" on public.cards for insert to authenticated with check (public.is_admin());
drop policy if exists "cards: admins change" on public.cards;
create policy "cards: admins change" on public.cards for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "decks: own" on public.decks;
create policy "decks: own" on public.decks for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

-- ---------- card pictures: private bucket, signed-in users read, admins upload ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "card-images: signed in read" on storage.objects;
create policy "card-images: signed in read" on storage.objects for select to authenticated using (bucket_id = 'card-images');
drop policy if exists "card-images: admins upload" on storage.objects;
create policy "card-images: admins upload" on storage.objects for insert to authenticated with check (bucket_id = 'card-images' and public.is_admin());
drop policy if exists "card-images: admins replace" on storage.objects;
create policy "card-images: admins replace" on storage.objects for update to authenticated using (bucket_id = 'card-images' and public.is_admin());
drop policy if exists "card-images: admins delete" on storage.objects;
create policy "card-images: admins delete" on storage.objects for delete to authenticated using (bucket_id = 'card-images' and public.is_admin());
