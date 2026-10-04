import { PhotoMount } from "@/components/craft/CraftPage";
import { useEffect, useRef, useState } from "react";
import { BookCheck, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { knowledgeArticleImage } from "./dashboard-reading";
import type { KnowledgeArticle } from "@/features/knowledge/types";

function shortReadingTitle(value: string) {
  const title = value.replace(/\s+/gu, " ").trim();
  if (title.length <= 36) return title;
  // Keep the original wording and numbers; shorten only at a whole-word boundary.
  const words = title.split(" ");
  let result = "";
  for (const word of words) {
    const next = result ? `${result} ${word}` : word;
    if (next.length > 35) break;
    result = next;
  }
  return `${(result || title.slice(0, 35)).replace(/[,:;–—-]+$/u, "")}…`;
}

export function ReadingCarousel({ articles, readIds }: { articles: KnowledgeArticle[]; readIds: Set<string> }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => {
      const left = element.scrollLeft > 2;
      const right = element.scrollLeft + element.clientWidth < element.scrollWidth - 2;
      setEdges(previous => previous.left === left && previous.right === right ? previous : { left, right });
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, [articles]);
  const scroll = (direction: number) => {
    const element = track.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(180, element.clientWidth * .8), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  return <div className="bf-reading-carousel">
    <div ref={track} id="bf-reading-track" className="bf-reading-track bf-scrollbar-none" aria-label="Подборка статей">
      {articles.map(article => {
        const image = knowledgeArticleImage(article);
        return <Link key={article.id} to={`/knowledge/${encodeURIComponent(article.id)}`} state={{ from: "/" }} className="bf-reading-card" aria-label={`Открыть статью ${article.title}`}>
          <PhotoMount src={image || ""} fallback={<BookOpen aria-hidden />} />
          <div className="bf-reading-body"><span className="bf-reading-category">{article.category}</span><strong>{shortReadingTitle(article.title)}</strong><div className="bf-reading-meta"><span>{article.readingMinutes} мин</span>{readIds.has(article.id) && <span><BookCheck aria-hidden /> Прочитано</span>}</div></div>
        </Link>;
      })}
    </div>
    <div className="bf-reading-controls" aria-label="Листать подборку">
      <button type="button" aria-label="Предыдущие статьи" aria-controls="bf-reading-track" disabled={!edges.left} onClick={() => scroll(-1)}><ChevronLeft aria-hidden /></button>
      <button type="button" aria-label="Следующие статьи" aria-controls="bf-reading-track" disabled={!edges.right} onClick={() => scroll(1)}><ChevronRight aria-hidden /></button>
    </div>
  </div>;
}
