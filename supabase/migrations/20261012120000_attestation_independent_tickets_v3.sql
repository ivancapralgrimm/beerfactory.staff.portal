-- BFStaff r40.6 independent ticket bank, additive v3 API.
-- REVIEW AND APPLY ONLY WITH EXPLICIT OWNER APPROVAL, AFTER BACKUP.
-- Do not edit/remove older migrations. No profile/position/role changes.

alter table public.attestation_categories
  add column if not exists knowledge_type text,
  add column if not exists venue text not null default 'bf',
  add column if not exists specific_question_count smallint;
alter table public.attestation_questions
  add column if not exists knowledge_type text,
  add column if not exists venue text not null default 'bf';

-- Canonical existing categories are the only unambiguous mapping.
-- All other preexisting tickets keep their IDs, labels, plans and counts;
-- ambiguous ones remain drafts for explicit classification.
update public.attestation_categories
set knowledge_type=id
where id in ('bar','kitchen','wine','service') and knowledge_type is null;
update public.attestation_categories
set knowledge_type=case lower(btrim(label))
    when 'бар' then 'bar' when 'кухня' then 'kitchen'
    when 'вино' then 'wine' when 'сервис' then 'service' else null end
where knowledge_type is null and lower(btrim(label)) in ('бар','кухня','вино','сервис');

-- Backfill legacy category ownership exactly once; no text heuristics.
update public.attestation_questions q
set knowledge_type=c.knowledge_type
from public.attestation_categories c
where q.category_id=c.id and q.knowledge_type is null and c.knowledge_type is not null;

-- Unclassifiable existing categories never become live by accident.
update public.attestation_categories
set is_active=false, updated_at=clock_timestamp()
where knowledge_type is null and is_active is true;

alter table public.attestation_categories
  add constraint attestation_ticket_v3_knowledge_chk
    check (knowledge_type is null or knowledge_type in ('bar','kitchen','wine','service')),
  add constraint attestation_ticket_v3_venue_chk
    check (venue in ('bf','bb','common')),
  add constraint attestation_ticket_v3_specific_chk
    check (specific_question_count is null or specific_question_count between 0 and 50);
alter table public.attestation_questions
  add constraint attestation_question_v3_knowledge_chk
    check (knowledge_type is null or knowledge_type in ('bar','kitchen','wine','service')),
  add constraint attestation_question_v3_venue_chk
    check (venue in ('bf','bb','common'));
create index if not exists attestation_questions_v3_pool_idx
  on public.attestation_questions (knowledge_type,venue,topic,group_key)
  where status='active';

-- Preserve venue/type in *historical question revision snapshots* as well.
-- The existing capture_attestation_question_version trigger calls this helper.
create or replace function private.attestation_question_snapshot(p_question public.attestation_questions)
returns jsonb language sql stable set search_path='' as $$
select jsonb_build_object(
  'id',p_question.id,'categoryId',p_question.category_id,'knowledgeType',p_question.knowledge_type,
  'venue',p_question.venue,'q',p_question.question_text,'answers',p_question.answers,
  'topic',p_question.topic,'subcategory',p_question.subcategory,'group',p_question.group_key,
  'source',p_question.source,'sourceRef',p_question.source_ref,
  'reviewUrl',p_question.review_url,'reviewLabel',p_question.review_label,'reviewNote',p_question.review_note,
  'status',p_question.status,'sortOrder',p_question.sort_order,'revision',p_question.revision
);
$$;

create or replace function private.attestation_v3_ticket_snapshot(c public.attestation_categories)
returns jsonb language sql stable set search_path='' as $$
select jsonb_build_object(
  'id',c.id,'label',c.label,'sortOrder',c.sort_order,'active',c.is_active,
  'questionsPerTest',c.questions_per_test,'knowledgeType',c.knowledge_type,
  'venue',c.venue,'specificQuestionCount',c.specific_question_count,
  'createdAt',c.created_at,'updatedAt',c.updated_at,
  'ticketPlan',coalesce((select jsonb_agg(jsonb_build_object(
    'topic',p.topic,'count',p.question_count,'sortOrder',p.sort_order)
    order by p.sort_order,p.topic)
    from public.attestation_ticket_plan p where p.category_id=c.id),'[]'::jsonb)
);
$$;

create or replace function private.attestation_v3_question_snapshot(q public.attestation_questions)
returns jsonb language sql stable set search_path='' as $$
select private.attestation_question_snapshot(q) || jsonb_build_object(
  'knowledgeType',q.knowledge_type,'venue',q.venue,
  'subcategory',q.subcategory
);
$$;

