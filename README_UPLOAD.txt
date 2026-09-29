BFStaff r40.4 · ACCESS + CHECKLIST EDITOR · v7 AUDITED

УСТАНАВЛИВАТЬ ТОЛЬКО ЭТОТ ПАКЕТ.
Он заменяет v1 / v2 / v3 / v4 / v5 / v6.

ПРОВЕРЕНО ПРОТИВ
- GitHub branch: r40.4-react
- Expected base HEAD: c6ceceefb8446a87f2d7db84be8a75c2ccce6eba
- Live Supabase project: beerfactory-staff-portal
- Venue timezone logic remains Asia/Novosibirsk

ВАЖНО
Если HEAD r40.4-react изменился после указанного SHA ДО загрузки,
сначала повторить сравнение. Пакет проверен именно против этого состояния ветки.

========================================
1. ACCESS MODEL
========================================

Owner:
- profiles.is_owner=true
- полный доступ
- защищён от удаления / понижения

Admin:
- role=admin
- управление персоналом и логами
- все редакторы
- все чек-листы
- может управлять другими admin
- не может удалить/понизить owner
- не может удалить самого себя

Senior:
- role=senior
- Официант BF: редактор рецептов + только checklist waiter
- Официант BB: редактор рецептов + только checklist waiter_bb
- Хостес: только checklist hostess
- нет доступа к /admin, персоналу и внутренним логам

Staff:
- role=staff
- редакторы недоступны

Legacy access-role manager:
- остаётся только как enum-значение ради совместимости
- больше не назначается
- повышенных прав не даёт
- рабочая должность manager / «Менеджер» остаётся

========================================
2. POSITIONS / CHECKLISTS
========================================

Бармен BF:
- Генуборка 1
- Открытие 11
- Закрытие 14

Официант BF:
- Генуборка 1
- Открытие 8
- Закрытие 5

Бармен BB:
- Генуборка 1
- Открытие 8
- Закрытие 6

Официант BB:
- Генуборка 1
- Открытие 8
- Закрытие 5
- стартовая копия BF

Менеджер:
- Генуборка 1
- Открытие 14
- Закрытие 18

Хостес:
- Генуборка 1
- Открытие 8
- Закрытие 5

General Cleaning:
- у каждой рабочей должности один воскресный placeholder «В разработке.»

Source of truth:
public.position_shift_check_definitions

========================================
3. CHECKLIST EDITOR
========================================

Route:
- /shift/editor

Возможности:
- добавить пункт
- изменить текст
- изменить section: Генуборка / Открытие / Закрытие
- дни недели
- critical
- group_key / group_label
- порядок вверх / вниз
- копия пункта
- архив / восстановление
- показать архив
- revision conflict protection
- updated_by / updated_at
- audit_log

Безопасность:
- authenticated имеет к definitions только SELECT
- прямого INSERT / UPDATE / DELETE нет
- запись только через RPC
- scope Senior проверяется НА СЕРВЕРЕ
- soft delete = is_active=false
- история item_key не уничтожается

RPC:
- get_checklist_editor_snapshot()
- save_checklist_definition(...)
- reorder_checklist_definitions(...)

========================================
4. RECIPES
========================================

Senior waiter BF/BB получает редактор рецептов.

Cloudflare Worker уже использует:
public.recipe_editor_access_context()

Поэтому permission решается в Supabase.
Frontend только скрывает/показывает кнопки;
сервер повторно проверяет доступ.

========================================
5. ATTESTATION BOARD
========================================

Нижний блок на экране выбора аттестации теперь получает
5 последних попыток всех активных сотрудников, а не только текущего пользователя.

RPC:
public.get_recent_attestation_attempts(5)

Возвращается только минимальный набор данных для доски:
- имя
- категория
- результат
- correct / total
- время

Полный SELECT чужих quiz_attempts обычным сотрудникам не открывался.

========================================
6. FEED / PUSH SYNCHRONIZATION
========================================

Feed write architecture уже остаётся RPC-first:
- create_feed_post
- notify_created best effort
- resolve_handover
- notify_resolved best effort

FeedPage знает все 6 position codes.

public/push-sw.js в текущем repo уже:
- содержит /#/feed
- НЕ содержит /#/handover

NotificationSettingsCard в v7:
- пользовательское «передача смены» заменено на «запись в Ленте»
- бизнес-логика push не менялась

========================================
7. EDGE FUNCTIONS — LIVE MATCH
========================================

