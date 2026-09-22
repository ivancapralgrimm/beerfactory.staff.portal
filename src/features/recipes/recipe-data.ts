import { config } from "@/lib/config";
import type {
  Recipe,
  RecipeCapabilities,
  RecipeLoadResult
} from "@/features/recipes/types";

const CACHE_KEY = "bf-recipes-r404-v1";
const CACHE_SCHEMA = 1;
const LEGACY_CACHE_KEY = "bf-portal-v2";
const FRESH_MS = 5 * 60 * 1000;

const EMPTY_CAPABILITIES: RecipeCapabilities = {
  governance: false,
  recipeAdminWrite: false,
  sourceAwareIds: false
};

type UnknownRow = Record<string, unknown>;

type RecipeCache = {
  schema: number;
  syncedAt: number | null;
  capabilities: RecipeCapabilities;
  recipes: Recipe[];
};

let memory: RecipeLoadResult | null = null;
let inflight: Promise<RecipeLoadResult> | null = null;

export function categoryLabel(value: string) {
  return /^лимонад$/i.test(clean(value)) ? "Б/А напитки" : clean(value);
}

export function recipeStatusKind(value: string) {
  const status = clean(value).toLowerCase();

  if (!status) return "current";
  if (["актуальный", "current", "active", "published"].includes(status)) {
    return "current";
  }
  if (["архив", "archive", "archived"].includes(status)) return "archive";
  if (["черновик", "draft"].includes(status)) return "draft";

  return "current";
}

export function isArchive(recipe: Recipe) {
  return recipeStatusKind(recipe.status) === "archive";
}

