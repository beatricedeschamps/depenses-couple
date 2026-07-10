-- ============================================================
-- Patch RLS — à rouler dans SQL Editor si le profil existe
-- en base mais n'est pas lisible côté client
-- ============================================================

-- 1. Recréer my_household_id() avec le bon search_path
--    et (select auth.uid()) pour que le JWT soit bien propagé
--    dans les fonctions security definer
drop function if exists public.my_household_id();

create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.household_id
  from public.profiles p
  where p.id = (select auth.uid())
  limit 1
$$;

-- 2. Recréer les politiques profiles
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;

-- Lire son propre profil (toujours, même sans foyer)
create policy "profiles_select_own" on public.profiles
  for select using (id = (select auth.uid()));

-- Lire les profils des membres du même foyer
create policy "profiles_select_household" on public.profiles
  for select using (
    household_id is not null
    and household_id = public.my_household_id()
  );

create policy "profiles_insert" on public.profiles
  for insert with check (id = (select auth.uid()));

create policy "profiles_update" on public.profiles
  for update using (id = (select auth.uid()));

-- 3. Corriger aussi les autres politiques qui utilisent auth.uid()
--    directement (même précaution)
drop policy if exists "household_insert" on public.households;
drop policy if exists "invite_select" on public.invite_codes;
drop policy if exists "invite_insert" on public.invite_codes;
drop policy if exists "invite_update" on public.invite_codes;

create policy "household_insert" on public.households
  for insert with check ((select auth.uid()) is not null);

create policy "invite_select" on public.invite_codes
  for select using ((select auth.uid()) is not null);

create policy "invite_insert" on public.invite_codes
  for insert with check (created_by = (select auth.uid()));

create policy "invite_update" on public.invite_codes
  for update using ((select auth.uid()) is not null);
