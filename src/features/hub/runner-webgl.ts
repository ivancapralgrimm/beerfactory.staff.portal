/*! Three.js, Copyright 2010-2026 three.js authors. MIT license: /assets/licenses/three.txt */
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {jumpHeight,type RunState,type RunThing} from './runner-engine';
import type {RunnerPainter} from './runner-renderer';

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
  const c=Object.fromEntries(['sky','haze','wall','wallShade','wood','woodLight','floor','seam','copper','copperShade','copperLight','steel','steelShade','paper','ink','gold','amber','green','leaf'].map(k=>[k,color(k)]));
  const scene=new T.Scene();scene.background=new T.Color(c.sky);scene.fog=new T.Fog(c.sky,23,83);
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
  const cube=geometry(new T.BoxGeometry(1,1,1)),sphere=geometry(new T.SphereGeometry(1,18,12)),cylinder=geometry(new T.CylinderGeometry(1,1,1,24));
  function mesh(g:T.BufferGeometry,m:T.Material,parent:T.Object3D,x:number,y:number,z:number,sx=1,sy=1,sz=1,shadow=false){
    const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=shadow;o.receiveShadow=true;parent.add(o);return o;
  }
  const box=(parent:T.Object3D,m:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,shadow=false)=>mesh(cube,m,parent,x,y,z,sx,sy,sz,shadow);
  const ball=(parent:T.Object3D,m:T.Material,x:number,y:number,z:number,sx:number,sy=sx,sz=sx)=>mesh(sphere,m,parent,x,y,z,sx,sy,sz);
  const tube=(parent:T.Object3D,m:T.Material,x:number,y:number,z:number,radius:number,length:number)=>mesh(cylinder,m,parent,x,y,z,radius,length,radius);
  const hemisphere=new T.HemisphereLight(c.haze,c.wood,1.4);scene.add(hemisphere);
  const sun=new T.DirectionalLight(c.paper,3.1);sun.position.set(-5,12,5);sun.target.position.set(0,0,-12);sun.castShadow=true;
  sun.shadow.mapSize.set(512,512);sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-9;sun.shadow.camera.far=48;sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;scene.add(sun,sun.target);
  const fill=new T.DirectionalLight(c.copperLight,1);fill.position.set(6,5,-15);scene.add(fill);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();environment=pmrem.fromScene(room,.08);
  scene.environment=environment.texture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();

  // A repeating hand-built wood texture is shared by one floor mesh.
  const textureCanvas=document.createElement('canvas');textureCanvas.width=256;textureCanvas.height=512;
  const brush=textureCanvas.getContext('2d');
  if(brush){
    brush.fillStyle=c.floor;brush.fillRect(0,0,256,512);
    for(let n=0;n<120;n++){brush.strokeStyle=n%3?c.woodLight:c.wood;brush.globalAlpha=.15;brush.lineWidth=n%4===0?2:1;brush.beginPath();for(let y=0;y<=512;y+=8){const x=n*2.5+Math.sin(y*.019+n)*2.2; y?brush.lineTo(x,y):brush.moveTo(x,y);}brush.stroke();}
    brush.globalAlpha=1;brush.fillStyle=c.seam;brush.fillRect(0,0,2,512);brush.fillRect(0,0,256,3);
    for(const x of [11,244])for(const y of [13,496]){brush.fillStyle=c.wood;brush.beginPath();brush.arc(x,y,1.8,0,Math.PI*2);brush.fill();}
  }
  const floorMap=new T.CanvasTexture(textureCanvas);floorMap.colorSpace=T.SRGBColorSpace;floorMap.wrapS=floorMap.wrapT=T.RepeatWrapping;floorMap.repeat.set(6,22);textures.add(floorMap);
  const floorMaterial=material(new T.MeshStandardMaterial({map:floorMap,roughness:.82,color:c.paper}));
  const floor=mesh(geometry(new T.PlaneGeometry(15,120)),floorMaterial,scene,0,-.035,-38,1,1,1,false);floor.rotation.x=-Math.PI/2;
  const wallMaterial=standard(c.wall,.9);
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
  const farWall=standard(c.wallShade,.9);box(scene,farWall,0,5,-87,16,10,.3,false);
  box(scene,material(new T.MeshBasicMaterial({color:c.haze})),0,4,-86.7,3,6,.04,false);
  for(const side of [-1,1]){
    box(scene,wood,side*3.45,.06,-35,.09,.08,105,false);
    box(scene,lightWood,side*1.15,.015,-35,.045,.02,105,false);
  }
  const dialGeo=geometry(new T.CircleGeometry(.18,20)),ringGeo=geometry(new T.TorusGeometry(1,.025,6,28));
  const tanks:T.Group[]=[];
  for(let n=0;n<5;n++)for(const side of [-1,1]){
    const tank=new T.Group();scene.add(tank);tank.userData={row:n,side};tanks.push(tank);
    tube(tank,copper,0,2.1,0,1.05,2.5).castShadow=true;
    ball(tank,copper,0,3.35,0,1.05,.42,1.05);ball(tank,copperDark,0,.85,0,1.04,.3,1.04);
    for(const y of [1.1,3.0]){const ring=mesh(ringGeo,copperEdge,tank,0,y,0,1.065,1.065,1.065);ring.rotation.x=Math.PI/2;}
    for(const x of [-.65,.65])for(const z of [-.55,.55])tube(tank,darkSteel,x,.42,z,.07,.85);
    tube(tank,steel,0,3.9,0,.18,.5);
    mesh(dialGeo,cream,tank,0,2.7,1.058);const needle=box(tank,ink,0,2.72,1.075,.018,.17,.01,false);needle.rotation.z=-.55;
    const pipe=tube(tank,steel,side*1.2,2.7,0,.055,.55);pipe.rotation.z=Math.PI/2;
    tube(tank,steel,side*1.45,1.6,0,.055,2.2);
    box(tank,darkSteel,side*1.45,.5,0,.3,.07,.3);
  }

  // Original mug mascot: glass, beer, foam, gloves and a branded back label.
  const player=new T.Group();scene.add(player);
  const body=new T.Group();player.add(body);
  const glass=material(new T.MeshPhysicalMaterial({color:c.paper,metalness:.05,roughness:.15,transparent:true,opacity:.2,clearcoat:1,clearcoatRoughness:.1,depthWrite:false}));
  const beer=standard(c.amber,.25,.08);
  const bodyGeo=geometry(new T.CylinderGeometry(.5,.42,1.4,28));
  mesh(bodyGeo,beer,body,0,1.55,0,.94,.98,.94,true);
  mesh(bodyGeo,glass,body,0,1.55,0);
  for(const y of [.87,2.25]){const rim=mesh(ringGeo,glass,body,0,y,0,.49,.49,.49);rim.rotation.x=Math.PI/2;}
  const handle=mesh(geometry(new T.TorusGeometry(.38,.085,10,28)),glass,body,.61,1.55,0,.85,1.1,1);handle.rotation.y=Math.PI/2;
  for(let n=0;n<12;n++){const a=n*2.4,r=.32+Math.sin(n)*.05;ball(body,cream,Math.cos(a)*r,2.28+(n%3)*.07,Math.sin(a)*r,.19+(n%2)*.055,.17,.19);}
  ball(body,cream,0,2.36,0,.35,.2,.34);
  for(const side of [-1,1]){
    ball(body,cream,side*.17,1.97,.445,.105,.13,.055);ball(body,ink,side*.17,1.97,.491,.052,.075,.03);
    ball(body,cream,side*.17+.018,2.0,.515,.021,.026,.014);
  }
  const smile=mesh(geometry(new T.TorusGeometry(.13,.024,6,16,Math.PI)),ink,body,0,1.72,.49);smile.rotation.z=Math.PI;
  const legs:T.Group[]=[],arms:T.Group[]=[];
  for(const side of [-1,1]){
    const leg=new T.Group();leg.position.set(side*.21,.85,0);body.add(leg);legs.push(leg);
    tube(leg,ink,0,-.28,0,.065,.56);ball(leg,ink,0,-.58,.08,.16,.09,.23);
    const arm=new T.Group();arm.position.set(side*.46,1.75,0);body.add(arm);arms.push(arm);
    const sleeve=tube(arm,cream,side*.12,-.19,0,.075,.43);sleeve.rotation.z=side*.55;
    ball(arm,cream,side*.25,-.42,0,.125,.14,.13);
  }
  let last:RunState|null=null,lastReduced=true;
  const loader=new T.TextureLoader();
  loader.load(new URL('../beer/assets/logo-mug.webp',import.meta.url).href,texture=>{
    if(destroyed){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;textures.add(texture);
    const label=material(new T.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.06,roughness:.5,side:T.DoubleSide}));
    const geo=geometry(new T.PlaneGeometry(.4,.52));
    mesh(geo,label,body,0,1.3,.489,1,1,1,false);const back=mesh(geo,label,body,0,1.54,-.488,1,1,1,false);back.rotation.y=Math.PI;
    if(last)paint(last,lastReduced);
  },undefined,()=>{/* The model stays playable without a decorative label. */});

  const barrelGeo=geometry(new T.CylinderGeometry(.57,.57,1.0,20));
  const leaves:T.BufferGeometry[]=[];
  for(let n=0;n<8;n++){
    const g=new T.SphereGeometry(.14,7,5);g.scale(1,1.2,.8);g.translate(Math.sin(n*2.4)*.105,(n%4)*.095-.14,Math.cos(n*2.4)*.105);leaves.push(g);
  }
  const merged=mergeGeometries(leaves);leaves.forEach(g=>g.dispose());
  const hopGeo=geometry(merged??new T.IcosahedronGeometry(.24,1));
  const things=new Map<number,T.Group>();
  function makeThing(item:RunThing){
    const group=new T.Group();scene.add(group);
    if(item.kind==='hop'){
      mesh(hopGeo,green,group,0,.95,0,1.8,1.8,1.8,false);
    }else if(item.kind==='barrel'){
      mesh(barrelGeo,lightWood,group,0,.5,0,1,1,1,true);
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
    return group;
  }
  const previewItems:RunThing[]=[{id:-1,lane:1,z:18,kind:'barrel',resolved:false},...Array.from({length:4},(_,n)=>({id:-2-n,lane:-1 as const,z:13+n*4,kind:'hop' as const,resolved:false}))];
  function resize(){
    const rect=canvas.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height),aspect=width/height;
    renderer.setSize(width,height,false);camera.aspect=aspect;camera.fov=aspect>1?46:58;
    camera.position.set(0,aspect>1?3.5:4.8,aspect>1?7.4:Math.max(9.8,6.2/aspect));
    camera.lookAt(0,aspect>1?1:4.1,aspect>1?-5:-18);camera.updateProjectionMatrix();
  }
  function paint(s:RunState,reduced:boolean){
    if(destroyed)return;last=s;lastReduced=reduced;
    floorMap.offset.y=-s.distance/120*22;
    for(const tank of tanks){const {row,side}=tank.userData;tank.position.set(side*5.4,0,7-row*18+s.distance%18);}
    player.position.set(s.x*2.3,jumpHeight(s)*2.4,.3);
    body.rotation.y=s.phase==='ready'?-.22:Math.PI;
    body.scale.set(1,s.slide>0?.5:1,1);body.position.y=0;
    const stride=s.phase==='running'&&!reduced?Math.sin(s.time*13):0;
    legs.forEach((leg,n)=>leg.rotation.x=stride*(n?1:-1)*.7);
    arms.forEach((arm,n)=>arm.rotation.x=stride*(n?-1:1)*.5);
    body.rotation.z=reduced?0:(s.lane-s.x)*-.12;
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
