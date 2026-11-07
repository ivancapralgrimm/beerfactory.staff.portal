import test from 'node:test';
import assert from 'node:assert/strict';
import {act,beginRun,createRun,jumpHeight,pauseRun,tick} from '../src/features/hub/runner-engine.ts';
import {characterPose,crouchBlend,legAngles,LEG_LENGTH} from '../src/features/hub/runner-character-motion.ts';
import {SCENE_FOG,SCENERY_ROWS,recycledRowZ} from '../src/features/hub/runner-scene-layout.ts';

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
  tick(s,30);assert.ok(s.distance<1);assert.ok(s.x>0&&s.x<1);
  const positions=[30,60,120].map(fps=>{const sample=running();act(sample,'right');for(let n=0;n<fps/5;n++)tick(sample,1/fps);return sample.x;});
  assert.ok(Math.max(...positions)-Math.min(...positions)<1e-9);assert.ok(positions.every(x=>x>0&&x<1));
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

function footFromAngles(leg,hipY){
  return {y:hipY-LEG_LENGTH*Math.cos(leg.hip)-LEG_LENGTH*Math.cos(leg.hip+leg.knee),z:-LEG_LENGTH*Math.sin(leg.hip)-LEG_LENGTH*Math.sin(leg.hip+leg.knee),pitch:leg.hip+leg.knee+leg.ankle};
}
test('two-bone legs place the foot at its requested contact with a level sole',()=>{
  for(const [y,z] of [[-.65,0],[-.63,.23],[-.4,-.2]]){
    const leg=legAngles(y,z),p=footFromAngles(leg,0);
    assert.ok(Math.abs(p.y-y)<1e-9);assert.ok(Math.abs(p.z-z)<1e-9);assert.ok(Math.abs(p.pitch)<1e-9);
    assert.ok(leg.knee>0&&leg.knee<Math.PI);
  }
  const beyond=legAngles(-5,0);assert.ok(Object.values(beyond).every(Number.isFinite));
});
test('a complete gait keeps reachable feet, planted stance soles and bending knees',()=>{
  const s=beginRun(31);let flexMin=Infinity,flexMax=0;
  for(let n=0;n<=200;n++){
    s.distance=n/200/.165;s.time=n/200;
    const pose=characterPose(s,false,0);
    pose.legs.forEach(leg=>{const p=footFromAngles(leg,pose.hipY);
      assert.ok(Math.abs(p.y-leg.y)<1e-8);assert.ok(Math.abs(p.z-leg.z)<1e-8);
      assert.ok(p.y>=.12-1e-9);if(Math.abs(leg.y-.12)<1e-9)assert.ok(Math.abs(p.pitch)<1e-9);
      flexMin=Math.min(flexMin,leg.knee);flexMax=Math.max(flexMax,leg.knee);
    });
  }
  assert.ok(flexMax-flexMin>.5);
});
test('pause freezes the pose and decorative reduced-motion parts stay still',()=>{
  const s=beginRun(31);s.distance=12.5;s.time=1.2;
  const moving=characterPose(s,false,0);pauseRun(s);assert.deepEqual(characterPose(s,false,0),moving);
  const quiet=characterPose(s,true,0);s.distance=200;s.time=25;
  assert.deepEqual(characterPose(s,true,0),quiet);
  assert.equal(quiet.bodyYaw,0);assert.equal(quiet.foamRoll,0);assert.equal(quiet.tiePitch,0);
});
test('jump and slide articulate joints without changing the gameplay state',()=>{
  const s=beginRun(31);act(s,'jump');s.jump=.43;
  const saved=structuredClone(s),air=characterPose(s,false,0,jumpHeight(s));assert.deepEqual(s,saved);
  assert.ok(air.legs.every(l=>l.y>=.29&&l.knee>1));
  act(s,'slide');const slide=characterPose(s,false,1);
  assert.ok(slide.hipY<.5&&slide.bodyY<-.3&&slide.bodyPitch>.5);
  slide.legs.forEach(leg=>{const p=footFromAngles(leg,slide.hipY);assert.ok(Math.abs(p.y-.12)<1e-9);assert.ok(Math.abs(p.pitch)<1e-9);});
});
test('crouch freezes on pause, eases during play and resets immediately on a new run',()=>{
  assert.equal(crouchBlend(.8,0,5,5),.8);
  const moving=crouchBlend(0,1,5.02,5);assert.ok(moving>0&&moving<1);
  assert.equal(crouchBlend(.8,0,0,5),0);
  assert.equal(crouchBlend(0,1,5.02,5,true),1);
});
test('recycled scenery enters beyond the fog and keeps the visible row spacing across wrap',()=>{
  for(const {count,spacing,start} of Object.values(SCENERY_ROWS)){
    const after=Array.from({length:count},(_,n)=>recycledRowZ(spacing+.001,n,spacing,start));
    const before=Array.from({length:count},(_,n)=>recycledRowZ(spacing-.001,n,spacing,start));
    assert.ok(after.at(-1)+3 < -SCENE_FOG.far);
    for(const z of after.slice(0,-1))assert.ok(before.some(old=>Math.abs(z-old-.002)<1e-8));
    for(const distance of [0,99,100000]){
      const positions=Array.from({length:count},(_,n)=>recycledRowZ(distance,n,spacing,start));
      assert.ok(positions.every(z=>z>=start-(count-1)*spacing&&z<start+spacing));
    }
  }
});
