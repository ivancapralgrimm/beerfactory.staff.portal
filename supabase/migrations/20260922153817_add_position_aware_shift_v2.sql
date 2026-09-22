-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history: 20260922153817 add_position_aware_shift_v2
-- Commit this file for reproducibility; do not manually rerun it on the current live project.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'staff_position'
  ) then
    create type public.staff_position as enum ('bartender','waiter','manager');
  end if;
end $$;

alter table public.profiles
  add column if not exists position_code public.staff_position;

update public.profiles
set position_code = case
  when lower(trim(coalesce(position,''))) in ('бармен','бар-менеджер','бар менеджер')
    then 'bartender'::public.staff_position
  when lower(trim(coalesce(position,''))) in ('официант','официантка')
    then 'waiter'::public.staff_position
  when lower(trim(coalesce(position,''))) = 'менеджер'
    then 'manager'::public.staff_position
  else position_code
end
where position_code is null
  and position is not null;

create or replace function private.current_staff_position()
returns public.staff_position
language sql
stable
security definer
set search_path = public, private
as $$
  select p.position_code
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active = true
  limit 1
$$;

revoke all on function private.current_staff_position() from public;
grant execute on function private.current_staff_position() to authenticated;

create table if not exists public.position_shift_check_definitions (
  position_code public.staff_position not null,
  item_key text not null,
  check_type text not null check (check_type in ('opening','closing')),
  label text not null,
  sort_order integer not null default 0,
  critical boolean not null default false,
  is_active boolean not null default true,
  primary key (position_code, item_key)
);

create table if not exists public.position_shift_states (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  position_code public.staff_position not null,
  status text not null default 'not_started'
    check (status in ('not_started','active','closed','expired')),
  opened_by uuid references public.profiles(id),
  closed_by uuid references public.profiles(id),
  opened_at timestamptz,
  closed_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shift_id, position_code)
);

create table if not exists public.position_shift_checks (
  id uuid primary key default gen_random_uuid(),
  position_shift_id uuid not null
    references public.position_shift_states(id) on delete cascade,
  check_type text not null check (check_type in ('opening','closing')),
  item_key text not null,
  label text not null,
  completed boolean not null default false,
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  unique (position_shift_id, check_type, item_key)
);

create index if not exists position_shift_states_shift_idx
  on public.position_shift_states(shift_id);

create index if not exists position_shift_states_position_idx
  on public.position_shift_states(position_code, status);

create index if not exists position_shift_checks_state_idx
  on public.position_shift_checks(position_shift_id);

create index if not exists position_shift_checks_completed_by_idx
  on public.position_shift_checks(completed_by);

insert into public.position_shift_check_definitions(
  position_code,item_key,check_type,label,sort_order,critical,is_active
)
select
  'bartender'::public.staff_position,
  item_key,
  check_type,
  label,
  sort_order,
  critical,
  is_active
from public.shift_check_definitions
on conflict (position_code,item_key) do update
set check_type = excluded.check_type,
    label = excluded.label,
    sort_order = excluded.sort_order,
    critical = excluded.critical,
    is_active = excluded.is_active;

alter table public.position_shift_check_definitions enable row level security;
alter table public.position_shift_states enable row level security;
alter table public.position_shift_checks enable row level security;

drop policy if exists position_shift_definitions_staff_read
  on public.position_shift_check_definitions;
create policy position_shift_definitions_staff_read
on public.position_shift_check_definitions
for select
to authenticated
using (
  private.current_role() is not null
  and position_code = private.current_staff_position()
);

drop policy if exists position_shift_states_staff_read
  on public.position_shift_states;
create policy position_shift_states_staff_read
on public.position_shift_states
for select
to authenticated
using (
  private.current_role() is not null
  and position_code = private.current_staff_position()
);

drop policy if exists position_shift_checks_staff_read
  on public.position_shift_checks;
create policy position_shift_checks_staff_read
on public.position_shift_checks
for select
to authenticated
using (
  private.current_role() is not null
  and exists (
    select 1
    from public.position_shift_states s
    where s.id = position_shift_id
      and s.position_code = private.current_staff_position()
  )
);

revoke insert, update, delete
  on public.position_shift_check_definitions
  from anon, authenticated;
revoke insert, update, delete
  on public.position_shift_states
  from anon, authenticated;
revoke insert, update, delete
  on public.position_shift_checks
  from anon, authenticated;

grant select on public.position_shift_check_definitions to authenticated;
grant select on public.position_shift_states to authenticated;
grant select on public.position_shift_checks to authenticated;

create or replace function private.position_label(
  p_position public.staff_position
)
returns text
language sql
immutable
as $$
  select case p_position
    when 'bartender' then 'Бармен'
    when 'waiter' then 'Официант'
    when 'manager' then 'Менеджер'
  end
$$;

