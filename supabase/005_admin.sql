-- Vanguard Table · step 5: admin page helpers
-- Run after 004: SQL Editor → New query → paste all of this → Run. Safe to run again.

-- Player list for admin.html, with each account's email and last sign-in (these live in auth.users,
-- which the website can't read directly). Admins only.
create or replace function public.admin_users() returns table (
  id uuid, name text, color text, role text, coins int, banned boolean, created_at timestamptz,
  email text, last_sign_in_at timestamptz, cards bigint, copies bigint, matches bigint, packs bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return query
    select p.id, p.name, p.color, p.role, p.coins, p.banned, p.created_at,
      u.email::text, u.last_sign_in_at,
      (select count(*) from public.collection c where c.owner = p.id and c.count > 0),
      (select coalesce(sum(c.count), 0) from public.collection c where c.owner = p.id),
      (select count(*) from public.matches m where p.id in (m.p1, m.p2)),
      (select count(*) from public.pack_log l where l.owner = p.id)
    from public.profiles p join auth.users u on u.id = p.id
    order by p.created_at;
end $$;

-- Admins can rename a player (e.g. an offensive name)
create or replace function public.admin_rename(target uuid, new_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if char_length(trim(new_name)) not between 1 and 20 then raise exception 'names are 1 to 20 characters'; end if;
  update public.profiles set name = trim(new_name) where id = target;
  insert into public.admin_log (admin, action, target, detail) values (auth.uid(), 'rename', target, jsonb_build_object('name', trim(new_name)));
end $$;

revoke execute on function public.admin_users(), public.admin_rename(uuid, text) from public, anon;
grant execute on function public.admin_users(), public.admin_rename(uuid, text) to authenticated;
