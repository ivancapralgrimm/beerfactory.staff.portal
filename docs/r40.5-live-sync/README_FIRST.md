# BFStaff r40.5 Supabase foundation live sync

This package records the server work performed in parallel while Codex integrates the Article Editor.

Important:
1. These migrations are already applied on the live Supabase project.
2. Production frontend has NOT been switched to them.
3. Do not run the migration files against that same live project again.
4. Add matching migration files to the r40.5 repository so migration history is reproducible.
5. The third seed migration is deterministic and generated from `assets/training-data.txt` using `tools/build-knowledge-legacy-seed.mjs`.
6. Existing 12 bundled images are still represented by `legacySrc`; permanent Storage migration is a later gated step.
7. `knowledge-media-upload` must be committed to `supabase/functions/knowledge-media-upload/index.ts` exactly or reviewed if Codex changed the client contract.

Read `docs/BACKEND_CONTRACT.md` before merging Codex output.
