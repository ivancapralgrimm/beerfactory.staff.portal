import {useEffect,useRef,useState} from 'react';
import {createRun} from './runner-engine';
import {createPainter} from './runner-renderer';
import {createWebGLPainter} from './runner-webgl';

/** A real static render of the game world, not a separate marketing mockup. */
export function RunnerScene(){
  const canvas=useRef<HTMLCanvasElement>(null);
  const [simple,setSimple]=useState(false);
  useEffect(()=>{
    const element=canvas.current;if(!element)return;
    const painter=simple?createPainter(element,element):createWebGLPainter(element,element,()=>setSimple(true));
    if(!painter){if(!simple)setSimple(true);return;}
    const state=createRun(),draw=()=>{painter.resize();painter.paint(state,true);};
    const observer=new ResizeObserver(draw);observer.observe(element);draw();
    return()=>{observer.disconnect();painter.destroy();};
  },[simple]);
  return <canvas key={String(simple)} ref={canvas} className="runner-preview" role="img" aria-label="Кружка-маскот BeerFactory на дорожках между медными варочными чанами"/>;
}
