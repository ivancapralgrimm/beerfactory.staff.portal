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
7. Shift + Profile working position

## Current · Handover

Handover is a shared operational feed for the whole team.

Core rules:
- all retained notes are visible to all authenticated employees;
- the same feed appears on Dashboard and `/handover`;
- categories: Bar, Kitchen, Hall, Equipment, Purchasing, Other;
- priorities: Normal, High, Critical;
- lifecycle: New → Acknowledged → Resolved;
- create / acknowledge / resolve are server-authoritative;
- Realtime changes refresh open clients;
- optional Web Push notifies subscribed devices even when BFStaff is closed;
- push excludes the author and opens `/handover`;
- history retention is 60 days;
- cleanup runs monthly;
- creating a Handover note never opens a Shift.

The pre-r40.4 Handover history was intentionally cleared before testing this implementation.

## Shift model retained

Working position remains separate from access role.

Positions:
- bartender / Бармен
- waiter / Официант
- manager / Менеджер
- hostess / Хостес

Operational window:
- 11:00–23:59 → current calendar date
- 00:00–02:59 → previous operational date
- 03:00–10:59 → locked
- venue timezone: `Asia/Novosibirsk`

## Next

8. Profile/Admin full migration
9. Dashboard final refinement
10. Cross-module visual cleanup
11. PWA/hardening QA
12. Release gate

## Release rule

No merge to `main` until:
- GitHub Actions green;
- Vercel Preview green;
- mobile smoke;
- Shift controlled mutation smoke;
- Handover create / acknowledge / resolve smoke;
- Dashboard shared-feed visibility smoke;
- explicit release review.
