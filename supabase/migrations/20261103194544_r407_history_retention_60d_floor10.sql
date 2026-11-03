-- Authorized retention: strictly older than 60 days AND outside the newest 10
-- of each independent history. No live data or media are cleanup targets.
create or replace function private.portal_history_retention_candidates()
returns table(kind text, id text)
language sql stable security definer set search_path = ''
as $body$
 with
 attempts as (
  select q.id, greatest(q.created_at,coalesce(q.finished_at,q.created_at)) as aged_at,
   row_number() over(partition by q.user_id,
    case when nullif(q.category_id,'') is not null then 'ticket:'||q.category_id else 'legacy:'||coalesce(q.category,'unknown') end
    order by coalesce(q.finished_at,q.created_at) desc,q.created_at desc,q.id desc) as rank
  from public.quiz_attempts q
 ),
 terminal_shifts as (
  select p.id,p.shift_id,
   greatest(p.created_at,coalesce(p.closed_at,p.expired_at,p.created_at),s.shift_date::timestamp at time zone 'Asia/Novosibirsk') as aged_at,
   row_number() over(partition by p.position_code
    order by s.shift_date desc,coalesce(p.closed_at,p.expired_at,p.created_at) desc,p.id desc) as rank
  from public.position_shift_states p join public.shifts s on s.id=p.shift_id
  where p.status in ('closed','expired')
 ),
 old_states as (select t.id from terminal_shifts t where t.rank>10 and t.aged_at < now()-interval '60 days'),
 audit as (
  select a.id,a.created_at,
   row_number() over(partition by
    case when a.entity_type='position_shift_window_summary' then 'summary:'||coalesce(a.metadata->>'position_code','all')
     when a.entity_type='profile' or starts_with(a.action,'profile_') or a.action='credential_reset' then 'staff'
     else 'portal' end
    order by a.created_at desc,a.id desc) as rank
  from public.audit_log a
 ),
 resolved_notes as (
  select n.id,greatest(n.created_at,coalesce(n.resolved_at,n.created_at)) as aged_at,
   row_number() over(partition by n.category order by coalesce(n.resolved_at,n.created_at) desc,n.created_at desc,n.id desc) as rank
  from public.notes n where n.status::text='resolved' and n.is_resolved=true
 ),
 old_notes as (select n.id from resolved_notes n where n.rank>10 and n.aged_at < now()-interval '60 days'),
 parent_shifts as (
  select s.id,s.shift_date,
   greatest(s.created_at,coalesce(s.closed_at,s.created_at),s.shift_date::timestamp at time zone 'Asia/Novosibirsk') as aged_at,
   row_number() over(partition by exists(select 1 from public.shift_checks c where c.shift_id=s.id)
    order by s.shift_date desc,s.created_at desc,s.id desc) as rank
  from public.shifts s where s.status::text<>'active'
 ),
 cron_runs as (
  select j.runid,j.end_time,
   row_number() over(partition by j.jobid order by j.end_time desc,j.runid desc) as rank
  from cron.job_run_details j where j.end_time is not null and j.status in ('succeeded','failed')
 )
 select 'quiz_attempts',a.id::text from attempts a where a.rank>10 and a.aged_at < now()-interval '60 days'
 union all select 'position_shift_states',s.id::text from old_states s
 union all select 'audit_log',a.id::text from audit a where a.rank>10 and a.created_at < now()-interval '60 days'
 union all select 'notes',n.id::text from old_notes n
 union all select 'shifts',s.id::text from parent_shifts s where s.rank>10 and s.aged_at < now()-interval '60 days'
  and not exists(select 1 from public.position_shift_states p where p.shift_id=s.id and not exists(select 1 from old_states o where o.id=p.id))
  and not exists(select 1 from public.notes n where n.shift_id=s.id and not exists(select 1 from old_notes o where o.id=n.id))
  and not exists(select 1 from public.messages m where m.shift_id=s.id)
 union all select 'cron_runs',j.runid::text from cron_runs j where j.rank>10 and j.end_time < now()-interval '60 days';
