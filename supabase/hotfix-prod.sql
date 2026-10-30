-- =============================================================================
-- CORRECTIF PRODUCTION — à exécuter une fois dans Supabase → SQL Editor → Run
-- Corrige l’erreur 500 à l’inscription si age/sexe/inscrire ne sont pas à jour.
-- =============================================================================

create extension if not exists pgcrypto;

alter table public.participants add column if not exists age integer;
alter table public.participants drop constraint if exists participants_age_check;
alter table public.participants
  add constraint participants_age_check check (age is null or (age >= 16 and age <= 110));

alter table public.participants add column if not exists sexe text;
alter table public.participants drop constraint if exists participants_sexe_check;
alter table public.participants
  add constraint participants_sexe_check check (sexe is null or sexe in ('h', 'f'));

create unique index if not exists participants_telephone_actif_idx
  on public.participants (telephone)
  where telephone is not null and statut <> 'annule';

alter table public.participants add column if not exists jours_presents text[] not null default '{}';

create index if not exists participants_jours_presents_idx
  on public.participants using gin (jours_presents);

create table if not exists public.inscription_tentatives (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);

create index if not exists inscription_tentatives_ip_idx
  on public.inscription_tentatives (ip, created_at desc);

alter table public.inscription_tentatives enable row level security;
revoke all on table public.inscription_tentatives from public, anon, authenticated;

alter table public.participants alter column email drop not null;

drop index if exists public.participants_email_lower_idx;
create unique index if not exists participants_email_lower_idx
  on public.participants (lower(email))
  where email is not null and btrim(email) <> '';

-- --- Fonction inscrire (copie de schema.sql) ---

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
  v_telephone text := nullif(left(nullif(regexp_replace(coalesce(p_telephone, ''), '[^0-9]', '', 'g'), ''), 15), '');
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

notify pgrst, 'reload schema';

-- Badge trop long → format court
update public.participants p
set code = 'SDM-605453'
where p.code = 'SDM-9F8135CFE74228C7E665B7BA861FEF10'
  and not exists (
    select 1 from public.participants x where x.code = 'SDM-605453' and x.id <> p.id
  );

-- Rôles super_admin | admin (voir aussi supabase/roles.sql)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'super_admin'));

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

drop policy if exists "campagne_update" on public.campagne;
create policy "campagne_update" on public.campagne
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "participants_delete" on public.participants;
create policy "participants_delete" on public.participants
  for delete to authenticated
  using (public.is_super_admin());

notify pgrst, 'reload schema';
