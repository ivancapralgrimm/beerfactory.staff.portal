# BFStaff r40.5 Article Editor — final ChatGPT review

Reviewed source: BFStaff_r40.5_CODEX_ARTICLE_EDITOR_UX_FINAL.zip.

## UX decision

Accepted for r40.5 preview. The editor now uses progressive disclosure instead of exposing the internal block model: one + Add control, text/photo as primary insertions, compact text formatting, Aa/type menu, overflow actions, advanced image alt, collapsed article parameters, and a text/photo/text visual flow. Backend/schema v2 is unchanged by the UX pass.

## Independent archive checks

- Uploaded ZIP extracted successfully.
- Original Codex CHECKSUMS verified: 360/360 before backend-owner additions.
- Compared against the preceding technical-final ZIP: UX runtime changes were limited to editor presentation, styles, tests and reports; protected auth/Knowledge/backend files were unchanged by Codex.
- Independent Node 22 run: ux-invariants 2/2 PASS before intentional backend hardening; Edge contract 5/5 PASS before hardening. Dependency-based suites could not be rerun locally because node_modules is intentionally absent. Codex evidence reports Node 24 typecheck/build plus 28 source/unit and 35 browser scenarios PASS; this remains attributed to Codex, not re-labeled as independently repeated.

## Live Supabase hardening performed after Codex

Already applied/deployed to the current Supabase project:

- Migration 20260930214301_r40_5_knowledge_integrity_hardening
  - strict UTF-16 mark bounds/null/type validation;
  - plain list search corpus, no list JSON/mark leakage;
  - duplicate/simultaneous article create normalization to article_revision_conflict.
- knowledge-media-upload Edge Function v2 ACTIVE, verify_jwt=true
  - pinned npm:@supabase/supabase-js@2.116.0;
  - bounded PNG/GIF/JPEG/WebP structural validation before private Storage;
  - existing auth/editor-context/size/dimension checks retained.

Live smoke checks after the migration:

- UTF-16 A🍺B length = 4: PASS.
- Out-of-range mark rejected as article_mark_invalid: PASS.
- List search helper contains plain item text and no serialized mark/text JSON keys: PASS.
- Duplicate article insert normalized to article_revision_conflict: PASS.
- Knowledge row counts unchanged: 26 articles / 351 blocks / 0 new media rows / 0 explicit grants / 13 training-progress rows.

## Remaining gates

This is ready for the r40.5 Vercel Preview branch, not production main. Real account/device QA is still required for Owner/Admin create/edit/publish, Staff/Senior denial, two-session conflict, real Storage upload/signed URLs, installed iOS/Android PWA and Russian-network access. Legacy Knowledge assets/training-data remain rollback material until preview parity is confirmed.

Do not manually rerun the already-applied Knowledge migrations or redeploy Edge merely because their source files are committed to r40.5.
