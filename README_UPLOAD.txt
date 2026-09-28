BFStaff r40.4 · FEED CONNECT HOTFIX v1

Заменить в ветке r40.4-react ровно 3 файла:

1. src/app/App.tsx
2. src/components/layout/AppShell.tsx
3. src/pages/DashboardPage.tsx

Что исправляет:
- подключает новый /feed;
- старый /handover перенаправляет на /feed;
- нижняя навигация показывает «Лента»;
- Dashboard использует новый Feed-блок вместо старой «Передачи».

Backend уже приведён к этой версии:
- bfstaff_feed_shift_megapack применена в Supabase;
- handover-push задеплоен как version 4;
- BF/BB и реальные Manager/Waiter checklist definitions активны;
- cron итогов смены активен на 03:00.

После загрузки этих 3 файлов дождаться GitHub Actions:
npm run typecheck
npm run build

Оба должны стать зелёными.
