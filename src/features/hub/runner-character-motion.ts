import type {RunState} from './runner-engine';

export const LEG_LENGTH=.36;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export function crouchBlend(current:number,target:number,time:number,previousTime:number,instant=false){
  if(instant||time<previousTime)return target;
  const delta=clamp(time-previousTime,0,.06);
  return target+(current-target)*Math.exp(-24*delta);
}
/** Two-bone sagittal IK. Positive local Z is the mascot's forward direction. */
export function legAngles(y:number,z:number,pitch=0){
  const distance=clamp(Math.hypot(y,z),.025,LEG_LENGTH*2-.001);
  const knee=Math.acos(clamp((distance*distance-2*LEG_LENGTH*LEG_LENGTH)/(2*LEG_LENGTH*LEG_LENGTH),-1,1));
  const hip=Math.atan2(-z,-y)-Math.acos(clamp(distance/(2*LEG_LENGTH),-1,1));
  return {hip,knee,ankle:pitch-hip-knee};
}

/** Poses depend on simulation state, never wall-clock time or per-frame random. */
export function characterPose(s:RunState,reduced:boolean,crouch:number,airborne=0){
  const idle=s.phase==='ready'||s.phase==='over';
  const cycle=s.distance*.165;
  const decorative=!idle&&!reduced;
  const beat=decorative?Math.sin(cycle*Math.PI*4):0;
  const bob=decorative?(1-crouch)*(1-airborne)*beat*.025:0;
  const hipY=.775-crouch*.29+bob;
  const turn=reduced?0:clamp(s.lane-s.x,-1,1);
  const legs=[0,1].map(n=>{
    const phase=(cycle+n*.5)%1;
    let y=.12,z=.02,pitch=0;
    if(decorative){
      if(phase<.48){z=.24-phase/.48*.48;}
      else{
        const q=(phase-.48)/.52;
        z=-.24+.48*q*q*(3-2*q);y+=Math.sin(q*Math.PI)*.22;
        pitch=-Math.sin(q*Math.PI)*.35;
      }
    }
    y=lerp(y,.29+(n?.015:0),airborne);z=lerp(z,n?-.08:.16,airborne);
    y=lerp(y,.12,crouch);z=lerp(z,n?.28:.34,crouch);pitch=lerp(pitch,0,crouch);
    return {...legAngles(y-hipY,z,pitch),y,z,pitch};
  });
  const arms=[0,1].map(n=>{
    const swing=decorative?Math.cos((cycle+n*.5)*Math.PI*2):0;
    let upper=idle?(n?-.1:-.85):swing*.6;
    let elbow=idle?(n?-.65:-1.1):-1.05+swing*.16;
    upper=lerp(upper,-.4,airborne);elbow=lerp(elbow,-1.4,airborne);
    upper=lerp(upper,.6,crouch);elbow=lerp(elbow,-1.2,crouch);
    return {upper,elbow,wrist:decorative?swing*.12:0};
  });
  const blink=decorative?Math.max(0,1-Math.abs(s.time%4.6-3.9)/.08):0;
  return {hipY,legs,arms,bodyY:-crouch*.36+bob*1.6,bodyPitch:(idle?0:.12)-airborne*.16+crouch*.55,
    bodyYaw:decorative?Math.cos(cycle*Math.PI*2)*.045*(1-crouch)*(1-airborne):0,
    bodyRoll:decorative?beat*.045*(1-crouch)*(1-airborne):0,
    lean:turn*-.12,foamRoll:decorative?turn*.08-beat*.012:0,
    tiePitch:decorative?.08+Math.sin(cycle*Math.PI*2-.65)*.12:0,
    blink,idle};
}
