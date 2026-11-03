// Audit evidence only. Real compiled app; synthetic transport; no remote writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mockActualApp} from './unified-fixtures.mjs';
const dir=path.resolve(process.env.BF_AUDIT_OUTPUT||'qa/r407/evidence/unslop-hallmark'), manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const records=[],checks=[],issues=[];
async function open(s,url){await s.open(url);await s.page.reload();await s.page.locator('main').waitFor();await s.page.waitForTimeout(1000);await s.page.evaluate(()=>document.fonts.ready);}
async function capture(s,title,file){
 const geometry=await s.page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
 if(geometry.scrollWidth>geometry.width+1)issues.push({title,...geometry});
 await s.page.screenshot({path:path.join(dir,file),fullPage:true});
 const metrics=await s.page.evaluate(()=>({details:[...document.querySelectorAll('details')].map(e=>({label:e.querySelector('summary')?.textContent,open:e.open})),text:document.body.innerText,overflow:{html:getComputedStyle(document.documentElement).overflowX,body:getComputedStyle(document.body).overflowX}}));
 fs.writeFileSync(path.join(dir,file.replace('.png','.metrics.json')),JSON.stringify(metrics,null,2));
 records.push({title,route:new URL(s.page.url()).hash,file,...geometry});console.log('CAPTURE',title);
}
const s=await mockActualApp(browser,{base:process.env.BF_UNIFIED_URL||'http://127.0.0.1:4410',role:'admin'});
await s.page.emulateMedia({reducedMotion:'reduce'});
s.store.recipes[0].photo='/assets/warm/recipe-photo.jpg';
try{
 for(const [url,file] of [['/menu/bar%3Areview-drink','44.png'],['/knowledge/review-article','45.png']]){
  await open(s,url);
  for(const d of await s.page.locator('details').all()){
   if(!await d.evaluate(e=>e.open))await d.locator('summary').click({position:{x:35,y:20}});
   await s.page.waitForTimeout(80);assert.ok(await d.evaluate(e=>e.open),'details must be open');
  }
  await capture(s,file==='44.png'?'Рецепт: раскрытые блоки и действия':'Статья: действия с материалом',file);
  assert.ok(await s.page.locator('details').evaluateAll(es=>es.every(e=>e.open)));
  checks.push({name:'Expanded material actions '+url,pass:true});
 }
 const views=[['/','Главная'],['/menu','Рецепты'],['/knowledge','Знания'],['/feed','Передача'],['/profile','Профиль'],['/settings','Настройки'],['/shift','Смена'],['/settings/attestation/questions','Банк вопросов'],['/settings/attestation?view=tickets','Билеты'],['/settings/recipes?editor=new','Редактор рецепта'],['/knowledge/new','Редактор статьи'],['/shift/editor','Редактор чек-листов'],['/admin?section=team','Сотрудники'],['/settings/notifications','Уведомления'],['/beer','Пивная карта']];
 for(const width of [375,1440]){
  await s.page.setViewportSize({width,height:900});
  for(let i=0;i<views.length;i++){
   const [url,title]=views[i];await open(s,url);await capture(s,title+': '+width+'px',`supp-${width}-${String(i+1).padStart(2,'0')}.png`);
  }
 }
 await s.page.setViewportSize({width:390,height:844});
 s.store.history.push({id:'fixture-attempt',user_id:s.store.profile.id,display_name:'Иван Проверяющий',category:'Бар проверка',category_id:'bar',score:50,passed:false,total_questions:2,correct_answers:1,category_results:{},created_at:new Date().toISOString()});
 await open(s,'/attestation?view=history');await capture(s,'История результатов: повтор дефекта','supp-history.png');
 for(const [url,fail,title] of [['/knowledge','get_knowledge_articles','Знания: ошибка загрузки'],['/shift','get_position_shift_workflow','Смена: ошибка загрузки']]){
  s.store.fail.add(fail);await open(s,url);await capture(s,title,`supp-error-${fail}.png`);s.store.fail.delete(fail);
 }
 s.store.articles.clear();await open(s,'/knowledge');await capture(s,'Знания: пустой список','supp-empty-knowledge.png');
 // Delay only the local fulfilled fixture RPC to capture the app's own loading UI.
 await s.context.route('**/rest/v1/rpc/get_knowledge_articles',async route=>{await new Promise(r=>setTimeout(r,4500));await route.fallback();});
 await s.open('/knowledge');await s.page.reload();await s.page.waitForTimeout(500);await capture(s,'Знания: загрузка','supp-loading-knowledge.png');
 await s.page.waitForTimeout(4500);
 await open(s,'/settings');await s.page.getByRole('button',{name:'Разделы',exact:true}).click();await s.page.keyboard.press('Tab');
 const focus=await s.page.evaluate(()=>{const e=document.activeElement,c=getComputedStyle(e);return {tag:e.tagName,text:e.textContent,outline:c.outline,transition:c.transitionProperty}});checks.push({name:'Keyboard focus in sections',...focus});
 await capture(s,'Разделы: фокус клавиатуры','supp-focus.png');
}catch(e){issues.push({name:'capture',error:String(e.stack||e)});}finally{
 const report={scope:'Real compiled app in Chromium; synthetic isolated APIs; no production writes. Screenshot metrics are audit observations, not blanket PASS.',records,checks,issues,uncaught:s.errors,consoleErrors:s.consoleErrors,unknown:s.store.unknown};
 fs.writeFileSync(path.join(dir,'supplement.json'),JSON.stringify(report,null,2));
 // Correct the descriptions of replaced screenshots in the original baseline manifest.
 manifest.recapture={files:['44.png','45.png'],assertion:'native details open after real summary clicks, no DOM styling/content injection'};
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
 await browser.close();console.log(JSON.stringify({captures:records.length,issues}));process.exitCode=issues.length?1:0;
}
