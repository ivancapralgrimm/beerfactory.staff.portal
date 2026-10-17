# Supabase production state and applied migrations

Live state was checked through the connected Supabase API on 2026-10-07.
Migration SQL files in this repository are schema history and must not be deleted,
even when a later migration supersedes their behavior.

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

## r40.5 Knowledge Live Sync — supplied server-state record, 2026-09-30

The backend handoff reports these as already applied to the same live project:

- 20260930151257_r40_5_knowledge_content_foundation
- 20260930151818_r40_5_knowledge_security_hardening
- 20260930152047_r40_5_knowledge_legacy_seed_v1

Matching SQL files are now recorded in supabase/migrations; the seed SQL is reproduced
with the exact supplied generator. Codex did not execute or independently query live
migration history. Do not reapply them or run db push as part of this return.
See BACKEND_CONTRACT_CHECK.md for provenance, hashes and exact Edge-source sync.

## r40.5 post-Codex Knowledge hardening — applied live

- `20260930214301` · `r40_5_knowledge_integrity_hardening`
- `knowledge-media-upload` Edge Function v2 ACTIVE, `verify_jwt=true`

The migration and Edge source are included in this repository for reproducibility. They are already applied/deployed to the current Supabase project and must not be manually rerun merely because the files are uploaded to GitHub.

## r40.6 auth and attestation — applied live

The following newer migrations are present in live migration history and have
matching SQL files in `supabase/migrations`:

- `20261003213857` · `grant_authenticated_execute_is_manager_or_admin`
- `20261005101209` · `add_staff_login_rate_limit`
- `20261005130639` · `attestation_bank_online_editor_foundation`
- `20261005130711` · `seed_attestation_bank_from_legacy_json`
- `20261005153815` · `attestation_attempt_snapshot_threshold`
- `20261005174308` · `attestation_question_subcategories`
- `20261006211201` · `attestation_editor_settings_categories`
- `20261007082211` · `attestation_category_ticket_sizes`

The attestation bank, editor settings, categories, ticket sizes, attempt
snapshots and staff login rate limiting are therefore production schema
contracts. Do not remove, rename or manually rerun these migration files.

## Active Edge Functions verified live

- `staff-login` v8
- `staff-register` v2
- `staff-recover` v7
- `staff-set-recovery` v4
- `staff-profile` v8
- `staff-admin-users` v7
- `handover-push` v7
- `knowledge-media-upload` v2

`handover-push` remains a current dependency of the new Feed frontend. The old
`src/features/handover` UI can be removed without deleting this function.

The live project also contains `staff-login-qa` v3. It is a separately deployed
QA function and has no source directory in this branch; repository cleanup must
not be interpreted as deleting or redeploying it.

## Clean-database and history rule

Do not shorten `supabase/migrations` file by file. If migration compaction is
needed later, create a separately reviewed baseline/squash and verify both a
clean database bootstrap and agreement with the live migration history first.
