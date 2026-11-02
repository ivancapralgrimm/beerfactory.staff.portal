import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WarmBack } from "@/components/warm/WarmBack";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmEmpty, WarmNotice, WarmTitle } from "@/components/warm/WarmPage";
import { acknowledgeFeedPost, createFeedPost, resolveFeedPost } from "./feed-api";
import { FeedPostCard, feedPersonName } from "./FeedPostCard";
import { useFeed } from "./use-feed";
import type { FeedPost } from "./types";
import { STAFF_POSITION_LABELS, type StaffPosition } from "@/types/auth";
import "./feed.css";

type StatusFilter = "active" | "resolved" | "all";
const STAFF_POSITIONS:StaffPosition[] = ["bartender","waiter","bartender_bb","waiter_bb","manager","hostess"];

export function FeedPage() {
  const {
    posts,
    loading,
    refreshing,
    error,
    refresh
  } = useFeed();
  const [searchParams] = useSearchParams();
  const { noteId } = useParams<{noteId:string}>();
  const { pathname } = useLocation();
  const isNew = noteId === "new" || pathname.replace(/\/$/, "") === "/feed/new";
  const navigate = useNavigate();
  const [query,setQuery] = useState("");
  const recipientsRef = useRef<HTMLDetailsElement>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const submittingRef = useRef(false);

  const [composerOpen, setComposerOpen] = useState(() => searchParams.get("compose") === "1" || isNew);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] =
    useState<"normal" | "critical">("normal");
  const [notifyAll, setNotifyAll] = useState(true);
  const [notifyPositions, setNotifyPositions] =
    useState<StaffPosition[]>([]);
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("active");
  const [submitting, setSubmitting] = useState(false);
  const [pendingIds, setPendingIds] =
    useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {setComposerOpen(isNew || searchParams.get("compose") === "1");}, [isNew,searchParams]);
  const filtered = useMemo(() => {
    const term=query.trim().toLocaleLowerCase("ru");
    return posts.filter(post => statusFilter === "all" || (statusFilter === "resolved" ? post.status === "resolved" : post.status !== "resolved"))
      .filter(post => !term || `${post.subject} ${post.body} ${feedPersonName(post.author)}`.toLocaleLowerCase("ru").includes(term));
  }, [posts,statusFilter,query]);
  function togglePosition(position:StaffPosition) {
    setNotifyAll(false);
    setNotifyPositions(current => current.includes(position)?current.filter(item=>item!==position):[...current,position]);
  }

  async function submitPost(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanSubject = subject.trim();
    const cleanBody = body.trim();

    if (
      !cleanSubject ||
      !cleanBody ||
      submittingRef.current ||
      (!notifyAll && notifyPositions.length === 0)
    ) {
      if (!notifyAll && !notifyPositions.length && recipientsRef.current) {recipientsRef.current.open=true;recipientsRef.current.querySelector<HTMLInputElement>("input")?.focus();}
      return;
    }

    submittingRef.current=true;
    setSubmitting(true);
    setMessage(null);

    try {
      await createFeedPost({
        subject: cleanSubject,
        body: cleanBody,
        priority,
        notifyAll,
        notifyPositions
      });

      setSubject("");
      setBody("");
      setPriority("normal");
      setNotifyAll(true);
      setNotifyPositions([]);
      setComposerOpen(false);
      if(isNew)navigate("/feed");
      setMessage({
        tone: "success",
        text: "Запись опубликована в Ленте."
      });
      await refresh(true);
    } catch {
      setMessage({
        tone: "error",
        text: "Не удалось опубликовать запись."
      });
    } finally {
      submittingRef.current=false;
      setSubmitting(false);
    }
  }

  async function runAction(
    post: FeedPost,
    action: "ack" | "resolve"
  ) {
    if (pendingIdsRef.current.has(post.id)) return;
    pendingIdsRef.current.add(post.id);

    setPendingIds((current) => {
      const next = new Set(current);
      next.add(post.id);
      return next;
    });
    setMessage(null);

    try {
      if (action === "ack") {
        await acknowledgeFeedPost(post.id);
      } else {
        await resolveFeedPost(post.id);
      }

      setMessage({
        tone: "success",
        text:
          action === "ack"
            ? "Отметка «Ознакомился» сохранена."
            : "Запись отмечена как решённая."
      });

      await refresh(true);
    } catch {
      setMessage({
        tone: "error",
        text: "Не удалось обновить запись."
      });
    } finally {
      pendingIdsRef.current.delete(post.id);
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(post.id);
        return next;
      });
    }
  }

  const status = message ? <WarmNotice error={message.tone === "error"}>{message.text}</WarmNotice> : null;
  const loadState = loading ? <p role="status" aria-busy="true">Загружаем Ленту…</p> : error ? <WarmNotice error><p>{error}</p><Button onClick={() => void refresh(false)}>Повторить</Button></WarmNotice> : null;
  const actions = (post:FeedPost) => ({pending:pendingIds.has(post.id),onAcknowledge:(item:FeedPost)=>void runAction(item,"ack"),onResolve:(item:FeedPost)=>void runAction(item,"resolve")});
  if (noteId && !isNew) {
    const post=posts.find(item=>item.id===noteId);
    return <section className="bf-feed-page"><WarmBack to="/feed" label="В Ленту"/>{status}{loadState || (post ? <FeedPostCard post={post} detail {...actions(post)}/> : <><WarmEmpty title="Заметка недоступна" body="Запись не найдена среди доступных заметок."/><Button asChild><Link to="/feed">Вернуться в Ленту</Link></Button></>)}</section>;
  }
  return <section className="bf-feed-page">
    {isNew ? <WarmBack to="/feed" label="В Ленту"/> : null}
    <WarmTitle title={isNew?"Новая заметка":"Передача"} description={isNew?undefined:"Для команды и следующей смены."} action={!isNew ? <Button disabled={submitting} onClick={() => setComposerOpen(current=>!current)}>{composerOpen?"Закрыть":"Написать"}</Button> : undefined}/>
    {status}
    {composerOpen ? <form className="bf-feed-composer bf-compact-form" onSubmit={submitPost}>
      <label className="bf-field"><span className="bf-field-label">Заголовок</span><input required maxLength={120} value={subject} disabled={submitting} onChange={event=>setSubject(event.target.value)}/></label>
      <label className="bf-field"><span className="bf-field-label">Сообщение</span><textarea required maxLength={2000} rows={5} value={body} disabled={submitting} onChange={event=>setBody(event.target.value)}/></label>
      <label className="bf-field"><span className="bf-field-label">Приоритет</span><select value={priority} disabled={submitting} onChange={event=>setPriority(event.target.value as "normal"|"critical")}><option value="normal">Обычная</option><option value="critical">Критичная</option></select></label>
      <details className="bf-notify-picker" ref={recipientsRef}><summary className="bf-notify-summary"><span>Кого уведомить</span><span className="bf-notify-value">{notifyAll?"Вся команда":notifyPositions.length?notifyPositions.map(position=>STAFF_POSITION_LABELS[position]).join(", "):"Выбрать должности"}</span><WarmIcon name="chevron" size={18}/></summary><fieldset className="bf-notify-positions" disabled={submitting}><legend className="bf-sr-only">Адресаты уведомления</legend><div className="bf-notify-choices">
        <label className="bf-notify-choice"><input className="bf-sr-only" type="checkbox" checked={notifyAll} onChange={event=>{setNotifyAll(event.target.checked);setNotifyPositions([]);}}/><span className="bf-notify-capsule"><span className="bf-notify-tick" aria-hidden="true"><WarmIcon name="check" size={16}/></span><span>Вся команда</span></span></label>
        {STAFF_POSITIONS.map(position=><label className="bf-notify-choice" key={position}><input className="bf-sr-only" type="checkbox" checked={!notifyAll&&notifyPositions.includes(position)} onChange={()=>togglePosition(position)}/><span className="bf-notify-capsule"><span className="bf-notify-tick" aria-hidden="true"><WarmIcon name="check" size={16}/></span><span>{STAFF_POSITION_LABELS[position]}</span></span></label>)}
      </div></fieldset></details>
      <Button type="submit" variant="primary" disabled={submitting||!subject.trim()||!body.trim()||(!notifyAll&&!notifyPositions.length)}>{submitting?"Публикуем…":"Опубликовать заметку"}</Button>
    </form> : null}
    {!isNew ? <>
      <div className="bf-feed-search-row"><label className="bf-field"><span className="bf-field-label">Поиск в Ленте</span><input type="search" placeholder="Тема, текст или автор" value={query} onChange={event=>setQuery(event.target.value)}/></label><Button type="button" size="icon" aria-label="Обновить Ленту" title="Обновить Ленту" aria-busy={refreshing} disabled={refreshing} onClick={()=>void refresh(true)}><WarmIcon name="refresh" /></Button></div>
      <div className="bf-feed-segments" role="group" aria-label="Статус заметок">{([["active","Активные"],["resolved","Решённые"],["all","Все"]] as const).map(([value,label])=><Button key={value} aria-pressed={statusFilter===value} variant={statusFilter===value?"primary":"ghost"} onClick={()=>setStatusFilter(value)}>{label}</Button>)}</div>

      {loadState || (filtered.length ? filtered.map(post=><FeedPostCard key={post.id} post={post} {...actions(post)}/>) : <WarmEmpty title={query.trim()?"Ничего не найдено":statusFilter === "resolved"?"Решённых записей пока нет.":"Заметок пока нет"} body={query.trim()?"Попробуйте другое слово или сбросьте поиск.":"Создайте заметку или выберите другой фильтр."}/>)}
    </> : null}
  </section>;
}
