import {useEffect,useRef,useState,type ReactNode,type KeyboardEvent,type PointerEvent} from 'react';
import {beers,beerIndex,wrappedIndex,glassLabels} from './beer-data';
import {BeerGlass} from './BeerGlass';
import {BeerIcon} from './BeerIcon';
import {vessels} from './beer-assets';
import './beer-collection.css';
export interface BeerCollectionProps {backControl?:ReactNode;initialBeer?:string;onBeerChange?:(id:string)=>void}
export function BeerCollectionPage({backControl,initialBeer,onBeerChange}:BeerCollectionProps){
 const [index,setIndex]=useState(()=>beerIndex(initialBeer)),[replay,setReplay]=useState(0),[instant,setInstant]=useState(false),[tab,setTab]=useState<'taste'|'guest'>('taste');
 const indexRef=useRef(index);
 const beer=beers[index],namesRef=useRef<HTMLDivElement>(null),headingRef=useRef<HTMLHeadingElement>(null),gesture=useRef<{x:number;y:number;id:number}|null>(null);
 useEffect(()=>{headingRef.current?.focus({preventScroll:true});},[]);
 useEffect(()=>{const scroller=namesRef.current,button=scroller?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');if(scroller&&button)scroller.scrollTo({left:button.offsetLeft-scroller.offsetLeft-(scroller.clientWidth-button.offsetWidth)/2,behavior:'instant'});},[index]);
 function select(next:number|((current:number)=>number),keyboard=false){const n=wrappedIndex(typeof next==='function'?next(indexRef.current):next);indexRef.current=n;setIndex(n);setReplay(x=>x+1);setInstant(keyboard);onBeerChange?.(beers[n].id);}
 function keyNav(e:KeyboardEvent){let next:number|undefined;if(e.key==='ArrowRight')next=indexRef.current+1;if(e.key==='ArrowLeft')next=indexRef.current-1;if(e.key==='Home')next=0;if(e.key==='End')next=beers.length-1;if(next!==undefined){e.preventDefault();select(next,true);}}
 function pointerDown(e:PointerEvent){if(e.pointerType==='mouse'&&e.button!==0||((e.target as Element).closest('button,a')))return;gesture.current={x:e.clientX,y:e.clientY,id:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);}
 function pointerUp(e:PointerEvent){const start=gesture.current;gesture.current=null;if(!start||start.id!==e.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)>=44&&Math.abs(dx)>Math.abs(dy)*1.35)select(current=>current+(dx<0?1:-1));}
 function tabKeys(e:KeyboardEvent){if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'taste':e.key==='End'?'guest':tab==='taste'?'guest':'taste';setTab(next);e.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();}
 return <section className="bc" aria-labelledby="bc-title">
  <header className="bc-heading">{backControl}<div><h1 id="bc-title" ref={headingRef} tabIndex={-1}>Пивная карта</h1><p>BeerFactory · семь вкусов в деталях</p></div></header>
  <div className="bc-layout">
   <div className="bc-presentation">
    <div className="bc-stage" role="region" aria-label="Бокал. Свайп или стрелки переключают сорт" tabIndex={0} onKeyDown={keyNav} onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={()=>gesture.current=null}>
     <span className="bc-scene-count" aria-hidden="true">{index+1} / {beers.length}</span>
     <div className="bc-studio-light" aria-hidden="true"/>
     <BeerGlass beer={beer} replay={replay} instant={instant}/>
     <div className="bc-counter" aria-hidden="true"/>
     <button type="button" className="bc-scene-arrow bc-prev" aria-label="Предыдущий сорт" onClick={e=>select(current=>current-1,e.detail===0)}><BeerIcon name="back"/></button>
     <button type="button" className="bc-scene-arrow bc-next" aria-label="Следующий сорт" onClick={e=>select(current=>current+1,e.detail===0)}><BeerIcon name="arrow"/></button>
     <button type="button" className="bc-replay" onClick={e=>{setInstant(e.detail===0);setReplay(n=>n+1);}}>Налить ещё раз</button>
    </div>
    <div className="bc-sort-names" ref={namesRef} role="group" aria-label="Выбрать сорт" onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const n=wrappedIndex(indexRef.current+(e.key==='ArrowRight'?1:-1));select(n,true);namesRef.current?.querySelector<HTMLButtonElement>(`[data-beer="${beers[n].id}"]`)?.focus();}}}>
     {beers.map((item,i)=><button type="button" key={item.id} data-beer={item.id} aria-pressed={index===i} onClick={e=>select(i,e.detail===0)}><span className="bc-beer-dot" aria-hidden="true" style={{background:item.appearance.body}}/>{item.name}{index===i&&<BeerIcon name="check" size={15}/>}</button>)}
    </div>
   </div>
   <article className="bc-information" aria-labelledby="bc-beer-name">
    <div className="bc-name-row"><h2 id="bc-beer-name">{beer.name}</h2>{beer.seasonal&&<span className="bc-seasonal">Сезонный*</span>}</div>
    <p className="bc-style">{beer.style} · {beer.type}</p>
    <dl className="bc-facts"><div><dt>Крепость</dt><dd>{beer.alcohol}</dd></div><div><dt>Плотность</dt><dd>{beer.density??'Не указана'}</dd></div></dl>
    <div className="bc-tabs" role="tablist" aria-label="Описание сорта" onKeyDown={tabKeys}>
     <button type="button" id="bc-tab-taste" data-tab="taste" role="tab" aria-selected={tab==='taste'} tabIndex={tab==='taste'?0:-1} aria-controls="bc-panel-taste" onClick={()=>setTab('taste')}>О сорте</button>
     <button type="button" id="bc-tab-guest" data-tab="guest" role="tab" aria-selected={tab==='guest'} tabIndex={tab==='guest'?0:-1} aria-controls="bc-panel-guest" onClick={()=>setTab('guest')}>Как рассказать гостю</button>
    </div>
    <div id="bc-panel-taste" role="tabpanel" aria-labelledby="bc-tab-taste" hidden={tab!=='taste'} tabIndex={0}>
     <p>{beer.description}</p>{beer.aroma&&<p className="bc-aroma"><strong>Аромат</strong> {beer.aroma}</p>}
    </div>
    <div id="bc-panel-guest" role="tabpanel" aria-labelledby="bc-tab-guest" hidden={tab!=='guest'} tabIndex={0}><p className="bc-guest-copy">{beer.guest}</p></div>
    <details className="bc-source"><summary>Подача и источник<BeerIcon name="chevron" size={16}/></summary><div>
     <p>{glassLabels[beer.glass]}. {vessels[beer.glass].provenance==='reconstructed'?'Изображение посуды реконструировано по фото методички.':'Фотореконструкция по вашему бокалу; оригинальный логотип сохранён отдельно.'}</p>
     {beer.production&&<p>{beer.production}</p>}
     <p>Историческая методичка BeerFactory; актуальный ассортимент не подтверждён.{beer.seasonal?' *В методичке сорт отмечен сезонным.':''}</p>
     <p>Фото источника: {beer.source}. {beer.sourceQuote}</p>
    </div></details>
    <p className="bc-history-note">По фирменной методичке. Наличие уточняй на смене.</p>
   </article>
  </div>
  <p className="bc-live" role="status" aria-live="polite" aria-atomic="true">Выбран сорт: {beer.name}. {beer.alcohol}.</p>
 </section>;
}