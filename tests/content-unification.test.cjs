const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
require('./register-typescript.cjs');
const model = require('../src/features/knowledge/editor/article-model.ts');
const rich = require('../src/features/knowledge/editor/rich-text.ts');
const presentation = require('../src/features/recipes/recipe-presentation.ts');

function loadApi(file, dependencies) {
  const filename = path.resolve(__dirname, '../src', file);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: filename,
  }).outputText;
  const context = { exports: {}, module: {exports: {}}, FormData, File, AbortController, setTimeout: dependencies.setTimeout || setTimeout, clearTimeout: dependencies.clearTimeout || clearTimeout, fetch: dependencies.fetch,
    require(name) { if (name in dependencies) return dependencies[name]; throw Error('Unexpected runtime import: ' + name); } };
  context.module.exports = context.exports;
  vm.runInNewContext(output, context, { filename });
  return context.module.exports;
}
const input = {source:'bar',name:' Содовая ',category:'Лимонад',status:'Актуальный',venue:'BF/BB',description:'',ingredients:'Джин 40 мл\nЛёд — полный бокал',method:'Смешать',serving:'',tags:'летний, цитрус',changeNote:''};
const success = {ok:true,id:'bar:7',recordId:'7',source:'bar'};

test('recipe writes await the real transport, preserve full fields and reject malformed success', async () => {
  let release, observed;
  const gate = new Promise(resolve => {release = resolve;});
  const api = loadApi('features/admin/recipe-admin-api.ts', {'@/lib/config':{config:{recipeApiBase:'http://localhost/recipes'}},
    fetch: async (url, init) => {observed={url,init}; await gate; return {ok:true,status:200,json:async()=>success};} });
  let completed = false;
  const pending = api.createAdminRecipe('fixture-token', input).then(value => {completed=true;return value;});
  await Promise.resolve(); assert.equal(completed,false);
  assert.equal(observed.init.headers.Authorization,'Bearer fixture-token');
  const payload=JSON.parse(observed.init.body.get('payload'));
  assert.equal(payload.name,'Содовая'); assert.equal(payload.serving,''); assert.equal(payload.venue,'BF/BB');
  assert.equal(payload.ingredients,input.ingredients); assert.equal(payload.tags,input.tags);
  release(); assert.equal((await pending).id,'bar:7');
  const invalid=loadApi('features/admin/recipe-admin-api.ts', {'@/lib/config':{config:{recipeApiBase:'http://localhost/recipes'}},fetch:async()=>({ok:true,status:200,json:async()=>({ok:true})})});
  await assert.rejects(invalid.createAdminRecipe('fixture-token',input), {code:'recipe_write_response_invalid'});
});

test('recipe lifecycle carries revision and idempotency key; pending or wrong completion never succeeds', async () => {
  const calls=[]; let result={...success,materialLifecycle:{operationId:'fixture-operation',phase:'pending',affectedQuestions:2,affectedTickets:1}};
  const api=loadApi('features/admin/recipe-admin-api.ts', {'@/lib/config':{config:{recipeApiBase:'http://localhost/recipes'}},fetch:async(url,init)=>{calls.push({url,init});return {ok:true,status:200,json:async()=>result};}});
  const lifecycle={expectedVersion:'r8',operationId:'fixture-operation'};
  await assert.rejects(api.setAdminRecipeStatus('token','bar','7','Архив',lifecycle),{code:'recipe_material_lifecycle_incomplete'});
  assert.equal(calls[0].init.headers['Idempotency-Key'],'fixture-operation');
  assert.deepEqual(JSON.parse(calls[0].init.body),{status:'Архив',change_note:'Перемещён в архив',confirm_material_lifecycle:true,expected_version:'r8'});
  result.materialLifecycle.phase='completed';
  await api.deleteAdminRecipe('token','bar','7',lifecycle);
  assert.equal(calls[1].init.method,'DELETE'); assert.equal(JSON.parse(calls[1].init.body).expected_version,'r8');
  result.materialLifecycle.affectedTickets=-1;
  await assert.rejects(api.deleteAdminRecipe('token','bar','7',lifecycle),{code:'recipe_material_lifecycle_incomplete'});
});

test('knowledge saves reject stale/malformed server responses and use the expected revision', async () => {
  const doc={...model.createKnowledgeArticle(),title:'Обучение'};
  let result={id:doc.id,revision:1,status:'draft'}, observed;
  const api=loadApi('features/knowledge/editor/knowledge-editor-api.ts', {'@/lib/supabase':{supabase:{rpc:async(name,args)=>{observed={name,args};return {data:result,error:null};}}},'@/features/knowledge/editor/article-model':model});
  await api.saveKnowledgeArticle(doc,0); assert.equal(observed.name,'save_knowledge_article'); assert.equal(observed.args.p_expected_revision,0);
  result={...result,revision:2};
  await assert.rejects(api.saveKnowledgeArticle(doc,0),{code:'knowledge_article_save_response_invalid'});
});

