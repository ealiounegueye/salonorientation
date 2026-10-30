-- =============================================================================
-- SALON DES MÉTIERS — Rôles + sécurité (prod)
-- Supabase → SQL Editor → New query → Run
--
-- Rôles :
--   super_admin : tout (réglages, équipe, suppression, campagne)
--   admin       : tableau de bord, exports, participants
--   hotesse     : participants + scan uniquement (pas tableau de bord)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Contrainte sur profiles.role
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'super_admin', 'hotesse'));

-- ---------------------------------------------------------------------------
-- 2. Fonctions d’autorisation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. Row Level Security (RLS)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.campagne enable row level security;
alter table public.participants enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_super_admin());

drop policy if exists "campagne_select" on public.campagne;
create policy "campagne_select" on public.campagne
  for select to authenticated
  using (public.peut_voir_participants());

drop policy if exists "campagne_update" on public.campagne;
create policy "campagne_update" on public.campagne
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "participants_select" on public.participants;
create policy "participants_select" on public.participants
  for select to authenticated
  using (public.peut_voir_participants());

drop policy if exists "participants_update" on public.participants;
create policy "participants_update" on public.participants
  for update to authenticated
  using (public.peut_voir_participants())
  with check (public.peut_voir_participants());

drop policy if exists "participants_delete" on public.participants;
create policy "participants_delete" on public.participants
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 4. Comptes hôtesse — décommenter et adapter l’e-mail
-- ---------------------------------------------------------------------------
-- select id, nom, email, role from public.profiles order by created_at;

-- update public.profiles
-- set role = 'hotesse'
-- where email = 'hotesse@example.com';

notify pgrst, 'reload schema';
