# BeerFactory r40.4 · Profile compact + Dashboard carousel alignment

Base HEAD: `bbfd1a889584b2def0e5a53453d843f186f74ce5`

This patch is UI-only.

## Profile
- Renames `ДЕНЬ РОЖДЕНИЯ` to `ДАТА РОЖДЕНИЯ`.
- Removes the helper heading `Для внутренних напоминаний`.
- Removes the explanatory birthday copy.
- Constrains the native iOS `input[type=date]` to the card width with explicit min/max/inline sizing.
- Keeps only `Рабочая должность` under the position label.
- Removes the explanatory checklist sentence under position.
- Compacts the native position select to ~44px.

## Dashboard · «Что почитать»
- Keeps the carousel swipe behavior and right-side peek.
- Removes the negative left bleed.
- The first article card now starts on the same left content line as the section title and other Dashboard blocks.
- Loading skeleton uses the same geometry.

No backend changes.
No Supabase migration.
No Shift/Handover/Recipes mutations.
No change to carousel selection logic or Knowledge read-state logic.
