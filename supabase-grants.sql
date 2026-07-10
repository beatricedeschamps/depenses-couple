-- ============================================================
-- Grants manquants sur toutes les tables
-- Les tables créées via SQL brut n'ont pas les permissions
-- automatiques que le dashboard ajoute normalement.
-- ============================================================

grant usage on schema public to anon, authenticated;

grant all on public.households   to authenticated;
grant all on public.profiles     to authenticated;
grant all on public.invite_codes to authenticated;
grant all on public.categories   to authenticated;
grant all on public.expenses     to authenticated;
grant all on public.recurrings   to authenticated;
grant all on public.settlements  to authenticated;
grant all on public.settings     to authenticated;

-- Séquences (pour les uuid générés côté serveur — bonne pratique)
grant usage on all sequences in schema public to authenticated;

-- anon n'a pas besoin d'accès aux données (tout passe par authenticated)
-- mais needs execute sur les fonctions RPC publiques
grant execute on function public.create_my_profile(text, text) to authenticated;
grant execute on function public.my_household_id() to authenticated;
