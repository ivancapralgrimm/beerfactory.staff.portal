-- BFStaff r40.4
-- Add the new third bartender opening item and keep the requested order.

update public.position_shift_check_definitions
set sort_order = sort_order + 10
where position_code = 'bartender'::public.staff_position
  and check_type = 'opening'
  and is_active = true
  and sort_order >= 30;

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
values(
  'bartender',
  'bartender_open_farfas_taps',
  'opening',
  'Открыть фарфасы и промыть краны.',
  30,
  false,
  true,
  null,
  null,
  array[1,2,3,4,5,6,7]::smallint[]
)
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
