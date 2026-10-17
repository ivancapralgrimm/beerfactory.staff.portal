const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

// Run from the repository root after copying files from this archive.
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const TS = (() => {
  try { return require('typescript'); }
  catch {
    const bin = fs.realpathSync(execFileSync('which', ['tsc'], {encoding:'utf8'}).trim());
    return require(path.resolve(path.dirname(bin), '../lib/typescript.js'));
  }
})();

function loadServerless(mockFetch) {
  const raw = read('api/recipes/menu.js');
  const transformed = raw.replace('export default async function handler', 'async function handler');
  return new Function('fetch','setTimeout','clearTimeout','AbortController', transformed + '\nreturn handler;')(
    mockFetch,setTimeout,clearTimeout,AbortController
  );
}
function responseCapture() {
  const headers = {};
  const response = {
    headers, statusCode: 200, body: '',
    setHeader(k,v) { headers[k.toLowerCase()] = v; },
    end(v) { this.body = v; }
  };
  return response;
}
function loadAdminApi(mockFetch) {
  const raw = read('src/features/admin/recipe-admin-api.ts');
  const output = TS.transpileModule(raw, {compilerOptions:{module:TS.ModuleKind.CommonJS,target:TS.ScriptTarget.ES2022}}).outputText;
  const ctx = {exports:{},module:{exports:{}},fetch:mockFetch,FormData,File:global.File};
  ctx.module.exports=ctx.exports;
  ctx.require = spec => {
    if(spec==='@/lib/config')return {config:{recipeApiBase:'/api/recipes'}};
    throw Error('Unexpected runtime import: '+spec);
  };
  vm.runInNewContext(output,ctx,{filename:'recipe-admin-api.compiled.js'});
  return ctx.module.exports;
}

test('menu proxy explicitly disables CDN and browser caching', async () => {
  let upstreamValue = 'Актуальный';
  const observed = [];
  const handler = loadServerless(async (url,opts) => {
    observed.push({url,opts});
    return {ok:true,json:async()=>({recipes:[{id:'bar:12',source:'bar',recordId:'12',venue:'BF',status:upstreamValue,name:'Рецепт'}]})};
  });
  const resA=responseCapture();
  await handler({method:'GET'},resA);
  assert.equal(resA.statusCode,200);
  assert.match(resA.headers['cache-control'],/no-store/);
  assert.equal(resA.headers['vercel-cdn-cache-control'],'no-store');
  assert.equal(resA.headers['cdn-cache-control'],'no-store');
  assert.equal(JSON.parse(resA.body).recipes[0].status,'Актуальный');
  upstreamValue='Архив';
  const resB=responseCapture();
  await handler({method:'GET'},resB);
  assert.equal(JSON.parse(resB.body).recipes[0].status,'Архив');
  assert.equal(observed.length,2);
  assert.equal(observed[0].opts.cache,'no-store');
});

test('menu proxy preserves BF, BB, BF/BB and kitchen category behavior', async()=>{
  const handler=loadServerless(async()=>({ok:true,json:async()=>({recipes:[
    {source:'kitchen',recordId:3,name:'Горячее',venue:'BB/BF',status:'Архив'},
    {source:'bar',recordId:4,name:'Лимонад',venue:'BB',status:'Актуальный'}
  ]})}));
  const res=responseCapture();await handler({method:'GET'},res);
  const data=JSON.parse(res.body);
  assert.equal(data.recipes[0].venue,'BF/BB');
  assert.equal(data.recipes[0].category,'Кухня BF/BB');
  assert.equal(data.recipes[1].venue,'BB');
});

test('cache is disabled even for error responses and method-not-allowed', async()=>{
  const handler=loadServerless(async()=>({ok:false,status:502}));
  const r=responseCapture();await handler({method:'GET'},r);
  assert.equal(r.statusCode,502);
  assert.match(r.headers['cache-control'],/no-store/);
  const w=responseCapture();await handler({method:'PATCH'},w);
  assert.equal(w.statusCode,405);
  assert.match(w.headers['cache-control'],/no-store/);
});

