import { useDeferredValue, useEffect, useMemo } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmTitle, WarmEmpty } from "@/components/warm/WarmPage";
import { useAuth } from "@/features/auth/auth-context";
import { useKnowledgeArticles } from "./use-knowledge";
import { useKnowledgeEditorAccess } from "./editor/use-editor-access";
import { useKnowledgeProgress } from "./use-knowledge-progress";
import "./knowledge-warm.css";

const SCROLL_KEY = "bf-r404-knowledge-scroll";

export function KnowledgePage() {
  const { state: auth } = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : "";
  const { state, reload } = useKnowledgeArticles();
  const access = useKnowledgeEditorAccess();
  const progress = useKnowledgeProgress(userId);
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("ru-RU"));
  const requestedCategory = params.get("cat") || "Все";
  const reading = params.get("reading") || "all";
  const articles = state.articles;
  const categories = useMemo(() => ["Все", ...new Set(articles.map(a => a.category))], [articles]);
  const category = categories.includes(requestedCategory) ? requestedCategory : "Все";
  const filtered = useMemo(() => articles.filter(a =>
    (category === "Все" || a.category === category) &&
    (reading !== "read" && reading !== "unread" || progress.state.readIds.has(a.id) === (reading === "read")) &&
    (!deferredQuery || `${a.title} ${a.category} ${a.searchText ?? a.body}`.toLocaleLowerCase("ru-RU").includes(deferredQuery))
  ), [articles, category, deferredQuery, reading, progress.state.readIds]);
  const from = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (state.status !== "ready") return;
    try {
      const stored = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || "null") as { path?: string; y?: number } | null;
      if (stored?.path === from && typeof stored.y === "number" && stored.y > 0)
        requestAnimationFrame(() => window.scrollTo(0, stored.y || 0));
    } catch { /* Optional scroll restoration. */ }
  }, [from, state.status]);
  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === "Все" || (key === "reading" && value === "all")) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }
  return <section className="bf-knowledge-page">
    <WarmTitle title="Знания" action={access.canCreate ? <Button asChild size="icon" aria-label="Добавить статью" title="Добавить статью"><Link to="/knowledge/new" state={{ from }}><WarmIcon name="plus" /></Link></Button> : undefined} />
    <div className="bf-knowledge-tools bf-compact-form">
      <label className="bf-field">Найти материал<Input type="search" value={query} placeholder="Название, тема или текст" onChange={e => updateParam("q", e.target.value)} /></label>
      <div className="bf-knowledge-filters">
        <label className="bf-field">Тема<select value={category} onChange={e => updateParam("cat", e.target.value)}>{categories.map(c => <option key={c} value={c}>{c === "Все" ? "Все темы" : c}</option>)}</select></label>
        <label className="bf-field">Чтение<select value={reading} onChange={e => updateParam("reading", e.target.value)}><option value="all">Все статьи</option><option value="unread">К прочтению</option><option value="read">Прочитано</option></select></label>
      </div>
    </div>
    <Button asChild variant="primary" className="bf-knowledge-attestation"><Link to="/attestation"><WarmIcon name="shift" />Аттестация<WarmIcon name="arrow" /></Link></Button>
    {state.status === "loading" && <p role="status">Загружаем материалы…</p>}
    {state.status === "error" && <div role="alert"><WarmEmpty title="Материалы сейчас недоступны" body="Попробуйте ещё раз." /><Button onClick={() => void reload()}>Повторить</Button></div>}
    {state.status === "ready" && <>
      <p className="bf-knowledge-count" role="status">Найдено: {filtered.length}</p>
      {filtered.length ? <ul className="bf-knowledge-list" aria-label="Статьи">{filtered.map(article => {
        const read = progress.state.readIds.has(article.id);
        return <li key={article.id}><Link className="bf-knowledge-item" to={`/knowledge/${encodeURIComponent(article.id)}`} state={{ from }} onClick={() => {
          try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ path: from, y: window.scrollY })); } catch { /* Optional scroll restoration. */ }
        }}><span className="bf-knowledge-item-copy"><span className="bf-knowledge-item-title">{article.title}</span><span className="bf-knowledge-item-meta"><span>{article.category}</span><span>{article.readingMinutes} мин чтения</span></span><span className={`bf-knowledge-reading${read ? " is-read" : ""}`}>{read && <WarmIcon name="check" size={14} />}<span>{read ? "Прочитано" : "К прочтению"}</span></span></span><WarmIcon name="chevron" size={18} /></Link></li>;
      })}</ul> : <><WarmEmpty title={articles.length ? "Статей по запросу нет" : "Пока нет статей"} />{articles.length > 0 && <Button onClick={() => setParams({}, { replace: true })}>Сбросить фильтры</Button>}</>}
    </>}
  </section>;
}
