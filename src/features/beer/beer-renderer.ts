import type {Beer} from './beer-data';
import type {BeerImages,GlassGeometry} from './beer-assets';
export const SCENE_WIDTH=600,SCENE_HEIGHT=960,POUR_MS=2200,ANIMATION_LIFETIME_MS=6800;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const random=(i:number)=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n);};
export function sectionAt(g:GlassGeometry,y:number):[number,number]{
 const levels=g.levels;if(y<=levels[0][0])return [levels[0][1],levels[0][2]];
 for(let i=1;i<levels.length;i++){const b=levels[i],a=levels[i-1];if(y<=b[0]){const p=clamp((y-a[0])/(b[0]-a[0]));return [a[1]+(b[1]-a[1])*p,a[2]+(b[2]-a[2])*p];}}
 return [levels.at(-1)![1],levels.at(-1)![2]];
}
export function innerPath(g:GlassGeometry):Path2D{
 const p=new Path2D(),rows=g.levels;p.moveTo(rows[0][1],rows[0][0]);
 for(let i=1;i<rows.length;i++)p.lineTo(rows[i][1],rows[i][0]);
 const last=rows.at(-1)!;p.quadraticCurveTo((last[1]+last[2])/2,g.bottom+14,last[2],last[0]);
 for(let i=rows.length-2;i>=0;i--)p.lineTo(rows[i][2],rows[i][0]);p.closePath();return p;
}
export function pourProgress(elapsed:number){const p=clamp((elapsed-200)/POUR_MS);return p*p*(3-2*p);}
/** Volume-aware, uses section area rather than a constant vertical reveal. */
export function volumeLevels(g:GlassGeometry,foamHeight:number){
 const top=g.fullSurface??(g.top+foamHeight*.9),bottom=g.bottom,rows:{y:number;volume:number}[]=[];let volume=0;
 for(let y=bottom;y>=top;y-=2){const [l,r]=sectionAt(g,y);volume+=Math.max(0,r-l)**2;rows.push({y,volume});}
 return {rows,total:volume,top,bottom};
}
export function surfaceLevel(table:ReturnType<typeof volumeLevels>,fill:number){const wanted=table.total*clamp(fill);return table.rows.find(x=>x.volume>=wanted)?.y??table.top;}
/** The empty photograph is the sole permanent glass shell. Full photographs may
 * only contribute inside the measured liquid aperture; never swap the vessel. */
export function createBeerRenderer(beer:Beer,g:GlassGeometry,images:BeerImages){
 const glassPath=innerPath(g),headHeight=(g.fullSurface??g.top+beer.appearance.foamHeight)-(g.foamTop??g.top);
 const table=volumeLevels(g,headHeight);
 function bubbles(ctx:CanvasRenderingContext2D,surface:number,life:number,opacity:number){
  if(opacity<=0)return;ctx.save();ctx.clip(glassPath);ctx.globalAlpha*=opacity;
  for(let i=0;i<Math.min(14,Math.round(beer.appearance.bubbles/3));i++){
   const span=g.bottom-g.top,y=g.bottom-((life*(25+random(i+90)*37)+random(i+61)*span)%span);
   if(y<surface+15||y>g.bottom-12)continue;
   const[l,r]=sectionAt(g,y),xx=l+12+random(i+21)*Math.max(1,r-l-24)+Math.sin(life*1.8+i)*1.5,radius=.65+random(i+88)*1.25;
   ctx.beginPath();ctx.ellipse(xx,y,radius,radius*1.15,0,0,Math.PI*2);ctx.strokeStyle='rgba(255,244,213,.32)';ctx.lineWidth=.65;ctx.stroke();
  }ctx.restore();
 }
 return function draw(ctx:CanvasRenderingContext2D,elapsed:number,staticFrame=false){
  const fill=staticFrame?1:pourProgress(elapsed),surface=surfaceLevel(table,fill),life=staticFrame?0:elapsed/1000;
  const agitation=staticFrame?0:Math.sin(Math.PI*clamp((elapsed-200)/POUR_MS));
  const breath=staticFrame?0:1-clamp((elapsed-POUR_MS-1000)/2200);
  ctx.clearRect(0,0,SCENE_WIDTH,SCENE_HEIGHT);ctx.save();ctx.globalAlpha=staticFrame?1:clamp(elapsed/140);
  ctx.drawImage(images.glass,0,0,SCENE_WIDTH,SCENE_HEIGHT);
   if(fill>.001){
    ctx.save();ctx.clip(glassPath);const wave=Math.sin(life*6.4)*agitation*2.2;
    const liquid=new Path2D();liquid.moveTo(0,surface+wave);liquid.bezierCurveTo(190,surface-3*agitation,395,surface+3*agitation,600,surface-wave);liquid.lineTo(600,SCENE_HEIGHT);liquid.lineTo(0,SCENE_HEIGHT);liquid.closePath();
    ctx.save();ctx.clip(liquid);ctx.drawImage(images.full,0,0,SCENE_WIDTH,SCENE_HEIGHT);ctx.restore();bubbles(ctx,surface,life,breath*.7);
    const[l,r]=sectionAt(g,surface),width=r-l,h=headHeight*Math.pow(fill,.65),top=surface-h,tilt=wave*.6,depth=Math.max(3,width*.057),cx=(l+r)/2;
    // A rounded top disc and a curved front face share real photographic foam grain.
    const froth=new Path2D();froth.moveTo(l-2,top+tilt);froth.bezierCurveTo(l+width*.18,top+depth,r-width*.18,top+depth,r+2,top-tilt);froth.lineTo(r+2,surface);froth.bezierCurveTo(r-width*.18,surface+depth*.6,l+width*.16,surface+depth*.7,l-2,surface);froth.closePath();
    ctx.save();ctx.clip(froth);ctx.drawImage(images.head,l-3,top-depth,width+6,h+depth*2);
    const shade=ctx.createLinearGradient(l,0,r,0);shade.addColorStop(0,'#39251145');shade.addColorStop(.23,'#33201000');shade.addColorStop(.75,'#33201000');shade.addColorStop(1,'#29160945');ctx.fillStyle=shade;ctx.fillRect(l-4,top-depth,width+8,h+depth*2);ctx.restore();
    ctx.save();ctx.beginPath();ctx.ellipse(cx,top,width/2,depth,0,0,Math.PI*2);ctx.clip();ctx.drawImage(images.head,l,top-depth,width,depth*2);ctx.fillStyle='#fff6de12';ctx.fillRect(l,top-depth,width,depth*2);ctx.restore();
    // Actual softbox/ridge reflections stay in front of the rising foam, preserving glass volume.
    ctx.save();ctx.beginPath();ctx.rect(0,top-depth-2,SCENE_WIDTH,h+depth*2+6);ctx.clip();ctx.drawImage(images.front,0,0,SCENE_WIDTH,SCENE_HEIGHT);ctx.restore();ctx.restore();
    const endBlend=clamp((fill-.975)/.024);
    // Settle photographic foam only within the fixed inner aperture. The rim,
    // walls, stem and foot keep the exact same source pixels throughout the pour.
    if(endBlend>0){ctx.save();ctx.clip(glassPath);ctx.globalAlpha*=endBlend;ctx.drawImage(images.full,0,0,SCENE_WIDTH,SCENE_HEIGHT);ctx.restore();}
   }
  if(images.logo)ctx.drawImage(images.logo,0,0,SCENE_WIDTH,SCENE_HEIGHT);
  ctx.restore();return {fill,phase:fill<.001?'empty':fill<.999?'pouring':'full'};
 };
}
