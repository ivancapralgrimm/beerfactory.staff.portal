-- r40.6: full attestation editor settings/category administration.
-- LIVE APPLIED 2026-10-06 UTC. Do not re-run manually during preview QA.
-- Adds guarded admin RPCs only; no auth/user changes.

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

create or replace function private.attestation_assert_topic_capacity(
  p_category_id text,
  p_topic text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_required integer;
  v_available integer;
begin
  -- Inactive categories are drafts: admins must be able to prepare questions
  -- and ticket plans before publishing the category.
  if not exists(
    select 1
    from public.attestation_categories c
    where c.id = p_category_id
      and c.is_active is true
  ) then
    return;
  end if;

  select question_count
  into v_required
  from public.attestation_ticket_plan
  where category_id = p_category_id
    and topic = p_topic;

  if v_required is null then
    return;
  end if;

  select count(distinct group_key)
  into v_available
  from public.attestation_questions
  where category_id = p_category_id
    and topic = p_topic
    and status = 'active';

  if v_available < v_required then
    raise exception 'attestation_ticket_capacity:%:%:%',
      p_category_id, p_topic, v_required;
  end if;
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

create or replace function public.save_attestation_question(
  p_document jsonb,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id text := nullif(btrim(coalesce(p_document->>'id','')), '');
  v_category text := nullif(btrim(coalesce(p_document->>'categoryId','')), '');
  v_text text := btrim(coalesce(p_document->>'q',''));
  v_topic text := btrim(coalesce(p_document->>'topic',''));
  v_subcategory text := nullif(btrim(coalesce(p_document->>'subcategory','')), '');
  v_group text := btrim(coalesce(p_document->>'group',''));
  v_answers jsonb := p_document->'answers';
  v_old public.attestation_questions%rowtype;
  v_new public.attestation_questions%rowtype;
  v_sort integer;
begin
  if not private.attestation_is_admin() then
    raise exception 'forbidden';
  end if;

  -- Questions may be prepared inside an inactive category. The category becomes
  -- visible to staff only after set_attestation_category_status validates it.
  if v_category is null or not exists(
    select 1
    from public.attestation_categories
    where id = v_category
  ) then
    raise exception 'attestation_category_invalid';
  end if;

  if length(v_text) < 1 or length(v_text) > 1000 then
    raise exception 'attestation_question_invalid';
  end if;

  if length(v_topic) < 1 or length(v_topic) > 120 then
    raise exception 'attestation_topic_invalid';
  end if;

  if v_subcategory is not null and length(v_subcategory) > 120 then
    raise exception 'attestation_subcategory_invalid';
  end if;

  if length(v_group) < 1 or length(v_group) > 160 then
    raise exception 'attestation_group_invalid';
  end if;

  if not private.attestation_validate_answers(v_answers) then
    raise exception 'attestation_answers_invalid';
  end if;

  if v_id is null then
    v_id := v_category || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

    select coalesce(max(sort_order), 0) + 10
    into v_sort
    from public.attestation_questions
    where category_id = v_category;

    insert into public.attestation_questions(
      id, category_id, question_text, answers, topic, subcategory, group_key,
      source, source_ref, review_url, review_label, review_note,
      status, sort_order, revision, created_by, updated_by
    )
    values(
      v_id,
      v_category,
      v_text,
      v_answers,
      v_topic,
      v_subcategory,
      v_group,
      nullif(btrim(coalesce(p_document->>'source','')), ''),
      nullif(btrim(coalesce(p_document->>'sourceRef','')), ''),
      nullif(btrim(coalesce(p_document->>'reviewUrl','')), ''),
      nullif(btrim(coalesce(p_document->>'reviewLabel','')), ''),
      nullif(btrim(coalesce(p_document->>'reviewNote','')), ''),
      'active',
      v_sort,
      1,
      v_actor,
      v_actor
    )
    returning * into v_new;
  else
    select *
    into v_old
    from public.attestation_questions
    where id = v_id
    for update;

    if v_old.id is null then
      raise exception 'attestation_question_not_found';
    end if;

    if p_expected_revision is null
       or v_old.revision <> p_expected_revision then
      raise exception 'attestation_revision_conflict';
    end if;

    update public.attestation_questions
    set
      category_id = v_category,
      question_text = v_text,
      answers = v_answers,
      topic = v_topic,
      subcategory = v_subcategory,
      group_key = v_group,
      source = nullif(btrim(coalesce(p_document->>'source','')), ''),
      source_ref = nullif(btrim(coalesce(p_document->>'sourceRef','')), ''),
      review_url = nullif(btrim(coalesce(p_document->>'reviewUrl','')), ''),
      review_label = nullif(btrim(coalesce(p_document->>'reviewLabel','')), ''),
      review_note = nullif(btrim(coalesce(p_document->>'reviewNote','')), ''),
      updated_at = clock_timestamp(),
      updated_by = v_actor,
      revision = revision + 1
    where id = v_id
    returning * into v_new;

    perform private.attestation_assert_topic_capacity(
      v_old.category_id,
      v_old.topic
    );
  end if;

  update public.attestation_settings
  set revision = revision + 1,
      updated_at = clock_timestamp(),
      updated_by = v_actor
  where singleton is true;

  return private.attestation_question_snapshot(v_new)
    || jsonb_build_object(
      'createdAt', v_new.created_at,
      'updatedAt', v_new.updated_at
    );
end;
$$;

create or replace function public.save_attestation_editor_settings(
  p_pass_percent smallint,
  p_questions_per_test smallint,
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
  v_topic text;
  v_count integer;
  v_sort integer;
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

  if p_questions_per_test < 1 or p_questions_per_test > 50 then
    raise exception 'attestation_question_count_invalid';
  end if;

  if jsonb_typeof(p_ticket_plan) <> 'array' then
    raise exception 'attestation_ticket_plan_invalid';
  end if;

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

  for v_item in
    select value from jsonb_array_elements(p_ticket_plan)
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
    )
    values(
      v_category,
      v_topic,
      v_count::smallint,
      v_sort
    );
  end loop;

  for v_category in
    select id from public.attestation_categories where is_active is true
  loop
    select coalesce(sum(question_count),0)
    into v_total
    from public.attestation_ticket_plan
    where category_id = v_category;

    if v_total <> p_questions_per_test then
      raise exception 'attestation_ticket_total_invalid:%:%',
        v_category, v_total;
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
      questions_per_test = p_questions_per_test,
      revision = revision + 1,
      updated_at = clock_timestamp(),
      updated_by = v_actor
  where singleton is true
  returning * into v_current;

  return jsonb_build_object(
    'passPercent', v_current.pass_percent,
    'questionsPerTest', v_current.questions_per_test,
    'revision', v_current.revision
  );
end;
$$;

create or replace function public.save_attestation_category(
  p_document jsonb,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id text := nullif(btrim(coalesce(p_document->>'id','')), '');
  v_label text := btrim(coalesce(p_document->>'label',''));
  v_sort integer;
  v_old public.attestation_categories%rowtype;
  v_new public.attestation_categories%rowtype;
begin
  if not private.attestation_is_admin() then
    raise exception 'forbidden';
  end if;

  if length(v_label) < 1 or length(v_label) > 80 then
    raise exception 'attestation_category_label_invalid';
  end if;

  if exists(
    select 1
    from public.attestation_categories c
    where lower(btrim(c.label)) = lower(v_label)
      and (v_id is null or c.id <> v_id)
  ) then
    raise exception 'attestation_category_label_duplicate';
  end if;

  begin
    v_sort := nullif(btrim(coalesce(p_document->>'sortOrder','')), '')::integer;
  exception when others then
    raise exception 'attestation_category_sort_invalid';
  end;

  if v_sort is not null and (v_sort < 0 or v_sort > 1000000) then
    raise exception 'attestation_category_sort_invalid';
  end if;

  if v_id is null then
    v_id := 'custom-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

    if v_sort is null then
      select coalesce(max(sort_order), 0) + 10
      into v_sort
      from public.attestation_categories;
    end if;

    insert into public.attestation_categories(
      id, label, sort_order, is_active, updated_by
    )
    values(
      v_id, v_label, v_sort, false, v_actor
    )
    returning * into v_new;
  else
    select * into v_old
    from public.attestation_categories
    where id = v_id
    for update;

    if v_old.id is null then
      raise exception 'attestation_category_not_found';
    end if;

    if p_expected_updated_at is null
       or v_old.updated_at is distinct from p_expected_updated_at then
      raise exception 'attestation_category_revision_conflict';
    end if;

    update public.attestation_categories
    set label = v_label,
        sort_order = coalesce(v_sort, sort_order),
        updated_at = clock_timestamp(),
        updated_by = v_actor
    where id = v_id
    returning * into v_new;
  end if;

  update public.attestation_settings
  set revision = revision + 1,
      updated_at = clock_timestamp(),
      updated_by = v_actor
  where singleton is true;

  return private.attestation_category_snapshot(v_new);
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
  v_questions_per_test integer;
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
    select questions_per_test
    into v_questions_per_test
    from public.attestation_settings
    where singleton is true;

    select coalesce(sum(question_count),0)
    into v_total
    from public.attestation_ticket_plan
    where category_id = p_category_id;

    if v_total <> v_questions_per_test then
      raise exception 'attestation_category_not_ready:ticket_total:%:%',
        v_total, v_questions_per_test;
    end if;

    -- Validate with the category temporarily considered active by performing
    -- the equivalent capacity check inline.
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

revoke all on function public.save_attestation_settings(smallint,smallint,jsonb) from public, anon, authenticated;
revoke all on function public.save_attestation_editor_settings(smallint,smallint,jsonb,bigint) from public, anon, authenticated;
revoke all on function public.save_attestation_category(jsonb,timestamptz) from public, anon, authenticated;
revoke all on function public.set_attestation_category_status(text,boolean,timestamptz) from public, anon, authenticated;

grant execute on function public.save_attestation_settings(smallint,smallint,jsonb) to service_role;
grant execute on function public.save_attestation_editor_settings(smallint,smallint,jsonb,bigint) to authenticated, service_role;
grant execute on function public.save_attestation_category(jsonb,timestamptz) to authenticated, service_role;
grant execute on function public.set_attestation_category_status(text,boolean,timestamptz) to authenticated, service_role;
