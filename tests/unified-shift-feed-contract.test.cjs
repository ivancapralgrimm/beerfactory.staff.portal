// Explicit local mocks and an isolated in-memory database. No production traffic.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./register-typescript.cjs');
let rpcHandler = async () => ({data: null, error: new Error('unconfigured fixture')});
let fromHandler = () => { throw new Error('unconfigured table fixture'); };
const mock = {
  rpc: (...args) => rpcHandler(...args),
  from: (...args) => fromHandler(...args),
  auth: { getSession: async () => ({data: {session: {user: {id: 'me'}}}}) },
  functions: { invoke: async () => ({data: null, error: null}) },
};
require.cache[require.resolve('../src/lib/supabase.ts')] = {exports: {supabase: mock}};
const shift = require('../src/features/shift/shift-api.ts');
const editor = require('../src/features/shift/checklist-editor-api.ts');
const feed = require('../src/features/feed/feed-api.ts');
const access = require('../src/types/auth.ts');

function deferred() { let resolve; const promise = new Promise(done => {resolve=done;}); return {promise, resolve}; }

test('shift workflow coalesces concurrent reads; writes await exact main position RPCs and propagate denial', async () => {
  const calls=[]; const gate=deferred();
  rpcHandler=(name,args)=>{ calls.push({name,args}); return gate.promise; };
  const first=shift.loadPositionShiftWorkflow(), second=shift.loadPositionShiftWorkflow();
  assert.equal(first,second); assert.equal(calls.length,1);
  gate.resolve({data:{context:{state:'available'},rows:[]},error:null});
  assert.deepEqual((await first).rows,[]);
  let completed=false; const mutation=deferred();
  rpcHandler=(name,args)=>{calls.push({name,args});return mutation.promise;};
  const pending=shift.confirmPositionShift('open').then(()=>{completed=true;});
  await Promise.resolve(); assert.equal(completed,false);
  assert.deepEqual(calls.at(-1),{name:'confirm_position_shift',args:{p_action:'open'}});
  mutation.resolve({data:{status:'active'},error:null}); await pending;
  rpcHandler=async(name,args)=>{calls.push({name,args});return {data:{completed:true},error:null};};
  await shift.setPositionShiftCheck({checkType:'opening',itemKey:'real-key',completed:true});
  assert.deepEqual(calls.at(-1),{name:'set_position_shift_check',args:{p_check_type:'opening',p_item_key:'real-key',p_completed:true}});
  const denied={message:'forbidden'}; rpcHandler=async()=>({data:null,error:denied});
  await assert.rejects(shift.confirmPositionShift('close'),error=>error===denied);
  assert.match(shift.shiftErrorMessage({message:'closing_incomplete'}),/Смена не закрыта.*серверного/);
});

test('checklist edits preserve revision, weekdays, position and groups; conflicts do not become successes', async () => {
  const calls=[];
  rpcHandler=async(name,args)=>{calls.push({name,args});return {data:{item_key:'item',revision:5},error:null};};
  await editor.saveChecklistDefinition({positionCode:'waiter_bb',itemKey:'item',checkType:'opening',label:'  Реальный пункт  ',critical:true,isActive:true,activeIsoWeekdays:[1,7],expectedRevision:4});
  assert.deepEqual(calls[0],{name:'save_checklist_definition',args:{p_position_code:'waiter_bb',p_item_key:'item',p_check_type:'opening',p_label:'Реальный пункт',p_critical:true,p_is_active:true,p_active_iso_weekdays:[1,7],p_group_key:null,p_group_label:null,p_expected_revision:4}});
  await editor.reorderChecklistDefinitions({positionCode:'waiter_bb',checkType:'opening',itemKeys:['b','a']});
  assert.deepEqual(calls[1].args,{p_position_code:'waiter_bb',p_check_type:'opening',p_item_keys:['b','a']});
  rpcHandler=async()=>({data:null,error:{message:'checklist_revision_conflict'}});
  await assert.rejects(editor.deleteChecklistDefinition({positionCode:'waiter_bb',itemKey:'item',expectedRevision:4}),error=>error.message==='checklist_revision_conflict');
  assert.equal(access.canManageChecklistsClient({role:'staff',position_code:'waiter_bb'}),false);
  assert.equal(access.canManageChecklistsClient({role:'senior',position_code:'waiter_bb'}),true);
  assert.equal(access.canManageChecklistsClient({role:'staff',is_owner:true}),true);
});

