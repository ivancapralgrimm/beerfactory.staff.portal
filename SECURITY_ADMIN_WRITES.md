# Admin-only recipe changes · r26

Изменения governance выполняются только администраторами.

## Где находится реальная защита

Frontend:
- показывает панель редактирования только если `currentUser.role === admin`;
- это UX, не безопасность.

Cloudflare Worker:
1. принимает Supabase access token;
2. проверяет его через Supabase Auth;
3. читает профиль пользователя;
4. требует `role = admin`;
5. требует активный профиль;
6. только после этого использует серверный NocoDB write token.

## Токены

Текущий viewer token НЕ менять.

Позже добавить отдельный Cloudflare secret:

`NOCODB_WRITE_TOKEN`

Он должен иметь только необходимые права записи в таблицы рецептов.

Таким образом:
- read token остаётся viewer;
- write token не попадает в браузер;
- обычный staff не сможет писать даже если вручную вызовет endpoint;
- скрытие кнопки не является механизмом безопасности.

## Пока write token отсутствует

Редактирование физически выключено.
Worker отвечает `write_token_missing`.


## Audit trail

`public.audit_log` уже создан в Supabase production.

Для recipe governance Worker записывает:
- actor_id;
- action = recipe_governance_update;
- recipe id/name;
- before_data;
- after_data;
- created_at.

Только active admin может читать и создавать audit-записи через RLS.
Update/Delete для authenticated запрещены.

Если NocoDB-запись прошла, но audit insert временно не удался, Worker возвращает
`audit_recorded: false` и не делает вид, будто сама запись рецепта откатилась.
