# BFStaff r40.4 — MEGA FEED + SHIFT v1

**Target branch:** `r40.4-react`  
**Expected base HEAD:** `cf491189a6c6a108708966dbf82eb588fde66959`  
**Do not apply to `main`.**

## Included

### Feed / «Лента»
- `/feed` replaces the user-facing «Передача».
- Old `/handover` redirects to `/feed`.
- Create post with `+`.
- Fields: **Тема** + **Сообщение**.
- Priorities available to staff: **Обычная** / **Критичная**.
- Notification audience: everyone or selected working positions.
- «Ознакомился» is a per-user mark and does not close the post.
- «Решено» is a separate lifecycle state.
- Dashboard shows up to **6 active posts** in a compact vertical scroll block sized for about **2 visible cards**.
- Critical unresolved posts sort above ordinary unresolved posts.
- Push notifications open `/#/feed`.

### Shift
- One authoritative server operational window: **11:00 → 03:00**, timezone `Asia/Novosibirsk`.
- Closing can be intentionally unlocked before Opening is fully completed.
- Early Closing unlock does **not** lock Opening.
- Closing can be prepared in parallel.
- Final Close confirmation still requires confirmed Opening.
- Ordinary checkbox writes do not create audit-log noise.
- Server writes one compact shift summary at the end of the operational window.

### Manager
Opening and Closing are split into **BF / BB** groups.

BF/BB are group controls with states:
- empty;
- partial / mixed;
- completed.

Clicking a group checkbox updates all child items in **one RPC transaction**.
The child items remain the source of truth. BF/BB themselves are not fake checklist rows.

The package replaces Manager demo definitions with the real checklist supplied in the current project discussion.

### Waiter
The package replaces Waiter demo definitions with the real Opening and Closing checklist supplied in the current project discussion.

### Sunday General Cleaning / «Генуборка»
- Infrastructure and UI are included now.
- Appears **above Opening and Closing** only when the server operational date is Sunday.
- Sunday `11:00` → Monday `02:59:59` is one Sunday operational window.
- At Monday `03:00` the window closes.
- General Cleaning remains editable during the whole shared operational window, even if ordinary Closing was confirmed earlier.
- **Actual General Cleaning task rows are intentionally not seeded yet**, because they have not been supplied yet. On Sunday the UI shows a compact prepared placeholder until the seed is added.

### Admin Journal
At the end of the window the server creates one compact summary per position:
- General Cleaning progress (Sunday only);
- Opening progress;
- Closing progress;
- only incomplete items are expanded in the UI;
- Manager incomplete items are prefixed with `BF:` / `BB:`;
- early Closing unlock fact/time remains in metadata.

The finalizer counts **current active definitions**, so old demo checklist rows do not pollute the new summary.

## Not replaced in this package
- Bartender checklist stays as currently configured.
- Hostess checklist stays as currently configured.

Their real lists can be added later as small seed patches.

## Install into a local checkout

From the root of the repository checkout on the exact target HEAD:

```bash
python /path/to/BFStaff_r40.4_MEGA_FEED_SHIFT_v1/tools/apply_megapack.py
npm run typecheck
npm run build
git diff
```

The installer is intentionally strict. If expected source anchors or the HEAD do not match, it stops instead of silently mangling the project.

## Supabase

Cumulative migration:
`supabase/migrations/20260928230000_bfstaff_feed_shift_megapack.sql`

It tolerates the Feed / early-closing / Sunday foundation already being present.

Edge Function source:
`supabase/functions/handover-push/`

Deploy it as the existing `handover-push` function with JWT verification enabled.

## Recommended install order
1. Apply source package to `r40.4-react`.
2. Run typecheck and production build.
3. Review Git diff.
4. Apply Supabase migration.
5. Deploy `handover-push`.
6. Deploy/preview `r40.4-react`.
7. Smoke-test Feed, Manager/Waiter Shift, early Closing unlock, and Journal.
