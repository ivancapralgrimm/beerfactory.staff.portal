import { config } from "@/lib/config";
import { loadRecipes } from "@/features/recipes/recipe-data";
import type { Recipe } from "@/features/recipes/types";

export type AdminRecipeSource = "bar" | "kitchen";
export type AdminRecipeStatus = "Актуальный" | "Архив" | "Черновик";

export type AdminRecipeInput = {
  source: AdminRecipeSource;
  name: string;
  category: string;
  status: AdminRecipeStatus;
  description: string;
  ingredients: string;
  method: string;
  serving: string;
  tags: string;
  changeNote: string;
  removePhoto?: boolean;
};

export type AdminRecipeListResponse = {
  recipes: Recipe[];
};

export type AdminRecipeMutationResponse = {
  ok: true;
  id: string;
  recordId: string;
  source: AdminRecipeSource;
  recipe?: Recipe;
};

export class AdminRecipeApiError extends Error {
  code: string;
  payload: Record<string, unknown>;

  constructor(code: string, payload: Record<string, unknown> = {}) {
    super(code);
    this.code = code;
    this.payload = payload;
  }
}

async function jsonOrEmpty(response: Response) {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`
  };
}

export async function loadAdminRecipes(
  accessToken: string
): Promise<AdminRecipeListResponse> {
  const response = await fetch(
    `${config.recipeApiBase}/admin/recipes`,
    {
      headers: authHeaders(accessToken),
      cache: "no-store"
    }
  );

  const data = await jsonOrEmpty(response);

  // The frontend package may be previewed before the Worker extension is
  // deployed. Fall back to the existing public menu for read-only visual QA.
  if (response.status === 404 || response.status === 405) {
    const publicData = await loadRecipes({ force: true });
    return { recipes: publicData.recipes };
  }

  if (!response.ok) {
    throw new AdminRecipeApiError(
      String(data.error || "admin_recipes_load_failed"),
      data
    );
  }

  const recipes = Array.isArray(data.recipes)
    ? data.recipes as unknown as Recipe[]
    : [];

  return { recipes };
}

function mutationForm(
  input: AdminRecipeInput,
  photo?: File | null
) {
  const form = new FormData();

  form.set(
    "payload",
    JSON.stringify({
      name: input.name.trim(),
      category: input.category.trim(),
      status: input.status,
      description: input.description.trim(),
      ingredients: input.ingredients.trim(),
      method: input.method.trim(),
      serving: input.serving.trim(),
      tags: input.tags.trim(),
      change_note: input.changeNote.trim(),
      remove_photo: input.removePhoto === true
    })
  );

  if (photo) {
    form.set("photo", photo, photo.name);
  }

  return form;
}

async function mutateRecipe(
  accessToken: string,
  method: "POST" | "PATCH",
  source: AdminRecipeSource,
  input: AdminRecipeInput,
  photo?: File | null,
  recordId?: string
) {
  const suffix = recordId
    ? `/${encodeURIComponent(recordId)}`
    : "";

  const response = await fetch(
    `${config.recipeApiBase}/admin/recipes/${source}${suffix}`,
    {
      method,
      headers: authHeaders(accessToken),
      body: mutationForm(input, photo)
    }
  );

  const data = await jsonOrEmpty(response);

  if (!response.ok || data.ok !== true) {
    throw new AdminRecipeApiError(
      response.status === 404 || response.status === 405
        ? "worker_recipe_editor_unavailable"
        : String(data.error || "admin_recipe_write_failed"),
      data
    );
  }

  // Keep the ordinary Recipes cache coherent after an admin mutation.
  // Failure here does not turn a confirmed server write into a false error.
  void loadRecipes({ force: true }).catch(() => undefined);

  return data as unknown as AdminRecipeMutationResponse;
}

export function createAdminRecipe(
  accessToken: string,
  input: AdminRecipeInput,
  photo?: File | null
) {
  return mutateRecipe(
    accessToken,
    "POST",
    input.source,
    input,
    photo
  );
}

export function updateAdminRecipe(
  accessToken: string,
  recordId: string,
  input: AdminRecipeInput,
  photo?: File | null
) {
  return mutateRecipe(
    accessToken,
    "PATCH",
    input.source,
    input,
    photo,
    recordId
  );
}
