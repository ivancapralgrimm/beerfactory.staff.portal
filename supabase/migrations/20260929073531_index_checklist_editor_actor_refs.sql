create index if not exists
  position_shift_check_definitions_created_by_idx
on public.position_shift_check_definitions(created_by)
where created_by is not null;

create index if not exists
  position_shift_check_definitions_updated_by_idx
on public.position_shift_check_definitions(updated_by)
where updated_by is not null;
