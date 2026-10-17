const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const file = path.join(__dirname, '..', 'src/features/attestation/attestation-data.ts');
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const question = (id) => ({ id, q: `${id}?`, group: id, topic: 'Основы', revision: 1,
  answers: [1,2,3,4].map(i => ({text:`Answer ${id}-${i}`,correct:i===1})) });
const legacy = (id='bar') => ({passPercent:80,questionsPerTest:15,revision:1,
  categories: [{id,label:'Бар',questionsPerTest:2,questions:[question('q1'),question('q2')],ticketPlan:[{topic:'Основы',count:2}]}]});
const current = () => ({schemaVersion:3,passPercent:80,questionsPerTest:15,revision:2,
  categories:[{id:'bar-bf',label:'Бар BF',knowledgeType:'bar',venue:'bf',specificQuestionCount:null,
  questionsPerTest:2,questions:[{...question('q1'),knowledgeType:'bar',venue:'bf'},{...question('q2'),knowledgeType:'bar',venue:'bf'}],
  ticketPlan:[{topic:'Основы',count:2}]}]});
function runtime(handler) {
  const calls=[], cached=[];
  const supabase = {rpc: async (name) => {calls.push(name);return handler(name)}};
  const exports = {};
  vm.runInNewContext(code,{exports,require:(name) => {
    if(name==='@/lib/supabase') return {supabase};
    if(name==='@/features/attestation/attestation-offline') return {
      cacheAttestationBank: async (bank) => {cached.push(bank)}, readCachedAttestationBank:async()=>null
    };
    throw new Error(`Unexpected import ${name}`);
  },Math,Map,Set,Error,Number,JSON,String,Date,Promise,console});
  return {exports,calls,cached};
}
const notYet = {data:null,error:{code:'PGRST202',message:'Could not find the function public.get_attestation_bank_v3'}};
test('Missing v3 RPC safely retains the four canonical BF tickets without saving synthetic cache',async()=>{
  const r=runtime(name => name==='get_attestation_bank_v3'?notYet:{data:legacy(),error:null});
  const bank=await r.exports.loadQuestionBank();
  assert.equal(bank.legacyCompatibility,true);
  assert.equal(bank.categories[0].venue,'bf');
  assert.equal(bank.categories[0].knowledgeType,'bar');
  assert.equal(r.exports.buildQuizTicket(bank.categories[0]).length,2);
  assert.deepEqual(r.calls,['get_attestation_bank_v3','get_attestation_bank']);
  assert.equal(r.cached.length,0);
});
test('Unknown legacy category is never silently classified or dropped',async()=>{
  const r=runtime(name => name==='get_attestation_bank_v3'?notYet:{data:legacy('bistro'),error:null});
  await assert.rejects(r.exports.loadQuestionBank(),/question_bank_legacy_unsupported/);
  assert.equal(r.cached.length,0);
});
test('Forbidden and connection errors cannot fall back to legacy RPC',async()=>{
  for(const error of [{code:'42501',message:'forbidden'}, {code:'PGRST301',message:'JWT expired'}, {message:'fetch failed'}]) {
    const r=runtime(()=>({data:null,error}));
    await assert.rejects(r.exports.loadQuestionBank(),/question_bank_online_unavailable/);
    assert.deepEqual(r.calls,['get_attestation_bank_v3']);
  }
});
test('Force-refresh sees server v3 after migration and caches only real v3',async()=>{
  let migrated=false;
  const r=runtime(name=>name==='get_attestation_bank_v3'?(migrated?{data:current(),error:null}:notYet):{data:legacy(),error:null});
  const old=await r.exports.loadQuestionBank();assert.equal(old.legacyCompatibility,true);
  migrated=true;
  const upgraded=await r.exports.loadQuestionBank({force:true});
  assert.equal(upgraded.legacyCompatibility,undefined);
  assert.equal(upgraded.categories[0].id,'bar-bf');
  await Promise.resolve();await Promise.resolve();
  assert.equal(r.cached.length,1);
  assert.equal(r.cached[0].categories[0].id,'bar-bf');
});
test('Network errors never reclassify a persisted v2 bank as v3',async()=>{
  const r=runtime(()=>({data:null,error:{code:'NETWORK_ERROR',message:'offline'}}));
  await assert.rejects(r.exports.loadQuestionBank(),/question_bank_online_unavailable/);
  assert.equal(r.cached.length,0);
});
test('Editor reports missing server migration instead of generic connection failure', () => {
  const api = fs.readFileSync(path.join(__dirname,'..','src/features/attestation/attestation-editor-api.ts'),'utf8');
  const settings = fs.readFileSync(path.join(__dirname,'..','src/features/attestation/AttestationSettingsAdminPanel.tsx'),'utf8');
  const bank = fs.readFileSync(path.join(__dirname,'..','src/features/attestation/AttestationBankAdminPanel.tsx'),'utf8');
  assert.match(api,/attestation_server_upgrade_required/);
  assert.match(settings,/База аттестации ещё не обновлена/);
  assert.match(bank,/Редактор банка ещё недоступен/);
});
test('Partially migrated legacy questions are rejected instead of re-labeled as BF',async()=>{
  const mixed=legacy();mixed.categories[0].questions[0].venue='bb';
  const r=runtime(name=>name==='get_attestation_bank_v3'?notYet:{data:mixed,error:null});
  await assert.rejects(r.exports.loadQuestionBank(),/question_bank_legacy_unsupported/);
});
test('Legacy permission failure does not produce a fake compatibility ticket',async()=>{
  const r=runtime(name=>name==='get_attestation_bank_v3'?notYet:{data:null,error:{code:'42501',message:'forbidden'}});
  await assert.rejects(r.exports.loadQuestionBank(),/question_bank_online_unavailable/);
  assert.equal(r.cached.length,0);
});
