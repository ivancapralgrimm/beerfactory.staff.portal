-- BFStaff r40.4 MEGA
-- Feed + Shift + Manager/Waiter real checklists + Sunday general-cleaning foundation
-- Base target: r40.4-react / current position-aware Shift.
-- This migration is cumulative and intentionally tolerates parts of the
-- 2026-09-28 backend already being present.

-- ============================================================
-- FEED
-- ============================================================

alter table public.notes
  add column if not exists subject text,
  add column if not exists notify_all boolean not null default true,
  add column if not exists notify_positions public.staff_position[] not null default '{}'::public.staff_position[];

update public.notes
set subject = coalesce(
  nullif(trim(subject), ''),
  'Сообщение команды'
)
where subject is null or trim(subject) = '';

alter table public.notes
  alter column subject set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notes_subject_length_check'
      and conrelid = 'public.notes'::regclass
  ) then
    alter table public.notes
      add constraint notes_subject_length_check
      check (length(trim(subject)) between 1 and 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'notes_notification_target_check'
      and conrelid = 'public.notes'::regclass
  ) then
    alter table public.notes
      add constraint notes_notification_target_check
      check (
        (notify_all = true and cardinality(notify_positions) = 0)
        or
        (notify_all = false and cardinality(notify_positions) > 0)
      );
  end if;
end $$;

