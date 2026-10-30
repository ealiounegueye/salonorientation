-- Présence comptée jour par jour (scan)
-- Supabase → SQL Editor → Run

alter table public.participants add column if not exists jours_presents text[] not null default '{}';

create index if not exists participants_jours_presents_idx
  on public.participants using gin (jours_presents);

notify pgrst, 'reload schema';
