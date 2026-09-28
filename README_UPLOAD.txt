BFStaff r40.4 · FEED V6 SYNC HOTFIX v2

НЕ УСТАНАВЛИВАТЬ предыдущий BFStaff_r40.4_FEED_WRITE_HOTFIX_v1.
Этот архив полностью его заменяет.

ПРИЧИНА
Live Supabase handover-push уже обновлён до контракта v6, но GitHub r40.4-react
пока хранит старый feed-api и старый исходник Edge Function. Если позже
задеплоить функцию прямо из репозитория, live-логику можно случайно откатить.

ЗАМЕНИТЬ
1. src/features/feed/feed-api.ts
2. supabase/functions/handover-push/index.ts
3. public/push-sw.js

deno.json включён рядом для целостности, но его содержимое не изменилось.

НОВАЯ ЦЕПОЧКА
Публикация:
create_feed_post RPC -> запись сохранена -> notify_created push

Ознакомился:
acknowledge_feed_post RPC

Решено:
resolve_handover RPC -> состояние сохранено -> notify_resolved push

Push больше не является транзакционной зависимостью записи.
Если уведомление временно не отправилось, сама запись/решение уже сохранены.

ПРОВЕРЕНО
- live handover-push ACTIVE, version 6, verify_jwt=true
- notify_created есть
- notify_resolved есть
- legacy create/resolve сохранены
- GET VAPID public key сохранён
- create_feed_post authenticated PASS
- acknowledge_feed_post authenticated PASS
- resolve_handover authenticated PASS
- rollback test left 0 test rows
- @supabase/supabase-js = 2.116.0
- scripts/sync-public.mjs не перезаписывает public/push-sw.js

НЕ ТРЕБУЮТ ИЗМЕНЕНИЙ
- src/lib/config.ts: slug handover-push не менялся
- src/features/notifications/notification-api.ts: GET VAPID contract прежний
- FeedPage.tsx: работает через feed-api abstraction
- DashboardFeedSection.tsx / use-feed.ts: read path прежний
- vite.config.ts: уже подключает push-sw.js
- legacy src/features/handover/*: активного маршрута нет, v6 оставляет совместимость

ПОСЛЕ ЗАГРУЗКИ
Дождаться зелёных Typecheck + Build + Vercel deployment.
Потом проверить создание, «Ознакомился», «Решено», push и переход по push в /#/feed.