create table if not exists public.feed_acknowledgements (
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

alter table public.feed_acknowledgements enable row level security;

revoke all on table public.feed_acknowledgements
  from public, anon, authenticated;
grant select on table public.feed_acknowledgements
  to authenticated;

drop policy if exists feed_acknowledgements_read_authenticated
  on public.feed_acknowledgements;

create policy feed_acknowledgements_read_authenticated
on public.feed_acknowledgements
for select
to authenticated
using ((select auth.uid()) is not null);

create index if not exists feed_acknowledgements_user_idx
  on public.feed_acknowledgements(user_id, created_at desc);

create or replace function public.create_feed_post(
  p_subject text,
  p_body text,
  p_priority public.note_priority default 'normal'::public.note_priority,
  p_notify_all boolean default true,
  p_notify_positions public.staff_position[] default '{}'::public.staff_position[]
)
returns public.notes
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  v_subject text := trim(coalesce(p_subject, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_context jsonb;
  v_shift_id uuid;
  v_positions public.staff_position[] :=
    coalesce(p_notify_positions, '{}'::public.staff_position[]);
  result public.notes;
begin
  if private.current_role() is null then
    raise exception 'forbidden';
  end if;

  if length(v_subject) not between 1 and 120 then
    raise exception 'feed_subject_invalid';
  end if;

  if length(v_body) not between 1 and 2000 then
    raise exception 'feed_body_invalid';
  end if;

  if p_priority::text not in ('normal', 'critical') then
    raise exception 'feed_priority_invalid';
  end if;

  if p_notify_all = false
     and cardinality(v_positions) = 0 then
    raise exception 'feed_notification_target_required';
  end if;

  if p_notify_all = true then
    v_positions := '{}'::public.staff_position[];
  end if;

  v_context := private.shift_window_context();

  if v_context->>'window_state' = 'open' then
    select s.id
      into v_shift_id
    from public.shifts s
    where s.shift_date =
      (v_context->>'operational_date')::date
    limit 1;
  end if;

  insert into public.notes(
    shift_id,
    author_id,
    subject,
    body,
    category,
    priority,
    notify_all,
    notify_positions
  )
  values(
    v_shift_id,
    auth.uid(),
    v_subject,
    v_body,
    'other'::public.handover_category,
    p_priority,
    p_notify_all,
    v_positions
  )
  returning * into result;

  return result;
end;
$function$;

create or replace function public.acknowledge_feed_post(
  p_note_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  v_created_at timestamptz;
  v_count integer;
begin
  if private.current_role() is null then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1
    from public.notes
    where id = p_note_id
  ) then
    raise exception 'feed_post_not_found';
  end if;

  insert into public.feed_acknowledgements(
    note_id,
    user_id
  )
  values(
    p_note_id,
    auth.uid()
  )
  on conflict (note_id, user_id) do nothing;

  select created_at
    into v_created_at
  from public.feed_acknowledgements
  where note_id = p_note_id
    and user_id = auth.uid();

  select count(*)::integer
    into v_count
  from public.feed_acknowledgements
  where note_id = p_note_id;

  return jsonb_build_object(
    'note_id', p_note_id,
    'user_id', auth.uid(),
    'created_at', v_created_at,
    'count', v_count
  );
end;
$function$;

revoke all on function public.create_feed_post(
  text,
  text,
  public.note_priority,
  boolean,
  public.staff_position[]
) from public, anon;

grant execute on function public.create_feed_post(
  text,
  text,
  public.note_priority,
  boolean,
  public.staff_position[]
) to authenticated;

revoke all on function public.acknowledge_feed_post(uuid)
  from public, anon;
grant execute on function public.acknowledge_feed_post(uuid)
  to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'feed_acknowledgements'
  ) then
    alter publication supabase_realtime
      add table public.feed_acknowledgements;
  end if;
end $$;

-- ============================================================
-- SHIFT SCHEMA
-- ============================================================

alter table public.position_shift_states
  add column if not exists closing_unlocked_at timestamptz,
  add column if not exists closing_unlocked_by uuid,
  add column if not exists final_audit_logged_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'position_shift_states_closing_unlocked_by_fkey'
      and conrelid =
        'public.position_shift_states'::regclass
  ) then
    alter table public.position_shift_states
      add constraint
        position_shift_states_closing_unlocked_by_fkey
      foreign key (closing_unlocked_by)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

alter table public.position_shift_check_definitions
  add column if not exists group_key text,
  add column if not exists group_label text,
  add column if not exists active_iso_weekdays smallint[]
    not null
    default array[1,2,3,4,5,6,7]::smallint[];

alter table public.position_shift_check_definitions
  drop constraint if exists
    position_shift_check_definitions_check_type_check;

alter table public.position_shift_check_definitions
  add constraint
    position_shift_check_definitions_check_type_check
  check (
    check_type in (
      'general_cleaning',
      'opening',
      'closing'
    )
  );

alter table public.position_shift_checks
  drop constraint if exists
    position_shift_checks_check_type_check;

alter table public.position_shift_checks
  add constraint
    position_shift_checks_check_type_check
  check (
    check_type in (
      'general_cleaning',
      'opening',
      'closing'
    )
  );

alter table public.position_shift_check_definitions
  drop constraint if exists
    position_shift_check_definitions_active_iso_weekdays_check;

alter table public.position_shift_check_definitions
  add constraint
    position_shift_check_definitions_active_iso_weekdays_check
  check (
    cardinality(active_iso_weekdays)
      between 1 and 7
    and active_iso_weekdays
      <@ array[1,2,3,4,5,6,7]::smallint[]
  );

create index if not exists
  position_shift_definitions_group_idx
on public.position_shift_check_definitions(
  position_code,
  check_type,
  group_key,
  sort_order
);

create or replace function private.shift_window_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $function$
declare
  v_zone constant text := 'Asia/Novosibirsk';
  v_now timestamptz := clock_timestamp();
  v_local timestamp := timezone(v_zone, v_now);
  v_date date := v_local::date;
  v_time time := v_local::time;
  v_operational_date date;
  v_next_open timestamptz;
  v_closes_at timestamptz;
  v_state text;
  v_iso_weekday integer;
begin
  if v_time >= time '11:00' then
    v_state := 'open';
    v_operational_date := v_date;
    v_closes_at :=
      ((v_date + 1)::timestamp + time '03:00')
      at time zone v_zone;
    v_next_open :=
      ((v_date + 1)::timestamp + time '11:00')
      at time zone v_zone;
  elsif v_time < time '03:00' then
    v_state := 'open';
    v_operational_date := v_date - 1;
    v_closes_at :=
      (v_date::timestamp + time '03:00')
      at time zone v_zone;
    v_next_open :=
      (v_date::timestamp + time '11:00')
      at time zone v_zone;
  else
    v_state := 'locked';
    v_operational_date := null;
    v_closes_at := null;
    v_next_open :=
      (v_date::timestamp + time '11:00')
      at time zone v_zone;
  end if;

  if v_operational_date is not null then
    v_iso_weekday :=
      extract(isodow from v_operational_date)::integer;
  else
    v_iso_weekday := null;
  end if;

  return jsonb_build_object(
    'window_state', v_state,
    'venue_timezone', v_zone,
    'server_now', v_now,
    'operational_date', v_operational_date,
    'operational_iso_weekday', v_iso_weekday,
    'general_cleaning_day',
      coalesce(v_iso_weekday = 7, false),
    'closes_at', v_closes_at,
    'next_open_at', v_next_open
  );
end;
$function$;

revoke all on function private.shift_window_context()
  from public, anon, authenticated;


create or replace function private.ensure_position_shift_state()
returns uuid
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  v_position public.staff_position;
  v_context jsonb;
  v_operational_date date;
  v_iso_weekday smallint;
  v_shift public.shifts;
  v_state public.position_shift_states;
begin
  if private.current_role() is null then
    raise exception 'forbidden';
  end if;

  v_position := private.current_staff_position();

  if v_position is null then
    raise exception 'position_required';
  end if;

  perform private.expire_position_shifts(v_position);

  v_context := private.shift_window_context();

  if v_context->>'window_state' <> 'open' then
    raise exception 'shift_window_locked';
  end if;

  v_operational_date :=
    (v_context->>'operational_date')::date;

  v_iso_weekday :=
    (v_context->>'operational_iso_weekday')::smallint;

  insert into public.shifts(
    shift_date,
    status
  )
  values(
    v_operational_date,
    'not_started'
  )
  on conflict (shift_date) do nothing;

  select *
    into v_shift
  from public.shifts
  where shift_date = v_operational_date;

  insert into public.position_shift_states(
    shift_id,
    position_code,
    status
  )
  values(
    v_shift.id,
    v_position,
    'not_started'
  )
  on conflict (shift_id, position_code)
  do nothing;

  select *
    into v_state
  from public.position_shift_states
  where shift_id = v_shift.id
    and position_code = v_position;

  insert into public.position_shift_checks(
    position_shift_id,
    check_type,
    item_key,
    label,
    completed
  )
  select
    v_state.id,
    d.check_type,
    d.item_key,
    d.label,
    false
  from public.position_shift_check_definitions d
  where d.position_code = v_position
    and d.is_active = true
    and v_iso_weekday =
      any(d.active_iso_weekdays)
  on conflict (
    position_shift_id,
    check_type,
    item_key
  ) do update
  set label = excluded.label;

  return v_state.id;
end;
$function$;

revoke all on function private.ensure_position_shift_state()
  from public, anon, authenticated;

create or replace function public.get_position_shift_workflow()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  v_position public.staff_position;
  v_context jsonb;
  v_operational_date date;
  v_iso_weekday smallint;
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
      'context',
      v_context || jsonb_build_object(
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
  )
  into v_configured;

  if v_context->>'window_state' <> 'open' then
    return jsonb_build_object(
      'context',
      v_context || jsonb_build_object(
        'state', 'locked',
        'position_code', v_position,
        'position_label',
          private.position_label(v_position)
      ),
      'shift', null,
      'rows', '[]'::jsonb,
      'configured', v_configured
    );
  end if;

  v_operational_date :=
    (v_context->>'operational_date')::date;

  v_iso_weekday :=
    (v_context->>'operational_iso_weekday')::smallint;

  select exists(
    select 1
    from public.position_shift_check_definitions d
    where d.position_code = v_position
      and d.is_active = true
      and v_iso_weekday =
        any(d.active_iso_weekdays)
  )
  into v_configured;

  select *
    into v_shift
  from public.shifts
  where shift_date = v_operational_date;

  if v_shift.id is not null then
    select *
      into v_state
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
        'active_iso_weekdays',
          to_jsonb(d.active_iso_weekdays),
        'group_key', d.group_key,
        'group_label', d.group_label,
        'check',
          case
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
      order by
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
  into v_rows
  from public.position_shift_check_definitions d
  left join public.position_shift_checks c
    on v_state.id is not null
   and c.position_shift_id = v_state.id
   and c.check_type = d.check_type
   and c.item_key = d.item_key
  where d.position_code = v_position
    and d.is_active = true
    and v_iso_weekday =
      any(d.active_iso_weekdays);

  return jsonb_build_object(
    'context',
      v_context || jsonb_build_object(
        'state', 'available',
        'position_code', v_position,
        'position_label',
          private.position_label(v_position)
      ),
    'shift', jsonb_build_object(
      'id', v_state.id,
      'operational_shift_id', v_shift.id,
      'shift_date', v_operational_date,
      'position_code', v_position,
      'position_label',
        private.position_label(v_position),
      'status',
        coalesce(v_state.status, 'not_started'),
      'opened_by', v_state.opened_by,
      'closed_by', v_state.closed_by,
      'opened_at', v_state.opened_at,
      'closed_at', v_state.closed_at,
      'expired_at', v_state.expired_at,
      'created_at', v_state.created_at,
      'closing_unlocked_at',
        v_state.closing_unlocked_at,
      'closing_unlocked_by',
        v_state.closing_unlocked_by,
      'final_audit_logged_at',
        v_state.final_audit_logged_at
    ),
    'rows', v_rows,
    'configured', v_configured
  );
end;
$function$;

revoke all on function public.get_position_shift_workflow()
  from public, anon;

grant execute on function public.get_position_shift_workflow()
  to authenticated;

create or replace function public.set_position_shift_check(
  p_check_type text,
  p_item_key text,
  p_completed boolean
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
  v_definition
    public.position_shift_check_definitions;
  v_check public.position_shift_checks;
begin
  if private.current_role() is null then
    raise exception 'forbidden';
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
  where id = v_state_id;

  select *
    into v_definition
  from public.position_shift_check_definitions
  where position_code = v_position
    and item_key = p_item_key
    and check_type = p_check_type
    and is_active = true
    and v_iso_weekday =
      any(active_iso_weekdays);

  if v_definition.item_key is null then
    raise exception 'invalid_check';
  end if;

  if v_state.status = 'expired' then
    raise exception 'shift_window_locked';
  end if;

  -- General cleaning is independent from the ordinary
  -- opening/closing confirmation state and stays editable
  -- until the common 03:00 server window closes.
  if p_check_type <> 'general_cleaning' then
    if v_state.status = 'closed' then
      raise exception 'shift_closed';
    end if;

    if p_check_type = 'opening'
       and v_state.status <> 'not_started' then
      raise exception 'opening_locked';
    end if;

    if p_check_type = 'closing'
       and v_state.status <> 'active'
       and v_state.closing_unlocked_at is null then
      raise exception 'closing_locked';
    end if;
  end if;

  insert into public.position_shift_checks(
    position_shift_id,
    check_type,
    item_key,
    label,
    completed,
    completed_by,
    completed_at
  )
  values(
    v_state.id,
    p_check_type,
    p_item_key,
    v_definition.label,
    p_completed,
    case
      when p_completed then auth.uid()
      else null
    end,
    case
      when p_completed then now()
      else null
    end
  )
  on conflict (
    position_shift_id,
    check_type,
    item_key
  ) do update
  set label = excluded.label,
      completed = excluded.completed,
      completed_by = excluded.completed_by,
      completed_at = excluded.completed_at
  returning *
    into v_check;

  return to_jsonb(v_check);
end;
$function$;

revoke all on function
  public.set_position_shift_check(
    text,
    text,
    boolean
  )
  from public, anon;

grant execute on function
  public.set_position_shift_check(
    text,
    text,
    boolean
  )
  to authenticated;


create or replace function public.set_position_shift_check_group(
  p_check_type text,
  p_group_key text,
  p_completed boolean
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
  v_rows jsonb;
begin
  if private.current_role() is null then
    raise exception 'forbidden';
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
  where id = v_state_id;

  if not exists (
    select 1
    from public.position_shift_check_definitions d
    where d.position_code = v_position
      and d.check_type = p_check_type
      and d.group_key = p_group_key
      and d.is_active = true
      and v_iso_weekday =
        any(d.active_iso_weekdays)
  ) then
    raise exception 'invalid_group';
  end if;

  if v_state.status = 'expired' then
    raise exception 'shift_window_locked';
  end if;

  if p_check_type <> 'general_cleaning' then
    if v_state.status = 'closed' then
      raise exception 'shift_closed';
    end if;

    if p_check_type = 'opening'
       and v_state.status <> 'not_started' then
      raise exception 'opening_locked';
    end if;

    if p_check_type = 'closing'
       and v_state.status <> 'active'
       and v_state.closing_unlocked_at is null then
      raise exception 'closing_locked';
    end if;
  end if;

  with changed as (
    insert into public.position_shift_checks(
      position_shift_id,
      check_type,
      item_key,
      label,
      completed,
      completed_by,
      completed_at
    )
    select
      v_state.id,
      d.check_type,
      d.item_key,
      d.label,
      p_completed,
      case
        when p_completed then auth.uid()
        else null
      end,
      case
        when p_completed then now()
        else null
      end
    from public.position_shift_check_definitions d
    where d.position_code = v_position
      and d.check_type = p_check_type
      and d.group_key = p_group_key
      and d.is_active = true
      and v_iso_weekday =
        any(d.active_iso_weekdays)
    on conflict (
      position_shift_id,
      check_type,
      item_key
    ) do update
    set label = excluded.label,
        completed = excluded.completed,
        completed_by = excluded.completed_by,
        completed_at = excluded.completed_at
    returning *
  )
  select coalesce(
    jsonb_agg(
      to_jsonb(changed.*)
      order by changed.item_key
    ),
    '[]'::jsonb
  )
  into v_rows
  from changed;

  return v_rows;
end;
$function$;

revoke all on function
  public.set_position_shift_check_group(
    text,
    text,
    boolean
  )
  from public, anon;

grant execute on function
  public.set_position_shift_check_group(
    text,
    text,
    boolean
  )
  to authenticated;

create or replace function public.unlock_position_shift_closing()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  v_state_id uuid;
  v_state public.position_shift_states;
  v_total integer;
begin
  if private.current_role() is null then
    raise exception 'forbidden';
  end if;

  if private.current_staff_position() is null then
    raise exception 'position_required';
  end if;

  select count(*)::integer
    into v_total
  from public.position_shift_check_definitions d
  where d.position_code =
      private.current_staff_position()
    and d.check_type = 'closing'
    and d.is_active = true;

  if coalesce(v_total, 0) = 0 then
    raise exception 'checklist_not_configured';
  end if;

  v_state_id :=
    private.ensure_position_shift_state();

  select *
    into v_state
  from public.position_shift_states
  where id = v_state_id
  for update;

  if v_state.status = 'expired' then
    raise exception 'shift_window_locked';
  end if;

  if v_state.status in ('closed', 'active') then
    return to_jsonb(v_state);
  end if;

  update public.position_shift_states
  set closing_unlocked_at =
        coalesce(closing_unlocked_at, now()),
      closing_unlocked_by =
        coalesce(closing_unlocked_by, auth.uid())
  where id = v_state.id
  returning *
    into v_state;

  return to_jsonb(v_state);
end;
$function$;

revoke all on function
  public.unlock_position_shift_closing()
  from public, anon;

grant execute on function
  public.unlock_position_shift_closing()
  to authenticated;

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
  v_missing integer;
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

    select count(*)
      into v_missing
    from public.position_shift_check_definitions d
    left join public.position_shift_checks c
      on c.position_shift_id = v_state.id
     and c.check_type = d.check_type
     and c.item_key = d.item_key
    where d.position_code = v_position
      and d.check_type = 'opening'
      and d.is_active = true
      and v_iso_weekday =
        any(d.active_iso_weekdays)
      and coalesce(c.completed, false) = false;

    if v_missing > 0 then
      raise exception 'opening_incomplete';
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

    select count(*)
      into v_missing
    from public.position_shift_check_definitions d
    left join public.position_shift_checks c
      on c.position_shift_id = v_state.id
     and c.check_type = d.check_type
     and c.item_key = d.item_key
    where d.position_code = v_position
      and d.check_type = 'closing'
      and d.is_active = true
      and v_iso_weekday =
        any(d.active_iso_weekdays)
      and coalesce(c.completed, false) = false;

    if v_missing > 0 then
      raise exception 'closing_incomplete';
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

-- ============================================================
-- REAL CHECKLISTS: WAITER + MANAGER
-- ============================================================

update public.position_shift_check_definitions
set is_active = false
where position_code in (
  'waiter'::public.staff_position,
  'manager'::public.staff_position
);


insert into public.position_shift_check_definitions(
  position_code,
  item_key,
  check_type,
  label,
  sort_order,
  critical,
  is_active,
  group_key,
  group_label,
  active_iso_weekdays
)
values
  (
    'waiter',
    'waiter_open_fresh_bread',
    'opening',
    'Нарезать свежий хлеб. Вчерашний хлеб убрать на стафф.',
    10,false,true,null,null,
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'waiter',
    'waiter_open_seeds',
    'opening',
    'Пополнить запас семечек на баре.',
    20,false,true,null,null,
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'waiter',
    'waiter_open_trays',
    'opening',
    'Собрать и разложить подносы на баре и кухне, если они ещё не разложены.',
    30,false,true,null,null,
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'waiter',
    'waiter_open_hall_clean',
    'opening',
    'Проверить чистоту зала.',
    40,false,true,null,null,
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'waiter',
    'waiter_open_cleaning_plan',
    'opening',
    'Проверить план уборки на текущий день.',
    50,false,true,null,null,
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'waiter',
    'waiter_open_dry_napkins',
    'opening',
    'Пополнить ящики с сухими салфетками.',
    60,false,true,null,null,
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'waiter',
    'waiter_open_dishes_cutlery',
    'opening',
    'Пополнить посуду и столовые приборы на раздаче.',
    70,false,true,null,null,
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'waiter',
    'waiter_open_sugar_wet_napkins',
    'opening',
    'Пополнить сахар и влажные салфетки на баре, стейшене и раздаче.',
    80,false,true,null,null,
    array[1,2,3,4,5,6,7]::smallint[]
  ),

  (
    'waiter',
    'waiter_close_tables',
    'closing',
    'Привести столы в порядок: протереть, при необходимости заменить скатерти, выполнить сервировку, пополнить салфетки и зубочистки.',
    10,false,true,null,null,
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'waiter',
    'waiter_close_polish_dishes',
    'closing',
    'Натереть посуду и расставить её на раздаче.',
    20,false,true,null,null,
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'waiter',
    'waiter_close_stations',
    'closing',
    'Навести порядок на стейшенах № 5 и № 1, выбросить мусор.',
    30,false,true,null,null,
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'waiter',
    'waiter_close_trays',
    'closing',
    'Разложить подносы на бортик для просушки.',
    40,false,true,null,null,
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'waiter',
    'waiter_close_seeds_sauceboats',
    'closing',
    'Убрать с бара семечки и пустые соусники.',
    50,false,true,null,null,
    array[1,2,3,4,5,6,7]::smallint[]
  ),

  (
    'manager',
    'manager_open_bf_panels',
    'opening',
    'Включить щитки напротив офиса: первые два автомата на первом щитке и первый автомат на втором.',
    10,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_open_bf_audac',
    'opening',
    'Включить музыку через AUDAC.',
    20,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_open_bf_ac',
    'opening',
    'Включить кондиционеры.',
    30,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_open_bf_tv',
    'opening',
    'Включить телевизоры.',
    40,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_open_bf_cash',
    'opening',
    'Открыть смену в кассе.',
    50,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_open_bf_doors',
    'opening',
    'В 11:50 открыть входные двери.',
    60,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),

  (
    'manager',
    'manager_open_bb_supply',
    'opening',
    'Включить приточную вентиляцию.',
    110,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_open_bb_ventilation',
    'opening',
    'Включить вентиляцию — управление находится рядом с приточной системой.',
    120,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_open_bb_music',
    'opening',
    'Включить музыку в щитке.',
    130,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_open_bb_light',
    'opening',
    'Выставить свет с экрана — проверить 1-ю и 2-ю страницы.',
    140,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_open_bb_ac',
    'opening',
    'Включить кондиционер.',
    150,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_open_bb_tv',
    'opening',
    'Включить телевизор.',
    160,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_open_bb_cash',
    'opening',
    'Открыть смену в кассе.',
    170,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_open_bb_doors',
    'opening',
    'В 11:50 открыть входные двери, перевернуть скамейки и положить коврик.',
    180,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),

  (
    'manager',
    'manager_close_bf_cash',
    'closing',
    'Закрыть кассовую смену: X-отчёт → 48 → 41 → закрытие смены. Сделать фото для Оли и написать сумму выручки.',
    10,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bf_panels',
    'closing',
    'Выключить щитки напротив офиса.',
    20,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bf_kitchen_light',
    'closing',
    'Выключить свет на кухне: третий щиток в каморке + выключатель света слева в каморке.',
    30,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bf_amplifiers',
    'closing',
    'Выключить усилители в офисе.',
    40,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bf_service_door',
    'closing',
    'Закрыть служебную дверь.',
    50,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bf_ac',
    'closing',
    'Выключить кондиционеры.',
    60,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bf_tv',
    'closing',
    'Выключить телевизоры.',
    70,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bf_hall_light',
    'closing',
    'Выключить свет в зале с экрана, расположенного в баре.',
    80,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bf_front_door',
    'closing',
    'Закрыть входную дверь.',
    90,false,true,'bf','BF',
    array[1,2,3,4,5,6,7]::smallint[]
  ),

  (
    'manager',
    'manager_close_bb_cash',
    'closing',
    'Закрыть кассовую смену: X-отчёт → 48 → 41 → закрытие смены. Сделать фото для Оли и написать сумму выручки.',
    110,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bb_music',
    'closing',
    'Выключить музыку.',
    120,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bb_light',
    'closing',
    'Выставить свет на экране по сценарию закрытия — проверить 1-ю и 2-ю страницы.',
    130,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bb_ac',
    'closing',
    'Выключить кондиционер.',
    140,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bb_tv',
    'closing',
    'Выключить телевизор.',
    150,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bb_mat',
    'closing',
    'Убрать коврик.',
    160,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bb_front_door',
    'closing',
    'Закрыть входную дверь.',
    170,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bb_ventilation',
    'closing',
    'Выключить приточную вентиляцию и вентиляцию.',
    180,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  ),
  (
    'manager',
    'manager_close_bb_stairs_door',
    'closing',
    'Закрыть дверь около лестницы.',
    190,false,true,'bb','BB',
    array[1,2,3,4,5,6,7]::smallint[]
  )
on conflict (position_code, item_key)
do update
set check_type = excluded.check_type,
    label = excluded.label,
    sort_order = excluded.sort_order,
    critical = excluded.critical,
    is_active = excluded.is_active,
    group_key = excluded.group_key,
    group_label = excluded.group_label,
    active_iso_weekdays =
      excluded.active_iso_weekdays;

-- Actual general-cleaning items are intentionally not seeded yet.
-- When supplied, use check_type='general_cleaning' and
-- active_iso_weekdays=array[7]::smallint[].


-- ============================================================
-- 03:00 COMPACT JOURNAL SUMMARY
-- Counts CURRENT ACTIVE definitions, not stale historical checks.
-- ============================================================

create or replace function
  private.finalize_position_shift_windows()
returns integer
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  v_zone constant text := 'Asia/Novosibirsk';
  v_local timestamp :=
    timezone(v_zone, clock_timestamp());
  v_shift_date date :=
    v_local::date - 1;
  v_iso_weekday smallint :=
    extract(isodow from v_shift_date)::smallint;
  v_row record;

  v_open_total integer;
  v_open_completed integer;
  v_open_done jsonb;
  v_open_missing jsonb;

  v_close_total integer;
  v_close_completed integer;
  v_close_done jsonb;
  v_close_missing jsonb;

  v_clean_total integer;
  v_clean_completed integer;
  v_clean_done jsonb;
  v_clean_missing jsonb;

  v_status_before text;
  v_status_after text;
  v_count integer := 0;
  v_is_sunday boolean;
begin
  if v_local::time < time '03:00' then
    return 0;
  end if;

  for v_row in
    select
      ps.*,
      sh.shift_date
    from public.position_shift_states ps
    join public.shifts sh
      on sh.id = ps.shift_id
    where sh.shift_date = v_shift_date
      and ps.final_audit_logged_at is null
    order by ps.position_code
    for update of ps skip locked
  loop
    v_is_sunday :=
      extract(
        isodow from v_row.shift_date
      )::integer = 7;

    select
      count(*)::integer,
      (
        count(*)
        filter (
          where coalesce(c.completed, false)
        )
      )::integer,
      coalesce(
        jsonb_agg(
          case
            when d.group_label is null
              then d.label
            else
              d.group_label || ': ' || d.label
          end
          order by d.sort_order, d.item_key
        )
        filter (
          where coalesce(c.completed, false)
        ),
        '[]'::jsonb
      ),
      coalesce(
        jsonb_agg(
          case
            when d.group_label is null
              then d.label
            else
              d.group_label || ': ' || d.label
          end
          order by d.sort_order, d.item_key
        )
        filter (
          where not coalesce(c.completed, false)
        ),
        '[]'::jsonb
      )
    into
      v_open_total,
      v_open_completed,
      v_open_done,
      v_open_missing
    from public.position_shift_check_definitions d
    left join public.position_shift_checks c
      on c.position_shift_id = v_row.id
     and c.check_type = d.check_type
     and c.item_key = d.item_key
    where d.position_code =
        v_row.position_code
      and d.check_type = 'opening'
      and d.is_active = true
      and v_iso_weekday =
        any(d.active_iso_weekdays);

    select
      count(*)::integer,
      (
        count(*)
        filter (
          where coalesce(c.completed, false)
        )
      )::integer,
      coalesce(
        jsonb_agg(
          case
            when d.group_label is null
              then d.label
            else
              d.group_label || ': ' || d.label
          end
          order by d.sort_order, d.item_key
        )
        filter (
          where coalesce(c.completed, false)
        ),
        '[]'::jsonb
      ),
      coalesce(
        jsonb_agg(
          case
            when d.group_label is null
              then d.label
            else
              d.group_label || ': ' || d.label
          end
          order by d.sort_order, d.item_key
        )
        filter (
          where not coalesce(c.completed, false)
        ),
        '[]'::jsonb
      )
    into
      v_close_total,
      v_close_completed,
      v_close_done,
      v_close_missing
    from public.position_shift_check_definitions d
    left join public.position_shift_checks c
      on c.position_shift_id = v_row.id
     and c.check_type = d.check_type
     and c.item_key = d.item_key
    where d.position_code =
        v_row.position_code
      and d.check_type = 'closing'
      and d.is_active = true
      and v_iso_weekday =
        any(d.active_iso_weekdays);

    select
      count(*)::integer,
      (
        count(*)
        filter (
          where coalesce(c.completed, false)
        )
      )::integer,
      coalesce(
        jsonb_agg(
          case
            when d.group_label is null
              then d.label
            else
              d.group_label || ': ' || d.label
          end
          order by d.sort_order, d.item_key
        )
        filter (
          where coalesce(c.completed, false)
        ),
        '[]'::jsonb
      ),
      coalesce(
        jsonb_agg(
          case
            when d.group_label is null
              then d.label
            else
              d.group_label || ': ' || d.label
          end
          order by d.sort_order, d.item_key
        )
        filter (
          where not coalesce(c.completed, false)
        ),
        '[]'::jsonb
      )
    into
      v_clean_total,
      v_clean_completed,
      v_clean_done,
      v_clean_missing
    from public.position_shift_check_definitions d
    left join public.position_shift_checks c
      on c.position_shift_id = v_row.id
     and c.check_type = d.check_type
     and c.item_key = d.item_key
    where d.position_code =
        v_row.position_code
      and d.check_type = 'general_cleaning'
      and d.is_active = true
      and v_iso_weekday =
        any(d.active_iso_weekdays);

    v_status_before := v_row.status;
    v_status_after := v_row.status;

    if v_row.status in (
      'not_started',
      'active'
    ) then
      update public.position_shift_states
      set status = 'expired',
          expired_at =
            coalesce(expired_at, now())
      where id = v_row.id;

      v_status_after := 'expired';
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
      null,
      'operational_critical_update',
      'position_shift_window_summary',
      v_row.id::text,
      private.position_label(
        v_row.position_code
      ),
      jsonb_build_object(
        'status',
        v_status_before
      ),
      jsonb_build_object(
        'status',
        v_status_after,
        'opening',
        jsonb_build_object(
          'completed',
            coalesce(v_open_completed, 0),
          'total',
            coalesce(v_open_total, 0),
          'confirmed',
            v_row.opened_at is not null,
          'confirmed_at',
            v_row.opened_at
        ),
        'closing',
        jsonb_build_object(
          'completed',
            coalesce(v_close_completed, 0),
          'total',
            coalesce(v_close_total, 0),
          'confirmed',
            v_row.closed_at is not null,
          'confirmed_at',
            v_row.closed_at
        )
      )
      ||
      case
        when v_is_sunday then
          jsonb_build_object(
            'general_cleaning',
            jsonb_build_object(
              'completed',
                coalesce(
                  v_clean_completed,
                  0
                ),
              'total',
                coalesce(
                  v_clean_total,
                  0
                )
            )
          )
        else
          '{}'::jsonb
      end,
      jsonb_build_object(
        'source',
          'position_shift_workflow',
        'event',
          'position_shift_window_summary',
        'shift_date',
          v_row.shift_date,
        'position_code',
          v_row.position_code,
        'opening_completed',
          coalesce(
            v_open_done,
            '[]'::jsonb
          ),
        'opening_missing',
          coalesce(
            v_open_missing,
            '[]'::jsonb
          ),
        'closing_completed',
          coalesce(
            v_close_done,
            '[]'::jsonb
          ),
        'closing_missing',
          coalesce(
            v_close_missing,
            '[]'::jsonb
          ),
        'closing_unlocked_early',
          v_row.closing_unlocked_at
            is not null,
        'closing_unlocked_at',
          v_row.closing_unlocked_at
      )
      ||
      case
        when v_is_sunday then
          jsonb_build_object(
            'general_cleaning_completed',
              coalesce(
                v_clean_done,
                '[]'::jsonb
              ),
            'general_cleaning_missing',
              coalesce(
                v_clean_missing,
                '[]'::jsonb
              )
          )
        else
          '{}'::jsonb
      end
    );

    update public.position_shift_states
    set final_audit_logged_at = now()
    where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

revoke all on function
  private.finalize_position_shift_windows()
  from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
    from pg_namespace
    where nspname = 'cron'
  ) then
    if exists (
      select 1
      from cron.job
      where jobname =
        'beerfactory-position-shift-window-summary'
    ) then
      perform cron.unschedule(
        'beerfactory-position-shift-window-summary'
      );
    end if;

    -- Asia/Novosibirsk is UTC+7:
    -- 20:00 UTC = 03:00 venue time.
    perform cron.schedule(
      'beerfactory-position-shift-window-summary',
      '0 20 * * *',
      'select private.finalize_position_shift_windows();'
    );
  end if;
end $$;
