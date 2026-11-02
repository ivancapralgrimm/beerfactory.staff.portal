import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WarmBack } from "@/components/warm/WarmBack";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmEmpty, WarmNotice, WarmTitle } from "@/components/warm/WarmPage";
import { useAuth } from "@/features/auth/auth-context";
import { RecipeEditor } from "./RecipeEditor";
import { RecipeMaterialActions } from "./RecipeMaterialActions";
import { categoryLabel, isArchive, resolveRecipe } from "./recipe-data";
import { filterRecipes, recipeCategories } from "./recipe-presentation";
import { useRecipes } from "./use-recipes";
import type { Recipe } from "./types";
import { canManageRecipesClient } from "@/types/auth";
import "./recipes.css";

const SCROLL_KEY = "bf-r404-recipes-scroll";

function RecipeRow({ recipe, from, onOpen }: { recipe: Recipe; from: string; onOpen: () => void }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  return <Link to={`/menu/${encodeURIComponent(recipe.id)}`} state={{ from }} onClick={onOpen}
    className="bf-recipe-item warm-recipe-card" aria-label={`Открыть рецепт ${recipe.name}${isArchive(recipe) ? ", архив" : ""}`}>
    {recipe.photo && !photoFailed ? <img src={recipe.photo} alt="" loading="lazy" onError={() => setPhotoFailed(true)} />
      : <span className="bf-recipe-placeholder warm-recipe-placeholder"><WarmIcon name="recipes" size={26} /></span>}
    <span className="warm-recipe-card-copy">
      <span className="small muted">{categoryLabel(recipe.category)}{isArchive(recipe) ? " · Архив" : ""}</span>
      <span className="warm-recipe-card-title">{recipe.name}</span>
      {recipe.serving ? <span className="small muted">{recipe.serving}</span> : null}
    </span>
    <WarmIcon name="chevron" size={20} />
  </Link>;
}

