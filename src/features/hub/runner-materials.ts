import * as T from 'three';

type RGB=[number,number,number];
export type BreweryPalette=Record<string,string>;
type Bitmaps={wood:HTMLCanvasElement;woodBump:HTMLCanvasElement;brick:HTMLCanvasElement;brickBump:HTMLCanvasElement;copper:HTMLCanvasElement;copperRough:HTMLCanvasElement;beer:HTMLCanvasElement;foam:HTMLCanvasElement};
// Reuse CPU artwork across Hub → game, not GPU resources across contexts.
let cached:{key:string;images:Bitmaps}|null=null;
function rgb(value:string):RGB {const n=new T.Color(value).getHex(T.SRGBColorSpace);return [n>>16&255,n>>8&255,n&255];}
function mix(a:RGB,b:RGB,t:number):RGB{return a.map((v,i)=>Math.round(v+(b[i]-v)*Math.max(0,Math.min(1,t)))) as RGB;}
function noise(x:number,y:number,seed=0){let n=Math.imul(x+seed,374761393)^Math.imul(y+seed,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function surface(w:number,h:number,paint:(x:number,y:number)=>RGB){
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const context=canvas.getContext('2d');if(!context)throw new Error('texture_canvas_unavailable');
  const image=context.createImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const pixel=paint(x,y),i=(y*w+x)*4;image.data[i]=pixel[0];image.data[i+1]=pixel[1];image.data[i+2]=pixel[2];image.data[i+3]=255;
  }
  context.putImageData(image,0,0);return canvas;
}
function drawWood(c:BreweryPalette){
  const base=rgb(c.floor),dark=rgb(c.wood),light=rgb(c.woodLight),seam=rgb(c.seam);
  const pattern=(x:number,y:number)=>{
    const board=Math.floor(x/128),u=x%128,v=(y+board*173)%512;
    const grain=Math.sin(u*.58+Math.sin(y*Math.PI/256+board)*2.4+Math.sin(y*Math.PI/64+board)*.5);
    const knotY=(y-(180+board*213)+1024)%1024-512;
    const knotR=Math.hypot((u-57)/17,knotY/43),knot=Math.exp(-knotR*1.8);
    const rings=Math.sin(knotR*17)*knot;
    const variation=noise(board,Math.floor((y+board*173)/512),11)*.12;
    const edge=u<2||v<3,bevel=u<4||v<5;
    const detail=(noise(x,y,17)-.5)*.035+grain*.024+rings*.035;
    return {edge,bevel,knot,detail,variation};
  };
  const wood=surface(512,1024,(x,y)=>{
    const p=pattern(x,y);if(p.edge)return mix(dark,seam,.5);
    let color=mix(base,light,.17+p.variation+p.detail);color=mix(color,dark,p.knot*.45+Math.max(0,-p.detail));
    return p.bevel?mix(color,light,.25):color;
  });
  const bump=surface(512,1024,(x,y)=>{
    const p=pattern(x,y),v=p.edge?70:p.bevel?145:174+p.detail*150-p.knot*8;return [v,v,v];
  });
  const a=wood.getContext('2d')!,b=bump.getContext('2d')!;
  for(let col=0;col<4;col++)for(let row=-1;row<3;row++)for(const side of [10,117]){
    const x=col*128+side,y=row*512-col*173+14;if(y<0||y>1024)continue;
    for(const [ctx,paint] of [[a,c.wood],[b,'rgb(100,100,100)']] as const){ctx.fillStyle=paint;ctx.beginPath();ctx.ellipse(x,y,2,2.6,0,0,Math.PI*2);ctx.fill();}
  }
  return {wood,woodBump:bump};
}
function drawBrick(c:BreweryPalette){
  const base=rgb(c.brick),light=rgb(c.wall),mortar=rgb(c.mortar),dark=rgb(c.brickShade);
  const pattern=(x:number,y:number)=>{const row=Math.floor(y/64),u=(x+(row%2)*64)%128,v=y%64;return {u,v,row,col:Math.floor((x+(row%2)*64)/128),grit:noise(x,y,4),edge:Math.min(u,127-u,v,63-v)};};
  return {
    brick:surface(512,512,(x,y)=>{
      const p=pattern(x,y);if(p.edge<2)return mix(mortar,dark,p.grit*.08);
      const value=noise(p.col,p.row,19),paint=mix(base,value>.45?light:dark,Math.abs(value-.45)*.33+(p.grit-.5)*.08);
      return p.edge<4?mix(paint,light,.17):paint;
    }),
    brickBump:surface(512,512,(x,y)=>{const p=pattern(x,y),v=p.edge<2?64:p.edge<4?128:185+(p.grit-.5)*28;return [v,v,v];}),
  };
}
function createBitmaps(c:BreweryPalette):Bitmaps {
  const base=rgb(c.copper),gold=rgb(c.copperLight),dark=rgb(c.copperShade),patina=rgb(c.steelShade);
  const beerBottom=rgb(c.amberDeep),beerTop=rgb(c.amber),beerShine=rgb(c.gold);
  return {...drawWood(c),...drawBrick(c),
    copper:surface(256,256,(x,y)=>{
      const brush=(noise(Math.floor(x/3),y,7)-.5)*.025,hammer=noise(Math.floor(x/9),Math.floor(y/7),13);
      const seam=y<7||y>248,oxide=(y<35||y>230)&&hammer>.78;
      let paint=mix(base,hammer>.5?gold:dark,Math.abs(hammer-.5)*.1+Math.abs(brush));
      if(seam)paint=mix(paint,dark,.12);return oxide?mix(paint,patina,.15):paint;
    }),
    copperRough:surface(256,256,(x,y)=>{const v=170+noise(Math.floor(x/6),Math.floor(y/5),11)*44+(noise(x,y)-.5)*12;return [v,v,v];}),
    beer:surface(128,256,(x,y)=>{
      const body=mix(beerTop,beerBottom,Math.pow(y/255,1.5)*.55);return mix(body,beerShine,(Math.sin(x*Math.PI/64)+1)*.035);
    }),
    foam:surface(128,128,(x,y)=>{const v=205+noise(x,y,8)*38;return [v,v,v];}),
  };
}
export function createBreweryMaps(c:BreweryPalette,renderer:T.WebGLRenderer,track:(texture:T.Texture)=>void){
  const key=JSON.stringify(c);if(!cached||cached.key!==key)cached={key,images:createBitmaps(c)};
  const texture=(name:keyof Bitmaps,colored=true,x=1,y=1)=>{
    const t=new T.CanvasTexture(cached!.images[name]);t.colorSpace=colored?T.SRGBColorSpace:T.NoColorSpace;
    t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(x,y);t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());track(t);return t;
  };
  return {floor:texture('wood',true,8,20),floorBump:texture('woodBump',false,8,20),
    wood:texture('wood'),woodBump:texture('woodBump',false),
    brick:texture('brick',true,40,5),brickBump:texture('brickBump',false,40,5),
    copper:texture('copper'),copperRough:texture('copperRough',false),beer:texture('beer'),foam:texture('foam',false)};
}
