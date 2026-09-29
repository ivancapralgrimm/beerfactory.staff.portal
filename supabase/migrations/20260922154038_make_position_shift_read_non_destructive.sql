-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history: 20260922154038 make_position_shift_read_non_destructive

create or replace function public.get_position_shift_workflow()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_position public.staff_position;
  v_context jsonb;
  v_operational_date date;
  v_shift public.shifts;
  v_state public.position_shift_states;
  v_rows jsonb;
  v_configured boolean;
begin
  if private.current_role() is null then
    raise exception 'forbidden';
  end if;

  v_position := private.current_staff_position();
  v_context := private.shift_window_context();

  if v_position is null then
    return jsonb_build_object(
      'context', v_context || jsonb_build_object(
        'state', 'position_required',
        'position_code', null,
        'position_label', null
      ),
      'shift', null,
      'rows', '[]'::jsonb,
      'configured', false
    );
  end if;

  select exists(
    select 1
    from public.position_shift_check_definitions d
    where d.position_code = v_position
      and d.is_active = true
  ) into v_configured;

  if v_context->>'window_state' <> 'open' then
    return jsonb_build_object(
      'context', v_context || jsonb_build_object(
        'state', 'locked',
        'position_code', v_position,
        'position_label', private.position_label(v_position)
      ),
      'shift', null,
      'rows', '[]'::jsonb,
      'configured', v_configured
    );
  end if;

  v_operational_date :=
    (v_context->>'operational_date')::date;

  select * into v_shift
  from public.shifts
  where shift_date = v_operational_date;

  if v_shift.id is not null then
    select * into v_state
    from public.position_shift_states
    where shift_id = v_shift.id
      and position_code = v_position;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'item_key', d.item_key,
        'check_type', d.check_type,
        'label', d.label,
        'sort_order', d.sort_order,
        'critical', d.critical,
        'is_active', d.is_active,
        'check', case
          when c.id is null then null
          else jsonb_build_object(
            'id', c.id,
            'check_type', c.check_type,
            'item_key', c.item_key,
            'label', c.label,
            'completed', c.completed,
            'completed_by', c.completed_by,
            'completed_at', c.completed_at
          )
        end
      )
      order by d.check_type, d.sort_order, d.item_key
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.position_shift_check_definitions d
  left join public.position_shift_checks c
    on v_state.id is not null
   and c.position_shift_id = v_state.id
   and c.check_type = d.check_type
   and c.item_key = d.item_key
  where d.position_code = v_position
    and d.is_active = true;

  return jsonb_build_object(
    'context', v_context || jsonb_build_object(
      'state', 'available',
      'position_code', v_position,
      'position_label', private.position_label(v_position)
    ),
    'shift', jsonb_build_object(
      'id', v_state.id,
      'operational_shift_id', v_shift.id,
      'shift_date', v_operational_date,
      'position_code', v_position,
      'position_label', private.position_label(v_position),
      'status', coalesce(v_state.status,'not_started'),
      'opened_by', v_state.opened_by,
      'closed_by', v_state.closed_by,
      'opened_at', v_state.opened_at,
      'closed_at', v_state.closed_at,
      'expired_at', v_state.expired_at,
      'created_at', v_state.created_at
    ),
    'rows', v_rows,
    'configured', v_configured
  );
end;
$$;

revoke execute on function public.get_position_shift_workflow() from anon;
grant execute on function public.get_position_shift_workflow() to authenticated;
