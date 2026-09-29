BFStaff r40.4 · ACCESS SYNC HOTFIX v2 AUDITED

НЕ ЗАГРУЖАТЬ v1.
v2 полностью заменяет v1.

BASE
main
3379792ac84a540d35a6890ccc235396d90b6a42

ЧТО ИСПРАВЛЕНО ПОСЛЕ ПОВТОРНОГО АУДИТА
В v1 автообновление профиля при временном network/profile failure
могло заменить расширенный профиль на базовый Supabase user.
Из-за этого UI мог временно потерять role/position и скрыть редакторы.

В v2:
- последний успешно загруженный profile сохраняется;
- role/position не исчезают из UI при кратковременном 5xx/network failure;
- 401/403/404 продолжают обрабатываться существующей auth-логикой;
- при следующем успешном refresh профиль обновляется нормально.

ЦЕЛЕВАЯ МАТРИЦА

Staff, любая должность:
- без редакторов.

Senior Бармен BF:
- Рецепты;
- только чек-лист Бармен BF.

Senior Бармен BB:
- Рецепты;
- только чек-лист Бармен BB.

Senior Официант BF:
- Рецепты;
- только чек-лист Официант BF.

Senior Официант BB:
- Рецепты;
- только чек-лист Официант BB.

Senior Менеджер:
- Рецепты;
- только чек-лист Менеджер.

Senior Хостес:
- только чек-лист Хостес;
- без редактора рецептов.

Admin, любая рабочая должность:
- все редакторы;
- все 6 должностей чек-листов;
- управление персоналом;
- журналы.

Owner:
- полный доступ.

SESSION SYNC
Профиль автоматически обновляется:
- при возврате focus;
- при возврате PWA из background;
- после восстановления online;
- раз в 30 секунд, пока приложение активно.

LIVE SUPABASE
Уже применена migration:
20260929151936_expand_senior_access_matrix

Migration-файл включён в пакет только для синхронизации repo с live.

ПРЕДУСТАНОВОЧНЫЙ АУДИТ
- main HEAD совпадает: PASS
- server matrix Staff/Senior/Admin × 6 должностей: PASS
- Owner: PASS
- Senior own-checklist scope: PASS
- Admin all-six checklist scope: PASS
- staff-profile Edge v8 repo = live: PASS
- staff-admin-users Edge v7 repo = live: PASS
- legacy access role manager в profiles: 0
- Security Advisor: новых категорий после migration нет
- TS/TSX syntax: PASS
- client permission matrix 18 комбинаций: PASS
- transient network profile preservation: PASS
- ZIP checksums: PASS
- matrix-тесты базы выполнялись через ROLLBACK

ОТДЕЛЬНО
Сейчас есть 1 активный профиль без position_code.
Это не ошибка hotfix.
Staff без должности остаётся Staff.
Senior без должности не получает position-scoped редакторы,
пока ему не назначена рабочая должность.
Admin/Owner от рабочей должности не зависят.

УСТАНОВКА
1. Создать ветку hotfix/r40.4-access-sync ОТ текущего main.
2. Загрузить ТОЛЬКО v2.
3. Дождаться Typecheck + Build и Vercel preview.
4. После загрузки провести authenticated smoke.
5. Только после этого PR -> main, Squash and merge.
