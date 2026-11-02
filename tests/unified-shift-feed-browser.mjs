// Local Chromium against the actual application; all API and realtime traffic is mocked.
// Start Vite with VITE_SUPABASE_URL=http://127.0.0.1:54329 and a fixture publishable key.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.BF_TEST_SERVER_URL || 'http://127.0.0.1:4187';
const api='http://127.0.0.1:54329';
const browser=await chromium.launch({executablePath:process.env.BF_TEST_CHROMIUM || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[],pageErrors=[],unexpectedNetwork=[];
fs.mkdirSync('reports/unified-shift-feed',{recursive:true});
const uid='10000000-0000-4000-8000-000000000001';
const author='10000000-0000-4000-8000-000000000002';
const reader='10000000-0000-4000-8000-000000000003';
const missing='10000000-0000-4000-8000-000000000004';
const noteId='20000000-0000-4000-8000-000000000001';
const stamp='2026-10-30T10:00:00Z';
const visible=locator=>locator.waitFor({state:'visible',timeout:15000});
const absent=async locator=>assert.equal(await locator.count(),0);
const poll=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(done=>setTimeout(done,20));}assert.fail('Expected fixture state was not reached');};
async function check(name,run){try{await run();results.push({name,status:'passed'});console.log('PASS '+name);}catch(error){results.push({name,status:'failed',error:error.stack});console.error('FAIL '+name+' '+error.stack);throw error;}}
function definition(type='opening',key=type,label=type==='opening'?'Проверить зал':'Убрать зал') {return {position_code:'waiter_bb',position_label:'Официант BB',item_key:key,check_type:type,label,sort_order:1,critical:false,is_active:true,active_iso_weekdays:[1,2,3,4,5,6,7],group_key:null,group_label:null,created_at:stamp,updated_at:stamp,created_by:uid,updated_by:uid,updated_by_name:'Ольга Орлова',revision:4};}
async function session({role='staff',canEdit=true,contextState='available'}={}) {
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const profile={id:uid,first_name:'Ольга',last_name:'Орлова',role,is_owner:false,is_active:true,position:'Официант BB',position_code:'waiter_bb',recovery_configured:true};
 const user={id:uid,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:stamp};
 const exp=Math.floor(Date.now()/1000)+3600,part=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const token=part({alg:'HS256',typ:'JWT'})+'.'+part({sub:uid,exp,aud:'authenticated'})+'.fixture';
 await context.addInitScript(({session})=>localStorage.setItem('sb-127-auth-token',JSON.stringify(session)),{session:{access_token:token,refresh_token:'fixture',token_type:'bearer',expires_in:3600,expires_at:exp,user}});
 const state={profile,canEdit,contextState,status:'not_started',closingUnlocked:false,definitions:[definition(),definition('closing')],checks:new Map(),calls:[],holds:new Map(),failNext:new Map(),notes:[{id:noteId,shift_id:null,author_id:author,subject:'Подготовка зала',body:'Сообщение для смены',priority:'normal',status:'new',notify_all:false,notify_positions:['bartender'],resolved_by:null,resolved_at:null,created_at:stamp}],acks:[{note_id:noteId,user_id:reader,created_at:stamp},{note_id:noteId,user_id:missing,created_at:stamp}]};
 state.hold=name=>{let release,arrived;const wait=new Promise(done=>{release=done;}),started=new Promise(done=>{arrived=done;});state.holds.set(name,{wait,arrived});return {release,started};};
 const workflow=()=>({context:{state:state.contextState,window_state:state.contextState==='locked'?'locked':'open',venue_timezone:'Asia/Novosibirsk',server_now:'2026-10-31T01:00:00+07:00',operational_date:'2026-10-30',operational_iso_weekday:5,general_cleaning_day:false,closes_at:'2026-10-31T03:00:00+07:00',next_open_at:'2026-10-31T11:00:00+07:00',position_code:'waiter_bb',position_label:'Официант BB'},shift:state.contextState==='available'?{id:'shift',shift_date:'2026-10-30',position_code:'waiter_bb',position_label:'Официант BB',status:state.status,closing_unlocked_at:state.closingUnlocked?stamp:null}:null,rows:state.definitions.filter(row=>row.is_active).map(row=>({...row,check:state.checks.get(row.item_key)||null})),configured:true});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin===base)return route.continue();
  if(url.origin!==api){unexpectedNetwork.push(url.origin+url.pathname);return route.abort();}
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  const pathname=url.pathname;
  if(pathname.endsWith('/staff-profile'))return json({profile});
  if(pathname==='/auth/v1/user')return json(user);
  if(pathname.startsWith('/auth/'))return json({});
  if(pathname.endsWith('/handover-push'))return json({ok:true});
  if(pathname.includes('/rest/v1/rpc/')){
   const name=pathname.split('/').at(-1),args=req.postDataJSON()||{};
   state.calls.push({name,args});
   const hold=state.holds.get(name);if(hold){state.holds.delete(name);hold.arrived();await hold.wait;}
   const failure=state.failNext.get(name);if(failure){state.failNext.delete(name);return json({code:'P0001',message:failure},403);}
   if(name==='get_attestation_bank_v3')return json({schemaVersion:3,categories:[]});
   if(name==='get_position_shift_workflow')return json(workflow());
   if(name==='confirm_position_shift'){state.status=args.p_action==='open'?'active':'closed';return json(workflow().shift);}
   if(name==='unlock_position_shift_closing'){state.closingUnlocked=true;return json(workflow().shift);}
   if(name==='set_position_shift_check'){
    const def=state.definitions.find(row=>row.item_key===args.p_item_key),check={id:'check-'+def.item_key,check_type:args.p_check_type,item_key:def.item_key,label:def.label,completed:args.p_completed,completed_by:uid,completed_at:stamp};state.checks.set(def.item_key,check);return json(check);
   }
   if(name==='get_checklist_editor_snapshot')return json({can_edit:canEdit,positions:[{code:'waiter_bb',label:'Официант BB'}],rows:state.definitions});
   if(name==='save_checklist_definition'){
    let row=state.definitions.find(item=>item.item_key===args.p_item_key);if(!row){row=definition(args.p_check_type,'new-item');state.definitions.push(row);}
    Object.assign(row,{label:args.p_label,check_type:args.p_check_type,is_active:args.p_is_active,active_iso_weekdays:args.p_active_iso_weekdays,critical:args.p_critical,revision:row.revision+1});return json(row);
   }
   if(name==='create_feed_post'){const note={...state.notes[0],id:'20000000-0000-4000-8000-000000000002',author_id:uid,subject:args.p_subject,body:args.p_body,priority:args.p_priority,notify_all:args.p_notify_all,notify_positions:args.p_notify_positions};state.notes.unshift(note);return json(note);}
   if(name==='acknowledge_feed_post'){state.acks.push({note_id:args.p_note_id,user_id:uid,created_at:stamp});return json({note_id:args.p_note_id,user_id:uid,created_at:stamp,count:3});}
   if(name==='resolve_handover'){const note=state.notes.find(note=>note.id===args.p_note_id);Object.assign(note,{status:'resolved',resolved_by:uid,resolved_at:stamp});return json(note);}
   unexpectedNetwork.push('unconfigured RPC '+name);return json({message:'unconfigured fixture'},500);
  }
  if(pathname.endsWith('/notes'))return json(state.notes);
  if(pathname.endsWith('/feed_acknowledgements'))return json(state.acks);
  if(pathname.endsWith('/profiles')){
   const ids=url.searchParams.get('id')||'';
   return json([{id:uid,first_name:'Ольга',last_name:'Орлова',position:'Официант BB'},{id:author,first_name:'Анна',last_name:'Соколова',position:'Хостес'},{id:reader,first_name:'Иван',last_name:'Петров',position:'Бармен BF'}].filter(row=>ids.includes(row.id)));
  }
  unexpectedNetwork.push('unconfigured API '+pathname);return json({message:'unconfigured fixture'},500);
 });
 await context.routeWebSocket(/^ws:\/\/127\.0\.0\.1:54329\//,socket=>socket.onMessage(message=>{const packet=JSON.parse(String(message));if(Array.isArray(packet))socket.send(JSON.stringify([packet[0],packet[1],packet[2],'phx_reply',{status:'ok',response:{postgres_changes:[]}}]));}));
 const page=await context.newPage();page.on('pageerror',error=>pageErrors.push(String(error)));
 const open=async path=>{await page.goto(base+'/?bf-test-entry='+Date.now()+'#'+path);await visible(page.locator('main'));};
 return {page,state,open,close:()=>context.close()};
}
let current;
try {
 await check('Shift: unchecked open/close await main RPC, have no confirmation/note, and retain operational date',async()=>{
  current=await session();const {page,state,open}=current;await open('/shift');
  const opening=page.getByRole('button',{name:'Открыть смену',exact:true});await visible(opening);
  assert.match(await page.locator('.bf-page-description').count()?await page.locator('.bf-page-description').innerText():await page.locator('main').innerText(),/30 октября/);
  assert.equal(await page.getByRole('checkbox',{name:'Проверить зал',exact:true}).getAttribute('aria-checked'),'false');
  let gate=state.hold('confirm_position_shift');await opening.click();await gate.started;
  assert.equal(await page.getByRole('button',{name:'Открываем…',exact:true}).isDisabled(),true);await absent(page.getByRole('dialog'));await absent(page.locator('textarea'));
  assert.deepEqual(state.calls.filter(call=>call.name==='confirm_position_shift'),[{name:'confirm_position_shift',args:{p_action:'open'}}]);
  gate.release();await visible(page.getByText('Смена открыта.',{exact:true}));
  await page.getByRole('button',{name:'Закрытие',exact:true}).click();
  assert.equal(await page.getByRole('checkbox',{name:'Убрать зал',exact:true}).getAttribute('aria-checked'),'false');
  gate=state.hold('confirm_position_shift');await page.getByRole('button',{name:'Закрыть смену',exact:true}).click();await gate.started;
  assert.equal(await page.getByRole('button',{name:'Закрываем…',exact:true}).isDisabled(),true);gate.release();
  await visible(page.getByText('Смена закрыта.',{exact:true}));assert.equal(state.checks.size,0);await absent(page.getByRole('button',{name:'Открыть смену',exact:true}));
  await page.screenshot({path:'reports/unified-shift-feed/shift-closed-mobile.png'});await current.close();current=null;
 });
 await check('Shift: task error retains unchecked state; successful task and early closing unlock wait for server',async()=>{
  current=await session();const {page,state,open}=current;await open('/shift');const task=page.getByRole('checkbox',{name:'Проверить зал',exact:true});await visible(task);
  state.failNext.set('set_position_shift_check','forbidden');await task.click();await visible(page.getByRole('alert'));assert.equal(await task.getAttribute('aria-checked'),'false');
  let gate=state.hold('set_position_shift_check');await task.click();await gate.started;assert.equal(await task.getAttribute('aria-checked'),'false');assert.equal(await task.isDisabled(),true);gate.release();await poll(async()=>await task.getAttribute('aria-checked')==='true');
  await page.getByRole('button',{name:'Закрытие',exact:true}).click();gate=state.hold('unlock_position_shift_closing');await page.getByRole('button',{name:'Открыть чек-лист закрытия',exact:true}).click();await gate.started;await absent(page.getByRole('checkbox',{name:'Убрать зал',exact:true}));gate.release();await visible(page.getByRole('checkbox',{name:'Убрать зал',exact:true}));
  await current.close();current=null;
 });
 await check('Shift: locked window and missing position expose no shift mutations',async()=>{
  for(const stateName of ['locked','position_required']){current=await session({contextState:stateName});await current.open('/shift');await visible(current.page.getByText(stateName==='locked'?'Новая смена откроется в 11:00':'Должность не назначена',{exact:true}));await absent(current.page.getByRole('button',{name:'Открыть смену',exact:true}));assert.equal(current.state.calls.some(call=>/^(set_|confirm_|unlock_)/.test(call.name)),false);await current.close();current=null;}
 });
 await check('Checklist editor: flat seven-day row, weekday toggle never submits, conflict preserves draft, live refresh uses saved definition',async()=>{
  current=await session({role:'senior'});const {page,state,open}=current;await open('/shift/editor');await visible(page.getByRole('button',{name:'Изменить пункт: Проверить зал',exact:true}));
  await page.setViewportSize({width:320,height:844});await page.getByRole('button',{name:'Изменить пункт: Проверить зал',exact:true}).click();
  const weekdays=page.getByRole('group',{name:'Дни недели пункта'});assert.equal(await weekdays.getByRole('button').count(),7);
  const boxes=await weekdays.getByRole('button').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().y));assert.equal(new Set(boxes).size,1);
  await page.getByRole('button',{name:'Понедельник',exact:true}).click();assert.equal(state.calls.filter(call=>call.name==='save_checklist_definition').length,0);
  assert.equal(await page.getByRole('button',{name:'Понедельник',exact:true}).getAttribute('aria-pressed'),'false');
  await page.waitForTimeout(250); // Finish the existing control transition before the artifact capture.
  await page.screenshot({path:'reports/unified-shift-feed/checklist-weekdays-320.png',fullPage:true});
  await page.getByRole('textbox',{name:'Текст пункта',exact:true}).fill('Проверить новый зал');state.failNext.set('save_checklist_definition','checklist_revision_conflict');await page.getByRole('button',{name:'Сохранить пункт',exact:true}).click();await visible(page.getByRole('alert'));assert.equal(await page.getByRole('textbox',{name:'Текст пункта',exact:true}).inputValue(),'Проверить новый зал');
  const gate=state.hold('save_checklist_definition');await page.getByRole('button',{name:'Сохранить пункт',exact:true}).click();await gate.started;assert.equal(await page.getByRole('button',{name:'Сохраняем…',exact:true}).isDisabled(),true);
  const save=state.calls.filter(call=>call.name==='save_checklist_definition').at(-1);assert.equal(save.args.p_expected_revision,4);assert.deepEqual(save.args.p_active_iso_weekdays,[2,3,4,5,6,7]);gate.release();await visible(page.getByText('Пункт обновлён.',{exact:true}));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:'reports/unified-shift-feed/checklist-editor-320.png'});
  await open('/shift');await visible(page.getByRole('checkbox',{name:'Проверить новый зал',exact:true}));await current.close();current=null;
 });
 await check('Checklist editor: staff route guard and server can_edit both enforce rights',async()=>{
  current=await session();await current.open('/shift/editor');await visible(current.page.getByRole('button',{name:'Открыть смену',exact:true}));assert.equal(current.state.calls.some(call=>call.name==='get_checklist_editor_snapshot'),false);await current.close();
  current=await session({role:'admin',canEdit:false});await current.open('/shift/editor');await visible(current.page.getByText('Недостаточно прав',{exact:true}));await absent(current.page.getByRole('button',{name:'Добавить',exact:true}));await current.close();current=null;
 });
 await check('Feed: dedicated create route, collapsed notification capsules, failed write retains draft, successful write awaits exact audience payload',async()=>{
  current=await session();const {page,state,open}=current;await open('/feed/new');await visible(page.getByRole('heading',{name:'Новая заметка',exact:true}));
  const picker=page.locator('.bf-notify-picker');assert.equal(await picker.getAttribute('open'),null);await absent(page.getByRole('link',{name:'Подготовка зала',exact:true}));
  await page.getByLabel('Заголовок',{exact:true}).fill('Сообщение для бармена');await page.getByLabel('Сообщение',{exact:true}).fill('Проверить поставку');await picker.locator('summary').click();await picker.getByText('Бармен BB',{exact:true}).click();await picker.locator('summary').click();
  state.failNext.set('create_feed_post','forbidden');await page.getByRole('button',{name:'Опубликовать заметку',exact:true}).click();await visible(page.getByRole('alert'));assert.equal(await page.getByLabel('Заголовок',{exact:true}).inputValue(),'Сообщение для бармена');
  const gate=state.hold('create_feed_post');await page.getByRole('button',{name:'Опубликовать заметку',exact:true}).click();await gate.started;assert.equal(await page.getByRole('button',{name:'Публикуем…',exact:true}).isDisabled(),true);assert.equal(state.notes.length,1);
  assert.deepEqual(state.calls.filter(call=>call.name==='create_feed_post').at(-1).args,{p_subject:'Сообщение для бармена',p_body:'Проверить поставку',p_priority:'normal',p_notify_all:false,p_notify_positions:['bartender_bb']});
  gate.release();await visible(page.getByRole('link',{name:'Сообщение для бармена',exact:true}));assert.match(page.url(),/#\/feed$/);await absent(page.getByText(/Пульс команды/i));
  await current.close();current=null;
 });
 await check('Feed: actual reader names and explicit unavailable name, 24px face/44px target, dimmed dialog keyboard close, acknowledgement and resolve await/errors',async()=>{
  current=await session();const {page,state,open}=current;await open('/feed/'+noteId);await visible(page.getByRole('heading',{name:'Подготовка зала',exact:true}));
  const readers=page.getByRole('button',{name:'Ознакомились: 2. Посмотреть список',exact:true});await visible(readers);
  assert.equal(await page.locator('.bf-reader-pill').evaluate(node=>node.getBoundingClientRect().height),24);assert.ok((await readers.boundingBox()).height>=44);
  await readers.click();const dialog=page.getByRole('dialog',{name:'Ознакомились',exact:true});await visible(dialog);await visible(dialog.getByText('Иван Петров',{exact:true}));await visible(dialog.getByText('Имя недоступно',{exact:true}));
  const backdrop=await dialog.evaluate(node=>getComputedStyle(node,'::backdrop').backgroundColor);assert.notEqual(backdrop,'rgba(0, 0, 0, 0)');
  await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(node=>node.contains(document.activeElement)),true);
  await page.screenshot({path:'reports/unified-shift-feed/feed-readers-mobile.png'});await page.keyboard.press('Escape');await absent(page.getByRole('dialog'));assert.equal(await readers.evaluate(node=>document.activeElement===node),true);
  let gate=state.hold('acknowledge_feed_post');await page.getByRole('button',{name:'Ознакомился',exact:true}).click();await gate.started;assert.equal(await page.getByRole('button',{name:'Сохраняем…',exact:true}).first().isDisabled(),true);assert.equal(state.acks.length,2);gate.release();await visible(page.getByRole('button',{name:'Ознакомление отмечено',exact:true}));
  state.failNext.set('resolve_handover','forbidden');await page.getByRole('button',{name:'Отметить решённой',exact:true}).click();await visible(page.getByRole('alert'));assert.equal(state.notes[0].status,'new');
  gate=state.hold('resolve_handover');await page.getByRole('button',{name:'Отметить решённой',exact:true}).click();await gate.started;assert.equal(state.notes[0].status,'new');gate.release();await visible(page.getByText('Решено',{exact:true}));await absent(page.getByRole('button',{name:'Отметить решённой',exact:true}));await absent(page.getByRole('button',{name:/Редактировать|Открыть снова/}));
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}
  await current.close();current=null;
 });
 await check('No JavaScript errors or unexpected/external requests',async()=>{assert.deepEqual(pageErrors,[]);assert.deepEqual(unexpectedNetwork,[]);});
} catch {process.exitCode=1;if(current)await current.page.screenshot({path:'reports/unified-shift-feed/failure.png',fullPage:true}).catch(()=>{});}
finally {if(current)await current.close();fs.writeFileSync('reports/unified-shift-feed/results.json',JSON.stringify({scope:'Actual local app with explicitly mocked Supabase transport and realtime. No deployed SQL, RLS, Edge, network delivery or concurrency verification.',browser:await browser.version(),results,pageErrors,unexpectedNetwork},null,2)+'\n');await browser.close();}
