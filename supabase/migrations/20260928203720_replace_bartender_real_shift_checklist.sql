update public.position_shift_check_definitions
set is_active = false
where position_code = 'bartender'::public.staff_position;

insert into public.position_shift_check_definitions(
  position_code,item_key,check_type,label,sort_order,critical,is_active,
  group_key,group_label,active_iso_weekdays
)
values
('bartender','bartender_open_dishes','opening','Посмотреть, принести и разобрать посуду.',10,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_open_dishwasher_coffee_machine','opening','Включить посудомойку, проверить, что кофемашина включена (пивовары или менеджеры включают).',20,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_open_bar_stock','opening','Подтаривание бара: морозилка, холодильники, полки.',30,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_open_tinctures','opening','Пополнить бутылки настойками, заодно проверить наличие настоек.',40,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_open_counter_supplies','opening','Протереть барную стойку, проверить чистоту и пополнить соль, перец и салфетки.',50,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_open_tea_sets','opening','Проверить и пополнить чайные пары.',60,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_open_berries_fruit_greens_mors','opening','Проверить и пополнить ягоды с/м, фрукты, зелень, морс. Заблаговременно предупредить кухню об их заявке или приготовлении морса.',70,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_open_preps','opening','Сделать фреши, заготовки, настойки. Если много работы, предупредить следующую смену, что ещё нужно будет сделать.',80,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_open_polish_glassware','opening','Натереть посуду: винные бокалы, роксы. Проверить чайники и чайные пары.',90,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_open_check_glassware','opening','Проверить посуду на баре на сколы и чистоту (губная помада, ляпы, зубочистки).',100,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_close_coffee_zone','closing','Замыть кофе-зону: кофемолка, поверхность, кофемашина.',10,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_close_work_surface','closing','Замыть рабочую поверхность: доска, нарезки, сиропы, техника.',20,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_close_barmats_silicone','closing','Барматы и силиконовое покрытие рабочки: помыть пеной и затереть.',30,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_close_dishes','closing','Разобрать посуду с мойки и расставить.',40,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_close_cashier_taps','closing','Убрать кассирскую зону и под кранами.',50,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_close_barmats_counter_pass','closing','Барматы на барной стойке, раздача.',60,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_close_counter_pass','closing','Помыть барную стойку и раздачу с чайными парами.',70,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_close_seeds','closing','Отдать семечки официантам.',80,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_close_drip_trays_keg','closing','Помыть каплесборники под кранами и зону с кегой.',90,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_close_dishwasher_zone','closing','Выключить и замыть посудомойку и зону вокруг неё: раковина, дверцы.',100,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_close_pegas','closing','Замыть пегасы. Ведро с химией менять со сливом раз в 2–3 дня, убрать воду на полу, поменять ведро на кеге.',110,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_close_final_check','closing','Проверить посуду на мойке, записанное пиво на персонал, выключенную воду, шланг, пегасы.',120,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
('bartender','bartender_close_taps_farfas','closing','Замыть краны химией и отключить фарфасы.',130,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[])
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