export function resolveRecipe(recipes: Recipe[], id: string) {
  return recipes.find(
    (recipe) => recipe.id === id || recipe.legacyId === id
  );
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function get(row: UnknownRow | null | undefined, ...keys: string[]) {
  if (!row) return "";

  for (const key of keys) {
    const value = row[key];
    if (value != null && clean(value) !== "") return value;
  }

  return "";
}

function lines(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(clean).filter(Boolean);
  }

  return clean(value)
    .split(/\n|·/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tagWords(value: unknown) {
  const source = Array.isArray(value) ? value : [value];

  return source
    .flatMap((part) => clean(part).split(/[\s,;|·]+/u))
    .filter(Boolean);
}

function hash(value: string, prefix: string) {
  const source = value.toLowerCase();
  let result = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    result ^= source.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }

  return `${prefix}${(result >>> 0).toString(36)}`;
}

function stableFallbackId(source: string, name: string) {
  return hash(`${source}|${name}`, "bf-");
}

function legacyRouteId(category: string, recordId: string, name: string) {
  return hash(`${category}|${recordId}|${name}`, "bf-route-");
}

function normalizeSource(value: unknown) {
  return clean(value).toLowerCase();
}

function normalizeRow(
  row: UnknownRow,
  fallbackCategory = "Меню",
  sourceHint = ""
): Recipe {
  const category =
    clean(get(row, "category", "Category", "Категория", "cat")) ||
    fallbackCategory;
  const name =
    clean(get(row, "name", "Name", "Название", "Title")) || "Без названия";
  const subcategory = clean(
    get(row, "subcategory", "Subcategory", "Подкатегория", "subcat")
  );

  const compound = get(
    row,
    "ingredients",
    "Ingredients",
    "Состав",
    "compound"
  );
  const method = get(
    row,
    "method",
    "Method",
    "Метод",
    "Приготовление",
    "Описание"
  );
  const serving = get(
    row,
    "serving",
    "Serving",
    "Подача",
    "Граммовка",
    "Вес"
  );

  const canonicalCandidate = clean(get(row, "id"));
  let recordId = clean(
    get(row, "recordId", "record_id", "Id", "ID", "_id")
  );
  let source = normalizeSource(
    sourceHint ||
      get(row, "source", "Source", "_source", "table", "Table")
  );

  const sourceAwareMatch = canonicalCandidate.match(/^([^:]+):(.+)$/);
  if (sourceAwareMatch) {
    if (!source) source = normalizeSource(sourceAwareMatch[1]);
    if (!recordId) recordId = clean(sourceAwareMatch[2]);
  }

  if (!source) {
    source = normalizeSource(category || fallbackCategory || "menu");
  }

  const id =
    source && recordId
      ? `${source}:${recordId}`
      : canonicalCandidate || stableFallbackId(source, name);

  return {
    id,
    legacyId: legacyRouteId(category, recordId || id, name),
    recordId,
    source,
    name,
    category,
    subcategory,
    desc:
      clean(get(row, "desc", "description", "Description", "Описание")) ||
      clean(method) ||
      "Открыть техкарту",
    ingredients: lines(compound),
    method: clean(method),
    serving: clean(serving),
    photo: clean(get(row, "photo", "Photo", "Фото-ссылка", "Фото")),
    tags: tagWords(get(row, "tags", "Tags", "Теги")),
    status: clean(get(row, "status", "Status", "Статус")),
    version: clean(get(row, "version", "Version", "Версия")),
    updatedAt: clean(
      get(row, "updated_at", "updatedAt", "Updated at", "Обновлено")
    ),
    updatedBy: clean(
      get(row, "updated_by", "updatedBy", "Updated by", "Кем обновлено")
    ),
    changeNote: clean(
      get(row, "change_note", "changeNote", "Change note", "Что изменено")
    )
  };
}

function staffVisible(recipes: Recipe[]) {
  return recipes.filter(
    (recipe) => recipeStatusKind(recipe.status) !== "draft"
  );
}

function payloadCapabilities(payload: unknown): RecipeCapabilities {
  if (!payload || typeof payload !== "object") return EMPTY_CAPABILITIES;

  const data = payload as Record<string, unknown>;
  const capabilities =
    data.capabilities && typeof data.capabilities === "object"
      ? (data.capabilities as Record<string, unknown>)
      : {};
  const governance =
    data.governance && typeof data.governance === "object"
      ? (data.governance as Record<string, unknown>)
      : {};

  return {
    governance: Boolean(capabilities.governance || governance.enabled),
    recipeAdminWrite: Boolean(capabilities.recipe_admin_write),
    sourceAwareIds: Boolean(capabilities.source_aware_ids)
  };
}

function rowsFromPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return staffVisible(
      payload.map((item) => {
        const row = item as UnknownRow;
        const fallback =
          clean(get(row, "category", "Category", "Категория", "cat")) ||
          "Меню";
        const source =
          clean(
            get(row, "source", "Source", "_source", "table", "Table")
          ) || fallback;

        return normalizeRow(row, fallback, source);
      })
    );
  }

  if (!payload || typeof payload !== "object") return [];

  const data = payload as Record<string, unknown>;
  const groups: Array<[string, string, string]> = [
    ["bar", "Бар", "bar"],
    ["kitchen", "Кухня", "kitchen"],
    ["preparations", "Заготовки", "preparations"],
    ["infusions", "Настойки", "infusions"],
    ["cordials", "Кордиалы", "cordials"]
  ];

  const hasGroups = groups.some(([key]) => Array.isArray(data[key]));

  if (hasGroups) {
    const output: Recipe[] = [];

    for (const [key, fallback, source] of groups) {
      const rows = data[key];
      if (!Array.isArray(rows)) continue;

      output.push(
        ...rows.map((item) =>
          normalizeRow(item as UnknownRow, fallback, source)
        )
      );
    }

    return staffVisible(output);
  }

  if (Array.isArray(data.recipes)) {
    return staffVisible(
      data.recipes.map((item) => {
        const row = item as UnknownRow;
        const fallback =
          clean(get(row, "category", "Category", "Категория", "cat")) ||
          "Меню";
        const source =
          clean(
            get(row, "source", "Source", "_source", "table", "Table")
          ) || fallback;

        return normalizeRow(row, fallback, source);
      })
    );
  }

  return [];
}

