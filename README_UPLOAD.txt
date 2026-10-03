BFStaff r40.5 — KNOWLEDGE TORN BUTTONS + PREVIOUS MOODBOARD FIXES (CUMULATIVE)
=============================================================================

ЦЕЛЬ
Это кумулятивный пакет для ветки r40.5. Он включает:
1) исправление normal-flow редактора существующих пунктов чек-листа;
2) mood-board / Polaroid страницу рецепта;
3) новую верхнюю панель страницы «Знания» с image-backed torn-paper кнопками.

Этот архив можно ставить ПОСЛЕ предыдущего общего пакета либо ВМЕСТО него.
Он специально собран кумулятивным, чтобы частичная загрузка файлов не оставила
craft.css и React-компоненты в разных версиях.

ЗНАНИЯ — ЧТО ИЗМЕНЕНО
- Кнопка «Профиль» со страницы «Знания» удалена полностью.
- «Новая статья» больше не содержит текста: только иконка карандаша.
- «Управление статьями» больше не содержит текста: только иконка шестерёнки.
- Sync + Pencil + Settings находятся в одной компактной строке справа от заголовка.
- Для сотрудников без editor access остаётся только доступная им кнопка Sync.
- canCreate и hasEditorAccess сохранены: визуальная правка не расширяет права.
- aria-label/title сохранены, поэтому icon-only кнопки остаются понятными для accessibility.
- Заголовок «Знания» увеличен и освобождён от старого padding под отдельные кнопки.

HYBRID / TORN PAPER BUTTONS
Кнопки теперь не рисуются обычным прямоугольным CSS-контейнером.
Их вид формируют локальные SVG surface-assets с прозрачным неровным контуром:
- tool-paper-sync.svg — светлая оторванная бумага;
- tool-leather-create.svg — кожаный лоскут со строчкой для главного create-action;
- tool-paper-settings.svg — второй вариант оторванной бумаги.

Тень и неровный силуэт находятся внутри самих SVG, поэтому внешний контур
не превращается обратно в обычный box-shadow прямоугольник. CSS отвечает только
за размер, focus-state и короткое физическое «прижатие» при тапе.

Категории сохраняют уже существующий гибрид: paper-tag для обычных категорий
и leather для выбранной. Таким образом экран использует бумагу + кожу, но без
случайного набора несвязанных материалов.

СОХРАНЕНО ИЗ ПРЕДЫДУЩЕГО ОБЩЕГО ПАКЕТА
- Checklist editor: отдельный normal-flow блок под выбранным пунктом, без overlap.
- Recipe page: Polaroid, contain без crop, fullscreen RecipePhotoDialog,
  mood-board заметки, tape/pushpin, чередование небольших углов.

ЗАМЕНЯЕМЫЕ ФАЙЛЫ
- src/features/knowledge/KnowledgePage.tsx
- src/features/recipes/RecipeDetailPage.tsx
- src/features/shift/ChecklistEditorPage.tsx
- src/components/craft/craft.css

НОВЫЕ ASSETS
- assets/craft/materials/tool-paper-sync.svg
- assets/craft/materials/tool-paper-settings.svg
- assets/craft/materials/tool-leather-create.svg

REGRESSION TESTS
- tests/r40-5-knowledge-tool-buttons.test.cjs
- tests/r40-5-checklist-editor-flow-fix.test.cjs
- tests/r40-5-recipe-moodboard.test.cjs

ПРОВЕРКА
- combined targeted suite: 7/7 PASS
- Knowledge targeted suite: 3/3 PASS
- TS/TSX syntax parse: 0 ошибок TS1xxx
- CSS brace balance: PASS
- CSS parenthesis balance: PASS
- 3 SVG assets: XML parse PASS
- GitHub этим пакетом не изменялся

ВАЖНО
Полный production npm build локально не запускался: этот пакет содержит только
изменённые файлы, без node_modules. После загрузки в r40.5 дождаться Vercel build
и проверить страницу «Знания» на реальном iPhone/PWA, особенно ширины 375/390 px.