create or replace function private.shift_window_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
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
begin
  if v_time >= time '11:00' then
    v_state := 'open';
    v_operational_date := v_date;
    v_closes_at :=
      ((v_date + 1)::timestamp + time '03:00') at time zone v_zone;
    v_next_open :=
      ((v_date + 1)::timestamp + time '11:00') at time zone v_zone;
  elsif v_time < time '03:00' then
    v_state := 'open';
    v_operational_date := v_date - 1;
    v_closes_at :=
      (v_date::timestamp + time '03:00') at time zone v_zone;
    v_next_open :=
      (v_date::timestamp + time '11:00') at time zone v_zone;
  else
    v_state := 'locked';
    v_operational_date := null;
    v_closes_at := null;
    v_next_open :=
      (v_date::timestamp + time '11:00') at time zone v_zone;
  end if;

  return jsonb_build_object(
    'window_state', v_state,
    'venue_timezone', v_zone,
    'server_now', v_now,
    'operational_date', v_operational_date,
    'closes_at', v_closes_at,
    'next_open_at', v_next_open
  );
end;
$$;

create or replace function private.expire_position_shifts(
  p_position public.staff_position
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_zone constant text := 'Asia/Novosibirsk';
  v_local timestamp := timezone(v_zone, clock_timestamp());
  v_date date := v_local::date;
  v_time time := v_local::time;
begin
  if p_position is null then
    return;
  end if;

  if v_time < time '03:00' then
    update public.position_shift_states ps
    set status = 'expired',
        expired_at = coalesce(ps.expired_at, now())
    from public.shifts sh
    where sh.id = ps.shift_id
      and ps.position_code = p_position
      and ps.status in ('not_started','active')
      and sh.shift_date < v_date - 1;
  elsif v_time < time '11:00' then
    update public.position_shift_states ps
    set status = 'expired',
        expired_at = coalesce(ps.expired_at, now())
    from public.shifts sh
    where sh.id = ps.shift_id
      and ps.position_code = p_position
      and ps.status in ('not_started','active')
      and sh.shift_date <= v_date - 1;
  else
    update public.position_shift_states ps
    set status = 'expired',
        expired_at = coalesce(ps.expired_at, now())
    from public.shifts sh
    where sh.id = ps.shift_id
      and ps.position_code = p_position
      and ps.status in ('not_started','active')
      and sh.shift_date < v_date;
  end if;
end;
$$;

create or replace function private.ensure_position_shift_state()
returns uuid
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

  v_operational_date := (v_context->>'operational_date')::date;

  insert into public.shifts(shift_date,status)
  values(v_operational_date,'not_started')
  on conflict (shift_date) do nothing;

  select * into v_shift
  from public.shifts
  where shift_date = v_operational_date;

  insert into public.position_shift_states(
    shift_id, position_code, status
  )
  values(v_shift.id, v_position, 'not_started')
  on conflict (shift_id, position_code) do nothing;

  select * into v_state
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
  on conflict (position_shift_id, check_type, item_key) do update
  set label = excluded.label;

  return v_state.id;
end;
$$;

create or replace function public.get_position_shift_workflow()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_position public.staff_position;
  v_context jsonb;
  v_state_id uuid;
  v_state public.position_shift_states;
  v_shift public.shifts;
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

  perform private.expire_position_shifts(v_position);

  if v_context->>'window_state' <> 'open' then
    return jsonb_build_object(
      'context', v_context || jsonb_build_object(
        'state', 'locked',
        'position_code', v_position,
        'position_label', private.position_label(v_position)
      ),
      'shift', null,
      'rows', '[]'::jsonb,
      'configured', exists(
        select 1
        from public.position_shift_check_definitions d
        where d.position_code = v_position
          and d.is_active = true
      )
    );
  end if;

  v_state_id := private.ensure_position_shift_state();

  select * into v_state
  from public.position_shift_states
  where id = v_state_id;

  select * into v_shift
  from public.shifts
  where id = v_state.shift_id;

  select exists(
    select 1
    from public.position_shift_check_definitions d
    where d.position_code = v_position
      and d.is_active = true
  ) into v_configured;

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
    on c.position_shift_id = v_state.id
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
      'shift_date', v_shift.shift_date,
      'position_code', v_state.position_code,
      'position_label', private.position_label(v_state.position_code),
      'status', v_state.status,
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

create or replace function public.set_position_shift_check(
  p_check_type text,
  p_item_key text,
  p_completed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_position public.staff_position;
  v_state_id uuid;
  v_state public.position_shift_states;
  v_definition public.position_shift_check_definitions;
  v_check public.position_shift_checks;
begin
  if private.current_role() is null then
    raise exception 'forbidden';
  end if;

  v_position := private.current_staff_position();
  if v_position is null then
    raise exception 'position_required';
  end if;

  v_state_id := private.ensure_position_shift_state();

  select * into v_state
  from public.position_shift_states
  where id = v_state_id;

  select * into v_definition
  from public.position_shift_check_definitions
  where position_code = v_position
    and item_key = p_item_key
    and check_type = p_check_type
    and is_active = true;

  if v_definition.item_key is null then
    raise exception 'invalid_check';
  end if;

  if v_state.status = 'expired' then
    raise exception 'shift_window_locked';
  end if;
  if v_state.status = 'closed' then
    raise exception 'shift_closed';
  end if;
  if p_check_type = 'opening'
     and v_state.status <> 'not_started' then
    raise exception 'opening_locked';
  end if;
  if p_check_type = 'closing'
     and v_state.status <> 'active' then
    raise exception 'closing_locked';
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
    case when p_completed then auth.uid() else null end,
    case when p_completed then now() else null end
  )
  on conflict (position_shift_id, check_type, item_key) do update
  set label = excluded.label,
      completed = excluded.completed,
      completed_by = excluded.completed_by,
      completed_at = excluded.completed_at
  returning * into v_check;

  return to_jsonb(v_check);
end;
$$;

create or replace function public.confirm_position_shift(
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_position public.staff_position;
  v_state_id uuid;
  v_state public.position_shift_states;
  v_shift public.shifts;
  v_missing integer;
  v_total integer;
  v_before text;
begin
  if private.current_role() is null then
    raise exception 'forbidden';
  end if;

  if p_action not in ('open','close') then
    raise exception 'invalid_action';
  end if;

  v_position := private.current_staff_position();
  if v_position is null then
    raise exception 'position_required';
  end if;

  v_state_id := private.ensure_position_shift_state();

  select * into v_state
  from public.position_shift_states
  where id = v_state_id
  for update;

  select * into v_shift
  from public.shifts
  where id = v_state.shift_id;

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

    select count(*) into v_total
    from public.position_shift_check_definitions d
    where d.position_code = v_position
      and d.check_type = 'opening'
      and d.is_active = true;

    if v_total = 0 then
      raise exception 'checklist_not_configured';
    end if;

    select count(*) into v_missing
    from public.position_shift_check_definitions d
    left join public.position_shift_checks c
      on c.position_shift_id = v_state.id
     and c.check_type = d.check_type
     and c.item_key = d.item_key
    where d.position_code = v_position
      and d.check_type = 'opening'
      and d.is_active = true
      and coalesce(c.completed,false) = false;

    if v_missing > 0 then
      raise exception 'opening_incomplete';
    end if;

    v_before := v_state.status;

    update public.position_shift_states
    set status = 'active',
        opened_by = auth.uid(),
        opened_at = coalesce(opened_at,now())
    where id = v_state.id
    returning * into v_state;
  else
    if v_state.status = 'closed' then
      return to_jsonb(v_state);
    end if;
    if v_state.status = 'expired' then
      raise exception 'shift_window_locked';
    end if;
    if v_state.status <> 'active' then
      raise exception 'shift_not_open';
    end if;

    select count(*) into v_total
    from public.position_shift_check_definitions d
    where d.position_code = v_position
      and d.check_type = 'closing'
      and d.is_active = true;

    if v_total = 0 then
      raise exception 'checklist_not_configured';
    end if;

    select count(*) into v_missing
    from public.position_shift_check_definitions d
    left join public.position_shift_checks c
      on c.position_shift_id = v_state.id
     and c.check_type = d.check_type
     and c.item_key = d.item_key
    where d.position_code = v_position
      and d.check_type = 'closing'
      and d.is_active = true
      and coalesce(c.completed,false) = false;

    if v_missing > 0 then
      raise exception 'closing_incomplete';
    end if;

    v_before := v_state.status;

    update public.position_shift_states
    set status = 'closed',
        closed_by = auth.uid(),
        closed_at = coalesce(closed_at,now())
    where id = v_state.id
    returning * into v_state;
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
    auth.uid(),
    'operational_critical_update',
    'position_shift',
    v_state.id::text,
    private.position_label(v_position),
    jsonb_build_object('status',v_before),
    jsonb_build_object(
      'status',v_state.status,
      'opened_at',v_state.opened_at,
      'closed_at',v_state.closed_at
    ),
    jsonb_build_object(
      'source','position_shift_workflow',
      'event',p_action,
      'shift_date',v_shift.shift_date,
      'position_code',v_position
    )
  );

  return to_jsonb(v_state);
end;
$$;

revoke all on function public.get_position_shift_workflow() from public;
revoke all on function public.set_position_shift_check(text,text,boolean) from public;
revoke all on function public.confirm_position_shift(text) from public;

grant execute on function public.get_position_shift_workflow() to authenticated;
grant execute on function public.set_position_shift_check(text,text,boolean) to authenticated;
grant execute on function public.confirm_position_shift(text) to authenticated;
