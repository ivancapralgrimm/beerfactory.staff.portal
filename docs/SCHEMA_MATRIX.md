# BeerFactory Recipe Editor v5.5 — live NocoDB schema matrix

Verified from the live `/menu` response on 2026-09-26.

## BAR

| NocoDB column | Worker behavior |
|---|---|
| Id | read-only record id; source-aware API id is `bar:<Id>` |
| CreatedAt | NocoDB system field, read-only |
| UpdatedAt | NocoDB system field, read-only |
| Tittle | legacy read-only fallback for `Название`; never written |
| Фото-ссылка | read; written automatically on photo upload/remove |
| Название | read/write: `name` |
| Состав | read/write: `ingredients` |
| Метод | read/write: `method` |
| Теги | read/write: `tags` |
| Фото | attachment field; upload/remove only |
| Категория | read/write: `category` |
| Статус | read/write: `status`; only `Актуальный` or `Архив` |
| Версия | auto-incremented on update, starts at 1 on create |
| Обновлено | auto-written ISO timestamp |
| Кем обновлено | auto-written current admin display name |
| Что изменено | read/write change note |
| Заведение | read/write: `BF`, `BB`, `BF/BB` |
| Граммовка | read/write: `serving` (cocktail output) |

Legacy BAR aliases `Подача` and `Вес` remain read fallbacks only. New writes always use `Граммовка`.

## KITCHEN

| NocoDB column | Worker behavior |
|---|---|
| Id | read-only record id; source-aware API id is `kitchen:<Id>` |
| CreatedAt | NocoDB system field, read-only |
| UpdatedAt | NocoDB system field, read-only |
| Название | read/write: `name` |
| Описание | read/write: `description` / normalized `method` |
| Граммовка | read/write: `serving` |
| Фотка | attachment field; upload/remove only |
| Фото-ссылка | read; written automatically on photo upload/remove |
| Состав | read/write: `ingredients` |
| Теги | read/write: `tags` |
| Статус | read/write: `status`; only `Актуальный` or `Архив` |
| Версия | auto-incremented on update, starts at 1 on create |
| Обновлено | auto-written ISO timestamp |
| Кем обновлено | auto-written current admin display name |
| Что обновлено | read/write change note |
| Заведение | read/write: `BF`, `BB`, `BF/BB` |

## Future-schema behavior

- PATCH writes only the allowlisted recipe fields above, so any unknown future NocoDB column is preserved and is not nulled or overwritten.
- `GET /admin/recipes/schema` is admin-only and compares the Worker snapshot with fields observed in live NocoDB. It reports `missing_expected` and `unexpected` for BAR and KITCHEN.
- `/menu` continues returning original NocoDB fields and now also returns stable normalized fields: `name`, `ingredients`, `method`, `serving`, `photo`, `tags`, `venue`, `category`, `status`, version/update metadata.
