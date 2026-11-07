// Faithful frozen DOM/Canvas captures for the actual Hallmark render checker.
// Full PNGs are real browser screenshots. Snapshot HTML freezes only the artwork;
// its controls are separately exercised by tests/factory-run-browser.mjs.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {mockActualApp} from './unified-fixtures.mjs';
const base=process.env.BF_HUB_URL||'http://127.0.0.1:4418';
const out='/workspace/bfstaff-factory-run-evidence/snapshots';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const s=await mockActualApp(browser,{base});
async function capture(name){
  await s.page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
  const saved=await s.page.evaluate(()=>[...document.querySelectorAll('.runner-hud,.runner-panel,.runner-event,.runner-ground-label')].map(e=>{const old=e.style.visibility;e.style.visibility='hidden';return {className:e.className,old};}));
  const pictures=[];
  try{for(const canvas of await s.page.locator('canvas').all())pictures.push('data:image/png;base64,'+(await canvas.screenshot()).toString('base64'));}
  finally{await s.page.evaluate(items=>{for(const item of items){const e=document.getElementsByClassName(item.className)[0];if(e)e.style.visibility=item.old;}},saved);}
  const html=await s.page.evaluate(({pictures,base})=>{
    const root=document.documentElement.cloneNode(true);root.querySelectorAll('script,link[rel="modulepreload"]').forEach(e=>e.remove());
    root.querySelectorAll('canvas').forEach((e,n)=>{const img=document.createElement('img');for(const a of e.attributes)img.setAttribute(a.name,a.value);img.src=pictures[n];img.alt=e.getAttribute('aria-label')||'Игровая сцена';e.replaceWith(img);});
    root.querySelectorAll('[href],[src]').forEach(e=>{for(const a of ['href','src']){const value=e.getAttribute(a);if(value?.startsWith(base+'/'))e.setAttribute(a,value.slice(base.length));}});
    return '<!doctype html>\n'+root.outerHTML;
  },{pictures,base});fs.writeFileSync(path.join(out,name+'.html'),html);
}
await s.open('/hub');await s.page.locator('[data-renderer=webgl]').waitFor();await capture('hub');
await s.page.getByRole('link',{name:/Factory Run/}).click();await s.page.getByRole('button',{name:'Поехали'}).waitFor();await s.page.locator('[data-renderer=webgl]').waitFor();await capture('game-ready');
await s.page.getByRole('button',{name:'Поехали'}).click();await s.page.waitForTimeout(1500);await capture('game-running');
console.log(JSON.stringify({errors:s.errors,consoleErrors:s.consoleErrors,snapshots:3}));await browser.close();
