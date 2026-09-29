-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history: 20260922161603 seed_waiter_manager_demo_shift_checklists

insert into public.position_shift_check_definitions
(position_code,item_key,check_type,label,sort_order,critical,is_active)
values
  ('waiter','waiter_open_hall_clean','opening','Чистота зала и столов',10,true,true),
  ('waiter','waiter_open_table_setup','opening','Сервировка и готовность столов',20,true,true),
  ('waiter','waiter_open_menu_stoplist','opening','Меню и стоп-лист',30,true,true),
  ('waiter','waiter_open_pos_terminal','opening','POS / терминал / рабочее место',40,true,true),
  ('waiter','waiter_open_guest_supplies','opening','Салфетки, приборы и расходники',50,false,true),
  ('waiter','waiter_open_reservations','opening','Брони и особые пожелания гостей',60,false,true),

  ('waiter','waiter_close_tables','closing','Столы и гостевая зона приведены в порядок',10,true,true),
  ('waiter','waiter_close_station','closing','Станция официанта пополнена и убрана',20,true,true),
  ('waiter','waiter_close_pos','closing','POS / терминал закрыты корректно',30,true,true),
  ('waiter','waiter_close_lost_found','closing','Забытые вещи и найденные предметы переданы менеджеру',40,false,true),
  ('waiter','waiter_close_guest_issues','closing','Незавершённые вопросы гостей переданы менеджеру',50,true,true),
  ('waiter','waiter_close_handover','closing','Информация следующей смене передана',60,true,true),

  ('manager','manager_open_bar_ready','opening','Проверена готовность бара к открытию',10,true,true),
  ('manager','manager_open_hall_ready','opening','Проверена готовность зала и официантов',20,true,true),
  ('manager','manager_open_pos_cash','opening','Касса, POS и терминалы готовы к работе',30,true,true),
  ('manager','manager_open_stoplist','opening','Стоп-лист и ключевые позиции подтверждены',40,true,true),
  ('manager','manager_open_reservations','opening','Проверены брони, мероприятия и особые гости',50,false,true),
  ('manager','manager_open_briefing','opening','Проведён короткий брифинг команды',60,true,true),

  ('manager','manager_close_bar_checked','closing','Проверено закрытие бара',10,true,true),
  ('manager','manager_close_hall_checked','closing','Проверено закрытие зала и работа официантов',20,true,true),
  ('manager','manager_close_cash_report','closing','Касса и итоговые отчёты проверены',30,true,true),
  ('manager','manager_close_guest_issues','closing','Проблемные ситуации и жалобы зафиксированы',40,true,true),
  ('manager','manager_close_handover','closing','Передача следующей смене оформлена',50,true,true),
  ('manager','manager_close_safety','closing','Оборудование, свет и безопасность проверены',60,true,true)
on conflict (position_code,item_key) do update
set check_type = excluded.check_type,
    label = excluded.label,
    sort_order = excluded.sort_order,
    critical = excluded.critical,
    is_active = excluded.is_active;
