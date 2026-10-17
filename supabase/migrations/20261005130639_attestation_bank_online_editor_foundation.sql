-- BFStaff r40.6
-- Online attestation bank/editor foundation.
-- Reconstructed from the applied production schema because the original
-- 20261005130639 migration was applied live but was not preserved in Git.
-- Question content itself is intentionally seeded outside source control.
-- Production already has this migration applied. DO NOT RE-RUN MANUALLY.

create table if not exists public.attestation_settings (
  singleton boolean primary key default true check (singleton),
  pass_percent smallint not null default 80 check (pass_percent between 50 and 100),
  questions_per_test smallint not null default 15 check (questions_per_test between 1 and 50),
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.attestation_categories (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]{1,31}$'),
  label text not null check (length(btrim(label)) between 1 and 80),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.attestation_questions (
  id text primary key check (length(id) between 1 and 96),
  category_id text not null references public.attestation_categories(id) on delete restrict,
  question_text text not null check (length(btrim(question_text)) between 1 and 1000),
  answers jsonb not null check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) = 4),
  topic text not null check (length(btrim(topic)) between 1 and 120),
  group_key text not null check (length(btrim(group_key)) between 1 and 160),
  source text,
  source_ref text,
  review_url text,
  review_label text,
  review_note text,
  status text not null default 'active'
    check (status in ('active','archive','deleted')),
  sort_order integer not null default 0,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.attestation_ticket_plan (
  category_id text not null references public.attestation_categories(id) on delete cascade,
  topic text not null check (length(btrim(topic)) between 1 and 120),
  question_count smallint not null check (question_count between 1 and 50),
  sort_order integer not null default 0,
  primary key (category_id, topic)
);

create table if not exists public.attestation_question_versions (
  question_id text not null,
  revision bigint not null,
  snapshot jsonb not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references public.profiles(id) on delete set null,
  primary key (question_id, revision)
);

create index if not exists attestation_questions_active_category_topic_idx
  on public.attestation_questions(category_id, topic, group_key, sort_order)
  where status = 'active';

create index if not exists attestation_questions_editor_idx
  on public.attestation_questions(category_id, status, updated_at desc);

create index if not exists attestation_question_versions_changed_idx
  on public.attestation_question_versions(changed_at desc);

alter table public.quiz_attempts
  add column if not exists client_attempt_id uuid,
  add column if not exists question_revisions jsonb not null default '[]'::jsonb,
  add column if not exists synced_from_offline boolean not null default false;

create unique index if not exists quiz_attempts_user_client_attempt_uidx
  on public.quiz_attempts(user_id, client_attempt_id)
  where client_attempt_id is not null;

create index if not exists quiz_attempts_category_created_idx
  on public.quiz_attempts(category_id, created_at desc);

alter table public.attestation_settings enable row level security;
alter table public.attestation_categories enable row level security;
alter table public.attestation_questions enable row level security;
alter table public.attestation_ticket_plan enable row level security;
alter table public.attestation_question_versions enable row level security;

revoke all on table public.attestation_settings from public, anon, authenticated;
revoke all on table public.attestation_categories from public, anon, authenticated;
revoke all on table public.attestation_questions from public, anon, authenticated;
revoke all on table public.attestation_ticket_plan from public, anon, authenticated;
revoke all on table public.attestation_question_versions from public, anon, authenticated;

insert into public.attestation_settings(singleton, pass_percent, questions_per_test)
values(true, 80, 15)
on conflict (singleton) do nothing;

insert into public.attestation_categories(id,label,sort_order,is_active)
values
  ('bar','Бар',10,true),
  ('kitchen','Кухня',20,true),
  ('wine','Вино',30,true),
  ('service','Сервис',40,true)
on conflict (id) do update
set label=excluded.label,
    sort_order=excluded.sort_order,
    is_active=excluded.is_active,
    updated_at=clock_timestamp();

insert into public.attestation_ticket_plan(category_id,topic,question_count,sort_order)
values
  ('bar','Чаи',3,10),
  ('bar','Безалкогольные напитки',3,20),
  ('bar','Коктейли',4,30),
  ('bar','Настойки',3,40),
  ('bar','Крепкий алкоголь',2,50),
  ('kitchen','Холодные закуски',2,10),
  ('kitchen','Горячие закуски',2,20),
  ('kitchen','Салаты',2,30),
  ('kitchen','Супы',1,40),
  ('kitchen','Горячие блюда',4,50),
  ('kitchen','Гарниры',1,60),
  ('kitchen','Десерты',1,70),
  ('kitchen','Соусы',2,80),
  ('service','Встреча и заказ',2,10),
  ('service','Подача',2,20),
  ('service','Обратная связь и завершение',2,30),
  ('service','Рекомендации и продажи',2,40),
  ('service','Речь',2,50),
  ('service','Поведение в зале',1,60),
  ('service','Жалобы',2,70),
  ('service','Общение с гостями',2,80),
  ('wine','Основы',6,10),
  ('wine','Игристые',3,20),
  ('wine','Розовые и оранжевые',1,30),
  ('wine','Белые',2,40),
  ('wine','Красные',2,50),
  ('wine','Безалкогольное вино',1,60)