$body$;
revoke all on function private.portal_history_retention_candidates() from public,anon,authenticated,service_role;

-- Retain the old private entry point safely: no old call path can bypass the floor.
create or replace function private.cleanup_handover_history()
returns integer language plpgsql security definer set search_path = ''
as $body$
declare v_deleted integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('bfstaff:history-retention',0));
 delete from public.notes n using private.portal_history_retention_candidates() c
 where c.kind='notes' and n.id=c.id::uuid and n.status::text='resolved' and n.is_resolved=true;
 get diagnostics v_deleted=row_count;
 return v_deleted;
end;
$body$;
revoke all on function private.cleanup_handover_history() from public,anon,authenticated,service_role;

create or replace function private.cleanup_portal_history(p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = ''
as $body$
declare v_plan jsonb; v_attempts integer; v_audit integer; v_notes integer;
 v_states integer; v_parents integer; v_runs integer;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('bfstaff:history-retention',0)) then
  return jsonb_build_object('skipped',true,'reason','already_running');
 end if;
 select coalesce(jsonb_object_agg(kind,total),'{}'::jsonb) into v_plan
 from (select kind,count(*) as total from private.portal_history_retention_candidates() group by kind) counts;
 if p_dry_run is distinct from false then
  return jsonb_build_object('dryRun',true,'cutoff',now()-interval '60 days','keepAtLeast',10,'eligible',v_plan);
 end if;
 delete from public.quiz_attempts q using private.portal_history_retention_candidates() c
 where c.kind='quiz_attempts' and q.id=c.id::uuid;
 get diagnostics v_attempts=row_count;
 delete from public.audit_log a using private.portal_history_retention_candidates() c
 where c.kind='audit_log' and a.id=c.id::uuid;
 get diagnostics v_audit=row_count;
 v_notes:=private.cleanup_handover_history();
 delete from public.position_shift_states p using private.portal_history_retention_candidates() c
 where c.kind='position_shift_states' and p.id=c.id::uuid and p.status in ('closed','expired');
 get diagnostics v_states=row_count;
 -- Parent headers only after children. Do not detach retained notes/messages or
 -- cascade into retained positional history. Legacy checklist children follow FK.
 delete from public.shifts s using private.portal_history_retention_candidates() c
 where c.kind='shifts' and s.id=c.id::uuid and s.status::text<>'active'
  and not exists(select 1 from public.position_shift_states p where p.shift_id=s.id)
  and not exists(select 1 from public.notes n where n.shift_id=s.id)
  and not exists(select 1 from public.messages m where m.shift_id=s.id);
 get diagnostics v_parents=row_count;
 delete from cron.job_run_details j using private.portal_history_retention_candidates() c
 where c.kind='cron_runs' and j.runid=c.id::bigint and j.end_time is not null and j.status in ('succeeded','failed');
 get diagnostics v_runs=row_count;
 return jsonb_build_object('dryRun',false,'cutoff',now()-interval '60 days','keepAtLeast',10,
  'deleted',jsonb_build_object('quiz_attempts',v_attempts,'audit_log',v_audit,'notes',v_notes,
   'position_shift_states',v_states,'shifts',v_parents,'cron_runs',v_runs));
end;
$body$;
revoke all on function private.cleanup_portal_history(boolean) from public,anon,authenticated,service_role;

-- Supabase pg_cron is GMT/UTC. Run at 03:15 NSK, after 03:00 window finalization.
do $schedule$
declare v_job record;
begin
 if coalesce(current_setting('cron.timezone',true),'GMT') not in ('GMT','UTC','Etc/UTC') then
  raise exception 'retention_cron_timezone_must_be_utc';
 end if;
 for v_job in select jobid from cron.job where jobname in ('beerfactory-handover-retention','bfstaff-history-retention') loop
  perform cron.unschedule(v_job.jobid);
 end loop;
 perform cron.schedule('bfstaff-history-retention','15 20 * * *','select private.cleanup_portal_history(false);');
end;
$schedule$;