test('feed maps actual readers, preserves an inaccessible identity and keeps notification audience out of visibility', async () => {
  const notes=[{id:'note',author_id:'author',resolved_by:null,subject:'Тема',body:'Текст',priority:'critical',status:'new',notify_all:false,notify_positions:['bartender_bb'],created_at:'2026-10-30T10:00:00Z'}];
  const acknowledgements=[{note_id:'note',user_id:'reader',created_at:'2026-10-30T12:00:00Z'},{note_id:'note',user_id:'me',created_at:'2026-10-30T11:00:00Z'},{note_id:'note',user_id:'missing',created_at:'2026-10-30T13:00:00Z'}];
  const profiles=[{id:'author',first_name:'Анна',last_name:'Соколова',position:'Хостес'},{id:'reader',first_name:'Иван',last_name:'Петров',position:'Бармен BB'},{id:'me',first_name:'Ольга',last_name:'Орлова',position:'Официант BF'}];
  const lookups=[];
  fromHandler=table=>{ const query={
    select(){return query;},order(){return query;},limit:async()=>({data:notes,error:null}),
    in:async(field,ids)=>{lookups.push({table,field,ids});return {data:table==='profiles'?profiles.filter(row=>ids.includes(row.id)):acknowledgements,error:null};},
  };return query;};
  const posts=await feed.loadFeed();
  assert.equal(posts.length,1); assert.equal(posts[0].author.first_name,'Анна');
  assert.equal(posts[0].acknowledgementCount,3); assert.equal(posts[0].acknowledgedByMe,true);
  assert.deepEqual(posts[0].readers.map(reader=>reader.user_id),['me','reader','missing']);
  assert.equal(posts[0].readers[1].profile.last_name,'Петров');
  assert.equal(posts[0].readers[2].profile,null);
  assert.ok(lookups.some(call=>call.table==='profiles'&&call.ids.includes('reader')));
});

test('feed creation and acknowledgement use exact main payloads and reject server refusal', async () => {
  const calls=[]; rpcHandler=async(name,args)=>{calls.push({name,args});return {data:{id:'created'},error:null};};
  await feed.createFeedPost({subject:'Тема',body:'Текст',priority:'normal',notifyAll:true,notifyPositions:['manager']});
  assert.deepEqual(calls[0],{name:'create_feed_post',args:{p_subject:'Тема',p_body:'Текст',p_priority:'normal',p_notify_all:true,p_notify_positions:[]}});
  await feed.createFeedPost({subject:'Тема',body:'Текст',priority:'critical',notifyAll:false,notifyPositions:['hostess','waiter_bb']});
  assert.deepEqual(calls[1].args.p_notify_positions,['hostess','waiter_bb']);
  await feed.acknowledgeFeedPost('real-note'); await feed.resolveFeedPost('real-note');
  assert.deepEqual(calls.slice(2),[{name:'acknowledge_feed_post',args:{p_note_id:'real-note'}},{name:'resolve_handover',args:{p_note_id:'real-note'}}]);
  rpcHandler=async()=>({data:null,error:{message:'forbidden'}});
  await assert.rejects(feed.createFeedPost({subject:'Тема',body:'Текст',priority:'normal',notifyAll:true,notifyPositions:[]}),error=>error.message==='forbidden');
});

test('offline R22 SQL allows incomplete open/close while enforcing access, window, state and live template guards', async () => {
  const savedWindow=global.window; delete global.window;
  const {PGlite}=require('@electric-sql/pglite'); const db=new PGlite();
  try {
    await db.exec(`create schema auth; create schema private; create role anon; create role authenticated;
      create type public.staff_position as enum ('waiter_bb');
      create table public.position_shift_states(id uuid primary key,status text,opened_by uuid,opened_at timestamptz,closed_by uuid,closed_at timestamptz);
      create table public.position_shift_check_definitions(position_code public.staff_position,check_type text,is_active boolean,active_iso_weekdays smallint[]);
      create table public.position_shift_checks(completed boolean);
      insert into public.position_shift_checks values(false);
      insert into public.position_shift_check_definitions values('waiter_bb','opening',true,array[1,2,3,4,5,6,7]::smallint[]),('waiter_bb','closing',true,array[1,2,3,4,5,6,7]::smallint[]);
      insert into public.position_shift_states(id,status) values('00000000-0000-0000-0000-000000000001','not_started');
      create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000002'::uuid$$;
      create function private.current_role() returns text language sql as $$select nullif(coalesce(current_setting('bf.test_role',true),'staff'),'')$$;
      create function private.current_staff_position() returns public.staff_position language sql as $$select nullif(coalesce(current_setting('bf.test_position',true),'waiter_bb'),'')::public.staff_position$$;
      create function private.shift_window_context() returns jsonb language sql as $$select jsonb_build_object('window_state',coalesce(current_setting('bf.test_window',true),'open'),'operational_iso_weekday',5)$$;
      create function private.ensure_position_shift_state() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;`);
    await db.exec(fs.readFileSync(path.resolve(__dirname,'../../docs/patches/r22-allow-incomplete-position-shift.sql'),'utf8'));
    const confirm=async action=>(await db.query('select public.confirm_position_shift($1) as value',[action])).rows[0].value;
    assert.equal((await confirm('open')).status,'active');
    assert.equal((await confirm('close')).status,'closed');
    assert.deepEqual((await db.query('select completed from public.position_shift_checks')).rows,[{completed:false}]);
    await db.exec("set bf.test_role = ''"); await assert.rejects(confirm('open'),/forbidden/);
    await db.exec("set bf.test_role = 'staff'; set bf.test_position = ''"); await assert.rejects(confirm('open'),/position_required/);
    await db.exec("set bf.test_position = 'waiter_bb'; set bf.test_window = 'locked'"); await assert.rejects(confirm('open'),/shift_window_locked/);
    await db.exec("set bf.test_window = 'open'; update public.position_shift_states set status='not_started'");
    await assert.rejects(confirm('close'),/opening_not_confirmed/);
    await assert.rejects(confirm('invented'),/invalid_action/);
    await db.exec("update public.position_shift_check_definitions set is_active=false where check_type='opening'");
    await assert.rejects(confirm('open'),/checklist_not_configured/);
  } finally { await db.close(); global.window=savedWindow; }
});
