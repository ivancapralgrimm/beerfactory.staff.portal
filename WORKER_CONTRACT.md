# Worker contract · recipe management v5

## Public recipe fields

Worker preserves the existing menu payload and normalizes:

```json
{
  "status": "Актуальный",
  "venue": "BF",
  "category": "Кухня BF",
  "version": "3",
  "updatedAt": "2026-09-18T12:00:00",
  "updatedBy": "Иван",
  "changeNote": "Изменена подача"
}
```

BAR keeps its product category from NocoDB. KITCHEN visible category is `Кухня BF` / `Кухня BB` from `Заведение`.

## Status semantics

Only two product states exist:
- `Актуальный`;
- `Архив`.

Blank = `Актуальный`. Legacy `Черновик` is read conservatively as `Архив` until old data is cleaned.

## Venue

NocoDB field: `Заведение`.
Allowed: `BF`, `BB`.
Blank legacy value = `BF`.
New recipes default to `BF`.

## Source-aware identity

All writes remain table-aware:

```text
GET    /admin/recipes
POST   /admin/recipes/bar
POST   /admin/recipes/kitchen
PATCH  /admin/recipes/bar/:recordId
PATCH  /admin/recipes/kitchen/:recordId
DELETE /admin/recipes/bar/:recordId
DELETE /admin/recipes/kitchen/:recordId
```

Ambiguous single-ID routes are forbidden.

## Authorization

Create, edit, status changes, photo upload and delete are authorized by the Worker. The Worker verifies the Supabase access token and authoritative profile (`admin` / protected owner). Hiding frontend controls is not authorization.

## Delete

Delete is destructive and source-aware. The Worker first reads the record for audit context, deletes the NocoDB record through the v2 table records endpoint, then writes `recipe_delete` to audit as a best-effort secondary action.

The portal requires an explicit destructive confirmation before calling DELETE. Archive is the preferred reversible action.

## Photo

NocoDB-backed attachment flow:
- JPEG / PNG;
- max 1 MiB;
- upload through `/api/v2/storage/upload`;
- attachment metadata -> BAR.`Фото` or KITCHEN.`Фотка`;
- direct URL -> `Фото-ссылка`.