export function RecipesPage() {
  const { state, reload } = useRecipes();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [refreshing, setRefreshing] = useState(false);
  const management = location.pathname.startsWith("/settings/");
  const canManage = authState.status === "authenticated" && canManageRecipesClient(authState.user);
  const accessToken = authState.status === "authenticated" ? authState.session.access_token : null;
  const query = params.get("q") || "";
  const deferredQuery = useDeferredValue(query);
  const data = state.status === "ready" ? state.data : null;
  const recipes = data?.recipes || [];
  const categories = useMemo(() => recipeCategories(recipes), [recipes]);
  const requestedCategory = params.get("cat") || "Все";
  const category = categories.includes(requestedCategory) ? requestedCategory : "Все";
  const filtered = useMemo(() => filterRecipes(recipes, category, deferredQuery), [recipes, category, deferredQuery]);
  const editorId = params.get("editor");
  const editorRecipe = editorId && editorId !== "new" ? resolveRecipe(recipes, editorId) : undefined;
  const editorOpen = Boolean(editorId && canManage && accessToken);
  const from = `${location.pathname}${location.search}`;

  useEffect(() => {
    const legacy = params.get("recipe");
    if (legacy) navigate(`/menu/${encodeURIComponent(legacy)}`, { replace: true });
  }, [navigate, params]);

  useEffect(() => {
    if (state.status !== "ready" || editorOpen) return;
    try {
      const stored = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || "null") as { path?: string; y?: number } | null;
      if (stored?.path === from && typeof stored.y === "number" && stored.y > 0) {
        requestAnimationFrame(() => window.scrollTo(0, stored.y || 0));
      }
    } catch { /* Scroll restoration must not block the catalogue. */ }
  }, [from, state.status, editorOpen]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || (key === "cat" && value === "Все")) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  async function refresh() {
    setRefreshing(true);
    try { await reload(); } finally { setRefreshing(false); }
  }

  if (editorOpen && accessToken && state.status === "ready") {
    return <section className="warm-recipes-page">
      <WarmBack to={editorRecipe ? `/menu/${encodeURIComponent(editorRecipe.id)}` : management ? "/settings/recipes" : "/menu"} label={editorRecipe ? "К рецепту" : "В рецепты"} />
      {editorId === "new" || editorRecipe ? <RecipeEditor accessToken={accessToken} mode={editorId === "new" ? "create" : "edit"} recipe={editorRecipe} recipes={recipes} lifecycleAvailable={data?.capabilities.materialLifecycle === true} photoCleanupAvailable={data?.capabilities.photoCleanup === true}
        onCancel={() => updateParam("editor", "")}
        onSaved={async (id) => { await reload(); navigate(`/menu/${encodeURIComponent(id)}`, { state: { from: management ? "/settings/recipes" : "/menu" } }); }} />
        : <WarmEmpty title="Рецепт не найден" body="Возможно, позиция была удалена." />}
      {editorRecipe ? <RecipeMaterialActions accessToken={accessToken} recipe={editorRecipe} lifecycleAvailable={data?.capabilities.materialLifecycle === true} onChanged={reload} onDeleted={() => { updateParam("editor", ""); }} /> : null}
    </section>;
  }

  return <section className="warm-recipes-page">
    <WarmBack to={management ? "/settings" : "/"} label={management ? "В настройки" : "На главную"} />
    <WarmTitle title={management ? "Редактор рецептов" : "Рецепты"} description="Состав и технология под рукой."
      action={canManage && accessToken ? <Button type="button" size="icon" aria-label="Добавить рецепт" onClick={() => updateParam("editor", "new")}><WarmIcon name="plus" /></Button> : undefined} />
    {editorId && !canManage ? <WarmNotice error>У вас нет прав на редактирование рецептов.</WarmNotice> : null}
    <div className="warm-recipe-filters">
      <label className="bf-field warm-recipe-field"><span className="bf-field-label">Найти рецепт</span><Input type="search" value={query} placeholder="Название или ингредиент" onChange={(event) => updateParam("q", event.target.value)} /></label>
      <label className="bf-field warm-recipe-field"><span className="bf-field-label">Категория</span><select value={category} onChange={(event) => updateParam("cat", event.target.value)}>{categories.map((item) => <option key={item} value={item}>{categoryLabel(item)}</option>)}</select></label>

    </div>
    {data?.source === "cache-offline" || data?.source === "legacy-cache" ? <WarmNotice>Нет связи · показана сохранённая версия{data.syncedAt ? ` от ${new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(data.syncedAt))}` : ""}.</WarmNotice> : null}
    {state.status === "loading" ? <p className="small muted" role="status">Загружаем рецепты…</p> : null}
    {state.status === "error" ? <><WarmEmpty title="Рецепты сейчас недоступны" body="Проверьте подключение и попробуйте ещё раз." /><Button onClick={() => void refresh()} disabled={refreshing}>{refreshing ? "Обновляем…" : "Повторить"}</Button></> : null}
    {state.status === "ready" ? <>
      <div className="warm-recipe-results"><p className="small muted" aria-live="polite">Найдено: {filtered.length}{deferredQuery.trim() && filtered.some(isArchive) ? ` · архив: ${filtered.filter(isArchive).length}` : ""}</p><Button variant="ghost" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? "Обновляем…" : "Обновить"}</Button></div>
      {filtered.length ? <div className="recipe-grid">{filtered.map((recipe) => <RecipeRow key={`${recipe.id}:${recipe.photo}`} recipe={recipe} from={from} onOpen={() => {
        try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ path: from, y: window.scrollY })); } catch { /* Optional browser storage. */ }
      }} />)}</div> : <><WarmEmpty title="По этому запросу рецептов нет" body="Попробуй другой ингредиент или убери фильтры." /><Button onClick={() => setParams({}, { replace: true })}>Сбросить фильтры</Button></>}
    </> : null}
  </section>;
}
