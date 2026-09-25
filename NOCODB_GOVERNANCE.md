# NocoDB · Recipe Governance

Both BAR and KITCHEN should expose the same governance fields where applicable.

| Field | Type | Values / purpose |
|---|---|---|
| Статус | Single Select | Актуальный / Архив |
| Заведение | Single Select | BF / BB / BF/BB; default BF |
| Версия | Number or Single line text | 1, 2, 3… |
| Обновлено | DateTime | server timestamp of last managed change |
| Кем обновлено | Single line text | authenticated admin display name |
| Что изменено / Что обновлено | Long text | short change note |

Rules:
1. Product status has only `Актуальный` and `Архив`.
2. Blank legacy status is treated as `Актуальный`.
3. Legacy `Черновик` is treated as `Архив` until manually reviewed.
4. `Заведение` accepts `BF` / `BB` / `BF/BB`; legacy `BB/BF` is read as the same common position, blank legacy value is treated as BF.
5. New recipes default to BF.
6. Archive is the reversible way to remove a position from the current menu.
7. Delete is destructive and removes the full NocoDB row; it is admin-only and confirmation-gated.
8. Content edit and status change increment recipe version; server stamps update time/actor.

Portal behavior:
- current positions appear in normal categories;
- archive appears in pseudocategory `Архив`;
- KITCHEN visible categories are `Кухня BF` / `Кухня BB`;
- BAR keeps its product categories and stores venue separately;
- recipe cards use source-aware IDs `bar:<Id>` / `kitchen:<Id>`.

Never resolve an admin mutation by numeric ID without the source/table.
