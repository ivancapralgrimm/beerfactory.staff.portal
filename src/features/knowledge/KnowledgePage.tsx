import {
  BookCheck,
  ChevronRight,
  RefreshCw,
  Search
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo
} from "react";
import {
  Link,
  useLocation,
  useSearchParams
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { useKnowledgeArticles } from "@/features/knowledge/use-knowledge";
import { useKnowledgeProgress } from "@/features/knowledge/use-knowledge-progress";
import type { KnowledgeArticle } from "@/features/knowledge/types";
import { cn } from "@/lib/utils";

const SCROLL_KEY = "bf-r404-knowledge-scroll";

function searchableText(article: KnowledgeArticle) {
  return `${article.title} ${article.category} ${article.body}`.toLowerCase();
}

function KnowledgeRow({
  article,
  read,
  from,
  onOpen
}: {
  article: KnowledgeArticle;
  read: boolean;
  from: string;
  onOpen: () => void;
}) {
  return (
    <Link
      to={`/knowledge/${encodeURIComponent(article.id)}`}
      state={{ from }}
      onClick={onOpen}
      className="knowledge-list-row group grid min-h-[116px] grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--bf-line)] py-4 outline-none transition-[background-color,color] duration-150 focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
      aria-label={`Открыть статью ${article.title}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--bf-copper-hi)]">
            {article.category}
          </span>
          {read ? (
            <span className="inline-flex min-h-6 items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--bf-green),transparent_65%)] px-2 text-[10px] font-bold text-[#9dd0a0]">
              <BookCheck className="size-3" aria-hidden />
              Прочитано
            </span>
          ) : null}
        </div>

        <h2 className="mt-1 text-[18px] font-extrabold leading-6 tracking-[-0.015em]">
          {article.title}
        </h2>

        {article.excerpt ? (
          <p className="knowledge-excerpt mt-1.5 text-[13px] leading-5 text-[var(--bf-muted)]">
            {article.excerpt}
          </p>
        ) : null}

        <div className="mt-2 text-[11px] font-semibold text-[var(--bf-dim)]">
          {article.readingMinutes} мин
        </div>
      </div>

      <div className="grid size-9 place-items-center rounded-full border border-[var(--bf-line)] text-[var(--bf-copper-hi)] transition-[border-color,background-color] duration-150 group-hover:border-[var(--bf-line-strong)] group-hover:bg-[var(--bf-surface)]">
        <ChevronRight className="size-5" aria-hidden />
      </div>
    </Link>
  );
}

export function KnowledgePage() {
  const { state: auth } = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : "";
  const { state, reload } = useKnowledgeArticles();
  const progress = useKnowledgeProgress(userId);
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  const query = params.get("q") || "";
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const requestedCategory = params.get("cat") || "Все";
  const articles = state.articles;

  const categories = useMemo(
    () => ["Все", ...new Set(articles.map((article) => article.category))],
    [articles]
  );

  const category = categories.includes(requestedCategory)
    ? requestedCategory
    : "Все";

  const filtered = useMemo(
    () =>
      articles.filter(
        (article) =>
          (category === "Все" || article.category === category) &&
          (!deferredQuery ||
            searchableText(article).includes(deferredQuery))
      ),
    [articles, category, deferredQuery]
  );

  const readCount = useMemo(
    () =>
      articles.reduce(
        (count, article) =>
          count + Number(progress.state.readIds.has(article.id)),
        0
      ),
    [articles, progress.state.readIds]
  );

  useEffect(() => {
    if (state.status !== "ready") return;

    try {
      const stored = JSON.parse(
        sessionStorage.getItem(SCROLL_KEY) || "null"
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
    <section className="bf-list-page bf-knowledge-page pb-4">
      <div className="max-w-2xl">
        <p className="eyebrow">БАЗА ЗНАНИЙ</p>
        <h1 className="mt-2 text-[36px] font-black leading-none tracking-[-0.04em]">
          Знания
        </h1>
        <p className="mt-3 text-pretty text-[15px] leading-6 text-[var(--bf-muted)]">
          Развиваемся вместе. Ищи по теме, слову или содержанию статьи.
        </p>

        {state.status === "ready" ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[var(--bf-dim)]">
            <span>
              Прочитано: {readCount}/{articles.length}
            </span>
            <span aria-hidden>·</span>
            <span>
              {progress.state.source === "profile"
                ? "прогресс синхронизирован"
                : "прогресс на устройстве"}
            </span>
            <Button
              asChild
              variant="secondary"
              className="ml-auto h-9 min-h-9 px-3 text-xs"
            >
              <Link to="/attestation">Аттестация</Link>
            </Button>
          </div>
        ) : null}
      </div>

      <div className="relative mt-5">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--bf-dim)]"
          aria-hidden
        />
        <label className="sr-only" htmlFor="knowledge-search">
          Поиск по базе знаний
        </label>
        <Input
          id="knowledge-search"
          type="search"
          value={query}
          placeholder="Например: виски, жалоба, подача…"
          className="pl-10"
          onChange={(event) => updateParam("q", event.target.value)}
        />
      </div>

      {state.status === "loading" ? (
        <div className="mt-6" aria-label="Загрузка статей">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-[116px] animate-pulse border-b border-[var(--bf-line)] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.025),transparent)]"
            />
          ))}
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-6 border-y border-[var(--bf-line)] py-6">
          <p className="text-lg font-extrabold">
            Материалы сейчас недоступны
          </p>
          <p className="mt-1 max-w-lg text-sm leading-6 text-[var(--bf-muted)]">
            Не удалось открыть файл базы знаний. В установленной PWA материалы
            будут доступны после первого успешного обновления версии.
          </p>
          <Button className="mt-4" onClick={reload}>
            <RefreshCw className="size-4" aria-hidden />
            Повторить
          </Button>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <>
          <div
            className="bf-scrollbar-none -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1"
            role="group"
            aria-label="Категории базы знаний"
          >
            {categories.map((item) => {
              const active = item === category;

              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateParam("cat", item)}
                  className={cn(
                    "min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold outline-none transition-[background-color,border-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]",
                    active
                      ? "border-[var(--bf-copper)] bg-[var(--bf-copper)] text-[#fff8ed]"
                      : "border-[var(--bf-line)] bg-transparent text-[var(--bf-muted)]"
                  )}
                >
                  {item}
                </button>
              );
            })}
          </div>

          <div
            className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--bf-dim)]"
            aria-live="polite"
          >
            <span>Найдено: {filtered.length}</span>
            {progress.state.loading ? <span>синхронизация…</span> : null}
          </div>

          <div className="mt-2 border-t border-[var(--bf-line)]">
            {filtered.length ? (
              filtered.map((article) => (
                <KnowledgeRow
                  key={article.id}
                  article={article}
                  read={progress.state.readIds.has(article.id)}
                  from={from}
                  onOpen={() => {
                    try {
                      sessionStorage.setItem(
                        SCROLL_KEY,
                        JSON.stringify({ path: from, y: window.scrollY })
                      );
                    } catch {
                      // Non-critical browser storage failure.
                    }
                  }}
                />
              ))
            ) : (
              <div className="border-b border-[var(--bf-line)] py-8">
                <p className="font-extrabold">Ничего не найдено</p>
                <p className="mt-1 text-sm text-[var(--bf-muted)]">
                  Попробуй другое слово или категорию.
                </p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
