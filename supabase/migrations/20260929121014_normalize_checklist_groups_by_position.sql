create or replace function public.save_checklist_definition(
  p_position_code public.staff_position,
  p_item_key text,
  p_check_type text,
  p_label text,
  p_critical boolean default false,
  p_is_active boolean default true,
  p_active_iso_weekdays smallint[] default array[1,2,3,4,5,6,7]::smallint[],
  p_group_key text default null,
  p_group_label text default null,
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
  v_key text;
  v_label text := trim(coalesce(p_label,''));
  v_group_key text;
  v_group_label text;
  v_days smallint[] := coalesce(p_active_iso_weekdays, '{}'::smallint[]);
  v_old public.position_shift_check_definitions%rowtype;
  v_new public.position_shift_check_definitions%rowtype;
  v_sort integer;
  v_create boolean := false;
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

  if p_check_type not in ('general_cleaning','opening','closing') then
    raise exception 'invalid_check_type';
  end if;

  if length(v_label) < 1 or length(v_label) > 500 then
    raise exception 'invalid_label';
  end if;

  if cardinality(v_days) < 1
     or cardinality(v_days) > 7
     or not (v_days <@ array[1,2,3,4,5,6,7]::smallint[])
  then
    raise exception 'invalid_weekdays';
  end if;

  if (
    select count(*) <> count(distinct x)
    from unnest(v_days) as x
  ) then
    raise exception 'invalid_weekdays';
  end if;

  if p_position_code = 'manager'::public.staff_position then
    v_group_key := lower(nullif(trim(coalesce(p_group_key,'')), ''));

    if v_group_key is null then
      v_group_label := null;
    elsif v_group_key = 'bf' then
      v_group_label := 'BF';
    elsif v_group_key = 'bb' then
      v_group_label := 'BB';
    else
      raise exception 'invalid_group';
    end if;
  else
    v_group_key := null;
    v_group_label := null;
  end if;

  v_key := nullif(trim(coalesce(p_item_key,'')), '');

  if v_key is null then
    v_create := true;
    v_key := 'editor_' || replace(gen_random_uuid()::text, '-', '');

    select coalesce(max(sort_order),0) + 10
    into v_sort
    from public.position_shift_check_definitions
    where position_code = p_position_code
      and check_type = p_check_type
      and is_active = true;

    insert into public.position_shift_check_definitions(
      position_code,item_key,check_type,label,sort_order,critical,is_active,
      active_iso_weekdays,group_key,group_label,
      created_at,updated_at,created_by,updated_by,revision
    )
    values(
      p_position_code,v_key,p_check_type,v_label,v_sort,
      coalesce(p_critical,false),coalesce(p_is_active,true),v_days,
      v_group_key,v_group_label,
      clock_timestamp(),clock_timestamp(),v_actor,v_actor,1
    )
    returning * into v_new;
  else
    select *
    into v_old
    from public.position_shift_check_definitions
    where position_code = p_position_code
      and item_key = v_key
    for update;

    if v_old.item_key is null then
      raise exception 'checklist_item_not_found';
    end if;

    if p_expected_revision is not null
       and v_old.revision <> p_expected_revision
    then
      raise exception 'checklist_revision_conflict';
    end if;

    v_sort := v_old.sort_order;

    if v_old.check_type <> p_check_type then
      select coalesce(max(sort_order),0) + 10
      into v_sort
      from public.position_shift_check_definitions
      where position_code = p_position_code
        and check_type = p_check_type
        and is_active = true;
    end if;

    update public.position_shift_check_definitions
    set check_type = p_check_type,
        label = v_label,
        sort_order = v_sort,
        critical = coalesce(p_critical,false),
        is_active = coalesce(p_is_active,true),
        active_iso_weekdays = v_days,
        group_key = v_group_key,
        group_label = v_group_label,
        updated_at = clock_timestamp(),
        updated_by = v_actor,
        revision = revision + 1
    where position_code = p_position_code
      and item_key = v_key
    returning * into v_new;
  end if;

  insert into public.audit_log(
    actor_id,action,entity_type,entity_id,entity_name,
    before_data,after_data,metadata
  )
  values(
    v_actor,
    case when v_create
      then 'checklist_definition_create'
      else 'checklist_definition_update'
    end,
    'checklist_definition',
    p_position_code::text || ':' || v_key,
    v_new.label,
    case when v_create then '{}'::jsonb else to_jsonb(v_old) end,
    to_jsonb(v_new),
    jsonb_build_object(
      'source','checklist-editor',
      'position_code',p_position_code,
      'check_type',p_check_type
    )
  );

  return to_jsonb(v_new)
    || jsonb_build_object(
      'position_label',
      private.position_label(v_new.position_code)
    );
end;
$$;

revoke all on function public.save_checklist_definition(
  public.staff_position,text,text,text,boolean,boolean,smallint[],text,text,bigint
) from public;

revoke all on function public.save_checklist_definition(
  public.staff_position,text,text,text,boolean,boolean,smallint[],text,text,bigint
) from anon;

revoke all on function public.save_checklist_definition(
  public.staff_position,text,text,text,boolean,boolean,smallint[],text,text,bigint
) from authenticated;

grant execute on function public.save_checklist_definition(
  public.staff_position,text,text,text,boolean,boolean,smallint[],text,text,bigint
) to authenticated;
