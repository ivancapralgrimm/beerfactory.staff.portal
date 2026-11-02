const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync(require('node:path').join(__dirname,'../supabase/functions/material-media-cleanup/index.ts'),'utf8').replace(/^import .*;\n/gm,'');
function load({storageError=false,finishError=false,claimError=false}={}){
 let handler;const calls=[];
 const client={rpc:async(name,args)=>{calls.push({name,args});return name==='claim_knowledge_media_cleanup'?{data:[{id:'job',storage_path:'managed/old.jpg',claim_token:'claim'}],error:claimError?{}:null}:{data:null,error:finishError?{}:null};},storage:{from:bucket=>({remove:async paths=>{calls.push({bucket,paths});return {error:storageError?{}:null};}})}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{Deno:{env:{get:name=>name==='SUPABASE_SERVICE_ROLE_KEY'?'private':'https://project.invalid'},serve:fn=>{handler=fn;}},createClient:()=>client,Response});
 return {handler,calls};
}
const request=(token='private',method='POST')=>new Request('https://edge.invalid/material-media-cleanup',{method,headers:{Authorization:'Bearer '+token}});
test('private endpoint rejects unauthorized callers and non-POST before any upstream call',async()=>{const h=load();assert.equal((await h.handler(request('user'))).status,401);assert.equal((await h.handler(request('private','GET'))).status,405);assert.equal(h.calls.length,0);});
test('Storage API physically removes claimed path before leased SQL completion',async()=>{const h=load();const r=await h.handler(request());assert.equal(r.status,200);assert.deepEqual(await r.json(),{completed:1,failed:0});assert.equal(h.calls[1].bucket,'knowledge-media');assert.deepEqual([...h.calls[1].paths],['managed/old.jpg']);assert.equal(h.calls[2].name,'finish_knowledge_media_cleanup');assert.equal(h.calls[2].args.p_claim_token,'claim');assert.equal(h.calls[2].args.p_error,null);});
test('physical deletion failure is recorded for retry and never reported as complete',async()=>{const h=load({storageError:true});const r=await h.handler(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{completed:0,failed:1});assert.equal(h.calls[2].args.p_error,'storage_remove_failed');});
test('SQL completion failure also returns an incomplete result',async()=>{const h=load({finishError:true});const r=await h.handler(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{completed:0,failed:1});});
test('failed claim cannot remove unclaimed storage paths',async()=>{const h=load({claimError:true});assert.equal((await h.handler(request())).status,503);assert.equal(h.calls.length,1);});
