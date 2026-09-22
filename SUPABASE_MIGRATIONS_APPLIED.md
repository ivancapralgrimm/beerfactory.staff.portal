# Supabase migrations already applied

These migrations were applied through the connected Supabase migration API:

- `20260922153817` · `add_position_aware_shift_v2`
- `20260922153947` · `harden_position_shift_v2`
- `20260922154038` · `make_position_shift_read_non_destructive`
- `20260922161603` · `seed_waiter_manager_demo_shift_checklists`
- `20260922161749` · `add_hostess_staff_position`
- `20260922161802` · `seed_hostess_demo_shift_checklist`
- `20260922175321` · `harden_position_shift_table_privileges`

They are already present in the live Supabase migration history.

Do not manually rerun migration SQL against production from this frontend transfer package.
The canonical deployed schema/functions are the live Supabase migration history.

Backend result:
- `profiles.position_code` added
- role-aware Shift v2 tables added
- bartender definitions seeded from the existing Bar checklist
- waiter/manager/hostess demo definitions seeded (6 opening + 6 closing each)
- Shift v2 RPCs restricted to authenticated users
- Shift read RPC is non-destructive
- stable r40.3 legacy Shift RPCs were not replaced
- `staff-profile` Edge Function v5 deployed with backwards-compatible legacy `position` support and `hostess`

## Repository source

The matching SQL source files are now included in `supabase/migrations/`.

They mirror migrations already present in the live Supabase migration history.
They are committed for reproducibility and future environments, not to be manually rerun
against the current live project.

## Post-smoke security hardening

Smoke QA found default table privileges that were broader than intended on the new
`position_shift_*` tables. The live project now has:

- no table privileges for `anon`;
- `authenticated` keeps only `SELECT` on the three position-shift tables;
- all writes continue through constrained RPCs;
- `TRUNCATE`, `REFERENCES` and `TRIGGER` are revoked from client roles.
