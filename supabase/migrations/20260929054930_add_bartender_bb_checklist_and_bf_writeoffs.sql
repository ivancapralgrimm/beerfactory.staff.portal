-- BFStaff r40.4
-- Add real Bartender BB Opening/Closing checklist.
-- Add BF bartender write-offs item immediately after cashier/taps cleanup.

update public.position_shift_check_definitions
set is_active = false
where position_code = 'bartender_bb'::public.staff_position;

update public.position_shift_check_definitions
set sort_order = sort_order + 10
where position_code = 'bartender'::public.staff_position
  and check_type = 'closing'
  and is_active = true
  and sort_order >= 60;

insert into public.position_shift_check_definitions(
  position_code,
  item_key,
  check_type,
  label,
  sort_order,
  critical,
  is_active,
  group_key,
  group_label,
  active_iso_weekdays
)
values
  ('bartender','bartender_close_writeoffs','closing',
   'Забить списания: 17 стол — порча, фрукты, по сроку годности; 18 стол — комплименты; 19 стол — пиво, пена/пролив.',
   60,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),

  ('bartender_bb','bartender_bb_open_arrival_1150','opening',
   'Прийти на смену в 11:50.',
   10,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
  ('bartender_bb','bartender_bb_open_coffee_dishwasher','opening',
   'Проверить, что кофемашина включена, и включить посудомойку.',
   20,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
  ('bartender_bb','bartender_bb_open_lunch_prep','opening',
   'Подготовиться к ланчу: наполнить морс, проверить чайные пары и наличие чая.',
   30,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
  ('bartender_bb','bartender_bb_open_lunch_glassware_wine','opening',
   'Проверить чистоту бокалов под морс и наличие вин для бизнес-ланча.',
   40,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
  ('bartender_bb','bartender_bb_open_teapots','opening',
   'Помыть чайники на баре: губкой и в посудомойке.',
   50,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
  ('bartender_bb','bartender_bb_open_stock_fridges','opening',
   'После ланча затарить холодильники пивом, сидром и вином.',
   60,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
  ('bartender_bb','bartender_bb_open_preps_berries_freezer','opening',
   'Проверить наличие заготовок, сезонных ягод и морозилку; помочь с заготовками BF.',
   70,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
  ('bartender_bb','bartender_bb_open_expiry_rotation','opening',
   'Проверить соки, вина и заготовки на срок годности; проверить бутылочное пиво, определить, что скоро испортится, и поставить на активную продажу.',
   80,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),

  ('bartender_bb','bartender_bb_close_coffee_zone','closing',
   'Замыть кофе-зону пеной: кофемашина, зона с сиропами.',
   10,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
  ('bartender_bb','bartender_bb_close_tools_equipment','closing',
   'Помыть с пеной барный инвентарь: шейкеры, мерники, фрешницу и блендер.',
   20,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
  ('bartender_bb','bartender_bb_close_barmats_taps_zone','closing',
   'Помыть барматы и зону пивных кранов: клеёнка, решётка, слив.',
   30,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
  ('bartender_bb','bartender_bb_close_taps_chemistry','closing',
   'Замыть краны химией, слить химию в слив.',
   40,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
  ('bartender_bb','bartender_bb_close_writeoffs','closing',
   'Забить списания: 17 стол — порча, фрукты, по сроку годности; 18 стол — комплименты; 19 стол — пиво, пена/пролив.',
   50,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[]),
  ('bartender_bb','bartender_bb_close_dishes_shutdown','closing',
   'Принести посуду, выключить кофемашину и слить посудомойку.',
   60,false,true,null,null,array[1,2,3,4,5,6,7]::smallint[])
on conflict (position_code, item_key)
do update
set check_type = excluded.check_type,
    label = excluded.label,
    sort_order = excluded.sort_order,
    critical = excluded.critical,
    is_active = excluded.is_active,
    group_key = excluded.group_key,
    group_label = excluded.group_label,
    active_iso_weekdays = excluded.active_iso_weekdays;
