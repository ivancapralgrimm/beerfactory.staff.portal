update public.position_shift_check_definitions
set is_active = false
where position_code = 'hostess'::public.staff_position;

insert into public.position_shift_check_definitions(
  position_code,item_key,check_type,label,sort_order,critical,is_active,
  group_key,group_label,active_iso_weekdays
)
values
('hostess','hostess_open_workplace_1150','opening','Быть на своём рабочем месте в 11:50.',10,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('hostess','hostess_open_messages_restoplace','opening','Проверить мобильный телефон хоста, отвечать на заявки и сообщения в мессенджерах и заявки Restoplace (контролировать каждые 15 минут).',20,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('hostess','hostess_open_phone_charge','opening','Проверить заряд телефонов, при необходимости поставить их на зарядку.',30,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('hostess','hostess_open_light_monitor','opening','Включить свет и слайд-монитор.',40,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('hostess','hostess_open_menus_reserve','opening','Протереть меню и таблички RESERVE.',50,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('hostess','hostess_open_business_cards','opening','Проверить наличие визиток. Если не хватает, пополнить (лежат в 1-м стейшене).',60,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('hostess','hostess_open_brochures_lamp','opening','Протереть пыль под брошюрами и лампу, аккуратно всё разложить.',70,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('hostess','hostess_open_candles','opening','В 17:00 зажечь свечи в осенне-зимний период, летом — в 20:00.',80,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('hostess','hostess_close_trash','closing','Выбросить мусор.',10,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('hostess','hostess_close_light_monitor','closing','Отключить свет и монитор.',20,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('hostess','hostess_close_candles','closing','Потушить свечи.',30,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('hostess','hostess_close_charge_devices','closing','Поставить на зарядку телефоны и планшет.',40,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('hostess','hostess_close_collect_menus','closing','Собрать меню по залу.',50,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[])
on conflict (position_code, item_key)
do update set
  check_type=excluded.check_type,
  label=excluded.label,
  sort_order=excluded.sort_order,
  critical=excluded.critical,
  is_active=excluded.is_active,
  group_key=excluded.group_key,
  group_label=excluded.group_label,
  active_iso_weekdays=excluded.active_iso_weekdays;
