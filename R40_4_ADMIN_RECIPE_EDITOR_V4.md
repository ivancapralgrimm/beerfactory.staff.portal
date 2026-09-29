# BFStaff r40.4 · Recipe Management V4

Cumulative package based on the V3 design decisions plus the final placement/management pass.

## Included

- compact recipe browse cards (~68 px minimum height);
- BAR/KITCHEN source-aware recipe creation;
- BF/BB venue and `Кухня BF` / `Кухня BB` categories;
- only `Актуальный` / `Архив` product states;
- reusable inline RecipeEditor component;
- admin-only `+` create button on Recipes page, independent of active filter;
- admin-only pencil button beside Share on Recipe detail;
- inline edit on the same Recipe detail page;
- `Данные рецепта` current/archive explanation;
- archive / restore action;
- destructive delete action with confirmation;
- full NocoDB row delete through source-aware Worker route;
- recipe editor removed from Admin panel;
- JPEG/PNG <= 1 MiB NocoDB photo flow;
- Worker v5 deployment candidate with create/edit/status/delete/audit.

## Not done by this package

- no `main` changes;
- no Worker production deploy;
- no live NocoDB schema mutation;
- no real recipe create/edit/delete QA mutation;
- no Supabase grants hardening yet.

## Safety

Frontend visibility is convenience only. Worker verifies authoritative admin/owner access for every write. Destructive delete reads the record first for audit context and uses source-aware table selection.
