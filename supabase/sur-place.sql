-- Inscriptions saisies depuis l’espace équipe (ajout manuel / accueil).
-- À exécuter une fois dans Supabase → SQL Editor, puis redéployer la fonction edge inscrire.

alter table public.participants add column if not exists sur_place boolean not null default false;

create index if not exists participants_sur_place_idx
  on public.participants (sur_place)
  where sur_place;

notify pgrst, 'reload schema';
