import {matchesBeerMap,beerMapSearchResult} from "@/features/beer/beer-search";
import {WarmIcon} from "@/components/warm/WarmIcon";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
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
      kind: "recipe" | "knowledge" | "beer";
      score: number;
    }> = [];

    if (matchesBeerMap(deferredQuery)) {
      items.push({key: "beer-map", href: beerMapSearchResult.path, title: beerMapSearchResult.title, kicker: beerMapSearchResult.kind, kind: "beer", score: beerMapSearchResult.rank});
    }

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
          article.searchText ?? article.body
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

  return <section className="warm-home-search" role="search" aria-label="Поиск по материалам">
    <label htmlFor="dashboard-global-search" className="bf-field-label">Быстрый поиск</label>
    <Input id="dashboard-global-search" type="search" autoComplete="off" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Рецепт, ингредиент, инструкция"/>
    {active&&<div className="grid gap-2 mt-3" aria-live="polite">{results.length?results.map(item=><Link key={item.key} to={item.href} state={{from:'/'}} className="bf-nav-row"><span className="bf-nav-copy"><strong className="bf-nav-title">{item.title}</strong><span className="bf-nav-meta">{item.kicker}</span></span><WarmIcon name="chevron" size={18}/></Link>):<p className="small muted">{loading?'Ищем…':unavailable?'Поиск сейчас недоступен.':'Ничего не найдено.'}</p>}</div>}
  </section>;
}