on conflict (category_id,topic) do update
set question_count=excluded.question_count,
    sort_order=excluded.sort_order;

create or replace function private.attestation_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and (p.is_owner is true or p.role = 'admin'::public.staff_role)
  );
$$;

create or replace function private.attestation_validate_answers(p_answers jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    jsonb_typeof(p_answers) = 'array'
    and jsonb_array_length(p_answers) = 4
    and (
      select count(*)
      from jsonb_array_elements(p_answers) item
      where jsonb_typeof(item) = 'object'
        and jsonb_typeof(item->'text') = 'string'
        and length(btrim(item->>'text')) between 1 and 500
        and jsonb_typeof(item->'correct') = 'boolean'
    ) = 4
    and (
      select count(*)
      from jsonb_array_elements(p_answers) item
      where (item->>'correct')::boolean is true
    ) = 1
    and (
      select count(distinct lower(btrim(item->>'text')))
      from jsonb_array_elements(p_answers) item
    ) = 4;
$$;

create or replace function private.attestation_question_snapshot(
  p_question public.attestation_questions
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id',p_question.id,
    'categoryId',p_question.category_id,
    'q',p_question.question_text,
    'answers',p_question.answers,
    'topic',p_question.topic,
    'group',p_question.group_key,
    'source',p_question.source,
    'sourceRef',p_question.source_ref,
    'reviewUrl',p_question.review_url,
    'reviewLabel',p_question.review_label,
    'reviewNote',p_question.review_note,
    'status',p_question.status,
    'sortOrder',p_question.sort_order,
    'revision',p_question.revision
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
  select question_count into v_required
  from public.attestation_ticket_plan
  where category_id=p_category_id and topic=p_topic;

  if v_required is null then return; end if;

  select count(distinct group_key) into v_available
  from public.attestation_questions
  where category_id=p_category_id and topic=p_topic and status='active';

  if v_available < v_required then
    raise exception 'attestation_ticket_capacity:%:%:%',
      p_category_id,p_topic,v_required;
  end if;
end;
$$;

create or replace function private.capture_attestation_question_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='UPDATE' and new.revision > old.revision then
    insert into public.attestation_question_versions(
      question_id,revision,snapshot,changed_at,changed_by
    )
    values(
      old.id,old.revision,private.attestation_question_snapshot(old),
      clock_timestamp(),coalesce(new.updated_by,auth.uid())
    )
    on conflict (question_id,revision) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists attestation_question_version_capture
  on public.attestation_questions;

create trigger attestation_question_version_capture
before update on public.attestation_questions
for each row
execute function private.capture_attestation_question_version();

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
    select 1 from public.profiles p
    where p.id=auth.uid() and p.is_active is true
  ) then raise exception 'forbidden'; end if;

  select * into v_settings
  from public.attestation_settings where singleton is true;

  return jsonb_build_object(
    'passPercent',v_settings.pass_percent,
    'questionsPerTest',v_settings.questions_per_test,
    'revision',v_settings.revision,
    'generatedAt',clock_timestamp(),
    'categories',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,
        'label',c.label,
        'questions',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',q.id,'q',q.question_text,'answers',q.answers,
            'source',q.source,'sourceRef',q.source_ref,'group',q.group_key,
            'reviewUrl',q.review_url,'reviewLabel',q.review_label,
            'topic',q.topic,'reviewNote',q.review_note,'revision',q.revision
          ) order by q.sort_order,q.id)
          from public.attestation_questions q
          where q.category_id=c.id and q.status='active'
        ),'[]'::jsonb),
        'ticketPlan',coalesce((
          select jsonb_agg(jsonb_build_object(
            'topic',p.topic,'count',p.question_count
          ) order by p.sort_order,p.topic)
          from public.attestation_ticket_plan p
          where p.category_id=c.id
        ),'[]'::jsonb)
      ) order by c.sort_order,c.id)
      from public.attestation_categories c
      where c.is_active is true
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_attestation_editor_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_allowed boolean;
begin
  v_allowed := private.attestation_is_admin();
  return jsonb_build_object(
    'can_read',v_allowed,
    'can_create',v_allowed,
    'can_edit',v_allowed,
    'can_archive',v_allowed,
    'can_delete',v_allowed,
    'can_manage_settings',v_allowed
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
  from public.attestation_settings where singleton is true;

  return jsonb_build_object(
    'settings',jsonb_build_object(
      'passPercent',v_settings.pass_percent,
      'questionsPerTest',v_settings.questions_per_test,
      'revision',v_settings.revision
    ),
    'categories',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'label',c.label,'sortOrder',c.sort_order,'active',c.is_active,
        'ticketPlan',coalesce((
          select jsonb_agg(jsonb_build_object(
            'topic',p.topic,'count',p.question_count,'sortOrder',p.sort_order
          ) order by p.sort_order,p.topic)
          from public.attestation_ticket_plan p
          where p.category_id=c.id
        ),'[]'::jsonb)
      ) order by c.sort_order,c.id)
      from public.attestation_categories c
    ),'[]'::jsonb),
    'questions',coalesce((
      select jsonb_agg(
        private.attestation_question_snapshot(q)
        || jsonb_build_object(
          'createdAt',q.created_at,'updatedAt',q.updated_at,
          'createdBy',q.created_by,'updatedBy',q.updated_by
        )
        order by q.category_id,q.sort_order,q.id
      )
      from public.attestation_questions q
      where p_include_deleted is true or q.status <> 'deleted'
    ),'[]'::jsonb)
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
  v_actor uuid:=auth.uid();
  v_id text:=nullif(btrim(coalesce(p_document->>'id','')),'');
  v_category text:=nullif(btrim(coalesce(p_document->>'categoryId','')),'');
  v_text text:=btrim(coalesce(p_document->>'q',''));
  v_topic text:=btrim(coalesce(p_document->>'topic',''));
  v_group text:=btrim(coalesce(p_document->>'group',''));
  v_answers jsonb:=p_document->'answers';
  v_old public.attestation_questions%rowtype;
  v_new public.attestation_questions%rowtype;
  v_sort integer;
