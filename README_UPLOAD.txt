BFStaff r40.4 · UI COPY + REFRESH + CHECKLIST EDITOR · v3 AUDITED

УСТАНАВЛИВАТЬ ТОЛЬКО ЭТОТ ПАКЕТ.
v1 и v2 отдельно НЕ загружать.

Проверен для:
- branch: r40.4-react
- base HEAD: d77b4e02fb645dae6b82cdd34710775a05ddd709

ЧТО ВНУТРИ

1. UI COPY CLEANUP
Убраны пользовательские технические тексты:
Supabase / NocoDB / PWA / Web Push / серверные и операционные объяснения.
Полезные placeholders «Тема» и «Сообщение» в Ленте сохранены.

2. ОБНОВЛЕНИЕ ДАННЫХ
Добавлены компактные круглые кнопки RefreshCw:
- Рецепты
- Знания
- Аттестация

Рецепты:
reload() -> loadRecipes({ force: true }) -> fetch cache:no-store.
То есть кнопка реально делает сетевую попытку получить свежие данные.

3. РЕДАКТОР ЧЕК-ЛИСТОВ
- горизонтальный выбор должности удалён;
- вместо него native select как в Профиле;
- Генуборка / Открытие / Закрытие тоже native select;
- Copy удалён;
- вместо Copy: Trash2 «Удалить пункт»;
- перед удалением короткое confirm;
- Архив / Восстановить остаётся отдельной функцией.

4. HARD DELETE
Удаление физически удаляет строку definition.
Revision conflict protection сохранён.
Прямой DELETE браузеру не выдан.

Права:
- staff: forbidden
- senior waiter BF: только waiter
- senior waiter BB: только waiter_bb
- senior hostess: только hostess
- admin / owner: все доступные позиции

5. ИСТОРИЯ СМЕН
Исторические position_shift_checks сохраняются.
Это snapshots фактических действий прошлых/текущих смен и не являются
definition, поэтому журнал смен не ломается.

Если definition удалить во время открытой смены:
- до delete он присутствует в workflow;
- после delete исчезает из workflow сразу;
- confirm/finalizer считают только актуальные active definitions.

6. DEMO CLEANUP
Физически удалены 46 старых inactive demo definitions.
Live после очистки:
- active definitions: 116
- archived/inactive definitions: 0

7. DELETE AUDIT PRIVACY
Первая migration добавляет hard delete.
Вторая live migration исправляет аудит удаления:
- сам факт удаления остаётся;
- полный текст удалённого пункта в audit_log НЕ сохраняется;
- entity_name = null;
- before_data хранит только revision;
- metadata хранит position/check_type.

Live migrations:
- 20260929102044_add_checklist_hard_delete_and_purge_demo_definitions
- 20260929113745_minimize_checklist_delete_audit_payload

8. ПРОВЕРКИ
- ZIP checksums: PASS
- base HEAD совпадает: PASS
- v2 сохраняет весь v1 UI hotfix: PASS
- 13 TS/TSX files transpile: 0 syntax errors
- старой Copy-кнопки в checklist editor нет
- два требуемых select есть
- Trash2 + delete RPC есть
- technical copy scan: PASS
- recipe force refresh: PASS
- /shift/editor route уже существует
- AppShell editor entry уже существует
- /feed сохранён
- delete permissions rollback: PASS
- staff delete -> forbidden
- senior own -> deleted
- senior foreign -> forbidden
- test rows after rollback -> 0
- delete during open workflow -> disappears immediately
- deleted text retained in audit -> false
- Supabase Security Advisor: новых категорий проблем не добавлено;
  authenticated SECURITY DEFINER warning для editor RPC остаётся намеренным,
  потому что функция сама проверяет scope пользователя.

ПОСЛЕ ЗАГРУЗКИ
1. Проверить новый HEAD.
2. GitHub Actions: Typecheck + Build.
3. Vercel success.
4. Smoke на iPhone:
   - Рецепты -> Refresh
   - редактор чек-листов -> оба picker
   - edit
   - archive / restore
   - delete + confirm
   - reorder
5. Role smoke отдельно для Staff / Senior / Admin / Owner.

До зелёного Typecheck + Build после фактической загрузки пакет не считать release-ready для main.
