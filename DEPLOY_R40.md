# BeerFactory r40 · Deploy order

Do not partially deploy recipe write support.

## 1. NocoDB
Add the same 5 fields to BOTH Bar and Kitchen recipe tables:

1. `Статус` — Single Select:
   - `Актуальный`
   - `Черновик`
   - `Архив`
2. `Версия`
3. `Обновлено` — DateTime
4. `Кем обновлено`
5. `Что изменено` — Long text

Existing rows may keep an empty `Статус` during migration.
Empty = current.
Only old positions need `Архив`.
Drafts use `Черновик`.

## 2. Cloudflare Worker secrets / vars
Keep the existing read/viewer token.

Preferred:
- `NOCODB_READ_TOKEN` = current viewer token
- `NOCODB_WRITE_TOKEN` = separate token with only required recipe-table write rights

The r40 Worker also accepts legacy `TOKEN` as a read-token fallback.

Required Worker environment:
- `NOCODB_BASE_URL`
- `BAR_TABLE_ID`
- `KITCHEN_TABLE_ID`
- `NOCODB_READ_TOKEN` OR legacy `TOKEN`
- `NOCODB_WRITE_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Never put the write token in frontend files.

## 3. Worker
Deploy:
`worker-admin-governance.js`

Then verify:
- GET /menu works.
- response has capabilities.governance = true.
- capabilities.recipe_admin_write = true after write token is configured.
- capabilities.source_aware_ids = true.
- BAR rows contain `source: "bar"` and `id: "bar:<recordId>"`.
- KITCHEN rows contain `source: "kitchen"` and `id: "kitchen:<recordId>"`.
- Current/blank and Archive are returned.
- Draft is not returned.

## 4. Live write test
From an admin account only, after the source-aware Worker is deployed:
- choose one non-critical test recipe;
- change Version or Change note through the portal; the frontend writes to `/admin/recipes/<source>/<recordId>`;
- confirm NocoDB changed;
- confirm `Обновлено` and `Кем обновлено` were written server-side;
- confirm an audit_log `recipe_governance_update` record exists.

Do not test deletion/archiving on a live critical recipe.

## 5. Frontend r40
Replace/add the files from the r40 ZIP.
The frontend is safe even if governance capability is absent: recipe edit controls remain hidden.

## 6. Regression
Check on iPhone and Android:
- login/recovery;
- Recipes + calculator + Archive + search;
- Knowledge online/offline;
- Attestation persistence;
- Shift Handover;
- opening/closing checklist;
- Admin: employees / attestations / audit;
- profile/logout;
- offline indicator and return online.

After this passes, r40 becomes GitHub main / production baseline.

Recipe governance Save is additionally disabled whenever Recipes are being shown from cache/offline state.
