# BeerFactory Staff Portal · r40.4 React Roadmap

## Baseline

- Production `main` / r40.3 remains stable until full r40.4 smoke.
- All migration work stays in `r40.4-react`.
- Server-authoritative workflows never report local-only success.
- `DESIGN_SYSTEM.md` is the active visual/interaction contract.

## Completed

1. React foundation
2. Auth/session
3. Recipes
4. Knowledge
5. Attestation
6. Design-system gate

## Current · Shift + profile position

### Position
Working position is separate from access role.

Allowed:
- bartender / Бармен
- waiter / Официант
- manager / Менеджер
- hostess / Хостес

Position is changed through Profile.
It does not grant admin/manager permissions.

### Shift model
Existing r40.3 Shift remains untouched for production compatibility.

React r40.4 uses:
- global operational day in `shifts`;
- per-position state in `position_shift_states`;
- per-position checks in `position_shift_checks`;
- per-position definitions in `position_shift_check_definitions`.

This keeps Handover compatible with the shared operational day while allowing each position to have
independent opening/closing state.

### Operational window
Venue timezone: `Asia/Novosibirsk`.

- 11:00–23:59 → current calendar date
- 00:00–02:59 → previous operational date
- 03:00–10:59 → locked
- 11:00 → fresh operational day

A stale unclosed positional shift expires when a later mutating workflow operation normalizes old state.

### Checklist interaction
- each checkbox saves independently;
- only the tapped row shows pending feedback;
- other rows do not dim or lock;
- several different items may be saved in parallel;
- an ordinary checkbox write patches only that row after server acknowledgement;
- full Shift workflow refresh is reserved for manual refresh, return to foreground, or phase transition;
- open/close confirmation waits for pending item writes.

### Current checklist content
All four positions now have 6 opening + 6 closing items.

- Bartender: based on the existing Bar checklist.
- Waiter: demo hall/service checklist.
- Manager: demo control checklist focused on verifying Bar + Waiter readiness/closing, POS/cash, stop-list, briefing, handover and safety.
- Hostess: demo reception checklist focused on entrance/reception, reservations, seating plan, menus, guest information and handover.

Waiter/Manager items are explicitly demo content and should be replaced or edited when the real operating procedure is approved.

## Next

7. Handover
8. Profile/Admin full migration
9. Dashboard final
10. Cross-module visual cleanup
11. PWA/hardening QA
12. Release gate

## Release rule

No merge to `main` until:
- GitHub Actions green
- Vercel Preview green
- mobile smoke
- Shift read-only smoke
- explicit controlled test of one positional checklist write
- explicit controlled open/close test, if real operational timing permits
