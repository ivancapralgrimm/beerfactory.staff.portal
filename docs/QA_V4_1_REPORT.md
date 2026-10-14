# QA v4.1 — проверено локально 15 октября 2026

- Текущий HEAD ветки при начале работы: `b827444e905f8b36cf0f2261e4e0cdb7b07e71be`, 5 коммитов после прежнего базового SHA. Семь заменяемых файлов в архиве v4 совпадают с GitHub по git blob SHA.
- Production Supabase проверена **только SELECT**: v3 RPC отсутствует, `knowledge_type` отсутствует; 334 вопросов (331 активный, 2 архив, 1 удалённый), 36 результатов, 334 снимка версий, 4 активных и 1 черновой билет. Нет недостающих групп, несовпадения сумм планов или cross-topic групп.
- Тесты Node (с локальными vm/transport doubles): `64 PASS, 0 FAIL` (`34` алгоритм банка, `22` offline/queue, `8` staged-upgrade). Запуск: `NODE_PATH=$(npm root -g) node --test tests/attestation-independent-tickets-v3.test.cjs tests/attestation-staged-upgrade-v4.test.cjs tests/attestation-offline-sync-v3.test.cjs`.
- Property-based стресс: 270038 допустимых однораздельных наборов групп/квот, 0 некорректных билетов.
- TypeScript transpile синтаксис: 6 изменённых .ts/.tsx файлов без синтаксических diagnostics.
- Не подтверждено в этой среде: `npm ci`, полный `tsc -b`, Vite build, full npm test, физические iOS/Android и реальный PostgREST/JWT/SQL v3. Здесь нет полного checkout/node_modules/тестового PostgreSQL. Последние SQL-логи из v4 показывают 27 PASS для предыдущей версии; текущая SQL-миграция не менялась.
- Внешние записи: 0. Production Supabase, GitHub, main, GitHub Actions не изменены.

## Release gate

БЛОКИРОВКА: production Supabase v3 ещё не применена. Read-only совместимость v4.1 сохраняет только прежние 4 BF билета. Независимые билеты BF/BB/common появятся лишь после установки миграции и интеграционной проверки. Для полной готовности — резервная копия, тестовый Supabase, post-migration counts/rights, реальные admin/staff запросы, проверка offline/PWA и разрешение на изменение production.
