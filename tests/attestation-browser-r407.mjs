// Local transport fixtures. All non-local requests are blocked; no production credentials.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const evidence = process.env.BF_QA_EVIDENCE || 'reports/attestation-r407';
fs.mkdirSync(evidence, { recursive: true });
const base = 'http://127.0.0.1:4183';
const api = 'http://127.0.0.1:54333';
const stream = fs.openSync(`${evidence}/vite-r407.log`, 'w');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4183', '--strictPort'], {
  stdio: ['ignore', stream, stream],
  env: { ...process.env, VITE_SUPABASE_URL: api, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture_only',
    VITE_RECIPE_API_BASE: `${api}/recipes`, VITE_KNOWLEDGE_SOURCE: 'supabase' }
});
fs.closeSync(stream);
const results = [], errors = [], unexpected = [];
let browser, activePage;
const waitFor = async (fn) => { for (let i=0;i<100;i++) { if (await fn()) return; await new Promise(r=>setTimeout(r,100)); } throw new Error('fixture readiness timeout'); };
const check = async (name, fn) => { if(process.env.BF_QA_FILTER&&!name.includes(process.env.BF_QA_FILTER))return;console.log(`RUN ${name}`);await fn(); results.push({name,status:'PASS'}); console.log(`PASS ${name}`); };

function fixtureBank() {
  const types = {bar:'Бар',kitchen:'Кухня',wine:'Вино',service:'Сервис'};
  const questions = Object.keys(types).flatMap(type => ['common','bf','bb'].flatMap(venue => [1,2].map(n => ({
    id:`${type}-${venue}-${n}`,categoryId:type,knowledgeType:type,venue,q:`${types[type]} ${venue} вопрос ${n}`,
    answers:['Верно','Неверно А','Неверно Б','Неверно В'].map((text,i)=>({text,correct:i===0})),
    group:`${type}-${venue}-${n}`,topic:'Основы',source:'knowledge',sourceRef:'lesson-1',reviewUrl:'#/knowledge/lesson-1',reviewLabel:'Открыть статью',status:'active',sortOrder:n*10,revision:1
  }))));
  const categories = Object.entries(types).map(([type,label])=>({id:type,label,knowledgeType:type,venue:'bf',
    specificQuestionCount:null,questionsPerTest:2,active:true,updatedAt:'2026-10-30T00:00:00Z',sortOrder:10,ticketPlan:[{topic:'Основы',count:2,sortOrder:10}]}));
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
  const state={editor:fixtureBank(),offline:false,submissions:[],reads:[],history:[],attempts:[],writes:[],denySave:false};
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
    if(url.pathname.startsWith('/recipes/'))return json({bar:[{id:'fixture-drink',name:'Тестовый напиток',category:'Основы',venue:'BF',ingredients:'Вода',method:'Перемешать',status:'active'}]});
    if(url.pathname==='/rest/v1/quiz_attempts'){
      if(url.searchParams.has('id'))return json(state.attempts.filter(a=>a.id===url.searchParams.get('id').replace('eq.','')&&((owner||role==='admin')||a.user_id===p.id)));
      return json(state.attempts.filter(a=>a.user_id===p.id));
    }
    if(url.pathname.includes('/rest/v1/rpc/')){
      const rpc=url.pathname.split('/').pop(),body=request.postDataJSON()||{};
      state.reads.push(rpc);
      if(rpc==='get_attestation_bank_v3')return json(publicBank(state.editor));
      if(rpc==='get_attestation_editor_bank_v3')return (owner||role==='admin')?json(state.editor):json({message:'forbidden'},403);
      if(rpc==='get_recent_attestation_attempts')return json(state.history);
      if(rpc==='submit_attestation_attempt'){
        state.submissions.push(body);
        state.attempts.push({id:body.p_client_attempt_id,user_id:p.id,category:body.p_category,category_id:body.p_category_id,score:Math.round(body.p_correct_answers/body.p_total_questions*100),passed:body.p_correct_answers/body.p_total_questions*100>=body.p_category_results.pass_percent,total_questions:body.p_total_questions,correct_answers:body.p_correct_answers,started_at:body.p_started_at,finished_at:body.p_finished_at,created_at:body.p_finished_at,category_results:body.p_category_results});
        if(!state.history.some(a=>a.id===body.p_client_attempt_id)) state.history.push({id:body.p_client_attempt_id,user_id:p.id,display_name:'Тест Билеты',category:body.p_category,category_id:body.p_category_id,score:100,passed:true,total_questions:body.p_total_questions,correct_answers:body.p_correct_answers,attempted_at:body.p_finished_at});
        return json({id:body.p_client_attempt_id,score:100,passed:true});
      }
      if(rpc==='get_knowledge_articles')return json([{id:'lesson-1',title:'Основы сервиса',category:'Основы',search_text:'Основы',status:'published',revision:1,description:''}]);
      if(rpc==='save_attestation_question_v3'){
        state.writes.push({rpc,body});if(state.denySave)return json({message:'attestation_revision_conflict'},409);
        const doc=body.p_document,id=doc.id||`fixture-${randomUUID()}`;
        const old=state.editor.questions.find(q=>q.id===id);
        const saved={...old,...doc,id,status:old?.status||'active',sortOrder:old?.sortOrder||99,revision:(old?.revision||0)+1};
        state.editor.questions=state.editor.questions.filter(q=>q.id!==id).concat(saved);
        state.editor.settings.revision++;return json(saved);
      }
      if(rpc==='save_attestation_editor_settings_v3'){
        state.writes.push({rpc,body});
        for(const item of body.p_category_settings){const c=state.editor.categories.find(c=>c.id===item.categoryId);Object.assign(c,item);c.ticketPlan=body.p_ticket_plan.filter(x=>x.categoryId===c.id);}
        state.editor.settings.passPercent=body.p_pass_percent;state.editor.settings.revision++;return json(state.editor.settings);
      }
      if(rpc==='get_position_shift_workflow')return json({context:{state:'available',position_code:'hostess',venue_timezone:'Asia/Novosibirsk',server_now:new Date().toISOString(),can_manage_templates:owner||role==='admin'},shift:null,rows:[],configured:false});
      return json([]);
    }
    return json([]);
  });
  await context.routeWebSocket(/^ws:\/\/127\.0\.0\.1:54333\//,socket=>socket.onMessage(message=>{
    const p=JSON.parse(String(message));if(Array.isArray(p))socket.send(JSON.stringify([p[0],p[1],p[2],'phx_reply',{status:'ok',response:{postgres_changes:[]}}]));
  }));
  const page=await context.newPage();activePage=page;page.on('pageerror',e=>errors.push(String(e)));
  const open=async path=>{await page.goto(`${base}/#${path}`);await page.locator('main').waitFor({state:'visible'});};
  return {context,page,state,open,p};
}
async function geometry(page,name,width){
  const g=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,duplicates:[...document.querySelectorAll('[id]')].map(x=>x.id).filter((id,i,a)=>a.indexOf(id)!==i),
    overflowing:[...document.querySelectorAll('main input,main select,main button')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left< -1||r.right>innerWidth+1);}).map(el=>el.outerHTML.slice(0,180))}));
  assert.ok(g.scroll<=width+1,JSON.stringify(g));assert.deepEqual(g.overflowing,[]);assert.deepEqual(g.duplicates,[]);
  await page.screenshot({path:`${evidence}/${name}-${width}.png`,fullPage:true});
}

