import {useEffect,useRef,useState} from 'react';
import type {Beer} from './beer-data';
import {loadBeerImages,vessels} from './beer-assets';
import {ANIMATION_LIFETIME_MS,createBeerRenderer,SCENE_WIDTH,SCENE_HEIGHT} from './beer-renderer';
export function BeerGlass({beer,replay,instant}:{beer:Beer;replay:number;instant:boolean}){
 const canvasRef=useRef<HTMLCanvasElement>(null),figureRef=useRef<HTMLDivElement>(null);
 const[status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const canvas=canvasRef.current,element=figureRef.current;if(!canvas||!element)return;
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');let cancelled=false,raf=0,elapsed=0,last=0,lastPaint=-100,visible=true,draw:ReturnType<typeof createBeerRenderer>|undefined;const ctx=canvas.getContext('2d');
  const stop=()=>{cancelAnimationFrame(raf);raf=0;last=0;};
  function paint(staticFrame=false){if(!ctx||!draw)return;const frame=draw(ctx,elapsed,staticFrame);canvas!.dataset.phase=frame.phase;canvas!.dataset.beer=beer.id;canvas!.dataset.fill=frame.fill.toFixed(3);}
  function tick(time:number){raf=0;if(cancelled||document.hidden||!visible)return;if(last)elapsed+=Math.min(64,time-last);last=time;if(time-lastPaint>=1000/30){paint();lastPaint=time;}if(elapsed<ANIMATION_LIFETIME_MS)raf=requestAnimationFrame(tick);else{paint(true);canvas!.dataset.sleeping='true';}}
  function resume(){if(draw&&!cancelled&&!document.hidden&&visible&&!raf&&!media.matches&&!instant&&elapsed<ANIMATION_LIFETIME_MS){last=0;raf=requestAnimationFrame(tick);}}
  function onVisibility(){if(document.hidden)stop();else resume();}
  function onMotion(){stop();if(media.matches||instant)paint(true);else{elapsed=ANIMATION_LIFETIME_MS;paint(true);}}
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;if(visible)resume();else stop();},{threshold:.01});observer?.observe(element);
  document.addEventListener('visibilitychange',onVisibility);media.addEventListener('change',onMotion);
  setStatus('loading');if(ctx)ctx.clearRect(0,0,SCENE_WIDTH,SCENE_HEIGHT);canvas.dataset.phase='loading';canvas.dataset.beer=beer.id;canvas.dataset.sleeping='false';
  if(!ctx){setStatus('error');}else loadBeerImages(beer.glass,beer.id).then(images=>{if(cancelled)return;draw=createBeerRenderer(beer,vessels[beer.glass],images);setStatus('ready');paint(media.matches||instant);resume();}).catch(()=>{if(!cancelled)setStatus('error');});
  return()=>{cancelled=true;stop();observer?.disconnect();document.removeEventListener('visibilitychange',onVisibility);media.removeEventListener('change',onMotion);};
 },[beer.id,beer.glass,replay,instant,retry]);
 return <div ref={figureRef} className="bc-glass" data-glass-kind={beer.glass}>
  <div className="bc-glass-shadow" aria-hidden="true"/>
  <canvas ref={canvasRef} width={SCENE_WIDTH} height={SCENE_HEIGHT} role="img" aria-label={`${beer.name}: ${beer.appearance.note}. ${beer.glass==='mug'?'Фирменная кружка BeerFactory':beer.glass==='wheat'?'Фирменный высокий бокал BeerFactory':'Бокал на ножке, реконструкция по методичке'}.`}/>
  {status==='loading'&&<p className="bc-asset-status" role="status">Готовим бокал…</p>}
  {status==='error'&&<div className="bc-asset-error" role="status"><p>Не удалось загрузить бокал. Описание сорта доступно ниже.</p><button type="button" onClick={()=>setRetry(n=>n+1)}>Загрузить ещё раз</button></div>}
 </div>;
}
