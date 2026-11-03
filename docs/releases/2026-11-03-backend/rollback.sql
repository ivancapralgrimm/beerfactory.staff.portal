-- Exact pre-release definitions. Reverts functions only, not business data.
begin;
CREATE OR REPLACE FUNCTION public.confirm_position_shift(p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_position public.staff_position;
  v_context jsonb;
  v_iso_weekday smallint;
  v_state_id uuid;
  v_state public.position_shift_states;
  v_missing integer;
  v_total integer;
begin
  if private.current_role() is null then
    raise exception 'forbidden';
  end if;

  if p_action not in ('open', 'close') then
    raise exception 'invalid_action';
  end if;

  v_position := private.current_staff_position();

  if v_position is null then
    raise exception 'position_required';
  end if;

  v_context := private.shift_window_context();

  if v_context->>'window_state' <> 'open' then
    raise exception 'shift_window_locked';
  end if;

  v_iso_weekday :=
    (v_context->>'operational_iso_weekday')::smallint;

  v_state_id :=
    private.ensure_position_shift_state();

  select *
    into v_state
  from public.position_shift_states
  where id = v_state_id
  for update;

  if p_action = 'open' then
    if v_state.status = 'active' then
      return to_jsonb(v_state);
    end if;

    if v_state.status = 'closed' then
      raise exception 'shift_closed';
    end if;

    if v_state.status = 'expired' then
      raise exception 'shift_window_locked';
    end if;

    select count(*)
      into v_total
    from public.position_shift_check_definitions d
    where d.position_code = v_position
      and d.check_type = 'opening'
      and d.is_active = true
      and v_iso_weekday =
        any(d.active_iso_weekdays);

    if v_total = 0 then
      raise exception 'checklist_not_configured';
    end if;

    select count(*)
      into v_missing
    from public.position_shift_check_definitions d
    left join public.position_shift_checks c
      on c.position_shift_id = v_state.id
     and c.check_type = d.check_type
     and c.item_key = d.item_key
    where d.position_code = v_position
      and d.check_type = 'opening'
      and d.is_active = true
      and v_iso_weekday =
        any(d.active_iso_weekdays)
      and coalesce(c.completed, false) = false;

    if v_missing > 0 then
      raise exception 'opening_incomplete';
    end if;

    update public.position_shift_states
    set status = 'active',
        opened_by = auth.uid(),
        opened_at =
          coalesce(opened_at, now())
    where id = v_state.id
    returning *
      into v_state;
  else
    if v_state.status = 'closed' then
      return to_jsonb(v_state);
    end if;

    if v_state.status = 'expired' then
      raise exception 'shift_window_locked';
    end if;

    -- Closing can be prepared early, but final confirmation
    -- still requires officially confirmed opening.
    if v_state.status <> 'active' then
      raise exception 'opening_not_confirmed';
    end if;

    select count(*)
      into v_total
    from public.position_shift_check_definitions d
    where d.position_code = v_position
      and d.check_type = 'closing'
      and d.is_active = true
      and v_iso_weekday =
        any(d.active_iso_weekdays);

    if v_total = 0 then
      raise exception 'checklist_not_configured';
    end if;

    select count(*)
      into v_missing
    from public.position_shift_check_definitions d
    left join public.position_shift_checks c
      on c.position_shift_id = v_state.id
     and c.check_type = d.check_type
     and c.item_key = d.item_key
    where d.position_code = v_position
      and d.check_type = 'closing'
      and d.is_active = true
      and v_iso_weekday =
        any(d.active_iso_weekdays)
      and coalesce(c.completed, false) = false;

    if v_missing > 0 then
      raise exception 'closing_incomplete';
    end if;

    update public.position_shift_states
    set status = 'closed',
        closed_by = auth.uid(),
        closed_at =
          coalesce(closed_at, now())
    where id = v_state.id
    returning *
      into v_state;
  end if;

  return to_jsonb(v_state);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_upcoming_birthdays()
 RETURNS TABLE(profile_id uuid, first_name text, last_name text, position_code text, days_until integer, age_years integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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
    w.days_until,
    case
      when w.days_until = 0 then
        extract(year from w.today)::integer
        - extract(year from p.birth_date)::integer
      else null
    end as age_years
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
$function$;

drop function if exists public.get_own_position_shift_history_v1();
commit;