test('knowledge validation accepts underline and legacy highlight, strips unexpected metadata and rejects unsafe media', () => {
  const doc={...model.createKnowledgeArticle(),title:'Безопасный текст',venue:'BB',blocks:[{id:'text',type:'paragraph',html:'<script>bad()</script>',content:{text:'Подчёркнуто',marks:[{type:'underline',from:0,to:11},{type:'highlight',from:0,to:3}]}}]};
  const clean=model.validateKnowledgeArticle(doc);
  assert.equal(clean.venue,undefined); assert.equal(clean.blocks[0].html,undefined); assert.equal(clean.blocks[0].content.marks.length,2);
  assert.throws(()=>model.validateKnowledgeArticle({...doc,blocks:[{...doc.blocks[0],content:{text:'x',marks:[{type:'script',from:0,to:1}]}}]}));
  const image={id:'img',type:'image',mediaId:'media',storagePath:'../private.jpg',legacySrc:null,alt:'',caption:'',name:'x',width:1,height:1};
  assert.throws(()=>model.validateKnowledgeArticle({...doc,blocks:[image]}),{code:'IMAGE'});
});

test('live text model preserves legacy highlight, toggles selected underline and keeps stable block anchors while reordering', () => {
  const initial={text:'Привет мир',marks:[{type:'highlight',from:0,to:6}]};
  const underlined=rich.toggleRichMark(initial,'underline',7,10);
  assert.equal(rich.rangeMarked(underlined.text,underlined.marks,'underline',7,10),true);
  const edited=rich.editRichText(underlined,'Привет новый мир');
  assert.equal(edited.marks.some(m=>m.type==='highlight'&&m.from===0&&m.to===6),true);
  const doc={...model.createKnowledgeArticle(),blocks:[{id:'first',type:'paragraph',content:initial},{id:'chapter',type:'heading',level:3,content:model.createRichText('Глава')}]};
  const moved=model.moveKnowledgeBlock(doc,'chapter',-1);
  assert.equal(moved.blocks[0].id,'chapter'); assert.equal(moved.blocks[0].level,3); assert.equal(doc.blocks[0].id,'first');
});

test('rendered article marks escape markup and preserve semantic underline/highlight', () => {
  const {renderToStaticMarkup}=require('react-dom/server'); const React=require('react');
  const view=loadApi('features/knowledge/editor/KnowledgeDocumentView.tsx', {'react':React,'react/jsx-runtime':require('react/jsx-runtime'),'./rich-text':rich,'./knowledge-media':{},'../KnowledgeImageDialog':{}});
  const html=renderToStaticMarkup(React.createElement(view.KnowledgeRichText,{value:{text:'<img onerror=bad()>',marks:[{type:'underline',from:0,to:18},{type:'highlight',from:0,to:18}]}}));
  assert.match(html,/<u>/); assert.match(html,/<mark>/); assert.match(html,/&lt;img/); assert.doesNotMatch(html,/<img/);
});

test('recipe catalogue searches archives and both venues while preserving unparsed ingredient lines', () => {
  const base={id:'bar:1',source:'bar',category:'Лимонад',venue:'BF/BB',name:'Цитрус',subcategory:'',desc:'',method:'Смешать',serving:'',tags:['лето'],status:'Актуальный',ingredients:['Джин 40 мл','Лёд — полный бокал']};
  const archived={...base,id:'bar:2',name:'Старый цитрус',status:'Архив'};
  assert.equal(presentation.filterRecipes([base,archived],'Все','').length,1);
  assert.equal(presentation.filterRecipes([base,archived],'Все','цитрус','BB').length,2);
  assert.deepEqual(presentation.recipeComposition(base).ingredients,base.ingredients);
  assert.equal(presentation.recipeBackTarget({from:'https://external.invalid'}),'/menu');
});

test('recipe deadline aborts stalled headers/body, clears its timer and never retries the write', async () => {
  for (const phase of ['headers','body']) {
    let expire, signal, calls=0, cleared=0;
    const api=loadApi('features/admin/recipe-admin-api.ts', {'@/lib/config':{config:{recipeApiBase:'http://localhost/recipes'}},
      setTimeout(callback,ms){assert.equal(ms,15000);expire=callback;return 123;},
      clearTimeout(timer){assert.equal(timer,123);cleared++;},
      fetch:async(url,init)=>{calls++;signal=init.signal;if(phase==='headers')return new Promise(()=>{});return {ok:true,status:200,json:()=>new Promise(()=>{})};},
    });
    const pending=phase==='headers'?api.createAdminRecipe('token',input):api.deleteAdminRecipe('token','bar','7',{expectedVersion:'r8',operationId:'operation'});
    await Promise.resolve(); expire();
    await assert.rejects(pending,{code:'recipe_write_timeout'});
    assert.equal(signal.aborted,true);assert.equal(calls,1);assert.equal(cleared,1);
  }
});
