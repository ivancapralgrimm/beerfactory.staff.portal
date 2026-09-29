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
8. Handover + Web Push
9. Profile / Admin full migration

## Current · Dashboard / Day Hub

Implemented:
- unresolved Handover only (`new` / `acknowledged`);
- birthdays today;
- birthdays tomorrow;
- birthdays in two days;
- current age shown only on the actual birthday;
- birthday data exposed through a narrow auth-bound RPC without exposing raw `birth_date` or birth year.

Planned later:
- important announcements;
- time-sensitive operational notices;
- manager notices and other approved daily signals.

Resolved / expired information should disappear from the main screen automatically.
Detailed history stays in the owning module.

## Next

10. Cross-module visual cleanup
11. PWA / hardening QA
12. Release gate

## Release rule

No merge to `main` until:
- GitHub Actions green;
- Vercel Preview green;
- mobile smoke;
- Shift controlled mutation smoke;
- Handover create / acknowledge / resolve smoke;
- create + resolved push smoke on real devices;
- stale iOS badge regression smoke;
- Profile birthday persistence smoke;
- Admin read-only smoke;
- explicit controlled admin mutation smoke only when approved;
- Dashboard birthday + age smoke;
- explicit release review.
