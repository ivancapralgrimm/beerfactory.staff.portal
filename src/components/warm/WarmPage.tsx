import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {WarmIcon} from './WarmIcon';
export function WarmTitle({title,description,action}:{title:string;description?:ReactNode;action?:ReactNode}){return <div className="bf-page-title"><div><h1 tabIndex={-1}>{title}</h1>{description&&<p className="muted mt-2">{description}</p>}</div>{action}</div>;}
export function WarmRow({to,title,description,icon}:{to:string;title:string;description?:ReactNode;icon?:string}){return <Link to={to} className="bf-nav-row">{icon&&<span className="bf-nav-leading"><WarmIcon name={icon}/></span>}<span className="bf-nav-copy"><strong className="bf-nav-title">{title}</strong>{description&&<span className="bf-nav-meta">{description}</span>}</span><WarmIcon name="chevron" size={18}/></Link>;}
export function WarmEmpty({title,body,children}:{title:string;body?:ReactNode;children?:ReactNode}){return <div className="bf-empty"><h2>{title}</h2>{body&&<p className="muted mt-2">{body}</p>}{children}</div>;}
export function WarmNotice({children,error=false}:{children:ReactNode;error?:boolean}){return <div className={error?'bf-error':'bf-notice'} role={error?'alert':'status'}>{children}</div>;}
