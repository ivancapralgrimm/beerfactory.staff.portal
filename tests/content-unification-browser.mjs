// Actual app routes + real auth/client modules, with every API request fulfilled locally.
// These transport fixtures do not prove deployed SQL, storage cleanup, RLS or Worker configuration.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';

const port=process.env.BF_CONTENT_TEST_URL ? null : await new Promise((resolve,reject)=>{const probe=createServer();probe.on('error',reject);probe.listen(0,'127.0.0.1',()=>{const selected=probe.address().port;probe.close(()=>resolve(selected));});});
const base=process.env.BF_CONTENT_TEST_URL || `http://127.0.0.1:${port}`;
const api='http://127.0.0.1:54329';
const reports='reports/content-unification';
fs.mkdirSync(reports,{recursive:true});
const results=[], unexpected=[], errors=[];
let server, browser;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const bar={id:'bar:7',recordId:'7',source:'bar',name:'Цитрусовый лимонад',category:'Лимонад',status:'Актуальный',venue:'BF/BB',ingredients:['Джин 40 мл','Лёд — полный бокал'],method:'Аккуратно смешать',serving:'',tags:['летний','цитрус'],photo:'',version:'r8'};
const kitchen={...bar,id:'kitchen:8',recordId:'8',source:'kitchen',name:'Суп дня',category:'Кухня',description:'Приготовить бульон',method:'Приготовить бульон',ingredients:[],venue:'BB',serving:'250 г',tags:[]};
const archived={...bar,id:'bar:9',recordId:'9',name:'Старый лимонад',status:'Архив',venue:'BF'};
const article={schemaVersion:2,id:'article:content-fixture',title:'Работа с гостем',category:'Обучение',description:'Короткая статья',status:'published',revision:1,
  blocks:[{id:'text-one',type:'paragraph',content:{text:'Старое выделение и текст',marks:[{type:'highlight',from:0,to:6}]}},
  {id:'heading-one',type:'heading',level:2,content:{text:'Первая глава',marks:[]}},
  {id:'heading-two',type:'heading',level:3,content:{text:'Вторая глава',marks:[]}}]};
const bank={schemaVersion:3,passPercent:80,questionsPerTest:1,categories:[{id:'fixture',label:'Fixture',knowledgeType:'service',venue:'common',questionsPerTest:1,specificQuestionCount:0,ticketPlan:[{topic:'Fixture',count:1}],questions:[{id:'q',q:'Fixture?',topic:'Fixture',group:'q',knowledgeType:'service',venue:'common',answers:['A','B','C','D'].map((text,i)=>({text,correct:i===0}))}]}]};

