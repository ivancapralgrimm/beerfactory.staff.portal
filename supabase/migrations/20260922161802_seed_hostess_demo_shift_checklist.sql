-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history: 20260922161802 seed_hostess_demo_shift_checklist

create or replace function private.position_label(
  p_position public.staff_position
)
returns text
language sql
immutable
set search_path = public, private
as $$
  select case p_position
    when 'bartender' then 'Бармен'
    when 'waiter' then 'Официант'
    when 'manager' then 'Менеджер'
    when 'hostess' then 'Хостес'
  end
$$;

insert into public.position_shift_check_definitions
(position_code,item_key,check_type,label,sort_order,critical,is_active)
values
  ('hostess','hostess_open_entrance','opening','Входная зона и стойка хостес готовы',10,true,true),
  ('hostess','hostess_open_reservations','opening','Брони и особые пожелания гостей проверены',20,true,true),
  ('hostess','hostess_open_seating_plan','opening','План рассадки и доступность столов актуальны',30,true,true),
  ('hostess','hostess_open_menus','opening','Меню чистые и готовы к выдаче',40,false,true),
  ('hostess','hostess_open_team_info','opening','Важная информация по гостям передана менеджеру и официантам',50,true,true),
  ('hostess','hostess_open_guest_area','opening','Зона ожидания гостей приведена в порядок',60,false,true),

  ('hostess','hostess_close_reservations','closing','Брони и комментарии на следующий день проверены',10,true,true),
  ('hostess','hostess_close_guest_issues','closing','Незавершённые вопросы гостей переданы менеджеру',20,true,true),
  ('hostess','hostess_close_lost_found','closing','Забытые вещи переданы менеджеру',30,false,true),
  ('hostess','hostess_close_menus','closing','Меню собраны и приведены в порядок',40,false,true),
  ('hostess','hostess_close_reception','closing','Стойка хостес и входная зона убраны',50,true,true),
  ('hostess','hostess_close_handover','closing','Информация следующей смене передана',60,true,true)
on conflict (position_code,item_key) do update
set check_type = excluded.check_type,
    label = excluded.label,
    sort_order = excluded.sort_order,
    critical = excluded.critical,
    is_active = excluded.is_active;
