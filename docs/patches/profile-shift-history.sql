-- Prepared locally for review. NOT APPLIED. No production SQL was executed.
-- R72: narrowly scoped read RPC for Journal > Shift history.
-- No caller-controlled profile/position/venue, no colleague identity or audit payload.
-- Reads stored check snapshots, not today's mutable checklist definitions.
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
