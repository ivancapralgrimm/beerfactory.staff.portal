import {
  BookOpen,
  ChevronRight,
  Search,
  UtensilsCrossed
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { useKnowledgeArticles } from "@/features/knowledge/use-knowledge";
import {
  categoryLabel,
  isArchive,
  loadRecipes
} from "@/features/recipes/recipe-data";
import type { Recipe } from "@/features/recipes/types";

const MAX_RESULTS = 8;

function normalize(value: string) {
  return String(value ?? "")
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/g, " ")
    .trim();
}

function recipeSearchText(recipe: Recipe) {
  return normalize([
    recipe.name,
    recipe.category,
    categoryLabel(recipe.category),
    recipe.subcategory,
    recipe.desc,
    recipe.method,
    recipe.serving,
    recipe.venue,
    recipe.venue === "BF/BB" ? "общая позиция bf bb" : "",
    ...recipe.ingredients,
    ...recipe.tags
  ].join(" "));
}

function score(title: string, category: string, haystack: string, query: string) {
  const normalizedTitle = normalize(title);
  const normalizedCategory = normalize(category);

  if (normalizedTitle === query) return 0;
  if (normalizedTitle.startsWith(query)) return 1;
  if (normalizedTitle.includes(query)) return 2;
  if (normalizedCategory.includes(query)) return 3;
  if (haystack.includes(query)) return 4;
  return Number.POSITIVE_INFINITY;
}

export function DashboardGlobalSearch() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(normalize(query));
  const knowledge = useKnowledgeArticles();
  const active = deferredQuery.length >= 2;
  const [recipeState, setRecipeState] = useState<{
    status: "idle" | "loading" | "ready" | "error";
    recipes: Recipe[];
  }>({ status: "idle", recipes: [] });

  useEffect(() => {
    if (!active) return;

    let alive = true;
    setRecipeState((current) =>
      current.status === "ready"
        ? current
        : { status: "loading", recipes: current.recipes }
    );

    void loadRecipes()
      .then((data) => {
        if (alive) {
          setRecipeState({ status: "ready", recipes: data.recipes });
        }
      })
      .catch(() => {
        if (alive) {
          setRecipeState((current) => ({
            status: "error",
            recipes: current.recipes
          }));
        }
      });

    return () => {
      alive = false;
    };
  }, [active, deferredQuery]);

  const results = useMemo(() => {
    if (!active) return [];

    const items: Array<{
      key: string;
      href: string;
      title: string;
      kicker: string;
      kind: "recipe" | "knowledge";
      score: number;
    }> = [];

    if (recipeState.status === "ready") {
      for (const recipe of recipeState.recipes) {
        const haystack = recipeSearchText(recipe);
        if (!haystack.includes(deferredQuery)) continue;

        items.push({
          key: `recipe:${recipe.id}`,
          href: `/menu/${encodeURIComponent(recipe.id)}`,
          title: recipe.name,
          kicker: `Рецепты · ${categoryLabel(recipe.category) || "Меню"}${
            isArchive(recipe) ? " · Архив" : ""
          }`,
          kind: "recipe",
          score: score(
            recipe.name,
            recipe.category,
            haystack,
            deferredQuery
          )
        });
      }
    }

    if (knowledge.state.status === "ready") {
      for (const article of knowledge.state.articles) {
        const haystack = normalize([
          article.title,
          article.category,
          article.excerpt,
          article.body
        ].join(" "));
        if (!haystack.includes(deferredQuery)) continue;

        items.push({
          key: `knowledge:${article.id}`,
          href: `/knowledge/${encodeURIComponent(article.id)}`,
          title: article.title,
          kicker: `Знания · ${article.category}`,
          kind: "knowledge",
          score: score(
            article.title,
            article.category,
            haystack,
            deferredQuery
          )
        });
      }
    }

    return items
      .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, "ru"))
      .slice(0, MAX_RESULTS);
  }, [active, deferredQuery, knowledge.state, recipeState]);

  const loading =
    active &&
    (recipeState.status === "loading" || knowledge.state.status === "loading");
  const unavailable =
    active &&
    recipeState.status === "error" &&
    knowledge.state.status === "error";

  return (
    <Surface className="p-3.5" aria-label="Быстрый поиск по порталу">
      <label htmlFor="dashboard-global-search" className="block">
        <span className="eyebrow">БЫСТРЫЙ ПОИСК</span>
        <div className="relative mt-2">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--bf-dim)]"
            aria-hidden
          />
          <Input
            id="dashboard-global-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Рецепт, ингредиент, инструкция…"
            className="pl-10"
          />
        </div>
      </label>

      {active ? (
        <div className="mt-2 grid gap-1.5" aria-live="polite">
          {results.length ? (
            results.map((item) => {
              const Icon = item.kind === "recipe" ? UtensilsCrossed : BookOpen;

              return (
                <Link
                  key={item.key}
                  to={item.href}
                  state={{ from: "/" }}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 py-2 outline-none transition-[border-color,transform] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)] active:translate-y-px"
                >
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] text-[var(--bf-copper-hi)]">
                    <Icon className="size-4" aria-hidden />
                  </div>
                  <span className="min-w-0 flex-1">
                    <small className="block truncate text-[9px] font-black uppercase tracking-[0.1em] text-[var(--bf-dim)]">
                      {item.kicker}
                    </small>
                    <strong className="mt-0.5 block truncate text-sm text-[var(--bf-cream)]">
                      {item.title}
                    </strong>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-[var(--bf-copper-hi)]" aria-hidden />
                </Link>
              );
            })
          ) : loading ? (
            <p className="px-1 py-2 text-xs text-[var(--bf-dim)]">Ищем…</p>
          ) : unavailable ? (
            <p className="px-1 py-2 text-xs text-[var(--bf-muted)]">
              Поиск сейчас недоступен.
            </p>
          ) : (
            <p className="px-1 py-2 text-xs text-[var(--bf-dim)]">
              Ничего не найдено.
            </p>
          )}
        </div>
      ) : null}
    </Surface>
  );
}
