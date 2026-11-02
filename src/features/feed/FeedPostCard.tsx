import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmDialog } from "@/components/warm/WarmDialog";
import { WarmEmpty } from "@/components/warm/WarmPage";
import { STAFF_POSITION_LABELS } from "@/types/auth";
import type { FeedPost, FeedProfile } from "./types";
import "./feed.css";

export function feedPersonName(profile: FeedProfile | null) {
  return [profile?.first_name, profile?.last_name].map(part => part?.trim()).filter(Boolean).join(" ") || "Имя недоступно";
}
function formatDateTime(value: string | null) {
  if (!value) return "";
  try { return new Intl.DateTimeFormat("ru-RU", { day:"numeric", month:"long", hour:"2-digit", minute:"2-digit", timeZone:"Asia/Novosibirsk" }).format(new Date(value)); }
  catch { return ""; }
}
function audienceLabel(post: FeedPost) {
  if (post.notify_all) return "Уведомление всей команде";
  return `Уведомление: ${post.notify_positions.map(item => STAFF_POSITION_LABELS[item]).filter(Boolean).join(", ") || "выбранные должности"}`;
}
function Readers({post,onClose}:{post:FeedPost;onClose:()=>void}) {
  const readers = post.readers || [];
  return <WarmDialog title="Ознакомились" onClose={onClose}>
    <p className="small muted bf-feed-readers-subject">{post.subject}</p>
    {readers.length ? <ul className="bf-feed-readers-list">{readers.map(reader => {
      const name=feedPersonName(reader.profile);
      const initials=[reader.profile?.first_name,reader.profile?.last_name].map(part=>part?.trim()[0]||"").join("")||"·";
      return <li className="bf-reader-row" key={reader.user_id}><span className="person" aria-hidden="true">{initials}</span><span className="bf-reader-identity"><strong>{name}</strong><span className="small muted">{formatDateTime(reader.created_at)}</span></span><WarmIcon name="check" size={17}/></li>;
    })}</ul> : <WarmEmpty title="Пока никто не ознакомился" body="Имена появятся после личной отметки «Ознакомился»."/>}
  </WarmDialog>;
}

export function FeedPostCard({ post, compact=false, detail=false, pending=false, onAcknowledge, onResolve }: {
  post:FeedPost;compact?:boolean;detail?:boolean;pending?:boolean;onAcknowledge?:(post:FeedPost)=>void;onResolve?:(post:FeedPost)=>void;
}) {
  const [readersOpen,setReadersOpen]=useState(false);
  const resolved=post.status === "resolved";
  return <article className={`bf-panel bf-feed-note${compact?" bf-feed-note-compact":""}${post.priority === "critical"?" bf-feed-note-critical":""}`}>
    <div className="bf-feed-note-meta"><span className={`pill${post.priority === "critical"?" critical":""}`}>{post.priority === "critical"?"Критично":post.priority === "high"?"Важная":"Обычная"}</span><span className="small muted">{audienceLabel(post)}</span>{resolved?<span className="pill">Решено</span>:null}</div>
    {detail ? <h1 className="bf-note-title">{post.subject}</h1> : <h3><Link className="bf-note-title bf-note-open" to={`/feed/${post.id}`}><span>{post.subject}</span><WarmIcon name="chevron" size={18}/></Link></h3>}
    <p className="bf-note-body">{post.body}</p>
    <p className="small muted bf-feed-author">{feedPersonName(post.author)} · {formatDateTime(post.created_at)}</p>
    <div className="bf-feed-note-bottom"><button type="button" className="bf-reader-button" onClick={() => setReadersOpen(true)} aria-label={`Ознакомились: ${post.acknowledgementCount}. Посмотреть список`}><span className="bf-reader-pill"><WarmIcon name="people" size={13}/>Ознакомились: {post.acknowledgementCount}</span></button>{compact?<Button asChild variant="ghost"><Link to={`/feed/${post.id}`}>Открыть<WarmIcon name="arrow" size={18}/></Link></Button>:null}</div>
    {!compact && !resolved ? <div className="bf-feed-note-actions">
      {onAcknowledge ? <Button type="button" variant={post.acknowledgedByMe?"secondary":"primary"} disabled={pending||post.acknowledgedByMe} onClick={() => onAcknowledge(post)}>{pending?"Сохраняем…":post.acknowledgedByMe?"Ознакомление отмечено":"Ознакомился"}</Button> : null}
      {onResolve ? <Button type="button" variant="secondary" disabled={pending} onClick={() => onResolve(post)}>{pending?"Сохраняем…":"Отметить решённой"}</Button> : null}
    </div> : null}
    {resolved && post.resolvedBy ? <p className="small muted bf-feed-resolved">Решено: {feedPersonName(post.resolvedBy)}{post.resolved_at?` · ${formatDateTime(post.resolved_at)}`:""}</p> : null}
    {readersOpen?<Readers post={post} onClose={() => setReadersOpen(false)}/>:null}
  </article>;
}
