# Supabase migrations already applied

These r40.4 migrations were applied through the connected Supabase migration API:

- `20260922153817` · `add_position_aware_shift_v2`
- `20260922153947` · `harden_position_shift_v2`
- `20260922154038` · `make_position_shift_read_non_destructive`
- `20260922161603` · `seed_waiter_manager_demo_shift_checklists`
- `20260922161749` · `add_hostess_staff_position`
- `20260922161802` · `seed_hostess_demo_shift_checklist`
- `20260922175321` · `harden_position_shift_table_privileges`
- `20260922184713` · `add_react_handover_create_rpc_and_harden_grants`
- `20260922185135` · `reset_handover_and_add_60_day_retention`
- `20260922185826` · `revoke_anon_create_handover_execute`
- `20260922191434` · `add_web_push_subscriptions`
- `20260922191509` · `add_web_push_vapid_config`
- `20260922191810` · `normalize_web_push_metadata`
- `20260923174754` · `harden_profile_admin_and_update_delete_v2`
- `20260923175915` · `restrict_profile_directory_columns`

They are already present in the live Supabase migration history.

Do not manually rerun migration SQL against the current production project.
The SQL files are committed for reproducibility and future environments.

## Current backend result

- position-aware Shift active for 4 working positions;
- Handover + 60-day retention + Web Push active;
- `staff-profile` v6 active;
- `staff-admin-users` v5 active;
- four access roles supported by Admin;
- owner protection strengthened;
- profile deletion now clears Shift v2 references;
- `profiles`, `quiz_attempts`, `audit_log` client grants hardened;
- direct profile directory reads are restricted to non-sensitive public staff fields.
