import {useCallback,useEffect,useRef,useState} from 'react';
import {Link,Outlet,useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from '@/features/auth/auth-context';
import {clearPushBadge} from '@/features/notifications/notification-api';
import {AttestationSyncBridge} from '@/features/attestation/AttestationSyncBridge';
import {WarmHeaderProvider,type WarmBackTarget} from '@/components/warm/WarmHeader';
import {WarmIcon} from '@/components/warm/WarmIcon';
import {WarmDialog} from '@/components/warm/WarmDialog';
import {useInterfaceViewport} from '@/components/warm/motion';
import '@/styles/mobile-form-stability.css';

const sections=[['/','Сегодня','home'],['/menu','Рецепты','recipes'],['/beer','Пивная карта','beer'],['/knowledge','Знания и аттестация','book'],['/shift','Смена','shift'],['/feed','Лента','feed'],['/profile','Мой профиль','people'],['/settings','Настройки и редактирование','admin']];
export function AppShell(){
 const {state}=useAuth(),location=useLocation(),navigate=useNavigate(),root=useRef<HTMLDivElement>(null);
 const [menu,setMenu]=useState(false),[examActive,setExamActive]=useState(false),[registered,setRegistered]=useState<{id:string;target:WarmBackTarget}|null>(null),[showTop,setShowTop]=useState(false);
 const registerBack=useCallback((id:string,target:WarmBackTarget|null)=>setRegistered(current=>target?{id,target}:current?.id===id?null:current),[]);
 useInterfaceViewport(root);
 useEffect(()=>{setMenu(false);document.title=location.pathname==='/beer'?'Пивная карта · BFStaff':'BFStaff';},[location.pathname,location.search]);
 useEffect(()=>{const clear=()=>{void clearPushBadge();};const visible=()=>{if(document.visibilityState==='visible')clear();};clear();window.addEventListener('focus',clear);document.addEventListener('visibilitychange',visible);return()=>{window.removeEventListener('focus',clear);document.removeEventListener('visibilitychange',visible);};},[]);
 useEffect(()=>{const update=()=>setShowTop(window.scrollY>Math.max(420,innerHeight*.7));window.addEventListener('scroll',update,{passive:true});return()=>window.removeEventListener('scroll',update);},[]);
 const atHome=location.pathname==='/',brandPage=['/','/menu','/knowledge','/feed','/profile','/settings'].includes(location.pathname)&&!location.search.includes('editor=')&&!location.search.includes('view='),target=registered?.target??{to:location.pathname.startsWith('/settings/')?'/settings':'/',label:location.pathname.startsWith('/settings/')?'В настройки':'На главную'};
 function selected(path:string){return path==='/'?atHome:path==='/knowledge'?location.pathname.startsWith('/knowledge')||location.pathname.startsWith('/attestation'):path==='/settings'?location.pathname.startsWith('/settings')||location.pathname.startsWith('/admin'):location.pathname.startsWith(path);}
 return <WarmHeaderProvider value={{registerBack,setExamActive}}><div className="bfstaff-app" ref={root} lang="ru" data-app="warm-hall-unified">
  {state.status==='authenticated'&&<AttestationSyncBridge userId={state.user.id}/>}
  <a className="bf-skip-link" href="#mainContent" onClick={e=>{e.preventDefault();document.getElementById('mainContent')?.focus();}}>К основному содержимому</a>
  <div className="bf-shell">{!examActive&&<header className="bf-header"><div className="bf-header-leading">{brandPage?<Link to="/" className="warm-portal-brand" aria-label="BFStaff — на главную"><strong>BFStaff</strong><span>портал для команды</span></Link>:!atHome&&<button type="button" className="bf-button warm-button warm-header-back" aria-label={target.label} title={target.label} onClick={()=>target.onClick?target.onClick():navigate(target.to??'/')}><WarmIcon name="back"/></button>}</div><button type="button" className="bf-menu-trigger" aria-haspopup="dialog" aria-expanded={menu} onClick={()=>setMenu(true)}><WarmIcon name="dots" size={23}/>Разделы</button></header>}
   <main id="mainContent" tabIndex={-1} className="bf-main"><Outlet/></main>
  </div>
  {menu&&!examActive&&<WarmDialog title="Куда перейдём?" onClose={()=>setMenu(false)}><nav aria-label="Разделы приложения" className="grid gap-1">{sections.map(([to,label,icon])=><Link key={to} to={to} onClick={()=>setMenu(false)} className="bf-menu-row warm-header-menu" aria-current={selected(to)?'page':undefined}><WarmIcon name={icon}/><span>{label}</span><WarmIcon name={selected(to)?'check':'chevron'} size={17}/></Link>)}</nav></WarmDialog>}
  {showTop&&!examActive&&!atHome&&<button type="button" className="bf-button warm-button warm-scroll-top" aria-label="Вернуться наверх" onClick={()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}><WarmIcon name="back" style={{transform:'rotate(90deg)'}}/></button>}
 </div></WarmHeaderProvider>;
}
