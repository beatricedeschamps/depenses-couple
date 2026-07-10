-- ============================================================
-- Fix : trigger qui crée le profil automatiquement
-- lors de l'inscription, avant que le client reçoive la session
-- ============================================================

-- Fonction trigger (security definer → accès à auth.users)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, person, household_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Utilisateur'),
    (new.raw_user_meta_data->>'person')::public.person_enum,
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger sur auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Appliquer aussi le fix RLS du fichier précédent
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
