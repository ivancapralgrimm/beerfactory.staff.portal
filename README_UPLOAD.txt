BFStaff r40.4 · MOBILE INPUT ZOOM GUARD v1

Установить ПЕРЕД созданием/merge PR r40.4-react -> main.

Проверенная база:
HEAD 37752f461b6e88aed056987b8ff1059f974ccffe

Почему нужен:
В текущем коде найдены текстовые поля с 14px/15px:
- Лента
- Профиль
- редактор чек-листов
- Админка
- редактор рецептов
и другие формы.

На iPhone Safari/PWA поле <16px может вызвать автоматический zoom при focus.
Для Android и остальных телефонов единое правило также исключает
разное поведение мобильных браузеров.

Решение:
- новый src/mobile-input-guard.css;
- импортируется ПОСЛЕ styles.css;
- все текстовые input/textarea/select на мобильных/touch-устройствах:
  font-size: 16px !important;
- checkbox/radio/file/range и кнопочные input не затрагиваются.

Важно:
- viewport НЕ блокируется;
- user-scalable не отключается;
- pinch-to-zoom остаётся доступен;
- размеры обычного текста сайта не меняются;
- бизнес-логика не меняется;
- Supabase/Edge/migrations не меняются.

После загрузки:
1. дождаться Typecheck + Build;
2. Vercel success;
3. на iPhone и Android открыть:
   Login, Ленту, Профиль, Recipe editor, Checklist editor, Admin;
4. нажать каждое текстовое поле;
5. экран не должен автоматически приближаться/оставаться увеличенным.
