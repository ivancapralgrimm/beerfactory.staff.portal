// Exact authorized retention SQL in isolated PostgreSQL. No hosted queries/data.
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';import assert from 'node:assert/strict';
process.on('uncaughtException',e=>{console.error(e.message,e.query||'',e.where||'');process.exit(1)});
const db=new PGlite();const q=async(s,a=[]) => (await db.query(s,a)).rows;
const v=async s=>(await q(s))[0];let passed=0;
await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;create schema cron;
create table public.quiz_attempts(id uuid primary key default gen_random_uuid(),user_id uuid,category_id text,category text,created_at timestamptz,finished_at timestamptz,question_revisions jsonb default '[]');
create table public.attestation_question_versions(id uuid primary key default gen_random_uuid(),payload jsonb);
create table public.shifts(id uuid primary key default gen_random_uuid(),status text,shift_date date,created_at timestamptz,closed_at timestamptz);
create table public.position_shift_states(id uuid primary key default gen_random_uuid(),shift_id uuid references public.shifts on delete cascade,position_code text,status text,created_at timestamptz,closed_at timestamptz,expired_at timestamptz);
create table public.position_shift_checks(id uuid primary key default gen_random_uuid(),position_shift_id uuid references public.position_shift_states on delete cascade,label text);
create table public.shift_checks(id uuid primary key default gen_random_uuid(),shift_id uuid references public.shifts on delete cascade,label text);
create table public.notes(id uuid primary key default gen_random_uuid(),shift_id uuid references public.shifts on delete set null,category text,status text,is_resolved boolean,created_at timestamptz,resolved_at timestamptz);
create table public.feed_acknowledgements(note_id uuid references public.notes on delete cascade);
create table public.messages(id uuid primary key default gen_random_uuid(),shift_id uuid references public.shifts on delete set null);
create table public.audit_log(id uuid primary key default gen_random_uuid(),entity_type text,action text,metadata jsonb default '{}',created_at timestamptz);
create table cron.job(jobid bigserial primary key,jobname text,schedule text,command text);
create table cron.job_run_details(runid bigserial primary key,jobid bigint,end_time timestamptz,status text);
create function cron.schedule(text,text,text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command)values($1,$2,$3)returning jobid$$;
create function cron.unschedule(bigint) returns boolean language plpgsql as $$begin delete from cron.job where jobid=$1;return found;end$$;
insert into cron.job(jobname,schedule,command) values('beerfactory-handover-retention','15 3 1 * *','old');`);
const file=fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_r407_history_retention_60d_floor10.sql'));assert.ok(file);await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
const userA='10000000-0000-4000-8000-000000000001',userB='10000000-0000-4000-8000-000000000002';
async function attempts(n,user=userA,ticket='bar',age=90,legacy=null){await q(`insert into public.quiz_attempts(user_id,category_id,category,created_at,finished_at)select $1,$2,$4,now()-make_interval(days=>$3),now()-make_interval(days=>$3)from generate_series(1,$5)`,[user,ticket,age,legacy,n]);}
async function states(n,position='bartender',status='closed',age=90){
 for(let i=0;i<n;i++){const sh=(await q(`insert into public.shifts(status,shift_date,created_at,closed_at)values('not_started',current_date-$1::integer,now()-make_interval(days=>$1),null)returning id`,[age+i]))[0].id;const ps=(await q(`insert into public.position_shift_states(shift_id,position_code,status,created_at,closed_at,expired_at)values($1,$2,$3,now()-make_interval(days=>$4),case when $3='closed'then now()-make_interval(days=>$4)end,case when $3='expired'then now()-make_interval(days=>$4)end)returning id`,[sh,position,status,age+i]))[0].id;await q(`insert into public.position_shift_checks(position_shift_id,label)values($1,'stored snapshot')`,[ps]);}
}
async function notes(n,category='bar',age=90,resolved=true){await q(`insert into public.notes(category,status,is_resolved,created_at,resolved_at)select $1,case when $2 then 'resolved'else 'new'end,$2,now()-make_interval(days=>$3),case when $2 then now()-make_interval(days=>$3)end from generate_series(1,$4)`,[category,resolved,age,n]);}
const cleanup=async(dry=false)=>(await q('select private.cleanup_portal_history($1) as value',[dry]))[0].value;
const count=async table=>Number((await v('select count(*) as n from '+table)).n);
async function test(name,fn){await db.exec('begin');try{await fn();passed++;console.log('PASS '+name);}finally{await db.exec('rollback')}}
try{
await test('daily03:15NSK schedule replaces legacy cron; all cleanup entry points private',async()=>{
 const jobs=await q('select * from cron.job');assert.equal(jobs.length,1);assert.equal(jobs[0].jobname,'bfstaff-history-retention');assert.equal(jobs[0].schedule,'15 20 * * *');assert.match(jobs[0].command,/cleanup_portal_history\(false\)/);
 for(const role of['anon','authenticated','service_role'])for(const fn of['private.cleanup_portal_history(boolean)','private.cleanup_handover_history()','private.portal_history_retention_candidates()']){const x=await v(`select has_function_privilege('${role}','${fn}','EXECUTE') as allowed`);assert.equal(x.allowed,false);}
});
await test('attempt floor is independent per employee+ticket and legacy category; revisions remain',async()=>{
 await attempts(15);await attempts(3,userA,'kitchen');await attempts(12,userB);await attempts(12,userA,null,90,'legacy one');await attempts(12,userA,null,90,'legacy two');await db.exec(`insert into public.attestation_question_versions(payload)values('[]')`);
 await cleanup();const rows=await q('select user_id,category_id,category,count(*) as n from public.quiz_attempts group by user_id,category_id,category');assert.equal(rows.length,5);assert.deepEqual(rows.map(x=>Number(x.n)).sort((a,b)=>a-b),[3,10,10,10,10]);assert.equal(await count('public.attestation_question_versions'),1);
});
await test('exact60days survives, older60days drops, recently synced offline records survive',async()=>{
 await attempts(12,userA,'bar',1);
 const exact=(await q(`insert into public.quiz_attempts(user_id,category_id,created_at,finished_at)values($1,'bar',now()-interval'60 days',now()-interval'60 days')returning id`,[userA]))[0].id;
 const old=(await q(`insert into public.quiz_attempts(user_id,category_id,created_at,finished_at)values($1,'bar',now()-interval'60 days 1 second',now()-interval'60 days 1 second')returning id`,[userA]))[0].id;
 const offline=(await q(`insert into public.quiz_attempts(user_id,category_id,created_at,finished_at)values($1,'bar',now(),now()-interval'150 days')returning id`,[userA]))[0].id;
 await cleanup();const ids=(await q('select id from public.quiz_attempts')).map(x=>x.id);assert.ok(ids.includes(exact));assert.ok(ids.includes(offline));assert.ok(!ids.includes(old));
});
await test('perposition terminal floor keeps live,unstarted and rare history; child snapshots follow only deleted states',async()=>{
 await states(15);await states(12,'waiter','expired');await states(4,'hostess');await states(1,'bartender','active',150);await states(1,'bartender','not_started',150);
 await cleanup();const rows=await q('select position_code,status,count(*) as n from public.position_shift_states group by position_code,status');assert.equal(rows.find(x=>x.position_code==='bartender'&&x.status==='closed').n,10);assert.equal(rows.find(x=>x.position_code==='waiter').n,10);assert.equal(rows.find(x=>x.position_code==='hostess').n,4);assert.equal(await count('public.position_shift_checks'),26);assert.equal(await count('public.position_shift_states'),26);
});
await test('parent FK cascades cannot erase another position retained results,notes or messages',async()=>{
 await states(15);const oldest=(await v('select id from public.shifts order by shift_date limit 1')).id;
 await q(`insert into public.position_shift_states(shift_id,position_code,status,created_at,closed_at)values($1,'rare','closed',now()-interval'150 days',now()-interval'150 days')`,[oldest]);
 const ids=(await q('select id from public.shifts order by shift_date limit 3')).map(x=>x.id);
 await q(`insert into public.notes(shift_id,category,status,is_resolved,created_at)values($1,'other','new',false,now()-interval'150 days')`,[ids[1]]);
 await q('insert into public.messages(shift_id)values($1)',[ids[2]]);await cleanup();for(const id of ids)assert.equal((await q('select count(*)as n from public.shifts where id=$1',[id]))[0].n,1);
 assert.equal((await v(`select count(*)as n from public.position_shift_states where position_code='rare'`)).n,1);
});
await test('legacy checklist header floor retains ten snapshots, extra children cascade',async()=>{
 for(let i=0;i<15;i++){const s=(await q(`insert into public.shifts(status,shift_date,created_at,closed_at)values('closed',current_date-$1::integer,now()-make_interval(days=>$1),now()-make_interval(days=>$1))returning id`,[90+i]))[0].id;await q(`insert into public.shift_checks(shift_id,label)values($1,'legacy snapshot')`,[s]);}
 await cleanup();assert.equal(await count('public.shifts'),10);assert.equal(await count('public.shift_checks'),10);
});
await test('Feed floor percategory; unresolved and newly resolved remain,ack cascades only deleted notes',async()=>{
 await notes(15);await notes(3,'rare');await notes(1,'bar',150,false);await db.exec('insert into public.feed_acknowledgements select id from public.notes');await cleanup();assert.equal(await count('public.notes'),14);assert.equal(await count('public.feed_acknowledgements'),14);assert.equal((await v('select count(*)as n from public.notes where is_resolved=false')).n,1);
 await notes(12,'young',1);await q(`insert into public.notes(category,status,is_resolved,created_at,resolved_at)values('young','resolved',true,now()-interval'180days',now()-interval'2days')`);await cleanup();assert.equal((await v(`select count(*)as n from public.notes where category='young'`)).n,13);
});
await test('old callable handover cleanup enforces same floor,never touches other histories',async()=>{
 await notes(15);await notes(1,'bar',150,false);await attempts(15);assert.equal((await v('select private.cleanup_handover_history()as n')).n,5);assert.equal(await count('public.notes'),11);assert.equal(await count('public.quiz_attempts'),15);
});
await test('audit floors match staff/portal UI groups and protect each position summary',async()=>{
 for(const [type,action,metadata,n]of[['profile','profile_role_update',{},13],['recipe','recipe_governance_update',{},14],['position_shift_window_summary','operational_critical_update',{position_code:'bartender'},15],['position_shift_window_summary','operational_critical_update',{position_code:'rare'},2]])await q(`insert into public.audit_log(entity_type,action,metadata,created_at)select $1,$2,$3,now()-interval'90days'from generate_series(1,$4)`,[type,action,metadata,n]);
 await cleanup();assert.equal(await count('public.audit_log'),32);
});
await test('Cron retention keeps ten finished perjob,all running and rare histories',async()=>{
 await db.exec(`insert into cron.job_run_details(jobid,end_time,status)select 1,now()-interval'90days','succeeded'from generate_series(1,15);insert into cron.job_run_details(jobid,end_time,status)select 2,now()-interval'90days','failed'from generate_series(1,4);insert into cron.job_run_details(jobid,status)values(1,'running')`);await cleanup();assert.equal(await count('cron.job_run_details'),15);
});
await test('dry run is default and null-safe; cleanup stable on timestamp ties and idempotent',async()=>{
 await attempts(15);const keep=(await q('select id from public.quiz_attempts order by finished_at desc,created_at desc,id desc limit10'.replace('limit10','limit 10'))).map(x=>x.id).sort();
 const dry=(await v('select private.cleanup_portal_history() as r')).r;assert.equal(dry.dryRun,true);assert.equal(dry.eligible.quiz_attempts,5);assert.equal(await count('public.quiz_attempts'),15);assert.equal((await cleanup(null)).dryRun,true);
 await cleanup();assert.deepEqual((await q('select id from public.quiz_attempts')).map(x=>x.id).sort(),keep);const again=await cleanup();assert.ok(Object.values(again.deleted).every(x=>x===0));
});
await test('inconsistent resolution flags are preserved rather than guessed',async()=>{
 await notes(15);
 await db.exec(`insert into public.notes(category,status,is_resolved,created_at,resolved_at)values
 ('bar','resolved',false,now()-interval'150days',now()-interval'150days'),
 ('bar','new',true,now()-interval'150days',now()-interval'150days')`);
 await cleanup();assert.equal(await count('public.notes'),12);
 assert.equal((await v("select count(*)as n from public.notes where (status='resolved') is distinct from is_resolved")).n,2);
});
await test('recent completion and current parent date protect otherwise old terminal rows',async()=>{
 await states(12,'bartender','closed',80);
 const old=(await q('select id,shift_id from public.position_shift_states order by created_at limit1'.replace('limit1','limit 1')))[0];
 await q('update public.position_shift_states set closed_at=now() where id=$1',[old.id]);
 const parent=(await q('select id from public.shifts order by shift_date limit1 offset1'.replace('limit1 offset1','limit 1 offset 1')))[0].id;
 await q('update public.shifts set shift_date=current_date where id=$1',[parent]);
 await cleanup();assert.equal(await count('public.position_shift_states'),11);
 assert.equal((await q('select count(*)as n from public.position_shift_states where id=$1',[old.id]))[0].n,1);
 assert.equal((await q('select count(*)as n from public.position_shift_states where shift_id=$1',[parent]))[0].n,1);
});
console.log(passed+' retention PostgreSQL scenarios passed');
}finally{await db.close()}
