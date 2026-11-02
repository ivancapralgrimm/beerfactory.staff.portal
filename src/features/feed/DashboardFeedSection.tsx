import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WarmNotice } from "@/components/warm/WarmPage";
import { FeedPostCard } from "./FeedPostCard";
import { useFeed } from "./use-feed";
import "./feed.css";

export function DashboardFeedSection() {
  const { posts, loading, error, refresh } = useFeed();
  const active = posts.filter(post => post.status !== "resolved");
  const important = active.find(post => post.priority === "critical") || active[0];
  return <section className="bf-dashboard-feed" aria-label="Передача смены">
    <div className="bf-feed-section-heading"><h2>Передача</h2><Button asChild variant="ghost"><Link to="/feed">Вся Лента</Link></Button></div>
    {loading ? <p className="small muted" role="status" aria-busy="true">Загружаем заметки команды…</p> : error ? <WarmNotice error><p>Не удалось загрузить Ленту.</p><Button variant="ghost" onClick={() => void refresh(false)}>Повторить</Button></WarmNotice> : important ? <FeedPostCard post={important} compact/> : <p className="small muted">Активных заметок пока нет.</p>}
  </section>;
}
