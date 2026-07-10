-- ============================================================
-- RPC security definer pour créer le foyer + code d'invitation
-- Bypasse la RLS, atomique, retourne le code généré
-- ============================================================

create or replace function public.create_household_for_user()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_household_id uuid;
  v_code text;
  v_expires_at timestamptz;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code_exists boolean;
  i int;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  -- Vérifier que l'utilisateur n'a pas déjà un foyer
  if exists (select 1 from public.profiles where id = v_user_id and household_id is not null) then
    raise exception 'Foyer déjà existant';
  end if;

  -- Créer le foyer
  insert into public.households (name)
  values ('Phil & Béa')
  returning id into v_household_id;

  -- Lier le profil au foyer
  update public.profiles
  set household_id = v_household_id
  where id = v_user_id;

  -- Générer un code unique à 6 caractères
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    end loop;
    select exists(select 1 from public.invite_codes where code = v_code) into v_code_exists;
    exit when not v_code_exists;
  end loop;

  v_expires_at := now() + interval '7 days';

  insert into public.invite_codes (code, household_id, created_by, expires_at)
  values (v_code, v_household_id, v_user_id, v_expires_at);

  return json_build_object(
    'household_id', v_household_id,
    'code', v_code
  );
end;
$$;

grant execute on function public.create_household_for_user() to authenticated;

-- ============================================================
-- RPC pour rejoindre un foyer via code
-- ============================================================

create or replace function public.join_household_with_code(p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_invite public.invite_codes%rowtype;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  -- Trouver le code valide
  select * into v_invite
  from public.invite_codes
  where code = upper(trim(p_code))
    and used_at is null
    and expires_at > now();

  if not found then
    raise exception 'Code invalide ou expiré';
  end if;

  if v_invite.created_by = v_user_id then
    raise exception 'Tu ne peux pas rejoindre ton propre foyer';
  end if;

  -- Lier le profil
  update public.profiles
  set household_id = v_invite.household_id
  where id = v_user_id;

  -- Marquer le code comme utilisé
  update public.invite_codes
  set used_at = now(), used_by = v_user_id
  where id = v_invite.id;

  return json_build_object('household_id', v_invite.household_id);
end;
$$;

grant execute on function public.join_household_with_code(text) to authenticated;

-- ============================================================
-- Fix la politique SELECT de households pour inclure
-- le cas juste après création (household_id vient d'être mis à jour)
-- ============================================================
drop policy if exists "household_select" on public.households;

create policy "household_select" on public.households
  for select using (id = public.my_household_id());