-- SECURITY DEFINER is permitted only for authenticated staff; admin editing is
-- explicitly checked in every write. No table grants or RLS policies added.
create or replace function public.get_attestation_bank_v3()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_settings public.attestation_settings%rowtype;
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active is true) then
    raise exception 'forbidden';
  end if;
  select * into v_settings from public.attestation_settings where singleton=true;
  return jsonb_build_object(
    'schemaVersion',3,'passPercent',v_settings.pass_percent,
    'questionsPerTest',v_settings.questions_per_test,'revision',v_settings.revision,
    'generatedAt',clock_timestamp(),
    'categories',coalesce((select jsonb_agg(
      jsonb_build_object(
        'id',c.id,'label',c.label,'questionsPerTest',c.questions_per_test,
        'knowledgeType',c.knowledge_type,'venue',c.venue,
        'specificQuestionCount',c.specific_question_count,
        'questions',coalesce((select jsonb_agg(
           jsonb_build_object('id',q.id,'q',q.question_text,'answers',q.answers,
           'source',q.source,'sourceRef',q.source_ref,'group',q.group_key,
           'reviewUrl',q.review_url,'reviewLabel',q.review_label,
           'topic',q.topic,'subcategory',q.subcategory,'reviewNote',q.review_note,
           'revision',q.revision,'knowledgeType',q.knowledge_type,'venue',q.venue)
           order by q.sort_order,q.id)
         from public.attestation_questions q
         where q.status='active' and q.knowledge_type=c.knowledge_type
           and (q.venue='common' or q.venue=c.venue and c.venue<>'common')),'[]'::jsonb),
        'ticketPlan',coalesce((select jsonb_agg(jsonb_build_object(
          'topic',p.topic,'count',p.question_count) order by p.sort_order,p.topic)
          from public.attestation_ticket_plan p where p.category_id=c.id),'[]'::jsonb)
      ) order by c.sort_order,c.id)
      from public.attestation_categories c
      where c.is_active=true and c.knowledge_type is not null),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_attestation_editor_bank_v3(p_include_deleted boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_settings public.attestation_settings%rowtype;
begin
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;
  select * into v_settings from public.attestation_settings where singleton=true;
  return jsonb_build_object(
    'schemaVersion',3,
    'settings',jsonb_build_object('passPercent',v_settings.pass_percent,
      'questionsPerTest',v_settings.questions_per_test,'revision',v_settings.revision),
    'categories',coalesce((select jsonb_agg(private.attestation_v3_ticket_snapshot(c)
      order by c.sort_order,c.id) from public.attestation_categories c),'[]'::jsonb),
    'questions',coalesce((select jsonb_agg(
      private.attestation_v3_question_snapshot(q) || jsonb_build_object(
        'createdAt',q.created_at,'updatedAt',q.updated_at,
        'createdBy',q.created_by,'updatedBy',q.updated_by)
      order by q.category_id,q.sort_order,q.id)
      from public.attestation_questions q
      where p_include_deleted=true or q.status<>'deleted'),'[]'::jsonb)
  );
end;
$$;

-- Server-side quota and capacity guard. For ordinary topics, count independent
-- source groups in the *shared pool*, never in the source category.
create or replace function private.attestation_v3_assert_ticket(p_id text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.attestation_categories%rowtype;
        v_total integer; v_available integer; v_specific integer; v_common integer;
        v_part record; v_min_specific integer:=0; v_max_specific integer:=0;
        v_topic_specific integer; v_topic_common integer;
begin
  select * into c from public.attestation_categories where id=p_id;
  if c.id is null or c.is_active=false then return; end if;
  if c.knowledge_type is null then raise exception 'attestation_ticket_type_required:%',p_id; end if;
  -- Shared group keys across planned sections make quotas ambiguous.
  -- Existing BF questions already have one topic per group.
  if exists(
    select q.group_key
    from public.attestation_questions q
    join public.attestation_ticket_plan p on p.category_id=p_id and p.topic=q.topic
    where q.status='active' and q.knowledge_type=c.knowledge_type
      and (q.venue='common' or (q.venue=c.venue and c.venue<>'common'))
    group by q.group_key having count(distinct q.topic)>1
  ) then
    raise exception 'attestation_ticket_group_cross_topic:%',p_id;
  end if;
  select coalesce(sum(question_count),0) into v_total
    from public.attestation_ticket_plan where category_id=p_id;
  if v_total<>c.questions_per_test then
    raise exception 'attestation_ticket_total_invalid:%',p_id;
  end if;
  for v_part in select topic,question_count from public.attestation_ticket_plan where category_id=p_id loop
    select count(distinct q.group_key) into v_available
    from public.attestation_questions q
    where q.status='active' and q.knowledge_type=c.knowledge_type
      and q.topic=v_part.topic
      and (q.venue='common' or (q.venue=c.venue and c.venue<>'common'));
    if v_available<v_part.question_count then
      raise exception 'attestation_ticket_capacity:%:%',p_id,v_part.topic;
    end if;
    if c.specific_question_count is not null then
      select count(distinct q.group_key) into v_topic_specific
      from public.attestation_questions q
      where q.status='active' and q.knowledge_type=c.knowledge_type
        and q.topic=v_part.topic and q.venue=c.venue and c.venue<>'common';
      select count(distinct q.group_key) into v_topic_common
      from public.attestation_questions q
      where q.status='active' and q.knowledge_type=c.knowledge_type
        and q.topic=v_part.topic and q.venue='common';
      v_min_specific:=v_min_specific+greatest(0,v_part.question_count-v_topic_common);
      v_max_specific:=v_max_specific+least(v_part.question_count,v_topic_specific);
    end if;
  end loop;
  select count(distinct q.group_key) into v_available
  from public.attestation_questions q join public.attestation_ticket_plan p
    on p.category_id=p_id and p.topic=q.topic
  where q.status='active' and q.knowledge_type=c.knowledge_type
    and (q.venue='common' or (q.venue=c.venue and c.venue<>'common'));
  if v_available<c.questions_per_test then
    raise exception 'attestation_ticket_capacity:%:groups',p_id;
  end if;
  if c.specific_question_count is not null then
    if c.venue='common' and c.specific_question_count<>0 then
      raise exception 'attestation_ticket_quota_invalid:%',p_id;
    end if;
    if c.specific_question_count>c.questions_per_test then
      raise exception 'attestation_ticket_quota_invalid:%',p_id;
    end if;
    select count(distinct q.group_key) into v_specific
    from public.attestation_questions q join public.attestation_ticket_plan p
       on p.category_id=p_id and p.topic=q.topic
    where q.status='active' and q.knowledge_type=c.knowledge_type
       and q.venue=c.venue and c.venue<>'common';
    select count(distinct q.group_key) into v_common
    from public.attestation_questions q join public.attestation_ticket_plan p
       on p.category_id=p_id and p.topic=q.topic
    where q.status='active' and q.knowledge_type=c.knowledge_type and q.venue='common';
    if c.specific_question_count<v_min_specific or
       c.specific_question_count>v_max_specific or
       v_specific<c.specific_question_count or
       v_common<c.questions_per_test-c.specific_question_count then
      raise exception 'attestation_ticket_quota_capacity:%',p_id;
    end if;
  end if;
end;
$$;

create or replace function private.attestation_v3_assert_all()
returns void language plpgsql security definer set search_path='' as $$
declare v_id text;
begin
  for v_id in select id from public.attestation_categories where is_active=true loop
    perform private.attestation_v3_assert_ticket(v_id);
  end loop;
end;
$$;

-- Deferred integrity guards also protect the database from an older cached
-- admin client still using legacy write RPCs during a phased deployment.
-- Run after the whole transaction, including legacy DELETE + INSERT ticket plan.
create or replace function private.attestation_v3_write_integrity_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.attestation_v3_assert_all();
  return null;
end;
$$;

create constraint trigger attestation_v3_guard_questions
  after insert or update or delete on public.attestation_questions
  deferrable initially deferred for each row
  execute function private.attestation_v3_write_integrity_trigger();
create constraint trigger attestation_v3_guard_tickets
  after insert or update or delete on public.attestation_categories
  deferrable initially deferred for each row
  execute function private.attestation_v3_write_integrity_trigger();
create constraint trigger attestation_v3_guard_ticket_plan
  after insert or update or delete on public.attestation_ticket_plan
  deferrable initially deferred for each row
  execute function private.attestation_v3_write_integrity_trigger();

-- New RPC avoids breaking old cached clients during phased rollout.
create or replace function public.save_attestation_question_v3(
  p_document jsonb,p_expected_revision bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id text:=nullif(btrim(coalesce(p_document->>'id','')),'');
        v_category text:=nullif(btrim(coalesce(p_document->>'categoryId','')),'');
        v_text text:=btrim(coalesce(p_document->>'q',''));
        v_topic text:=btrim(coalesce(p_document->>'topic',''));
        v_subcategory text:=nullif(btrim(coalesce(p_document->>'subcategory','')),'');
        v_group text:=btrim(coalesce(p_document->>'group',''));
        v_type text:=p_document->>'knowledgeType';
        v_venue text:=coalesce(p_document->>'venue','bf');
        v_answers jsonb:=p_document->'answers';
        v_old public.attestation_questions%rowtype;
        v_new public.attestation_questions%rowtype;
        v_sort integer;
begin
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_document) is distinct from 'object' then raise exception 'attestation_document_invalid'; end if;
  if v_type is null or v_type not in ('bar','kitchen','wine','service') then
    raise exception 'attestation_knowledge_type_invalid'; end if;
  if v_venue is null or v_venue not in ('bf','bb','common') then raise exception 'attestation_venue_invalid'; end if;
  if not exists(select 1 from public.attestation_categories where id=v_category)
    then raise exception 'attestation_category_invalid'; end if;
  if length(v_text) not between 1 and 1000 then raise exception 'attestation_question_invalid'; end if;
  if length(v_topic) not between 1 and 120 then raise exception 'attestation_topic_invalid'; end if;
  if v_subcategory is not null and length(v_subcategory)>120 then raise exception 'attestation_subcategory_invalid'; end if;
  if length(v_group) not between 1 and 160 then raise exception 'attestation_group_invalid'; end if;
  if private.attestation_validate_answers(v_answers) is not true then raise exception 'attestation_answers_invalid'; end if;
  -- Serialize write against other admin ticket mutations.
  perform 1 from public.attestation_settings where singleton=true for update;
  if v_id is null then
    v_id:=v_category||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,16);
    select coalesce(max(sort_order),0)+10 into v_sort from public.attestation_questions where category_id=v_category;
    insert into public.attestation_questions(
      id,category_id,knowledge_type,venue,question_text,answers,topic,
      subcategory,group_key,source,source_ref,review_url,review_label,review_note,
      status,sort_order,revision,created_by,updated_by)
    values(v_id,v_category,v_type,v_venue,v_text,v_answers,v_topic,v_subcategory,v_group,
      nullif(btrim(coalesce(p_document->>'source','')),''),
      nullif(btrim(coalesce(p_document->>'sourceRef','')),''),
      nullif(btrim(coalesce(p_document->>'reviewUrl','')),''),
      nullif(btrim(coalesce(p_document->>'reviewLabel','')),''),
      nullif(btrim(coalesce(p_document->>'reviewNote','')),''),
      'active',v_sort,1,v_actor,v_actor) returning * into v_new;
  else
    select * into v_old from public.attestation_questions where id=v_id for update;
    if v_old.id is null then raise exception 'attestation_question_not_found'; end if;
    if p_expected_revision is null or v_old.revision<>p_expected_revision
      then raise exception 'attestation_revision_conflict'; end if;
    update public.attestation_questions set
      category_id=v_category,knowledge_type=v_type,venue=v_venue,
      question_text=v_text,answers=v_answers,topic=v_topic,
      subcategory=v_subcategory,group_key=v_group,
      source=nullif(btrim(coalesce(p_document->>'source','')),''),
      source_ref=nullif(btrim(coalesce(p_document->>'sourceRef','')),''),
      review_url=nullif(btrim(coalesce(p_document->>'reviewUrl','')),''),
      review_label=nullif(btrim(coalesce(p_document->>'reviewLabel','')),''),
      review_note=nullif(btrim(coalesce(p_document->>'reviewNote','')),''),
      updated_at=clock_timestamp(),updated_by=v_actor,revision=revision+1
    where id=v_id returning * into v_new;
  end if;
  perform private.attestation_v3_assert_all();
  update public.attestation_settings set revision=revision+1,
    updated_at=clock_timestamp(),updated_by=v_actor where singleton=true;
  return private.attestation_v3_question_snapshot(v_new)
    ||jsonb_build_object('createdAt',v_new.created_at,'updatedAt',v_new.updated_at);
end;
$$;

create or replace function public.set_attestation_question_status_v3(
 p_question_id text,p_status text,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_old public.attestation_questions%rowtype;
        v_new public.attestation_questions%rowtype;
begin
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;
  if p_status is null or p_status not in ('active','archive','deleted') then raise exception 'attestation_status_invalid'; end if;
  perform 1 from public.attestation_settings where singleton=true for update;
  select * into v_old from public.attestation_questions where id=p_question_id for update;
  if v_old.id is null then raise exception 'attestation_question_not_found'; end if;
  if p_expected_revision is null or v_old.revision<>p_expected_revision
    then raise exception 'attestation_revision_conflict'; end if;
  update public.attestation_questions set status=p_status,
    revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid()
    where id=p_question_id returning * into v_new;
  perform private.attestation_v3_assert_all();
  update public.attestation_settings set revision=revision+1,
    updated_at=clock_timestamp(),updated_by=auth.uid() where singleton=true;
  return private.attestation_v3_question_snapshot(v_new);
end;
$$;

create or replace function public.save_attestation_category_v3(
  p_document jsonb,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_id text; v_type text; v_venue text;
        v_old public.attestation_categories%rowtype;
        v_new public.attestation_categories%rowtype;
begin
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_document) is distinct from 'object' then raise exception 'attestation_document_invalid'; end if;
  perform 1 from public.attestation_settings where singleton=true for update;
  v_id:=nullif(btrim(coalesce(p_document->>'id','')),'');
  if v_id is not null then
    select * into v_old from public.attestation_categories where id=v_id for update;
    if v_old.id is null then raise exception 'attestation_category_not_found'; end if;
  end if;
  -- A rename must not reset venue, type or the draft classification.
  v_type:=case when p_document ? 'knowledgeType' then nullif(p_document->>'knowledgeType','')
    when v_id is null then 'bar' else v_old.knowledge_type end;
  v_venue:=case when p_document ? 'venue' then p_document->>'venue'
    when v_id is null then 'bf' else v_old.venue end;
  if v_type is not null and v_type not in ('bar','kitchen','wine','service') then raise exception 'attestation_knowledge_type_invalid'; end if;
  if v_venue is null or v_venue not in ('bf','bb','common') then raise exception 'attestation_venue_invalid'; end if;
  v_result:=public.save_attestation_category(p_document,p_expected_updated_at);
  v_id:=v_result->>'id';
  update public.attestation_categories set knowledge_type=v_type,venue=v_venue,
    updated_at=clock_timestamp(),updated_by=auth.uid() where id=v_id returning * into v_new;
  perform private.attestation_v3_assert_all();
  return private.attestation_v3_ticket_snapshot(v_new);
end;
$$;

create or replace function public.set_attestation_category_status_v3(
 p_category_id text,p_is_active boolean,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_old public.attestation_categories%rowtype;
        v_new public.attestation_categories%rowtype;
begin
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;
  perform 1 from public.attestation_settings where singleton=true for update;
  select * into v_old from public.attestation_categories where id=p_category_id for update;
  if v_old.id is null then raise exception 'attestation_category_not_found'; end if;
  if p_is_active is null then raise exception 'attestation_category_status_invalid'; end if;
  if p_expected_updated_at is null or v_old.updated_at is distinct from p_expected_updated_at
    then raise exception 'attestation_category_revision_conflict'; end if;
  if v_old.is_active=p_is_active then return private.attestation_v3_ticket_snapshot(v_old); end if;
  if p_is_active=false and (select count(*) from public.attestation_categories where is_active=true)<=1
    then raise exception 'attestation_last_category'; end if;
  if p_is_active=true and v_old.knowledge_type is null
    then raise exception 'attestation_ticket_type_required'; end if;
  update public.attestation_categories set is_active=p_is_active,
    updated_at=clock_timestamp(),updated_by=auth.uid()
    where id=p_category_id returning * into v_new;
  perform private.attestation_v3_assert_all();
  update public.attestation_settings set revision=revision+1,
    updated_at=clock_timestamp(),updated_by=auth.uid() where singleton=true;
  return private.attestation_v3_ticket_snapshot(v_new);
end;
$$;

create or replace function public.save_attestation_editor_settings_v3(
 p_pass_percent smallint,p_category_settings jsonb,p_ticket_plan jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_current public.attestation_settings%rowtype;
        v_item jsonb; v_category text; v_count integer; v_sort integer;
        v_specific integer; v_label text; v_type text; v_venue text;
begin
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;
  select * into v_current from public.attestation_settings where singleton=true for update;
  if p_expected_revision is null or v_current.revision<>p_expected_revision
    then raise exception 'attestation_settings_revision_conflict'; end if;
  if p_pass_percent is null or p_pass_percent not between 50 and 100
    then raise exception 'attestation_pass_percent_invalid'; end if;
  if jsonb_typeof(p_category_settings) is distinct from 'array' or jsonb_typeof(p_ticket_plan) is distinct from 'array'
    then raise exception 'attestation_settings_invalid'; end if;
  if jsonb_array_length(p_category_settings)<>(select count(*) from public.attestation_categories)
    then raise exception 'attestation_category_settings_incomplete'; end if;
  if exists(select 1 from jsonb_array_elements(p_category_settings) as x(value)
    group by btrim(x.value->>'categoryId') having count(*)>1) then
    raise exception 'attestation_category_settings_duplicate'; end if;
  if exists(select 1 from jsonb_array_elements(p_category_settings) as x(value)
    group by lower(btrim(x.value->>'label')) having count(*)>1) then
    raise exception 'attestation_category_label_duplicate'; end if;
  if exists(select 1 from jsonb_array_elements(p_ticket_plan) as x(value)
    group by btrim(x.value->>'categoryId'),lower(btrim(x.value->>'topic')) having count(*)>1)
    then raise exception 'attestation_ticket_plan_duplicate'; end if;
  for v_item in select value from jsonb_array_elements(p_category_settings) loop
    v_category:=nullif(btrim(coalesce(v_item->>'categoryId','')),'');
    v_label:=btrim(coalesce(v_item->>'label',''));
    v_type:=nullif(v_item->>'knowledgeType','');
    v_venue:=coalesce(v_item->>'venue','bf');
    begin
      v_count:=(v_item->>'questionsPerTest')::integer;
      v_specific:=nullif(v_item->>'specificQuestionCount','')::integer;
    exception when others then raise exception 'attestation_question_count_invalid'; end;
    if v_category is null or not exists(select 1 from public.attestation_categories where id=v_category)
      then raise exception 'attestation_category_not_found'; end if;
    if length(v_label) not between 1 and 80 then raise exception 'attestation_category_label_invalid'; end if;
    if v_count is null or v_count not between 1 and 50 then raise exception 'attestation_question_count_invalid'; end if;
    if (v_type is not null and v_type not in ('bar','kitchen','wine','service'))
       or v_venue is null or v_venue not in ('bf','bb','common') then raise exception 'attestation_ticket_type_invalid'; end if;
    if v_specific is not null and (v_specific<0 or v_specific>v_count or (v_venue='common' and v_specific<>0))
      then raise exception 'attestation_ticket_quota_invalid'; end if;
    update public.attestation_categories set
      label=v_label,questions_per_test=v_count::smallint,
      knowledge_type=v_type,venue=v_venue,specific_question_count=v_specific,
      updated_at=clock_timestamp(),updated_by=auth.uid()
      where id=v_category;
  end loop;
  delete from public.attestation_ticket_plan;
  for v_item in select value from jsonb_array_elements(p_ticket_plan) loop
    v_category:=nullif(btrim(coalesce(v_item->>'categoryId','')),'');
    begin
      v_count:=(v_item->>'count')::integer;
      v_sort:=coalesce((v_item->>'sortOrder')::integer,0);
    exception when others then raise exception 'attestation_ticket_plan_invalid'; end;
    if not exists(select 1 from public.attestation_categories where id=v_category)
       or length(btrim(coalesce(v_item->>'topic',''))) not between 1 and 120
       or v_count is null or v_count not between 1 and 50
       or v_sort<0 then raise exception 'attestation_ticket_plan_invalid'; end if;
    insert into public.attestation_ticket_plan(category_id,topic,question_count,sort_order)
      values(v_category,btrim(v_item->>'topic'),v_count::smallint,v_sort);
  end loop;
  perform private.attestation_v3_assert_all();
  update public.attestation_settings set pass_percent=p_pass_percent,
    revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid()
    where singleton=true returning * into v_current;
  return jsonb_build_object('passPercent',v_current.pass_percent,'revision',v_current.revision);
end;
$$;

-- Legacy mutation implementations are redefined here, not in older migrations.
-- Every writer acquires the same singleton lock before touching other rows.
-- Active ticket capacity is a property of the shared pool, not its source category.
create or replace function private.attestation_assert_topic_capacity(
  p_category_id text,p_topic text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.attestation_v3_assert_ticket(p_category_id);
end;
$$;

create or replace function public.save_attestation_question(
  p_document jsonb,p_expected_revision bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_id text:=nullif(btrim(coalesce(p_document->>'id','')),'');
  v_category text:=nullif(btrim(coalesce(p_document->>'categoryId','')),'');
  v_old public.attestation_questions%rowtype;
  v_source public.attestation_categories%rowtype;
  v_type text; v_venue text;
begin
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_document) is distinct from 'object' then raise exception 'attestation_document_invalid'; end if;
  perform 1 from public.attestation_settings where singleton=true for update;
  select * into v_source from public.attestation_categories where id=v_category;
  if v_source.id is null then raise exception 'attestation_category_invalid'; end if;
  if v_id is not null then
    select * into v_old from public.attestation_questions where id=v_id for update;
    if v_old.id is null then raise exception 'attestation_question_not_found'; end if;
  end if;
  -- Old clients use categoryId as the knowledge selector. A real move follows
  -- its target classification; a text edit preserves source metadata, including
  -- common applicability and a source whose category was subsequently retyped.
  if v_id is null or v_old.category_id is distinct from v_category then
    v_type:=v_source.knowledge_type;
    v_venue:=v_source.venue;
  else
    v_type:=coalesce(v_old.knowledge_type,v_source.knowledge_type);
    v_venue:=v_old.venue;
  end if;
  if v_type is null then raise exception 'attestation_ticket_type_required'; end if;
  return public.save_attestation_question_v3(
    p_document || jsonb_build_object('knowledgeType',v_type,'venue',v_venue),
    p_expected_revision);
end;
$$;

create or replace function public.set_attestation_question_status(
  p_question_id text,p_status text,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  return public.set_attestation_question_status_v3(p_question_id,p_status,p_expected_revision);
end;
$$;

create or replace function public.set_attestation_category_status(
  p_category_id text,p_is_active boolean,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  return public.set_attestation_category_status_v3(p_category_id,p_is_active,p_expected_updated_at);
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
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_document) is distinct from 'object' then raise exception 'attestation_document_invalid'; end if;
  perform 1 from public.attestation_settings where singleton=true for update;
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
  perform 1 from public.attestation_settings where singleton=true for update;
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;
  if p_pass_percent is null or p_pass_percent<50 or p_pass_percent>100 then
    raise exception 'attestation_pass_percent_invalid';
  end if;
  if p_questions_per_test is null or p_questions_per_test<1 or p_questions_per_test>50 then
    raise exception 'attestation_question_count_invalid';
  end if;
  if jsonb_typeof(p_ticket_plan) is distinct from 'array' then
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
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;
  perform 1 from public.attestation_settings where singleton=true for update;
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

  if p_pass_percent is null or p_pass_percent < 50 or p_pass_percent > 100 then
    raise exception 'attestation_pass_percent_invalid';
  end if;

  if p_questions_per_test is null or p_questions_per_test < 1 or p_questions_per_test > 50 then
    raise exception 'attestation_question_count_invalid';
  end if;

  if jsonb_typeof(p_ticket_plan) is distinct from 'array' then
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
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;
  perform 1 from public.attestation_settings where singleton=true for update;
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

  if p_pass_percent is null or p_pass_percent < 50 or p_pass_percent > 100 then
    raise exception 'attestation_pass_percent_invalid';
  end if;

  if jsonb_typeof(p_category_settings) is distinct from 'array'
     or jsonb_typeof(p_ticket_plan) is distinct from 'array' then
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

-- Legacy clients require globally unique question IDs and category-owned pools.
-- Keep preexisting BF tickets only while their own eligible groups satisfy their
-- plans; independent tickets without enough source-owned questions stay v3-only.
-- Exact-specific quotas are also v3-only because old clients cannot enforce them.
create or replace function public.get_attestation_bank()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_settings public.attestation_settings%rowtype;
begin
  if not exists(
    select 1 from public.profiles p where p.id=auth.uid() and p.is_active is true
  ) then raise exception 'forbidden'; end if;
  select * into v_settings from public.attestation_settings where singleton=true;
  return jsonb_build_object(
    'schemaVersion',2,'passPercent',v_settings.pass_percent,
    'questionsPerTest',v_settings.questions_per_test,'revision',v_settings.revision,
    'generatedAt',clock_timestamp(),
    'categories',coalesce((
      select jsonb_agg(
        private.attestation_v3_ticket_snapshot(c)||jsonb_build_object(
          'questions',coalesce((
            select jsonb_agg(private.attestation_v3_question_snapshot(q)
              order by q.sort_order,q.id)
            from public.attestation_questions q
            where q.category_id=c.id and q.status='active'
              and q.knowledge_type=c.knowledge_type and q.venue in ('bf','common')
          ),'[]'::jsonb)
        ) order by c.sort_order,c.id
      )
      from public.attestation_categories c
      where c.is_active=true
        and c.knowledge_type in ('bar','kitchen','wine','service')
        and c.venue='bf' and c.specific_question_count is null
        and (select coalesce(sum(p.question_count),0)
          from public.attestation_ticket_plan p where p.category_id=c.id)=c.questions_per_test
        and not exists(
          select 1 from public.attestation_ticket_plan p
          where p.category_id=c.id and (
            select count(distinct q.group_key)
            from public.attestation_questions q
            where q.category_id=c.id and q.status='active' and q.topic=p.topic
              and q.knowledge_type=c.knowledge_type and q.venue in ('bf','common')
          )<p.question_count
        )
        and (
          select count(distinct q.group_key)
          from public.attestation_questions q
          join public.attestation_ticket_plan p on p.category_id=c.id and p.topic=q.topic
          where q.category_id=c.id and q.status='active'
            and q.knowledge_type=c.knowledge_type and q.venue in ('bf','common')
        )>=c.questions_per_test
    ),'[]'::jsonb)
  );
end;
$$;

-- The legacy result API still accepts client-reported totals/correct counts.
-- Validate its references and envelope, not the truth of a score. Empty revision
-- lists remain valid for old offline clients; historical revisions remain valid
-- after a question changes, is archived, or its source ticket is reclassified.
create or replace function public.submit_attestation_attempt(
  p_client_attempt_id uuid,
  p_category text,
  p_category_id text,
  p_total_questions smallint,
  p_correct_answers smallint,
  p_category_results jsonb,
  p_started_at timestamptz,
  p_finished_at timestamptz,
  p_question_revisions jsonb default '[]'::jsonb,
  p_synced_from_offline boolean default false
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid();
  v_category public.attestation_categories%rowtype;
  v_existing public.quiz_attempts%rowtype;
  v_inserted public.quiz_attempts%rowtype;
  v_pass_percent smallint;
  v_attempt_pass_percent integer;
  v_score smallint;
  v_passed boolean;
  v_ref jsonb;
  v_question_id text;
  v_question_revision bigint;
  v_duplicate boolean:=false;
begin
  if v_user is null or not exists(
    select 1 from public.profiles p where p.id=v_user and p.is_active is true
  ) then raise exception 'forbidden'; end if;
  if p_client_attempt_id is null then raise exception 'attestation_attempt_invalid'; end if;

  -- The same attempt may be synchronized from two tabs/devices concurrently.
  -- Serialize duplicate lookup + insert, keyed to this user's client attempt ID.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text||':'||p_client_attempt_id::text,0));
  select * into v_existing from public.quiz_attempts
    where user_id=v_user and client_attempt_id=p_client_attempt_id;
  if v_existing.id is not null then
    begin
      v_attempt_pass_percent:=(v_existing.category_results->>'pass_percent')::integer;
    exception when others then v_attempt_pass_percent:=null; end;
    if v_attempt_pass_percent between 50 and 100 then
      v_pass_percent:=v_attempt_pass_percent::smallint;
    else
      select pass_percent into v_pass_percent from public.attestation_settings where singleton=true;
      v_pass_percent:=coalesce(v_pass_percent,80);
    end if;
    return jsonb_build_object(
      'ok',true,'duplicate',true,'id',v_existing.id,'score',v_existing.score,
      'passed',v_existing.passed,'pass_percent',v_pass_percent);
  end if;

  if p_total_questions is null or p_total_questions not between 1 and 50
    or p_correct_answers is null or p_correct_answers<0
    or p_correct_answers>p_total_questions
    or p_category_id is null or length(btrim(p_category_id))<1
    or p_started_at is null or p_finished_at is null
    or not isfinite(p_started_at) or not isfinite(p_finished_at)
    or p_finished_at<p_started_at
    or jsonb_typeof(p_category_results) is distinct from 'object'
    or jsonb_typeof(p_question_revisions) is distinct from 'array'
  then raise exception 'attestation_attempt_invalid'; end if;

  select * into v_category from public.attestation_categories where id=btrim(p_category_id);
  if v_category.id is null then raise exception 'attestation_category_not_found'; end if;

  -- The threshold is an offline snapshot supplied by the old API contract.
  -- It is not authenticated; a trustworthy grade requires a new answer API.
  begin
    v_attempt_pass_percent:=nullif(btrim(p_category_results->>'pass_percent'),'')::integer;
  exception when others then raise exception 'attestation_attempt_invalid'; end;
  if v_attempt_pass_percent is not null then
    if v_attempt_pass_percent not between 50 and 100 then raise exception 'attestation_attempt_invalid'; end if;
    v_pass_percent:=v_attempt_pass_percent::smallint;
  else
    select pass_percent into v_pass_percent from public.attestation_settings where singleton=true;
    v_pass_percent:=coalesce(v_pass_percent,80);
  end if;

  if jsonb_array_length(p_question_revisions)>0 then
    if jsonb_array_length(p_question_revisions)<>p_total_questions then
      raise exception 'attestation_attempt_invalid';
    end if;
    if exists(
      select 1 from jsonb_array_elements(p_question_revisions) as x(value)
      group by x.value->>'id' having count(*)>1
    ) then raise exception 'attestation_attempt_invalid'; end if;
    for v_ref in select value from jsonb_array_elements(p_question_revisions) loop
      if jsonb_typeof(v_ref) is distinct from 'object'
        or jsonb_typeof(v_ref->'id') is distinct from 'string'
        or coalesce(v_ref->>'revision','') !~ '^[1-9][0-9]*$'
      then raise exception 'attestation_attempt_invalid'; end if;
      v_question_id:=v_ref->>'id';
      if v_question_id is null or length(v_question_id) not between 1 and 96
        or v_question_id<>btrim(v_question_id) then
        raise exception 'attestation_attempt_invalid';
      end if;
      begin v_question_revision:=(v_ref->>'revision')::bigint;
      exception when others then raise exception 'attestation_attempt_invalid'; end;
      if not exists(
        select 1 from public.attestation_questions q
        where q.id=v_question_id and q.revision=v_question_revision
      ) and not exists(
        select 1 from public.attestation_question_versions v
        where v.question_id=v_question_id and v.revision=v_question_revision
      ) then raise exception 'attestation_revision_conflict'; end if;
    end loop;
  end if;

  v_score:=round((p_correct_answers::numeric*100)/p_total_questions::numeric)::smallint;
  v_passed:=p_correct_answers::numeric*100 >= p_total_questions::numeric*v_pass_percent;
  insert into public.quiz_attempts(
    user_id,category,category_id,score,passed,total_questions,correct_answers,
    category_results,started_at,finished_at,client_attempt_id,question_revisions,synced_from_offline
  ) values (
    v_user,coalesce(nullif(btrim(p_category),''),v_category.label),v_category.id,
    v_score,v_passed,p_total_questions,p_correct_answers,
    p_category_results||jsonb_build_object('pass_percent',v_pass_percent),
    p_started_at,p_finished_at,p_client_attempt_id,p_question_revisions,
    coalesce(p_synced_from_offline,false)
  )
  on conflict (user_id,client_attempt_id) where client_attempt_id is not null do nothing
  returning * into v_inserted;

  -- A direct table writer may not use the advisory lock. Preserve idempotency
  -- even then via the existing unique index and the same response contract.
  if v_inserted.id is null then
    select * into v_inserted from public.quiz_attempts
      where user_id=v_user and client_attempt_id=p_client_attempt_id;
    v_duplicate:=true;
    begin
      v_attempt_pass_percent:=(v_inserted.category_results->>'pass_percent')::integer;
    exception when others then v_attempt_pass_percent:=null; end;
    if v_attempt_pass_percent between 50 and 100 then
      v_pass_percent:=v_attempt_pass_percent::smallint;
    end if;
  end if;
  return jsonb_build_object(
    'ok',true,'duplicate',v_duplicate,'id',v_inserted.id,'score',v_inserted.score,
    'passed',v_inserted.passed,'pass_percent',v_pass_percent);
end;
$$;

revoke all on function private.attestation_v3_ticket_snapshot(public.attestation_categories) from public,anon,authenticated;
revoke all on function private.attestation_v3_question_snapshot(public.attestation_questions) from public,anon,authenticated;
revoke all on function private.attestation_v3_assert_ticket(text) from public,anon,authenticated;
revoke all on function private.attestation_v3_assert_all() from public,anon,authenticated;
revoke all on function private.attestation_v3_write_integrity_trigger() from public,anon,authenticated;
revoke all on function public.get_attestation_bank_v3() from public,anon;
revoke all on function public.get_attestation_editor_bank_v3(boolean) from public,anon;
revoke all on function public.save_attestation_question_v3(jsonb,bigint) from public,anon;
revoke all on function public.set_attestation_question_status_v3(text,text,bigint) from public,anon;
revoke all on function public.save_attestation_category_v3(jsonb,timestamptz) from public,anon;
revoke all on function public.set_attestation_category_status_v3(text,boolean,timestamptz) from public,anon;
revoke all on function public.save_attestation_editor_settings_v3(smallint,jsonb,jsonb,bigint) from public,anon;
grant execute on function public.get_attestation_bank_v3() to authenticated;
grant execute on function public.get_attestation_editor_bank_v3(boolean) to authenticated;
grant execute on function public.save_attestation_question_v3(jsonb,bigint) to authenticated;
grant execute on function public.set_attestation_question_status_v3(text,text,bigint) to authenticated;
grant execute on function public.save_attestation_category_v3(jsonb,timestamptz) to authenticated;
grant execute on function public.set_attestation_category_status_v3(text,boolean,timestamptz) to authenticated;
grant execute on function public.save_attestation_editor_settings_v3(smallint,jsonb,jsonb,bigint) to authenticated;
revoke all on function public.submit_attestation_attempt(uuid,text,text,smallint,smallint,jsonb,timestamptz,timestamptz,jsonb,boolean) from public,anon;
grant execute on function public.submit_attestation_attempt(uuid,text,text,smallint,smallint,jsonb,timestamptz,timestamptz,jsonb,boolean) to authenticated;

-- Reject existing inconsistent active plans before exposing the new API.
do $$ begin perform private.attestation_v3_assert_all(); end $$;

notify pgrst, 'reload schema';
