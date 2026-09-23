create or replace function public.get_dashboard_upcoming_birthdays()
returns table (
  profile_id uuid,
  first_name text,
  last_name text,
  position_code text,
  days_until integer
)
language sql
stable
security definer
set search_path = public, private
as $$
  with context as (
    select
      (current_timestamp at time zone 'Asia/Novosibirsk')::date as today
  ),
  window_dates as (
    select
      c.today,
      gs::integer as days_until,
      (c.today + gs::integer) as event_date
    from context c
    cross join generate_series(0, 2) as gs
  )
  select
    p.id as profile_id,
    p.first_name,
    p.last_name,
    p.position_code::text,
    w.days_until
  from public.profiles p
  cross join window_dates w
  where
    private.current_role() is not null
    and p.is_active is true
    and p.birth_date is not null
    and (
      (
        extract(month from p.birth_date) =
          extract(month from w.event_date)
        and
        extract(day from p.birth_date) =
          extract(day from w.event_date)
      )
      or
      (
        extract(month from p.birth_date) = 2
        and extract(day from p.birth_date) = 29
        and extract(month from w.event_date) = 2
        and extract(day from w.event_date) = 28
        and extract(
          day from (
            date_trunc(
              'month',
              w.event_date::timestamp
            )
            + interval '1 month - 1 day'
          )
        ) = 28
      )
    )
  order by
    w.days_until,
    p.last_name nulls last,
    p.first_name nulls last;
$$;

revoke all on function public.get_dashboard_upcoming_birthdays() from public;
revoke all on function public.get_dashboard_upcoming_birthdays() from anon;
grant execute on function public.get_dashboard_upcoming_birthdays() to authenticated;
