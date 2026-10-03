BFStaff r40.5 — inline checklist editor + scroll-to-top + recipe sticker
======================================================================

Цель: применить правки поверх актуальной ветки r40.5. GitHub из этого пакета не изменялся.

Заменить 4 файла с сохранением путей:
1. src/components/layout/AppShell.tsx
2. src/components/craft/craft.css
3. src/features/shift/ChecklistEditorPage.tsx
4. src/features/recipes/RecipeDetailPage.tsx

Опциональный regression-test:
5. tests/r40-5-inline-editor-scrolltop-sticker.test.cjs
   Запуск: node --test tests/r40-5-inline-editor-scrolltop-sticker.test.cjs

Что изменено
------------
• Редактирование существующего пункта чек-листа теперь раскрывает форму прямо внутри карточки выбранного пункта, под его кнопками. Повторное нажатие на карандаш закрывает форму. Создание нового пункта остаётся отдельной формой сверху.
• Ошибки сохранения существующего пункта показываются рядом с открытым inline-редактором, чтобы не требовалось возвращаться вверх страницы.
• В AppShell добавлена плавающая кнопка «Вернуться наверх». Она появляется после заметной прокрутки, учитывает нижний toolbar и safe-area, а при reduced motion не использует плавную анимацию.
• В карточке рецепта «Состав» заменён на бумажный стикер: заголовок «Состав» находится на самом стикере, добавлены бумажная фактура, скотч и лёгкий загиб угла.

Совместимость
-------------
• В AppShell сохранена актуальная r40.5 структура bf-bottom-dock, то есть пакет не откатывает свежий нижний toolbar.
• Серверные API, права, Supabase/NocoDB, миграции и бизнес-логика чек-листов/рецептов не менялись.
• Размер touch-control «наверх»: 44–46 px.

База r40.5, относительно которой собран пакет (Git blob SHA до изменения):
• AppShell.tsx: 8fddc00f44484a0fb5fec141570e5735798c60b2
• craft.css: af0b06edbc7b1890f872ef64a76a0dd9ad84a516
• ChecklistEditorPage.tsx: 452dac7293568dbf4c3d0a9d3763468c8a94ce17
• RecipeDetailPage.tsx: 3325f618ea76ee60c5d20723feb0580ef28c2c52

Проверка
--------
• 3/3 новых regression-теста — PASS.
• 8/8 visual-architecture-hardening — PASS.
• TypeScript syntax parse: 0 TS1xxx parse errors.
• Полный npm build локально не запускался: в переданном исходном архиве нет node_modules, а среда пакета ожидает Node 24.x.
