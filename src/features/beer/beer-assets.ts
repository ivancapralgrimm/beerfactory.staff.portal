import mugFront from './assets/beer-front-mug.webp';
import wheatFront from './assets/beer-front-wheat.webp';
import snifterFront from './assets/beer-front-snifter.webp';
import chaliceFront from './assets/beer-front-chalice.webp';
import mugLogo from './assets/logo-mug.webp';
import wheatLogo from './assets/logo-wheat.webp';
import snifterLogo from './assets/logo-snifter.webp';
import chaliceLogo from './assets/logo-chalice.webp';
import mug from './assets/glass-mug.webp';
import wheat from './assets/glass-wheat.webp';
import snifter from './assets/glass-snifter.webp';
import chalice from './assets/glass-chalice.webp';
import foam from './assets/foam-photo.webp';
import grain from './assets/micrograin.webp';
import entry from './assets/beer-entry.webp';
import hellesFull from './assets/beer-full-helles.webp';
import pilsnerFull from './assets/beer-full-pilsner.webp';
import wheatFull from './assets/beer-full-weissbier.webp';
import marzenFull from './assets/beer-full-marzen.webp';
import dunkelFull from './assets/beer-full-dunkel.webp';
import ipaFull from './assets/beer-full-ipa.webp';
import cherryFull from './assets/beer-full-cherry.webp';
import mugFoam from './assets/beer-foam-mug.webp';
import wheatFoam from './assets/beer-foam-wheat.webp';
import snifterFoam from './assets/beer-foam-snifter.webp';
import chaliceFoam from './assets/beer-foam-chalice.webp';
import geometry from './assets/glass-geometry.json';
import type {BeerId,GlassKind} from './beer-data';
export interface GlassGeometry {width:number;height:number;levels:number[][];top:number;bottom:number;fullSurface?:number;foamTop?:number;asset:string;provenance:string;source:string}
export const vessels=geometry as Record<GlassKind,GlassGeometry>;
export const assetUrls={logo:{mug:mugLogo,wheat:wheatLogo,snifter:snifterLogo,chalice:chaliceLogo},front:{mug:mugFront,wheat:wheatFront,snifter:snifterFront,chalice:chaliceFront},glass:{mug,wheat,snifter,chalice},foam,grain,entry,full:{helles:hellesFull,pilsner:pilsnerFull,weissbier:wheatFull,marzen:marzenFull,dunkel:dunkelFull,ipa:ipaFull,cherry:cherryFull},head:{mug:mugFoam,wheat:wheatFoam,snifter:snifterFoam,chalice:chaliceFoam}};
const cache=new Map<string,Promise<HTMLImageElement>>();
function image(url:string){let pending=cache.get(url);if(!pending){pending=new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>{img.onload=null;img.onerror=null;resolve(img);};img.onerror=()=>{cache.delete(url);img.onload=null;img.onerror=null;reject(new Error('Не удалось загрузить изображение бокала.'));};img.src=url;});cache.set(url,pending);}return pending;}
export async function loadBeerImages(kind:GlassKind,id:BeerId){const [glass,foam,grain,logo,full,head,front]=await Promise.all([image(assetUrls.glass[kind]),image(assetUrls.foam),image(assetUrls.grain),image(assetUrls.logo[kind]),image(assetUrls.full[id]),image(assetUrls.head[kind]),image(assetUrls.front[kind])]);return {glass,foam,grain,logo,full,head,front};}
export type BeerImages=Awaited<ReturnType<typeof loadBeerImages>>;
