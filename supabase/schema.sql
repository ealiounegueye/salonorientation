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
  role text not null default 'admin' check (role in ('admin', 'super_admin', 'hotesse')),
  created_at timestamptz not null default now()
);

create table if not exists public.campagne (
  id int primary key default 1 check (id = 1),
  ouverte boolean not null default true,
  lieu text not null default 'À côté du Cinéma Pathé à Mermoz',
  horaires text not null default '9h–17h',
  periode text not null default 'novembre 2026',
  jours text not null default '18,19,20'
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  prenom text not null,
  nom text not null,
  email text,
  telephone text,
  profil text,
  dates text,
  statut text not null default 'inscrit' check (statut in ('inscrit', 'present', 'annule')),
  email_envoye_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.campagne (id, ouverte)
values (1, true)
on conflict (id) do nothing;

alter table public.campagne add column if not exists lieu text not null default 'À côté du Cinéma Pathé à Mermoz';
alter table public.campagne add column if not exists horaires text not null default '9h–17h';
alter table public.campagne add column if not exists periode text not null default 'novembre 2026';
alter table public.campagne add column if not exists jours text not null default '18,19,20';

create unique index if not exists participants_email_lower_idx
  on public.participants (lower(email))
  where email is not null and btrim(email) <> '';

create unique index if not exists participants_telephone_actif_idx
  on public.participants (telephone)
  where telephone is not null and statut <> 'annule';

create index if not exists participants_created_idx
  on public.participants (created_at desc);

create index if not exists participants_statut_idx
  on public.participants (statut);

alter table public.participants
  add column if not exists jours_sel text[]
  generated always as (
    case
      when dates is null or btrim(dates) = '' then '{}'::text[]
      else string_to_array(dates, ',')
    end
  ) stored;

create index if not exists participants_jours_sel_idx
  on public.participants using gin (jours_sel);

create index if not exists participants_profil_idx
  on public.participants (profil);

alter table public.participants add column if not exists profil text;
alter table public.participants add column if not exists dates text;
alter table public.participants drop column if exists organisation;
alter table public.participants drop column if exists fonction;
alter table public.participants add column if not exists age integer;
alter table public.participants drop constraint if exists participants_age_check;
alter table public.participants
  add constraint participants_age_check check (age is null or (age >= 16 and age <= 110));

alter table public.participants add column if not exists sexe text;
alter table public.participants drop constraint if exists participants_sexe_check;
alter table public.participants
  add constraint participants_sexe_check check (sexe is null or sexe in ('h', 'f'));

alter table public.participants drop constraint if exists participants_profil_check;
alter table public.participants
  add constraint participants_profil_check
  check (profil is null or profil in ('professionnel', 'etudiant', 'chercheur', 'visiteur'));

-- ---------------------------------------------------------------------------
-- Les comptes admin se créent depuis la page Équipe.
-- Aucun trigger : un compte Auth créé autrement n'a pas de profil admin.
-- Laisser les inscriptions Auth fermées (Authentication → Disable sign ups).
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

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
  where upper(trim(coalesce(p_code, ''))) ~ '^(SDM-[A-F0-9]{32}|SDM-[0-9]{6}|SLN-[A-Z0-9]{6})$'
    and participants.code = upper(trim(p_code))
    and participants.statut <> 'annule'
  limit 1;
$$;

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
    'jours', jours
  )
  from public.campagne
  where id = 1;
$$;

revoke all on function public.inscriptions_ouvertes() from public, anon, authenticated;
grant execute on function public.inscriptions_ouvertes() to anon, authenticated;

revoke all on function public.parametres_publics() from public, anon, authenticated;
grant execute on function public.parametres_publics() to anon, authenticated;

