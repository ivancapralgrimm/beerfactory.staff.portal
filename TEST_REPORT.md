# r40.5 UX-pass test report — 2026-09-30

Scope: final UI/UX pass on the technically accepted implementation. Previous technical
report is preserved in docs/r40.5-technical-accepted/TEST_REPORT.md.

Node v24.19.0 / npm 11.9.0 / TypeScript 5.9 / Vite 8.3.0 / Playwright 1.58.2 /
Chromium 151.0.7922.173. Existing dependencies/lockfile unchanged; no new UI libraries.

| Actually executed | Result | Evidence |
| --- | --- | --- |
| npm run typecheck | PASS | reports/typecheck.log |
| npm test | PASS, 28, no skipped tests | reports/unit-tests.log |
| npm run build | PASS, default production | reports/build.log |
| npm run build:preview | PASS | reports/build-preview.log |
| Built preview browser suite below | PASS, 35 scenarios | reports/browser-run.log, reports/browser-results.json |
| Exact UX protected files + unchanged editor logic tokens | PASS | tests/ux-invariants.test.cjs, UX_BASELINE_PROTECTED.json |

Actual browser build/launch command:

```sh
VITE_SUPABASE_URL=http://127.0.0.1:54329 VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture_only VITE_RECIPE_API_BASE=http://127.0.0.1:54329/recipes npm run build:preview -- --outDir /tmp/bfstaff-ux-preview-dist
BF_TEST_PREVIEW_DIST=/tmp/bfstaff-ux-preview-dist BF_TEST_AGENT_BROWSER=/tmp/article-editor-browser/node_modules/.bin/agent-browser npm run test:browser
```

The browser suite uses a real production-built preview at 4175 and legacy dev source
at 4176 with isolated synthetic sessions. All backend HTTP/WebSocket goes to fixtures;
no live service requests. Launcher owns/stops servers; agent-browser checks login,
content, overlays and errors before tests. Final pageErrors, consoleErrors and
unexpectedNetwork arrays are empty. Tests do not prove real RLS or deployed Edge.

Updated scenarios exercise actual + / Aa / ••• / Дополнительно / Параметры controls:

- Text-only create/save/reopen, draft unchanged and no internal labels/always-visible
  advanced fields; normal backup through overflow.
- Text → photo → text, caption and alt through advanced, replacement and ordering;
  legacy image semantics; new photos remain private Storage media references.
- Selected Bold/Italic/Highlight with existing UTF-16 behavior; no inline preview.
- Heading/default internal 2 and nested 3, note, unordered/ordered lists, deferred
  item formatting retained after save/reopen, add/delete items, separator, confirmed
  deletion and move above/below. All schema operations remain accessible.
- Independent editor conflict preserves draft/backup; explicit server reload only;
  network/mutation denial/permission revoke, including automatic loss-of-access backup.
- Owner/Admin defaults and default Staff/Senior denial unchanged; unchanged reader
  routes, all 26 lesson IDs/progress, Dashboard/global search and access hotfix.
- Keyboard menu opening, first focus, arrow/Home/End/Escape/Tab/toggle/light-dismiss;
  API-disabled fallback menu test; no hidden-focus trap.
- 390×844 mobile no overflow, inputs >=16px, visible editor touch controls >=44px;
  desktop 1366px; real screenshots of a clean text/photo/text draft in reports/.

Screenshots are captured from this build at widths 390 and 1366. Capture viewport
height expands to article height so the unchanged fixed navigation lies at the bottom
of the full-article screenshot. Mobile behavior checks use the normal 844px height.
The source photograph is an unchanged bundled asset via transport fixtures.

28 tests include existing source/schema/media/adapter/Edge-handler checks plus two
new integrity tests. Every original Supabase/migration/reader/auth/legacy protected
file matches the accepted archive; no migration was added. Semantic token comparison
confirms the existing editor controller prefix is unchanged despite formatting.

Development failures and fixes are in ERROR_LOG.md; final evidence is the passing run.
Clean npm ci is historical technical-pass evidence; it was not rerun just for a UI
change. Build success alone is not the UX acceptance criterion.

Not run/claimed: real user sessions/RLS/Storage/concurrency, Deno runtime, physical
installed iOS/Android PWA or live/production writes. Existing NEEDS_LIVE_QA.md remains.
No push/merge/deploy/GitHub or live Supabase changes.

Final package verifies ZIP CRC, complete payload SHA-256, protected bytes, no generated
bulk/secrets/.env and applicability of the text diffs against untouched local baselines.
