-- Salon 2026 — inscriptions + espace admin
-- À coller dans Supabase → SQL Editor → Run

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null,
  email text not null unique,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now()
);

create table if not exists public.campagne (
  id int primary key default 1 check (id = 1),
  ouverte boolean not null default true
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  prenom text not null,
  nom text not null,
  email text not null,
  telephone text,
  organisation text,
  fonction text,
  profil text,
  dates text,
  statut text not null default 'inscrit' check (statut in ('inscrit', 'present', 'annule')),
  email_envoye_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.campagne (id, ouverte)
values (1, true)
on conflict (id) do nothing;

create unique index if not exists participants_email_lower_idx
  on public.participants (lower(email));

create index if not exists participants_created_idx
  on public.participants (created_at desc);

create index if not exists participants_statut_idx
  on public.participants (statut);

alter table public.participants add column if not exists profil text;
alter table public.participants add column if not exists dates text;

alter table public.participants drop constraint if exists participants_profil_check;
alter table public.participants
  add constraint participants_profil_check
  check (profil is null or profil in ('professionnel', 'etudiant', 'chercheur', 'visiteur'));

-- ---------------------------------------------------------------------------
-- Profil admin à la création d'un compte Auth
-- Les comptes se créent à la main. Ne pas ouvrir l'inscription publique Auth.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nom, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', split_part(new.email, '@', 1)),
    new.email,
    'admin'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helpers
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
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.inscriptions_ouvertes()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select ouverte from public.campagne where id = 1), false);
$$;

create or replace function public.badge_public(p_code text)
returns table (code text, prenom text, nom text, statut text)
language sql
stable
security definer
set search_path = public
as $$
  select participants.code, participants.prenom, participants.nom, participants.statut
  from public.participants
  where length(trim(coalesce(p_code, ''))) between 4 and 20
    and participants.code = upper(trim(p_code))
    and participants.statut <> 'annule'
  limit 1;
$$;

revoke all on function public.inscriptions_ouvertes() from public, anon, authenticated;
grant execute on function public.inscriptions_ouvertes() to anon, authenticated;

revoke all on function public.badge_public(text) from public, anon, authenticated;
grant execute on function public.badge_public(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Inscription publique : crée le code SLN-XXXXXX, ou renvoie le badge existant
-- ---------------------------------------------------------------------------

drop function if exists public.inscrire(text, text, text, text, text, text, text);
drop function if exists public.inscrire(text, text, text, text, text, text, text, text, text);

create or replace function public.inscrire(
  p_prenom text,
  p_nom text,
  p_email text,
  p_telephone text default '',
  p_organisation text default '',
  p_fonction text default '',
  p_website text default '',
  p_profil text default '',
  p_dates text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prenom text := left(btrim(coalesce(p_prenom, '')), 80);
  v_nom text := left(btrim(coalesce(p_nom, '')), 80);
  v_email text := lower(left(btrim(coalesce(p_email, '')), 160));
  v_telephone text := nullif(left(btrim(coalesce(p_telephone, '')), 30), '');
  v_organisation text := nullif(left(btrim(coalesce(p_organisation, '')), 120), '');
  v_fonction text := nullif(left(btrim(coalesce(p_fonction, '')), 120), '');
  v_website text := left(btrim(coalesce(p_website, '')), 200);
  v_profil text := lower(left(btrim(coalesce(p_profil, '')), 40));
  v_brut_dates text := regexp_replace(coalesce(p_dates, ''), '[^0-9,]', '', 'g');
  v_dates text;
  v_ouverte boolean;
  v_row public.participants;
  v_code text;
  v_essai int;
  v_pos int;
  v_i int;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_website <> '' then
    return jsonb_build_object('ok', false, 'message', 'Inscription impossible.');
  end if;

  if char_length(v_prenom) < 2 or char_length(v_nom) < 2 then
    return jsonb_build_object('ok', false, 'message', 'Indiquez votre prénom et votre nom.');
  end if;

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'message', 'Indiquez une adresse e-mail valide.');
  end if;

  if v_telephone is null or v_telephone !~ '^[0-9]{8,15}$' then
    return jsonb_build_object('ok', false, 'message', 'Indiquez un numéro de téléphone.');
  end if;

  if v_profil not in ('professionnel', 'etudiant', 'chercheur', 'visiteur') then
    return jsonb_build_object('ok', false, 'message', 'Choisissez votre profil.');
  end if;

  v_dates := nullif(concat_ws(
    ',',
    case when v_brut_dates ~ '(^|,)18(,|$)' then '18' else null end,
    case when v_brut_dates ~ '(^|,)19(,|$)' then '19' else null end,
    case when v_brut_dates ~ '(^|,)20(,|$)' then '20' else null end
  ), '');

  if v_dates is null then
    return jsonb_build_object('ok', false, 'message', 'Choisissez au moins une date.');
  end if;

  select * into v_row
  from public.participants
  where lower(email) = v_email
  limit 1;

  if found then
    if v_row.statut = 'annule' then
      return jsonb_build_object('ok', false, 'message', 'Cette inscription a été annulée. Contactez l’organisation.');
    end if;
    return jsonb_build_object('ok', true, 'code', v_row.code, 'deja_inscrit', true);
  end if;

  select coalesce((select ouverte from public.campagne where id = 1), false) into v_ouverte;
  if not v_ouverte and not public.is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Les inscriptions sont fermées.');
  end if;

  for v_essai in 1..5 loop
    v_code := 'SLN-';
    for v_i in 1..6 loop
      v_pos := 1 + floor(random() * length(alphabet))::int;
      if v_pos > length(alphabet) then
        v_pos := length(alphabet);
      end if;
      v_code := v_code || substr(alphabet, v_pos, 1);
    end loop;

    begin
      insert into public.participants (code, prenom, nom, email, telephone, organisation, fonction, profil, dates, statut)
      values (v_code, v_prenom, v_nom, v_email, v_telephone, v_organisation, v_fonction, v_profil, v_dates, 'inscrit')
      returning * into v_row;
      return jsonb_build_object('ok', true, 'code', v_row.code, 'deja_inscrit', false);
    exception
      when unique_violation then
        select * into v_row from public.participants where lower(email) = v_email limit 1;
        if found then
          if v_row.statut = 'annule' then
            return jsonb_build_object('ok', false, 'message', 'Cette inscription a été annulée. Contactez l’organisation.');
          end if;
          return jsonb_build_object('ok', true, 'code', v_row.code, 'deja_inscrit', true);
        end if;
    end;
  end loop;

  return jsonb_build_object('ok', false, 'message', 'L’inscription n’a pas pu être enregistrée.');
end;
$$;

revoke all on function public.inscrire(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.inscrire(text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.campagne enable row level security;
alter table public.participants enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "campagne_select" on public.campagne;
create policy "campagne_select" on public.campagne
  for select to authenticated
  using (public.is_admin());

drop policy if exists "campagne_update" on public.campagne;
create policy "campagne_update" on public.campagne
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

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
  using (public.is_admin());
