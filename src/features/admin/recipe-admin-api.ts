import { config } from "@/lib/config";
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
  materialLifecycle?: {
    operationId: string;
    phase: "completed";
    affectedQuestions: number;
    affectedTickets: number;
  };
};

export type RecipeMaterialLifecycleRequest = {
  expectedVersion: string;
  operationId: string;
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

const RECIPE_WRITE_TIMEOUT_MS = 15_000;

/** Bound headers and response-body reading together. Writes are never automatically retried. */
async function sendRecipeMutation(url: string, init: RequestInit) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new AdminRecipeApiError("recipe_write_timeout"));
      controller.abort();
    }, RECIPE_WRITE_TIMEOUT_MS);
  });
  const request = (async () => {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { response, data: await jsonOrEmpty(response) };
  })();
  try {
    return await Promise.race([request, deadline]);
  } catch (cause) {
    if (cause instanceof AdminRecipeApiError) throw cause;
    throw new AdminRecipeApiError("recipe_write_unconfirmed");
  } finally {
    clearTimeout(timer);
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

function lifecyclePayload(lifecycle?: RecipeMaterialLifecycleRequest) {
  return lifecycle ? {
    confirm_material_lifecycle: true,
    expected_version: lifecycle.expectedVersion
  } : {};
}

function lifecycleHeaders(lifecycle?: RecipeMaterialLifecycleRequest): Record<string, string> {
  return lifecycle ? { "Idempotency-Key": lifecycle.operationId } : {};
}

function assertLifecycleCompleted(data: Record<string, unknown>, lifecycle?: RecipeMaterialLifecycleRequest) {
  if (!lifecycle) return;
  const result = data.materialLifecycle as Record<string, unknown> | undefined;
  if (result?.phase !== "completed" || result.operationId !== lifecycle.operationId ||
    !Number.isInteger(result.affectedQuestions) || Number(result.affectedQuestions) < 0 ||
    !Number.isInteger(result.affectedTickets) || Number(result.affectedTickets) < 0) {
    throw new AdminRecipeApiError("recipe_material_lifecycle_incomplete", data);
  }
}

function assertMutationIdentity(data: Record<string, unknown>, source: AdminRecipeSource, recordId?: string) {
  if (data.source !== source || typeof data.recordId !== "string" || !data.recordId ||
    data.id !== `${source}:${data.recordId}` || recordId !== undefined && data.recordId !== recordId) {
    throw new AdminRecipeApiError("recipe_write_response_invalid", data);
  }
}

function mutationForm(input: AdminRecipeInput, photo?: File | null, lifecycle?: RecipeMaterialLifecycleRequest) {
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
      remove_photo: input.removePhoto === true,
      ...lifecyclePayload(lifecycle)
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
  recordId?: string,
  lifecycle?: RecipeMaterialLifecycleRequest
) {
  const suffix = recordId ? `/${encodeURIComponent(recordId)}` : "";
  const { response, data } = await sendRecipeMutation(
    `${config.recipeApiBase}/admin/recipes/${source}${suffix}`,
    {
      method,
      headers: { ...authHeaders(accessToken), ...lifecycleHeaders(lifecycle) },
      body: mutationForm(input, photo, lifecycle)
    }
  );

  if (!response.ok || data.ok !== true) {
    throw new AdminRecipeApiError(errorCode(response, data), data);
  }
  assertMutationIdentity(data, source, recordId);
  assertLifecycleCompleted(data, lifecycle);

  // Deliberately do NOT kick off another uncoupled loadRecipes(force:true).
  // Both RecipeEditor/RecipeDetailPage and RecipesPage already await reload().
  // The old fire-and-forget GET could race with that reload and overwrite the
  // just-saved status/venue with an older, previously CDN-cached menu response.
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
  photo?: File | null,
  lifecycle?: RecipeMaterialLifecycleRequest
) {
  return mutateRecipe(
    accessToken,
    "PATCH",
    input.source,
    input,
    photo,
    recordId,
    lifecycle
  );
}

export async function setAdminRecipeStatus(
  accessToken: string,
  source: AdminRecipeSource,
  recordId: string,
  status: AdminRecipeStatus,
  lifecycle?: RecipeMaterialLifecycleRequest
) {
  const { response, data } = await sendRecipeMutation(
    `${config.recipeApiBase}/admin/recipes/${source}/${encodeURIComponent(recordId)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(accessToken),
        ...lifecycleHeaders(lifecycle),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status,
        change_note:
          status === "Архив"
            ? "Перемещён в архив"
            : "Возвращён из архива",
        ...lifecyclePayload(lifecycle)
      })
    }
  );

  if (!response.ok || data.ok !== true) {
    throw new AdminRecipeApiError(errorCode(response, data), data);
  }
  assertMutationIdentity(data, source, recordId);
  assertLifecycleCompleted(data, lifecycle);

  // Caller performs exactly one awaited reload after a successful PATCH.
  return data as unknown as AdminRecipeMutationResponse;
}

export async function deleteAdminRecipe(
  accessToken: string,
  source: AdminRecipeSource,
  recordId: string,
  lifecycle?: RecipeMaterialLifecycleRequest
) {
  const { response, data } = await sendRecipeMutation(
    `${config.recipeApiBase}/admin/recipes/${source}/${encodeURIComponent(recordId)}`,
    {
      method: "DELETE",
      headers: { ...authHeaders(accessToken), ...lifecycleHeaders(lifecycle), ...(lifecycle ? { "Content-Type": "application/json" } : {}) },
      ...(lifecycle ? { body: JSON.stringify(lifecyclePayload(lifecycle)) } : {})
    }
  );

  if (!response.ok || data.ok !== true) {
    throw new AdminRecipeApiError(errorCode(response, data), data);
  }
  assertMutationIdentity(data, source, recordId);
  assertLifecycleCompleted(data, lifecycle);

  // Delete navigation performs its own refresh.
  return data;
}