async function fixture({role='admin',capabilities=true,width=390}={}) {
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
  const profile={id:randomUUID(),first_name:'Тест',last_name:'Редактор',role,is_owner:false,is_active:true,position_code:'bartender_bb',recovery_configured:true};
  const user={id:profile.id,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
  const exp=Math.floor(Date.now()/1000)+3600,part=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const token=part({alg:'HS256',typ:'JWT'})+'.'+part({sub:user.id,exp,aud:'authenticated'})+'.fixture';
  await context.addInitScript(({session})=>localStorage.setItem('sb-127-auth-token',JSON.stringify(session)),{session:{access_token:token,refresh_token:'fixture',token_type:'bearer',expires_in:3600,expires_at:exp,user}});
  const state={role,capabilities,document:structuredClone(article),recipes:structuredClone([bar,kitchen,archived]),calls:[],recipeFailure:false,knowledgeFailure:false,knowledgeForbidden:false,hold:null};
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===base)return route.continue();
    if(url.origin!==api){unexpected.push(request.method()+' '+url.origin+url.pathname);return route.abort();}
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':base}});
    const denied=()=>json({code:'P0001',message:'forbidden'},403);
    const pathname=url.pathname;
    if(pathname.endsWith('/staff-profile'))return json({profile});
    if(pathname==='/auth/v1/user')return json(user);
    if(pathname==='/rest/v1/training_progress')return json([]);
    if(pathname==='/recipes/menu')return json({recipes:state.recipes,capabilities:{recipe_admin_write:true,source_aware_ids:true,recipe_material_lifecycle_v1:state.capabilities,recipe_photo_cleanup_v1:state.capabilities}});
    if(pathname.startsWith('/recipes/admin/recipes/')){
      state.calls.push({type:'recipe',method:request.method(),headers:request.headers(),body:request.postData()});
      if(state.role!=='admin')return json({ok:false,error:'admin_required'},403);
      if(state.hold)await state.hold;
      if(state.recipeFailure)return json({ok:false,error:'fixture_write_failed'},500);
      const source=pathname.split('/')[4],recordId=pathname.split('/')[5]||'10';
      let payload;
      if(request.headers()['content-type']?.startsWith('multipart/form-data')){
        const match=request.postData().match(/name="payload"\r\n\r\n([^\r]+)/);payload=JSON.parse(match[1]);
      }else payload=request.postData()?request.postDataJSON():{};
      const id=source+':'+recordId;
      if(request.method()==='DELETE')state.recipes=state.recipes.filter(r=>r.id!==id);
      else {
        let current=state.recipes.find(r=>r.id===id);
        if(!current){current={...bar,id,recordId,source};state.recipes.push(current);}
        Object.assign(current,payload,{version:'r9'});
      }
      const lifecycle=payload.confirm_material_lifecycle?{materialLifecycle:{phase:'completed',operationId:request.headers()['idempotency-key'],affectedQuestions:2,affectedTickets:1}}:{};
      return json({ok:true,id,recordId,source,...lifecycle});
    }
    if(pathname.includes('/rest/v1/rpc/')){
      const rpc=pathname.split('/').at(-1),body=request.postDataJSON()||{};
      state.calls.push({type:'rpc',rpc,body});
      if(rpc==='get_attestation_bank_v3')return json(bank);
      if(rpc==='get_knowledge_editor_context')return json({can_read:true,can_create:state.role==='admin',can_edit:state.role==='admin',can_publish:state.role==='admin',can_manage_permissions:state.role==='admin'});
      if(rpc==='get_material_lifecycle_capabilities')return state.capabilities?json({schemaVersion:1,knowledgeLifecycle:true,knowledgeUnderline:true,knowledgeMediaCleanup:true}):json({code:'PGRST202',message:'missing capability'},404);
      if(rpc==='get_knowledge_article')return json(state.document);
      if(rpc==='get_knowledge_articles')return json(state.document.status==='published'?[{...state.document,search_text:state.document.blocks.map(b=>b.content?.text||'').join(' '),first_image:null}]:[]);
      if(rpc==='get_knowledge_editor_articles')return json([{id:state.document.id,title:state.document.title,category:state.document.category,status:state.document.status,revision:state.document.revision}]);
      if(rpc==='save_knowledge_article'){
        if(state.role!=='admin'||state.knowledgeForbidden)return denied();
        if(state.hold)await state.hold;
        if(state.knowledgeFailure)return json({code:'XX000',message:'fixture_save_failed'},500);
        if(body.p_expected_revision!==state.document.revision)return json({code:'P0001',message:'article_revision_conflict'},409);
        state.document={...body.p_document,revision:state.document.revision+1};
        return json({id:state.document.id,revision:state.document.revision,status:state.document.status,created:false,updated_at:new Date().toISOString()});
      }
      if(rpc==='delete_knowledge_article')return json({id:state.document.id,deleted:true,affectedQuestions:2,affectedTickets:1});
    }
    unexpected.push(request.method()+' '+pathname); return json({error:'unmocked_fixture_request'},501);
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  return {context,page,state,goto:async path=>{await page.goto(base+'/#'+path);await page.locator('.bfstaff-app').waitFor();}};
}
async function check(name,run){try{await run();results.push({name,status:'passed'});console.log('PASS '+name);}catch(error){results.push({name,status:'failed',error:error.stack});throw error;}}
async function visible(locator){await locator.waitFor({state:'visible',timeout:10000});}
async function noOverflow(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'page must not scroll horizontally');}
async function selectAll(locator){await locator.evaluate(element=>{element.focus();const range=document.createRange();range.selectNodeContents(element);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));});}
const recipeWrites=state=>state.calls.filter(c=>c.type==='recipe');
const articleWrites=state=>state.calls.filter(c=>c.rpc==='save_knowledge_article'||c.rpc==='delete_knowledge_article');
try{
  if(!process.env.BF_CONTENT_TEST_URL){
    const stream=fs.openSync(reports+'/vite.log','w');
    server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore',stream,stream],env:{...process.env,VITE_SUPABASE_URL:api,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture_only',VITE_RECIPE_API_BASE:api+'/recipes',VITE_KNOWLEDGE_SOURCE:'supabase'}});fs.closeSync(stream);
    let ready=false;for(let n=0;n<100;n++){if(server.exitCode!==null)throw Error('Vite failed: see '+reports+'/vite.log');try{ready=(await fetch(base)).ok;}catch{}if(ready){await delay(100);if(server.exitCode!==null)throw Error('Vite exited before readiness');break;}await delay(100);}if(!ready)throw Error('Vite did not start');
  }
  browser=await chromium.launch({executablePath:process.env.BF_TEST_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  await check('read-only rights cannot open either editor or write materials',async()=>{
    const f=await fixture({role:'staff'});try{await f.goto('/menu?editor=new');await visible(f.page.getByText('У вас нет прав на редактирование рецептов.'));assert.equal(await f.page.getByRole('button',{name:'Сохранить рецепт',exact:true}).count(),0);await f.goto('/knowledge/new');await visible(f.page.getByText('Нет разрешения на эту операцию.'));assert.equal(await f.page.getByRole('textbox').count(),0);assert.equal(recipeWrites(f.state).length+articleWrites(f.state).length,0);}finally{await f.context.close();}
  });
  await check('missing capabilities close Knowledge photos/underline/lifecycle and recipe photos/lifecycle',async()=>{
    const f=await fixture({capabilities:false});try{await f.goto('/knowledge/'+encodeURIComponent(article.id)+'/edit');await visible(f.page.getByRole('textbox',{name:'Текст 1',exact:true}));assert.equal(await f.page.getByRole('button',{name:'Картинка',exact:true}).isDisabled(),true);assert.equal(await f.page.getByRole('button',{name:'Подчёркнутый',exact:true}).first().isDisabled(),true);await f.page.getByText('Действия с материалом',{exact:true}).click();assert.equal(await f.page.getByRole('button',{name:'В архив',exact:true}).isDisabled(),true);assert.equal(await f.page.getByRole('button',{name:'Удалить',exact:true}).isDisabled(),true);await f.goto('/menu?editor=bar%3A7');await visible(f.page.getByRole('button',{name:'Сохранить рецепт'}));assert.equal(await f.page.locator('input[type=file]').isDisabled(),true);await f.page.getByText('Действия с материалом',{exact:true}).click();assert.equal(await f.page.getByRole('button',{name:'Архив',exact:true}).isDisabled(),true);assert.equal(recipeWrites(f.state).length+articleWrites(f.state).length,0);}finally{await f.context.close();}
  });
  await check('Knowledge live BIU, safe paste, reorder, stable anchors and compact 44px controls',async()=>{
    const f=await fixture();try{
      await f.goto('/knowledge/'+encodeURIComponent(article.id)+'/edit');const text=f.page.getByRole('textbox',{name:'Текст 1',exact:true});await visible(text);await visible(text.locator('mark'));await text.fill('Безопасный текст');await selectAll(text);
      for(const name of ['Жирный','Курсив','Подчёркнутый']){const button=f.page.getByRole('button',{name,exact:true}).first();await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');}
      assert.equal(await text.locator('strong em u, u em strong').count()>0,true);assert.match(await text.innerHTML(),/<strong>/);assert.match(await text.innerHTML(),/<em>/);assert.match(await text.innerHTML(),/<u>/);
      await selectAll(text);await text.evaluate(element=>{const data=new DataTransfer();data.setData('text/plain','<img onerror=bad()>');data.setData('text/html','<img src=x onerror=bad()>');element.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
      assert.equal(await text.locator('img,script').count(),0);assert.equal(await text.innerText(),'<img onerror=bad()>');
      await f.page.getByRole('button',{name:'Блок 3 выше',exact:true}).click();assert.deepEqual(await f.page.locator('[data-block-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.blockId)),['text-one','heading-two','heading-one']);
      const control=f.page.getByRole('button',{name:'Жирный',exact:true}).first();const box=await control.boundingBox();assert.ok(box.width>=43.5&&box.height>=43.5,JSON.stringify({box,style:await control.evaluate(element=>({height:getComputedStyle(element).height,minHeight:getComputedStyle(element).minHeight,width:getComputedStyle(element).width,padding:getComputedStyle(element).padding,transform:getComputedStyle(element).transform}))}));
      await noOverflow(f.page);await f.page.screenshot({path:reports+'/knowledge-editor-390.png',fullPage:true});
      await f.page.setViewportSize({width:320,height:700});await noOverflow(f.page);await f.page.getByRole('button',{name:'Текст',exact:true}).click();await f.page.getByRole('textbox',{name:'Текст 4',exact:true}).fill('Дополнительный текст статьи.\n'.repeat(25));await f.page.getByRole('button',{name:'Подзаголовок',exact:true}).click();const added=f.page.getByRole('textbox',{name:'Подзаголовок 5',exact:true});assert.equal(await added.evaluate(element=>element===document.activeElement),true);await added.fill('Конец статьи');
      await f.page.getByRole('button',{name:'Предпросмотр',exact:true}).click();await visible(f.page.getByRole('navigation',{name:'Разделы статьи'}));await f.page.getByRole('button',{name:'Вторая глава',exact:true}).click();assert.equal(await f.page.locator('#knowledge-heading-two').count(),1);await f.page.getByRole('button',{name:'Конец статьи',exact:true}).click();assert.equal(await f.page.evaluate(()=>scrollY>200),true);await noOverflow(f.page);await f.page.screenshot({path:reports+'/knowledge-preview-320.png',fullPage:true});
    }finally{await f.context.close();}
  });
  await check('Knowledge failed/forbidden saves preserve draft; pending save has no premature success',async()=>{
    const f=await fixture();try{await f.goto('/knowledge/'+encodeURIComponent(article.id)+'/edit');await visible(f.page.getByRole('textbox',{name:'Текст 1',exact:true}));await f.page.getByLabel('Название',{exact:true}).fill('Сохранённый заголовок');f.state.knowledgeFailure=true;await f.page.getByRole('button',{name:'Сохранить статью',exact:true}).click();await visible(f.page.getByRole('alert'));assert.equal(await f.page.getByLabel('Название',{exact:true}).inputValue(),'Сохранённый заголовок');assert.equal(f.state.document.revision,1);assert.equal(await f.page.getByText('Статья сохранена на сервере.',{exact:true}).count(),0);
      f.state.knowledgeFailure=false;f.state.knowledgeForbidden=true;await f.page.getByRole('button',{name:'Сохранить статью',exact:true}).click();await visible(f.page.getByText(/Нет права на это действие/));assert.equal(f.state.document.revision,1);
      f.state.knowledgeForbidden=false;let release;f.state.hold=new Promise(resolve=>release=resolve);await f.page.getByRole('button',{name:'Сохранить статью',exact:true}).click();await visible(f.page.getByRole('button',{name:'Подождите…',exact:true}));assert.equal(await f.page.getByRole('button',{name:'Подождите…',exact:true}).isDisabled(),true);assert.equal(await f.page.getByText('Статья сохранена на сервере.',{exact:true}).count(),0);release();f.state.hold=null;await visible(f.page.getByText('Статья сохранена на сервере.',{exact:true}));assert.equal(f.state.document.revision,2);
    }finally{await f.context.close();}
  });
  await check('recipe full fields, optional yield, kitchen/bar validation, real failure and awaited save',async()=>{
    const f=await fixture();try{await f.goto('/menu?editor=new');await visible(f.page.getByRole('button',{name:'Сохранить рецепт',exact:true}));const form=f.page.locator('form.bf-material-editor');
      await form.getByLabel(/^Название/).fill('Новый лимонад');await form.getByLabel(/^Состав/).fill('Джин 40 мл\nЛёд — полный бокал');await form.getByLabel(/^Заведение/).selectOption('BF/BB');await form.getByLabel(/^Теги/).fill('летний, цитрус');assert.equal(await form.getByLabel('Выход',{exact:true}).getAttribute('required'),null);await noOverflow(f.page);await f.page.screenshot({path:reports+'/recipe-editor-390.png',fullPage:true});
      await form.getByLabel(/^Раздел/).selectOption('kitchen');assert.equal(await form.getByLabel(/^Описание \/ технология/).getAttribute('required'),'');assert.equal(await form.getByLabel(/^Состав/).getAttribute('required'),null);await form.getByLabel(/^Раздел/).selectOption('bar');assert.equal(await form.getByLabel(/^Состав/).getAttribute('required'),'');
      f.state.recipeFailure=true;await f.page.getByRole('button',{name:'Сохранить рецепт',exact:true}).click();await visible(f.page.getByRole('alert'));assert.equal(recipeWrites(f.state).length,1);assert.equal(await form.getByLabel(/^Название/).inputValue(),'Новый лимонад');assert.equal(new URL(f.page.url()).hash.includes('editor=new'),true);
      f.state.recipeFailure=false;let release;f.state.hold=new Promise(resolve=>release=resolve);await f.page.getByRole('button',{name:'Сохранить рецепт',exact:true}).click();await visible(f.page.getByRole('button',{name:'Сохраняем…',exact:true}));assert.equal(await f.page.getByRole('button',{name:'Сохраняем…',exact:true}).isDisabled(),true);assert.equal(new URL(f.page.url()).hash.includes('editor=new'),true);release();f.state.hold=null;await visible(f.page.getByRole('heading',{name:'Новый лимонад',exact:true}));assert.deepEqual(await f.page.locator('.warm-recipe-composition li').allTextContents(),['Джин 40 мл','Лёд — полный бокал']);assert.equal(await f.page.locator('details.bf-content-actions').getAttribute('open'),null);const placement=await f.page.evaluate(()=>({tags:document.querySelector('.warm-recipe-tags').getBoundingClientRect().top,yield:document.querySelector('.warm-recipe-yield').getBoundingClientRect().top}));assert.ok(placement.tags<placement.yield);await noOverflow(f.page);
    }finally{await f.context.close();}
  });
  await check('recipe timeout releases pending state and reports unknown completion without retry',async()=>{
    const f=await fixture();let release;try{
      await f.context.addInitScript(()=>{const original=window.setTimeout.bind(window);window.setTimeout=(handler,ms,...args)=>original(handler,ms===15000?100:ms,...args);});
      await f.goto('/menu?editor=new');await visible(f.page.getByRole('button',{name:'Сохранить рецепт',exact:true}));const form=f.page.locator('form.bf-material-editor');await form.getByLabel(/^Название/).fill('Медленный рецепт');await form.getByLabel(/^Состав/).fill('Вода 100 мл');f.state.hold=new Promise(resolve=>release=resolve);await f.page.getByRole('button',{name:'Сохранить рецепт',exact:true}).click();await visible(f.page.getByText(/Запрос мог выполниться/));assert.equal(await f.page.getByRole('button',{name:'Сохранить рецепт',exact:true}).isEnabled(),true);assert.equal(await form.getByLabel(/^Название/).inputValue(),'Медленный рецепт');assert.equal(recipeWrites(f.state).length,1);release();f.state.hold=null;
    }finally{release?.();await f.context.close();}
  });
  await check('recipe archive warning sends guarded request only after confirmation; cancellation writes nothing',async()=>{
    const f=await fixture();try{await f.goto('/menu/bar%3A7');await visible(f.page.getByRole('heading',{name:bar.name,exact:true}));assert.equal(await f.page.locator('details.bf-content-actions').getAttribute('open'),null);await f.page.getByText('Действия с материалом',{exact:true}).click();await f.page.getByRole('button',{name:'Архив',exact:true}).click();await visible(f.page.getByRole('alertdialog'));assert.match(await f.page.getByRole('alertdialog').innerText(),/связанные.*вопросы/);await f.page.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(recipeWrites(f.state).length,0);await f.page.getByRole('button',{name:'Архив',exact:true}).click();await f.page.getByRole('button',{name:'Архивировать',exact:true}).click();try{await visible(f.page.locator('.bf-notice').filter({hasText:'Позиция находится в архиве.'}));}catch(error){fs.writeFileSync(reports+'/archive-debug.json',JSON.stringify({calls:f.state.calls,recipes:f.state.recipes,text:await f.page.locator('body').innerText()},null,2));throw error;}const write=recipeWrites(f.state)[0];assert.equal(write.method,'PATCH');assert.equal(JSON.parse(write.body).expected_version,'r8');assert.ok(write.headers['idempotency-key']);assert.equal(recipeWrites(f.state).length,1);}finally{await f.context.close();}
  });
  assert.deepEqual(unexpected,[],'all API traffic must have explicit local fixtures');assert.deepEqual(errors,[],'no page errors');
}catch(error){console.error(error.stack||error);process.exitCode=1;}finally{
  fs.writeFileSync(reports+'/results.json',JSON.stringify({results,unexpected,errors},null,2));
  await browser?.close();server?.kill('SIGTERM');
}
