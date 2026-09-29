-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history: 20260922175321 harden_position_shift_table_privileges
--
-- Keep this file in Git for reproducibility.
-- Do NOT manually rerun it against the current live project.

revoke all on table public.position_shift_check_definitions from anon;
revoke all on table public.position_shift_states from anon;
revoke all on table public.position_shift_checks from anon;

revoke truncate, references, trigger
  on table public.position_shift_check_definitions
  from authenticated;

revoke truncate, references, trigger
  on table public.position_shift_states
  from authenticated;

revoke truncate, references, trigger
  on table public.position_shift_checks
  from authenticated;

grant select on table public.position_shift_check_definitions to authenticated;
grant select on table public.position_shift_states to authenticated;
grant select on table public.position_shift_checks to authenticated;
