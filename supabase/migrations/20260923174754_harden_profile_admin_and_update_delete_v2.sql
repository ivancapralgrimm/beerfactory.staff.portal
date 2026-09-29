-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history:
-- 20260923174754 harden_profile_admin_and_update_delete_v2
--
-- Keep for source-of-truth. Do not manually rerun on the current live project.

revoke all on table public.profiles from anon;
revoke truncate, references, trigger
  on table public.profiles
  from authenticated;
grant select on table public.profiles to authenticated;

revoke all on table public.quiz_attempts from anon;
revoke delete, update, truncate, references, trigger
  on table public.quiz_attempts
  from authenticated;
grant select, insert on table public.quiz_attempts to authenticated;

revoke all on table public.audit_log from anon;
revoke truncate, references, trigger
  on table public.audit_log
  from authenticated;
grant select, insert on table public.audit_log to authenticated;

create or replace function public.admin_prepare_user_deletion(
  p_actor_id uuid,
  p_target_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_notes_deleted integer := 0;
  v_notes_ack_cleared integer := 0;
  v_notes_resolved_cleared integer := 0;
  v_shift_checks_cleared integer := 0;
  v_shifts_opened_cleared integer := 0;
  v_shifts_closed_cleared integer := 0;
  v_position_checks_cleared integer := 0;
  v_position_opened_cleared integer := 0;
  v_position_closed_cleared integer := 0;
begin
  select * into v_actor
  from public.profiles
  where id = p_actor_id
  for update;

  if v_actor.id is null
     or v_actor.is_active is not true
     or v_actor.role <> 'admin'
  then
    raise exception 'forbidden';
  end if;

  if p_actor_id = p_target_id then
    raise exception 'cannot_delete_self';
  end if;

  select * into v_target
  from public.profiles
  where id = p_target_id
  for update;

  if v_target.id is null then
    raise exception 'user_not_found';
  end if;

  if v_target.is_owner then
    raise exception 'owner_protected';
  end if;

  if v_target.role = 'admin'
     and v_actor.is_owner is not true
  then
    raise exception 'owner_required';
  end if;

  update public.profiles
  set is_active = false,
      updated_at = now()
  where id = p_target_id;

  delete from public.notes
  where author_id = p_target_id;
  get diagnostics v_notes_deleted = row_count;

  update public.notes
  set acknowledged_by = null,
      acknowledged_at = null,
      status = case
        when status = 'acknowledged' then 'new'
        else status
      end
  where acknowledged_by = p_target_id
    and status <> 'resolved';
  get diagnostics v_notes_ack_cleared = row_count;

  update public.notes
  set acknowledged_by = null,
      acknowledged_at = null
  where acknowledged_by = p_target_id
    and status = 'resolved';

  update public.notes
  set resolved_by = null
  where resolved_by = p_target_id;
  get diagnostics v_notes_resolved_cleared = row_count;

  update public.shift_checks
  set completed_by = null
  where completed_by = p_target_id;
  get diagnostics v_shift_checks_cleared = row_count;

  update public.shifts
  set opened_by = null
  where opened_by = p_target_id;
  get diagnostics v_shifts_opened_cleared = row_count;

  update public.shifts
  set closed_by = null
  where closed_by = p_target_id;
  get diagnostics v_shifts_closed_cleared = row_count;

  update public.position_shift_checks
  set completed_by = null
  where completed_by = p_target_id;
  get diagnostics v_position_checks_cleared = row_count;

  update public.position_shift_states
  set opened_by = null
  where opened_by = p_target_id;
  get diagnostics v_position_opened_cleared = row_count;

  update public.position_shift_states
  set closed_by = null
  where closed_by = p_target_id;
  get diagnostics v_position_closed_cleared = row_count;

  delete from public.audit_log
  where entity_type = 'profile'
    and entity_id = p_target_id::text;

  update public.audit_log
  set actor_id = null,
      metadata = coalesce(metadata, '{}'::jsonb)
        || '{"actor_deleted":true}'::jsonb
  where actor_id = p_target_id;

  insert into public.audit_log(
    actor_id,
    action,
    entity_type,
    entity_id,
    entity_name,
    before_data,
    after_data,
    metadata
  )
  values(
    p_actor_id,
    'profile_delete',
    'profile',
    p_target_id::text,
    null,
    jsonb_build_object(
      'role', v_target.role,
      'was_active', v_target.is_active,
      'position_code', v_target.position_code
    ),
    '{"deleted":true}'::jsonb,
    jsonb_build_object(
      'source','staff-admin-users',
      'personal_data_purged',true
    )
  );

  return jsonb_build_object(
    'ok', true,
    'target_id', p_target_id,
    'notes_deleted', v_notes_deleted,
    'notes_acknowledgements_cleared', v_notes_ack_cleared,
    'notes_resolved_refs_cleared', v_notes_resolved_cleared,
    'shift_checks_refs_cleared', v_shift_checks_cleared,
    'shift_open_refs_cleared', v_shifts_opened_cleared,
    'shift_close_refs_cleared', v_shifts_closed_cleared,
    'position_shift_checks_refs_cleared', v_position_checks_cleared,
    'position_shift_open_refs_cleared', v_position_opened_cleared,
    'position_shift_close_refs_cleared', v_position_closed_cleared
  );
end;
$$;

revoke all on function
  public.admin_prepare_user_deletion(uuid,uuid)
  from public;
revoke all on function
  public.admin_prepare_user_deletion(uuid,uuid)
  from anon;
revoke all on function
  public.admin_prepare_user_deletion(uuid,uuid)
  from authenticated;
grant execute on function
  public.admin_prepare_user_deletion(uuid,uuid)
  to service_role;
