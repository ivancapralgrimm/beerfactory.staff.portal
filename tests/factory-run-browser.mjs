// Compiled real app. Auth/data are explicit fixtures; all external HTTP/WS blocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {mockActualApp} from '../qa/r407/tests/unified-fixtures.mjs';
const base=process.env.BF_HUB_URL||'http://127.0.0.1:4418';
const out=process.env.BF_HUB_EVIDENCE||'/workspace/bfstaff-factory-run-evidence';fs.mkdirSync(out,{recursive:true});
const results=[],sessions=[];
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
async function session(options={}){const s=await mockActualApp(browser,{base,...options});sessions.push(s);return s;}
async function game(s){await s.open('/hub/factory-run');await s.page.getByRole('button',{name:'Поехали'}).waitFor();await s.page.locator('.runner-canvas[data-renderer]').waitFor();}
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){results.push({name,status:'FAIL',error:String(e.stack||e)});console.error('FAIL '+name+': '+e.message);}}
async function capture(s,name){await s.page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
async function swipe(s,dx,dy){
  const r=await s.page.locator('.runner-canvas').boundingBox(),x=r.x+r.width*.5,y=r.y+r.height*.58;
  const cdp=await s.context.newCDPSession(s.page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let n=1;n<=4;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*n/4,y:y+dy*n/4}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
}
await check('Hub is an authenticated section; one project opens its real game route',async()=>{
  const anon=await session({anonymous:true});await anon.open('/hub');await anon.page.getByRole('heading',{name:'Войти в портал'}).waitFor();assert.match(anon.page.url(),/login/);await anon.context.close();
  const s=await session();await s.open('/hub');await s.page.getByRole('heading',{name:'Hub',exact:true}).waitFor();assert.equal(await s.page.getByRole('link',{name:/Factory Run/}).count(),1);
  await s.page.getByRole('button',{name:'Разделы',exact:true}).click();assert.equal(await s.page.getByRole('link',{name:'Hub',exact:true}).getAttribute('aria-current'),'page');await s.page.keyboard.press('Escape');
  await capture(s,'hub-3d-390');await s.page.getByRole('link',{name:/Factory Run/}).click();await s.page.getByRole('button',{name:'Поехали'}).waitFor();await s.page.locator('.runner-canvas[data-renderer=webgl]').waitFor();
  await capture(s,'ready-3d-390');await s.context.close();
});
await check('real touch events change lanes, jump and slide without a directional button pad',async()=>{
  const s=await session();await game(s);await s.page.getByRole('button',{name:'Поехали'}).click();
  assert.equal(await s.page.getByRole('button',{name:/^(Влево|Вправо|Прыжок|Подкат)$/}).count(),0);
  await swipe(s,-80,0);assert.match(await s.page.locator('.runner-canvas').getAttribute('aria-label'),/Дорожка 1/);
  await swipe(s,80,0);await swipe(s,80,0);assert.match(await s.page.locator('.runner-canvas').getAttribute('aria-label'),/Дорожка 3/);
  await swipe(s,0,-85);assert.equal(await s.page.locator('.runner-frame').getAttribute('data-motion'),'jump');
  await swipe(s,0,85);assert.equal(await s.page.locator('.runner-frame').getAttribute('data-motion'),'slide');
  await s.page.waitForFunction(()=>document.querySelector('.runner-frame')?.getAttribute('data-motion')==='run');await swipe(s,0,0);assert.equal(await s.page.locator('.runner-frame').getAttribute('data-motion'),'jump');
  assert.equal(await s.page.locator('.runner-frame').getAttribute('data-phase'),'running');await capture(s,'running-3d-390');
  await s.page.getByRole('button',{name:'Пауза',exact:true}).click();const score=await s.page.locator('.runner-score strong').innerText();await s.page.waitForTimeout(250);assert.equal(await s.page.locator('.runner-score strong').innerText(),score);
  await s.page.getByRole('button',{name:'Продолжить',exact:true}).click();assert.equal(await s.page.locator('.runner-frame').getAttribute('data-phase'),'running');assert.deepEqual(s.errors,[]);assert.deepEqual(s.consoleErrors,[]);await s.context.close();
});
await check('keyboard opening Sections pauses the game and Back returns to Hub',async()=>{
  const s=await session();await game(s);await s.page.getByRole('button',{name:'Поехали'}).click();
  await s.page.getByRole('button',{name:'Разделы',exact:true}).focus();await s.page.keyboard.press('Enter');await s.page.getByRole('dialog',{name:'Куда перейдём?'}).waitFor();
  assert.equal(await s.page.locator('.runner-frame').getAttribute('data-phase'),'paused');const score=await s.page.locator('.runner-score strong').innerText();await s.page.waitForTimeout(200);assert.equal(await s.page.locator('.runner-score strong').innerText(),score);
  await s.page.keyboard.press('Escape');await s.page.getByRole('button',{name:'В Hub',exact:true}).click();await s.page.getByRole('heading',{name:'Hub',exact:true}).waitFor();assert.deepEqual(s.errors,[]);await s.context.close();
});
await check('WebGL context loss pauses and switches to a working Canvas fallback',async()=>{
  const s=await session();await game(s);await s.page.getByRole('button',{name:'Поехали'}).click();
  await s.page.locator('.runner-canvas').evaluate(el=>el.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await s.page.locator('.runner-canvas[data-renderer=canvas2d]').waitFor();assert.equal(await s.page.locator('.runner-frame').getAttribute('data-phase'),'paused');
  await s.page.getByRole('button',{name:'Продолжить',exact:true}).click();await swipe(s,-80,0);assert.match(await s.page.locator('.runner-canvas').getAttribute('aria-label'),/Дорожка 1/);assert.deepEqual(s.errors,[]);await s.context.close();
});
await check('no WebGL and reduced motion retain play, result, restart and local best',async()=>{
  const s=await session();await s.context.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args);};
    const random=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=function(a){if(a instanceof Uint32Array&&a.length===1){a[0]=2711;return a;}return random(a);};
  });
  await s.page.emulateMedia({reducedMotion:'reduce'});await s.page.clock.install();await game(s);await s.page.locator('[data-renderer=canvas2d]').waitFor();
  await s.page.getByRole('button',{name:'Поехали'}).click();await s.page.clock.runFor(90000);await s.page.getByRole('heading',{name:'Рейс завершён'}).waitFor();
  const best=await s.page.locator('.runner-title strong').innerText();assert.ok(Number(best.replace(/\D/g,''))>0);await capture(s,'result-390');
  await s.page.getByRole('button',{name:'Ещё раз'}).click();assert.equal(await s.page.locator('.runner-frame').getAttribute('data-phase'),'running');
  await s.page.keyboard.press('Escape');await s.page.reload();await s.page.getByRole('button',{name:'Поехали'}).waitFor();assert.equal(await s.page.locator('.runner-title strong').innerText(),best);assert.deepEqual(s.errors,[]);assert.deepEqual(s.consoleErrors,[]);await s.context.close();
});
for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[768,900],[1440,900]])await check(`viewport ${width}x${height}, help scroll and focus stay in bounds`,async()=>{
  const s=await session({width});await s.page.setViewportSize({width,height});await game(s);await s.page.getByRole('button',{name:'Как управлять'}).click();
  const metrics=await s.page.evaluate(()=>{
    const frame=document.querySelector('.runner-frame').getBoundingClientRect(),panel=document.querySelector('.runner-panel').getBoundingClientRect();
    return {overflow:document.documentElement.scrollWidth-innerWidth,panelBottom:panel.bottom,frameBottom:frame.bottom,buttons:[...document.querySelectorAll('.runner-panel button')].map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))};
  });assert.ok(metrics.overflow<=1);assert.ok(metrics.panelBottom<=metrics.frameBottom-4);assert.ok(metrics.buttons.every(x=>x.h>=44));
  await s.page.getByRole('button',{name:'Скрыть управление'}).click();
  if([375,1440].includes(width)){await capture(s,`ready-3d-${width}`);await s.page.getByRole('button',{name:'Поехали'}).click();await s.page.waitForTimeout(450);await capture(s,`running-3d-${width}`);await s.page.getByRole('button',{name:'В Hub',exact:true}).click();await s.page.getByRole('heading',{name:'Hub',exact:true}).waitFor();await capture(s,`hub-3d-${width}`);}
  assert.deepEqual(s.errors,[]);assert.deepEqual(s.consoleErrors,[]);await s.context.close();
});
await browser.close();
await check('Linux WebKit supports the section and touch/keyboard fallback lifecycle',async()=>{
  const b=await webkit.launch();try{const s=await mockActualApp(b,{base});await game(s);await s.page.getByRole('button',{name:'Поехали'}).click();await s.page.keyboard.press('ArrowLeft');assert.match(await s.page.locator('.runner-canvas').getAttribute('aria-label'),/Дорожка 1/);await s.page.keyboard.press('Escape');assert.equal(await s.page.locator('.runner-frame').getAttribute('data-phase'),'paused');assert.deepEqual(s.errors,[]);await s.context.close();}finally{await b.close();}
});
const report={scope:'Compiled app, synthetic auth/data transport. Actual Chromium CDP touch; Linux WebKit is not a physical iPhone. No production writes or RLS/security claim.',results};
fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
