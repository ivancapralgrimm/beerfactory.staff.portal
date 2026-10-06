alter table public.attestation_questions
  add column if not exists subcategory text;

alter table public.attestation_questions
  drop constraint if exists attestation_questions_subcategory_length;

alter table public.attestation_questions
  add constraint attestation_questions_subcategory_length
  check (subcategory is null or length(btrim(subcategory)) between 1 and 120);

create index if not exists attestation_questions_category_subcategory_idx
  on public.attestation_questions(category_id, subcategory, status);

create or replace function private.attestation_question_snapshot(p_question public.attestation_questions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id',p_question.id,'categoryId',p_question.category_id,'q',p_question.question_text,
    'answers',p_question.answers,'topic',p_question.topic,'subcategory',p_question.subcategory,
    'group',p_question.group_key,'source',p_question.source,'sourceRef',p_question.source_ref,
    'reviewUrl',p_question.review_url,'reviewLabel',p_question.review_label,'reviewNote',p_question.review_note,
    'status',p_question.status,'sortOrder',p_question.sort_order,'revision',p_question.revision
  );
$$;

create or replace function public.get_attestation_bank()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_settings public.attestation_settings%rowtype;
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active is true) then raise exception 'forbidden'; end if;
  select * into v_settings from public.attestation_settings where singleton is true;
  return jsonb_build_object(
    'passPercent',v_settings.pass_percent,'questionsPerTest',v_settings.questions_per_test,
    'revision',v_settings.revision,'generatedAt',clock_timestamp(),
    'categories',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'label',c.label,
      'questions',coalesce((select jsonb_agg(jsonb_build_object(
        'id',q.id,'q',q.question_text,'answers',q.answers,'source',q.source,'sourceRef',q.source_ref,
        'group',q.group_key,'reviewUrl',q.review_url,'reviewLabel',q.review_label,'topic',q.topic,
        'subcategory',q.subcategory,'reviewNote',q.review_note,'revision',q.revision
      ) order by q.sort_order,q.id) from public.attestation_questions q where q.category_id=c.id and q.status='active'),'[]'::jsonb),
      'ticketPlan',coalesce((select jsonb_agg(jsonb_build_object('topic',p.topic,'count',p.question_count) order by p.sort_order,p.topic) from public.attestation_ticket_plan p where p.category_id=c.id),'[]'::jsonb)
    ) order by c.sort_order,c.id) from public.attestation_categories c where c.is_active is true),'[]'::jsonb)
  );
end;
$$;

create or replace function public.save_attestation_question(p_document jsonb,p_expected_revision bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=auth.uid(); v_id text:=nullif(btrim(coalesce(p_document->>'id','')),'');
  v_category text:=nullif(btrim(coalesce(p_document->>'categoryId','')),'');
  v_text text:=btrim(coalesce(p_document->>'q','')); v_topic text:=btrim(coalesce(p_document->>'topic',''));
  v_subcategory text:=nullif(btrim(coalesce(p_document->>'subcategory','')),'');
  v_group text:=btrim(coalesce(p_document->>'group','')); v_answers jsonb:=p_document->'answers';
  v_old public.attestation_questions%rowtype; v_new public.attestation_questions%rowtype; v_sort integer;
begin
  if not private.attestation_is_admin() then raise exception 'forbidden'; end if;
  if v_category is null or not exists(select 1 from public.attestation_categories where id=v_category and is_active is true) then raise exception 'attestation_category_invalid'; end if;
  if length(v_text)<1 or length(v_text)>1000 then raise exception 'attestation_question_invalid'; end if;
  if length(v_topic)<1 or length(v_topic)>120 then raise exception 'attestation_topic_invalid'; end if;
  if v_subcategory is not null and length(v_subcategory)>120 then raise exception 'attestation_subcategory_invalid'; end if;
  if length(v_group)<1 or length(v_group)>160 then raise exception 'attestation_group_invalid'; end if;
  if not private.attestation_validate_answers(v_answers) then raise exception 'attestation_answers_invalid'; end if;

  if v_id is null then
    v_id:=v_category||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,16);
    select coalesce(max(sort_order),0)+10 into v_sort from public.attestation_questions where category_id=v_category;
    insert into public.attestation_questions(id,category_id,question_text,answers,topic,subcategory,group_key,source,source_ref,review_url,review_label,review_note,status,sort_order,revision,created_by,updated_by)
    values(v_id,v_category,v_text,v_answers,v_topic,v_subcategory,v_group,
      nullif(btrim(coalesce(p_document->>'source','')),''),nullif(btrim(coalesce(p_document->>'sourceRef','')),''),
      nullif(btrim(coalesce(p_document->>'reviewUrl','')),''),nullif(btrim(coalesce(p_document->>'reviewLabel','')),''),
      nullif(btrim(coalesce(p_document->>'reviewNote','')),''),'active',v_sort,1,v_actor,v_actor)
    returning * into v_new;
  else
    select * into v_old from public.attestation_questions where id=v_id for update;
    if v_old.id is null then raise exception 'attestation_question_not_found'; end if;
    if p_expected_revision is null or v_old.revision<>p_expected_revision then raise exception 'attestation_revision_conflict'; end if;
    update public.attestation_questions set category_id=v_category,question_text=v_text,answers=v_answers,topic=v_topic,
      subcategory=v_subcategory,group_key=v_group,
      source=nullif(btrim(coalesce(p_document->>'source','')),''),source_ref=nullif(btrim(coalesce(p_document->>'sourceRef','')),''),
      review_url=nullif(btrim(coalesce(p_document->>'reviewUrl','')),''),review_label=nullif(btrim(coalesce(p_document->>'reviewLabel','')),''),
      review_note=nullif(btrim(coalesce(p_document->>'reviewNote','')),''),updated_at=clock_timestamp(),updated_by=v_actor,revision=revision+1
    where id=v_id returning * into v_new;
    perform private.attestation_assert_topic_capacity(v_old.category_id,v_old.topic);
  end if;
  update public.attestation_settings set revision=revision+1,updated_at=clock_timestamp(),updated_by=v_actor where singleton is true;
  return private.attestation_question_snapshot(v_new)||jsonb_build_object('createdAt',v_new.created_at,'updatedAt',v_new.updated_at);
end;
$$;

revoke all on function public.get_attestation_bank() from public,anon;
revoke all on function public.save_attestation_question(jsonb,bigint) from public,anon;
grant execute on function public.get_attestation_bank() to authenticated;
grant execute on function public.save_attestation_question(jsonb,bigint) to authenticated;
