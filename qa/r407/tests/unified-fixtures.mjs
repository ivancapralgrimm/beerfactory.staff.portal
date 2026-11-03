// Explicit transport fixtures for the actual app. No server, RLS or production claim.
import { randomUUID } from 'node:crypto';

export function makeStore(role = 'staff', owner = false, position = 'bartender') {
  const now = new Date().toISOString();
  const profile = {id:randomUUID(),first_name:'Иван',last_name:'Проверяющий',role,is_owner:owner,is_active:true,position_code:position,position:'Бармен BF',birth_date:'1995-10-31',position_change_allowed:true,recovery_configured:true};
  const articles = new Map([['review-article', {schemaVersion:2,id:'review-article',title:'Сервис проверка',category:'Сервис',description:'Проверенная статья из сетевой фикстуры',status:'published',revision:1,dashboard_featured:true,blocks:[{id:'paragraph-review',type:'paragraph',content:{text:'Проверка знаний и стандартов сервиса.',marks:[{type:'bold',from:0,to:8}]}}]}]]);
  const recipes = [{id:'bar:review-drink',recordId:'review-drink',source:'bar',name:'Малиновый лимонад',category:'Лимонад',venue:'BF/BB',description:'Тестовая техкарта из Worker',ingredients:['Вода — 200 мл','Малина — 30 г'],method:'Смешать в стакане со льдом.',serving:'250 мл',tags:['ягоды'],status:'Актуальный',version:'1'}, {id:'kitchen:review-food',recordId:'review-food',source:'kitchen',name:'Бургер проверка',category:'Кухня',venue:'BB',description:'Тестовая кухня',ingredients:['Булочка — 1 шт','Котлета — 150 г'],method:'Собрать и подать.',serving:'300 г',status:'Актуальный',version:'1'}];
  const questions = ['bar','service'].flatMap(type => [1,2].map(n => ({id:`review-${type}-${n}`,categoryId:type,knowledgeType:type,venue:'common',q:`${type === 'bar' ? 'Бар' : 'Сервис'}: вопрос ${n}`,answers:['Правильный ответ','Ошибка А','Ошибка Б','Ошибка В'].map((text,i)=>({text,correct:i===0})),topic:'Основы',group:`${type}-group-${n}`,source:'Материал проверки',sourceRef:'knowledge:review-article',reviewUrl:'#/knowledge/review-article',reviewLabel:'Сервис проверка',status:'active',sortOrder:n*10,revision:1})));
  const categories = ['bar','service'].map((type,i)=>({id:type,label:type==='bar'?'Бар проверка':'Сервис проверка',knowledgeType:type,venue:'bf',specificQuestionCount:0,questionsPerTest:2,active:true,sortOrder:i*10+10,updatedAt:now,ticketPlan:[{topic:'Основы',count:2,sortOrder:10}]}));
  const editorBank = {schemaVersion:3,settings:{passPercent:80,questionsPerTest:2,revision:1},categories,questions};
  const shift = {id:'review-shift',operational_shift_id:'review-operational',shift_date:now.slice(0,10),position_code:position,position_label:'Бармен BF',status:'not_started',opened_by:null,closed_by:null,opened_at:null,closed_at:null,expired_at:null,created_at:now,closing_unlocked_at:null,closing_unlocked_by:null,final_audit_logged_at:null};
  const rows = ['opening','closing'].flatMap((type)=>[1,2].map(n=>({item_key:`${type}-${n}`,check_type:type,label:`${type==='opening'?'Подготовить':'Убрать'} бар ${n}`,sort_order:n*10,critical:false,is_active:true,active_iso_weekdays:[1,2,3,4,5,6,7],group_key:null,group_label:null,check:null})));
  return {profile,now,articles,recipes,editorBank,shift,rows,notes:[{id:'review-note',shift_id:null,author_id:profile.id,subject:'Проверить остатки',body:'Передайте коллегам остатки лимонада.',priority:'critical',status:'active',notify_all:true,notify_positions:[],resolved_by:null,resolved_at:null,created_at:now}],acks:[],history:[],progress:[],reads:[],writes:[],unknown:[],blocked:[],websockets:[],fail:new Set(),capabilities:true,profileFailure:false,loginFailure:false,registrationFailure:false,recoveryFailure:false,submitted:[]};
}

