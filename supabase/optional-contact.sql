-- E-mail et téléphone optionnels à l'inscription
-- Supabase → SQL Editor → Run

alter table public.participants alter column email drop not null;

drop index if exists public.participants_email_lower_idx;
create unique index participants_email_lower_idx
  on public.participants (lower(email))
  where email is not null and btrim(email) <> '';

notify pgrst, 'reload schema';
