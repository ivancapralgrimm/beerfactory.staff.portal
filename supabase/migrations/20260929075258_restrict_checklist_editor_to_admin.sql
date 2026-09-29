-- BFStaff r40.4
-- Restrict checklist editor to the same access model as recipe editor:
-- active admin role or owner only. Position/senior/manager role alone does not grant edit access.

create or replace function private.can_manage_checklists()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and (
        p.role::text = 'admin'
        or p.is_owner is true
      )
  )
$$;

revoke all on function private.can_manage_checklists() from public;
revoke all on function private.can_manage_checklists() from anon;
revoke all on function private.can_manage_checklists() from authenticated;
grant execute on function private.can_manage_checklists() to service_role;

create or replace function public.get_checklist_editor_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if not private.can_manage_checklists() then
    raise exception 'forbidden';
  end if;

  return jsonb_build_object(
    'can_edit', true,
    'positions', (
      select jsonb_agg(
        jsonb_build_object(
          'code', x.position_code,
          'label', private.position_label(x.position_code)
        )
        order by x.sort_order
      )
      from (
        values
          ('bartender'::public.staff_position, 10),
          ('waiter'::public.staff_position, 20),
          ('bartender_bb'::public.staff_position, 30),
          ('waiter_bb'::public.staff_position, 40),
          ('manager'::public.staff_position, 50),
          ('hostess'::public.staff_position, 60)
      ) as x(position_code, sort_order)
    ),
    'rows', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'position_code', d.position_code,
            'position_label', private.position_label(d.position_code),
            'item_key', d.item_key,
            'check_type', d.check_type,
            'label', d.label,
            'sort_order', d.sort_order,
            'critical', d.critical,
            'is_active', d.is_active,
            'active_iso_weekdays', to_jsonb(d.active_iso_weekdays),
            'group_key', d.group_key,
            'group_label', d.group_label,
            'created_at', d.created_at,
            'updated_at', d.updated_at,
            'created_by', d.created_by,
            'updated_by', d.updated_by,
            'updated_by_name',
              nullif(
                concat_ws(' ', p.first_name, p.last_name),
                ''
              ),
            'revision', d.revision
          )
          order by
            case d.position_code
              when 'bartender'::public.staff_position then 10
              when 'waiter'::public.staff_position then 20
              when 'bartender_bb'::public.staff_position then 30
              when 'waiter_bb'::public.staff_position then 40
              when 'manager'::public.staff_position then 50
              when 'hostess'::public.staff_position then 60
              else 99
            end,
            case d.check_type
              when 'general_cleaning' then 0
              when 'opening' then 1
              when 'closing' then 2
              else 9
            end,
            d.sort_order,
            d.item_key
        ),
        '[]'::jsonb
      )
      from public.position_shift_check_definitions d
      left join public.profiles p
        on p.id = d.updated_by
    )
  );
end;
$$;

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
set search_path = public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_key text;
  v_label text := trim(coalesce(p_label,''));
  v_group_key text := nullif(trim(coalesce(p_group_key,'')), '');
  v_group_label text := nullif(trim(coalesce(p_group_label,'')), '');
  v_days smallint[] := coalesce(p_active_iso_weekdays, '{}'::smallint[]);
  v_old public.position_shift_check_definitions%rowtype;
  v_new public.position_shift_check_definitions%rowtype;
  v_sort integer;
  v_create boolean := false;
begin
  if v_actor is null or not private.can_manage_checklists() then
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

  if v_group_key is not null and v_group_label is null then
    raise exception 'group_label_required';
  end if;

  v_key := nullif(trim(coalesce(p_item_key,'')), '');

  if v_key is null then
    v_create := true;
    v_key :=
      'editor_' || replace(gen_random_uuid()::text, '-', '');

    select coalesce(max(sort_order),0) + 10
    into v_sort
    from public.position_shift_check_definitions
    where position_code = p_position_code
      and check_type = p_check_type
      and is_active = true;

    insert into public.position_shift_check_definitions(
      position_code,
      item_key,
      check_type,
      label,
      sort_order,
      critical,
      is_active,
      active_iso_weekdays,
      group_key,
      group_label,
      created_at,
      updated_at,
      created_by,
      updated_by,
      revision
    )
    values(
      p_position_code,
      v_key,
      p_check_type,
      v_label,
      v_sort,
      coalesce(p_critical,false),
      coalesce(p_is_active,true),
      v_days,
      v_group_key,
      v_group_label,
      clock_timestamp(),
      clock_timestamp(),
      v_actor,
      v_actor,
      1
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
    case when v_create
      then 'checklist_definition_create'
      else 'checklist_definition_update'
    end,
    'checklist_definition',
    p_position_code::text || ':' || v_key,
    v_new.label,
    case when v_create
      then '{}'::jsonb
      else to_jsonb(v_old)
    end,
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

create or replace function public.reorder_checklist_definitions(
  p_position_code public.staff_position,
  p_check_type text,
  p_item_keys text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_existing text[];
  v_requested text[];
  v_before jsonb;
  v_after jsonb;
begin
  if v_actor is null or not private.can_manage_checklists() then
    raise exception 'forbidden';
  end if;

  if p_check_type not in ('general_cleaning','opening','closing') then
    raise exception 'invalid_check_type';
  end if;

  if p_item_keys is null or cardinality(p_item_keys) < 1 then
    raise exception 'invalid_order';
  end if;

  if (
    select count(*) <> count(distinct x)
    from unnest(p_item_keys) as x
  ) then
    raise exception 'invalid_order';
  end if;

  select array_agg(item_key order by item_key)
  into v_existing
  from public.position_shift_check_definitions
  where position_code = p_position_code
    and check_type = p_check_type
    and is_active = true;

  select array_agg(x order by x)
  into v_requested
  from unnest(p_item_keys) as x;

  if coalesce(v_existing,'{}'::text[]) <> coalesce(v_requested,'{}'::text[]) then
    raise exception 'checklist_order_stale';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'item_key',d.item_key,
        'sort_order',d.sort_order
      )
      order by d.sort_order,d.item_key
    ),
    '[]'::jsonb
  )
  into v_before
  from public.position_shift_check_definitions d
  where d.position_code = p_position_code
    and d.check_type = p_check_type
    and d.is_active = true;

  with requested as (
    select item_key, ordinality::int as position
    from unnest(p_item_keys) with ordinality as u(item_key, ordinality)
  )
  update public.position_shift_check_definitions d
  set sort_order = r.position * 10,
      updated_at = clock_timestamp(),
      updated_by = v_actor,
      revision = d.revision + 1
  from requested r
  where d.position_code = p_position_code
    and d.check_type = p_check_type
    and d.item_key = r.item_key
    and d.is_active = true;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'item_key',d.item_key,
        'sort_order',d.sort_order
      )
      order by d.sort_order,d.item_key
    ),
    '[]'::jsonb
  )
  into v_after
  from public.position_shift_check_definitions d
  where d.position_code = p_position_code
    and d.check_type = p_check_type
    and d.is_active = true;

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
    'checklist_definition_reorder',
    'checklist_definition_group',
    p_position_code::text || ':' || p_check_type,
    private.position_label(p_position_code) || ' · ' || p_check_type,
    jsonb_build_object('order',v_before),
    jsonb_build_object('order',v_after),
    jsonb_build_object(
      'source','checklist-editor',
      'position_code',p_position_code,
      'check_type',p_check_type
    )
  );

  return v_after;
end;
$$;

