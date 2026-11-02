-- OFFLINE REVIEW CANDIDATE. Apply only after reviewed deployment authorization.
-- Prerequisites: current main through r406, knowledge + independent tickets v3.
-- Supabase CLI is absent in this workspace. Promote this ordered patch with
-- `supabase migration new r407_material_lifecycle` on the release machine.
begin;

-- Activation stays false until the private Storage remover is deployed, scheduled
-- and verified. Applying SQL alone must never advertise physical cleanup.
create table private.material_lifecycle_configuration (
 singleton boolean primary key default true check(singleton),
 underline_ready boolean not null default false,
 knowledge_cleanup_ready boolean not null default false
);
insert into private.material_lifecycle_configuration(singleton) values(true);
alter table private.material_lifecycle_configuration enable row level security;
revoke all on private.material_lifecycle_configuration from public,anon,authenticated,service_role;

create table private.recipe_material_operations (
  id uuid primary key,
  actor_id uuid not null references public.profiles(id),
  source_ref text not null check (source_ref ~ '^(bar|kitchen):[^/]{1,96}$'),
  action text not null check (action in ('archive','delete')),
  expected_version text not null,
  mutation jsonb not null,
  phase text not null default 'prepared' check (phase in ('prepared','completed')),
  result jsonb not null default '{}',
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz
);
create unique index recipe_material_operations_pending_source
  on private.recipe_material_operations(source_ref) where phase='prepared';
alter table private.recipe_material_operations enable row level security;
revoke all on private.recipe_material_operations from public,anon,authenticated,service_role;

create table private.material_source_state (
  kind text not null check (kind in ('knowledge','recipe')),
  source_ref text not null,
  action text not null check (action in ('archive','delete')),
  primary key (kind,source_ref)
);
alter table private.material_source_state enable row level security;
revoke all on private.material_source_state from public,anon,authenticated,service_role;

-- Match canonical metadata and direct legacy links. Never use title matching:
-- duplicate recipe/article names are legitimate and must not cascade together.
create function private.material_question_matches(
 p_question public.attestation_questions,p_kind text,p_ref text)
returns boolean language sql immutable set search_path='' as $$
 select (
   (p_question.source_ref=p_ref and lower(coalesce(p_question.source,''))=p_kind)
   or case when p_kind='knowledge' then
     regexp_replace(coalesce(p_question.review_url,''),'^#','') in
       ('/knowledge/'||p_ref,'/article/'||p_ref)
   else
     replace(replace(regexp_replace(coalesce(p_question.review_url,''),'^#',''),'%3A',':'),'%3a',':')='/menu/'||p_ref
   end
 )
$$;

-- Main ticket quotas already require one topic per source group. Reallocation
-- can consider previously unplanned topics, so verify the shared pool invariant
-- before installing it and preserve it for future writes below. Remediate any
-- conflicting legacy group explicitly; do not guess a new source identity.
do $groups$
begin
 if exists(select 1 from public.attestation_questions a join public.attestation_questions b
   on a.id<>b.id and a.group_key=b.group_key and a.knowledge_type=b.knowledge_type
   and a.topic<>b.topic and (a.venue=b.venue or a.venue='common' or b.venue='common')
   where a.status='active' and b.status='active') then
   raise exception 'material_pool_group_cross_topic';
 end if;
end $groups$;

