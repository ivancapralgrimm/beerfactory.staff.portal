# r40.5 Article Editor — upload instructions

Target: GitHub branch `r40.5` only. Do not upload this release candidate to `main`.

The preferred manual package is `BFStaff_r40.5_ARTICLE_EDITOR_UPLOAD_OVERLAY.zip`.
It contains only the files that must be added/replaced over the current clean r40.5 baseline plus verification/docs. The full release-candidate ZIP is for audit/backup and does not need to be uploaded wholesale.

Required GitHub baseline before upload:

`d98aab55fc8893cc44313379c52e47db61a42f0f`

## Upload

1. Extract `BFStaff_r40.5_ARTICLE_EDITOR_UPLOAD_OVERLAY.zip` locally.
2. Open the contained `BFStaff_r40.5_UPLOAD_OVERLAY` folder.
3. On GitHub, switch to branch `r40.5`.
4. Add/replace the overlay contents at repository root, preserving their folder paths.
5. Commit only to `r40.5`.
6. Let Vercel build the branch Preview.
7. Do not merge to `main` until preview/live QA is complete.

## Supabase warning

All four Knowledge migrations contained in the overlay are already present in the current live Supabase migration history, including:

- `20260930151257_r40_5_knowledge_content_foundation`
- `20260930151818_r40_5_knowledge_security_hardening`
- `20260930152047_r40_5_knowledge_legacy_seed_v1`
- `20260930214301_r40_5_knowledge_integrity_hardening`

Do NOT manually execute them again on the current project.

`knowledge-media-upload` v2 is also already ACTIVE with `verify_jwt=true`. Do NOT redeploy it merely because its source file is committed to GitHub.

Keep `assets/training-data.txt` and all legacy Knowledge images. They remain rollback/parity material until preview cutover is explicitly approved.

See `CHATGPT_FINAL_REVIEW.md`, `CHATGPT_TEST_REPORT.md`, and `NEEDS_LIVE_QA.md` for verification status and remaining gates.
