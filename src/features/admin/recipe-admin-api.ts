import { config } from "@/lib/config";
import { loadRecipes } from "@/features/recipes/recipe-data";
import type { Recipe, RecipeVenue } from "@/features/recipes/types";

export type AdminRecipeSource = "bar" | "kitchen";
export type AdminRecipeStatus = "Актуальный" | "Архив";

export type AdminRecipeInput = {
  source: AdminRecipeSource;
  name: string;
  category: string;
  status: AdminRecipeStatus;
  venue: RecipeVenue;
  description: string;
  ingredients: string;
  method: string;
  serving: string;
  tags: string;
  changeNote: string;
  removePhoto?: boolean;
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
  return { Authorization: `Bearer ${accessToken}` };
}

function errorCode(response: Response, data: Record<string, unknown>) {
  return response.status === 404 || response.status === 405
    ? "worker_recipe_editor_unavailable"
    : String(data.error || "admin_recipe_write_failed");
}

function mutationForm(input: AdminRecipeInput, photo?: File | null) {
  const form = new FormData();

  form.set(
    "payload",
    JSON.stringify({
      name: input.name.trim(),
      category: input.category.trim(),
      status: input.status,
      venue: input.venue,
      description: input.description.trim(),
      ingredients: input.ingredients.trim(),
      method: input.method.trim(),
      serving: input.serving.trim(),
      tags: input.tags.trim(),
      change_note: input.changeNote.trim(),
      remove_photo: input.removePhoto === true
    })
  );

  if (photo) form.set("photo", photo, photo.name);
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
  const suffix = recordId ? `/${encodeURIComponent(recordId)}` : "";
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
    throw new AdminRecipeApiError(errorCode(response, data), data);
  }

  void loadRecipes({ force: true }).catch(() => undefined);
  return data as unknown as AdminRecipeMutationResponse;
}

export function createAdminRecipe(
  accessToken: string,
  input: AdminRecipeInput,
  photo?: File | null
) {
  return mutateRecipe(accessToken, "POST", input.source, input, photo);
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

export async function setAdminRecipeStatus(
  accessToken: string,
  source: AdminRecipeSource,
  recordId: string,
  status: AdminRecipeStatus
) {
  const response = await fetch(
    `${config.recipeApiBase}/admin/recipes/${source}/${encodeURIComponent(recordId)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(accessToken),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status,
        change_note:
          status === "Архив"
            ? "Перемещён в архив"
            : "Возвращён из архива"
      })
    }
  );

  const data = await jsonOrEmpty(response);
  if (!response.ok || data.ok !== true) {
    throw new AdminRecipeApiError(errorCode(response, data), data);
  }

  void loadRecipes({ force: true }).catch(() => undefined);
  return data as unknown as AdminRecipeMutationResponse;
}

export async function deleteAdminRecipe(
  accessToken: string,
  source: AdminRecipeSource,
  recordId: string
) {
  const response = await fetch(
    `${config.recipeApiBase}/admin/recipes/${source}/${encodeURIComponent(recordId)}`,
    {
      method: "DELETE",
      headers: authHeaders(accessToken)
    }
  );

  const data = await jsonOrEmpty(response);
  if (!response.ok || data.ok !== true) {
    throw new AdminRecipeApiError(errorCode(response, data), data);
  }

  void loadRecipes({ force: true }).catch(() => undefined);
  return data;
}