-- Rebuild only an invalid affected ticket. Dynamic programming maximizes the
-- number of retained topic slots at the original ticket size; ties minimize
-- quota change. No solution at the original size => archive ticket, retaining
-- its definition. All final plans still pass main's quota/capacity guards.
create function private.material_reallocate_ticket(p_id text,p_actor uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare
 c public.attestation_categories%rowtype; t record;
 scores integer[]; next_scores integer[]; paths jsonb[]; next_paths jsonb[];
 total integer; specific integer; k integer; s integer; idx integer; dest integer;
 score integer; best integer:=-1; best_distance integer:=2147483647; distance integer;
 chosen jsonb; topic_counts jsonb; topic_order integer:=0;
begin
 select * into c from public.attestation_categories where id=p_id for update;
 if c.id is null or not c.is_active then return false; end if;
 begin
   perform private.attestation_v3_assert_ticket(p_id);
   return false;
 exception when raise_exception then null;
 end;
 scores:=array_fill(-1,array[2601]); paths:=array_fill(null::jsonb,array[2601]);
 scores[1]:=0; paths[1]:='{}'::jsonb;
 for t in
   select q.topic,count(distinct q.group_key)::integer capacity,
     count(distinct q.group_key) filter(where q.venue=c.venue and c.venue<>'common')::integer specific,
     count(distinct q.group_key) filter(where q.venue='common')::integer common,
     coalesce(max(p.question_count),0)::integer previous
   from public.attestation_questions q
   left join public.attestation_ticket_plan p on p.category_id=c.id and p.topic=q.topic
   where q.status='active' and q.knowledge_type=c.knowledge_type
     and (q.venue='common' or (q.venue=c.venue and c.venue<>'common'))
   group by q.topic order by q.topic
 loop
   next_scores:=array_fill(-1,array[2601]); next_paths:=array_fill(null::jsonb,array[2601]);
   for total in 0..c.questions_per_test loop
     for specific in 0..total loop
       idx:=total*51+specific+1;
       if scores[idx]<0 then continue; end if;
       for k in 0..least(t.capacity,c.questions_per_test-total) loop
         for s in greatest(0,k-t.common)..least(k,t.specific) loop
           dest:=(total+k)*51+specific+s+1;
           score:=scores[idx]+least(k,t.previous);
           if score>next_scores[dest] then
             next_scores[dest]:=score;
             next_paths[dest]:=paths[idx]||jsonb_build_object(t.topic,k);
           end if;
         end loop;
       end loop;
     end loop;
   end loop;
   scores:=next_scores; paths:=next_paths;
 end loop;
 for specific in 0..c.questions_per_test loop
   idx:=c.questions_per_test*51+specific+1;
   distance:=case when c.specific_question_count is null then 0 else abs(specific-c.specific_question_count) end;
   if scores[idx]>best or (scores[idx]=best and distance<best_distance) then
     best:=scores[idx]; best_distance:=distance; chosen:=paths[idx];
     if c.specific_question_count is not null then topic_order:=specific; end if;
   end if;
 end loop;
 if best<0 or chosen is null then
   update public.attestation_categories set is_active=false,updated_at=clock_timestamp(),updated_by=p_actor where id=p_id;
   return true;
 end if;
 delete from public.attestation_ticket_plan where category_id=p_id;
 insert into public.attestation_ticket_plan(category_id,topic,question_count,sort_order)
 select p_id,key,value::smallint,(row_number() over(order by key)*10)::integer
 from jsonb_each_text(chosen) where value::integer>0;
 update public.attestation_categories set
   specific_question_count=case when c.specific_question_count is null then null else topic_order end,
   updated_at=clock_timestamp(),updated_by=p_actor where id=p_id;
 perform private.attestation_v3_assert_ticket(p_id);
 return true;
end $$;

create function private.apply_material_lifecycle(p_kind text,p_ref text,p_action text,p_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare affected text[]; q_count integer; t_count integer:=0; ticket text;
begin
 if p_kind not in ('knowledge','recipe') or p_action not in ('archive','delete') then
   raise exception 'material_lifecycle_invalid'; end if;
 perform 1 from public.attestation_settings where singleton=true for update;
 select coalesce(array_agg(distinct c.id),'{}'::text[]) into affected
 from public.attestation_questions q
 join public.attestation_categories c on c.is_active and c.knowledge_type=q.knowledge_type
   and (q.venue='common' or (c.venue=q.venue and c.venue<>'common'))
 join public.attestation_ticket_plan p on p.category_id=c.id and p.topic=q.topic
 where q.status='active' and private.material_question_matches(q,p_kind,p_ref);
 update public.attestation_questions q set
   status=case when p_action='delete' then 'deleted' else 'archive' end,
   revision=revision+1,updated_by=p_actor,updated_at=clock_timestamp()
 where private.material_question_matches(q,p_kind,p_ref)
   and (case when p_action='delete' then q.status<>'deleted' else q.status='active' end);
 get diagnostics q_count=row_count;
 foreach ticket in array affected loop
   if private.material_reallocate_ticket(ticket,p_actor) then t_count:=t_count+1; end if;
 end loop;
 perform private.attestation_v3_assert_all();
 if q_count>0 then
   update public.attestation_settings set revision=revision+1,updated_by=p_actor,updated_at=clock_timestamp() where singleton=true;
 end if;
 insert into private.material_source_state(kind,source_ref,action) values(p_kind,p_ref,p_action)
 on conflict(kind,source_ref) do update set action=excluded.action;
 return jsonb_build_object('affectedQuestions',q_count,'affectedTickets',t_count);
end $$;

-- Existing save RPC is the sole knowledge writer. Hook its status transition
-- so even an old cached client cannot archive without the same transaction.
create function private.knowledge_material_lifecycle_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
   perform private.apply_material_lifecycle('knowledge',old.id,'delete',auth.uid());
   return old;
 elsif new.status='archived' and old.status<>'archived' then
   perform private.apply_material_lifecycle('knowledge',new.id,'archive',auth.uid());
 elsif new.status='published' and old.status<>'published' then
   delete from private.material_source_state where kind='knowledge' and source_ref=new.id and action='archive';
 end if;
 return new;
end $$;
create trigger knowledge_material_lifecycle before update of status or delete
 on public.knowledge_articles for each row execute function private.knowledge_material_lifecycle_trigger();

-- Preserve the existing audit vocabulary and add only the new hard-delete event.
do $audit$
declare expression text;
begin
 select pg_get_expr(conbin,conrelid) into expression from pg_constraint
 where conrelid='public.audit_log'::regclass and conname='audit_log_action_check';
 if expression is null then raise exception 'material_audit_constraint_missing'; end if;
 alter table public.audit_log drop constraint audit_log_action_check;
 execute 'alter table public.audit_log add constraint audit_log_action_check check (('||expression||') or action = ''knowledge_article_delete'')';
end $audit$;

create function public.delete_knowledge_article(p_article_id text,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.knowledge_articles%rowtype; result jsonb;
begin
 if auth.uid() is null or not private.knowledge_permission('edit') or not private.knowledge_permission('publish') then raise exception 'forbidden'; end if;
 select * into a from public.knowledge_articles where id=p_article_id for update;
 if a.id is null then raise exception 'article_not_found'; end if;
 if p_expected_revision is null or a.revision<>p_expected_revision then raise exception 'article_revision_conflict'; end if;
 result:=private.apply_material_lifecycle('knowledge',p_article_id,'delete',auth.uid());
 -- Blocks must go before media (media FK is RESTRICT).
 delete from public.knowledge_article_blocks where article_id=p_article_id;
 delete from public.knowledge_articles where id=p_article_id;
 insert into public.audit_log(actor_id,action,entity_type,entity_id,entity_name,before_data,after_data,metadata)
 values(auth.uid(),'knowledge_article_delete','knowledge_article',a.id,a.title,to_jsonb(a),'{}',result);
 return result||jsonb_build_object('id',a.id,'deleted',true);
end $$;

-- All new/edited question material is validated server-side; unchanged legacy
-- questions remain readable and lifecycle status changes preserve their history.
create function private.attestation_require_material()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_url text; v_ref text; v_kind text;
begin
 if tg_op='UPDATE' and new.question_text=old.question_text and new.answers=old.answers
   and new.source is not distinct from old.source and new.source_ref is not distinct from old.source_ref
   and new.review_url is not distinct from old.review_url and new.topic=old.topic and new.group_key=old.group_key
   and new.knowledge_type=old.knowledge_type and new.venue=old.venue
   and not (new.status='active' and old.status<>'active') then return new; end if;
 if new.status='deleted' then return new; end if;
 v_url:=regexp_replace(coalesce(new.review_url,''),'^#','');
 if v_url like '/knowledge/%' then v_kind:='knowledge'; v_ref:=substr(v_url,12);
 elsif v_url like '/menu/%' then v_kind:='recipe'; v_ref:=replace(replace(substr(v_url,7),'%3A',':'),'%3a',':');
 else raise exception 'attestation_review_material_required'; end if;
 if new.source_ref is not null and new.source_ref<>v_ref then raise exception 'attestation_review_material_invalid'; end if;
 if new.source is not null and lower(new.source)<>v_kind then raise exception 'attestation_review_material_invalid'; end if;
 if (v_kind='knowledge' and not exists(select 1 from public.knowledge_articles where id=v_ref and status='published'))
   or (v_kind='recipe' and v_ref !~ '^(bar|kitchen):[^/]{1,96}$')
   or exists(select 1 from private.material_source_state s where s.kind=v_kind and s.source_ref=v_ref)
 then raise exception 'attestation_review_material_unavailable'; end if;
 -- Serialize material validation with recipe prepare/knowledge archive. A recipe
 -- prepared concurrently cannot acquire a new active question after its cascade.
 perform 1 from public.attestation_settings where singleton=true for update;
 if exists(select 1 from private.material_source_state s where s.kind=v_kind and s.source_ref=v_ref) then
   raise exception 'attestation_review_material_unavailable'; end if;
 if new.status='active' and exists(select 1 from public.attestation_questions q
   where q.id<>new.id and q.status='active' and q.group_key=new.group_key
     and q.knowledge_type=new.knowledge_type and q.topic<>new.topic
     and (q.venue=new.venue or q.venue='common' or new.venue='common')) then
   raise exception 'material_pool_group_cross_topic'; end if;
 new.source:=v_kind; new.source_ref:=v_ref;
 return new;
end $$;
create trigger attestation_material_required before insert or update
 on public.attestation_questions for each row execute function private.attestation_require_material();

-- Only the trusted Worker may orchestrate NocoDB. Never grant this endpoint to
-- browsers. Every call verifies its already-authenticated actor is still active.
create function public.recipe_material_lifecycle_v1(
 p_command text,p_operation_id uuid,p_actor_id uuid,p_source_ref text default null,
 p_action text default null,p_expected_version text default null,p_mutation jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare op private.recipe_material_operations%rowtype; v_result jsonb;
begin
 if p_command='capabilities' then return jsonb_build_object('schemaVersion',1,'recipeLifecycle',true); end if;
 if not exists(select 1 from public.profiles where id=p_actor_id and is_active and (is_owner or role='admin'::public.staff_role
   or (role='senior'::public.staff_role and position_code::text in ('bartender','bartender_bb','waiter','waiter_bb','manager')))) then raise exception 'forbidden'; end if;
 -- One global lock order for all commands and attestation writers.
 perform 1 from public.attestation_settings where singleton=true for update;
 if p_command='pending' then
   select * into op from private.recipe_material_operations where source_ref=p_source_ref and phase='prepared';
   return case when op.id is null then null else to_jsonb(op) end;
 end if;
 if p_command='restore' then
   if exists(select 1 from private.recipe_material_operations where source_ref=p_source_ref and phase='prepared') then
     raise exception 'material_operation_pending'; end if;
   delete from private.material_source_state where kind='recipe' and source_ref=p_source_ref and action='archive';
   return jsonb_build_object('restored',true);
 end if;
 select * into op from private.recipe_material_operations where id=p_operation_id for update;
 if op.id is not null and op.actor_id<>p_actor_id then raise exception 'forbidden'; end if;
 if p_command='get' then return case when op.id is null then null else to_jsonb(op) end; end if;
 if p_command='prepare' then
   if op.id is not null then
     if op.source_ref is distinct from p_source_ref or op.action is distinct from p_action
       or op.expected_version is distinct from p_expected_version or op.mutation is distinct from p_mutation
       then raise exception 'material_idempotency_conflict'; end if;
     return to_jsonb(op);
   end if;
   if p_operation_id is null or p_source_ref is null or p_action is null or p_action not in ('archive','delete')
      or p_expected_version is null or jsonb_typeof(p_mutation) is distinct from 'object' then raise exception 'material_lifecycle_invalid'; end if;
   -- Same lock order as every main attestation writer.
   perform 1 from public.attestation_settings where singleton=true for update;
   insert into private.recipe_material_operations(id,actor_id,source_ref,action,expected_version,mutation)
   values(p_operation_id,p_actor_id,p_source_ref,p_action,p_expected_version,p_mutation) returning * into op;
   v_result:=private.apply_material_lifecycle('recipe',p_source_ref,p_action,p_actor_id);
   update private.recipe_material_operations set result=v_result||jsonb_build_object('operationId',p_operation_id) where id=p_operation_id returning * into op;
   return to_jsonb(op);
 elsif p_command='complete' then
   if op.id is null then raise exception 'material_operation_not_found'; end if;
   update private.recipe_material_operations set phase='completed',completed_at=coalesce(completed_at,clock_timestamp())
   where id=p_operation_id returning * into op;
   return to_jsonb(op);
 else raise exception 'material_command_invalid'; end if;
end $$;

create function public.get_material_lifecycle_capabilities()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_active_staff() then raise exception 'forbidden'; end if;
 return (select jsonb_build_object('schemaVersion',1,
   'knowledgeLifecycle',c.knowledge_cleanup_ready and c.underline_ready,
   'knowledgeUnderline',c.underline_ready,'knowledgeMediaCleanup',c.knowledge_cleanup_ready,
   'questionMaterialRequired',true,'recipeLifecycle',true)
   from private.material_lifecycle_configuration c where singleton=true);
end $$;

revoke all on function private.material_question_matches(public.attestation_questions,text,text) from public,anon,authenticated,service_role;
revoke all on function private.material_reallocate_ticket(text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.apply_material_lifecycle(text,text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.knowledge_material_lifecycle_trigger() from public,anon,authenticated,service_role;
revoke all on function private.attestation_require_material() from public,anon,authenticated,service_role;
revoke all on function public.recipe_material_lifecycle_v1(text,uuid,uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.recipe_material_lifecycle_v1(text,uuid,uuid,text,text,text,jsonb) to service_role;
revoke all on function public.delete_knowledge_article(text,bigint) from public,anon;
grant execute on function public.delete_knowledge_article(text,bigint) to authenticated;
revoke all on function public.get_material_lifecycle_capabilities() from public,anon;
grant execute on function public.get_material_lifecycle_capabilities() to authenticated;

commit;
