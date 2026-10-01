# ChatGPT post-Codex changes

These changes were made after review of `BFStaff_r40.5_CODEX_ARTICLE_EDITOR_UX_FINAL.zip`.

## Added

- `supabase/migrations/20260930214301_r40_5_knowledge_integrity_hardening.sql`
- `tests/backend-hardening.test.cjs`
- `CHATGPT_FINAL_REVIEW.md`
- `CHATGPT_TEST_REPORT.md`
- `CHATGPT_CHANGED_FILES.md`
- `README_UPLOAD_FINAL.md`

## Modified

- `supabase/functions/knowledge-media-upload/index.ts`
  - pinned `@supabase/supabase-js@2.116.0`;
  - added bounded PNG/GIF/JPEG/WebP structural validation.
- `tests/edge-contract.test.cjs`
  - updated for hardened image structure checks;
  - added truncated-container rejection.
- `tests/live-sync.test.cjs`
  - recognizes live integrity hardening and Edge v2;
  - clean report-directory creation.
- `tests/ux-invariants.test.cjs`
  - baseline wording aligned with final candidate.
- `package.json`
  - includes backend-hardening test in the normal test command.
- `UX_BASELINE_PROTECTED.json`
  - records new migration and Edge v2 baseline.
- `R40_5_CODEX_BACKEND_REQUESTS.md`
  - BR-01/02/03 marked resolved; BR-04 marked hardened.
- `SUPABASE_MIGRATIONS_APPLIED.md`
- `SUPABASE_ALREADY_APPLIED.txt`
- `BACKEND_CONTRACT_CHECK.md`
- `NEEDS_LIVE_QA.md`

No auth role/position rules, production users, passwords, existing production Knowledge reader, legacy article IDs, or training progress were changed by this post-Codex hardening pass.
