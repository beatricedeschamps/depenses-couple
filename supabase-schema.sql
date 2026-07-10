-- ============================================================
-- Schéma Dépenses Phil & Béa — étape 1
-- Coller dans Supabase SQL Editor et exécuter
-- ============================================================

-- Types enum
create type person_enum as enum ('bea', 'phil');
create type split_enum as enum ('half', 'phil', 'bea');
create type recurring_type_enum as enum ('continue', 'serie');
create type frequency_enum as enum ('semaine', 'deux_semaines', 'mois');

-- ------------------------------------------------------------
-- households
-- ------------------------------------------------------------
create table households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Phil & Béa',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- profiles (étend auth.users)
-- ------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  name         text not null,
  person       person_enum not null,
  household_id uuid references households(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Créer automatiquement un profil vide lors de l'inscription
-- (le nom/person sont insérés côté client juste après)
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  -- Le profil est inséré explicitement côté client avec name+person
  -- Cette fonction est un filet de sécurité
  insert into public.profiles (id, name, person)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Utilisateur'), 'bea')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- invite_codes
-- ------------------------------------------------------------
create table invite_codes (
  id           uuid primary key default gen_random_uuid(),
  code         char(6) not null unique,
  household_id uuid not null references households(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete cascade,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  used_by      uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- categories
-- ------------------------------------------------------------
create table categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name         text not null,
  icon         text not null default 'receipt',
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- expenses (dépenses ponctuelles)
-- ------------------------------------------------------------
create table expenses (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  date         date not null,
  description  text not null,
  category_id  uuid references categories(id) on delete set null,
  amount       numeric(10,2) not null check (amount >= 0),
  payer        person_enum not null,
  split        split_enum not null,
  gas          jsonb,  -- { distanceKm, tollAmount, gasPricePerL, vehicleId }
  created_at   timestamptz not null default now(),
  created_by   uuid not null references auth.users(id) on delete cascade
);

-- ------------------------------------------------------------
-- recurrings (continues + séries)
-- ------------------------------------------------------------
create table recurrings (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  type         recurring_type_enum not null,
  description  text not null,
  category_id  uuid references categories(id) on delete set null,
  payer        person_enum not null,
  split        split_enum not null,
  archived     boolean not null default false,
  rates        jsonb not null default '[]'::jsonb,  -- [{ from, amount }]
  -- continue only
  frequency    frequency_enum,
  start_date   date,
  -- serie only
  occurrences  int check (occurrences > 0),
  year         int,
  created_at   timestamptz not null default now(),
  created_by   uuid not null references auth.users(id) on delete cascade
);

-- ------------------------------------------------------------
-- settlements (remboursements)
-- ------------------------------------------------------------
create table settlements (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  date         date not null,
  from_person  person_enum not null,
  amount       numeric(10,2) not null check (amount > 0),
  created_at   timestamptz not null default now(),
  created_by   uuid not null references auth.users(id) on delete cascade
);

-- ------------------------------------------------------------
-- settings (un seul enregistrement par foyer)
-- ------------------------------------------------------------
create table settings (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null unique references households(id) on delete cascade,
  vehicles         jsonb not null default '[]'::jsonb,  -- [{ id, name, l100 }]
  trips            jsonb not null default '[]'::jsonb,  -- [{ id, name, km, toll }]
  default_gas_price numeric(6,3) not null default 1.600,
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- RLS (Row Level Security)
-- ------------------------------------------------------------
alter table households   enable row level security;
alter table profiles     enable row level security;
alter table invite_codes enable row level security;
alter table categories   enable row level security;
alter table expenses     enable row level security;
alter table recurrings   enable row level security;
alter table settlements  enable row level security;
alter table settings     enable row level security;

-- Helper : retourne l'household_id de l'utilisateur courant
create or replace function my_household_id()
returns uuid language sql stable security definer as $$
  select household_id from profiles where id = auth.uid()
$$;

-- households : lecture si membre, insertion pour créer le sien
create policy "household_select" on households for select
  using (id = my_household_id());

create policy "household_insert" on households for insert
  with check (auth.uid() is not null);

-- profiles : lecture de son foyer, update de son propre profil
create policy "profiles_select" on profiles for select
  using (household_id = my_household_id() or id = auth.uid());

create policy "profiles_insert" on profiles for insert
  with check (id = auth.uid());

create policy "profiles_update" on profiles for update
  using (id = auth.uid());

-- invite_codes : select pour valider un code, insert/update pour le créateur
create policy "invite_select" on invite_codes for select
  using (auth.uid() is not null);

create policy "invite_insert" on invite_codes for insert
  with check (created_by = auth.uid());

create policy "invite_update" on invite_codes for update
  using (auth.uid() is not null);

-- Toutes les tables household-scoped : accès si même foyer
create policy "categories_all" on categories for all
  using (household_id = my_household_id())
  with check (household_id = my_household_id());

create policy "expenses_all" on expenses for all
  using (household_id = my_household_id())
  with check (household_id = my_household_id());

create policy "recurrings_all" on recurrings for all
  using (household_id = my_household_id())
  with check (household_id = my_household_id());

create policy "settlements_all" on settlements for all
  using (household_id = my_household_id())
  with check (household_id = my_household_id());

create policy "settings_all" on settings for all
  using (household_id = my_household_id())
  with check (household_id = my_household_id());

-- ------------------------------------------------------------
-- Realtime : activer pour les tables qui nécessitent la synchro live
-- ------------------------------------------------------------
alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table recurrings;
alter publication supabase_realtime add table settlements;
alter publication supabase_realtime add table settings;