function safeReadJson(key: string) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function readNewCache(): RecipeLoadResult | null {
  const stored = safeReadJson(CACHE_KEY) as RecipeCache | null;

  if (
    !stored ||
    stored.schema !== CACHE_SCHEMA ||
    !Array.isArray(stored.recipes) ||
    !stored.recipes.length
  ) {
    return null;
  }

  return {
    recipes: staffVisible(
      stored.recipes.map((recipe) =>
        normalizeRow(
          recipe as unknown as UnknownRow,
          recipe.category || "Меню",
          recipe.source || recipe.category || "menu"
        )
      )
    ),
    source: "cache-fresh",
    syncedAt:
      typeof stored.syncedAt === "number" ? stored.syncedAt : null,
    capabilities: stored.capabilities || EMPTY_CAPABILITIES
  };
}

function readLegacyCache(): RecipeLoadResult | null {
  const stored = safeReadJson(LEGACY_CACHE_KEY) as
    | Record<string, unknown>
    | null;

  if (!stored || !Array.isArray(stored.menu) || !stored.menu.length) {
    return null;
  }

  const recipes = staffVisible(
    stored.menu.map((item) => {
      const row = item as UnknownRow;
      const fallback =
        clean(get(row, "category", "Category", "Категория")) || "Меню";
      const source =
        clean(get(row, "source", "Source", "_source")) || fallback;

      return normalizeRow(row, fallback, source);
    })
  );

  if (!recipes.length) return null;

  const syncedAt = Number(stored.menuSyncedAt || 0);

  return {
    recipes,
    source: "legacy-cache",
    syncedAt: syncedAt > 0 ? syncedAt : null,
    capabilities: {
      governance: Boolean(stored.menuGovernanceEnabled),
      recipeAdminWrite: Boolean(stored.menuGovernanceWritable),
      sourceAwareIds: Boolean(stored.menuSourceAwareIds)
    }
  };
}

function readCache() {
  return readNewCache() || readLegacyCache();
}

function writeCache(result: RecipeLoadResult) {
  if (!result.recipes.length || result.syncedAt == null) return;

  const payload: RecipeCache = {
    schema: CACHE_SCHEMA,
    syncedAt: result.syncedAt,
    capabilities: result.capabilities,
    recipes: result.recipes
  };

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("BeerFactory recipe cache write failed", error);
  }
}

function cacheIsFresh(value: RecipeLoadResult) {
  return (
    value.syncedAt != null &&
    Date.now() - value.syncedAt < FRESH_MS
  );
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchRecipes(cached: RecipeLoadResult | null) {
  const timeoutMs = cached?.recipes.length ? 3000 : 7000;
  const response = await fetchWithTimeout(
    `${config.recipeApiBase}/menu`,
    timeoutMs
  );

  if (!response.ok) {
    throw new Error(`menu_http_${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const recipes = rowsFromPayload(payload);

  if (!recipes.length) throw new Error("menu_empty");

  const result: RecipeLoadResult = {
    recipes,
    source: "api",
    syncedAt: Date.now(),
    capabilities: payloadCapabilities(payload)
  };

  writeCache(result);
  return result;
}

export async function loadRecipes(options?: { force?: boolean }) {
  const force = options?.force === true;

  if (!force && memory && memory.source === "api" && cacheIsFresh(memory)) {
    return memory;
  }

  if (!force && inflight) return inflight;

  inflight = (async () => {
    const cached = readCache();

    if (!force && cached && cacheIsFresh(cached)) {
      memory = {
        ...cached,
        source: "cache-fresh"
      };
      return memory;
    }

    if (!force && cached && navigator.onLine === false) {
      memory = {
        ...cached,
        source: "cache-offline"
      };
      return memory;
    }

    try {
      memory = await fetchRecipes(cached);
      return memory;
    } catch (error) {
      console.warn("BeerFactory recipe API unavailable", error);

      if (cached) {
        memory = {
          ...cached,
          source: "cache-offline"
        };
        return memory;
      }

      throw error;
    }
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
