/*! Three.js, Copyright 2010-2026 three.js authors. MIT license: /assets/licenses/three.txt */
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {jumpHeight,type RunState,type RunThing} from './runner-engine';
import type {RunnerPainter} from './runner-renderer';
import {createBreweryMaps} from './runner-materials';
import {characterPose,crouchBlend,LEG_LENGTH} from './runner-character-motion';
import {SCENE_FOG,SCENERY_ROWS,recycledRowZ} from './runner-scene-layout';

/** Original procedural 3D brewery. No downloaded models, external CDN or API. */
export function createWebGLPainter(canvas:HTMLCanvasElement,theme:HTMLElement,onLost:()=>void):RunnerPainter|null {
  let renderer:T.WebGLRenderer;
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'default'});
  if(!gl)return null;
  try{renderer=new T.WebGLRenderer({canvas,context:gl,antialias:true,alpha:false,powerPreference:'default'});}catch{return null;}
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
  const instances=new Set<T.InstancedMesh>();
  let environment:T.WebGLRenderTarget|null=null,destroyed=false;
  try{
  canvas.dataset.renderer='webgl';
  const style=getComputedStyle(theme),color=(name:string)=>style.getPropertyValue('--run-'+name).trim();
  const c=Object.fromEntries(['sky','haze','wall','wallShade','wood','woodLight','floor','seam','copper','copperShade','copperLight','steel','steelShade','paper','ink','gold','amber','amberDeep','green','leaf','brick','brickShade','mortar','vest','tie','cheek','window'].map(k=>[k,color(k)]));
  const scene=new T.Scene();scene.background=new T.Color(c.sky);scene.fog=new T.Fog(c.sky,SCENE_FOG.near,SCENE_FOG.far);
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
  const rounded=geometry(new RoundedBoxGeometry(1,1,1,2,.12));
  function mesh(g:T.BufferGeometry,m:T.Material,parent:T.Object3D,x:number,y:number,z:number,sx=1,sy=1,sz=1,shadow=false){
    const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=shadow;o.receiveShadow=true;parent.add(o);return o;
  }
  const box=(parent:T.Object3D,m:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,shadow=false)=>mesh(cube,m,parent,x,y,z,sx,sy,sz,shadow);
  const softBox=(parent:T.Object3D,m:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,shadow=false)=>mesh(rounded,m,parent,x,y,z,sx,sy,sz,shadow);
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
  // Repeated rows are persistent GPU instances, never new chunks on each frame.
  const rows:{meshes:T.InstancedMesh[];x:number;count:number;spacing:number;start:number}[]=[];
  function instanceRows(model:T.Group,count:number,spacing:number,start:number,x=0){
    const meshes:T.InstancedMesh[]=[];
    for(const child of model.children){
      if(!(child instanceof T.Mesh)||Array.isArray(child.material))continue;
      const batch=new T.InstancedMesh(child.geometry,child.material,count);
      batch.castShadow=child.castShadow;batch.receiveShadow=child.receiveShadow;
      batch.instanceMatrix.setUsage(T.DynamicDrawUsage);
      // Conservative fixed bounds enclose every recycled position, including wrap.
      batch.boundingSphere=new T.Sphere(new T.Vector3(x,4,-35),85);
      scene.add(batch);instances.add(batch);meshes.push(batch);
    }
    rows.push({meshes,x,count,spacing,start});
  }
  const hemisphere=new T.HemisphereLight(c.haze,c.wood,.9);scene.add(hemisphere,new T.AmbientLight(c.paper,.35));
  const sun=new T.DirectionalLight(c.copperLight,3.2);sun.position.set(-5,12,5);sun.target.position.set(0,0,-12);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-9;sun.shadow.camera.far=48;sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;scene.add(sun,sun.target);
  const fill=new T.DirectionalLight(c.copperLight,1);fill.position.set(6,5,-15);scene.add(fill);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();environment=pmrem.fromScene(room,.08);
  scene.environment=environment.texture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();

  const floorMap=maps.floor;
  const floorMaterial=material(new T.MeshStandardMaterial({map:floorMap,bumpMap:maps.floorBump,bumpScale:.035,roughness:.8}));
  const floor=mesh(geometry(new T.PlaneGeometry(15,120)),floorMaterial,scene,0,-.035,-38,1,1,1,false);floor.rotation.x=-Math.PI/2;
  const walls:{side:number;map:T.Texture;bump:T.Texture}[]=[],wallGeo=geometry(new T.PlaneGeometry(120,10));
  for(const side of [-1,1]){
    const map=side<0?maps.brick:maps.brick.clone(),bump=side<0?maps.brickBump:maps.brickBump.clone();
    map.repeat.set(48,5);bump.repeat.set(48,5);textures.add(map);textures.add(bump);walls.push({side,map,bump});
    const wallMaterial=material(new T.MeshStandardMaterial({map,bumpMap:bump,bumpScale:.045,roughness:.9}));
    const wall=mesh(wallGeo,wallMaterial,scene,side*8,5,-38);wall.rotation.y=-side*Math.PI/2;
    box(scene,copperDark,side*7.6,7.4,-36,.16,.16,100,false);
    const pipe=tube(scene,steel,side*7.25,6.5,-35,.09,90);pipe.rotation.x=Math.PI/2;
  }
  const hallRow=new T.Group(),windowMat=material(new T.MeshBasicMaterial({color:c.window}));
  for(const side of [-1,1]){
    box(hallRow,windowMat,side*7.82,5.3,0,.04,3.5,5);
    box(hallRow,lightWood,side*7.76,5.3,0,.1,3.65,.12);
    box(hallRow,lightWood,side*7.76,5.3,0,.1,.12,5);
  }
  box(hallRow,wood,0,8.6,0,16,.25,.25);
  tube(hallRow,darkSteel,0,7.5,0,.025,1.6);
  mesh(geometry(new T.ConeGeometry(.4,.32,16,1,true)),darkSteel,hallRow,0,6.62,0);
  const light=mesh(geometry(new T.CircleGeometry(.31,18)),material(new T.MeshBasicMaterial({color:c.paper})),hallRow,0,6.46,0);light.rotation.x=Math.PI/2;
  compact(hallRow);instanceRows(hallRow,SCENERY_ROWS.hall.count,SCENERY_ROWS.hall.spacing,SCENERY_ROWS.hall.start);
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
  // Spare far rows enter beyond the fog, so recycling cannot pop into view.
  for(const side of [-1,1])instanceRows(makeTank(side),SCENERY_ROWS.tanks.count,SCENERY_ROWS.tanks.spacing,SCENERY_ROWS.tanks.start,side*5.4);

  // Original mug mascot: glass, beer, foam, gloves and a branded back label.
  const player=new T.Group();scene.add(player);
  const torso=new T.Group();torso.position.y=1.5;player.add(torso);
  const body=new T.Group();body.position.y=-1.5;torso.add(body);
  const glass=material(new T.MeshPhysicalMaterial({color:c.paper,metalness:.05,roughness:.13,transparent:true,opacity:.14,clearcoat:1,clearcoatRoughness:.1,depthWrite:false}));
  const beer=material(new T.MeshStandardMaterial({map:maps.beer,roughness:.23,metalness:.04}));
  const bodyGeo=geometry(new T.LatheGeometry([[0,.0],[.38,.0],[.43,.035],[.46,.16],[.49,.7],[.51,1.2],[.5,1.37],[.47,1.4],[0,1.4]].map(([x,y])=>new T.Vector2(x,y-.7)),32));
  mesh(bodyGeo,beer,body,0,1.55,0,.94,.98,.94,true);
  mesh(bodyGeo,glass,body,0,1.55,0);
  for(const y of [.87,2.25]){const rim=mesh(ringGeo,glass,body,0,y,0,.49,.49,.49);rim.rotation.x=Math.PI/2;}
  mesh(geometry(new T.TorusGeometry(.34,.078,10,28)),glass,body,.62,1.57,0,.88,1.24,.8);
  const ribs=new T.Group();body.add(ribs);
  for(let n=0;n<14;n++){const a=n*Math.PI/7;tube(ribs,glass,Math.sin(a)*.474,1.64,Math.cos(a)*.474,.014,1.05);}
  for(let n=0;n<18;n++){const a=n*2.4,y=1.58+(n%5)*.12;if(Math.cos(a)>.6&&y<2.14)continue;ball(ribs,glass,Math.sin(a)*.5,y,Math.cos(a)*.5,.014+(n%3)*.004,.025,.014);}
  compact(ribs);
  const foamMaterial=material(new T.MeshStandardMaterial({color:c.paper,roughness:.9,bumpMap:maps.foam,bumpScale:.014}));
  const foamPivot=new T.Group();foamPivot.position.y=2.25;body.add(foamPivot);
  const foam=new T.Group();foam.position.y=-2.25;foamPivot.add(foam);
  for(let n=0;n<14;n++){const a=n*2.4,r=.32+Math.sin(n)*.05;ball(foam,foamMaterial,Math.cos(a)*r,2.28+(n%3)*.065,Math.sin(a)*r,.18+(n%2)*.06,.17,.19);}
  ball(foam,foamMaterial,0,2.36,0,.35,.2,.34);compact(foam);
  const vest=standard(c.vest,.82),tieMaterial=standard(c.tie,.7),cheek=standard(c.cheek,.65);
  mesh(geometry(new T.CylinderGeometry(.505,.45,.64,28,1,true)),vest,body,0,1.2,0);
  for(const side of [-1,1]){
    const collar=mesh(geometry(new T.ConeGeometry(.16,.22,3)),cream,body,side*.16,1.55,.483);collar.rotation.z=Math.PI+(side*.42);collar.scale.z=.16;
    ball(body,cheek,side*.31,1.82,.405,.075,.04,.022);
  }
  const tiePivot=new T.Group();tiePivot.position.set(0,1.57,.52);body.add(tiePivot);
  const tie=mesh(geometry(new T.ConeGeometry(.065,.28,4)),tieMaterial,tiePivot,0,-.14,0);tie.rotation.z=Math.PI;tie.scale.z=.2;
  ball(body,tieMaterial,0,1.59,.5,.06,.055,.025);
  for(const y of [.99,1.13,1.27])ball(body,gold,.14,y,.487,.024,.024,.012);
  // Small tailored details remain geometry, not flat interface decorations.
  for(const angle of [0,Math.PI]){
    const seam=mesh(geometry(new T.TorusGeometry(.472,.012,5,24,1.4)),copperEdge,body,0,.93,0);seam.rotation.x=Math.PI/2;seam.rotation.z=angle+.87;
  }
  const eyes:T.Group[]=[];
  for(const side of [-1,1]){
    const eye=new T.Group();eye.position.set(side*.18,1.98,.452);body.add(eye);eyes.push(eye);
    ball(eye,cream,0,0,0,.129,.153,.062);ball(eye,copperDark,0,0,.055,.083,.111,.032);
    ball(eye,ink,0,0,.08,.052,.078,.024);ball(eye,cream,.022,.038,.1,.025,.034,.013);
    const brow=mesh(geometry(new T.TorusGeometry(.12,.025,6,14,1.5)),vest,body,side*.18,2.13,.452);brow.rotation.z=.82+side*.1;
  }
  ball(body,ink,0,1.74,.485,.16,.092,.025);ball(body,cream,0,1.79,.508,.127,.027,.01);ball(body,cheek,0,1.69,.505,.083,.023,.011);
  const legs:{hip:T.Group;knee:T.Group;foot:T.Group}[]=[],arms:{shoulder:T.Group;elbow:T.Group;hand:T.Group}[]=[];
  for(const side of [-1,1]){
    const hip=new T.Group();hip.position.x=side*.22;player.add(hip);
    const knee=new T.Group();knee.position.y=-LEG_LENGTH;hip.add(knee);
    const foot=new T.Group();foot.position.y=-LEG_LENGTH;knee.add(foot);legs.push({hip,knee,foot});
    ball(hip,vest,0,-.02,0,.13,.15,.13);tube(hip,vest,0,-LEG_LENGTH/2,0,.105,LEG_LENGTH);
    ball(knee,vest,0,0,0,.112,.115,.112);tube(knee,vest,0,-LEG_LENGTH/2,0,.085,LEG_LENGTH);
    // Shoe, welt, heel and laces; a separate ankle keeps the sole level on contact.
    ball(foot,vest,0,-.025,.07,.16,.095,.23);box(foot,copperDark,0,-.1,.06,.27,.035,.36);
    box(foot,ink,0,-.087,-.08,.2,.055,.12);
    for(let n=0;n<3;n++)box(foot,copperEdge,0,.042,.02+n*.04,.1,.009,.01);
    const shoulder=new T.Group();shoulder.position.set(side*.54,1.53,0);shoulder.rotation.z=side*.25;body.add(shoulder);
    const elbow=new T.Group();elbow.position.y=-.25;shoulder.add(elbow);
    const hand=new T.Group();hand.position.y=-.28;elbow.add(hand);arms.push({shoulder,elbow,hand});
    ball(shoulder,cream,0,-.035,0,.112,.13,.11);tube(shoulder,cream,0,-.14,0,.095,.22);
    ball(elbow,cream,0,0,0,.095,.1,.095);tube(elbow,cream,0,-.11,0,.08,.22);
    tube(elbow,lightWood,0,-.205,0,.087,.025);ball(elbow,gold,side*.08,-.2,.01,.022);
    ball(hand,cream,0,-.03,.025,.14,.145,.11);ball(hand,cream,-side*.105,.015,.08,.069,.084,.065);
    for(let n=0;n<3;n++)ball(hand,cream,(n-1)*.07,-.125,.036,.047,.055,.055);
    compact(hand);
  }
  let last:RunState|null=null,lastReduced=true;
  const loader=new T.TextureLoader();
  loader.load(new URL('../beer/assets/logo-mug.webp',import.meta.url).href,texture=>{
    if(destroyed){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;textures.add(texture);
    const label=material(new T.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.06,roughness:.5,side:T.DoubleSide}));
    const geo=geometry(new T.PlaneGeometry(.4,.52));
    mesh(geo,label,foamPivot,0,.11,.37,.8,.8,.8,false);const back=mesh(geo,label,body,0,1.83,-.515,1,1,1,false);back.rotation.y=Math.PI;
    if(last)paint(last,lastReduced);
  },undefined,()=>{/* The model stays playable without a decorative label. */});
  const badgeCanvas=document.createElement('canvas');badgeCanvas.width=256;badgeCanvas.height=96;
  const badge=badgeCanvas.getContext('2d');
  if(badge){badge.fillStyle=c.copperLight;badge.fillRect(0,0,256,96);badge.fillStyle=c.vest;badge.fillRect(5,5,246,86);badge.fillStyle=c.paper;badge.font='800 54px '+style.getPropertyValue('--run-font').trim();badge.textAlign='center';badge.textBaseline='middle';badge.fillText('BFStaff',128,51);}
  const badgeMap=new T.CanvasTexture(badgeCanvas);badgeMap.colorSpace=T.SRGBColorSpace;textures.add(badgeMap);
  const badgeMaterial=material(new T.MeshStandardMaterial({map:badgeMap,roughness:.7}));
  for(const a of [-.65,Math.PI-.65])mesh(geometry(new T.CylinderGeometry(.516,.516,.23,20,1,true,a,1.3)),badgeMaterial,body,0,1.18,0);

  const barrelGeo=geometry(new T.LatheGeometry([[0,0],[.47,0],[.53,.12],[.58,.35],[.59,.6],[.53,.9],[.47,1],[0,1]].map(([x,y])=>new T.Vector2(x,y)),28));
  const leaves:T.BufferGeometry[]=[];
  for(let n=0;n<8;n++){
    const g=new T.SphereGeometry(.14,7,5);g.scale(1,1.2,.8);g.translate(Math.sin(n*2.4)*.105,(n%4)*.095-.14,Math.cos(n*2.4)*.105);leaves.push(g);
  }
  const merged=mergeGeometries(leaves);leaves.forEach(g=>g.dispose());
  const hopGeo=geometry(merged??new T.IcosahedronGeometry(.24,1));
  const hopBatch=new T.InstancedMesh(hopGeo,green,90);hopBatch.count=0;hopBatch.instanceMatrix.setUsage(T.DynamicDrawUsage);
  hopBatch.boundingSphere=new T.Sphere(new T.Vector3(0,1,-40),50);scene.add(hopBatch);instances.add(hopBatch);
  const instanceMatrix=new T.Matrix4(),hopScale=new T.Vector3(1.8,1.8,1.8);
  const things=new Map<number,T.Group>();
  const thingModels=new Map<Exclude<RunThing['kind'],'hop'>,T.Group>();
  function makeThing(kind:Exclude<RunThing['kind'],'hop'>){
    const model=thingModels.get(kind);
    if(model){const instance=model.clone(true);scene.add(instance);return instance;}
    const group=new T.Group();
    if(kind==='barrel'){
      mesh(barrelGeo,wood,group,0,0,0,1,1,1,true);
      for(const [y,radius] of [[.12,.55],[.5,.595],[.87,.55]]){const ring=mesh(ringGeo,darkSteel,group,0,y,0,radius,radius,radius);ring.rotation.x=Math.PI/2;}
      tube(group,wood,0,1.02,0,.49,.025);
    }else if(kind==='beam'){
      for(const side of [-1,1]){tube(group,darkSteel,side*.95,1.5,0,.07,3);softBox(group,darkSteel,side*.95,.05,0,.35,.1,.35);}
      softBox(group,gold,0,2.35,0,2.1,.35,.28);
      for(let n=0;n<5;n++){const stripe=box(group,ink,-.8+n*.4,2.35,.147,.13,.35,.015,false);stripe.rotation.z=-.4;}
    }else{
      for(const y of [.7,2.15])softBox(group,wood,0,y,0,1.3,1.4,1.15,true);
      for(const y of [.15,1.4,2.75])box(group,lightWood,0,y,.59,1.36,.13,.06);
      for(const side of [-1,1])box(group,lightWood,side*.55,1.45,.59,.13,2.9,.07);
      const brace=box(group,lightWood,0,1.45,.63,.12,2.8,.06);brace.rotation.z=.35;
    }
    compact(group);thingModels.set(kind,group);
    const instance=group.clone(true);scene.add(instance);return instance;
  }
  const previewItems:RunThing[]=[{id:-1,lane:1,z:18,kind:'barrel',resolved:false},...Array.from({length:4},(_,n)=>({id:-2-n,lane:-1 as const,z:13+n*4,kind:'hop' as const,resolved:false}))];
  let crouch=0,poseTime=0,framing=1;
  function placeCamera(blend:number,follow=0){
    if(camera.aspect>1){camera.position.set(follow,3.5,7.4);camera.lookAt(follow*.4,1,-5);return;}
    camera.position.set(follow,T.MathUtils.lerp(4.4,4.8,blend),T.MathUtils.lerp(Math.max(8.8,5.5/camera.aspect),Math.max(9.8,6.2/camera.aspect),blend));
    camera.lookAt(follow*.4,T.MathUtils.lerp(2.15,4.1,blend),T.MathUtils.lerp(-13,-18,blend));
  }
  function resize(){
    const rect=canvas.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height),aspect=width/height;
    renderer.setSize(width,height,false);camera.aspect=aspect;camera.fov=aspect>1?46:58;
    placeCamera(framing,(last?.x??0)*.6);camera.updateProjectionMatrix();
  }
  function paint(s:RunState,reduced:boolean){
    if(destroyed)return;last=s;lastReduced=reduced;
    // Plane V decreases along world Z, so positive offset moves grain toward us.
    floorMap.offset.y=(s.distance/120*floorMap.repeat.y)%1;
    maps.floorBump.offset.copy(floorMap.offset);
    for(const wall of walls){wall.map.offset.x=-wall.side*((s.distance/120*wall.map.repeat.x)%1);wall.bump.offset.copy(wall.map.offset);}
    for(const row of rows){
      let count=0;
      for(let n=0;n<row.count;n++){
        const z=recycledRowZ(s.distance,n,row.spacing,row.start);
        if(z>camera.position.z+3)continue;
        instanceMatrix.makeTranslation(row.x,0,z);for(const batch of row.meshes)batch.setMatrixAt(count,instanceMatrix);count++;
      }
      for(const batch of row.meshes){batch.count=count;batch.instanceMatrix.needsUpdate=true;}
    }
    // Keep the greeting face below the start panel; ease into the running view.
    const intro=s.phase==='ready'||s.phase==='over',delta=Math.max(0,Math.min(.06,s.time-poseTime));
    framing=intro?1:reduced?0:T.MathUtils.damp(framing,0,12,delta);placeCamera(framing,s.x*.6);
    player.position.set(s.x*2.3,jumpHeight(s)*2.4,.3);
    player.rotation.y=s.phase==='ready'||s.phase==='over'?-.22:Math.PI;
    const target=s.slide>0?1:0;
    crouch=crouchBlend(crouch,target,s.time,poseTime,reduced||s.phase==='ready');poseTime=s.time;
    const pose=characterPose(s,reduced,crouch,jumpHeight(s));
    torso.position.y=1.5+pose.bodyY;torso.rotation.set(pose.bodyPitch,pose.bodyYaw,pose.bodyRoll+pose.lean);
    legs.forEach(({hip,knee,foot},n)=>{hip.position.y=pose.hipY;hip.rotation.x=pose.legs[n].hip;knee.rotation.x=pose.legs[n].knee;foot.rotation.x=pose.legs[n].ankle;});
    arms.forEach(({shoulder,elbow,hand},n)=>{shoulder.rotation.x=pose.arms[n].upper;elbow.rotation.x=pose.arms[n].elbow;hand.rotation.x=pose.arms[n].wrist;});
    foamPivot.rotation.z=pose.foamRoll;tiePivot.rotation.x=pose.tiePitch;
    eyes.forEach((eye,n)=>eye.scale.y=pose.idle&&n===1?.3:1-pose.blink*.94);
    const live=s.phase==='ready'?previewItems:s.things;
    const ids=new Set(live.filter(i=>!i.resolved&&i.z>-2&&i.z<85&&i.kind!=='hop').map(i=>i.id));
    for(const [id,o] of things)if(!ids.has(id)){scene.remove(o);things.delete(id);}
    let hops=0;
    for(const item of live){
      if(item.kind==='hop'){
        if(item.resolved||item.z<=-2||item.z>=85||hops>=90)continue;
        instanceMatrix.makeRotationY(reduced?0:s.time*1.5+item.id).scale(hopScale).setPosition(item.lane*2.3,.95+(reduced?0:Math.sin(s.time*2+item.id)*.045),-item.z);
        hopBatch.setMatrixAt(hops++,instanceMatrix);continue;
      }
      if(!ids.has(item.id))continue;
      let o=things.get(item.id);if(!o){o=makeThing(item.kind);things.set(item.id,o);}
      o.position.set(item.lane*2.3,0,-item.z);
    }
    hopBatch.count=hops;hopBatch.instanceMatrix.needsUpdate=true;
    renderer.render(scene,camera);
  }
  const lost=(event:Event)=>{event.preventDefault();onLost();};canvas.addEventListener('webglcontextlost',lost);
  resize();
  return {paint,resize,destroy:()=>{
    destroyed=true;canvas.removeEventListener('webglcontextlost',lost);
    instances.forEach(i=>i.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());environment?.dispose();
    renderer.dispose();renderer.forceContextLoss();scene.clear();things.clear();
  }};
  }catch{
    destroyed=true;instances.forEach(i=>i.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());environment?.dispose();renderer.dispose();renderer.forceContextLoss();return null;
  }
}
