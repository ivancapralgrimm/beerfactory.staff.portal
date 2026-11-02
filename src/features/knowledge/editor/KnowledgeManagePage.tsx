import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WarmBack } from "@/components/warm/WarmBack";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmTitle, WarmEmpty } from "@/components/warm/WarmPage";
import { loadKnowledgeEditorArticles, type KnowledgeEditorSummary } from "./knowledge-editor-api";
import { useKnowledgeEditorAccess } from "./use-editor-access";
import { knowledgeErrorMessage } from "./knowledge-errors";
import "../knowledge-warm.css";

const labels = {published: "Опубликована", draft: "Черновик", archived: "Архив"};
export function KnowledgeManagePage() {
  const access = useKnowledgeEditorAccess();
  const [result, setResult] = useState<{scope: string; articles: KnowledgeEditorSummary[]}>({scope: "", articles: []});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    if (!access.hasEditorAccess) return;
    let active = true;
    setLoading(true); setError("");
    loadKnowledgeEditorArticles().then(articles => {if (active) setResult({scope: access.userId, articles});})
      .catch(e => {if (active) setError(knowledgeErrorMessage(e));})
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [access.hasEditorAccess, access.userId, attempt]);
  const articles = result.scope === access.userId ? result.articles : [];
  const list = useMemo(() => articles.filter(a => (filter === "all" || a.status === filter) && `${a.title} ${a.category}`.toLocaleLowerCase("ru-RU").includes(search.trim().toLocaleLowerCase("ru-RU"))), [articles, filter, search]);
  return <section className="bf-knowledge-manage bf-editor-page">
    <WarmBack to="/settings" label="В настройки" />
    <WarmTitle title="Управление знаниями" description="Публикации, черновики и архив." action={access.canCreate ? <Button asChild size="icon" aria-label="Создать статью" title="Создать статью"><Link to="/knowledge/new"><WarmIcon name="plus" /></Link></Button> : undefined} />
    {access.status === "loading" && <p role="status">Проверяем доступ…</p>}
    {access.status === "denied" && <p role="alert">Нет доступа к управлению статьями.</p>}
    {access.status === "error" && <p role="alert">Не удалось проверить доступ. Попробуйте позже.</p>}
    {access.hasEditorAccess && <>
      <div className="bf-knowledge-tools bf-compact-form"><label className="bf-field">Найти статью в управлении<Input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label><label className="bf-field">Статус статьи<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Все</option>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
      {loading && <p role="status">Загружаем статьи…</p>}
      {error && <div><p role="alert" className="bf-error">{error}</p><Button onClick={() => setAttempt(v => v + 1)}>Повторить</Button></div>}
      {!loading && !error && <><p className="bf-knowledge-count" role="status">Найдено: {list.length} из {articles.length}</p><div className="bf-bank-list">{list.length ? list.map(article => <details key={article.id} className="bf-knowledge-manage-row"><summary><span className="bf-knowledge-manage-copy"><span>{article.title}</span><span>{article.category} · {labels[article.status]}</span></span><WarmIcon name="chevron" size={18} /></summary><div className="bf-bank-actions">
        {article.status === "published" && <Button asChild><Link to={`/knowledge/${encodeURIComponent(article.id)}`}>Посмотреть</Link></Button>}
        {access.canEdit && <Button asChild><Link to={`/knowledge/${encodeURIComponent(article.id)}/edit`}><WarmIcon name="edit" size={17} />Редактировать</Link></Button>}
      </div></details>) : <><WarmEmpty title={articles.length ? "Статей по запросу нет" : "Статей пока нет"} />{articles.length > 0 && <Button onClick={() => {setFilter("all"); setSearch("");}}>Сбросить фильтры</Button>}</>}</div></>}
    </>}
  </section>;
}
