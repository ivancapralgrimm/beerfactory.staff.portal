# Shift and Feed integration

The runnable implementation is in `app/src/features/shift` and `app/src/features/feed`. It uses the current main Supabase client, authenticated profile, roles, positions and RPCs. No prototype data context, role switch, local save substitute or client calendar determines a working shift.

## Preserved contracts

- Shift reads `get_position_shift_workflow`; mutations use `set_position_shift_check`, `set_position_shift_check_group`, `unlock_position_shift_closing`, and `confirm_position_shift`. The server supplies the operational date, position, window and active definitions. UI copy and dates use the main 11:00–03:00 Asia/Novosibirsk window. Closing can be prepared before opening using the existing unlock RPC; closing the shift still requires an active shift.
- R22: opening and closing buttons are available with incomplete tasks. They call the existing RPC directly, await its result and reload the workflow. There is no extra confirmation or note field. Existing servers that reject incomplete tasks display an explicit failure; the UI never marks the shift open/closed after rejection.
- R79: templates remain live. The main workflow queries current active, weekday-matching definitions rather than a client snapshot. The compact editor retains main revision checks, active/archive/delete/reorder operations, position permissions, BF/BB groups for manager position, critical flag and all seven weekdays. Weekday controls use `type="button"` and remain one row at 320px.
- Feed reads main `notes`, `feed_acknowledgements` and authorized `profiles`. Creation uses `create_feed_post`, personal acknowledgement uses `acknowledge_feed_post`, resolution uses `resolve_handover`. The existing best-effort push invocation follows a successful RPC; it is never a substitute for saving.
- Feed's collapsed recipient picker sends main `notify_all` / `notify_positions` values. These select notification recipients, not client visibility. Existing visible notes remain visible. No note edit or reopen feature was added. No team pulse component is rendered.
- `/feed`, `/feed/new`, `/feed/:noteId` and the existing `?compose=1` entry work with the same FeedPage. `DashboardFeedSection()` retains its no-argument signature.
- The readers control has a 24px visual face inside a 44px target. Its modal shows actual authorized profile names with individual acknowledgement times. If a profile/name is missing or inaccessible, it explicitly says `Имя недоступно`; no sample person or inferred identity is substituted. The shared modal dims the background, traps keyboard focus, supports Escape and restores focus to its trigger.
- Mutations await main responses, disable repeated actions during a request and preserve draft/check state on failure. Main role checks and server `can_edit` still control checklist editor access. Server errors are visible in one live region, without nested duplicate announcements.

## Exact server prerequisite for R22

`docs/patches/r22-allow-incomplete-position-shift.sql` is an **offline review patch, not an applied migration**. SHA-256: `d37b802a46eca8044d55022474c4b6fc912ef0681bcc50c22de913288af20a18`.

Current main's `20260928230000_bfstaff_feed_shift_megapack.sql` defines `public.confirm_position_shift(text)` with `opening_incomplete` and `closing_incomplete` rejections. The patch removes only those completeness rejections. It preserves authenticated-role/position checks, server window checks, row locking, live applicable-template existence checks, state transitions, audit/finalization surroundings, and the authenticated-only execute grant. It retains `private.ensure_position_shift_state()` and the existing finalization implementation.

Before a future server application, compare the deployed function against the supplied main definition and reconcile any later server changes. Then apply the reviewed replacement through the project's normal migration process and verify with real authenticated role/position sessions. This task did not run SQL against any external database, deploy an app, or change Git state. Until that server rule is applied, incomplete opening/closing is a concrete unresolved server prerequisite.

Reader names require the existing authenticated directory access to the permitted `id, first_name, last_name, position` columns. The extension does not broaden table grants or bypass row policies. The checked-in directory-column grant includes these columns; deployed RLS/access was not queried. A returned acknowledgement with an unavailable profile remains counted with its identity marked unavailable.

## Reproducible local checks

Run from `app/`:

```sh
npm run typecheck
node --test tests/unified-shift-feed-contract.test.cjs
```

The contract suite uses explicit Supabase mocks for payloads, await/error propagation, workflow read coalescing, reader identity mapping and existing editor rights. It also executes the exact offline R22 patch in isolated in-memory PGlite: incomplete opening/closing succeeds without changing unchecked tasks, while forbidden role, missing position, locked window, invalid action, premature closing and missing live template reject. This does not test multi-session concurrency, deployed database policy or the complete production schema.

For browser checks, first start the local app with a fixture endpoint:

```sh
VITE_SUPABASE_URL=http://127.0.0.1:54329 VITE_SUPABASE_PUBLISHABLE_KEY=fixture-publishable-key VITE_KNOWLEDGE_SOURCE=supabase npm run dev -- --host 127.0.0.1 --port 4187 --strictPort
```

In another shell:

```sh
node tests/unified-shift-feed-browser.mjs
```

The browser fixture intercepts every API and realtime request; unconfigured or external requests fail the suite. It tests the actual app and routes with synthetic authenticated sessions. It covers incomplete open/close without dialogs/notes, task failures and pending writes, early closing unlock, locked/missing-position states, previous operational date at 01:00 NSK, editor permission denial, seven-day row and non-submitting day buttons at 320px, draft retention on conflict, fresh live definitions, Feed creation/audiences/failure/draft retention, reader identities/modal/target sizes, acknowledgement/resolution pending states and failures, and mobile/tablet overflow.

Results and screenshots are written to `app/reports/unified-shift-feed/`. Scope is local application behavior with mocked transport; live SQL/RLS/Edge delivery and production deployment remain unverified.
