-- BFStaff read-only preflight. ONLY SELECT, no schema or data changes.
-- Run before approved migration. Expected: 4 canonical active tickets, 1 Bistro draft.
with qa as (
 select
 (select count(*) from public.attestation_questions) as questions_total,
 (select count(*) from public.attestation_questions where status='active') as questions_active,
 (select count(*) from public.attestation_questions where status='archive') as questions_archive,
 (select count(*) from public.attestation_questions where status='deleted') as questions_deleted,
 (select count(*) from public.attestation_question_versions) as revisions,
 (select count(*) from public.quiz_attempts) as results,
 (select count(*) from public.attestation_categories where is_active=true) as active_tickets,
 (select count(*) from public.attestation_categories where is_active=false) as draft_tickets,
 (select count(*) from public.attestation_categories where is_active=true and id not in ('bar','kitchen','wine','service')) as unknown_active_tickets,
 (select count(*) from public.attestation_categories c where c.is_active=true
  and c.questions_per_test<>(select coalesce(sum(p.question_count),0) from public.attestation_ticket_plan p where p.category_id=c.id)) as invalid_ticket_totals,
 (select count(*) from (select p.category_id,p.topic from public.attestation_ticket_plan p
  join public.attestation_categories c on c.id=p.category_id
  left join public.attestation_questions q on q.category_id=p.category_id and q.topic=p.topic and q.status='active'
  where c.is_active=true group by p.category_id,p.topic,p.question_count
  having count(distinct q.group_key)<p.question_count) x) as missing_topic_groups,
 (select count(*) from (select q.category_id,q.group_key from public.attestation_questions q
  where q.status='active' group by q.category_id,q.group_key having count(distinct q.topic)>1) x) as repeated_groups_across_topics,
 exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_attestation_bank_v3') as new_rpc_installed
) select * from qa;
