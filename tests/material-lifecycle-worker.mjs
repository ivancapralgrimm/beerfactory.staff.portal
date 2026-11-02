// Execute the actual Worker + Durable Object with private upstream contract mocks.
import assert from 'node:assert/strict';
import worker,{RecipeMaterialWriter} from '../cloudflare/worker-recipe-editor-v5.js';
const user='10000000-0000-4000-8000-000000000001';
const response=(data,status=200)=>Response.json(data,{status});
let rows,operations,calls,failComplete,failCleanup,cleanupReady,patchDelay,activeWrites,maxWrites;
const reset=()=>{rows=new Map([['1',{Id:1,Название:'Recipe',Категория:'Бар',Статус:'Актуальный',Версия:'1',Заведение:'BF',Фото:[{path:'managed/old.jpg'}]}]]);operations=new Map();calls=[];failComplete=false;failCleanup=false;cleanupReady=true;patchDelay=0;activeWrites=0;maxWrites=0;};
reset();
const env={NOCODB_BASE_URL:'https://noco.invalid',NOCODB_READ_TOKEN:'read',NOCODB_WRITE_TOKEN:'write',SUPABASE_URL:'https://supabase.invalid',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private',MATERIAL_LIFECYCLE_ENABLED:'true'};
env.RECIPE_PHOTO_CLEANUP={fetch:async request=>{const url=new URL(request.url);if(url.pathname==='/capabilities') return response({schemaVersion:1,physicalCleanup:cleanupReady,durableReconciliation:cleanupReady});const data=await request.json();calls.push({cleanup:data});if(data.command==='complete'&&failCleanup){failCleanup=false;return response({error:'retry'},503);}return response({ok:true,operationId:data.operationId,phase:data.command==='prepare'?'prepared':'completed'});}};
const objects=new Map();env.RECIPE_MATERIAL_WRITER={idFromName:name=>name,get:name=>{if(!objects.has(name))objects.set(name,new RecipeMaterialWriter({},env));return objects.get(name);}};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{const url=new URL(typeof input==='string'?input:input.url);const method=init.method||'GET';const body=init.body?JSON.parse(init.body):null;calls.push({url:url.pathname,method,body});
 if(url.pathname==='/auth/v1/user')return init.headers.Authorization==='Bearer user'?response({id:user}):response({},401);
 if(url.pathname==='/rest/v1/rpc/recipe_editor_access_context')return response([{user_id:user,is_active:true,can_manage_recipes:true,display_name:'Manager'}]);
 if(url.pathname==='/rest/v1/audit_log')return new Response(null,{status:201});
 if(url.pathname==='/rest/v1/rpc/recipe_material_lifecycle_v1'){
  const cmd=body.p_command,id=body.p_operation_id;let op=operations.get(id);
  if(cmd==='capabilities')return response({schemaVersion:1,recipeLifecycle:true});
  if(cmd==='get')return response(op||null);
  if(cmd==='pending')return response([...operations.values()].find(o=>o.source_ref===body.p_source_ref&&o.phase==='prepared')||null);
  if(cmd==='restore')return response({restored:true});
  if(cmd==='prepare'){op={id,actor_id:user,source_ref:body.p_source_ref,action:body.p_action,expected_version:body.p_expected_version,mutation:body.p_mutation,phase:'prepared',result:{affectedQuestions:2,affectedTickets:1}};operations.set(id,op);return response(op);}
  if(cmd==='complete'){if(failComplete){failComplete=false;return response({message:'offline'},503);}op.phase='completed';return response(op);}
 }
 if(url.host==='noco.invalid'){
  const id=url.pathname.match(/\/records\/([^/]+)$/)?.[1];
  if(method==='GET'&&id)return rows.has(id)?response(rows.get(id)):response({},404);
  if(method==='GET')return response({list:[...rows.values()]});
  if(method==='PATCH'||method==='DELETE'){
   activeWrites++;maxWrites=Math.max(maxWrites,activeWrites);if(patchDelay)await new Promise(r=>setTimeout(r,patchDelay));
   const record=Array.isArray(body)?body[0]:body,key=String(record.Id);
   if(method==='DELETE')rows.delete(key);else rows.set(key,{...rows.get(key),...record});activeWrites--;return response(record);
  }
 }
 throw Error('Unexpected request '+url+' '+method);
};
let counter=0;
const opId=()=>`40000000-0000-4000-8000-${String(++counter).padStart(12,'0')}`;
const request=(method='PATCH',payload={status:'Архив',expected_version:'1',confirm_material_lifecycle:true},id=opId(),token='user')=>new Request('https://worker.invalid/admin/recipes/bar/1',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify(payload)});
const run=async(req,override={})=>{const target={...env,...override};if(Object.keys(override).length && target.RECIPE_MATERIAL_WRITER){target.RECIPE_MATERIAL_WRITER={idFromName:n=>n,get:()=>new RecipeMaterialWriter({},target)};}const r=await worker.fetch(req,target);return {status:r.status,body:await r.json()};};
const writes=()=>calls.filter(c=>c.url?.startsWith('/api/')&&['PATCH','DELETE'].includes(c.method));
let passed=0;
const test=async(name,fn)=>{reset();await fn();passed++;console.log('PASS '+name);};
try{
 await test('capability is false without all activated private backends',async()=>{const r=await run(new Request('https://worker.invalid/'),{MATERIAL_LIFECYCLE_ENABLED:'false'});assert.equal(r.body.capabilities.materialLifecycle,false);assert.equal(r.body.capabilities.photoCleanup,false);const noBinding=await run(new Request('https://worker.invalid/'),{RECIPE_PHOTO_CLEANUP:undefined});assert.equal(noBinding.body.capabilities.materialLifecycle,false);});
 await test('legacy archive/delete fail closed before writes when lifecycle is absent',async()=>{const r=await run(request(),{MATERIAL_LIFECYCLE_ENABLED:'false'});assert.equal(r.status,503);assert.equal(writes().length,0);const d=await run(request('DELETE',{}),{MATERIAL_LIFECYCLE_ENABLED:'false'});assert.equal(d.status,503);assert.equal(writes().length,0);});
 await test('authentication, confirmation, idempotency and stale versions reject before mutation',async()=>{assert.equal((await run(request('PATCH',undefined,opId(),'bad'))).status,401);assert.equal((await run(request('PATCH',{status:'Архив'}))).status,400);assert.equal((await run(request('PATCH',{status:'Архив',confirm_material_lifecycle:true,expected_version:'1'},'invalid'))).status,400);assert.equal((await run(request('PATCH',{status:'Архив',confirm_material_lifecycle:true,expected_version:'old'}))).status,409);assert.equal(writes().length,0);assert.equal(operations.size,0);});
 await test('archive returns durable cascade completion; replay never writes twice',async()=>{const id=opId();const first=await run(request('PATCH',undefined,id));assert.equal(first.status,200);assert.equal(first.body.materialLifecycle.phase,'completed');assert.equal(first.body.materialLifecycle.affectedQuestions,2);assert.equal(first.body.recipe.status,'Архив');assert.equal(rows.get('1').Версия,'2');const replay=await run(request('PATCH',undefined,id));assert.deepEqual(replay.body,first.body);assert.equal(writes().length,1);const conflict=await run(request('PATCH',{status:'Архив',confirm_material_lifecycle:true,expected_version:'2'},id));assert.equal(conflict.status,409);});
 await test('SQL completion interruption resumes exact prepared patch without a second NocoDB write',async()=>{const id=opId();failComplete=true;const first=await run(request('PATCH',undefined,id));assert.equal(first.status,503);assert.equal(operations.get(id).phase,'prepared');const retry=await run(request('PATCH',undefined,id));assert.equal(retry.status,200);assert.equal(writes().length,1);});
 await test('physical cleanup failure cannot return delete success; exact retry works after row removal',async()=>{const id=opId();failCleanup=true;const payload={confirm_material_lifecycle:true,expected_version:'1'};const first=await run(request('DELETE',payload,id));assert.equal(first.status,503);assert.equal(rows.has('1'),false);assert.equal(operations.get(id).phase,'prepared');const retry=await run(request('DELETE',payload,id));assert.equal(retry.status,200);assert.equal(retry.body.deleted,true);assert.equal(retry.body.materialLifecycle.phase,'completed');assert.equal(writes().length,1);const reservation=calls.findIndex(c=>c.cleanup?.command==='prepare'),deletion=calls.findIndex(c=>c.method==='DELETE');assert.ok(reservation<deletion);});
 await test('per-recipe Durable Object serializes competing archive versions',async()=>{patchDelay=10;const result=await Promise.all([run(request()),run(request())]);assert.deepEqual(result.map(r=>r.status).sort(),[200,409]);assert.equal(writes().length,1);assert.equal(maxWrites,1);});
 await test('dependency outage blocks ordinary edits when a prepared operation must be protected',async()=>{const id=opId();failComplete=true;await run(request('PATCH',undefined,id));cleanupReady=false;const r=await run(request('PATCH',{status:'Актуальный'}));assert.equal(r.status,409);assert.equal(writes().length,1);});
 await test('photo removal refuses to write without physical cleanup capability',async()=>{cleanupReady=false;const r=await run(request('PATCH',{name:'Recipe',category:'Бар',status:'Актуальный',venue:'BF',ingredients:'',method:'',serving:'',tags:'',remove_photo:true}));assert.equal(r.status,503);assert.equal(writes().length,0);});
 console.log(`${passed} actual Worker/DO scenarios passed with mocked upstreams.`);
}finally{globalThis.fetch=originalFetch;}
