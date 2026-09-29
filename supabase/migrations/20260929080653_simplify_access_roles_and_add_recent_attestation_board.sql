-- BFStaff r40.4
-- Simplified access model + scoped senior editors + public team attestation board.
--
-- Effective access:
-- owner (profiles.is_owner=true): full access
-- admin: full operational/admin access except owner protection
-- senior:
--   waiter/waiter_bb -> recipe editor + own exact waiter checklist
--   hostess -> own hostess checklist
-- staff: no editors
--
-- Legacy public.staff_role value "manager" stays in the enum for historical
-- compatibility, but profiles are normalized away from it and a constraint
-- prevents assigning it again. Working position "manager" remains unaffected.

update public.profiles
set role = 'staff'::public.staff_role,
    updated_at = clock_timestamp()
where role = 'manager'::public.staff_role;

alter table public.profiles
  drop constraint if exists profiles_access_role_v2_check;

alter table public.profiles
  add constraint profiles_access_role_v2_check
  check (role <> 'manager'::public.staff_role);

create or replace function private.is_manager_or_admin()
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
        p.role = 'admin'::public.staff_role
        or p.is_owner is true
      )
  )
$$;

create or replace function private.can_manage_staff()
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
        p.role = 'admin'::public.staff_role
        or p.is_owner is true
      )
  )
$$;

create or replace function private.can_manage_recipes()
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
        p.is_owner is true
        or p.role = 'admin'::public.staff_role
        or (
          p.role = 'senior'::public.staff_role
          and p.position_code in (
            'waiter'::public.staff_position,
            'waiter_bb'::public.staff_position
          )
        )
      )
  )
$$;

create or replace function private.editable_checklist_positions()
returns public.staff_position[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.id is null or p.is_active is not true
      then '{}'::public.staff_position[]
    when p.is_owner is true
      or p.role = 'admin'::public.staff_role
      then array[
        'bartender'::public.staff_position,
        'waiter'::public.staff_position,
        'bartender_bb'::public.staff_position,
        'waiter_bb'::public.staff_position,
        'manager'::public.staff_position,
        'hostess'::public.staff_position
      ]
    when p.role = 'senior'::public.staff_role
      and p.position_code in (
        'waiter'::public.staff_position,
        'waiter_bb'::public.staff_position,
        'hostess'::public.staff_position
      )
      then array[p.position_code]::public.staff_position[]
    else '{}'::public.staff_position[]
  end
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.portal_access_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_positions public.staff_position[];
  v_access_level text;
  v_access_label text;
begin
  select *
  into v_profile
  from public.profiles
  where id = auth.uid()
  limit 1;

  if v_profile.id is null or v_profile.is_active is not true then
    raise exception 'forbidden';
  end if;

  v_positions := private.editable_checklist_positions();

  if v_profile.is_owner is true then
    v_access_level := 'owner';
    v_access_label := 'Владелец';
  elsif v_profile.role = 'admin'::public.staff_role then
    v_access_level := 'admin';
    v_access_label := 'Администратор';
  elsif v_profile.role = 'senior'::public.staff_role then
    v_access_level := 'senior';
    v_access_label := case
      when v_profile.position_code in (
        'waiter'::public.staff_position,
        'waiter_bb'::public.staff_position
      ) then 'Старший официант'
      when v_profile.position_code = 'hostess'::public.staff_position
        then 'Старший хостес'
      else 'Старший сотрудник'
    end;
  else
    v_access_level := 'staff';
    v_access_label := 'Сотрудник';
  end if;

  return jsonb_build_object(
    'user_id', v_profile.id,
    'role', v_profile.role,
    'is_owner', v_profile.is_owner,
    'position_code', v_profile.position_code,
    'access_level', v_access_level,
    'access_label', v_access_label,
    'can_manage_staff',
      (v_profile.is_owner is true or v_profile.role = 'admin'::public.staff_role),
    'can_view_admin_logs',
      (v_profile.is_owner is true or v_profile.role = 'admin'::public.staff_role),
    'can_manage_recipes',
      private.can_manage_recipes(),
    'can_manage_knowledge',
      (v_profile.is_owner is true or v_profile.role = 'admin'::public.staff_role),
    'can_manage_attestation_bank',
      (v_profile.is_owner is true or v_profile.role = 'admin'::public.staff_role),
    'checklist_positions',
      to_jsonb(coalesce(v_positions, '{}'::public.staff_position[]))
  );
end;
$$;

create or replace function public.recipe_editor_access_context()
returns table(
  user_id uuid,
  display_name text,
  is_active boolean,
  can_manage_recipes boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id as user_id,
    coalesce(
      nullif(
        btrim(concat_ws(' ', p.first_name, p.last_name)),
        ''
      ),
      'Редактор'
    )::text as display_name,
    p.is_active,
    (
      p.is_active is true
      and private.can_manage_recipes()
    ) as can_manage_recipes
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.get_checklist_editor_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_positions public.staff_position[];
begin
  v_positions := private.editable_checklist_positions();

  if coalesce(cardinality(v_positions), 0) = 0 then
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
      where x.position_code = any(v_positions)
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
              nullif(concat_ws(' ', p.first_name, p.last_name), ''),
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
      left join public.profiles p on p.id = d.updated_by
      where d.position_code = any(v_positions)
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
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_positions public.staff_position[];
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
  v_positions := private.editable_checklist_positions();

  if v_actor is null
     or not (p_position_code = any(coalesce(v_positions, '{}'::public.staff_position[])))
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

  if v_group_key is not null and v_group_label is null then
    raise exception 'group_label_required';
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

create or replace function public.reorder_checklist_definitions(
  p_position_code public.staff_position,
  p_check_type text,
  p_item_keys text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_positions public.staff_position[];
  v_existing text[];
  v_requested text[];
  v_before jsonb;
  v_after jsonb;
begin
  v_positions := private.editable_checklist_positions();

  if v_actor is null
     or not (p_position_code = any(coalesce(v_positions, '{}'::public.staff_position[])))
  then
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
      jsonb_build_object('item_key',d.item_key,'sort_order',d.sort_order)
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
      jsonb_build_object('item_key',d.item_key,'sort_order',d.sort_order)
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
    actor_id,action,entity_type,entity_id,entity_name,
    before_data,after_data,metadata
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
     or not (
       v_actor.role = 'admin'::public.staff_role
       or v_actor.is_owner is true
     )
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
    actor_id,action,entity_type,entity_id,entity_name,
    before_data,after_data,metadata
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

create or replace function public.get_recent_attestation_attempts(
  p_limit integer default 5
)
returns table(
  id uuid,
  user_id uuid,
  display_name text,
  category text,
  category_id text,
  score smallint,
  passed boolean,
  total_questions smallint,
  correct_answers smallint,
  attempted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit,5),10));
begin
  if not exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.is_active is true
  ) then
    raise exception 'forbidden';
  end if;

  return query
  select
    q.id,
    q.user_id,
    coalesce(
      nullif(
        btrim(concat_ws(' ', p.first_name, p.last_name)),
        ''
      ),
      'Сотрудник'
    )::text,
    coalesce(q.category, 'Общий тест')::text,
    q.category_id,
    q.score,
    q.passed,
    q.total_questions,
    q.correct_answers,
    coalesce(q.finished_at,q.created_at) as attempted_at
  from public.quiz_attempts q
  join public.profiles p
    on p.id = q.user_id
   and p.is_active is true
  order by coalesce(q.finished_at,q.created_at) desc, q.created_at desc
  limit v_limit;
