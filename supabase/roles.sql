-- Rôles admin : super_admin | admin
-- À exécuter dans Supabase → SQL Editor (une fois).

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'super_admin'));

-- Les comptes existants gardent tous les droits (super admin).
update public.profiles set role = 'super_admin' where role = 'admin';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_super_admin());

drop policy if exists "campagne_select" on public.campagne;
create policy "campagne_select" on public.campagne
  for select to authenticated
  using (public.is_admin());

drop policy if exists "campagne_update" on public.campagne;
create policy "campagne_update" on public.campagne
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "participants_select" on public.participants;
create policy "participants_select" on public.participants
  for select to authenticated
  using (public.is_admin());

drop policy if exists "participants_update" on public.participants;
create policy "participants_update" on public.participants
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "participants_delete" on public.participants;
create policy "participants_delete" on public.participants
  for delete to authenticated
  using (public.is_super_admin());

notify pgrst, 'reload schema';
