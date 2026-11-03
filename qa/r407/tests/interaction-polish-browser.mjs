// Actual compiled app. Synthetic isolated HTTP/WS fixtures; never production writes.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {chromium,webkit} from 'playwright';import {mockActualApp} from './unified-fixtures.mjs';
const dir=path.resolve('qa/r407/evidence/interaction-polish');fs.mkdirSync(dir,{recursive:true});const results=[],sessions=[],issues=[];const base=process.env.BF_UNIFIED_URL||'http://127.0.0.1:4410';
const engines=[['chromium',chromium,{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}]];if(process.env.BF_TEST_WEBKIT==='1')engines.push(['webkit',webkit,{}]);
async function test(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS',name)}catch(e){issues.push({name,error:String(e.stack||e)});console.error('FAIL',name,e.message)}}
for(const [engine,type,options] of engines){let b;try{b=await type.launch(options)}catch(e){issues.push({name:engine+' launch',error:e.message});continue}
 try{
 const s=await mockActualApp(b,{base,role:'admin'});sessions.push(s);s.store.recipes[0].photo='/assets/warm/recipe-photo.jpg';await s.page.emulateMedia({reducedMotion:'reduce'});const p=s.page;p.setDefaultTimeout(8000);
 // Hash navigation followed immediately by reload cancels just-started RPCs
 // and WebKit reports those cancellations as CORS failures. Use one genuine
 // document navigation and let outgoing requests settle; do not filter errors.
 const pending=new Set();p.on('request',r=>pending.add(r));p.on('requestfinished',r=>pending.delete(r));p.on('requestfailed',r=>pending.delete(r));let navigation=0;
 async function open(url){
  for(let i=0;i<80;i++){if(!pending.size){await p.waitForTimeout(80);if(!pending.size)break;}else await p.waitForTimeout(80)}
  assert.equal(pending.size,0,'Previous page requests must finish before navigation');
  await p.goto(`${base}/?qa_navigation=${++navigation}#${url}`);await p.locator('main').waitFor();await p.waitForLoadState('networkidle');await p.evaluate(()=>document.fonts.ready);
 }
 for(const width of [320,375,390,430,768,1280])await test(`${engine} birthday and position fit ${width}`,async()=>{
  await p.setViewportSize({width,height:844});await open('/profile?view=details');const date=p.getByLabel('Дата рождения',{exact:true});await date.waitFor();await date.focus();
  const value=await date.inputValue();assert.equal(value,s.store.profile.birth_date);
  const measure=await date.evaluate(e=>{const r=e.getBoundingClientRect(),a=e.closest('label').getBoundingClientRect(),c=getComputedStyle(e);return{width:r.width,parent:a.width,left:r.left,right:r.right,view:innerWidth,offset:parseFloat(c.outlineOffset),outline:parseFloat(c.outlineWidth),style:c.outlineStyle,scroll:document.documentElement.scrollWidth}});
  assert.ok(measure.width<=measure.parent+.5&&measure.right<=width-15&&measure.left>=15,JSON.stringify(measure));assert.ok(measure.scroll<=width+1);assert.equal(measure.style,'solid');assert.ok(measure.outline>=2&&measure.offset<=-measure.outline,JSON.stringify(measure));
  if(width===375||width===390)await p.screenshot({path:path.join(dir,`after-profile-${engine}-${width}.png`),fullPage:true});
 });
 await p.setViewportSize({width:375,height:844});
 await test(`${engine} history score and single heading`,async()=>{
  s.store.history.push({id:'polish-result',user_id:s.store.profile.id,display_name:'Иван Проверяющий',category:'Бар проверка',category_id:'bar',score:100,passed:true,total_questions:15,correct_answers:15,category_results:{},created_at:new Date().toISOString()});
  await open('/attestation?view=history');await p.getByRole('button',{name:/Бар проверка/}).waitFor();assert.equal(await p.getByRole('heading',{name:'Мои результаты',exact:true}).count(),1);
  const sizes=await p.locator('.bf-attempt-score').evaluate(e=>{const n=e.querySelector('strong'),c=getComputedStyle(n),r=n.getBoundingClientRect();return {height:r.height,line:parseFloat(c.lineHeight),text:n.textContent,width:e.getBoundingClientRect().width}});assert.equal(sizes.text,'100%');assert.ok(sizes.height<=sizes.line+1&&sizes.width>=64,JSON.stringify(sizes));await p.screenshot({path:path.join(dir,`after-history-${engine}.png`),fullPage:true});
 });
 await test(`${engine} compact ticket actions and complete quiz`,async()=>{
  await open('/settings/attestation?view=tickets');const add=p.getByRole('button',{name:'Добавить билет',exact:true});await add.waitFor();assert.ok((await add.boundingBox()).height<=46);await p.screenshot({path:path.join(dir,`after-ticket-${engine}.png`),fullPage:true});
  await open('/attestation');await p.getByLabel('Выбери тему',{exact:true}).selectOption('bar');await p.getByRole('button',{name:'Начать аттестацию',exact:true}).click();await p.getByRole('heading',{name:/Бар: вопрос/}).waitFor();assert.equal(await p.locator('.bf-header').count(),0);assert.equal(await p.getByRole('button',{name:'Разделы',exact:true}).count(),0);
  for(const label of ['Следующий вопрос','Завершить аттестацию']){const next=p.getByRole('button',{name:label,exact:true});assert.ok((await next.boundingBox()).height<=46);const fit=await next.evaluate(e=>{const r=e.getBoundingClientRect(),t=document.createRange();t.selectNodeContents(e);const n=t.getBoundingClientRect();return {left:n.left-r.left,right:r.right-n.right}});assert.ok(fit.left>=7&&fit.right>=7,JSON.stringify(fit));await p.getByRole('radio',{name:'Правильный ответ',exact:true}).check();await p.screenshot({path:path.join(dir,`after-quiz-${engine}-${label==='Следующий вопрос'?'next':'finish'}.png`),fullPage:true});await next.click();}
  await p.getByRole('heading',{name:/Аттестация пройдена|Нужно повторить материал/}).first().waitFor();assert.equal(await p.getByRole('button',{name:'Разделы',exact:true}).count(),1);
 });
 await test(`${engine} hover focus and press on shared control families`,async()=>{
  const targets=[['/settings','.bf-nav-row'],['/feed','.bf-reader-button'],['/menu/bar%3Areview-drink','.bf-photo-button'],['/settings/attestation/questions','select'],['/knowledge/new','[contenteditable=true]'],['/feed/new','textarea'],['/beer','.bc-replay'],['/profile?view=details','input[type=date]']];
  for(const [url,selector] of targets){await open(url);const el=p.locator(selector).first();await el.waitFor();await el.hover();
   for(const kind of ['hover','focus','press']){if(kind==='focus')await el.focus();if(kind==='press'){await el.hover();await p.mouse.down()}
    const ring=await el.evaluate(e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();return {style:c.outlineStyle,width:parseFloat(c.outlineWidth),offset:parseFloat(c.outlineOffset),color:c.outlineColor,w:r.width,h:r.height}});if(kind==='press'){await p.mouse.move(0,0);await p.mouse.up();}assert.equal(ring.style,'solid',url+' '+kind);assert.ok(ring.width>=2&&ring.offset<=-ring.width,JSON.stringify({url,kind,...ring}));
   }
   if(url==='/feed'||url==='/knowledge/new'||url==='/beer')await p.screenshot({path:path.join(dir,`after-ring-${engine}-${url.replace(/[^a-z]/g,'')}.png`),fullPage:true});
  }
 });
 await test(`${engine} all route families retain inner keyboard focus`,async()=>{
  let checked=0;for(const url of ['/','/menu','/knowledge','/shift','/feed','/profile','/profile?view=details','/settings','/settings/notifications','/settings/recipes?editor=new','/knowledge/new','/shift/editor','/admin?section=team','/admin?section=audit','/settings/attestation/questions','/settings/attestation?view=tickets','/beer']){
   await open(url);const controls=p.locator('button:not(:disabled),a[href],input:not(:disabled):not([type=hidden]),textarea,select:not(:disabled),summary,[contenteditable=true]');
   for(const el of await controls.all()){
    if(!await el.isVisible()||await el.getAttribute('aria-disabled')==='true'||await el.getAttribute('type')==='checkbox'||await el.getAttribute('type')==='radio')continue;
    await el.focus();const m=await el.evaluate(e=>{const c=getComputedStyle(e);return {cls:e.className,style:c.outlineStyle,width:parseFloat(c.outlineWidth),offset:parseFloat(c.outlineOffset),text:e.textContent?.slice(0,30)}});assert.ok(m.style==='solid'&&m.width>=2&&m.offset<=-m.width,JSON.stringify({url,...m}));checked++;
   }
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),url+' overflow');
  }results.push({name:engine+' scanned focus controls',checked,pass:true});
 });
 const anon=await mockActualApp(b,{base,anonymous:true,width:375});sessions.push(anon);
 await test(`${engine} auth focus is dark and inset`,async()=>{await anon.open('/login');const input=anon.page.getByLabel('Имя и фамилия',{exact:true});await input.focus();const m=await input.evaluate(e=>{const c=getComputedStyle(e);return {color:c.outlineColor,offset:c.outlineOffset,width:c.outlineWidth}});assert.equal(m.color,'rgb(81, 58, 46)');assert.equal(m.offset,'-2px');await anon.page.screenshot({path:path.join(dir,`after-auth-focus-${engine}.png`),fullPage:true})});
 }finally{await b.close()}
}
const report={scope:'Compiled actual app. All external HTTP/WS intercepted; fixture data. Browser engines do not substitute for physical Safari/iPhone. No production/RLS PASS.',results,issues,uncaught:sessions.flatMap(s=>s.errors),unknown:sessions.flatMap(s=>s.store.unknown)};fs.writeFileSync(path.join(dir,'interaction-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:results.length,issues}));process.exitCode=issues.length||report.uncaught.length||report.unknown.length?1:0;