revoke all on function public.badge_public(text) from public, anon, authenticated;
grant execute on function public.badge_public(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Compteur d’appels à l’inscription. Réservé au rôle service, sans policy.
-- ---------------------------------------------------------------------------

create table if not exists public.inscription_tentatives (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);

create index if not exists inscription_tentatives_ip_idx
  on public.inscription_tentatives (ip, created_at desc);

alter table public.inscription_tentatives enable row level security;
revoke all on table public.inscription_tentatives from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Inscription : code long. Un e-mail déjà connu ne renvoie pas le code.
-- Appelée uniquement par la fonction edge (service_role).
-- p_admin n’est pris en compte que si l’appelant est service_role.
-- ---------------------------------------------------------------------------

drop function if exists public.inscrire(text, text, text, text, text, text, text);
drop function if exists public.inscrire(text, text, text, text, text, text, text, text, text);
drop function if exists public.inscrire(text, text, text, text, text, text, text, text, text, integer);
drop function if exists public.inscrire(text, text, text, text, text, text, text, integer);
drop function if exists public.inscrire(text, text, text, text, text, text, text, integer, boolean);
drop function if exists public.inscrire(text, text, text, text, text, text, text, integer, text, boolean);

create or replace function public.inscrire(
  p_prenom text,
  p_nom text,
  p_email text,
  p_telephone text default '',
  p_website text default '',
  p_profil text default '',
  p_dates text default '',
  p_age integer default null,
  p_sexe text default '',
  p_admin boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prenom text := left(btrim(coalesce(p_prenom, '')), 80);
  v_nom text := left(btrim(coalesce(p_nom, '')), 80);
  v_email text := nullif(lower(left(btrim(coalesce(p_email, '')), 160)), '');
  v_telephone text := nullif(left(btrim(coalesce(p_telephone, '')), 30), '');
  v_website text := left(btrim(coalesce(p_website, '')), 200);
  v_profil text := lower(left(btrim(coalesce(p_profil, '')), 40));
  v_brut_dates text := regexp_replace(coalesce(p_dates, ''), '[^0-9,]', '', 'g');
  v_dates text;
  v_autorises text;
  v_ouverte boolean;
  v_admin boolean := coalesce(p_admin, false) and coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  v_row public.participants;
  v_code text;
  v_essai int;
  v_age int := p_age;
  v_sexe text := lower(left(btrim(coalesce(p_sexe, '')), 1));
begin
  if v_website <> '' then
    return jsonb_build_object('ok', false, 'message', 'Inscription impossible.');
  end if;

  if char_length(v_prenom) < 2 or char_length(v_nom) < 2 then
    return jsonb_build_object('ok', false, 'message', 'Indiquez votre prénom et votre nom.');
  end if;

  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'message', 'Indiquez une adresse e-mail valide ou laissez le champ vide.');
  end if;

  if v_telephone is not null and v_telephone !~ '^[0-9]{8,15}$' then
    return jsonb_build_object('ok', false, 'message', 'Indiquez un numéro de téléphone valide ou laissez le champ vide.');
  end if;

  if v_age is null or v_age < 16 or v_age > 110 then
    return jsonb_build_object('ok', false, 'message', 'Indiquez votre âge.');
  end if;

  if v_sexe not in ('h', 'f') then
    return jsonb_build_object('ok', false, 'message', 'Indiquez votre sexe.');
  end if;

  if v_profil not in ('professionnel', 'etudiant', 'chercheur', 'visiteur') then
    return jsonb_build_object('ok', false, 'message', 'Choisissez votre profil.');
  end if;

  select coalesce(jours, '') into v_autorises from public.campagne where id = 1;
  select nullif(string_agg(jour, ',' order by ord), '')
    into v_dates
  from (
    select btrim(u.jour) as jour, u.ord
    from unnest(string_to_array(v_autorises, ',')) with ordinality as u(jour, ord)
    where btrim(u.jour) <> ''
      and v_brut_dates ~ ('(^|,)' || btrim(u.jour) || '(,|$)')
  ) choisi;

  if v_dates is null then
    return jsonb_build_object('ok', false, 'message', 'Choisissez au moins une date.');
  end if;

  if v_email is not null then
    select * into v_row
    from public.participants
    where lower(email) = v_email
    limit 1;

    if found then
      if v_row.statut = 'annule' then
        return jsonb_build_object('ok', false, 'message', 'Cette inscription a été annulée. Contactez l’organisation.');
      end if;
      return jsonb_build_object('ok', false, 'message', 'Cette adresse e-mail est déjà utilisée.');
    end if;
  end if;

  if v_telephone is not null then
    select * into v_row
    from public.participants
    where telephone = v_telephone and statut <> 'annule'
    limit 1;

    if found then
      return jsonb_build_object('ok', false, 'message', 'Ce numéro de téléphone est déjà utilisé.');
    end if;
  end if;

  select coalesce((select ouverte from public.campagne where id = 1), false) into v_ouverte;
  if not v_ouverte and not v_admin and not public.is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Les inscriptions sont fermées.');
  end if;

  for v_essai in 1..5 loop
    v_code := 'SDM-' || lpad((floor(random() * 1000000)::int)::text, 6, '0');

    begin
      insert into public.participants (code, prenom, nom, email, telephone, profil, dates, age, sexe, statut)
      values (v_code, v_prenom, v_nom, v_email, v_telephone, v_profil, v_dates, v_age, v_sexe, 'inscrit')
      returning * into v_row;
      return jsonb_build_object('ok', true, 'code', v_row.code, 'deja_inscrit', false, 'id', v_row.id);
    exception
      when unique_violation then
        if v_email is not null and exists (
          select 1 from public.participants
          where lower(email) = v_email and statut <> 'annule'
        ) then
          return jsonb_build_object('ok', false, 'message', 'Cette adresse e-mail est déjà utilisée.');
        end if;
        if v_telephone is not null and exists (
          select 1 from public.participants
          where telephone = v_telephone and statut <> 'annule'
        ) then
          return jsonb_build_object('ok', false, 'message', 'Ce numéro de téléphone est déjà utilisé.');
        end if;
    end;
  end loop;

  return jsonb_build_object('ok', false, 'message', 'L’inscription n’a pas pu être enregistrée.');
end;
$$;

revoke all on function public.inscrire(text, text, text, text, text, text, text, integer, text, boolean) from public, anon, authenticated;
grant execute on function public.inscrire(text, text, text, text, text, text, text, integer, text, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- RLS
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

notify pgrst, 'reload schema';