function authData(store) {
  const user={id:store.profile.id,aud:'authenticated',role:'authenticated',email:'review@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:store.now};
  const exp=Math.floor(Date.now()/1000)+3600;
  const part=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  const access_token=`${part({alg:'HS256',typ:'JWT'})}.${part({sub:user.id,exp,aud:'authenticated'})}.fixture`;
  return {access_token,refresh_token:'review-fixture-only',token_type:'bearer',expires_in:3600,expires_at:exp,user};
}

export async function mockActualApp(browser, {base='http://127.0.0.1:4407',role='staff',owner=false,position='bartender',width=390,anonymous=false} = {}) {
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  const store=makeStore(role,owner,position), session=authData(store);
  if (!anonymous) await context.addInitScript(session => {
    // The normal Supabase SDK restores this standard auth record; no app test hook.
    if (!localStorage.getItem('sb-oltbkrvernfgymxtsfys-auth-token')) localStorage.setItem('sb-oltbkrvernfgymxtsfys-auth-token',JSON.stringify(session));
    if (!localStorage.getItem('sb-127-auth-token')) localStorage.setItem('sb-127-auth-token',JSON.stringify(session));
  },session);
  const privileged=()=>store.profile.role==='admin'||store.profile.is_owner;
  const recipeEditor=()=>privileged()||store.profile.role==='senior';
  const knowledgeAccess=()=>({can_read:true,can_create:privileged(),can_edit:privileged(),can_publish:privileged(),can_manage_permissions:privileged()});
  const publicBank=()=>({schemaVersion:3,passPercent:store.editorBank.settings.passPercent,questionsPerTest:2,revision:store.editorBank.settings.revision,categories:store.editorBank.categories.filter(c=>c.active).map(c=>({...c,questions:store.editorBank.questions.filter(q=>q.status==='active'&&q.knowledgeType===c.knowledgeType&&(q.venue==='common'||q.venue===c.venue))}))});
  const workflow=()=>({context:{state:store.profile.position_code?'available':'position_required',window_state:'open',venue_timezone:'Asia/Novosibirsk',server_now:store.now,operational_date:store.now.slice(0,10),operational_iso_weekday:6,general_cleaning_day:false,closes_at:null,next_open_at:null,position_code:store.profile.position_code,position_label:store.shift.position_label},shift:store.shift,rows:store.rows,configured:true});
  const editorRows=()=>store.rows.map(row=>({...row,position_code:store.profile.position_code,position_label:store.shift.position_label,created_at:store.now,updated_at:store.now,created_by:store.profile.id,updated_by:store.profile.id,updated_by_name:'Иван Проверяющий',revision:row.revision||1}));
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
    if(url.origin===base) return route.continue();
    // Every nonlocal request is fulfilled or aborted here. Never continue remotely.
    // Match real CORS preflight semantics in WebKit as well as Chromium.
    // Authorization is a non-wildcard request header under the Fetch spec.
    const cors={'access-control-allow-origin':req.headers().origin||base,'access-control-allow-credentials':'true','vary':'Origin'};
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:cors});
    const denied=(message='forbidden',status=403)=>json({code:status===404?'PGRST202':'P0001',message,error:message},status);
    if(method==='OPTIONS') return route.fulfill({status:204,headers:{...cors,'access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','access-control-allow-headers':req.headers()['access-control-request-headers']||'authorization,apikey,content-type,x-client-info,x-supabase-api-version'}});
    const body=()=>{try{return req.postDataJSON()||{};}catch{return {};}};
    if(path.endsWith('/staff-login')){store.writes.push({api:'staff-login',body:body()});return store.loginFailure?denied('invalid_credentials',401):json({session,recovery_configured:store.profile.recovery_configured});}
    if(path.endsWith('/staff-register')){store.writes.push({api:'staff-register',body:body()});return store.registrationFailure?denied('user_exists',409):json({ok:true});}
    if(path.endsWith('/staff-recover')){store.writes.push({api:'staff-recover',body:body()});return store.recoveryFailure?denied('invalid_recovery_code',400):json({ok:true});}
    if(path.endsWith('/staff-set-recovery')){store.writes.push({api:'staff-set-recovery',body:body()});if(store.fail.has('recovery-setup'))return denied();store.profile.recovery_configured=true;return json({ok:true});}
    if(path.endsWith('/staff-profile')){
      if(store.profileFailure)return denied('temporary_failure',500);
      if(method==='PATCH'){store.writes.push({api:'staff-profile',body:body()});if(store.fail.has('profile'))return denied();Object.assign(store.profile,body());return json({ok:true,profile:store.profile});}
      store.reads.push('staff-profile');return json({profile:store.profile});
    }
    if(path==='/auth/v1/user')return json(session.user);
    if(path==='/auth/v1/token')return json(session);
    if(path.startsWith('/auth/'))return json({});
    if(path.endsWith('/staff-admin-users')){
      if(!privileged())return denied();
      if(method==='POST'){store.writes.push({api:'staff-admin-users',body:body()});return store.fail.has('staff')?denied():json({ok:true});}
      return json({ok:true,me:{id:store.profile.id,is_owner:store.profile.is_owner},users:[{...store.profile,created_at:store.now,last_seen_at:store.now,recovery_set_at:store.now},{...store.profile,id:'22222222-2222-4222-8222-222222222222',first_name:'Мария',last_name:'Коллега',role:'staff',is_owner:false,created_at:store.now,last_seen_at:null,recovery_set_at:store.now}]});
    }
    if(path.endsWith('/handover-push'))return json({ok:true});
    if(path.includes('/admin/recipes/')){
      const match=path.match(/\/admin\/recipes\/([^/]+)(?:\/([^/]+))?/);
      if(!recipeEditor())return denied();
      let data=body();
      if(!req.headers()['content-type']?.includes('application/json')){const raw=req.postDataBuffer()?.toString()||'';const part=raw.match(/name="payload"\r\n\r\n([\s\S]*?)\r\n--/);try{data=JSON.parse(part?.[1]||'{}');}catch{data={};}}
      store.writes.push({api:'recipe',method,body:data});if(store.fail.has('recipe'))return denied('admin_recipe_write_failed',500);
      const id=match?.[2]||`review-${randomUUID()}`,source=match?.[1]||'bar';
      const old=store.recipes.find(r=>r.recordId===id&&r.source===source);
      if(method==='DELETE'){store.recipes=store.recipes.filter(r=>r!==old);return json({ok:true,id:`${source}:${id}`});}
      const saved={...old,...data,desc:data.description||old?.desc,id:`${source}:${id}`,source,recordId:id,ingredients:Array.isArray(data.ingredients)?data.ingredients:String(data.ingredients||'').split('\n'),version:String(Number(old?.version||0)+1)};
      store.recipes=store.recipes.filter(r=>r!==old).concat(saved);return json({ok:true,id:saved.id,recordId:id,source,recipe:saved});
    }
    if(/workers\.dev$/.test(url.hostname)||path.startsWith('/recipes/')){store.reads.push('recipes');return json({recipes:store.recipes,capabilities:{governance:true,recipe_admin_write:true,source_aware_ids:true,recipe_material_lifecycle_v1:store.capabilities,recipe_photo_cleanup_v1:store.capabilities}});}
    if(path.includes('/rest/v1/rpc/')){
      const rpc=path.split('/').pop(),b=body();
      const writes=/^(save_|set_|create_|acknowledge_|resolve_|confirm_|unlock_|delete_|submit_|register_|unregister_|reorder_)/.test(rpc);
      (writes?store.writes:store.reads).push(writes?{api:rpc,body:b}:rpc);
      if(store.fail.has(rpc))return denied('forced_write_rejection',500);
      if(rpc==='portal_access_context')return store.capabilities?json({can_manage_staff:privileged(),can_view_admin_logs:privileged(),can_manage_recipes:recipeEditor(),can_manage_attestation_bank:privileged(),checklist_positions:recipeEditor()?[store.profile.position_code]:[]}):denied('function not found',404);
      if(rpc==='get_material_lifecycle_capabilities')return store.capabilities?json({schemaVersion:1,knowledgeLifecycle:true,knowledgeUnderline:true,knowledgeMediaCleanup:true}):denied('function not found',404);
      if(rpc==='get_knowledge_editor_context')return json(knowledgeAccess());
      if(rpc==='get_knowledge_articles')return json([...store.articles.values()].filter(a=>a.status==='published').map(a=>({...a,search_text:a.blocks.map(b=>b.content?.text||'').join(' '),first_image:null})));
      if(rpc==='get_knowledge_editor_articles')return privileged()?json([...store.articles.values()]):denied();
      if(rpc==='get_knowledge_article')return store.articles.has(b.p_article_id)?json(store.articles.get(b.p_article_id)):denied('article_not_found',404);
      if(rpc==='save_knowledge_article'){
        if(!privileged())return denied();
        const old=store.articles.get(b.p_document.id);if((old?.revision||0)!==b.p_expected_revision)return denied('article_revision_conflict',409);
        const saved={...b.p_document,revision:(old?.revision||0)+1};store.articles.set(saved.id,saved);return json({id:saved.id,revision:saved.revision,status:saved.status,created:!old,updated_at:new Date().toISOString()});
      }
      if(rpc==='delete_knowledge_article'){if(!privileged())return denied();store.articles.delete(b.p_article_id);return json({id:b.p_article_id,deleted:true});}
      if(rpc==='get_dashboard_upcoming_birthdays')return json([{profile_id:store.profile.id,first_name:'Иван',last_name:'Проверяющий',position_code:store.profile.position_code,days_until:0,age_years:31}]);
      if(rpc==='get_position_shift_workflow')return json(workflow());
      if(rpc==='set_position_shift_check'){
        const row=store.rows.find(r=>r.item_key===b.p_item_key&&r.check_type===b.p_check_type);if(!row)return denied('invalid_check');
        row.check={id:`check-${row.item_key}`,check_type:row.check_type,item_key:row.item_key,label:row.label,completed:b.p_completed,completed_by:store.profile.id,completed_at:new Date().toISOString()};return json(row.check);
      }
      if(rpc==='confirm_position_shift'){store.shift.status=b.p_action==='open'?'active':'closed';store.shift[b.p_action==='open'?'opened_at':'closed_at']=new Date().toISOString();return json(store.shift);}
      if(rpc==='unlock_position_shift_closing'){store.shift.closing_unlocked_at=new Date().toISOString();return json(store.shift);}
      if(rpc==='get_checklist_editor_snapshot')return json({can_edit:recipeEditor(),positions:recipeEditor()?[{code:store.profile.position_code,label:store.shift.position_label}]:[],rows:recipeEditor()?editorRows():[]});
      if(rpc==='save_checklist_definition'){
        if(!recipeEditor()||b.p_position_code!==store.profile.position_code)return denied();
        const old=store.rows.find(r=>r.item_key===b.p_item_key),saved={...old,item_key:b.p_item_key||`review-item-${store.rows.length}`,check_type:b.p_check_type,label:b.p_label,critical:b.p_critical,is_active:b.p_is_active,active_iso_weekdays:b.p_active_iso_weekdays,group_key:b.p_group_key,group_label:b.p_group_label,sort_order:old?.sort_order||50,revision:(old?.revision||0)+1,check:null};store.rows=store.rows.filter(r=>r!==old).concat(saved);return json(editorRows().find(r=>r.item_key===saved.item_key));
      }
      if(rpc==='get_own_position_shift_history_v1')return store.capabilities?json([{...store.shift,checks:store.rows.map(r=>({check_type:r.check_type,item_key:r.item_key,label:r.label,completed:!!r.check?.completed}))}]):denied('function not found',404);
      if(rpc==='get_attestation_bank_v3'||rpc==='get_attestation_bank')return json(publicBank());
      if(rpc==='get_attestation_editor_bank_v3')return privileged()?json(store.editorBank):denied();
      if(rpc==='get_recent_attestation_attempts')return json(store.history);
      if(rpc==='submit_attestation_attempt'){
        store.submitted.push(b);const result={id:b.p_client_attempt_id,user_id:store.profile.id,display_name:'Иван Проверяющий',category:b.p_category,category_id:b.p_category_id,score:Math.round(b.p_correct_answers/b.p_total_questions*100),passed:b.p_correct_answers/b.p_total_questions>=.8,total_questions:b.p_total_questions,correct_answers:b.p_correct_answers,category_results:b.p_category_results,created_at:b.p_finished_at,finished_at:b.p_finished_at,attempted_at:b.p_finished_at};store.history.push(result);return json(result);
      }
      if(rpc==='save_attestation_question_v3'){
        if(!privileged())return denied();const doc=b.p_document,id=doc.id||`review-question-${randomUUID()}`,old=store.editorBank.questions.find(q=>q.id===id),saved={...old,...doc,id,revision:(old?.revision||0)+1,status:old?.status||'active',sortOrder:old?.sortOrder||90};store.editorBank.questions=store.editorBank.questions.filter(q=>q!==old).concat(saved);store.editorBank.settings.revision++;return json(saved);
      }
      if(rpc==='save_attestation_editor_settings_v3'){
        if(!privileged())return denied();for(const item of b.p_category_settings){const cat=store.editorBank.categories.find(c=>c.id===item.categoryId);if(cat)Object.assign(cat,item,{ticketPlan:b.p_ticket_plan.filter(p=>p.categoryId===cat.id)});}store.editorBank.settings.passPercent=b.p_pass_percent;store.editorBank.settings.revision++;return json(store.editorBank.settings);
      }
      if(rpc==='create_feed_post'){
        const note={id:`review-note-${randomUUID()}`,shift_id:null,author_id:store.profile.id,subject:b.p_subject,body:b.p_body,priority:b.p_priority,status:'active',notify_all:b.p_notify_all,notify_positions:b.p_notify_positions,resolved_by:null,resolved_at:null,created_at:new Date().toISOString()};store.notes.unshift(note);return json(note);
      }
      if(rpc==='acknowledge_feed_post'){if(!store.acks.some(a=>a.note_id===b.p_note_id&&a.user_id===store.profile.id))store.acks.push({note_id:b.p_note_id,user_id:store.profile.id,created_at:new Date().toISOString()});return json({ok:true});}
      if(rpc==='resolve_handover'){const note=store.notes.find(n=>n.id===b.p_note_id);Object.assign(note,{status:'resolved',resolved_by:store.profile.id,resolved_at:new Date().toISOString()});return json(note);}
      store.unknown.push({method,path,rpc});return denied('unimplemented_fixture',501);
    }
    if(path.endsWith('/notes'))return json(store.notes);
    if(path.endsWith('/profiles'))return json([store.profile]);
    if(path.endsWith('/feed_acknowledgements'))return json(store.acks);
    if(path.endsWith('/quiz_attempts'))return json(store.history);
    if(path.endsWith('/audit_log'))return privileged()?json([{id:'review-audit',actor_id:store.profile.id,action:'profile_update',entity_type:'profile',entity_id:store.profile.id,entity_name:'Иван Проверяющий',before_data:{},after_data:{},metadata:{},created_at:store.now}]):denied();
    if(path.endsWith('/training_progress')){if(method==='POST'){store.writes.push({api:'training_progress',body:body()});if(store.fail.has('training_progress'))return denied();store.progress.push({...body(),completed:true});return route.fulfill({status:201,body:'',headers:cors});}return json(store.progress);}
    store.blocked.push({method,url:url.origin+path});return route.abort('blockedbyclient');
  });
  await context.routeWebSocket(/.*/, socket=>{
    const url=new URL(socket.url());
    if(url.origin===base.replace(/^http/,'ws'))return socket.connectToServer();
    store.websockets.push(url.origin+url.pathname);
    // Simulated Phoenix acknowledgement only; connectToServer is never called remotely.
    socket.onMessage(message=>{try{const p=JSON.parse(String(message));if(Array.isArray(p))socket.send(JSON.stringify([p[0],p[1],p[2],'phx_reply',{status:'ok',response:{postgres_changes:[]}}]));}catch{}});
  });
  const page=await context.newPage(),errors=[],consoleErrors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error'&&!/^Failed to load resource:/.test(m.text()))consoleErrors.push(m.text());});
  const open=async path=>{await page.goto(`${base}/#${path}`);await page.locator('main').waitFor({state:'visible'});};
  return {context,page,store,session,open,errors,consoleErrors};
}
