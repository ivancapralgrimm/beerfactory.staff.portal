# BeerFactory Staff Portal · r40.4 Recipes migration

## Status

Phase 1 React foundation is now green:
- GitHub Actions build: PASS
- Vercel branch Preview: READY
- Preview route: `bfstaff-git-r404-react-ivan-grimm.vercel.app`

This package starts Phase 2: Recipes.

## Design research

Live Refero research was attempted but the current Refero subscription is inactive, so the implementation uses:
1. BeerFactory's existing r40.3 recipe information architecture as the primary product reference.
2. The project's locked dark brown / copper / cream brand tokens.
3. Refero bundled craft rules for semantic navigation, focus-visible states, mobile touch targets, URL-backed state, restrained cards, reduced motion and long-list rendering.
4. Existing r40.3 worker/data contract as the functional source of truth.

## Reference lock

Primary direction:
- industrial dark BeerFactory workbench
- high contrast cream type on brown/graphite canvas
- copper only for active/action hierarchy
- thin dividers instead of wrapping every block in cards
- dense enough for shift use, never dashboard-busy

Preserve:
- mobile-first one-thumb use
- search before navigation
- source-aware recipe identity
- archive behavior
- last-known-good offline recipe data
- deep links, back behavior, sharing, calculator

Reject:
- decorative card grid
- random tag colors with no semantic meaning
- fake fallback recipes that staff could mistake for current data
- UI-only recipe IDs that can collide between NocoDB tables
- animation for decoration

## Functional changes from r40.3

### Source-aware IDs
Canonical identity is `source:recordId`, for example:
- `bar:33`
- `kitchen:33`

BAR and KITCHEN records with the same NocoDB ID remain different recipes.

### Legacy deep links
r40.3 generated `bf-route-*` IDs through a routing hotfix. r40.4 computes the old legacy route ID too, resolves it, then replaces the URL with the canonical source-aware route.

### New deep links
React routes:
- `#/menu`
- `#/menu/bar%3A33`

The old `?recipe=...#/menu` form is also detected and migrated.

### Search and filters
Search state is stored in the hash URL:
- `#/menu?q=...`
- `#/menu?cat=...`

Back from detail therefore restores the browse context without a custom DOM rerender hack.

### Offline
- fresh recipe cache: 5 minutes
- stale cache becomes last-known-good fallback
- existing r40.3 `bf-portal-v2` menu cache is imported when available
- no fake operational demo recipes if both API and cache are unavailable

### Archive
- hidden from ordinary `Все` browse
- dedicated `Архив` filter
- included in global search from `Все`
- current recipes sort before archived search results
- archive detail is explicitly marked

### Calculator
Retains decimal scaling and preserves ingredient text/units.

## QA after upload

Mandatory:
1. GitHub Actions green.
2. Vercel Preview READY.
3. Login with real staff account.
4. Menu loads from Worker.
5. Search by recipe name.
6. Search by ingredient.
7. Category filter.
8. `Лимонад` displays as `Б/А напитки`.
9. Open BAR recipe and KITCHEN recipe with same raw NocoDB ID if available.
10. Confirm they open different recipes.
11. Browser Back restores search/filter/list position.
12. Reload direct recipe deep link.
13. Share/copy recipe URL.
14. Calculator on infusion/cordial/preparation.
15. Temporary offline test after recipes have been synchronized.
16. Archive behavior if archive records exist.

## Bundle hygiene

The Phase 1 build produced one minified JS chunk around 662 kB, which is acceptable for a prototype but not a good direction for a mobile staff app.

Phase 2 therefore introduces route-level `React.lazy` boundaries for protected product modules. Recipes, recipe detail, dashboard, profile and later modules can load as separate chunks instead of inflating the initial login bundle.
