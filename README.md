# BFStaff r40.7 — Тёплый зал

Mobile-first PWA для команды BeerFactory/BeerBistro. Рабочая ветка:`redesign/r40.7-warm-hall-v3`,функциональная база main r40.6:`febed30e31de43ff747d7e714cd54c41254fa34e`. Приложение находится в корне репозитория. Main не изменялся.

## Сборка и проверки

Node.js24. `npm ci`, `npm run typecheck`, `npm test`, `npm run test:retention`, `npm run build`. Vercel:корень репозитория,Build Command `npm run build`,Output Directory `dist`. `dist`,`node_modules`,`public/assets` генерируются.

[Постоянный Preview ветки](https://bfstaff-git-redesign-r407-warm-hall-v3-ivan-grimm.vercel.app). Preview использует общие рабочие Supabase/Cloudflare/NocoDB данные;это не отдельная база. Сохранения в интерфейсе изменяют общие данные.

## Текущее состояние

«Тёплый зал»,пивная карта,ролевые аватары,редакторы и действующие API включены. Знания читаются из Supabase по умолчанию в production/preview;явный legacy режим остаётся для отката.

- [Применённый backend-релиз](docs/releases/2026-11-03-backend/README.md):staff-login v9,история смен,R22,дни рождения за3дня до и1день после.
- [Хранение истории и очистка](docs/retention/README.md):ежедневно03:15НСК,старше60дней,минимум10последних по согласованным группам. Сохранены активные задачи/смены и рабочие материалы.
- [Контракты и подключения](docs/CONNECTIONS_2026-11-03.md).
- [Незавершённые lifecycle/media интеграции](docs/patches/material-lifecycle-README.md):автоматическая физическая очистка вложений NocoDB требует готового адаптера;связанные возможности закрыты.
- [Проверки](qa/r407/evidence/README.md),исходники сценариев в `qa/r407/tests` и `tests`. HTTP/WS fixtures не заменяют реальный production RLS/Storage или проверку телефона.

Миграции и деплой Edge/Worker не запускаются автоматически при frontend build. Применённые миграции не переигрывать. Старые тяжёлые QA-экспорты удалены из рабочего дерева,сохраняются в Git-истории. Лицензии и источники навыков/графики сохранены. Production frontend и main автоматически не публикуются.
