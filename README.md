# BFStaff r40.7 — Тёплый зал, Unified RC1 v3

Ветка `redesign/r40.7-warm-hall-v3`, создана от `main` r40.6 (`febed30e31de43ff747d7e714cd54c41254fa34e`). Перенос последней согласованной сборки из `BFStaff-r40.7-Unified-RC1-UI-2026-11-01-v3.zip`. Основное приложение — в корне; прежняя конфигурация Vite/Vercel сохраняется. `main` не изменён.

## Сборка

Node.js 24, `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. Vercel: Root Directory — корень репозитория; Build Command `npm run build`; Output Directory `dist`. `dist` и `node_modules` генерируются и не коммитятся.

Используются существующие Supabase/Cloudflare/NocoDB API. Копирование кода не устанавливает серверные патчи и не создаёт отдельные базы. При тех же настройках preview может обращаться к рабочим данным; операции сохранения в интерфейсе не являются изолированной песочницей.

## Статус: release candidate

Интерфейс «Тёплый зал», пивная карта v3.1, последние правки профиля, поиска, дней рождения, метаданных и увеличенного BFStaff включены. Некоторые согласованные изменения требуют отдельной установки серверной части. SQL, Supabase Functions и Cloudflare Worker автоматически не публикуются.

- Установка и ограничения: [docs/INSTALL_SERVER_RU.md](docs/INSTALL_SERVER_RU.md), [docs/patches/material-lifecycle-README.md](docs/patches/material-lifecycle-README.md).
- Серверный диапазон дней рождения -1..3: [docs/patches/dashboard-birthday-window.sql](docs/patches/dashboard-birthday-window.sql), пока НЕ применён.
- Физическая очистка вложений NocoDB: адаптер пока не завершён, связанные возможности закрыты.
- История визуальных правок: [docs/UI_2026-11-01.md](docs/UI_2026-11-01.md), [docs/UI_2026-11-01-v2.md](docs/UI_2026-11-01-v2.md), [docs/BRAND_SIZE_2026-11-01.md](docs/BRAND_SIZE_2026-11-01.md).
- Проверки с тестовыми HTTP/WS и снимки: `qa/r407/evidence/`; это не проверка production/RLS.
- Происхождение архива: [docs/R407_BRANCH_IMPORT.json](docs/R407_BRANCH_IMPORT.json).

Preview деплой ветки не означает перенос SQL или готовность всех серверных изменений. Production-публикация и слияние с main не выполнялись.
