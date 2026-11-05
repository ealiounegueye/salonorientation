-- Jour de pointage forcé pour tous les postes scan (Réglages → Pointage).
-- À exécuter une fois dans Supabase → SQL Editor.

alter table public.campagne add column if not exists pointage_force boolean not null default false;
alter table public.campagne add column if not exists jour_pointage text;

alter table public.campagne drop constraint if exists campagne_jour_pointage_check;
alter table public.campagne
  add constraint campagne_jour_pointage_check
  check (jour_pointage is null or jour_pointage ~ '^[0-9]+$');

create or replace function public.parametres_publics()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ouverte', ouverte,
    'lieu', lieu,
    'horaires', horaires,
    'periode', periode,
    'jours', jours,
    'pointage_force', coalesce(pointage_force, false),
    'jour_pointage', jour_pointage
  )
  from public.campagne
  where id = 1;
$$;

notify pgrst, 'reload schema';
