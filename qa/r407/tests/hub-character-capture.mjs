// Real compiled WebGL rendering with controlled simulation time, not a mockup.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {mockActualApp} from './unified-fixtures.mjs';
const base=process.env.BF_HUB_URL||'http://127.0.0.1:4418';
const out=process.env.BF_HUB_CHARACTER_OUT||'/workspace/bfstaff-factory-run-character-v3-evidence';
const record=process.env.BF_HUB_CAPTURE_MOTION==='1';
fs.rmSync(path.join(out,'frames'),{recursive:true,force:true});fs.mkdirSync(path.join(out,'frames'),{recursive:true});
for(const name of ['gait-a','gait-b','jump','slide'])fs.rmSync(path.join(out,'character-'+name+'-390.png'),{force:true});
fs.rmSync(path.join(out,'character-motion.mp4'),{force:true});fs.rmSync(path.join(out,'character-capture.json'),{force:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
  const s=await mockActualApp(browser,{base});await s.page.clock.install();
  await s.open('/hub/factory-run');await s.page.getByRole('button',{name:'Поехали'}).waitFor();
  const canvas=s.page.locator('.runner-canvas[data-renderer=webgl]');await canvas.waitFor();
  // Let React/lazy loading finish before freezing time; the ready game has no RAF.
  await s.page.clock.pauseAt(new Date(await s.page.evaluate(()=>Date.now())+1000));
  await s.page.getByRole('button',{name:'Поехали'}).click();
  const startMs=await s.page.evaluate(()=>performance.now());
  const snapshots=new Map([[3,'gait-a'],[11,'gait-b'],[22,'jump'],[36,'slide']]);
  for(let n=0;n<48;n++){
    if(n===16)await s.page.keyboard.press('ArrowUp');
    if(n===32)await s.page.keyboard.press('ArrowDown');
    // Playwright rounds fractional milliseconds up; alternate integers for16fps.
    await s.page.clock.runFor(n%2?63:62);
    if(snapshots.has(n)){
      const expected=n===22?'jump':n===36?'slide':'run';
      if(await s.page.locator('.runner-frame').getAttribute('data-motion')!==expected)throw new Error('Wrong captured pose: '+expected);
      await s.page.screenshot({path:path.join(out,'character-'+snapshots.get(n)+'-390.png'),fullPage:true});
    }
    if(record)await canvas.screenshot({path:path.join(out,'frames',String(n).padStart(3,'0')+'.png')});
  }
  const simulationMs=await s.page.evaluate(()=>performance.now())-startMs;
  if(Math.abs(simulationMs-3000)>1)throw new Error('Capture clock drift: '+simulationMs);
  if(s.errors.length||s.consoleErrors.length)throw new Error(JSON.stringify({errors:s.errors,consoleErrors:s.consoleErrors}));
  if(record)execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','16','-i',path.join(out,'frames','%03d.png'),'-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-pix_fmt','yuv420p','-crf','19','-movflags','+faststart',path.join(out,'character-motion.mp4')]);
  const result={scope:'Real WebGL rendered frames; synthetic auth/data, controlled simulation time. Encoded16fps is not a phone FPS measurement.',record,frames:record?48:0,simulationMs,snapshots:4,errors:s.errors,consoleErrors:s.consoleErrors};
  fs.writeFileSync(path.join(out,'character-capture.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
