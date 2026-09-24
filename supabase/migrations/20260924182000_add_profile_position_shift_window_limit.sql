-- BFStaff r40.4
-- Employee self-service working-position changes follow the same operational
-- window as Shift: 11:00 -> 02:59, Asia/Novosibirsk.
-- 03:00 -> 10:59 is locked. One self-service change per operational date.

alter table public.profiles
  add column if not exists
  position_self_changed_operational_date date;

comment on column
  public.profiles.position_self_changed_operational_date
is
  'Operational shift date of the last employee self-service working-position change.';

create or replace function
  public.get_profile_position_self_service_context(
    p_profile_id uuid
  )
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_profile public.profiles%rowtype;
  v_context jsonb;
  v_operational_date date;
  v_window_state text;
begin
  select *
  into v_profile
  from public.profiles
  where id = p_profile_id;

  if v_profile.id is null then
    raise exception 'profile_not_found';
  end if;

  if v_profile.is_active is not true then
    raise exception 'account_disabled';
  end if;

  v_context := private.shift_window_context();
  v_window_state := v_context->>'window_state';

  if v_window_state <> 'open' then
    return jsonb_build_object(
      'can_change', false,
      'reason', 'window_locked',
      'operational_date', null,
      'next_open_at', v_context->>'next_open_at',
      'venue_timezone', v_context->>'venue_timezone'
    );
  end if;

  v_operational_date :=
    (v_context->>'operational_date')::date;

  if
    v_profile.position_self_changed_operational_date
      = v_operational_date
  then
    return jsonb_build_object(
      'can_change', false,
      'reason', 'already_changed',
      'operational_date', v_operational_date,
      'next_open_at', v_context->>'next_open_at',
      'venue_timezone', v_context->>'venue_timezone'
    );
  end if;

  return jsonb_build_object(
    'can_change', true,
    'reason', null,
    'operational_date', v_operational_date,
    'next_open_at', null,
    'venue_timezone', v_context->>'venue_timezone'
  );
end;
$$;

create or replace function
  public.set_profile_position_self_service(
    p_profile_id uuid,
    p_position_code public.staff_position
  )
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_profile public.profiles%rowtype;
  v_context jsonb;
  v_operational_date date;
  v_label text;
  v_now timestamptz := clock_timestamp();
begin
  select *
  into v_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if v_profile.id is null then
    raise exception 'profile_not_found';
  end if;

  if v_profile.is_active is not true then
    raise exception 'account_disabled';
  end if;

  if p_position_code is null then
    raise exception 'invalid_position';
  end if;

  if v_profile.position_code = p_position_code then
    return jsonb_build_object(
      'ok', true,
      'unchanged', true,
      'position_code', v_profile.position_code,
      'position_self_changed_operational_date',
        v_profile.position_self_changed_operational_date
    );
  end if;

  v_context := private.shift_window_context();

  if v_context->>'window_state' <> 'open' then
    raise exception using
      message = 'position_change_window_locked',
      detail = coalesce(
        v_context->>'next_open_at',
        'next shift window'
      );
  end if;

  v_operational_date :=
    (v_context->>'operational_date')::date;

  if
    v_profile.position_self_changed_operational_date
      = v_operational_date
  then
    raise exception using
      message = 'position_change_next_window',
      detail = coalesce(
        v_context->>'next_open_at',
        'next shift window'
      );
  end if;

  v_label := case p_position_code
    when 'bartender' then 'Бармен'
    when 'waiter' then 'Официант'
    when 'manager' then 'Менеджер'
    when 'hostess' then 'Хостес'
  end;

  if v_label is null then
    raise exception 'invalid_position';
  end if;

  update public.profiles
  set position_code = p_position_code,
      position = v_label,
      position_self_changed_operational_date =
        v_operational_date,
      updated_at = v_now
  where id = p_profile_id;

  return jsonb_build_object(
    'ok', true,
    'unchanged', false,
    'position_code', p_position_code,
    'position_self_changed_operational_date',
      v_operational_date,
    'next_position_change_at',
      v_context->>'next_open_at'
  );
end;
$$;

revoke all on function
  public.get_profile_position_self_service_context(uuid)
  from public;
revoke all on function
  public.get_profile_position_self_service_context(uuid)
  from anon;
revoke all on function
  public.get_profile_position_self_service_context(uuid)
  from authenticated;
grant execute on function
  public.get_profile_position_self_service_context(uuid)
  to service_role;

revoke all on function
  public.set_profile_position_self_service(
    uuid,
    public.staff_position
  )
  from public;
revoke all on function
  public.set_profile_position_self_service(
    uuid,
    public.staff_position
  )
  from anon;
revoke all on function
  public.set_profile_position_self_service(
    uuid,
    public.staff_position
  )
  from authenticated;
grant execute on function
  public.set_profile_position_self_service(
    uuid,
    public.staff_position
  )
  to service_role;
