# QA report

## Package target
- Branch: `r40.4-react`
- Base HEAD: `cf491189a6c6a108708966dbf82eb588fde66959`
- `main` is not targeted.

## Integration anchors
Read-only GitHub verification against the target HEAD:
- App lazy Handover import anchor: 1/1.
- App `/handover` route anchor: 1/1.
- AppShell navigation anchor: 1/1.
- Dashboard Handover imports anchor: 1/1.
- Dashboard Handover action anchor: 1/1.
- Dashboard hook anchor: 1/1.
- Dashboard state anchor: 1/1.
- Dashboard Handover section anchor: 1/1.

## Static source checks
- TypeScript/TSX parser diagnostics: 0.
- Isolated TypeScript check reports unresolved external/project imports because the archive is a delta and is not a complete npm checkout. Those are expected in isolated mode.
- Python installer: `py_compile` PASS.
- SQL dollar-tag pairs: PASS.
- Required Shift RPC / Feed / Journal markers: PASS.

## Checklist counts
- Waiter Opening: 8.
- Waiter Closing: 5.
- Manager Opening BF: 6.
- Manager Opening BB: 8.
- Manager Closing BF: 9.
- Manager Closing BB: 9.

## Server-window invariants
- One authority timezone: `Asia/Novosibirsk`.
- Operational window: 11:00 → 03:00.
- Sunday cleaning is keyed to operational ISO weekday 7.
- Sunday 11:00 → Monday 02:59:59 stays Sunday.
- At 03:00 the operational window closes.
- General Cleaning is independent from ordinary close confirmation and remains editable until the window closes.

## Data consistency invariants
- BF/BB parent state is derived from child rows.
- BF/BB group toggle uses one transactional RPC.
- Final journal summary counts only current active checklist definitions.
- Old inactive demo rows do not enter the new final summary.
- Feed audience affects notifications, not visibility: the common Feed remains visible to staff.
