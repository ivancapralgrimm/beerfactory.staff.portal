# BFStaff r40.4 · Admin Recipe Editor v1

Base branch: `r40.4-react`
Base HEAD: `20e2f1a103ed05a0055cdc744fae9756ee0c1182`

## What this package adds

Admin → new tab **Рецепты**.

The editor supports:
- create BAR or KITCHEN recipe;
- edit an existing source-aware recipe;
- status: `Актуальный` (default), `Архив`, `Черновик`;
- BAR categories use the real NocoDB values while showing `Лимонад` as `Б/А напитки` in the UI;
- BAR requires `Название`, `Категория`, `Состав`;
- KITCHEN requires `Название`, logical category `Кухня`, `Описание`;
- optional photo, JPEG/PNG only, max 1 MiB;
- optional tags and output/grammage;
- BAR method / preparation;
- KITCHEN grammage;
- edit-only change note;
- source is locked while editing so `bar:<id>` cannot silently become `kitchen:<id>`.

## Actual current NocoDB field mapping

BAR fields observed through the live Worker:
- `Название`
- `Состав`
- `Метод`
- `Теги`
- `Фото` (Attachment)
- `Фото-ссылка`
- `Категория`
- `Статус`
- `Версия`
- `Обновлено`
- `Кем обновлено`
- `Что изменено`

KITCHEN fields observed through the live Worker:
- `Название`
- `Описание`
- `Граммовка`
- `Фотка` (Attachment)
- `Фото-ссылка`
- `Состав`
- `Теги`
- `Статус`
- `Версия`
- `Обновлено`
- `Кем обновлено`
- `Что обновлено`

KITCHEN currently has no raw `Категория` column. Therefore v1 displays the required logical category `Кухня`, but the Worker does not invent/write a nonexistent NocoDB column.

## Photo flow

Frontend sends the selected photo to the Cloudflare Worker as multipart form-data.

Worker validates:
- MIME: `image/jpeg` or `image/png`;
- maximum size: 1 MiB.

Worker then uploads the file server-side to NocoDB `/api/v2/storage/upload`, stores the returned attachment metadata in:
- BAR → `Фото`;
- KITCHEN → `Фотка`;

and writes its URL to `Фото-ссылка`.

NocoDB write credentials stay server-side.

## Frontend files

REPLACE:
- `src/features/admin/AdminPage.tsx`

ADD:
- `src/features/admin/AdminRecipesPanel.tsx`
- `src/features/admin/recipe-admin-api.ts`

The frontend deliberately falls back to the existing public `/menu` for read-only rendering if the new admin Worker routes are not deployed yet. Writes will show a clear Worker-not-updated error instead of pretending success.

## Worker candidate

`cloudflare/worker-recipe-editor-v3.js`

This is a full replacement candidate because the currently deployed Worker source is not stored in this Git repository.

It preserves:
- `/`
- `/menu`
- `/recipes`
- staff-visible filtering (`Черновик` hidden)
- source-aware IDs
- admin auth through Supabase
- old governance-only PATCH behavior
- ambiguous single-ID route rejection

It adds:
- `GET /admin/recipes`
- `POST /admin/recipes/bar`
- `POST /admin/recipes/kitchen`
- full multipart `PATCH /admin/recipes/bar/:recordId`
- full multipart `PATCH /admin/recipes/kitchen/:recordId`
- NocoDB photo upload
- recipe create/update audit events

## Existing Worker configuration used

Expected variables/secrets:
- `NOCODB_BASE_URL`
- `NOCODB_READ_TOKEN` (or legacy `NOCODB_TOKEN` / `TOKEN`)
- `NOCODB_WRITE_TOKEN`
- `NOCODB_BAR_TABLE_ID` (fallback `mqo5ga1nk6h8lv8`)
- `NOCODB_KITCHEN_TABLE_ID` (fallback `mc7m3sa4m2x12dd`)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Safety

Do not replace the live `beerfactory-menu-api` merely to inspect the UI. It is shared with stable production.

Recommended integration order:
1. upload frontend files to `r40.4-react` only;
2. Typecheck + Build + exact-head Vercel Preview;
3. inspect Admin → Recipes visually without submitting a mutation;
4. compare the Worker candidate against the current live Worker source in Cloudflare;
5. deploy as a separate r40.4 preview Worker first;
6. point only the r40.4 Vercel preview `VITE_RECIPE_API_BASE` at that Worker;
7. do a controlled write test only with explicit approval;
8. do not switch stable production until release gate.
