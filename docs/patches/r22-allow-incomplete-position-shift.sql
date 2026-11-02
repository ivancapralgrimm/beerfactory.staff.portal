-- OFFLINE REVIEW PATCH ONLY. Not applied to any database.
-- Base: 20260928230000_bfstaff_feed_shift_megapack.sql.
-- R22: retain access/window/state/template guards and row locks; permit incomplete tasks.
-- Existing checks are not modified; finalization/audit machinery remains in place.

begin;

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


commit;
