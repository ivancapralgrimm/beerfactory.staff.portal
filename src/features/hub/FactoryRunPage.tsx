import {useCallback,useEffect,useRef,useState,type PointerEvent} from 'react';
import {WarmBack} from '@/components/warm/WarmBack';
import {WarmIcon} from '@/components/warm/WarmIcon';
import {act,beginRun,createRun,pauseRun,tick,type RunAction,type RunPhase} from './runner-engine';
import {createPainter} from './runner-renderer';
import {createWebGLPainter} from './runner-webgl';
import './runner.css';

const BEST_KEY='bfstaff-factory-run-best-v1';
type Snapshot={phase:RunPhase;score:number;hops:number;lives:number;distance:number;lane:number;motion:'run'|'jump'|'slide';event:string};
function readBest(){try{const n=Number(localStorage.getItem(BEST_KEY));return Number.isFinite(n)&&n>0?Math.floor(n):0;}catch{return 0;}}
const initial:Snapshot={phase:'ready',score:0,hops:0,lives:3,distance:0,lane:0,motion:'run',event:''};

export function FactoryRunPage(){
  const root=useRef<HTMLElement>(null),canvas=useRef<HTMLCanvasElement>(null),panelAction=useRef<HTMLButtonElement>(null);
  const focusPanel=useRef(false);
  const state=useRef(createRun()),gesture=useRef<{id:number;x:number;y:number}|null>(null);
  const [snap,setSnap]=useState(initial),[best,setBest]=useState(readBest),[graphicsError,setGraphicsError]=useState(false),[help,setHelp]=useState(false);
  const [simple,setSimple]=useState(false);
  const [graphicsReady,setGraphicsReady]=useState(false);
  const bestRef=useRef(best),repaint=useRef<()=>void>(()=>{});
  const sync=useCallback(()=>{
    const s=state.current;
    setSnap({phase:s.phase,score:s.score,hops:s.hops,lives:s.lives,distance:Math.floor(s.distance),lane:s.lane,motion:s.jump>0?'jump':s.slide>0?'slide':'run',event:s.time<s.eventUntil?s.event:''});
  },[]);
  const pause=useCallback((moveFocus=false)=>{focusPanel.current=moveFocus;pauseRun(state.current);sync();repaint.current();},[sync]);
  const action=useCallback((a:RunAction)=>{act(state.current,a);sync();},[sync]);
  function start(){
    const seed=crypto.getRandomValues(new Uint32Array(1))[0];
    state.current=beginRun(seed);setHelp(false);sync();
    repaint.current();
    canvas.current?.focus({preventScroll:true});
  }
  function resume(){state.current.phase='running';sync();repaint.current();canvas.current?.focus({preventScroll:true});}
  useEffect(()=>{
    const el=canvas.current,theme=root.current;if(!el||!theme)return;
    const painter=simple?createPainter(el,theme):createWebGLPainter(el,theme,()=>{setGraphicsReady(false);pause();setSimple(true);});
    if(!painter){if(!simple){pause();setSimple(true);}else setGraphicsError(true);return;}
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    let raf=0,last=0,lastUI=0,disposed=false;
    const draw=()=>painter.paint(state.current,media.matches);
    const resize=()=>{painter.resize();draw();};
    repaint.current=()=>{draw();if(!raf&&state.current.phase==='running'){last=0;raf=requestAnimationFrame(animate);}};
    function animate(now:number){
      if(disposed)return;
      if(state.current.phase==='running'){
        // Blur/visibility pauses explicitly. Clamp a slow render or GC frame
        // rather than teleporting or forcing the player into a pause loop.
        tick(state.current,last?(now-last)/1000:0);
        draw();
        if(state.current.lives===0){
          if(state.current.score>bestRef.current){
            bestRef.current=state.current.score;setBest(bestRef.current);
            try{localStorage.setItem(BEST_KEY,String(bestRef.current));}catch{/* A denied store does not stop the game. */}
          }
          sync();
        }else if(now-lastUI>100){sync();lastUI=now;}
      }
      last=now;raf=state.current.phase==='running'?requestAnimationFrame(animate):0;
    }
    const observer=new ResizeObserver(resize);observer.observe(el);resize();setGraphicsReady(true);
    const hidden=()=>{if(document.hidden)pause();};
    const blur=()=>pause();
    const outside=(e:Event)=>{if(!theme.contains(e.target as Node))pause();};
    const keys=(e:KeyboardEvent)=>{
      if(e.metaKey||e.ctrlKey||e.altKey)return;
      const target=e.target as HTMLElement;
      if(target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(e.key==='Escape'){pause(true);return;}
      // Preserve normal Space/Enter activation of focused controls.
      if(target.closest('button,a'))return;
      if(e.code==='Space'&&state.current.phase==='paused'){e.preventDefault();resume();return;}
      const a:RunAction|undefined=({ArrowLeft:'left',a:'left',ф:'left',ArrowRight:'right',d:'right',в:'right',ArrowUp:'jump',w:'jump',ц:'jump',' ':'jump',ArrowDown:'slide',s:'slide',ы:'slide'} as Record<string,RunAction>)[e.key];
      if(a&&state.current.phase==='running'){e.preventDefault();if(!e.repeat)action(a);}
    };
    window.addEventListener('keydown',keys);window.addEventListener('blur',blur);
    document.addEventListener('visibilitychange',hidden);document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);
    media.addEventListener('change',resize);
    return()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();painter.destroy();repaint.current=()=>{};
      window.removeEventListener('keydown',keys);window.removeEventListener('blur',blur);
      document.removeEventListener('visibilitychange',hidden);document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);media.removeEventListener('change',resize);};
  },[action,pause,sync,simple]);
  useEffect(()=>{if(snap.phase==='over'||snap.phase==='paused'&&focusPanel.current)panelAction.current?.focus({preventScroll:true});},[snap.phase]);
  function pointerDown(e:PointerEvent<HTMLCanvasElement>){
    if(!e.isPrimary||e.button!==0)return;
    gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({preventScroll:true});
  }
  function pointerUp(e:PointerEvent<HTMLCanvasElement>){
    const g=gesture.current;gesture.current=null;if(!g||g.id!==e.pointerId)return;
    const x=e.clientX-g.x,y=e.clientY-g.y;if(Math.max(Math.abs(x),Math.abs(y))<22){action('jump');return;}
    action(Math.abs(x)>Math.abs(y)?x<0?'left':'right':y<0?'jump':'slide');
  }
  const running=snap.phase==='running';
  return <section className="factory-run runner-page" ref={root}>
    <WarmBack to="/hub" label="В Hub"/>
    <div className="runner-title"><h1>Factory Run</h1><span>Рекорд на устройстве <strong>{best.toLocaleString('ru-RU')}</strong></span></div>
    <div className="runner-frame" data-phase={snap.phase} data-motion={snap.motion}>
      <canvas key={String(simple)} ref={canvas} tabIndex={0} className="runner-canvas" role="img" aria-label={`Игровое поле. Дорожка ${snap.lane+2} из трёх.`} aria-describedby="runner-instructions"
        onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={()=>{gesture.current=null;}}>
        Игра требует браузер с поддержкой Canvas 2D. Используйте актуальный браузер.
      </canvas>
      <div className="runner-hud"><div className="runner-score"><span>Счёт</span><strong>{snap.score.toLocaleString('ru-RU')}</strong></div><div className="runner-stats"><span>Хмель <strong>{snap.hops}</strong></span><span aria-label={`Осталось попыток: ${snap.lives}`} className="runner-lives">{[0,1,2].map(n=><span key={n} data-full={n<snap.lives}><WarmIcon name="beer" size={20}/></span>)}</span></div>
        {running&&<button type="button" className="runner-pause" onClick={()=>pause(true)}>Пауза</button>}
      </div>
      {snap.phase!=='running'&&<div className="runner-panel" role={snap.phase==='paused'?'dialog':undefined} aria-label={snap.phase==='paused'?'Игра на паузе':undefined}>
        <span className="runner-panel-mark"><WarmIcon name="beer" size={28}/></span>
        <h2>{snap.phase==='ready'?'Твой рейс по пивоварне':snap.phase==='paused'?'Небольшая пауза':'Рейс завершён'}</h2>
        <p>{snap.phase==='ready'?'Собирай хмель. Перепрыгивай бочки, под трубами используй подкат.':snap.phase==='paused'?'Продолжим с того же места.':`${snap.distance} метров и ${snap.hops} шишек хмеля. Ещё один рейс?`}</p>
        {graphicsError?<p role="alert">Не удалось открыть игровую сцену. Попробуй другой браузер.</p>:<button ref={panelAction} type="button" className="runner-primary" disabled={!graphicsReady} onClick={snap.phase==='paused'?resume:start}>{!graphicsReady?'Готовим рейс…':snap.phase==='ready'?'Поехали':snap.phase==='paused'?'Продолжить':'Ещё раз'}<WarmIcon name="chevron" size={21}/></button>}
        <button type="button" className="runner-help-toggle" aria-expanded={help} aria-controls="runner-help" onClick={()=>setHelp(!help)}>{help?'Скрыть управление':'Как управлять'}</button>
        {help&&<p id="runner-help" className="runner-help">Свайп влево или вправо: смена дорожки. Вверх или короткое касание: прыжок. Вниз: подкат. На компьютере: стрелки или WASD, пробел и Escape.</p>}
      </div>}
      {running&&snap.event&&<p className="runner-event" role="status">{snap.event}</p>}
      <div className="runner-ground-label" aria-hidden="true">Пивоварня BeerFactory</div>
    </div>
    <p id="runner-instructions" className="runner-footnote">Свайп в сторону: дорожка. Вверх: прыжок. Вниз: подкат.</p>
  </section>;
}
