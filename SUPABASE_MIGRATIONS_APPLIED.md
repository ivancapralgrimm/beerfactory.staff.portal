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
- `20260922191810` · `normalize_web_push_metadata`
- `20260922191509` · `add_web_push_vapid_config`
- `20260922191434` · `add_web_push_subscriptions`

They are already present in the live Supabase migration history.

Do not manually rerun migration SQL against the current production project.
The SQL files are committed for reproducibility and future environments.

## Shift result

- `profiles.position_code` added
- position-aware Shift tables and RPCs active
- four positions configured
- Shift read is non-destructive
- position-shift client table privileges hardened
- stable r40.3 legacy Shift RPCs were not replaced

## Handover result

- pre-r40.4 Handover history intentionally reset
- `public.create_handover(...)` added for React
- all authenticated staff read the same retained notes
- note creation does not create/open a Shift
- `anon` table access removed
- anonymous EXECUTE on `create_handover` explicitly revoked
- dangerous authenticated table privileges removed
- legacy column-level INSERT/UPDATE compatibility retained until release gate
- `pg_cron` enabled
- private 60-day cleanup function added
- monthly cron job `beerfactory-handover-retention` active

## Web Push result

- per-device push subscriptions table added
- auth-bound register/unregister RPCs added
- server-only VAPID config added
- `handover-push` Edge Function deployed
- VAPID private key is generated server-side and is not stored in Git
- author is excluded from Handover push recipients
