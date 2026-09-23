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
- all retained notes are visible to all authenticated employees in `/handover`;
- Dashboard shows only active Handover items: `new` and `acknowledged`;
- resolved notes remain available in Handover history but disappear from Dashboard;
- categories: Bar, Kitchen, Hall, Equipment, Purchasing, Other;
- priorities: Normal, High, Critical;
- lifecycle: New → Acknowledged → Resolved;
- create / acknowledge / resolve are server-authoritative;
- Realtime changes refresh open clients;
- optional Web Push notifies subscribed devices even when BFStaff is closed;
- creating a note sends push to subscribed active staff except the author;
- resolving a note sends push with the resolver name, category and note excerpt;
- push opens `/handover`;
- synthetic app badge counts are not used until BFStaff has a real unread-state model;
- history retention is 60 days;
- cleanup runs monthly;
- creating a Handover note never opens a Shift.

The pre-r40.4 Handover history was intentionally cleared before testing this implementation.

## Dashboard direction · Day Hub

The Dashboard is not a second history/feed screen.
It is the operational hub for the current day.

Dashboard content should answer:
**What matters to this employee right now?**

Planned information blocks:
- unresolved Handover / operational problems;
- birthdays today;
- birthdays tomorrow;
- birthdays in two days;
- important team announcements;
- time-sensitive operational notices;
- later: other high-signal daily information approved for the portal.

Rules:
- resolved / expired information should disappear from the main screen automatically;
- detailed history stays in the owning module;
- Dashboard cards link to the source module;
- avoid duplicating entire long feeds on the home screen;
- prioritize urgent/current information over static navigation;
- birthday notifications are informational and must not expose unnecessary personal data.

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
- Dashboard active-only Handover visibility smoke;
- explicit release review.
