// Native date control with a separate visible frame. Real browser, isolated APIs.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {chromium,webkit,devices} from 'playwright';import {mockActualApp} from './unified-fixtures.mjs';
const out=path.resolve('qa/r407/evidence/profile-date-ios');fs.mkdirSync(out,{recursive:true});const results=[],errors=[],sessions=[];const base=process.env.BF_UNIFIED_URL||'http://127.0.0.1:4410';
async function check(name,fn){try{results.push({name,pass:true,...await fn()});console.log('PASS',name)}catch(e){errors.push({name,error:String(e.stack||e)});console.error('FAIL',name,e.message)}}
for(const [engine,type,launch] of [['chromium',chromium,{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}],['webkit',webkit,{}]]){
 const browser=await type.launch(launch);try{
  // This changes viewport/touch/locale; it does not turn Linux WebKit into iOS.
  const mobile={newContext:options=>browser.newContext({...options,isMobile:true,hasTouch:true,locale:'ru-RU',userAgent:devices['iPhone 13'].userAgent,deviceScaleFactor:2})};
  for(const owner of [false,true]){
   const s=await mockActualApp(mobile,{base,role:owner?'admin':'staff',owner});sessions.push(s);s.store.profile.birth_date='1994-03-27';await s.page.emulateMedia({reducedMotion:'reduce'});
   await s.open('/profile?view=details');await s.page.getByLabel('Дата рождения',{exact:true}).waitFor();await s.page.waitForLoadState('networkidle');await s.page.evaluate(()=>document.fonts.ready);
   for(const width of [320,375,390,430,768])await check(`${engine} ${owner?'owner':'staff'} date ${width} ru-RU touch`,async()=>{
    await s.page.setViewportSize({width,height:844});const input=s.page.getByLabel('Дата рождения',{exact:true});await input.focus();assert.equal(await input.inputValue(),'1994-03-27');
    const m=await input.evaluate(e=>{const f=e.closest('.bf-profile-date-control'),r=e.getBoundingClientRect(),b=f.getBoundingClientRect(),l=e.closest('label').getBoundingClientRect(),c=getComputedStyle(f),n=getComputedStyle(e);return {input:{left:r.left,right:r.right,width:r.width},frame:{left:b.left,right:b.right,width:b.width,height:b.height},label:{left:l.left,right:l.right,width:l.width},border:[c.borderLeftWidth,c.borderRightWidth],overflow:c.overflowX,ring:c.outline,offset:c.outlineOffset,appearance:n.appearance,nativeBorder:n.borderWidth,page:document.documentElement.scrollWidth,viewport:innerWidth}});
    assert.ok(m.frame.width<=m.label.width+.5&&m.frame.right<=width-15&&m.frame.left>=15,JSON.stringify(m));assert.ok(m.input.left>=m.frame.left&&m.input.right<=m.frame.right+.5);assert.equal(m.frame.height,44);assert.deepEqual(m.border,['1px','1px']);assert.equal(m.appearance,'none');assert.equal(m.nativeBorder,'0px');assert.ok(m.ring.includes('2px')&&m.offset==='-2px');assert.ok(m.page<=width+1);
    if(owner&&[320,375,390].includes(width))await s.page.screenshot({path:path.join(out,`${engine}-${width}-focus.png`),fullPage:true});return {geometry:m};
   });
   await check(`${engine} ${owner?'owner':'staff'} edits and saves ISO birth date`,async()=>{
    const input=s.page.getByLabel('Дата рождения',{exact:true});await input.fill('1994-03-26');await s.page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();await s.page.waitForFunction(()=>document.body.innerText.includes('сохранен')||document.body.innerText.includes('сохранён'));
    assert.equal(s.store.profile.birth_date,'1994-03-26');await s.page.reload();await input.waitFor();assert.equal(await input.inputValue(),'1994-03-26');assert.equal(await input.getAttribute('type'),'date');assert.equal(await input.getAttribute('autocomplete'),'bday');
   });
   await check(`${engine} ${owner?'owner':'staff'} keyboard reaches native date`,async()=>{
    await s.page.getByLabel('Фамилия',{exact:true}).focus();await s.page.keyboard.press('Tab');assert.equal(await s.page.getByLabel('Дата рождения',{exact:true}).evaluate(e=>e===document.activeElement),true);
   });
   if(owner){
    await s.page.setViewportSize({width:390,height:844});await s.page.getByLabel('Дата рождения',{exact:true}).focus();
    // A static DOM copy is for Hallmark render only, never functional claims.
    const dom=await s.page.evaluate(()=>{const d=document.documentElement.cloneNode(true);d.querySelectorAll('script').forEach(e=>e.remove());d.querySelectorAll('[src],[href]').forEach(e=>{for(const a of ['src','href']){const v=e.getAttribute(a);if(v?.startsWith('/assets/'))e.setAttribute(a,location.origin+v)}});return '<!doctype html>'+d.outerHTML});fs.writeFileSync(path.join(out,`${engine}-profile.html`),dom.replace(/[\t ]+$/gm,''));
   }
  }
 }finally{await browser.close()}
}
const report={scope:'Actual Chromium and Linux WebKit; ru-RU, iPhone UA, touch/mobile viewport. This does NOT emulate the native iOS renderer or prove physical iPhone PASS. All APIs fixture-only; no production writes.',results,errors,uncaught:sessions.flatMap(s=>s.errors),unknown:sessions.flatMap(s=>s.store.unknown)};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:results.length,errors}));process.exitCode=errors.length||report.uncaught.length||report.unknown.length?1:0;
