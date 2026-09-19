# Worker contract · governance v2

Frontend получает старый набор полей плюс:

```json
{
  "status": "Актуальный",
  "version": "3",
  "updated_at": "2026-09-18T12:00:00",
  "updated_by": "Иван",
  "change_note": "Изменена подача"
}
```

Frontend r25:
- фильтрует staff-visible status повторно;
- старые строки без статуса временно остаются видимыми;
- detail показывает Версия / Обновлено / Изменил;
- `Что изменено` остаётся отдельным блоком.


## Archive semantics · r33

Worker возвращает персоналу:
- пустой статус / Актуальный;
- Архив.

Worker не возвращает:
- Черновик.

Frontend отвечает за представление:
- архив скрыт из обычного browse;
- доступен через `Архив`;
- находится глобальным поиском;
- detail всегда явно маркируется `АРХИВ`.


## Source-aware recipe identity · r40 final

NocoDB record IDs are table-local. The Worker therefore exposes and accepts recipe identity as:

```json
{
  "source": "bar",
  "recordId": 17,
  "id": "bar:17"
}
```

For Kitchen the same NocoDB ID is a different recipe:

```json
{
  "source": "kitchen",
  "recordId": 17,
  "id": "kitchen:17"
}
```

Admin writes MUST use the source-aware route:

```text
PATCH /admin/recipes/bar/:recordId
PATCH /admin/recipes/kitchen/:recordId
```

The legacy ambiguous route `PATCH /admin/recipes/:recordId` is rejected.
Frontend enables recipe writes only when `capabilities.source_aware_ids = true`.
