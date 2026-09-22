# BeerFactory r40.4 · Repository delta audit

Audited branch: `r40.4-react`
Audited HEAD: `79315746d666c5bf121ad80b2b24a3186622f0e4`

This package contains only work that is not present in that audited repository state.

## REPLACE

- `src/app/App.tsx`
  - current Git blob: `2c37630e55bc9a9e47c8b23ac50d894be39d6f72`
  - package Git blob: `704e6848c32e6aaf0b7bf0d45a27589f5352e01a`
- `src/features/auth/auth-api.ts`
  - current Git blob: `da0c36561c0da0b0b2baafdde9fa33f884bf3466`
  - package Git blob: `c4e06095e6a267ec8fa8934e11d4690f33d9a0a7`
- `src/pages/ProfilePage.tsx`
  - current Git blob: `4d6008253a1402efe3e2fbde334402b6a7513afd`
  - package Git blob: `16b4533e8243a9fe3191a9180b01bbea6acab1d3`
- `src/types/auth.ts`
  - current Git blob: `3c66deb44c5f92950d143536ded4b9884a503728`
  - package Git blob: `7a5269d8f1202d563ce21323e873d0848680b14f`

## ADD

- `DEMO_SHIFT_CHECKLISTS.md`
- `DESIGN_SYSTEM.md`
- `R40_4_ROADMAP.md`
- `R40_4_SHIFT_POSITION_V5.md`
- `SHIFT_CHECKBOX_QA_V5.md`
- `SUPABASE_ALREADY_APPLIED.txt`
- `SUPABASE_MIGRATIONS_APPLIED.md`
- `src/features/shift/ShiftPage.tsx`
- `src/features/shift/shift-api.ts`
- `src/features/shift/types.ts`
- `supabase/functions/staff-profile/deno.json`
- `supabase/functions/staff-profile/index.ts`
- `supabase/migrations/20260922153817_add_position_aware_shift_v2.sql`
- `supabase/migrations/20260922153947_harden_position_shift_v2.sql`
- `supabase/migrations/20260922154038_make_position_shift_read_non_destructive.sql`
- `supabase/migrations/20260922161603_seed_waiter_manager_demo_shift_checklists.sql`
- `supabase/migrations/20260922161749_add_hostess_staff_position.sql`
- `supabase/migrations/20260922161802_seed_hostess_demo_shift_checklist.sql`

## Already present and intentionally NOT included

- React foundation / AppShell / shared UI primitives
- Auth login/session/recovery flow
- Recipes migration and source-aware IDs
- Knowledge migration and training progress
- Attestation migration, question bank and history
- CTA visibility fix for `Аттестация` and `Повторить тему`

## Backend state

The position-aware Shift migrations and `staff-profile` Edge Function v5 are already deployed to live Supabase.
This package adds their source to GitHub so repository state matches deployed backend state.

## Important scope note

This delta includes the Profile functionality required by Shift: personal working-position selection.
The later full React Admin migration (employee management UI, role/activation/audit screens) is not silently claimed as complete here.

## Repository policy update

`docs/design/BFStaff_design-system-preview.png` is intentionally NOT required in the repository.
It is not used by runtime code or deployment and should not be treated as a missing file during audits.