begin
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;

  if v_category is null or not exists(
    select 1 from public.attestation_categories
    where id=v_category and is_active is true
  ) then raise exception 'attestation_category_invalid'; end if;

  if length(v_text)<1 or length(v_text)>1000 then
    raise exception 'attestation_question_invalid';
  end if;

  if length(v_topic)<1 or length(v_topic)>120 then
    raise exception 'attestation_topic_invalid';
  end if;

  if length(v_group)<1 or length(v_group)>160 then
    raise exception 'attestation_group_invalid';
  end if;

  if not private.attestation_validate_answers(v_answers) then
    raise exception 'attestation_answers_invalid';
  end if;

  if v_id is null then
    v_id:=v_category||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,16);
    select coalesce(max(sort_order),0)+10 into v_sort
    from public.attestation_questions where category_id=v_category;

    insert into public.attestation_questions(
      id,category_id,question_text,answers,topic,group_key,
      source,source_ref,review_url,review_label,review_note,
      status,sort_order,revision,created_by,updated_by
    )
    values(
      v_id,v_category,v_text,v_answers,v_topic,v_group,
      nullif(btrim(coalesce(p_document->>'source','')),''),
      nullif(btrim(coalesce(p_document->>'sourceRef','')),''),
      nullif(btrim(coalesce(p_document->>'reviewUrl','')),''),
      nullif(btrim(coalesce(p_document->>'reviewLabel','')),''),
      nullif(btrim(coalesce(p_document->>'reviewNote','')),''),
      'active',v_sort,1,v_actor,v_actor
    )
    returning * into v_new;
  else
    select * into v_old
    from public.attestation_questions where id=v_id for update;

    if v_old.id is null then raise exception 'attestation_question_not_found'; end if;
    if p_expected_revision is null or v_old.revision<>p_expected_revision then
      raise exception 'attestation_revision_conflict';
    end if;

    update public.attestation_questions
    set category_id=v_category,
        question_text=v_text,
        answers=v_answers,
        topic=v_topic,
        group_key=v_group,
        source=nullif(btrim(coalesce(p_document->>'source','')),''),
        source_ref=nullif(btrim(coalesce(p_document->>'sourceRef','')),''),
        review_url=nullif(btrim(coalesce(p_document->>'reviewUrl','')),''),
        review_label=nullif(btrim(coalesce(p_document->>'reviewLabel','')),''),
        review_note=nullif(btrim(coalesce(p_document->>'reviewNote','')),''),
        updated_at=clock_timestamp(),
        updated_by=v_actor,
        revision=revision+1
    where id=v_id
    returning * into v_new;

    perform private.attestation_assert_topic_capacity(v_old.category_id,v_old.topic);
  end if;

  update public.attestation_settings
  set revision=revision+1,
      updated_at=clock_timestamp(),
      updated_by=v_actor
  where singleton is true;

  return private.attestation_question_snapshot(v_new)
    || jsonb_build_object('createdAt',v_new.created_at,'updatedAt',v_new.updated_at);
end;
$$;