test('archive/restore writes happen once and trigger no extra client GETs', async()=>{
  const calls=[];
  const api=loadAdminApi(async (url,opts)=>{
    calls.push({url,opts});
    return {ok:true,status:200,json:async()=>({ok:true,id:'bar:5',recordId:'5',source:'bar'})};
  });
  await api.setAdminRecipeStatus('test-token','bar','5','Архив');
  assert.equal(calls.length,1,'a single PATCH, no shadow read racing UI reload');
  assert.equal(calls[0].opts.method,'PATCH');
  assert.equal(JSON.parse(calls[0].opts.body).status,'Архив');
  await api.setAdminRecipeStatus('test-token','bar','5','Актуальный');
  assert.equal(calls.length,2);
  assert.equal(JSON.parse(calls[1].opts.body).status,'Актуальный');
});

test('editor venue/status PATCH is sent once with expected payload', async()=>{
  const calls=[];
  const api=loadAdminApi(async (url,opts)=>{
    calls.push({url,opts});
    return {ok:true,status:200,json:async()=>({ok:true,id:'kitchen:7',recordId:'7',source:'kitchen'})};
  });
  await api.updateAdminRecipe('test-token','7',{
    source:'kitchen',name:'Суп',category:'Кухня',status:'Актуальный',venue:'BF/BB',
    description:'Технология',ingredients:'',method:'',serving:'250г',tags:'',changeNote:'смена заведения'
  });
  assert.equal(calls.length,1);
  const form=calls[0].opts.body;
  const payload=JSON.parse(form.get('payload'));
  assert.equal(payload.venue,'BF/BB');
  assert.equal(payload.status,'Актуальный');
  assert.equal(calls[0].url,'/api/recipes/admin/recipes/kitchen/7');
});

test('Worker failure is propagated without a second write', async()=>{
  const calls=[];
  const api=loadAdminApi(async (url,opts)=>{
    calls.push({url,opts});
    return {ok:false,status:403,json:async()=>({ok:false,error:'nocodb_write_failed'})};
  });
  await assert.rejects(api.setAdminRecipeStatus('test-token','bar','5','Архив'),error=>error.code==='nocodb_write_failed');
  assert.equal(calls.length,1);
});

test('hook ignores a slow initial GET after a newer forced reload', async()=>{
  const raw=read('src/features/recipes/use-recipes.ts');
  const output=TS.transpileModule(raw,{compilerOptions:{module:TS.ModuleKind.CommonJS,target:TS.ScriptTarget.ES2022}}).outputText;
  let getCount=0;
  const requests=[];
  const loadRecipes=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));
  let stateIndex=0;
  const memory=[];
  const react={
    useState(initial) { const i=stateIndex++;memory[i]=initial;return [memory[i],next=>{memory[i]=typeof next==='function'?next(memory[i]):next;}]; },
    useRef(value) { return {current:value}; },
    useCallback(fn) {return fn;},
    useEffect(fn) { fn(); }
  };
  const exports={};
  const ctx={exports,module:{exports},require(spec){
    if(spec==='react')return react;
    if(spec==='@/features/recipes/recipe-data')return {loadRecipes};
    throw Error('Unexpected import '+spec);
  }};
  vm.runInNewContext(output,ctx,{filename:'use-recipes.compiled.js'});
  const hook=exports.useRecipes();
  assert.equal(requests.length,1);
  const next=hook.reload();
  assert.equal(requests.length,2);
  requests[1].resolve({source:'api',recipes:[{status:'Архив'}]});
  await next;
  requests[0].resolve({source:'api',recipes:[{status:'Актуальный'}]});
  await new Promise(r=>setImmediate(r));
  assert.equal(memory[0].data.recipes[0].status,'Архив');
});
