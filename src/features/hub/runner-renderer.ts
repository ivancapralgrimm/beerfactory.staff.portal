import {jumpHeight,type RunState,type RunThing} from './runner-engine';

const colorNames=['sky','haze','wall','wallShade','floor','plank','seam','wood','woodLight',
  'copper','copperLight','copperShade','steel','steelShade','ink','paper','gold','amber',
  'green','leaf','glass','danger','shade'] as const;
type ColorName=typeof colorNames[number];
type Palette=Record<ColorName,string>;
export type RunnerPainter={paint:(s:RunState,reduced:boolean)=>void;resize:()=>void;destroy:()=>void};

/** Lightweight perspective Canvas 2D scene. All paint comes from the game theme. */
export function createPainter(canvas:HTMLCanvasElement,theme:HTMLElement):RunnerPainter|null {
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)return null;
  canvas.dataset.renderer='canvas2d';
  const style=getComputedStyle(theme),c=Object.fromEntries(colorNames.map(k=>[k,style.getPropertyValue('--run-'+k).trim()])) as Palette;
  const font=style.getPropertyValue('--run-font').trim();
  let w=390,h=560,dpr=1;
  const logo=new Image();let destroyed=false;
  logo.src=new URL('../beer/assets/logo-mug.webp',import.meta.url).href;
  let last:RunState|null=null,lastReduced=true;
  logo.onload=()=>{if(!destroyed&&last)paint(last,lastReduced);};
  function resize(){
    const bounds=canvas.getBoundingClientRect();w=Math.max(1,bounds.width);h=Math.max(1,bounds.height);
    dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  }
  function line(x1:number,y1:number,x2:number,y2:number,color:string,width=1){ctx!.beginPath();ctx!.moveTo(x1,y1);ctx!.lineTo(x2,y2);ctx!.strokeStyle=color;ctx!.lineWidth=width;ctx!.stroke();}
  function ellipse(x:number,y:number,rx:number,ry:number,color:string){ctx!.beginPath();ctx!.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx!.fillStyle=color;ctx!.fill();}
  function box(x:number,y:number,width:number,height:number,radius:number,color:string){ctx!.fillStyle=color;ctx!.beginPath();ctx!.roundRect(x,y,width,height,radius);ctx!.fill();}
  function poly(points:number[][],color:string){ctx!.beginPath();points.forEach(([x,y],i)=>i?ctx!.lineTo(x,y):ctx!.moveTo(x,y));ctx!.closePath();ctx!.fillStyle=color;ctx!.fill();}
  function project(lane:number,z:number){const p=1/(1+Math.max(-2,z)*.073);return {x:w/2+lane*w*.285*p,y:h*.265+h*.61*p,k:p*(w/390)};}
  function hop(x:number,y:number,k:number,angle=0){
    ctx!.save();ctx!.translate(x,y);ctx!.rotate(angle);ctx!.scale(k,k);
    ellipse(0,3,17,20,c.copperShade);ellipse(0,0,17,20,c.gold);ellipse(-2,-2,13,16,c.paper);
    for(let n=0;n<3;n++){
      ellipse(-4,(-9+n*7),5.5,7,c.green);ellipse(4,(-9+n*7),5.5,7,c.leaf);
    }
    line(0,-10,0,13,c.green,1.5);ctx!.restore();
  }
  function tank(x:number,y:number,k:number,side:number){
    ctx!.save();ctx!.translate(x,y);ctx!.scale(k,k);
    line(-37,0,-40,32,c.copperShade,9);line(37,0,40,32,c.copperShade,9);
    const fill=ctx!.createLinearGradient(-66,0,66,0);fill.addColorStop(0,c.copperShade);fill.addColorStop(.22,c.copper);fill.addColorStop(.43,c.copperLight);fill.addColorStop(.67,c.copper);fill.addColorStop(1,c.copperShade);
    ctx!.fillStyle=fill;ctx!.beginPath();ctx!.roundRect(-64,-204,128,204,[48,48,28,28]);ctx!.fill();
    ellipse(0,-177,64,17,c.copperLight);ellipse(0,-177,58,12,c.copper);
    line(-61,-130,61,-130,c.copperShade,5);line(-61,-42,61,-42,c.copperLight,5);
    box(-17,-137,34,34,17,c.steelShade);ellipse(0,-120,12,12,c.paper);line(0,-120,5,-125,c.ink,2);
    box(-17,-195,34,7,3,c.steel);
    for(const sy of [-130,-42])for(const sx of [-47,-28,28,47])ellipse(sx,sy,2.2,2.2,c.paper);
    line(side*65,-155,side*106,-155,c.steel,13);line(side*106,-155,side*106,-24,c.steel,13);
    line(side*65,-158,side*102,-158,c.paper,2);
    ctx!.restore();
  }
  function obstacle(item:RunThing){
    const {x,y,k}=project(item.lane,item.z);ctx!.save();ctx!.translate(x,y);ctx!.scale(k,k);
    ellipse(3,4,43,10,c.shade);
    if(item.kind==='barrel'){
      const fill=ctx!.createLinearGradient(-37,0,37,0);fill.addColorStop(0,c.wood);fill.addColorStop(.4,c.woodLight);fill.addColorStop(1,c.wood);
      ctx!.fillStyle=fill;ctx!.beginPath();ctx!.roundRect(-38,-53,76,53,17);ctx!.fill();
      ellipse(0,-48,37,10,c.woodLight);ellipse(0,-48,29,6,c.wood);
      for(const x of [-17,17])line(x,-43,x,-5,c.wood,2);
      box(-39,-37,78,6,2,c.steelShade);box(-38,-10,76,6,2,c.steel);
    }else if(item.kind==='beam'){
      box(-53,-139,11,139,5,c.steelShade);box(42,-139,11,139,5,c.steelShade);
      box(-58,-140,116,19,7,c.copperShade);box(-58,-140,116,12,6,c.gold);
      for(let x=-45;x<45;x+=25)poly([[x,-140],[x+10,-140],[x+19,-128],[x+9,-128]],c.ink);
    }else{
      box(-39,-115,78,115,5,c.wood);poly([[-39,-115],[-27,-129],[49,-129],[39,-115]],c.woodLight);
      poly([[39,-115],[49,-129],[49,-15],[39,0]],c.copperShade);
      for(const sy of [-109,-58,-7])box(-38,sy,76,5,1,c.woodLight);
      for(const x of [-30,25])box(x,-114,7,114,1,c.woodLight);
      line(-25,-96,29,-18,c.copperShade,6);line(29,-96,-25,-18,c.copperShade,6);
    }
    ctx!.restore();
  }
  function player(s:RunState,reduced:boolean){
    const p=project(s.x,0),air=jumpHeight(s),slide=s.slide>0,scale=w/390;
    ellipse(p.x,p.y+9,35*scale*(1-air*.35),9*scale,c.shade);
    ctx!.save();ctx!.translate(p.x,p.y-air*115*scale);
    ctx!.scale(scale,scale);if(slide){ctx!.translate(0,-14);ctx!.rotate(-.72);ctx!.scale(1,.67);}
    if(s.shield>0&&!reduced)ctx!.globalAlpha=.7+Math.sin(s.time*18)*.2;
    const run=s.phase==='running'&&!reduced?Math.sin(s.time*16):0;
    ctx!.translate(0,Math.abs(run)*-2);
    for(const side of [-1,1]){
      const lift=run*side*7;
      line(side*13,-14,side*20,5+lift,c.ink,9);box(side*20-10,1+lift,23,10,5,c.ink);
    }
    line(-28,-65,-45,-40+run*7,c.ink,7);ellipse(-45,-39+run*7,8,9,c.paper);
    line(28,-65,44,-42-run*7,c.ink,7);ellipse(44,-42-run*7,8,9,c.paper);
    ctx!.strokeStyle=c.copperLight;ctx!.lineWidth=10;ctx!.beginPath();ctx!.ellipse(35,-61,14,22,0,0,Math.PI*2);ctx!.stroke();
    ctx!.strokeStyle=c.glass;ctx!.lineWidth=4;ctx!.beginPath();ctx!.ellipse(35,-61,14,22,0,0,Math.PI*2);ctx!.stroke();
    const fill=ctx!.createLinearGradient(-30,0,30,0);fill.addColorStop(0,c.copperShade);fill.addColorStop(.2,c.gold);fill.addColorStop(.6,c.amber);fill.addColorStop(1,c.copper);
    ctx!.fillStyle=fill;ctx!.beginPath();ctx!.roundRect(-29,-110,58,96,[7,7,18,18]);ctx!.fill();
    for(const x of [-22,-10,4,18])box(x,-95,3,65,2,c.glass);
    ellipse(0,-106,29,8,c.paper);
    for(const [x,y,r] of [[-21,-113,12],[-9,-119,13],[7,-119,15],[22,-111,11],[-26,-101,7]])ellipse(x,y,r,r*.9,c.paper);
    for(const [x,y] of [[-17,-118],[3,-126],[18,-114],[-9,-108]])ellipse(x,y,2,2,c.gold);
    for(const side of [-1,1]){ellipse(side*11,-87,6.5,8,c.paper);ellipse(side*11+1,-86,3.8,5,c.ink);ellipse(side*11+2,-88,1.2,1.6,c.paper);}
    ctx!.strokeStyle=c.ink;ctx!.lineWidth=3;ctx!.beginPath();ctx!.arc(0,-72,8,0,Math.PI);ctx!.stroke();
    if(logo.complete&&logo.naturalWidth)ctx!.drawImage(logo,-15,-57,30,39);
    else{box(-16,-56,32,25,5,c.ink);ctx!.fillStyle=c.paper;ctx!.font='800 14px '+font;ctx!.textAlign='center';ctx!.fillText('BF',0,-38);}
    ctx!.restore();
  }
  function paint(s:RunState,reduced:boolean){
    last=s;lastReduced=reduced;ctx!.setTransform(dpr,0,0,dpr,0,0);
    const sky=ctx!.createLinearGradient(0,0,0,h*.72);sky.addColorStop(0,c.sky);sky.addColorStop(1,c.haze);ctx!.fillStyle=sky;ctx!.fillRect(0,0,w,h);
    poly([[0,0],[w*.4,h*.245],[w*.4,h*.52],[0,h*.7]],c.wallShade);
    poly([[w,0],[w*.6,h*.245],[w*.6,h*.52],[w,h*.7]],c.wall);
    // Roof trusses, brewery windows and warm daylight at the vanishing point.
    for(let n=1;n<6;n++){
      const q=n/6;line(0,h*.28*q,w*.4,h*.245,c.copperShade,Math.max(1,5*(1-q)));
      line(w,h*.28*q,w*.6,h*.245,c.copperShade,Math.max(1,5*(1-q)));
    }
    box(w*.415,h*.12,w*.17,h*.2,8,c.paper);
    line(w*.5,h*.12,w*.5,h*.32,c.wood,3);line(w*.415,h*.22,w*.585,h*.22,c.wood,3);
    ctx!.fillStyle=c.copperShade;ctx!.font='800 '+Math.round(w*.038)+'px '+font;ctx!.textAlign='center';ctx!.fillText('BEERFACTORY',w/2,h*.105);
    poly([[0,h*.53],[w*.41,h*.29],[w*.59,h*.29],[w,h*.53],[w,h],[0,h]],c.floor);
    const motion=s.distance%4;
    for(let n=22;n>=0;n--){
      const z=n*4-motion,p=project(0,z),next=project(0,z+4),half=w*.54/(1+Math.max(0,z)*.073),nextHalf=w*.54/(1+Math.max(0,z+4)*.073);
      poly([[w/2-half,p.y],[w/2-nextHalf,next.y],[w/2+nextHalf,next.y],[w/2+half,p.y]],n%2?c.plank:c.floor);
      line(w/2-half,p.y,w/2+half,p.y,c.seam,Math.max(1,p.k));
    }
    for(const edge of [-1.5,-.5,.5,1.5]){const a=project(edge,80),b=project(edge,-2);line(a.x,a.y,b.x,b.y,Math.abs(edge)===1.5?c.wood:c.seam,Math.abs(edge)===1.5?5:2);}
    for(let i=6;i>=0;i--){const z=i*16-s.distance%16,p=project(2.25,z);if(z>-3){tank(w-p.x,p.y,p.k,-1);tank(p.x,p.y,p.k,1);}}
    for(const item of [...s.things].sort((a,b)=>b.z-a.z)){
      if(item.resolved||item.z>95||item.z<-1.8)continue;
      if(item.kind==='hop'){const p=project(item.lane,item.z);hop(p.x,p.y-43*p.k,p.k,reduced?0:Math.sin(s.time*3+item.id)*.12);}
      else obstacle(item);
    }
    player(s,reduced);
    if(s.phase==='ready'){
      for(const [lane,z] of [[-1,25],[-1,32],[-1,39],[1,48]]){const p=project(lane,z);hop(p.x,p.y-43*p.k,p.k);}
      obstacle({id:-1,lane:1,z:22,kind:'barrel',resolved:false});
    }
  }
  resize();return {paint,resize,destroy:()=>{destroyed=true;logo.onload=null;logo.onerror=null;}};
}
