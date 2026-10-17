alter table public.attestation_categories
  add column if not exists questions_per_test smallint;

update public.attestation_categories c
set questions_per_test = s.questions_per_test
from public.attestation_settings s
where s.singleton is true
  and c.questions_per_test is null;

alter table public.attestation_categories
  alter column questions_per_test set default 15,
  alter column questions_per_test set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attestation_categories_questions_per_test_check'
      and conrelid = 'public.attestation_categories'::regclass
  ) then
    alter table public.attestation_categories
      add constraint attestation_categories_questions_per_test_check
      check (questions_per_test between 1 and 50);
  end if;
end;
$$;

create or replace function private.attestation_category_snapshot(
  p_category public.attestation_categories
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_category.id,
    'label', p_category.label,
    'sortOrder', p_category.sort_order,
    'active', p_category.is_active,
    'questionsPerTest', p_category.questions_per_test,
    'createdAt', p_category.created_at,
    'updatedAt', p_category.updated_at,
    'ticketPlan', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'topic', p.topic,
          'count', p.question_count,
          'sortOrder', p.sort_order
        )
        order by p.sort_order, p.topic
      )
      from public.attestation_ticket_plan p
      where p.category_id = p_category.id
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_attestation_bank()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings public.attestation_settings%rowtype;
begin
  if not exists(
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
  ) then
    raise exception 'forbidden';
  end if;

  select * into v_settings
  from public.attestation_settings
  where singleton is true;

  return jsonb_build_object(
    'passPercent', v_settings.pass_percent,
    'questionsPerTest', v_settings.questions_per_test,
    'revision', v_settings.revision,
    'generatedAt', clock_timestamp(),
    'categories',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'label', c.label,
          'questionsPerTest', c.questions_per_test,
          'questions', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', q.id,
                'q', q.question_text,
                'answers', q.answers,
                'source', q.source,
                'sourceRef', q.source_ref,
                'group', q.group_key,
                'reviewUrl', q.review_url,
                'reviewLabel', q.review_label,
                'topic', q.topic,
                'subcategory', q.subcategory,
                'reviewNote', q.review_note,
                'revision', q.revision
              )
              order by q.sort_order, q.id
            )
            from public.attestation_questions q
            where q.category_id = c.id
              and q.status = 'active'
          ), '[]'::jsonb),
          'ticketPlan', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'topic', p.topic,
                'count', p.question_count
              )
              order by p.sort_order, p.topic
            )
            from public.attestation_ticket_plan p
            where p.category_id = c.id
          ), '[]'::jsonb)
        )
        order by c.sort_order, c.id
      )
      from public.attestation_categories c
      where c.is_active is true
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_attestation_editor_bank(
  p_include_deleted boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings public.attestation_settings%rowtype;
begin
  if not private.attestation_is_admin() then
    raise exception 'forbidden';
  end if;

  select * into v_settings
  from public.attestation_settings
  where singleton is true;

  return jsonb_build_object(
    'settings', jsonb_build_object(
      'passPercent', v_settings.pass_percent,
      'questionsPerTest', v_settings.questions_per_test,
      'revision', v_settings.revision
    ),
    'categories', coalesce((
      select jsonb_agg(
        private.attestation_category_snapshot(c)
        order by c.sort_order, c.id
      )
      from public.attestation_categories c
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(
        private.attestation_question_snapshot(q)
        || jsonb_build_object(
          'createdAt', q.created_at,
          'updatedAt', q.updated_at,
          'createdBy', q.created_by,
          'updatedBy', q.updated_by
        )
        order by q.category_id, q.sort_order, q.id
      )
      from public.attestation_questions q
      where p_include_deleted is true or q.status <> 'deleted'
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.save_attestation_editor_settings_v2(
  p_pass_percent smallint,
  p_category_settings jsonb,
  p_ticket_plan jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_current public.attestation_settings%rowtype;
  v_item jsonb;
  v_category text;
  v_label text;
  v_topic text;
  v_count integer;
  v_sort integer;
  v_questions integer;
  v_total integer;
begin
  if not private.attestation_is_admin() then
    raise exception 'forbidden';
  end if;

  select * into v_current
  from public.attestation_settings
  where singleton is true
  for update;

  if p_expected_revision is null
     or v_current.revision <> p_expected_revision then
    raise exception 'attestation_settings_revision_conflict';
  end if;

  if p_pass_percent < 50 or p_pass_percent > 100 then
    raise exception 'attestation_pass_percent_invalid';
  end if;

  if jsonb_typeof(p_category_settings) <> 'array'
     or jsonb_typeof(p_ticket_plan) <> 'array' then
    raise exception 'attestation_settings_invalid';
  end if;

  if exists(
    select 1
    from (
      select btrim(coalesce(value->>'categoryId','')) as category_id, count(*) as n
      from jsonb_array_elements(p_category_settings)
      group by 1
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'attestation_category_settings_duplicate';
  end if;

  if exists(
    select 1
    from (
      select lower(btrim(coalesce(value->>'label',''))) as label, count(*) as n
      from jsonb_array_elements(p_category_settings)
      group by 1
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'attestation_category_label_duplicate';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_category_settings)
  ) <> (
    select count(*) from public.attestation_categories
  ) then
    raise exception 'attestation_category_settings_incomplete';
  end if;

  for v_item in select value from jsonb_array_elements(p_category_settings)
  loop
    v_category := nullif(btrim(coalesce(v_item->>'categoryId','')), '');
    v_label := btrim(coalesce(v_item->>'label',''));
    begin
      v_questions := (v_item->>'questionsPerTest')::integer;
    exception when others then
      raise exception 'attestation_question_count_invalid';
    end;

    if v_category is null
       or not exists(select 1 from public.attestation_categories where id = v_category)
       or v_questions < 1
       or v_questions > 50 then
      raise exception 'attestation_question_count_invalid';
    end if;

    if length(v_label) < 1 or length(v_label) > 80 then
      raise exception 'attestation_category_label_invalid';
    end if;

    update public.attestation_categories
    set label = v_label,
        questions_per_test = v_questions::smallint,
        updated_at = clock_timestamp(),
        updated_by = v_actor
    where id = v_category;
  end loop;

  if exists(
    select 1
    from (
      select
        btrim(coalesce(value->>'categoryId','')) as category_id,
        lower(btrim(coalesce(value->>'topic',''))) as topic,
        count(*) as n
      from jsonb_array_elements(p_ticket_plan)
      group by 1, 2
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'attestation_ticket_plan_duplicate';
  end if;

  delete from public.attestation_ticket_plan;

  for v_item in select value from jsonb_array_elements(p_ticket_plan)
  loop
    v_category := nullif(btrim(coalesce(v_item->>'categoryId','')), '');
    v_topic := nullif(btrim(coalesce(v_item->>'topic','')), '');

    begin
      v_count := (v_item->>'count')::integer;
      v_sort := coalesce(nullif(v_item->>'sortOrder','')::integer, 0);
    exception when others then
      raise exception 'attestation_ticket_plan_invalid';
    end;

    if v_category is null
       or not exists(select 1 from public.attestation_categories where id = v_category)
       or v_topic is null
       or length(v_topic) > 120
       or v_count < 1
       or v_count > 50
       or v_sort < 0 then
      raise exception 'attestation_ticket_plan_invalid';
    end if;

    insert into public.attestation_ticket_plan(
      category_id, topic, question_count, sort_order
    ) values (
      v_category, v_topic, v_count::smallint, v_sort
    );
  end loop;

  for v_category, v_questions in
    select id, questions_per_test
    from public.attestation_categories
    where is_active is true
  loop
    select coalesce(sum(question_count),0)
    into v_total
    from public.attestation_ticket_plan
    where category_id = v_category;

    if v_total <> v_questions then
      raise exception 'attestation_ticket_total_invalid:%:%:%',
        v_category, v_total, v_questions;
    end if;

    for v_topic in
      select topic
      from public.attestation_ticket_plan
      where category_id = v_category
    loop
      perform private.attestation_assert_topic_capacity(v_category, v_topic);
    end loop;
  end loop;

  update public.attestation_settings
  set pass_percent = p_pass_percent,
      revision = revision + 1,
      updated_at = clock_timestamp(),
      updated_by = v_actor
  where singleton is true
  returning * into v_current;

  return jsonb_build_object(
    'passPercent', v_current.pass_percent,
    'revision', v_current.revision
  );
end;
$$;

create or replace function public.set_attestation_category_status(
  p_category_id text,
  p_is_active boolean,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old public.attestation_categories%rowtype;
  v_new public.attestation_categories%rowtype;
  v_total integer;
  v_topic text;
begin
  if not private.attestation_is_admin() then
    raise exception 'forbidden';
  end if;

  select * into v_old
  from public.attestation_categories
  where id = p_category_id
  for update;

  if v_old.id is null then
    raise exception 'attestation_category_not_found';
  end if;

  if p_expected_updated_at is null
     or v_old.updated_at is distinct from p_expected_updated_at then
    raise exception 'attestation_category_revision_conflict';
  end if;

  if v_old.is_active = p_is_active then
    return private.attestation_category_snapshot(v_old);
  end if;

  if p_is_active is false then
    if (
      select count(*)
      from public.attestation_categories
      where is_active is true
    ) <= 1 then
      raise exception 'attestation_last_category';
    end if;
  else
    select coalesce(sum(question_count),0)
    into v_total
    from public.attestation_ticket_plan
    where category_id = p_category_id;

    if v_total <> v_old.questions_per_test then
      raise exception 'attestation_category_not_ready:ticket_total:%:%',
        v_total, v_old.questions_per_test;
    end if;

    for v_topic in
      select topic
      from public.attestation_ticket_plan
      where category_id = p_category_id
    loop
      if (
        select count(distinct q.group_key)
        from public.attestation_questions q
        where q.category_id = p_category_id
          and q.topic = v_topic
          and q.status = 'active'
      ) < (
        select p.question_count
        from public.attestation_ticket_plan p
        where p.category_id = p_category_id
          and p.topic = v_topic
      ) then
        raise exception 'attestation_category_not_ready:capacity:%', v_topic;
      end if;
    end loop;
  end if;

  update public.attestation_categories
  set is_active = p_is_active,
      updated_at = clock_timestamp(),
      updated_by = v_actor
  where id = p_category_id
  returning * into v_new;

  update public.attestation_settings
  set revision = revision + 1,
      updated_at = clock_timestamp(),
      updated_by = v_actor
  where singleton is true;

  return private.attestation_category_snapshot(v_new);
end;
$$;

revoke all on function public.save_attestation_editor_settings_v2(smallint,jsonb,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.save_attestation_editor_settings_v2(smallint,jsonb,jsonb,bigint) to authenticated, service_role;

revoke all on function public.save_attestation_editor_settings(smallint,smallint,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.save_attestation_editor_settings(smallint,smallint,jsonb,bigint) to service_role;
