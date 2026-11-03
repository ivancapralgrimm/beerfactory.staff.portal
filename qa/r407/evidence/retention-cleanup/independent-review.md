# Independent retention and repository-cleanup review

ship

Final status: no open review blocker. Live SQL/cron receipt, staged deletion inventory, final test evidence, and three fresh screenshot samples reviewed. Main remains unchanged. Findings below record both the earlier issues and their final resolution.

Scope: read-only inspection of `/workspace/bfstaff-publish-r407-2026-11-02` on `redesign/r40.7-warm-hall-v3`. No live employee authentication, production writes, repository edits, or deletions were performed by this reviewer. This report is outside the repository.

Read independently: root `AGENTS.md`, `skills/unslop/SKILL.md`, `skills/hallmark/SKILL.md`, Hallmark `references/review-finish.md`, and Supabase skill `c2/supabase`. This is a data/code safety review; no visual finish PASS is claimed.

## Early findings for implementation

1. The historical `private.cleanup_handover_history()` deletes every note older than 60 days, and a named monthly `beerfactory-handover-retention` cron invokes it. Both the callable function behavior and scheduled path must be replaced so neither can bypass the latest-ten floor or delete unresolved Feed posts.
2. Retained `quiz_attempts.question_revisions` point to `attestation_question_versions` through JSON, not an enforced FK. Deleting versions solely by age breaks retained historical detail and offline submission validation. Retain all versions referenced by retained attempts; avoid deleting versions in this change unless separately proven safe for pending offline attempts.
3. `position_shift_states.shift_id` and `position_shift_checks.position_shift_id` use cascading FKs. A parent shift deletion must never erase a retained per-position record. Active/current states must remain, including an old parent with any retained child state.
4. Date semantics must be explicit: old created_at with a recent finish/resolution should not become eligible prematurely. Strict older-than-60-days cutoff and deterministic latest-ten ordering require boundary/tie tests.
5. Base tables `notes`, `shifts`, `quiz_attempts`, and `audit_log` predate the checked-in migrations. A simplified fixture cannot prove production compatibility; compare actual introspected columns, constraints, and FKs before production application.

## Deletion guard evidence

- Keep `tests/fixtures/legacy/feed-pulse.ts` and `FeedPulseCard.tsx`: `tests/feed-pulse-r40.6.test.cjs` reads them.
- Keep `docs/patches/r22-allow-incomplete-position-shift.sql`: `tests/unified-shift-feed-contract.test.cjs` executes it in an isolated database.
- Keep `tools/build-knowledge-legacy-seed.mjs`: `tests/live-seed.cjs` executes it and `package.json` exposes `knowledge:seed:live-history` pointing to it. It is distinct from the initial local conversion utility under `scripts/`.
- Keep avatar sources/masks and provenance needed by `scripts/build-staff-avatar-cutouts.mjs`; the generated transparent assets have an auditable source relationship.
- Keep checked-in migration history, Unslop credit, and source licenses. Historical destructive migrations are reference history and must not be replayed against production.
- `public/assets` is ignored build output regenerated wholesale from `assets` by `scripts/sync-public.mjs`. Deleting only the public copy does not remove a source asset. Runtime and retained legacy content references must both be considered before deleting any `assets` file.
- The runtime source orphan check explicitly permits `src/features/knowledge/knowledge-source.ts` and `src/features/knowledge/editor/legacy-markdown.ts` as tooling/rollback modules; being outside the entrypoint import graph does not make them obsolete.

## External documentation checked

Fetched current Supabase changelog and Cron documentation. Cron jobs are represented by `cron.job`, runs by `cron.job_run_details`; scheduling checks should establish exactly one intended job and a safe legacy function path. No relevant API change was identified for the reviewed SQL-only behavior. No live Supabase call was made.

## Concrete review: 2026-11-03

Reviewed `supabase/migrations/20261103193735_r407_history_retention_60d_floor10.sql`, `tests/history-retention-sql.mjs`, and `docs/retention/repository-cleanup-plan.json`.

The implementation handles the early findings: both callable legacy wrapper and cron path obey the new policy; version snapshots remain untouched; terminal position states are ranked per position; parent headers cannot cascade into retained states, notes, or messages; effective age protects recently completed/resolved/received records; active/unstarted states and unresolved or inconsistent Feed records survive. Audit staff/portal grouping matches `AdminAuditPanel.tsx` and `admin-api.ts`. Default and NULL dry runs are read-only; function ACLs deny client and service roles. Internal privileged functions use an empty search path with schema-qualified tables/functions where needed.

Independently executed all 11 supplied PGlite PostgreSQL scenarios successfully. Extended an external `/tmp` copy with three additional scenarios: all three entry points deny EXECUTE to anon/authenticated/service_role; inconsistent Feed flags survive; a current operational date and recent completion protect otherwise old records. All 14 scenarios passed. One initial extra-test assertion incorrectly expected 12 survivors where rank movement correctly produces 11; corrected the assertion without changing implementation.

Inventory verification: exactly 226 unique files totaling 41,562,745 bytes (39.64 MiB), all confined to QA generated png/html/log artifacts and the four explicitly named PDF/ZIP exports. No runtime source, active asset, artwork source, fixture, migration, function, skill, or license is in the deletion set. The inventory count includes the four exports (it is not 226 plus four).

Reference inspection found 31 retained textual references: eight historical document/review contexts plus retained JSON/review evidence links and two QA runners that write regenerated output paths. No runtime import or test-fixture read dependency was found. Archive notices must also cover retained QA evidence JSON/reviews; describing just the eight historical documents understates the remaining provenance references. Keeping the source runners is correct.

