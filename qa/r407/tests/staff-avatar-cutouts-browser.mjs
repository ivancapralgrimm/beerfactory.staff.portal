// Real compiled app and real decoded avatar files; APIs remain isolated fixtures.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {chromium,webkit} from 'playwright';import {mockActualApp} from './unified-fixtures.mjs';
const out=path.resolve('qa/r407/evidence/staff-avatar-cutouts');fs.mkdirSync(out,{recursive:true});const base=process.env.BF_UNIFIED_URL||'http://127.0.0.1:4410';const results=[],errors=[],sessions=[];
const names=['owner','bartender-1','bartender-2','waiter-1','waiter-2','manager-1','manager-2','hostess-1','hostess-2'];
for(const [engine,type,launch] of [['chromium',chromium,{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}],['webkit',webkit,{}]]){
 const browser=await type.launch(launch);try{
  const s=await mockActualApp(browser,{base,role:'admin',owner:true,width:390});sessions.push(s);await s.page.emulateMedia({reducedMotion:'reduce'});await s.open('/');await s.page.locator('.bf-staff-avatar img').waitFor();await s.page.evaluate(()=>document.fonts.ready);
  for(const name of names){
   const m=await s.page.evaluate(async name=>{
    const image=new Image();image.src='/assets/staff-avatars/'+name+'.webp';await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);const d=canvas.getContext('2d').getImageData(0,0,512,512).data;
    const alpha=(x,y)=>d[(y*512+x)*4+3];return {width:image.naturalWidth,height:image.naturalHeight,corners:[[0,0],[20,20],[491,20],[20,491],[491,491],[511,511]].map(([x,y])=>alpha(x,y)),center:alpha(256,256)};
   },name);assert.equal(m.width,512);assert.equal(m.height,512);assert.ok(m.corners.every(a=>a===0),JSON.stringify({engine,name,...m}));assert.equal(m.center,255);results.push({engine,name,pass:true,...m});
  }
  for(const width of [320,375,390,430,768,1280]){
   await s.page.setViewportSize({width,height:844});await s.open('/');await s.page.locator('.bf-greeting .bf-staff-avatar img').waitFor();await s.page.locator('.bf-staff-avatar img').evaluate(e=>e.decode());
   const home=await s.page.locator('.bf-staff-avatar').evaluate(e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();return {width:r.width,height:r.height,background:c.backgroundColor,overflow:c.overflow,shadow:c.boxShadow}});assert.equal(home.width,width<=360?112:132);assert.equal(home.height,home.width);assert.equal(home.background,'rgba(0, 0, 0, 0)');assert.equal(home.shadow,'none');assert.equal(home.overflow,'visible');
   if(width===375||width===390)await s.page.screenshot({path:path.join(out,`${engine}-home-${width}.png`),fullPage:true});
   await s.open('/profile');await s.page.locator('.bf-profile-avatar img').waitFor();await s.page.locator('.bf-profile-avatar img').evaluate(e=>e.decode());const profile=await s.page.locator('.bf-profile-avatar').evaluate(e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();return {width:r.width,height:r.height,background:c.backgroundColor,overflow:c.overflow,shadow:c.boxShadow}});assert.deepEqual(profile,{width:60,height:60,background:'rgba(0, 0, 0, 0)',overflow:'visible',shadow:'none'});assert.ok(await s.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(width===375||width===390)await s.page.screenshot({path:path.join(out,`${engine}-profile-${width}.png`),fullPage:true});results.push({engine,name:'Transparent wrappers at '+width,pass:true,home,profile});
  }
  const dom=await s.page.evaluate(()=>{const d=document.documentElement.cloneNode(true);d.querySelectorAll('script').forEach(e=>e.remove());d.querySelectorAll('[src],[href]').forEach(e=>{for(const a of ['src','href']){const v=e.getAttribute(a);if(v?.startsWith('/assets/'))e.setAttribute(a,location.origin+v)}});return '<!doctype html>'+d.outerHTML});fs.writeFileSync(path.join(out,engine+'-profile.html'),dom.replace(/[\t ]+$/gm,''));
 }catch(e){errors.push({engine,error:String(e.stack||e)});}finally{await browser.close()}
}
const report={scope:'Actual Chromium and Linux WebKit, compiled BFStaff; real WebP pixels. HTTP/WS fixtures only. No production writes/RLS/device claim.',results,errors,uncaught:sessions.flatMap(s=>s.errors),unknown:sessions.flatMap(s=>s.store.unknown)};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:results.length,errors,uncaught:report.uncaught}));process.exitCode=errors.length||report.uncaught.length||report.unknown.length?1:0;
