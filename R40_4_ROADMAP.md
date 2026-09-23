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

## Current · Profile / Admin full migration

Working position remains strictly separate from authorization role.

Profile:
- position self-selection;
- birthday self-management for future Day Hub reminders;
- push notification device settings;
- admin entry point for access role `admin`.

Admin:
- React `/admin` route;
- team management;
- access roles `staff / senior / manager / admin`;
- independent working-position management;
- activation/deactivation;
- credential reset;
- protected deletion;
- attestation visibility;
- audit visibility;
- owner protection.

Backend:
- `staff-admin-users` v5;
- `staff-profile` v6;
- delete preparation understands Shift v2 references;
- direct grants on profiles / quiz attempts / audit log hardened;
- direct profile reads restricted to safe staff-directory columns only.

## Dashboard direction · Day Hub

The Dashboard is the operational hub for the current day.

Current:
- only unresolved Handover (`new` / `acknowledged`) appears on Dashboard.

Planned next:
- birthdays today;
- birthdays tomorrow;
- birthdays in two days;
- important announcements;
- time-sensitive operational notices.

Resolved / expired information should disappear from the main screen automatically; detailed history stays in the owning module.

## Next

9. Dashboard final refinement / Day Hub
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
- create + resolved push smoke on real devices;
- stale iOS badge regression smoke;
- Profile birthday persistence smoke;
- Admin read-only smoke;
- explicit controlled admin mutation smoke only when approved;
- Dashboard Day Hub smoke;
- explicit release review.
