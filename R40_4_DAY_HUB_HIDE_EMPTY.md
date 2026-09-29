# BeerFactory Staff Portal · Day Hub hide-empty behavior

Dashboard is signal-first.

- Birthday section renders only when a birthday exists in today / tomorrow / day-after-tomorrow window.
- Active Handover section renders only when at least one unresolved item exists.
- Empty informational cards are intentionally omitted to preserve vertical space.
- Loading state can render a skeleton.
- Real synchronization errors remain visible rather than being mistaken for an empty state.
