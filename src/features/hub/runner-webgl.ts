/*! Three.js, Copyright 2010-2026 three.js authors. MIT license: /assets/licenses/three.txt */
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {jumpHeight,type RunState,type RunThing} from './runner-engine';
import type {RunnerPainter} from './runner-renderer';
import {createBreweryMaps} from './runner-materials';

/** Original procedural 3D brewery. No downloaded models, external CDN or API. */
export function createWebGLPainter(canvas:HTMLCanvasElement,theme:HTMLElement,onLost:()=>void):RunnerPainter|null {
  let renderer:T.WebGLRenderer;
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'default'});
  if(!gl)return null;
  try{renderer=new T.WebGLRenderer({canvas,context:gl,antialias:true,alpha:false,powerPreference:'default'});}catch{return null;}
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
  let environment:T.WebGLRenderTarget|null=null,destroyed=false;
  try{
  canvas.dataset.renderer='webgl';
  const style=getComputedStyle(theme),color=(name:string)=>style.getPropertyValue('--run-'+name).trim();
  const c=Object.fromEntries(['sky','haze','wall','wallShade','wood','woodLight','floor','seam','copper','copperShade','copperLight','steel','steelShade','paper','ink','gold','amber','amberDeep','green','leaf','brick','brickShade','mortar','vest','tie','cheek'].map(k=>[k,color(k)]));
  const scene=new T.Scene();scene.background=new T.Color(c.sky);scene.fog=new T.Fog(c.sky,27,94);
  const camera=new T.PerspectiveCamera(58,1,.1,120);
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const geometry=<G extends T.BufferGeometry>(g:G)=>{geometries.add(g);return g;};
  const material=<M extends T.Material>(m:M)=>{materials.add(m);return m;};
  const standard=(paint:string,roughness=.6,metalness=0)=>material(new T.MeshStandardMaterial({color:paint,roughness,metalness}));
  const copper=standard(c.copper,.28,.82),copperEdge=standard(c.copperLight,.24,.72),copperDark=standard(c.copperShade,.5,.6);
  const steel=standard(c.steel,.26,.85),darkSteel=standard(c.steelShade,.46,.6),wood=standard(c.wood,.85),lightWood=standard(c.woodLight,.78);
  const cream=standard(c.paper,.55),ink=standard(c.ink,.8),gold=standard(c.gold,.3,.55),green=standard(c.green,.55);
  const maps=createBreweryMaps(c,renderer,t=>textures.add(t));
  copper.map=maps.copper;copper.color.setRGB(1,1,1);copper.roughnessMap=maps.copperRough;copper.roughness=.43;
  wood.map=maps.wood;wood.color.setRGB(1,1,1);wood.bumpMap=maps.woodBump;wood.bumpScale=.025;
  const cube=geometry(new T.BoxGeometry(1,1,1)),sphere=geometry(new T.SphereGeometry(1,18,12)),cylinder=geometry(new T.CylinderGeometry(1,1,1,24));
  function mesh(g:T.BufferGeometry,m:T.Material,parent:T.Object3D,x:number,y:number,z:number,sx=1,sy=1,sz=1,shadow=false){
    const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=shadow;o.receiveShadow=true;parent.add(o);return o;
  }
  const box=(parent:T.Object3D,m:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,shadow=false)=>mesh(cube,m,parent,x,y,z,sx,sy,sz,shadow);
  const ball=(parent:T.Object3D,m:T.Material,x:number,y:number,z:number,sx:number,sy=sx,sz=sx)=>mesh(sphere,m,parent,x,y,z,sx,sy,sz);
  const tube=(parent:T.Object3D,m:T.Material,x:number,y:number,z:number,radius:number,length:number)=>mesh(cylinder,m,parent,x,y,z,radius,length,radius);
  // Keep detailed static equipment cheap: merge by material and shadow mode.
  function compact(group:T.Group){
    const buckets=new Map<string,T.Mesh[]>();
    for(const child of group.children){if(!(child instanceof T.Mesh)||Array.isArray(child.material))continue;const key=child.material.uuid+':'+child.castShadow+':'+child.receiveShadow;const list=buckets.get(key)||[];list.push(child);buckets.set(key,list);}
    const parts:T.Mesh[]=[];
    for(const list of buckets.values()){
      const copies=list.map(o=>{o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();return g.applyMatrix4(o.matrix);});
      const merged=mergeGeometries(copies);copies.forEach(g=>g.dispose());if(!merged)return;
      const o=new T.Mesh(geometry(merged),list[0].material);o.castShadow=list[0].castShadow;o.receiveShadow=list[0].receiveShadow;parts.push(o);
    }
    group.clear();parts.forEach(o=>group.add(o));
  }
  const hemisphere=new T.HemisphereLight(c.haze,c.wood,1.4);scene.add(hemisphere);
  const sun=new T.DirectionalLight(c.paper,3.1);sun.position.set(-5,12,5);sun.target.position.set(0,0,-12);sun.castShadow=true;
  sun.shadow.mapSize.set(512,512);sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-9;sun.shadow.camera.far=48;sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;scene.add(sun,sun.target);
  const fill=new T.DirectionalLight(c.copperLight,1);fill.position.set(6,5,-15);scene.add(fill);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();environment=pmrem.fromScene(room,.08);
  scene.environment=environment.texture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();

  const floorMap=maps.floor;
  const floorMaterial=material(new T.MeshStandardMaterial({map:floorMap,bumpMap:maps.floorBump,bumpScale:.035,roughness:.8}));
  const floor=mesh(geometry(new T.PlaneGeometry(15,120)),floorMaterial,scene,0,-.035,-38,1,1,1,false);floor.rotation.x=-Math.PI/2;
  const wallMaterial=material(new T.MeshStandardMaterial({map:maps.brick,bumpMap:maps.brickBump,bumpScale:.045,roughness:.9}));
  for(const side of [-1,1]){
    box(scene,wallMaterial,side*8,5,-37,.3,10,100,false);
    box(scene,copperDark,side*7.6,7.4,-36,.16,.16,100,false);
    const pipe=tube(scene,steel,side*7.25,6.5,-35,.09,90);pipe.rotation.x=Math.PI/2;
    // Windows give the room a recognisable rhythm and a soft horizon.
    for(let n=0;n<7;n++){
      const windowMat=material(new T.MeshBasicMaterial({color:c.haze}));
      box(scene,windowMat,side*7.82,5.3,-n*13-8,.04,3.5,5,false);
      box(scene,lightWood,side*7.76,5.3,-n*13-8,.1,3.65,.12,false);
      box(scene,lightWood,side*7.76,5.3,-n*13-8,.1,.12,5,false);
    }
  }
  for(let n=0;n<8;n++)box(scene,wood,0,8.6,-n*13,16,.25,.25,false);
  for(let n=0;n<6;n++){
    const z=3-n*15;
    tube(scene,darkSteel,0,7.5,z,.025,1.6);
    mesh(geometry(new T.ConeGeometry(.4,.32,16,1,true)),darkSteel,scene,0,6.62,z);
    const light=mesh(geometry(new T.CircleGeometry(.31,18)),material(new T.MeshBasicMaterial({color:c.paper})),scene,0,6.46,z);light.rotation.x=Math.PI/2;
  }
  const farWall=standard(c.wallShade,.9);box(scene,farWall,0,5,-87,16,10,.3,false);
  box(scene,material(new T.MeshBasicMaterial({color:c.haze})),0,4,-86.7,3,6,.04,false);
  for(const side of [-1,1]){
    box(scene,wood,side*3.45,.06,-35,.09,.08,105,false);
    box(scene,lightWood,side*1.15,.015,-35,.045,.02,105,false);
  }
  const dialGeo=geometry(new T.CircleGeometry(.18,24)),ringGeo=geometry(new T.TorusGeometry(1,.025,6,28));
  const dialCanvas=document.createElement('canvas');dialCanvas.width=dialCanvas.height=128;
  const dial=dialCanvas.getContext('2d');
  if(dial){
    dial.fillStyle=c.paper;dial.fillRect(0,0,128,128);dial.strokeStyle=c.ink;
    for(let n=0;n<=16;n++){const a=Math.PI*.7+n*Math.PI*1.6/16;dial.lineWidth=n%4?2:3;dial.beginPath();dial.moveTo(64+Math.cos(a)*46,64+Math.sin(a)*46);dial.lineTo(64+Math.cos(a)*(n%4?40:34),64+Math.sin(a)*(n%4?40:34));dial.stroke();}
    dial.fillStyle=c.copperShade;dial.font='700 18px '+style.getPropertyValue('--run-font').trim();dial.textAlign='center';dial.fillText('BF',64,92);
  }
  const dialMap=new T.CanvasTexture(dialCanvas);dialMap.colorSpace=T.SRGBColorSpace;textures.add(dialMap);
  const dialMaterial=material(new T.MeshStandardMaterial({map:dialMap,roughness:.6}));
  const vesselGeo=geometry(new T.LatheGeometry([[.12,.7],[.47,.7],[.87,.9],[1.04,1.2],[1.06,1.45],[1.06,3],[.98,3.34],[.7,3.62],[.2,3.8]].map(([x,y])=>new T.Vector2(x,y)),28));
  const wheelGeo=geometry(new T.TorusGeometry(.16,.025,6,18));
  function makeTank(side:number){
    const tank=new T.Group();mesh(vesselGeo,copper,tank,0,0,0,1,1,1,true);
    for(const y of [1.24,3.0]){const ring=mesh(ringGeo,copperEdge,tank,0,y,0,1.075,1.075,1.075);ring.rotation.x=Math.PI/2;}
    for(const x of [-.65,.65])for(const z of [-.55,.55]){tube(tank,darkSteel,x,.4,z,.065,.8);box(tank,darkSteel,x,.04,z,.24,.08,.24);}
    tube(tank,steel,0,3.85,0,.24,.12);
    for(let n=0;n<8;n++){const a=n*Math.PI/4;ball(tank,darkSteel,Math.cos(a)*.19,3.93,Math.sin(a)*.19,.028,.02,.028);}
    mesh(dialGeo,dialMaterial,tank,0,2.7,1.068);
    mesh(ringGeo,steel,tank,0,2.7,1.066,.188,.188,.188);
    const needle=box(tank,ink,0,2.72,1.086,.018,.17,.01);needle.rotation.z=-.55;
    mesh(geometry(new T.CircleGeometry(.3,24)),copperDark,tank,0,1.74,1.062);
    mesh(ringGeo,copperEdge,tank,0,1.74,1.085,.31,.31,.31);
    for(let n=0;n<8;n++){const a=n*Math.PI/4;ball(tank,steel,Math.cos(a)*.255,1.74+Math.sin(a)*.255,1.094,.025);}
    const pipe=tube(tank,steel,side*1.22,2.7,0,.055,.6);pipe.rotation.z=Math.PI/2;
    tube(tank,steel,side*1.5,1.65,0,.055,2.1);
    for(const y of [.8,2.2]){const flange=mesh(ringGeo,steel,tank,side*1.5,y,0,.105,.105,.105);flange.rotation.x=Math.PI/2;}
    mesh(wheelGeo,green,tank,side*1.5,1.3,.11);box(tank,green,side*1.5,1.3,.11,.27,.035,.04);box(tank,green,side*1.5,1.3,.11,.035,.27,.04);
    compact(tank);return tank;
  }
  const prototypes=[makeTank(-1),makeTank(1)];
  const tanks:T.Group[]=[];
  for(let n=0;n<5;n++)for(const side of [-1,1]){
    const tank=prototypes[side<0?0:1].clone(true);scene.add(tank);tank.userData={row:n,side};tanks.push(tank);
  }

  // Original mug mascot: glass, beer, foam, gloves and a branded back label.
  const player=new T.Group();scene.add(player);
  const body=new T.Group();player.add(body);
  const glass=material(new T.MeshPhysicalMaterial({color:c.paper,metalness:.05,roughness:.13,transparent:true,opacity:.14,clearcoat:1,clearcoatRoughness:.1,depthWrite:false}));
  const beer=material(new T.MeshStandardMaterial({map:maps.beer,roughness:.23,metalness:.04}));
  const bodyGeo=geometry(new T.CylinderGeometry(.5,.42,1.4,28));
  mesh(bodyGeo,beer,body,0,1.55,0,.94,.98,.94,true);
  mesh(bodyGeo,glass,body,0,1.55,0);
  for(const y of [.87,2.25]){const rim=mesh(ringGeo,glass,body,0,y,0,.49,.49,.49);rim.rotation.x=Math.PI/2;}
  mesh(geometry(new T.TorusGeometry(.34,.078,10,28)),glass,body,.62,1.57,0,.88,1.24,.8);
  const ribs=new T.Group();body.add(ribs);
  for(let n=0;n<14;n++){const a=n*Math.PI/7;tube(ribs,glass,Math.sin(a)*.474,1.64,Math.cos(a)*.474,.014,1.05);}
  compact(ribs);
  const foamMaterial=material(new T.MeshStandardMaterial({color:c.paper,roughness:.9,bumpMap:maps.foam,bumpScale:.014}));
  const foam=new T.Group();body.add(foam);
  for(let n=0;n<14;n++){const a=n*2.4,r=.32+Math.sin(n)*.05;ball(foam,foamMaterial,Math.cos(a)*r,2.28+(n%3)*.065,Math.sin(a)*r,.18+(n%2)*.06,.17,.19);}
  ball(foam,foamMaterial,0,2.36,0,.35,.2,.34);compact(foam);
  const vest=standard(c.vest,.82),tieMaterial=standard(c.tie,.7),cheek=standard(c.cheek,.65);
  mesh(geometry(new T.CylinderGeometry(.505,.45,.64,28,1,true)),vest,body,0,1.2,0);
  for(const side of [-1,1]){
    const collar=mesh(geometry(new T.ConeGeometry(.16,.22,3)),cream,body,side*.16,1.55,.453);collar.rotation.z=Math.PI+(side*.42);collar.scale.z=.16;
    ball(body,cheek,side*.31,1.82,.405,.075,.04,.022);
  }
  const tie=mesh(geometry(new T.ConeGeometry(.065,.28,4)),tieMaterial,body,0,1.43,.51);tie.rotation.z=Math.PI;tie.scale.z=.2;
  ball(body,tieMaterial,0,1.59,.5,.06,.055,.025);
  for(const y of [.99,1.13,1.27])ball(body,gold,.14,y,.487,.024,.024,.012);
  for(const side of [-1,1]){
    ball(body,cream,side*.17,1.97,.445,.115,.14,.06);ball(body,ink,side*.17,1.97,.5,.06,.082,.035);
    ball(body,cream,side*.17+.018,2.0,.53,.023,.029,.014);
    const brow=box(body,ink,side*.18,2.15,.45,.19,.032,.025);brow.rotation.z=side*-.16;
  }
  const smile=mesh(geometry(new T.TorusGeometry(.13,.024,6,16,Math.PI)),ink,body,0,1.72,.49);smile.rotation.z=Math.PI;
  const legs:T.Group[]=[],arms:T.Group[]=[];
  for(const side of [-1,1]){
    const leg=new T.Group();leg.position.set(side*.21,.76,0);player.add(leg);legs.push(leg);
    tube(leg,ink,0,-.22,0,.07,.66);ball(leg,ink,0,-.65,.09,.18,.1,.26);
    box(leg,copperDark,0,-.715,.08,.27,.035,.37);
    const arm=new T.Group();arm.position.set(side*.46,1.75,0);body.add(arm);arms.push(arm);
    const sleeve=tube(arm,cream,side*.12,-.19,0,.075,.43);sleeve.rotation.z=side*.55;
    ball(arm,cream,side*.25,-.42,0,.155,.16,.145);
    ball(arm,cream,side*.12,-.38,.07,.07,.09,.08);
    for(let n=0;n<3;n++)box(arm,lightWood,side*.25+(n-1)*.042,-.43,.14,.009,.065,.009);
  }
  let last:RunState|null=null,lastReduced=true;
  const loader=new T.TextureLoader();
  loader.load(new URL('../beer/assets/logo-mug.webp',import.meta.url).href,texture=>{
    if(destroyed){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;textures.add(texture);
    const label=material(new T.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.06,roughness:.5,side:T.DoubleSide}));
    const geo=geometry(new T.PlaneGeometry(.4,.52));
    mesh(geo,label,body,0,2.36,.37,.8,.8,.8,false);const back=mesh(geo,label,body,0,1.83,-.491,1,1,1,false);back.rotation.y=Math.PI;
    if(last)paint(last,lastReduced);
  },undefined,()=>{/* The model stays playable without a decorative label. */});
  const badgeCanvas=document.createElement('canvas');badgeCanvas.width=256;badgeCanvas.height=96;
  const badge=badgeCanvas.getContext('2d');
  if(badge){badge.fillStyle=c.copperLight;badge.fillRect(0,0,256,96);badge.fillStyle=c.vest;badge.fillRect(5,5,246,86);badge.fillStyle=c.paper;badge.font='800 54px '+style.getPropertyValue('--run-font').trim();badge.textAlign='center';badge.textBaseline='middle';badge.fillText('BFStaff',128,51);}
  const badgeMap=new T.CanvasTexture(badgeCanvas);badgeMap.colorSpace=T.SRGBColorSpace;textures.add(badgeMap);
  const badgeMaterial=material(new T.MeshStandardMaterial({map:badgeMap,roughness:.7}));
  for(const a of [-.65,Math.PI-.65])mesh(geometry(new T.CylinderGeometry(.516,.516,.23,20,1,true,a,1.3)),badgeMaterial,body,0,1.18,0);

  const barrelGeo=geometry(new T.CylinderGeometry(.57,.57,1.0,20));
  const leaves:T.BufferGeometry[]=[];
  for(let n=0;n<8;n++){
    const g=new T.SphereGeometry(.14,7,5);g.scale(1,1.2,.8);g.translate(Math.sin(n*2.4)*.105,(n%4)*.095-.14,Math.cos(n*2.4)*.105);leaves.push(g);
  }
  const merged=mergeGeometries(leaves);leaves.forEach(g=>g.dispose());
  const hopGeo=geometry(merged??new T.IcosahedronGeometry(.24,1));
  const things=new Map<number,T.Group>();
  const thingModels=new Map<RunThing['kind'],T.Group>();
  function makeThing(item:RunThing){
    const model=thingModels.get(item.kind);
    if(model){const instance=model.clone(true);scene.add(instance);return instance;}
    const group=new T.Group();
    if(item.kind==='hop'){
      mesh(hopGeo,green,group,0,.95,0,1.8,1.8,1.8,false);
    }else if(item.kind==='barrel'){
      mesh(barrelGeo,wood,group,0,.5,0,1,1,1,true);
      for(const y of [.12,.85]){const ring=mesh(ringGeo,darkSteel,group,0,y,0,.585,.585,.585);ring.rotation.x=Math.PI/2;}
      tube(group,wood,0,1.02,0,.49,.025);
    }else if(item.kind==='beam'){
      for(const side of [-1,1])box(group,darkSteel,side*.95,1.5,0,.13,3,.13);
      box(group,gold,0,2.35,0,2.1,.35,.28);
      for(let n=0;n<5;n++){const stripe=box(group,ink,-.8+n*.4,2.35,.147,.13,.35,.015,false);stripe.rotation.z=-.4;}
    }else{
      box(group,wood,0,1.45,0,1.3,2.9,1.15,true);
      for(const y of [.15,1.4,2.75])box(group,lightWood,0,y,.59,1.36,.13,.06);
      for(const side of [-1,1])box(group,lightWood,side*.55,1.45,.59,.13,2.9,.07);
      const brace=box(group,lightWood,0,1.45,.63,.12,2.8,.06);brace.rotation.z=.35;
    }
    compact(group);thingModels.set(item.kind,group);
    const instance=group.clone(true);scene.add(instance);return instance;
  }
  const previewItems:RunThing[]=[{id:-1,lane:1,z:18,kind:'barrel',resolved:false},...Array.from({length:4},(_,n)=>({id:-2-n,lane:-1 as const,z:13+n*4,kind:'hop' as const,resolved:false}))];
  function resize(){
    const rect=canvas.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height),aspect=width/height;
    renderer.setSize(width,height,false);camera.aspect=aspect;camera.fov=aspect>1?46:58;
    camera.position.set(0,aspect>1?3.5:4.8,aspect>1?7.4:Math.max(9.8,6.2/aspect));
    camera.lookAt(0,aspect>1?1:4.1,aspect>1?-5:-18);camera.updateProjectionMatrix();
  }
  let crouch=0,poseTime=0;
  function paint(s:RunState,reduced:boolean){
    if(destroyed)return;last=s;lastReduced=reduced;
    floorMap.offset.y=-s.distance/120*floorMap.repeat.y;
    maps.floorBump.offset.copy(floorMap.offset);
    for(const tank of tanks){const {row,side}=tank.userData;tank.position.set(side*5.4,0,7-row*18+s.distance%18);}
    player.position.set(s.x*2.3,jumpHeight(s)*2.4,.3);
    player.rotation.y=s.phase==='ready'||s.phase==='over'?-.22:Math.PI;
    const delta=Math.max(0,Math.min(.06,s.time-poseTime));poseTime=s.time;
    const target=s.slide>0?1:0;
    crouch=reduced||s.phase==='ready'?target:T.MathUtils.damp(crouch,target,24,delta);
    const stride=s.phase==='running'&&!reduced?Math.sin(s.time*13):0;
    body.position.y=-crouch*.42+(1-crouch)*Math.abs(stride)*.025;
    body.rotation.x=crouch*.48;
    legs.forEach((leg,n)=>{leg.position.y=.76-crouch*.2;leg.rotation.x=stride*(n?1:-1)*.7*(1-crouch)+crouch*1.0;});
    arms.forEach((arm,n)=>arm.rotation.x=stride*(n?-1:1)*.5*(1-crouch)-crouch*.6);
    player.rotation.z=reduced?0:(s.lane-s.x)*-.12;
    const live=s.phase==='ready'?previewItems:s.things;
    const ids=new Set(live.filter(i=>!i.resolved&&i.z>-2&&i.z<85).map(i=>i.id));
    for(const [id,o] of things)if(!ids.has(id)){scene.remove(o);things.delete(id);}
    for(const item of live){
      if(!ids.has(item.id))continue;
      let o=things.get(item.id);if(!o){o=makeThing(item);things.set(item.id,o);}
      o.position.set(item.lane*2.3,0,-item.z);
      if(item.kind==='hop'){o.rotation.y=reduced?0:s.time*1.5+item.id;o.position.y=reduced?0:Math.sin(s.time*2+item.id)*.045;}
    }
    renderer.render(scene,camera);
  }
  const lost=(event:Event)=>{event.preventDefault();onLost();};canvas.addEventListener('webglcontextlost',lost);
  resize();
  return {paint,resize,destroy:()=>{
    destroyed=true;canvas.removeEventListener('webglcontextlost',lost);
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());environment?.dispose();
    renderer.dispose();renderer.forceContextLoss();scene.clear();things.clear();
  }};
  }catch{
    destroyed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());environment?.dispose();renderer.dispose();renderer.forceContextLoss();return null;
  }
}