Exact source match после аудита:
- staff-profile v8 ACTIVE
- staff-admin-users v7 ACTIVE
- handover-push v7 ACTIVE
- verify_jwt=true для всех трёх

Import-map deno.json:
- repo == live для всех трёх функций

В ходе аудита найдено:
v6 staff-profile не совпадал с live.
Live staff-profile был синхронизирован до v8.
В v7 package source == live source.

========================================
8. MIGRATIONS INCLUDED IN THIS PACKAGE
========================================

Все нижеперечисленные version/name присутствуют в live migration history:

- 20260928203720_replace_bartender_real_shift_checklist.sql
- 20260928205509_replace_hostess_real_shift_checklist.sql
- 20260928211403_extend_staff_positions_with_bb.sql
- 20260928211425_sync_bf_bb_position_labels_and_self_service.sql
- 20260929052327_add_bartender_open_farfas_taps.sql
- 20260929054930_add_bartender_bb_checklist_and_bf_writeoffs.sql
- 20260929072551_seed_waiter_bb_general_cleaning_and_checklist_editor.sql
- 20260929072646_extend_audit_for_checklist_editor.sql
- 20260929073531_index_checklist_editor_actor_refs.sql
- 20260929075258_restrict_checklist_editor_to_admin.sql
- 20260929080653_simplify_access_roles_and_add_recent_attestation_board.sql

ВАЖНЫЙ HISTORICAL DRIFT В СТАРОЙ ПАПКЕ MIGRATIONS
Он существовал ДО этого пакета:

1. Repo содержит:
   20260924182000_add_profile_position_shift_window_limit.sql
   но такой version отсутствует в live history.
   Функциональность уже реализована более поздней live migration.

2. Repo содержит:
   20260928230000_bfstaff_feed_shift_megapack.sql
   а live cumulative migration зарегистрирована как:
   20260928170742_bfstaff_feed_shift_megapack

3. Live содержит более ранние migration versions,
   которых в текущем repo migration folder вообще нет.

Это НЕ ломает текущую загрузку v7:
.github/workflows/r40-4-preview-build.yml выполняет только:
- npm install
- npm run typecheck
- npm run build

Supabase migrations из GitHub CI сейчас НЕ запускаются.

НО:
НЕ включать автоматический `supabase db push` из этого repository,
пока migration history отдельно не будет reconciled / baselined.

Не пытаться «починить» историю пустыми fake migrations.

========================================
9. FRONTEND INTEGRATION AUDIT
========================================

Проверено:
- App.tsx сохраняет /feed
- legacy /handover остаётся только redirect -> /feed
- добавлен /shift/editor
- AppShell сохраняет 5 bottom tabs
- editor не добавляется шестой bottom-tab
- Dashboard не перезаписывается
- Recipes source-aware routes не меняются
- Feed RPC-first files не перезаписываются старой версией
- PWA push-sw не перезаписывается
- все внутренние imports новых/replaced files существуют
- package TS/TSX parser check: PASS
- checked TS/TSX files: 16
- syntax diagnostics: 0

========================================
10. FILE ACTIONS
========================================

REPLACE:
- src/app/App.tsx
- src/components/layout/AppShell.tsx
- src/features/admin/AdminUserCard.tsx
- src/features/admin/types.ts
- src/features/attestation/attestation-history.ts
- src/features/feed/FeedPage.tsx
- src/features/notifications/NotificationSettingsCard.tsx
- src/features/recipes/RecipeDetailPage.tsx
- src/features/recipes/RecipesPage.tsx
- src/pages/ProfilePage.tsx
- src/types/auth.ts
- supabase/functions/handover-push/index.ts
- supabase/functions/staff-admin-users/index.ts
- supabase/functions/staff-profile/index.ts

ADD:
- src/features/shift/ChecklistEditorPage.tsx
- src/features/shift/checklist-editor-api.ts
- migration files listed above

========================================
11. AFTER UPLOAD — MANDATORY
========================================

После загрузки в r40.4-react:

1. Проверить новый HEAD.
2. GitHub Actions:
   - Typecheck success
   - Build success
3. Vercel deployment success.
4. Smoke:
   - login
   - /feed
   - /shift
   - /shift/editor as owner/admin
   - recipe editor as owner/admin
   - attestation board
5. Отдельно role smoke:
   - staff: no editors
   - senior waiter BF: recipes + only waiter checklist
   - senior waiter BB: recipes + only waiter_bb checklist
   - senior hostess: only hostess checklist
   - admin: all
   - owner: all

ТОЛЬКО после этих проверок пакет считать кандидатом на merge в main.
