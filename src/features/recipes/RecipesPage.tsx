import {
  Archive,
  ChevronRight,
  RefreshCw,
  Search,
  WifiOff
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  categoryLabel,
  isArchive
} from "@/features/recipes/recipe-data";
import { useRecipes } from "@/features/recipes/use-recipes";
import type { Recipe } from "@/features/recipes/types";
import { cn } from "@/lib/utils";

const SCROLL_KEY = "bf-r404-recipes-scroll";

function searchableText(recipe: Recipe) {
  return [
    recipe.name,
    recipe.category,
    categoryLabel(recipe.category),
    recipe.subcategory,
    recipe.desc,
    ...recipe.ingredients,
    ...recipe.tags
  ]
    .join(" ")
    .toLowerCase();
}

function syncLabel(source: string, syncedAt: number | null) {
  if (source !== "cache-offline" && source !== "legacy-cache") return "";

  if (!syncedAt) return "Нет связи с сервером · показана сохранённая версия";

  return `Нет связи с сервером · сохранено ${new Intl.DateTimeFormat(
    "ru-RU",
    {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(new Date(syncedAt))}`;
}

function RecipeRow({
  recipe,
  from,
  onOpen
}: {
  recipe: Recipe;
  from: string;
  onOpen: () => void;
}) {
  const archived = isArchive(recipe);

  return (
    <Link
      to={`/menu/${encodeURIComponent(recipe.id)}`}
      state={{ from }}
      onClick={onOpen}
      className={cn(
        "group grid min-h-[88px] grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--bf-line)] py-3.5 outline-none transition-[background-color,color] duration-150 focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]",
        "recipe-list-row",
        archived
          ? "text-[var(--bf-muted)]"
          : "text-[var(--bf-cream)]"
      )}
      aria-label={`Открыть рецепт ${recipe.name}${archived ? ", архив" : ""}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-[10px] font-black uppercase tracking-[0.14em]",
              archived
                ? "text-[var(--bf-dim)]"
                : "text-[var(--bf-copper-hi)]"
            )}
          >
            {categoryLabel(recipe.category) || "Меню"}
          </span>
          {archived ? (
            <span className="inline-flex min-h-6 items-center gap-1 rounded-full border border-[var(--bf-line)] px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--bf-dim)]">
              <Archive className="size-3" aria-hidden />
              Архив
            </span>
          ) : null}
        </div>

        <h2 className="mt-1 text-[18px] font-extrabold leading-6 tracking-[-0.015em]">
          {recipe.name}
        </h2>

        {recipe.tags.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recipe.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[color:color-mix(in_srgb,var(--bf-line),transparent_15%)] px-2 py-1 text-[10px] font-bold text-[var(--bf-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid size-9 place-items-center rounded-full border border-[var(--bf-line)] text-[var(--bf-copper-hi)] transition-[border-color,background-color] duration-150 group-hover:border-[var(--bf-line-strong)] group-hover:bg-[var(--bf-surface)]">
        <ChevronRight className="size-5" aria-hidden />
      </div>
    </Link>
  );
}

export function RecipesPage() {
  const { state, reload } = useRecipes();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  const query = params.get("q") || "";
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const requestedCategory = params.get("cat") || "Все";

  useEffect(() => {
    const legacy = new URLSearchParams(window.location.search).get("recipe");
    if (!legacy) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("recipe");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );

    navigate(`/menu/${encodeURIComponent(legacy)}`, { replace: true });
  }, [navigate]);

  const data = state.status === "ready" ? state.data : null;
  const recipes = data?.recipes || [];

  const categories = useMemo(() => {
    const unique = new Set(
      recipes
        .filter((recipe) => !isArchive(recipe))
        .map((recipe) => recipe.category)
        .filter(Boolean)
    );

    const values = ["Все", ...unique];
    if (recipes.some(isArchive)) values.push("Архив");
    return values;
  }, [recipes]);

  const category = categories.includes(requestedCategory)
    ? requestedCategory
    : "Все";

  const filtered = useMemo(() => {
    const result = recipes.filter((recipe) => {
      const archived = isArchive(recipe);

      const categoryMatch =
        category === "Архив"
          ? archived
          : category === "Все"
            ? deferredQuery
              ? true
              : !archived
            : !archived && recipe.category === category;

      if (!categoryMatch) return false;
      if (!deferredQuery) return true;

      return searchableText(recipe).includes(deferredQuery);
    });

    return result.sort((a, b) => {
      if (deferredQuery && category === "Все") {
        const archiveOrder = Number(isArchive(a)) - Number(isArchive(b));
        if (archiveOrder !== 0) return archiveOrder;
      }

      return a.name.localeCompare(b.name, "ru");
    });
  }, [category, deferredQuery, recipes]);

  useEffect(() => {
    if (state.status !== "ready") return;

    try {
      const stored = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || "null") as
        | { path?: string; y?: number }
        | null;
      const path = `${location.pathname}${location.search}`;

      if (
        stored?.path === path &&
        typeof stored.y === "number" &&
        stored.y > 0
      ) {
        requestAnimationFrame(() => window.scrollTo(0, stored.y || 0));
      }
    } catch {
      // Scroll restoration is optional. Broken sessionStorage must not block Recipes.
    }
  }, [location.pathname, location.search, state.status]);

  function updateParam(key: "q" | "cat", value: string) {
    const next = new URLSearchParams(params);

    if (!value || (key === "cat" && value === "Все")) next.delete(key);
    else next.set(key, value);

    setParams(next, { replace: true });
  }

  const archiveCount = filtered.filter(isArchive).length;
  const from = `${location.pathname}${location.search}`;
  const offlineMessage = data
    ? syncLabel(data.source, data.syncedAt)
    : "";

  return (
    <section className="pb-4">
      <div className="max-w-2xl">
        <p className="eyebrow">РЕЦЕПТЫ · NOCODB</p>
        <h1 className="mt-2 text-[36px] font-black leading-none tracking-[-0.04em]">
          Рецепты
        </h1>
        <p className="mt-3 text-pretty text-[15px] leading-6 text-[var(--bf-muted)]">
          Поиск по названию, категории, составу и тегам. Архив не мешает
          текущему меню, но остаётся доступен для справки.
        </p>
      </div>

      <div className="relative mt-5">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--bf-dim)]"
          aria-hidden
        />
        <label className="sr-only" htmlFor="recipe-search">
          Поиск по рецептам
        </label>
        <Input
          id="recipe-search"
          type="search"
          value={query}
          placeholder="Название, ингредиент, категория…"
          className="pl-10"
          onChange={(event) => updateParam("q", event.target.value)}
        />
      </div>

      {offlineMessage ? (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 border-y border-[color:color-mix(in_srgb,var(--bf-gold),transparent_72%)] py-2.5 text-xs leading-5 text-[var(--bf-muted)]"
        >
          <WifiOff
            className="mt-0.5 size-4 shrink-0 text-[var(--bf-gold)]"
            aria-hidden
          />
          <span>{offlineMessage}</span>
        </div>
      ) : null}

      {state.status === "loading" ? (
        <div className="mt-6 space-y-0" aria-label="Загрузка рецептов">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-[88px] animate-pulse border-b border-[var(--bf-line)] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.025),transparent)]"
            />
          ))}
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-6 border-y border-[var(--bf-line)] py-6">
          <p className="text-lg font-extrabold">
            Рецепты сейчас недоступны
          </p>
          <p className="mt-1 max-w-lg text-sm leading-6 text-[var(--bf-muted)]">
            Сервер не ответил, а сохранённой версии на этом устройстве ещё нет.
            После первого успешного открытия рецепты будут доступны и при
            временной потере сети.
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
            aria-label="Категории рецептов"
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
                  {categoryLabel(item)}
                </button>
              );
            })}
          </div>

          <div
            className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--bf-dim)]"
            aria-live="polite"
          >
            <span>
              Найдено: {filtered.length}
              {deferredQuery && archiveCount
                ? ` · архив: ${archiveCount}`
                : ""}
            </span>
            {state.data.source === "api" ? (
              <span className="text-[var(--bf-green)]">актуально</span>
            ) : null}
          </div>

          <div className="mt-2 border-t border-[var(--bf-line)]">
            {filtered.length ? (
              filtered.map((recipe) => (
                <RecipeRow
                  key={recipe.id}
                  recipe={recipe}
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
                  Попробуй убрать часть запроса или выбрать другую категорию.
                </p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
