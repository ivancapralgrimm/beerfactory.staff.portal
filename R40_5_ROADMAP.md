# r40.5 Article Editor roadmap — final technical pass

- COMPLETE: native initial integration and baseline access hotfix v2 verification.
- COMPLETE: align frontend to the actual supplied Supabase Live Sync contract.
- COMPLETE: exact applied migration history, generated seed and exact Edge source.
- COMPLETE: safe r40.5 preview source activation with production legacy guard/rollback.
- COMPLETE: local checks — 26 tests, 31 built-preview browser scenarios, typecheck,
  production/preview builds, seed semantics and original protected-file parity.
- REVIEW: backend mark validation, plain list search corpus, create race, image parsing.
- NEEDS_LIVE_QA: real authorization/concurrency/Storage, parity and physical PWA.
- SEPARATE DECISION: production cutover and eventual legacy content/assets removal.

No push/merge/deploy or live migration execution is part of this handoff.
CODEX_FINAL_REPORT.md and TEST_REPORT.md are current; initial reports are historical
in docs/r40.5-initial-integration/. All remaining work has a concrete record.

## Accepted technical base → final UX pass

COMPLETE: progressive disclosure and article-like editing UI; all technical contracts
and features retained. Current verification: 28 tests / 35 browser scenarios, actual
mobile/desktop build screenshots. See UX_PASS_REPORT.md. Remaining live/security QA,
production cutover and legacy removal decisions stay separate and unchanged.
