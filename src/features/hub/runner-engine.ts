/** Deterministic, renderer-independent runner. No network or account data. */
export type Lane = -1 | 0 | 1;
export type RunPhase = 'ready' | 'running' | 'paused' | 'over';
export type RunAction = 'left' | 'right' | 'jump' | 'slide';
export type ThingKind = 'hop' | 'barrel' | 'beam' | 'crate';
export type RunThing = {id:number;lane:Lane;z:number;kind:ThingKind;resolved:boolean};
export type RunState = {
  phase:RunPhase;lane:Lane;x:number;distance:number;time:number;hops:number;
  lives:number;score:number;jump:number;slide:number;shield:number;
  seed:number;nextId:number;spawnIn:number;things:RunThing[];event:string;eventUntil:number;
};
export const JUMP_DURATION = .86;
export const SLIDE_DURATION = .8;
export function createRun(seed=2711):RunState {
  return {phase:'ready',lane:0,x:0,distance:0,time:0,hops:0,lives:3,score:0,
    jump:0,slide:0,shield:0,seed,nextId:0,spawnIn:1.1,things:[],event:'',eventUntil:0};
}
export function beginRun(seed:number):RunState {
  const s=createRun(seed);s.phase='running';
  // A short, safe opening gives touch controls time to feel familiar.
  for(const z of [14,18,22])s.things.push({id:s.nextId++,lane:0,z,kind:'hop',resolved:false});
  return s;
}
function random(s:RunState) {
  s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;
  return s.seed/4294967296;
}
export function jumpHeight(s:RunState) {
  return s.jump>0?Math.sin(Math.PI*(1-s.jump/JUMP_DURATION)):0;
}
export function act(s:RunState,action:RunAction) {
  if(s.phase!=='running') return;
  if(action==='left')s.lane=Math.max(-1,s.lane-1) as Lane;
  if(action==='right')s.lane=Math.min(1,s.lane+1) as Lane;
  if(action==='jump'&&s.jump===0&&s.slide===0)s.jump=JUMP_DURATION;
  if(action==='slide'){s.jump=0;s.slide=SLIDE_DURATION;}
}
export function pauseRun(s:RunState) {
  if(s.phase==='running')s.phase='paused';
}
function spawn(s:RunState) {
  const blocked=(Math.floor(random(s)*3)-1) as Lane;
  const kinds:ThingKind[]=s.distance>180?['barrel','beam','crate']:['barrel','beam'];
  const kind=kinds[Math.floor(random(s)*kinds.length)];
  const hopLane=(random(s)>.5?blocked:([-1,0,1].filter(x=>x!==blocked)[Math.floor(random(s)*2)])) as Lane;
  s.things.push({id:s.nextId++,lane:blocked,z:64,kind,resolved:false});
  // Exactly one blocked lane per row; every row has two unobstructed exits.
  // Pickups above a barrel invite a jump, beneath a beam invite a slide.
  for(let n=0;n<4;n++)s.things.push({id:s.nextId++,lane:hopLane,z:64+3+n*3,kind:'hop',resolved:false});
}
export function tick(s:RunState,seconds:number) {
  if(s.phase!=='running'||!Number.isFinite(seconds)||seconds<=0)return;
  const dt=Math.min(seconds,.06),speed=Math.min(20,10+s.distance/140);
  s.time+=dt;s.distance+=speed*dt;s.spawnIn-=dt;
  s.x+=(s.lane-s.x)*(1-Math.exp(-19*dt));
  s.jump=Math.max(0,s.jump-dt);s.slide=Math.max(0,s.slide-dt);s.shield=Math.max(0,s.shield-dt);
  if(s.spawnIn<=0){spawn(s);s.spawnIn=2.1+random(s)*.45;}
  for(const item of s.things){
    item.z-=speed*dt;
    if(item.resolved||item.z>1||item.z<-1.5||item.lane!==s.lane)continue;
    item.resolved=true;
    if(item.kind==='hop'){
      s.hops++;
      if(s.hops%10===0){s.event='Партия собрана';s.eventUntil=s.time+1.6;}
    }else{
      const avoided=item.kind==='barrel'&&jumpHeight(s)>.42||item.kind==='beam'&&s.slide>0;
      if(!avoided&&s.shield===0){
        s.lives--;s.shield=1.6;
        s.event=item.kind==='barrel'?'Бочку можно перепрыгнуть':item.kind==='beam'?'Под трубой нужен подкат':'Высокий ящик нужно обойти';
        s.eventUntil=s.time+2;
        if(s.lives<=0)s.phase='over';
      }
    }
  }
  s.things=s.things.filter(x=>x.z>-5);
  s.score=Math.floor(s.distance)+s.hops*25+Math.floor(s.hops/10)*150;
}
