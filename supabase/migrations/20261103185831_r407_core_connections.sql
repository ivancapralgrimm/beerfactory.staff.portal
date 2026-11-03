-- Authorized by owner 2026-11-03. Functions only; no business-row updates.

-- Source: docs/patches/profile-shift-history.sql
create or replace function public.get_own_position_shift_history_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_result jsonb;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or v_profile.is_active is not true then
    raise exception 'forbidden';
  end if;
  if v_profile.position_code is null then
    raise exception 'position_required';
  end if;
  -- Every access role, including owner/admin, stays on its own current position.
  -- Position uniquely determines the permitted venue in the main contract.
  select coalesce(jsonb_agg(item.payload order by item.shift_date desc), '[]'::jsonb)
  into v_result
  from (
    select sh.shift_date,
      jsonb_build_object(
        'id', ps.id,
        'shift_date', sh.shift_date,
        'position_code', ps.position_code,
        'status', ps.status,
        'opened_at', ps.opened_at,
        'closed_at', ps.closed_at,
        'checks', coalesce((
          select jsonb_agg(jsonb_build_object(
            'check_type', c.check_type,
            'item_key', c.item_key,
            'label', c.label,
            'completed', c.completed
          ) order by c.check_type, c.item_key)
          from public.position_shift_checks c
          where c.position_shift_id = ps.id
        ), '[]'::jsonb)
      ) as payload
    from public.position_shift_states ps
    join public.shifts sh on sh.id = ps.shift_id
    where ps.position_code = v_profile.position_code
    order by sh.shift_date desc, ps.id
    limit 30
  ) item;
  return v_result;
end;
$$;
revoke all on function public.get_own_position_shift_history_v1() from public, anon;
grant execute on function public.get_own_position_shift_history_v1() to authenticated;

-- Source: docs/patches/r22-allow-incomplete-position-shift.sql
create or replace function public.confirm_position_shift(
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  v_position public.staff_position;
  v_context jsonb;
  v_iso_weekday smallint;
  v_state_id uuid;
  v_state public.position_shift_states;
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

revoke all on function
  public.confirm_position_shift(text)
  from public, anon;

grant execute on function
  public.confirm_position_shift(text)
  to authenticated;

-- Source: docs/patches/dashboard-birthday-window.sql
create or replace function public.get_dashboard_upcoming_birthdays()
returns table (
  profile_id uuid,
  first_name text,
  last_name text,
  position_code text,
  days_until integer,
  age_years integer
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
    cross join generate_series(-1, 3) as gs
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
$$;

revoke all on function public.get_dashboard_upcoming_birthdays() from public;
revoke all on function public.get_dashboard_upcoming_birthdays() from anon;
grant execute on function public.get_dashboard_upcoming_birthdays() to authenticated;