create or replace function public.set_attestation_question_status(
  p_question_id text,
  p_status text,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=auth.uid();
  v_old public.attestation_questions%rowtype;
  v_new public.attestation_questions%rowtype;
begin
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('active','archive','deleted') then
    raise exception 'attestation_status_invalid';
  end if;

  select * into v_old
  from public.attestation_questions
  where id=p_question_id
  for update;

  if v_old.id is null then raise exception 'attestation_question_not_found'; end if;
  if p_expected_revision is null or v_old.revision<>p_expected_revision then
    raise exception 'attestation_revision_conflict';
  end if;

  update public.attestation_questions
  set status=p_status,
      revision=revision+1,
      updated_at=clock_timestamp(),
      updated_by=v_actor
  where id=p_question_id
  returning * into v_new;

  if p_status<>'active' then
    perform private.attestation_assert_topic_capacity(v_old.category_id,v_old.topic);
  end if;

  update public.attestation_settings
  set revision=revision+1,
      updated_at=clock_timestamp(),
      updated_by=v_actor
  where singleton is true;

  return private.attestation_question_snapshot(v_new);
end;
$$;

create or replace function public.save_attestation_settings(
  p_pass_percent smallint,
  p_questions_per_test smallint,
  p_ticket_plan jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=auth.uid();
  v_item jsonb;
  v_category text;
  v_total integer;
begin
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;
  if p_pass_percent<50 or p_pass_percent>100 then
    raise exception 'attestation_pass_percent_invalid';
  end if;
  if p_questions_per_test<1 or p_questions_per_test>50 then
    raise exception 'attestation_question_count_invalid';
  end if;
  if jsonb_typeof(p_ticket_plan)<>'array' then
    raise exception 'attestation_ticket_plan_invalid';
  end if;

  delete from public.attestation_ticket_plan;

  for v_item in select value from jsonb_array_elements(p_ticket_plan)
  loop
    v_category:=nullif(btrim(coalesce(v_item->>'categoryId','')),'');
    if v_category is null
       or not exists(select 1 from public.attestation_categories where id=v_category)
       or nullif(btrim(coalesce(v_item->>'topic','')),'') is null
       or coalesce((v_item->>'count')::integer,0)<1
    then raise exception 'attestation_ticket_plan_invalid'; end if;

    insert into public.attestation_ticket_plan(
      category_id,topic,question_count,sort_order
    )
    values(
      v_category,btrim(v_item->>'topic'),
      (v_item->>'count')::smallint,
      coalesce((v_item->>'sortOrder')::integer,0)
    );
  end loop;

  for v_category in
    select id from public.attestation_categories where is_active is true
  loop
    select coalesce(sum(question_count),0) into v_total
    from public.attestation_ticket_plan where category_id=v_category;

    if v_total<>p_questions_per_test then
      raise exception 'attestation_ticket_total_invalid:%:%',v_category,v_total;
    end if;

    for v_item in
      select jsonb_build_object('topic',topic)
      from public.attestation_ticket_plan
      where category_id=v_category
    loop
      perform private.attestation_assert_topic_capacity(v_category,v_item->>'topic');
    end loop;
  end loop;

  update public.attestation_settings
  set pass_percent=p_pass_percent,
      questions_per_test=p_questions_per_test,
      revision=revision+1,
      updated_at=clock_timestamp(),
      updated_by=v_actor
  where singleton is true;

  return public.get_attestation_editor_bank(false)->'settings';
end;
$$;

revoke all on function private.attestation_is_admin() from public, anon, authenticated;
revoke all on function private.attestation_validate_answers(jsonb) from public, anon, authenticated;
revoke all on function private.attestation_question_snapshot(public.attestation_questions) from public, anon, authenticated;
revoke all on function private.attestation_assert_topic_capacity(text,text) from public, anon, authenticated;
revoke all on function private.capture_attestation_question_version() from public, anon, authenticated;

revoke all on function public.get_attestation_bank() from public, anon;
revoke all on function public.get_attestation_editor_context() from public, anon;
revoke all on function public.get_attestation_editor_bank(boolean) from public, anon;
revoke all on function public.save_attestation_question(jsonb,bigint) from public, anon;
revoke all on function public.set_attestation_question_status(text,text,bigint) from public, anon;
revoke all on function public.save_attestation_settings(smallint,smallint,jsonb) from public, anon;

grant execute on function public.get_attestation_bank() to authenticated;
grant execute on function public.get_attestation_editor_context() to authenticated;
grant execute on function public.get_attestation_editor_bank(boolean) to authenticated;
grant execute on function public.save_attestation_question(jsonb,bigint) to authenticated;
grant execute on function public.set_attestation_question_status(text,text,bigint) to authenticated;
grant execute on function public.save_attestation_settings(smallint,smallint,jsonb) to authenticated;
