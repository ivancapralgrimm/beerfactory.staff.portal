import { categoryLabel, isArchive, recipeMatchesVenueCategory, recipeVenueCategory, recipeVenueMatches } from "./recipe-data";
import type { Recipe } from "./types";

export function searchableRecipeText(recipe: Recipe) {
  return [recipe.name, recipe.category, categoryLabel(recipe.category), recipe.subcategory,
    recipe.desc, recipe.method, recipe.serving, recipe.venue,
    recipeVenueMatches(recipe, "BF") ? categoryLabel(recipeVenueCategory(recipe, "BF")) : "",
    recipeVenueMatches(recipe, "BB") ? categoryLabel(recipeVenueCategory(recipe, "BB")) : "",
    recipe.venue === "BF/BB" ? "общая позиция bf bb" : "",
    ...recipe.ingredients, ...recipe.tags].join(" ").toLocaleLowerCase("ru");
}

export function recipeCategories(recipes: Recipe[]) {
  const categories = new Set<string>();
  recipes.filter((recipe) => !isArchive(recipe)).forEach((recipe) => {
    if (recipeVenueMatches(recipe, "BF")) categories.add(recipeVenueCategory(recipe, "BF"));
    if (recipeVenueMatches(recipe, "BB")) categories.add(recipeVenueCategory(recipe, "BB"));
  });
  return ["Все", ...Array.from(categories).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), "ru")),
    ...(recipes.some(isArchive) ? ["Архив"] : [])];
}

export function filterRecipes(recipes: Recipe[], category: string, query: string, venue?: "BF" | "BB") {
  const search = query.trim().toLocaleLowerCase("ru");
  return recipes.filter((recipe) => {
    if (venue && !recipeVenueMatches(recipe, venue)) return false;
    const archived = isArchive(recipe);
    const categoryMatch = category === "Архив" ? archived
      : category === "Все" ? Boolean(search) || !archived
        : !archived && recipeMatchesVenueCategory(recipe, category);
    return categoryMatch && (!search || searchableRecipeText(recipe).includes(search));
  }).sort((a, b) => {
    if (search && category === "Все") {
      const archiveOrder = Number(isArchive(a)) - Number(isArchive(b));
      if (archiveOrder) return archiveOrder;
    }
    return a.name.localeCompare(b.name, "ru");
  });
}

export function recipeComposition(recipe: Recipe) {
  const lines = recipe.method.split(/\r?\n/);
  const inline = !recipe.ingredients.length ? lines[0]?.match(/^\s*Состав\s*:\s*(.+)\s*$/iu) : null;
  return {
    ingredients: inline ? inline[1].split(/[,;]+/u).map((part) => part.trim()).filter(Boolean) : recipe.ingredients,
    method: inline ? lines.slice(1).join("\n").trim() : recipe.method
  };
}

/** Only known local catalogue locations may be used as a detail return target. */
export function recipeBackTarget(state: unknown) {
  const from = state && typeof state === "object" && "from" in state ? state.from : null;
  return typeof from === "string" && /^\/(?:menu|recipes|settings\/recipes)(?:\?|$)/.test(from) ? from : "/menu";
}
