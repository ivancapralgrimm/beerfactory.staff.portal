-- The position-aware workflow replaced the old date-based shift API.
-- Keep the legacy functions for database history, but make them unreachable
-- from application roles. The guards keep fresh database rebuilds idempotent.
do $$
begin
  if to_regprocedure('public.ensure_shift_for_date(date)') is not null then
    revoke all on function public.ensure_shift_for_date(date)
      from public, anon, authenticated;
  end if;

  if to_regprocedure('public.set_shift_check_for_date(date,text,text,boolean)') is not null then
    revoke all on function public.set_shift_check_for_date(date,text,text,boolean)
      from public, anon, authenticated;
  end if;

  if to_regprocedure('public.confirm_open_shift_for_date(date)') is not null then
    revoke all on function public.confirm_open_shift_for_date(date)
      from public, anon, authenticated;
  end if;

  if to_regprocedure('public.confirm_close_shift_for_date(date)') is not null then
    revoke all on function public.confirm_close_shift_for_date(date)
      from public, anon, authenticated;
  end if;
end
$$;
