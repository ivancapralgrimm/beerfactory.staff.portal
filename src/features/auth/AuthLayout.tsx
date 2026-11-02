import type {ReactNode} from 'react';
import {motion,useReducedMotion} from 'motion/react';
export function AuthLayout({eyebrow,title,description,children}:{eyebrow:string;title:string;description:string;children:ReactNode}){
 const reduced=useReducedMotion();
 return <div className="bfstaff-app" lang="ru"><div className="bf-shell warm-auth-shell"><main className="auth-screen"><a className="bf-skip-link" href="#mainContent">К основному содержимому</a><section id="mainContent" tabIndex={-1} aria-labelledby="auth-title" className="auth-panel">
  <motion.div className="warm-auth-hero" initial={reduced?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:.24,ease:[.16,1,.3,1]}}><div><strong>BFSTAFF</strong><p>BeerFactory<br/>BeerBistro</p></div><img src="/assets/warm/recipe-photo.jpg" onError={event=>{event.currentTarget.style.visibility="hidden";}} alt="" width="108" height="140"/></motion.div>
  <p className="eyebrow">{eyebrow}</p><h1 id="auth-title" tabIndex={-1} className="text-[28px] font-bold leading-tight">{title}</h1><p className="muted mt-2 text-sm">{description}</p><div className="mt-5">{children}</div>
 </section></main></div></div>;
}
