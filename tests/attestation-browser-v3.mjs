// Local transport fixtures. All non-local requests are blocked; no production credentials.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const evidence = process.env.BF_QA_EVIDENCE || 'reports/attestation-v3';
fs.mkdirSync(evidence, { recursive: true });
const base = 'http://127.0.0.1:4177';
const api = 'http://127.0.0.1:54329';
const stream = fs.openSync(`${evidence}/vite-v3.log`, 'w');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4177', '--strictPort'], {
  stdio: ['ignore', stream, stream],
  env: { ...process.env, VITE_SUPABASE_URL: api, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture_only',
    VITE_RECIPE_API_BASE: `${api}/recipes`, VITE_KNOWLEDGE_SOURCE: 'supabase' }
});
fs.closeSync(stream);
const results = [], errors = [], unexpected = [];
let browser;
const waitFor = async (fn) => { for (let i=0;i<100;i++) { if (await fn()) return; await new Promise(r=>setTimeout(r,100)); } throw new Error('fixture readiness timeout'); };
const check = async (name, fn) => { await fn(); results.push({name,status:'PASS'}); console.log(`PASS ${name}`); };

function fixtureBank() {
  const types = {bar:'Бар',kitchen:'Кухня',wine:'Вино',service:'Сервис'};
  const questions = Object.keys(types).flatMap(type => ['common','bf','bb'].flatMap(venue => [1,2].map(n => ({
    id:`${type}-${venue}-${n}`,categoryId:type,knowledgeType:type,venue,q:`${types[type]} ${venue} вопрос ${n}`,
    answers:['Верно','Неверно А','Неверно Б','Неверно В'].map((text,i)=>({text,correct:i===0})),
    group:`${type}-${venue}-${n}`,topic:'Основы',status:'active',sortOrder:n*10,revision:1
  }))));
  const categories = Object.entries(types).map(([type,label])=>({id:type,label,knowledgeType:type,venue:'bf',
    specificQuestionCount:null,questionsPerTest:2,active:true,sortOrder:10,ticketPlan:[{topic:'Основы',count:2,sortOrder:10}]}));
  for (const venue of ['bb','common']) categories.push({...categories[0],id:`bar-${venue}`,label:`Бар ${venue}`,venue,
    specificQuestionCount:venue==='bb'?1:0});
  categories.push({...categories[0],id:'custom-55486644a2fb',label:'Бистро',active:false,knowledgeType:null,ticketPlan:[]});
  return {schemaVersion:3,settings:{passPercent:80,questionsPerTest:2,revision:1},categories,questions};
}
function publicBank(editor) {
  return {schemaVersion:3,passPercent:editor.settings.passPercent,questionsPerTest:editor.settings.questionsPerTest,
    revision:editor.settings.revision,categories:editor.categories.filter(c=>c.active).map(c=>({...c,
      questions:editor.questions.filter(q=>q.status==='active'&&q.knowledgeType===c.knowledgeType&&(q.venue==='common'||q.venue===c.venue))}))};
}
async function session(role='admin',owner=false,width=390) {
  const context = await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  const p={id:randomUUID(),first_name:'Тест',last_name:'Билеты',role,is_owner:owner,is_active:true,position_code:'hostess',recovery_configured:true};
  const user={id:p.id,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
  const exp=Math.floor(Date.now()/1000)+3600;
  const part=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const token=part({alg:'HS256',typ:'JWT'})+'.'+part({sub:p.id,exp,aud:'authenticated'})+'.fixture';
  await context.addInitScript(({user,token,exp})=>{
    if (!localStorage.getItem('sb-127-auth-token')) localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_in:3600,expires_at:exp,user}));
  },{user,token,exp});
  const state={editor:fixtureBank(),offline:false,submissions:[],reads:[],history:[]};
  await context.route('**/*',async route=>{
    const request=route.request(), url=new URL(request.url());
    if(url.origin===base)return route.continue();
    if(url.origin!==api){unexpected.push(url.origin+url.pathname);return route.abort();}
    if(state.offline)return route.abort();
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(url.pathname.endsWith('/staff-profile'))return json({profile:p});
    if(url.pathname.endsWith('/staff-admin-users'))return json({ok:true,me:p,users:[p]});
    if(url.pathname==='/auth/v1/user')return json(user);
    if(url.pathname.startsWith('/auth/'))return json({});
    if(url.pathname.startsWith('/recipes/'))return json({recipes:[{id:'fixture-drink',name:'Тестовый напиток',category:'Бар',venue:'BeerFactory',ingredients:'Вода',method:'Перемешать',status:'active'}]});
    if(url.pathname.includes('/rest/v1/rpc/')){
      const rpc=url.pathname.split('/').pop(),body=request.postDataJSON()||{};
      state.reads.push(rpc);
      if(rpc==='get_attestation_bank_v3')return json(publicBank(state.editor));
      if(rpc==='get_attestation_editor_bank_v3')return (owner||role==='admin')?json(state.editor):json({message:'forbidden'},403);
      if(rpc==='get_recent_attestation_attempts')return json(state.history);
      if(rpc==='submit_attestation_attempt'){
        state.submissions.push(body);
        if(!state.history.some(a=>a.id===body.p_client_attempt_id)) state.history.push({id:body.p_client_attempt_id,user_id:p.id,display_name:'Тест Билеты',category:body.p_category,category_id:body.p_category_id,score:100,passed:true,total_questions:body.p_total_questions,correct_answers:body.p_correct_answers,attempted_at:body.p_finished_at});
        return json({id:body.p_client_attempt_id,score:100,passed:true});
      }
      if(rpc==='save_attestation_question_v3'){
        const doc=body.p_document,id=doc.id||`fixture-${randomUUID()}`;
        const old=state.editor.questions.find(q=>q.id===id);
        const saved={...old,...doc,id,status:old?.status||'active',sortOrder:old?.sortOrder||99,revision:(old?.revision||0)+1};
        state.editor.questions=state.editor.questions.filter(q=>q.id!==id).concat(saved);
        state.editor.settings.revision++;return json(saved);
      }
      if(rpc==='save_attestation_editor_settings_v3'){
        for(const item of body.p_category_settings){const c=state.editor.categories.find(c=>c.id===item.categoryId);Object.assign(c,item);c.ticketPlan=body.p_ticket_plan.filter(x=>x.categoryId===c.id);}
        state.editor.settings.passPercent=body.p_pass_percent;state.editor.settings.revision++;return json(state.editor.settings);
      }
      if(rpc==='get_position_shift_workflow')return json({context:{state:'available',position_code:'hostess',venue_timezone:'Asia/Novosibirsk',server_now:new Date().toISOString(),can_manage_templates:owner||role==='admin'},shift:null,rows:[],configured:false});
      return json([]);
    }
    return json([]);
  });
  await context.routeWebSocket(/^ws:\/\/127\.0\.0\.1:54329\//,socket=>socket.onMessage(message=>{
    const p=JSON.parse(String(message));if(Array.isArray(p))socket.send(JSON.stringify([p[0],p[1],p[2],'phx_reply',{status:'ok',response:{postgres_changes:[]}}]));
  }));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  const open=async path=>{await page.goto(`${base}/#${path}`);await page.locator('main').waitFor({state:'visible'});};
  return {context,page,state,open,p};
}
async function geometry(page,name,width){
  const g=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,duplicates:[...document.querySelectorAll('[id]')].map(x=>x.id).filter((id,i,a)=>a.indexOf(id)!==i),
    overflowing:[...document.querySelectorAll('main input,main select,main button')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left< -1||r.right>innerWidth+1);}).map(el=>el.outerHTML.slice(0,180))}));
  assert.ok(g.scroll<=width+1,JSON.stringify(g));assert.deepEqual(g.overflowing,[]);assert.deepEqual(g.duplicates,[]);
  await page.screenshot({path:`${evidence}/${name}-${width}.png`,fullPage:true});
}
try {
  await waitFor(async()=>{try{return (await fetch(base)).ok;}catch{return false;}});
  browser=await chromium.launch({executablePath:process.env.BF_TEST_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const width of [320,375,390,430]) await check(`mobile ${width}: picker, quiz, results, bank, form, settings`,async()=>{
    const s=await session('admin',false,width);const {page}=s;
    await s.open('/attestation');await page.getByLabel('Выбери тему',{exact:true}).waitFor();
    assert.ok(await page.getByRole('button',{name:'Начать',exact:true}).isDisabled());
    await page.getByLabel('Выбери тему',{exact:true}).selectOption('bar-bb');await geometry(page,'picker',width);
    await page.getByRole('button',{name:'Начать',exact:true}).click();await page.getByRole('group',{name:'Варианты ответа'}).waitFor();await geometry(page,'quiz',width);
    for(let i=0;i<2;i++){await page.getByRole('button').filter({hasText:/Верно$/}).click();await page.getByRole('button',{name:i===1?'Завершить аттестацию':'Ответить',exact:true}).click();}
    await page.getByText('Результат сохранён.',{exact:true}).waitFor();await geometry(page,'result',width);
    assert.equal(s.state.submissions.length,1);assert.equal(s.state.submissions[0].p_category_id,'bar-bb');
    await s.open('/admin?section=attempts');await page.getByRole('button',{name:'Вопросы',exact:true}).click();await page.getByLabel('Тип знаний вопросов').waitFor();await geometry(page,'bank',width);
    await page.getByRole('button',{name:'Добавить вопрос',exact:true}).click();await page.getByLabel('Тип знаний',{exact:true}).waitFor();await page.getByText('Дополнительно',{exact:true}).click();
    assert.equal(await page.getByLabel('Для какого заведения вопрос?').inputValue(),'bf');await geometry(page,'question-form',width);
    await page.getByRole('button',{name:'Закрыть редактор'}).click();await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('heading',{name:'Экзаменационные билеты и разделы'}).waitFor();await geometry(page,'settings',width);
    assert.equal(await page.getByLabel('Название категории').last().inputValue(),'Бистро');
    await s.context.close();
  });
  await check('Owner opens editor; staff position does not restrict independent tickets',async()=>{
    const o=await session('staff',true);await o.open('/admin?section=attempts');await o.page.getByRole('button',{name:'Настройки',exact:true}).click();await o.page.getByRole('heading',{name:'Экзаменационные билеты и разделы'}).waitFor();await o.context.close();
    const s=await session('staff');await s.open('/attestation');await s.page.getByLabel('Выбери тему',{exact:true}).waitFor();assert.equal(await s.page.locator('select[aria-label="Выбери тему"] option').count(),7);await s.open('/admin?section=attempts');await waitFor(async()=>s.page.url().endsWith('#/profile'));assert.ok(!s.state.reads.includes('get_attestation_editor_bank_v3'));await s.context.close();
  });
  await check('shared question edit invalidates cache and quota clearing persists null',async()=>{
    const s=await session();await s.open('/admin?section=attempts');await s.page.getByRole('button',{name:'Вопросы',exact:true}).click();
    await s.page.getByRole('button',{name:'Редактировать вопрос',exact:true}).first().click();
    await s.page.getByLabel('Вопрос',{exact:true}).fill('Общий вопрос после редактирования');
    await s.page.getByRole('button',{name:'Сохранить вопрос',exact:true}).click();
    await s.page.getByRole('button',{name:'Закрыть редактор'}).waitFor({state:'hidden'});
    assert.equal(s.state.editor.questions.filter(q=>q.q==='Общий вопрос после редактирования').length,1);
    const pub=publicBank(s.state.editor);assert.ok(pub.categories.filter(c=>['bar','bar-bb'].includes(c.id)).every(c=>c.questions.some(q=>q.q==='Общий вопрос после редактирования')));
    await s.page.getByRole('button',{name:'Настройки',exact:true}).click();
    const quota=s.page.getByLabel('Специфичных вопросов из общего числа (необязательно)').nth(4);
    assert.equal(await quota.inputValue(),'1');await quota.fill('');assert.equal(await quota.inputValue(),'');
    await s.page.getByRole('button',{name:'Сохранить настройки',exact:true}).click();await s.page.getByText('Сохранено на сервере.',{exact:true}).waitFor();
    assert.equal(s.state.editor.categories.find(c=>c.id==='bar-bb').specificQuestionCount,null);
    await s.open('/attestation');await s.page.getByLabel('Выбери тему',{exact:true}).selectOption('bar-common');await s.page.getByRole('button',{name:'Начать',exact:true}).click();
    const texts=[];for(let i=0;i<2;i++){texts.push(await s.page.locator('main h1').innerText());await s.page.getByRole('button').filter({hasText:/Верно$/}).click();await s.page.getByRole('button',{name:i===1?'Завершить аттестацию':'Ответить',exact:true}).click();}
    assert.ok(texts.includes('Общий вопрос после редактирования'));await s.context.close();
  });
  await check('IndexedDB v3 cache, offline finish, reload, single sync and history',async()=>{
    const s=await session('staff');await s.open('/attestation');await s.page.getByLabel('Выбери тему',{exact:true}).waitFor();
    await waitFor(async()=>s.page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('bfstaff-attestation-v2',1);r.onsuccess=()=>{const db=r.result;const q=db.transaction('bank').objectStore('bank').get('current');q.onsuccess=()=>{resolve(q.result?.bank?.schemaVersion===3);db.close();};};})));
    s.state.offline=true;await s.page.getByLabel('Выбери тему',{exact:true}).selectOption('bar-bb');await s.page.getByRole('button',{name:'Начать',exact:true}).click();
    for(let i=0;i<2;i++){await s.page.getByRole('button').filter({hasText:/Верно$/}).click();await s.page.getByRole('button',{name:i===1?'Завершить аттестацию':'Ответить',exact:true}).click();}
    await s.page.getByText('Результат сохранён на этом устройстве.',{exact:true}).waitFor();
    await s.page.reload();await s.page.getByLabel('Выбери тему',{exact:true}).waitFor();await s.page.getByText('На устройстве',{exact:true}).waitFor();assert.equal(s.state.submissions.length,0);
    s.state.offline=false;await s.page.evaluate(()=>{window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('focus'));});
    await waitFor(async()=>s.state.submissions.length===1);await s.page.reload();await s.page.getByText('Тест Билеты · Бар bb',{exact:true}).waitFor();assert.equal(s.state.submissions.length,1);
    await s.context.close();
  });
  await check('v2 cache upgrade fails closed while pending results remain',async()=>{
    const s=await session('staff');await s.open('/attestation');await s.page.getByLabel('Выбери тему',{exact:true}).waitFor();
    await s.page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('bfstaff-attestation-v2',1);r.onsuccess=()=>{const db=r.result,t=db.transaction(['bank','outbox'],'readwrite');t.objectStore('bank').put({key:'current',bank:{schemaVersion:2},savedAt:new Date().toISOString()});t.objectStore('outbox').put({clientAttemptId:'legacy-attempt',userId:'another-user',result:{categoryId:'bar'},queuedAt:new Date().toISOString()});t.oncomplete=()=>{db.close();resolve();};t.onerror=reject;};}));
    s.state.offline=true;await s.page.reload();await s.page.getByText('Офлайн-банк устарел. Подключитесь к интернету и обновите вопросы.',{exact:true}).waitFor();
    const retained=await s.page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('bfstaff-attestation-v2',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('outbox').objectStore('outbox').get('legacy-attempt');q.onsuccess=()=>{resolve(q.result?.result?.categoryId);db.close();};};}));
    assert.equal(retained,'bar');
    assert.equal(s.state.submissions.length,0);await s.context.close();
  });
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
} catch(error){results.push({status:'FAIL',error:error.stack});console.error(error);process.exitCode=1;}
finally {fs.writeFileSync(`${evidence}/browser-v3.json`,JSON.stringify({results,errors,unexpected},null,2));await browser?.close();server.kill('SIGTERM');}
