-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history:
-- 20260923175915 restrict_profile_directory_columns
--
-- Keep for source-of-truth. Do not manually rerun on the current live project.

revoke select on table public.profiles from authenticated;

grant select (
  id,
  first_name,
  last_name,
  position,
  position_code,
  avatar_url
)
on table public.profiles
to authenticated;
