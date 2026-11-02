import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WarmBack } from "@/components/warm/WarmBack";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmEmpty, WarmNotice, WarmTitle } from "@/components/warm/WarmPage";
import { useAuth } from "@/features/auth/auth-context";
import { categoryLabel, isArchive, resolveRecipe } from "./recipe-data";
import { isCalculable, RecipeCalculator } from "./recipe-calculator";
import { RecipePhotoDialog } from "./recipe-photo-dialog";
import { RecipeMaterialActions } from "./RecipeMaterialActions";
import { recipeBackTarget, recipeComposition } from "./recipe-presentation";
import { useRecipes } from "./use-recipes";
import { canManageRecipesClient } from "@/types/auth";
import "./recipes.css";

function safeDecode(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export function RecipeDetailPage() {
  const { recipeId = "" } = useParams();
  const requestedId = safeDecode(recipeId);
  const { state, reload } = useRecipes();
  const { state: authState } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const data = state.status === "ready" ? state.data : null;
  const recipe = useMemo(() => data ? resolveRecipe(data.recipes, requestedId) : undefined, [data, requestedId]);
  const canManage = authState.status === "authenticated" && canManageRecipesClient(authState.user);
  const canViewMetadata = authState.status === "authenticated" && (authState.user.is_owner || authState.user.role === "admin");
  const accessToken = authState.status === "authenticated" ? authState.session.access_token : null;
  const backTarget = recipeBackTarget(location.state);

  useEffect(() => {
    if (recipe && recipe.id !== requestedId) navigate(`/menu/${encodeURIComponent(recipe.id)}`, { replace: true, state: location.state });
  }, [location.state, navigate, recipe, requestedId]);
  useEffect(() => {
    window.scrollTo(0, 0);
    setPhotoFailed(false);
    setPhotoOpen(false);
    setShareStatus("");
  }, [requestedId, recipe?.photo]);

  async function shareRecipe() {
    if (!recipe) return;
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${recipe.name} · BeerFactory`, text: `${recipe.name} · техкарта BeerFactory`, url }); return; }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); setShareStatus("Ссылка скопирована"); }
    catch { setShareStatus("Не удалось скопировать ссылку"); }
  }

  const back = <WarmBack to={backTarget} label="В рецепты" />;
  if (state.status === "loading") return <section className="warm-recipes-page">{back}<p className="small muted" role="status">Загружаем рецепт…</p></section>;
  if (state.status === "error") return <section className="warm-recipes-page">{back}<WarmEmpty title="Не удалось загрузить рецепт" body="Сервер недоступен, а локальной копии на этом устройстве нет." /><Button onClick={() => void reload()}>Повторить</Button></section>;
  if (!recipe) return <section className="warm-recipes-page">{back}<WarmEmpty title="Рецепт не найден" body="Возможно, позиция была переименована или удалена." /></section>;

  const archived = isArchive(recipe);
  const { ingredients, method } = recipeComposition(recipe);
  const metadata = [
    ["Заведение", recipe.venue === "BF/BB" ? "BF / BB · общая позиция" : recipe.venue],
    recipe.subcategory ? ["Подкатегория", recipe.subcategory] : null,
    recipe.version ? ["Версия", recipe.version] : null,
    recipe.updatedAt ? ["Обновлено", recipe.updatedAt] : null,
    recipe.updatedBy ? ["Изменил", recipe.updatedBy] : null
  ].filter(Boolean) as string[][];

  return <article className="warm-recipes-page warm-recipe-detail">
    {back}
    <WarmTitle title={recipe.name} action={<div className="warm-recipe-heading-actions">{canManage && accessToken ? <Button type="button" size="icon" aria-label="Редактировать рецепт" onClick={() => navigate(`/settings/recipes?editor=${encodeURIComponent(recipe.id)}`)}><WarmIcon name="edit" /></Button> : null}<Button type="button" size="icon" aria-label="Поделиться рецептом" title="Поделиться рецептом" onClick={() => void shareRecipe()}><WarmIcon name="share" /></Button></div>} />
    {recipe.tags.length ? <div className="actions bf-recipe-tags warm-recipe-tags">{recipe.tags.map((tag, index) => <span className="pill" key={`${tag}-${index}`}>{tag}</span>)}</div> : null}
    <div className="warm-recipe-yield"><span>{recipe.serving || "Выход не указан"}</span><span className="small muted">{categoryLabel(recipe.category)}</span></div>
    {archived ? <WarmNotice><span className="warm-recipe-inline"><WarmIcon name="archive" size={18} />Позиция находится в архиве.</span></WarmNotice> : null}
    {recipe.photo && !photoFailed ? <figure className="bf-recipe-photo warm-recipe-photo"><img src={recipe.photo} alt={recipe.name} loading="eager" fetchPriority="high" onError={() => { setPhotoFailed(true); setPhotoOpen(false); }} /><button className="bf-photo-button" type="button" onClick={() => setPhotoOpen(true)}>Открыть фото<WarmIcon name="expand" size={18} /></button></figure>
      : <p className="small muted">{photoFailed ? "Фото не удалось загрузить." : "Фото пока не добавлено."}</p>}
    <section className="warm-recipe-section" aria-labelledby="recipe-ingredients-title">
      <div className="warm-recipe-section-heading"><h2 id="recipe-ingredients-title">Состав</h2><span className="small muted">{archived ? "Архив" : "Актуальный"} · {recipe.source === "kitchen" ? "Кухня" : "Бар"}</span></div>
      {ingredients.length ? <ul className="bf-composition warm-recipe-composition">{ingredients.map((ingredient, index) => <li key={`${index}-${ingredient}`}>{ingredient}</li>)}</ul> : <p className="small muted mt-3">Состав не указан.</p>}
    </section>
    {isCalculable(recipe) ? <details className="warm-recipe-disclosure"><summary>Расчёт количества<WarmIcon name="chevron" size={18} /></summary><div className="warm-recipe-disclosure-body"><RecipeCalculator key={recipe.id} recipe={recipe} /></div></details> : null}
    {method ? <details className="warm-recipe-disclosure"><summary>{recipe.source === "kitchen" ? "Описание / технология" : "Приготовление"}<WarmIcon name="chevron" size={18} /></summary><p className="bf-article warm-recipe-disclosure-body warm-recipe-method">{method}</p></details> : null}
    {recipe.changeNote ? <section className="warm-recipe-section"><h2>Что изменилось</h2><p className="warm-recipe-method mt-3">{recipe.changeNote}</p></section> : null}
    {canManage && accessToken ? <RecipeMaterialActions accessToken={accessToken} recipe={recipe} lifecycleAvailable={data?.capabilities.materialLifecycle === true} onChanged={reload} onDeleted={() => navigate(backTarget, { replace: true })} /> : null}
    <p className="small muted" role="status">{shareStatus}</p>
    {data?.source === "cache-offline" || data?.source === "legacy-cache" ? <WarmNotice>Показана последняя сохранённая версия рецепта.</WarmNotice> : null}
    {recipe.photo && !photoFailed ? <RecipePhotoDialog open={photoOpen} src={recipe.photo} alt={recipe.name} onClose={() => setPhotoOpen(false)} /> : null}
    {canViewMetadata ? <details className="warm-recipe-disclosure"><summary>Данные рецепта<WarmIcon name="chevron" size={18} /></summary><dl className="warm-recipe-disclosure-body warm-recipe-metadata">{metadata.map(([label, value]) => <div key={label}><dt className="small muted">{label}</dt><dd>{value}</dd></div>)}</dl></details> : null}
  </article>;
}
