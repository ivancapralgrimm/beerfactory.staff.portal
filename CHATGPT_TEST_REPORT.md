# BFStaff r40.5 Article Editor — ChatGPT verification report

## Source reviewed

- Codex UX final package: `BFStaff_r40.5_CODEX_ARTICLE_EDITOR_UX_FINAL.zip`
- Source package SHA-256: `997609e6367080d1458ed08ea4b7110592209e8675bc1c7ea9687e3a2b08942c`
- GitHub target baseline: branch `r40.5`, commit `d98aab55fc8893cc44313379c52e47db61a42f0f`

## Archive integrity

Before backend-owner changes, the supplied Codex `CHECKSUMS.json` was independently verified: **360/360 PASS**.

## Codex evidence retained as attributed evidence

Codex reports, on its own Node 24 environment:

- TypeScript/typecheck: PASS
- production build: PASS
- source/unit suite: 28 PASS
- browser scenarios: 35 PASS
- real rendered mobile and desktop editor screenshots produced

These are retained as Codex evidence. They were not relabeled as independently rerun by ChatGPT.

## Independent local post-review checks

The final candidate was checked under the available Node 22 environment after backend hardening:

`node --test tests/ux-invariants.test.cjs tests/backend-hardening.test.cjs tests/edge-contract.test.cjs`

Result: **10/10 PASS**.

Coverage includes:

- protected auth/server/schema/reader/source artifacts retained;
- editor access/load/save/upload/revision/conflict/backup logic retained;
- integrity-hardening migration invariants present;
- pinned Edge dependency and structural validation present;
- JWT/context denial paths cause no media writes;
- valid image path creates pending media and 900-second signed URL request;
- invalid/empty/oversize/impossible-dimension media rejected;
- structurally truncated containers rejected before Storage;
- metadata failure removes pending Storage object;
- signing failure does not falsely discard successfully stored metadata.

Dependency-based suites were not independently rerun because the returned archive correctly excludes `node_modules`, and this environment did not have the full dependency tree installed. This is an environment limitation, not a product-test failure.

## Live Supabase verification after backend hardening

Migration applied live:

- `20260930214301_r40_5_knowledge_integrity_hardening`

Edge deployed live:

- `knowledge-media-upload` v2
- status: ACTIVE
- `verify_jwt=true`
- deployed bundle hash reported by Supabase: `6994d392c86177beb3b34fbb1ecef381f53a76bef10aa8c26f054234025de2c8`

Live smoke checks:

1. JavaScript UTF-16 length for `A🍺B` = 4: PASS.
2. Out-of-range rich-text mark rejected with `article_mark_invalid`: PASS.
3. List search corpus contains plain item text and not serialized mark/list JSON field names: PASS.
4. Duplicate article ID insert normalized to `article_revision_conflict`: PASS.
5. Data counts unchanged after tests: 26 articles / 351 blocks / 0 media rows / 0 explicit editor grants / 13 training-progress rows.

## Advisors

Post-hardening advisors were run.

No new critical Knowledge finding was introduced. Remaining notices are existing/intended project notices, including authenticated `SECURITY DEFINER` RPC warnings, leaked-password protection disabled, one unrelated `push_vapid_config` RLS/no-policy info item, and unused-index informational notices.

## Remaining live gates

Still requires preview/live QA with approved accounts/devices:

- Owner/Admin real create/edit/publish;
- Staff/Senior direct-RPC/direct-Storage denial;
- two real sessions and conflict recovery;
- real PNG/JPEG/WebP/GIF upload and malformed-file rejection against deployed Edge;
- private signed URL expiry/access behavior;
- physical iOS/Android installed PWA;
- network smoke from Russia without VPN;
- visual parity of all migrated legacy articles.

Result: **accepted as an r40.5 Preview release candidate, not approved for production main cutover yet.**
