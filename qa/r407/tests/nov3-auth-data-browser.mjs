// Actual app/SDK in two engines. Synthetic HTTP/WS only, no live login/write.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';
import {mockActualApp} from './unified-fixtures.mjs';
const base=process.env.BF_UNIFIED_URL||'http://127.0.0.1:4410';
const out=path.resolve('qa/r407/evidence/nov3-auth-data');fs.mkdirSync(out,{recursive:true});
const results=[],sessions=[],errors=[];
const old=JSON.parse(fs.readFileSync('qa/r407/evidence/profile-avatar-size/after.json'));
for(const [engine,type,opts]of[['chromium',chromium,{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}],['webkit',webkit,{}]]){
 const browser=await type.launch(opts);
 const run=async(name,fn)=>{try{await fn();results.push({engine,name,pass:true});}catch(e){errors.push({engine,name,error:String(e.stack||e)});}};
 const session=async(options={})=>{const s=await mockActualApp(browser,{base,...options});sessions.push(s);await s.page.emulateMedia({reducedMotion:'reduce'});return s;};
 try{
  for(const name of['Иван Проверяющий','Проверяющий Иван'])await run('DOM-filled login on one click: '+name,async()=>{
   const s=await session({anonymous:true});await s.open('/login');await s.page.locator('#code').waitFor();
   // Password-manager-like DOM values with no input/change events. This does not
   // claim to automate the OS password manager or a physical iPhone.
   await s.page.evaluate(name=>{document.querySelector('#fullName').value=name;document.querySelector('#code').value='1234';},name);
   await s.page.getByRole('button',{name:'Войти',exact:true}).click();await s.page.locator('.bf-greeting').waitFor();
   const calls=s.store.writes.filter(w=>w.api==='staff-login');assert.equal(calls.length,1);assert.equal(calls[0].body.full_name,name);assert.equal(calls[0].body.code,'1234');
   await s.page.reload();await s.page.locator('.bf-greeting').waitFor();await s.context.close();
  });
  await run('one in-flight request for repeated synchronous submissions',async()=>{
   const s=await session({anonymous:true});await s.context.route('**/functions/v1/staff-login',async route=>{await new Promise(r=>setTimeout(r,200));await route.fallback();});await s.open('/login');await s.page.getByLabel('Имя и фамилия',{exact:true}).fill('Иван Проверяющий');await s.page.getByLabel('Пароль',{exact:true}).fill('1234');
   await s.page.evaluate(()=>{const f=document.querySelector('form');f.requestSubmit();f.requestSubmit();f.requestSubmit();});await s.page.locator('.bf-greeting').waitFor();assert.equal(s.store.writes.filter(w=>w.api==='staff-login').length,1);await s.context.close();
  });
  for(const status of[401,429,503])await run('server '+status+' remains on login without retry',async()=>{
   const s=await session({anonymous:true});let calls=0;
   await s.context.route('**/functions/v1/staff-login',route=>{calls++;return route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':base},body:JSON.stringify({error:status===429?'rate_limited':status===503?'login_unavailable':'login_failed'})});});
   await s.open('/login');await s.page.getByLabel('Имя и фамилия',{exact:true}).fill('Иван Проверяющий');await s.page.getByLabel('Пароль',{exact:true}).fill('1234');await s.page.getByRole('button',{name:'Войти',exact:true}).click();const alert=s.page.getByRole('alert');await alert.getByText(status===429?/Слишком много/:status===503?/Сеть отвечает/:/Не удалось войти/).waitFor();assert.equal(calls,1);assert.ok(s.page.url().endsWith('#/login'));assert.equal(await s.page.getByLabel('Пароль',{exact:true}).inputValue(),'1234');
   if(status===429){await s.page.screenshot({path:path.join(out,engine+'-login-error.png'),fullPage:true});await s.page.setViewportSize({width:1440,height:900});await s.page.screenshot({path:path.join(out,engine+'-login-error-1440.png'),fullPage:true});}await s.context.close();
  });
  await run('default source lists, opens and searches server articles',async()=>{
   const s=await session();await s.open('/knowledge');await s.page.getByRole('link',{name:/Сервис проверка/}).waitFor();assert.ok(s.store.reads.includes('get_knowledge_articles'));assert.equal(s.store.reads.includes('legacy-training-data'),false);
   await s.page.getByRole('link',{name:/Сервис проверка/}).click();await s.page.getByText('Проверка знаний и стандартов сервиса.',{exact:true}).waitFor();assert.ok(s.store.reads.includes('get_knowledge_article'));await s.page.screenshot({path:path.join(out,engine+'-server-article.png'),fullPage:true});await s.page.setViewportSize({width:1440,height:900});await s.page.screenshot({path:path.join(out,engine+'-server-article-1440.png'),fullPage:true});await s.page.setViewportSize({width:390,height:844});
   await s.open('/');const search=s.page.locator('#dashboard-global-search');await search.fill('Сервис');await s.page.locator('.warm-home-search').getByRole('link',{name:/Сервис проверка/}).waitFor();await s.context.close();
  });
  const geometry=[];
  for(const longName of[false,true])await run('66px avatar preserves card/name/position geometry '+longName,async()=>{
   const s=await session({role:'admin',owner:true});if(longName){s.store.profile.first_name='Александра';s.store.profile.last_name='Константинопольская';}await s.open('/profile');await s.page.locator('.bf-profile-avatar img').evaluate(e=>e.decode());await s.page.evaluate(()=>document.fonts.ready);
   for(const width of[320,375,390,430,768]){
    await s.page.setViewportSize({width,height:844});const m=await s.page.locator('.bf-profile-identity').evaluate(e=>{const rect=x=>{const r=x.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};return{card:rect(e),avatar:rect(e.querySelector('.bf-profile-avatar')),name:rect(e.querySelector('h2')),position:rect(e.querySelector('.bf-profile-position')),scroll:document.documentElement.scrollWidth,viewport:innerWidth}});
    const key=engine+'-'+longName+'-'+width;const before=old.results.find(x=>x.key===key).geometry;
    assert.equal(m.avatar.width,66);assert.equal(m.avatar.height,66);assert.deepEqual(m.card,before.card);assert.deepEqual(m.name,before.name);assert.deepEqual(m.position,before.position);assert.equal(m.avatar.x+33,before.avatar.x+31);assert.equal(m.avatar.y+33,before.avatar.y+31);assert.ok(m.avatar.right+10<=m.name.x);assert.ok(m.scroll<=width+1);geometry.push({key,geometry:m});
    if(width===375||width===390)await s.page.screenshot({path:path.join(out,key+'-profile.png'),fullPage:true});
   }
   if(!longName){await s.page.setViewportSize({width:1440,height:900});await s.page.screenshot({path:path.join(out,engine+'-profile-1440.png'),fullPage:true});await s.page.setViewportSize({width:390,height:844});const html=await s.page.evaluate(()=>{const d=document.documentElement.cloneNode(true);d.querySelectorAll('script').forEach(e=>e.remove());d.querySelectorAll('[src],[href]').forEach(e=>{for(const a of['src','href']){const v=e.getAttribute(a);if(v?.startsWith('/assets/'))e.setAttribute(a,location.origin+v)}});return'<!doctype html>'+d.outerHTML});fs.writeFileSync(path.join(out,engine+'-profile.html'),html);}
   await s.context.close();
  });
  fs.writeFileSync(path.join(out,engine+'-geometry.json'),JSON.stringify(geometry,null,2));
 }finally{await browser.close()}
}
const report={scope:'Compiled app, Chromium/Linux WebKit, fixture HTTP/WS. DOM autofill simulation, not OS password manager. Reverse-name server policy separately tested in Edge VM, not deployed. No production writes/RLS/device claim.',results,errors,uncaught:sessions.flatMap(s=>s.errors),unknown:sessions.flatMap(s=>s.store.unknown)};
fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=errors.length||report.uncaught.length||report.unknown.length?1:0;