Verified working branch `redesign/r40.7-warm-hall-v3`; current main reference is `febed30e31de43ff747d7e714cd54c41254fa34e`. This reviewer has not changed either branch.

## Pre-apply closure

Reviewed `docs/retention/before-state.json` and `docs/retention/preflight-receipt.json`. Actual timestamp/enum/UUID columns used by the candidate SQL are present. Actual cascading state/check and Feed acknowledgement FKs, plus SET NULL note/message parent FKs, match the protective guards. The exact candidate SELECT executed read-only against the actual schema and returned `eligible: {}` (zero current candidates). The migration actor is postgres; cron timezone is GMT; both existing scheduled jobs run as postgres. This supports safe installation/scheduling with the same postgres identity.

Reviewed `qa/r407/evidence/README.md` and historical document notices: archived generated evidence is explicitly recoverable from the pre-cleanup commit, retained JSON/review paths are explained, and QA runners remain available. Inventory includes four exports within the 226 total, rather than in addition to it. Main reference remains `febed30e31de43ff747d7e714cd54c41254fa34e`.

No pre-apply blocker remains. Post-activation evidence should establish exact function owners/ACLs/source, absence of the old retention job, exactly one active unified postgres job at `15 20 * * *` under GMT, a default read-only dry run, and the explicit-false cleanup outcome.

Remaining limits: this reviewer inspected saved live read-only evidence but did not itself query production. No production call, production migration, production deletion, browser pass, or visual finish pass was performed or claimed by this reviewer.

## Post-activation receipt and expanded inventory

Reviewed `docs/retention/receipt.json` for migration `20261103194544`. Independently extracted all three function bodies from the final migration and recomputed MD5s: all three exactly match the live receipt. Functions are owned by postgres, SECURITY DEFINER, empty search path, with EXECUTE denied to anon/authenticated/service_role. The old retention job is absent; exactly one active unified job (id 5) executes `cleanup_portal_history(false)` at `15 20 * * *` as postgres in GMT. Existing summary job id 4 remains at `0 20 * * *`. Default dry run reports `dryRun: true`, floor 10, and no eligible rows. Explicit-false first execution reports zero deletions for all six histories. This is verified saved live evidence, not a hosted query by this reviewer.

Independently ran final `npm run test:retention`: 13 PostgreSQL retention scenarios and three fixed-clock birthday calendar scenarios passed. CI calls this script. Required legacy fixtures, active R22 patch, and profile geometry reference are still present. Main remains unchanged at the previously recorded reference.

Expanded inventory: 235 unique files, 61,062,803 bytes (58.23 MiB), adding the old all-pages QA ZIP and eight raw Hallmark JSON reports. No runtime/test reader reference to those nine was found. However, `scripts/clean-repository-artifacts.mjs` still only allows QA png/html/log (and docs pdf/zip), so it rejects the additional nine QA ZIP/JSON paths. Those nine old files currently remain on disk. This is a confirmed cleanup-completion blocker, not a SQL/data-safety blocker. Add an exact allowlist for those nine, preserve backend-release protection and size/path guards, and complete deletion accounting after fresh outputs are copied. Fresh QA reruns have also recreated some old screenshot paths; distinguish regenerated ignored output from removed tracked artifacts in the final Git diff.

Fresh screenshot spot-check: inspected regenerated Chromium and Linux WebKit profile pages at 1440px; both show the complete profile with consistent controls, readable copy, and no visible regression. The regenerated `independent-browser/dashboard-390.png` instead shows only the shell and loading message; it is unsuitable as finished dashboard evidence. Recapture after route content is ready or select a ready fresh dashboard capture. This is an evidence-quality finding, not a confirmed app defect. No broad visual finish PASS is claimed from this small sample.

## Final closure

The cleanup mismatch is resolved without weakening the one-off script. That script was removed from the repository. Independently compared the final staged deletion list with the inventory: exactly 235 staged deletions, no additional path, no missing inventory path, 61,062,803 original bytes. Independently checked all 235 recorded sizes against their HEAD Git blobs: every size matches. The nine extra QA ZIP/raw JSON artifacts are staged for deletion, and protected source/fixtures/assets/licenses/migrations are excluded. Regenerated QA output does not change this exact index accounting.

Reviewed final `qa/r407/evidence/retention-cleanup/` artifacts. The new 390px dashboard image now shows loaded greeting, search, birthday, shift, Feed, and learning content with readable controls and no visible horizontal clipping. The 390px login-error capture shows the complete form and readable retry error. The 390px Linux WebKit profile capture shows complete card/links and consistent geometry. The earlier loading-only evidence finding is closed. This is a scoped fresh sample review, not a claim about every device/browser or live employee authentication. Preserve the approved Warm Hall artwork, profile proportions, control readability, and operational content while making any future changes.

Final saved verification evidence reports: 123 unit tests passed; 21 e2e scenarios passed; 18 UI checks passed without errors/uncaught exceptions; 13 retention SQL scenarios plus three birthday calendar scenarios passed; production/PWA build completed. Hallmark render report has zero FAIL, zero open REFLEX, zero WARN, and one existing recorded optical-margin waiver. This reviewer independently executed the 16 SQL/calendar checks earlier and inspected final logs and fresh images; it did not rerun the full browser suite itself.

Final main reference remains `febed30e31de43ff747d7e714cd54c41254fa34e`, with working branch `redesign/r40.7-warm-hall-v3`. No review blocker remains for this scoped task. Push/remote CI outcomes are outside this review's observed evidence.
