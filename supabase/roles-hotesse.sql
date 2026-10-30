-- Rôle hôtesse (scan + liste participants)
-- À exécuter dans Supabase → SQL Editor après roles.sql

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'super_admin', 'hotesse'));

create or replace function public.peut_voir_participants()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin', 'hotesse')
  );
$$;

drop policy if exists "campagne_select" on public.campagne;
create policy "campagne_select" on public.campagne
  for select to authenticated
  using (public.peut_voir_participants());

drop policy if exists "participants_select" on public.participants;
create policy "participants_select" on public.participants
  for select to authenticated
  using (public.peut_voir_participants());

drop policy if exists "participants_update" on public.participants;
create policy "participants_update" on public.participants
  for update to authenticated
  using (public.peut_voir_participants())
  with check (public.peut_voir_participants());

notify pgrst, 'reload schema';
