-- Vanguard Table · step 6: card history (undo) and shared ability templates for admins
-- Run after 005: SQL Editor → New query → paste all of this → Run. Safe to run again.

-- ---------- card history: every change to a card keeps the version before it ----------
create table if not exists public.card_history (
  id bigint generated always as identity primary key,
  card_id text not null,
  data jsonb,                 -- the card as it was before the change (null = it didn't exist)
  deleted boolean not null default false,
  saved_by uuid references public.profiles on delete set null,  -- who made the change that replaced this version
  saved_at timestamptz not null default now()
);
create index if not exists card_history_card on public.card_history (card_id, saved_at desc);
alter table public.card_history enable row level security;
revoke all on public.card_history from anon, authenticated;
grant select on public.card_history to authenticated;
drop policy if exists "card_history: admins read" on public.card_history;
create policy "card_history: admins read" on public.card_history for select to authenticated using (public.is_admin());

-- written by the server on every update, so it can't be skipped from a browser
create or replace function public.card_keep_history() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.data is distinct from new.data or old.deleted is distinct from new.deleted then
    insert into public.card_history (card_id, data, deleted, saved_by) values (old.id, old.data, old.deleted, auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists cards_history on public.cards;
create trigger cards_history before update on public.cards for each row execute function public.card_keep_history();

-- keep it small: at most 30 versions per card
create or replace function public.card_trim_history() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.card_history h where h.card_id = new.card_id and h.id not in
    (select id from public.card_history where card_id = new.card_id order by saved_at desc, id desc limit 30);
  return null;
end $$;
drop trigger if exists card_history_trim on public.card_history;
create trigger card_history_trim after insert on public.card_history for each row execute function public.card_trim_history();

-- ---------- ability templates (shared by all admins) ----------
create table if not exists public.ability_templates (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 80),
  data jsonb not null,        -- one ability block {kind, zone, when, once, conds, costs, effects}
  created_by uuid references public.profiles on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table public.ability_templates enable row level security;
revoke all on public.ability_templates from anon, authenticated;
grant select, insert, update, delete on public.ability_templates to authenticated;
drop policy if exists "templates: admins" on public.ability_templates;
create policy "templates: admins" on public.ability_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
