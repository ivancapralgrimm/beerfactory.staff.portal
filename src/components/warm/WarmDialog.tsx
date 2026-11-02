import {useEffect,useId,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {WarmIcon} from './WarmIcon';
export function WarmDialog({title,children,onClose,confirm=false}:{title:string;children:ReactNode;onClose:()=>void;confirm?:boolean}){
 const ref=useRef<HTMLDialogElement>(null),id=useId(),callback=useRef(onClose);callback.current=onClose;
 useEffect(()=>{const d=ref.current;if(!d)return;const prev=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';d.showModal();return()=>{d.close();document.body.style.overflow=overflow;prev?.focus({preventScroll:true});};},[]);
 const target=document.querySelector('.bfstaff-app')??document.body;
 return createPortal(<dialog ref={ref} tabIndex={-1} className="bf-dialog warm-dialog" role={confirm?'alertdialog':'dialog'} aria-modal="true" aria-labelledby={id} onKeyDown={e=>{
  if(e.key!=='Tab')return;
  const dialog=e.currentTarget;
  const controls=[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(element=>element.getClientRects().length>0&&!element.closest('[hidden],[inert]'));
  const first=controls[0],last=controls.at(-1);
  if(!first){e.preventDefault();dialog.focus();return;}
  if(!dialog.contains(document.activeElement)||document.activeElement===dialog){e.preventDefault();(e.shiftKey?last:first)?.focus();}
  else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }} onCancel={e=>{e.preventDefault();callback.current();}} onClick={e=>{if(e.target===e.currentTarget){const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)callback.current();}}}><div className="bf-dialog-heading"><h2 id={id}>{title}</h2>{!confirm&&<button type="button" className="bf-button light bf-icon-button" aria-label="Закрыть" onClick={()=>callback.current()}><WarmIcon name="close" size={18}/></button>}</div>{children}</dialog>,target);
}
