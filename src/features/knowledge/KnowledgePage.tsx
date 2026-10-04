import {
  BookCheck,
  BookOpen,
  Beer,
  ChefHat,
  ClipboardList,
  Grape,
  Users,
  RefreshCw,
  Search,
  Pencil,
  Settings2,
  Wine,
  Martini,
  GlassWater,
  FlaskConical,
  Sprout,
  Wheat,
  History,
  Sparkles,
  HeartHandshake,
  MessageCircle,
  HandCoins,
  HandPlatter,
  ListChecks,
  ShieldCheck,
  UtensilsCrossed,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { useKnowledgeArticles } from "@/features/knowledge/use-knowledge";
import { useKnowledgeEditorAccess } from "./editor/use-editor-access";
import { useKnowledgeProgress } from "@/features/knowledge/use-knowledge-progress";
import type { KnowledgeArticle } from "@/features/knowledge/types";
import { cn } from "@/lib/utils";

const SCROLL_KEY = "bf-r404-knowledge-scroll";

function searchableText(article: KnowledgeArticle) {
  return `${article.title} ${article.category} ${article.searchText ?? article.body}`.toLowerCase();
}

function articleIcon(article: KnowledgeArticle) {
  // Presentation only: stable keyword matching, no backend fields or random choices.
  const title = article.title.toLocaleLowerCase("ru-RU");
  const category = article.category.toLocaleLowerCase("ru-RU");
  if (/жалоб|last|latte|фраз|объяснит|обратн.*связ/.test(title)) return MessageCircle;
  if (/рассерж|расстро|требователь|помощ|помочь/.test(title)) return HeartHandshake;
  if (/продаж|дополнен|удочк/.test(title)) return HandCoins;
  if (/чек.?лист|открыти|закрыти/.test(title)) return ListChecks;
  if (/стандарт|правил|безопас/.test(title)) return ShieldCheck;
  if (/подач|наливат|налить/.test(title)) return /пив/.test(title) ? Beer : HandPlatter;
  if (/пив/.test(category)) return /появ|истори/.test(title) ? History : /солод|пшен|состав/.test(title) ? Wheat : Beer;
  if (/вин/.test(category)) return /игрист|шампан/.test(title) ? Sparkles : /классиф|регион|розов/.test(title) ? Grape : Wine;
  if (/алкогол|бар|напит/.test(category)) {
    if (/джин|вермут|коктейл/.test(title)) return Martini;
    if (/ликёр|ликер/.test(title)) return FlaskConical;
    if (/текил|мескал/.test(title)) return Sprout;
    if (/херес/.test(title)) return Wine;
    return GlassWater;
  }
  if (/кух|меню|блюд/.test(category)) return /блюд|меню/.test(title) ? UtensilsCrossed : ChefHat;
  if (/сервис|гост|продаж/.test(category)) return /заказ|систем|меню/.test(title) ? ClipboardList : Users;
  if (/чек|стандарт|правил/.test(category)) return ClipboardList;
  return BookOpen;
}

function KnowledgeRow({
  article,
  read,
  from,
  onOpen,
}: {
  article: KnowledgeArticle;
  read: boolean;
  from: string;
  onOpen: () => void;
}) {
  const Icon = articleIcon(article);
  return (
    <Link
      to={`/knowledge/${encodeURIComponent(article.id)}`}
      state={{ from }}
      onClick={onOpen}
      className="knowledge-list-row knowledge-sticker"
      aria-label={`Открыть статью ${article.title}`}
      title={article.title}
    >
      <div className="knowledge-sticker-icons">
        <Icon size={22} strokeWidth={1.5} aria-hidden />
        {read && (
          <span className="knowledge-read-check" title="Прочитано">
            <BookCheck size={19} aria-hidden />
            <span className="sr-only">Прочитано</span>
          </span>
        )}
      </div>
      <h2>{article.title}</h2>
      {article.excerpt && (
        <p className="knowledge-excerpt">{article.excerpt}</p>
      )}
      <div className="knowledge-sticker-footer">
        <span>{article.readingMinutes} мин чтения</span>
        <span>{article.category}</span>
      </div>
    </Link>
  );
}

export function KnowledgePage() {
  const { state: auth } = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : "";
  const { state, reload } = useKnowledgeArticles();
  const editorAccess = useKnowledgeEditorAccess();
  const progress = useKnowledgeProgress(userId);
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  const query = params.get("q") || "";
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const requestedCategory = params.get("cat") || "Все";
  const articles = state.articles;

  const categories = useMemo(
    () => ["Все", ...new Set(articles.map((article) => article.category))],
    [articles],
  );

  const category = categories.includes(requestedCategory)
    ? requestedCategory
    : "Все";

  const filtered = useMemo(
    () =>
      articles.filter(
        (article) =>
          (category === "Все" || article.category === category) &&
          (!deferredQuery || searchableText(article).includes(deferredQuery)),
      ),
    [articles, category, deferredQuery],
  );

  const readCount = useMemo(
    () =>
      articles.reduce(
        (count, article) =>
          count + Number(progress.state.readIds.has(article.id)),
        0,
      ),
    [articles, progress.state.readIds],
  );

  useEffect(() => {
    if (state.status !== "ready") return;

    try {
      const stored = JSON.parse(
        sessionStorage.getItem(SCROLL_KEY) || "null",
      ) as { path?: string; y?: number } | null;
      const path = `${location.pathname}${location.search}`;

      if (
        stored?.path === path &&
        typeof stored.y === "number" &&
        stored.y > 0
      ) {
        requestAnimationFrame(() => window.scrollTo(0, stored.y || 0));
      }
    } catch {
      // Scroll restoration is optional.
    }
  }, [location.pathname, location.search, state.status]);

  function updateParam(key: "q" | "cat", value: string) {
    const next = new URLSearchParams(params);
    if (!value || (key === "cat" && value === "Все")) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  const from = `${location.pathname}${location.search}`;

  return (
    <section className="bf-knowledge-page">
      <div className="bf-knowledge-board">
        <div className="knowledge-board-topline">
          <header className="knowledge-board-heading">
            <BookOpen size={25} strokeWidth={1.4} aria-hidden />
            <h1>ЗНАНИЯ</h1>
            <p>Полезные материалы для нашей команды</p>
            <div className="knowledge-board-rule" aria-hidden>
              <span />
              <Grape size={17} strokeWidth={1.4} />
              <span />
            </div>
          </header>

          <div
            className="knowledge-utility-actions"
            aria-label="Инструменты базы знаний"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="knowledge-image-button knowledge-image-button--sync"
              aria-label="Обновить знания"
              title="Обновить знания"
              disabled={state.status === "loading"}
              onClick={() => void reload()}
            >
              <RefreshCw
                className={cn(
                  "size-5",
                  state.status === "loading" && "animate-spin",
                )}
                aria-hidden
              />
            </Button>

            {editorAccess.hasEditorAccess && editorAccess.canCreate && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="knowledge-image-button knowledge-image-button--create"
              >
                <Link
                  to="/knowledge/new"
                  state={{ from }}
                  aria-label="Новая статья"
                  title="Новая статья"
                >
                  <Pencil className="size-5" aria-hidden />
                </Link>
              </Button>
            )}

            {editorAccess.hasEditorAccess && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="knowledge-image-button knowledge-image-button--manage"
              >
                <Link
                  to="/knowledge/manage"
                  state={{ from }}
                  aria-label="Управление статьями"
                  title="Управление статьями"
                >
                  <Settings2 className="size-5" aria-hidden />
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="knowledge-board-search">
          <Search size={16} aria-hidden />
          <label className="sr-only" htmlFor="knowledge-search">
            Поиск по базе знаний
          </label>
          <Input
            id="knowledge-search"
            type="search"
            value={query}
            placeholder="Тема, слово или содержание…"
            onChange={(event) => updateParam("q", event.target.value)}
          />
        </div>
        {state.status === "loading" && (
          <div className="knowledge-sticker-grid" aria-label="Загрузка статей">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="knowledge-sticker knowledge-sticker-loading"
              />
            ))}
          </div>
        )}
        {state.status === "error" && (
          <div className="knowledge-board-empty" role="alert">
            <h2>Материалы сейчас недоступны</h2>
            <p>Попробуйте ещё раз.</p>
            <Button onClick={reload}>
              <RefreshCw size={16} aria-hidden />
              Повторить
            </Button>
          </div>
        )}
        {state.status === "ready" && (
          <>
            <div
              className="knowledge-board-categories bf-scrollbar-none"
              role="group"
              aria-label="Категории базы знаний"
            >
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={item === category}
                  onClick={() => updateParam("cat", item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="knowledge-board-summary">
              <span aria-live="polite">Найдено: {filtered.length}</span>
              <span>
                Прочитано: {readCount}/{articles.length}
              </span>
              <Link to="/attestation">Аттестация</Link>
            </div>
            {filtered.length ? (
              <div className="knowledge-sticker-grid">
                {filtered.map((article) => (
                  <KnowledgeRow
                    key={article.id}
                    article={article}
                    read={progress.state.readIds.has(article.id)}
                    from={from}
                    onOpen={() => {
                      try {
                        sessionStorage.setItem(
                          SCROLL_KEY,
                          JSON.stringify({ path: from, y: window.scrollY }),
                        );
                      } catch {
                        /* Optional scroll restoration. */
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="knowledge-board-empty">
                <h2>Ничего не найдено</h2>
                <p>Попробуй другое слово или категорию.</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
