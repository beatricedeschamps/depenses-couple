-- ============================================================
-- Supprimer le trigger (il cause des problèmes)
-- et créer une RPC security definer pour insérer le profil
-- ============================================================

-- 1. Supprimer le trigger
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 2. Fonction RPC appelée par le client juste après signUp
--    security definer → bypasse la RLS, s'exécute avec auth.uid() valide
create or replace function public.create_my_profile(
  p_name text,
  p_person text   -- text pour éviter les problèmes de cast côté RPC
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person public.person_enum;
begin
  -- Cast sécurisé avec fallback
  begin
    v_person := p_person::public.person_enum;
  exception when invalid_text_representation then
    v_person := 'bea';
  end;

  insert into public.profiles (id, name, person, household_id)
  values ((select auth.uid()), p_name, v_person, null)
  on conflict (id) do nothing;
end;
$$;

-- 3. Fix RLS (même chose que supabase-rls-fix.sql, au cas où)
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

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_household" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (id = (select auth.uid()));

create policy "profiles_select_household" on public.profiles
  for select using (
    household_id is not null
    and household_id = public.my_household_id()
  );

create policy "profiles_insert" on public.profiles
  for insert with check (id = (select auth.uid()));

create policy "profiles_update" on public.profiles
  for update using (id = (select auth.uid()));
