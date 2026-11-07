import test from 'node:test';
import assert from 'node:assert/strict';
import {act,beginRun,createRun,jumpHeight,pauseRun,tick} from '../src/features/hub/runner-engine.ts';

function running(){const s=createRun();s.phase='running';s.spawnIn=999;return s;}
function advance(s,seconds){for(let t=0;t<seconds-1e-7;t+=.01)tick(s,Math.min(.01,seconds-t));}
function item(s,kind,lane=s.lane){s.things.push({id:s.nextId++,kind,lane,z:.5,resolved:false});}
test('a new run starts with reachable center pickups and no immediate obstacle',()=>{
  const s=beginRun(31);assert.equal(s.phase,'running');assert.equal(s.things.length,3);
  assert.ok(s.things.every(i=>i.kind==='hop'&&i.lane===0&&i.z>=14));advance(s,2.3);assert.ok(s.hops>0);assert.equal(s.lives,3);
});
test('ready and paused states freeze gameplay and ignore actions',()=>{
  const s=createRun();tick(s,1);act(s,'left');assert.equal(s.distance,0);assert.equal(s.lane,0);
  s.phase='running';tick(s,.05);pauseRun(s);const copy=structuredClone(s);tick(s,2);act(s,'jump');assert.deepEqual(s,copy);
});
test('lane changes stay on the three tracks; a long frame cannot teleport',()=>{
  const s=running();for(let i=0;i<5;i++)act(s,'left');assert.equal(s.lane,-1);
  for(let i=0;i<9;i++)act(s,'right');assert.equal(s.lane,1);
  tick(s,30);assert.ok(s.distance<1);assert.ok(s.x>0&&s.x<=1);
});
test('barrels require a timed jump; collisions only consume one life during protection',()=>{
  const s=running();item(s,'barrel');tick(s,.01);assert.equal(s.lives,2);
  item(s,'crate');tick(s,.01);assert.equal(s.lives,2);
  const jumper=running();act(jumper,'jump');advance(jumper,.4);assert.ok(jumpHeight(jumper)>.9);
  item(jumper,'barrel');tick(jumper,.01);assert.equal(jumper.lives,3);
});
test('a slide clears a beam; a jump does not clear a tall crate; other lanes are safe',()=>{
  const s=running();act(s,'slide');item(s,'beam');tick(s,.01);assert.equal(s.lives,3);
  const jumped=running();act(jumped,'jump');advance(jumped,.4);item(jumped,'crate');tick(jumped,.01);assert.equal(jumped.lives,2);
  const safe=running();item(safe,'crate',1);tick(safe,.01);assert.equal(safe.lives,3);
});
test('ten hops award one batch bonus exactly once and resolved pickups cannot repeat',()=>{
  const s=running();for(let i=0;i<10;i++)item(s,'hop');tick(s,.01);
  assert.equal(s.hops,10);assert.equal(s.score,400);assert.equal(s.event,'Партия собрана');tick(s,.01);assert.equal(s.hops,10);
});
test('three separated hits end a run; later frames and actions cannot change the result',()=>{
  const s=running();for(let i=0;i<3;i++){s.shield=0;item(s,'crate');tick(s,.01);}
  assert.equal(s.phase,'over');assert.equal(s.lives,0);const copy=structuredClone(s);tick(s,.05);act(s,'left');assert.deepEqual(s,copy);
});
test('seeded generation is repeatable, bounded and never blocks all lanes in one row',()=>{
  const a=createRun(42),b=createRun(42);a.phase=b.phase='running';a.shield=b.shield=9999;
  for(let n=0;n<4000;n++){
    tick(a,.05);tick(b,.05);assert.ok(a.things.length<90);
    const obstacles=a.things.filter(x=>x.kind!=='hop');
    for(const obstacle of obstacles)assert.equal(obstacles.filter(x=>Math.abs(x.z-obstacle.z)<.01).length,1);
  }
  assert.deepEqual(a,b);assert.ok(a.distance>1000);
});
test('restart creates a clean run without carrying lives, inputs or pickups',()=>{
  const s=running();act(s,'left');item(s,'hop');tick(s,.05);const fresh=createRun();
  assert.equal(fresh.lives,3);assert.equal(fresh.hops,0);assert.equal(fresh.lane,0);assert.equal(fresh.things.length,0);assert.equal(fresh.phase,'ready');
});
