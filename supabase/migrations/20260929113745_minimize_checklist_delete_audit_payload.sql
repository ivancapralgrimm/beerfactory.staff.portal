-- BFStaff r40.4
-- Follow-up to hard delete: keep the deletion audit event,
-- but do not retain the deleted checklist item's user-facing text.

create or replace function public.delete_checklist_definition(
  p_position_code public.staff_position,
  p_item_key text,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_positions public.staff_position[];
  v_item public.position_shift_check_definitions%rowtype;
begin
  v_positions := private.editable_checklist_positions();

  if v_actor is null
     or not (
       p_position_code = any(
         coalesce(v_positions, '{}'::public.staff_position[])
       )
     )
  then
    raise exception 'forbidden';
  end if;

  select *
  into v_item
  from public.position_shift_check_definitions
  where position_code = p_position_code
    and item_key = nullif(trim(coalesce(p_item_key,'')), '')
  for update;

  if v_item.item_key is null then
    raise exception 'checklist_item_not_found';
  end if;

  if p_expected_revision is not null
     and v_item.revision <> p_expected_revision
  then
    raise exception 'checklist_revision_conflict';
  end if;

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
    v_actor,
    'checklist_definition_delete',
    'checklist_definition',
    p_position_code::text || ':' || v_item.item_key,
    null,
    jsonb_build_object(
      'revision', v_item.revision
    ),
    '{"deleted":true}'::jsonb,
    jsonb_build_object(
      'source','checklist-editor',
      'position_code',v_item.position_code,
      'check_type',v_item.check_type
    )
  );

  delete from public.position_shift_check_definitions
  where position_code = p_position_code
    and item_key = v_item.item_key;

  return jsonb_build_object(
    'ok', true,
    'position_code', v_item.position_code,
    'item_key', v_item.item_key
  );
end;
$$;

revoke all on function public.delete_checklist_definition(
  public.staff_position,
  text,
  bigint
) from public;

revoke all on function public.delete_checklist_definition(
  public.staff_position,
  text,
  bigint
) from anon;

revoke all on function public.delete_checklist_definition(
  public.staff_position,
  text,
  bigint
) from authenticated;

grant execute on function public.delete_checklist_definition(
  public.staff_position,
  text,
  bigint
) to authenticated;
