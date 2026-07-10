-- ============================================================
-- Mise à jour de create_household_for_user :
-- seed les catégories par défaut + ligne settings
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

  if exists (select 1 from public.profiles where id = v_user_id and household_id is not null) then
    raise exception 'Foyer déjà existant';
  end if;

  insert into public.households (name)
  values ('Phil & Béa')
  returning id into v_household_id;

  update public.profiles
  set household_id = v_household_id
  where id = v_user_id;

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

  insert into public.categories (household_id, name, icon) values
    (v_household_id, 'Déplacement',     'car'),
    (v_household_id, 'Épicerie et santé','cart'),
    (v_household_id, 'Maison',          'home'),
    (v_household_id, 'Services',        'bolt'),
    (v_household_id, 'Assurances',      'shield'),
    (v_household_id, 'Restaurant',      'dome'),
    (v_household_id, 'Activités',       'star'),
    (v_household_id, 'Cadeaux',         'gift'),
    (v_household_id, 'Autre',           'tag');

  insert into public.settings (household_id, vehicles, trips, default_gas_price)
  values (v_household_id, '[]'::jsonb, '[]'::jsonb, 1.52);

  return json_build_object(
    'household_id', v_household_id,
    'code', v_code
  );
end;
$$;

grant execute on function public.create_household_for_user() to authenticated;

-- ============================================================
-- Seed pour les foyers existants sans catégories / settings
-- ============================================================
do $$
declare
  v_hh_id uuid;
begin
  for v_hh_id in (
    select h.id from public.households h
    where not exists (select 1 from public.categories c where c.household_id = h.id)
  ) loop
    insert into public.categories (household_id, name, icon) values
      (v_hh_id, 'Déplacement',     'car'),
      (v_hh_id, 'Épicerie et santé','cart'),
      (v_hh_id, 'Maison',          'home'),
      (v_hh_id, 'Services',        'bolt'),
      (v_hh_id, 'Assurances',      'shield'),
      (v_hh_id, 'Restaurant',      'dome'),
      (v_hh_id, 'Activités',       'star'),
      (v_hh_id, 'Cadeaux',         'gift'),
      (v_hh_id, 'Autre',           'tag');
  end loop;

  for v_hh_id in (
    select h.id from public.households h
    where not exists (select 1 from public.settings s where s.household_id = h.id)
  ) loop
    insert into public.settings (household_id, vehicles, trips, default_gas_price)
    values (v_hh_id, '[]'::jsonb, '[]'::jsonb, 1.52);
  end loop;
end;
$$;