end;
$$;

create index if not exists quiz_attempts_recent_attempted_idx
  on public.quiz_attempts ((coalesce(finished_at,created_at)) desc);

alter table public.audit_log
  drop constraint if exists audit_log_action_check;

alter table public.audit_log
  add constraint audit_log_action_check
  check (
    action = any (
      array[
        'recipe_governance_update'::text,
        'profile_role_update'::text,
        'profile_position_update'::text,
        'profile_activation_update'::text,
        'credential_reset'::text,
        'profile_delete'::text,
        'operational_critical_update'::text,
        'checklist_definition_create'::text,
        'checklist_definition_update'::text,
        'checklist_definition_reorder'::text
      ]
    )
  );

revoke all on function private.is_manager_or_admin() from public;
revoke all on function private.is_manager_or_admin() from anon;
revoke all on function private.is_manager_or_admin() from authenticated;

revoke all on function private.can_manage_staff() from public;
revoke all on function private.can_manage_staff() from anon;
revoke all on function private.can_manage_staff() from authenticated;

revoke all on function private.can_manage_recipes() from public;
revoke all on function private.can_manage_recipes() from anon;
revoke all on function private.can_manage_recipes() from authenticated;

revoke all on function private.editable_checklist_positions() from public;
revoke all on function private.editable_checklist_positions() from anon;
revoke all on function private.editable_checklist_positions() from authenticated;

revoke all on function public.portal_access_context() from public;
revoke all on function public.portal_access_context() from anon;
revoke all on function public.portal_access_context() from authenticated;
grant execute on function public.portal_access_context() to authenticated;

revoke all on function public.get_recent_attestation_attempts(integer) from public;
revoke all on function public.get_recent_attestation_attempts(integer) from anon;
revoke all on function public.get_recent_attestation_attempts(integer) from authenticated;
grant execute on function public.get_recent_attestation_attempts(integer) to authenticated;