async function start(s, category = 'bar-bb') {
  await s.page.getByLabel('Выбери тему', {exact:true}).selectOption(category);
  await s.page.getByRole('button', {name:'Начать аттестацию',exact:true}).click();
  await s.page.locator('.bf-exam-option').first().waitFor();
}
async function finish(s, answer = 'Неверно А') {
  for (let i = 0; i < 2; i++) {
    await s.page.getByRole('radio', {name:answer,exact:true}).check();
    await s.page.getByRole('button', {name:i === 1 ? 'Завершить аттестацию' : 'Следующий вопрос',exact:true}).click();
  }
}

try {
  await waitFor(async()=>{try{return (await fetch(base)).ok;}catch{return false;}});
  browser=await chromium.launch({executablePath:process.env.BF_TEST_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for (const width of [320,390,1280]) await check(`actual ${width}px quiz: full answers, hidden header, discard, snapshot result`, async()=>{
    const s=await session('staff',false,width), {page}=s;
    await s.open('/attestation');
    assert.equal(await page.getByRole('button',{name:'Начать аттестацию',exact:true}).isDisabled(),true);
    await geometry(page,'landing',width);await start(s);
    assert.equal(await page.locator('header button').count(),0);
    assert.equal(await page.getByRole('radio').count(),4);
    assert.equal(await page.getByRole('button',{name:/Предыдущий|Назад/}).count(),0);
    const first=page.getByRole('radio',{name:'Неверно А',exact:true});await first.check();
    assert.equal(await first.isChecked(),true);await geometry(page,'quiz',width);
    await page.getByRole('button',{name:'Выйти',exact:true}).click();
    const dialog=page.getByRole('alertdialog');await dialog.waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Закрыть',exact:true}).count(),0);
    await dialog.getByRole('button',{name:'Продолжить',exact:true}).click();assert.equal(await first.isChecked(),true);
    await page.getByRole('button',{name:'Выйти',exact:true}).click();
    await page.getByRole('alertdialog').getByRole('button',{name:'Выйти',exact:true}).click();
    await page.getByLabel('Выбери тему',{exact:true}).waitFor();assert.equal(s.state.submissions.length,0);
    await start(s);assert.equal(await page.locator('input[type=radio]:checked').count(),0);
    await finish(s);await page.getByText('Результат сохранён.',{exact:true}).waitFor();
    assert.equal(s.state.submissions.length,1);
    const saved=s.state.submissions[0].p_category_results.attempt_snapshot;
    assert.equal(saved.schemaVersion,1);assert.equal(saved.questions.length,2);assert.equal(saved.answers.length,2);
    assert.equal(await page.locator('header button').count(),2);
    assert.equal(await page.getByRole('link',{name:/Повторить:/}).count(),2);
    assert.equal(await page.getByText('Слабые темы',{exact:true}).count(),0);
    await geometry(page,'result',width);await s.context.close();
  });
  await check('team summaries, owned immutable detail, legacy summary and RLS hidden colleague detail',async()=>{
    const s=await session('staff');await s.open('/attestation');await start(s);await finish(s);
    await s.page.getByText('Результат сохранён.',{exact:true}).waitFor();
    const saved=s.state.attempts[0], originalQuestion=saved.category_results.attempt_snapshot.questions[0].q;
    for(const q of s.state.editor.questions)q.q='Changed after attempt';
    const legacy={...saved,id:randomUUID(),category:'Legacy summary',category_results:{},score:50,correct_answers:1};
    const colleague={...saved,id:randomUUID(),user_id:randomUUID(),category:'Colleague restricted'};
    s.state.attempts.push(legacy,colleague);
    s.state.history=[saved,legacy,colleague].map(a=>({...a,display_name:a.user_id===s.p.id?'Тест Билеты':'Коллега',attempted_at:a.finished_at}));
    await s.open('/attestation');await s.page.getByRole('button',{name:/Тест Билеты · Бар bb/}).click();
    await s.page.getByText('Сохранённая попытка',{exact:true}).waitFor();
    assert.equal(await s.page.getByRole('heading',{name:originalQuestion,exact:true}).count(),1);
    assert.equal(await s.page.getByRole('heading',{name:'Changed after attempt',exact:true}).count(),0);
    await s.page.getByRole('button',{name:'К истории',exact:true}).click();
    await s.page.getByRole('button',{name:/Legacy summary/}).click();
    await s.page.getByText(/Подробный разбор недоступен/).waitFor();
    assert.equal(await s.page.locator('.bf-result-errors').count(),0);
    await s.page.getByRole('button',{name:'К истории',exact:true}).click();
    await s.page.getByRole('button',{name:/Colleague restricted/}).click();
    await s.page.getByText(/Подробный разбор недоступен/).waitFor();
    assert.equal(await s.page.getByText('Colleague restricted',{exact:true}).count(),1);
    assert.equal(await s.page.locator('.bf-result-errors').count(),0);await s.context.close();
  });
  await check('offline finish survives reload, local detail returns to list, then one sync drains queue',async()=>{
    const s=await session('staff');await s.open('/attestation');await s.page.getByLabel('Выбери тему',{exact:true}).waitFor();
    await waitFor(async()=>s.page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('bfstaff-attestation-v2',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('bank').objectStore('bank').get('current');q.onsuccess=()=>{resolve(q.result?.bank?.schemaVersion===3);db.close();};};})));
    s.state.offline=true;await start(s);await finish(s);
    await s.page.getByText('Результат сохранён на этом устройстве. Ожидает синхронизации.',{exact:true}).waitFor();
    await s.page.reload();await s.page.getByText('На этом устройстве',{exact:true}).waitFor();
    assert.equal(s.state.submissions.length,0);
    await s.page.getByRole('button',{name:/Бар bb/}).click();await s.page.getByText('Сохранённая попытка',{exact:true}).waitFor();
    await s.page.getByRole('button',{name:'К истории',exact:true}).click();await s.page.getByLabel('Выбери тему',{exact:true}).waitFor();
    s.state.offline=false;await s.page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await waitFor(async()=>s.state.submissions.length===1);
    await s.page.reload();await s.page.getByRole('button',{name:/Тест Билеты · Бар bb/}).waitFor();
    assert.equal(s.state.submissions.length,1);await s.context.close();
  });
  await check('staff cannot read or mutate the question bank through settings routes',async()=>{
    const s=await session('staff');await s.open('/settings/attestation/questions');
    await waitFor(async()=>!s.page.url().includes('/settings/attestation/questions'));
    assert.equal(s.state.reads.includes('get_attestation_editor_bank_v3'),false);assert.equal(s.state.writes.length,0);
    await s.context.close();
  });
  await check('question editor requires material, preserves a revision error and confirms discard via header',async()=>{
    const s=await session('admin');await s.open('/settings/attestation/questions');
    await s.page.getByRole('button',{name:'Добавить вопрос',exact:true}).click();
    await s.page.getByLabel('Текст вопроса',{exact:true}).fill('Fixture authored question?');
    for(let i=1;i<=4;i++)await s.page.getByLabel(`Ответ ${i}`,{exact:true}).fill(`Choice ${i}`);
    const material=s.page.getByLabel('Материал для повторения',{exact:true});await material.waitFor();
    await s.page.getByRole('button',{name:'Сохранить вопрос',exact:true}).click();assert.equal(s.state.writes.length,0);
    await material.selectOption('#/knowledge/lesson-1');s.state.denySave=true;
    await s.page.getByRole('button',{name:'Сохранить вопрос',exact:true}).click();
    await s.page.getByText(/Вопрос уже изменён в другой сессии/).waitFor();
    assert.equal(await s.page.getByLabel('Текст вопроса',{exact:true}).inputValue(),'Fixture authored question?');
    assert.equal(s.state.editor.questions.some(q=>q.q==='Fixture authored question?'),false);
    await s.page.getByRole('button',{name:'В банк вопросов',exact:true}).click();
    await s.page.getByRole('alertdialog',{name:'Закрыть редактор без сохранения?'}).waitFor();
    await s.page.getByRole('alertdialog').getByRole('button',{name:'Продолжить редактирование',exact:true}).click();
    s.state.denySave=false;await s.page.getByRole('button',{name:'Сохранить вопрос',exact:true}).click();
    await s.page.getByText('Вопрос сохранён на сервере.',{exact:true}).waitFor();
    const doc=s.state.writes.at(-1).body.p_document;assert.equal(doc.source,'knowledge');assert.equal(doc.sourceRef,'lesson-1');assert.equal(doc.reviewUrl,'#/knowledge/lesson-1');
    await geometry(s.page,'question-bank',390);await s.context.close();
  });
  await check('ticket quota controls stay compact and add/remove never submit the settings form',async()=>{
    const s=await session('admin',false,320);await s.open('/settings/attestation?view=tickets');
    await s.page.getByRole('button',{name:/Бар BeerFactory|Бар.*Вопросов/}).first().click();
    await s.page.getByRole('heading',{name:'Настройки билета',exact:true}).waitFor();
    await geometry(s.page,'ticket-editor',320);
    await s.page.getByRole('button',{name:'Убрать раздел 1',exact:true}).click();
    assert.equal(s.state.writes.length,0);
    await s.page.getByRole('button',{name:'Добавить раздел',exact:true}).click();
    assert.equal(s.state.writes.length,0);
    await s.page.getByLabel('Раздел 1',{exact:true}).selectOption('Основы');
    await s.page.getByLabel('Вопросов из раздела 1',{exact:true}).fill('2');
    await s.page.getByLabel('Вопросов только этого заведения',{exact:true}).fill('1');
    await s.page.getByRole('button',{name:'Сохранить настройки',exact:true}).click();
    await s.page.getByText('Сохранено на сервере.',{exact:true}).waitFor();
    assert.equal(s.state.writes.at(-1).body.p_category_settings[0].specificQuestionCount,1);
    await s.context.close();
  });
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
} catch(error){results.push({status:'FAIL',error:error.stack});console.error(error);if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:`${evidence}/failure.png`,fullPage:true});fs.writeFileSync(`${evidence}/failure.txt`,await activePage.locator('body').innerText());}process.exitCode=1;}
finally {fs.writeFileSync(`${evidence}/browser-r407.json`,JSON.stringify({results,errors,unexpected},null,2));await browser?.close();server.kill('SIGTERM');}
