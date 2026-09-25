/**
 * BeerFactory menu worker · recipe editor v3
 *
 * Designed as a full replacement candidate for the current beerfactory-menu-api
 * after manual comparison with the live Worker. It preserves public /menu reads,
 * source-aware recipe identity and admin authorization, and adds:
 *   GET   /admin/recipes
 *   POST  /admin/recipes/bar
 *   POST  /admin/recipes/kitchen
 *   PATCH /admin/recipes/bar/:recordId
 *   PATCH /admin/recipes/kitchen/:recordId
 *
 * Photo upload uses NocoDB's /api/v2/storage/upload endpoint, then stores the
 * attachment metadata in BAR.Фото or KITCHEN.Фотка and the direct URL in
 * Фото-ссылка. The NocoDB write token never reaches the browser.
 */

const DEFAULT_BAR_TABLE_ID = "mqo5ga1nk6h8lv8";
const DEFAULT_KITCHEN_TABLE_ID = "mc7m3sa4m2x12dd";
const MAX_PHOTO_BYTES = 1024 * 1024;
const PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const VALID_STATUSES = new Set(["Актуальный", "Архив", "Черновик"]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Max-Age": "86400"
};

function clean(value) {
  return String(value ?? "").trim();
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...extra
    }
  });
}

function noContent() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

function envConfig(env) {
  const baseUrl = clean(env.NOCODB_BASE_URL).replace(/\/+$/, "");
  const readToken = clean(
    env.NOCODB_READ_TOKEN || env.NOCODB_TOKEN || env.TOKEN
  );
  const writeToken = clean(env.NOCODB_WRITE_TOKEN);

  return {
    baseUrl,
    readToken,
    writeToken,
    barTableId: clean(env.NOCODB_BAR_TABLE_ID) || DEFAULT_BAR_TABLE_ID,
    kitchenTableId:
      clean(env.NOCODB_KITCHEN_TABLE_ID) || DEFAULT_KITCHEN_TABLE_ID,
    supabaseUrl: clean(env.SUPABASE_URL).replace(/\/+$/, ""),
    supabaseAnonKey: clean(env.SUPABASE_ANON_KEY)
  };
}

function tableIdForSource(config, source) {
  if (source === "bar") return config.barTableId;
  if (source === "kitchen") return config.kitchenTableId;
  return null;
}

function attachmentFieldForSource(source) {
  return source === "kitchen" ? "Фотка" : "Фото";
}

function changeNoteFieldForSource(source) {
  return source === "kitchen" ? "Что обновлено" : "Что изменено";
}

function statusValue(row) {
  return clean(row?.Статус || row?.status) || "Актуальный";
}

function visibleToStaff(row) {
  return statusValue(row) !== "Черновик";
}

function recordId(row) {
  return clean(row?.Id || row?.ID || row?.id || row?._id);
}

function lineArray(value) {
  if (Array.isArray(value)) {
    return value.map(clean).filter(Boolean);
  }

  return clean(value)
    .split(/\n|·/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tagArray(value) {
  if (Array.isArray(value)) {
    return value.map(clean).filter(Boolean);
  }

  return clean(value)
    .split(/[\s,;|·]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function canonicalRecipe(row, source) {
  const id = recordId(row);
  const isKitchen = source === "kitchen";
  const method = isKitchen
    ? clean(row?.Описание)
    : clean(row?.Метод || row?.Описание);
  const serving = isKitchen
    ? clean(row?.Граммовка)
    : clean(row?.Подача || row?.Граммовка || row?.Вес);
  const ingredients = lineArray(row?.Состав);
  const photo = clean(row?.["Фото-ссылка"]);
  const category = isKitchen
    ? "Кухня"
    : clean(row?.Категория) || "Бар";
  const rawChangeNote = clean(
    row?.[changeNoteFieldForSource(source)] || row?.["Что изменено"]
  );

  return {
    id: `${source}:${id}`,
    legacyId: "",
    recordId: id,
    source,
    name: clean(row?.Название) || "Без названия",
    category,
    subcategory: clean(row?.Подкатегория),
    desc:
      isKitchen
        ? method || "Открыть техкарту"
        : method || "Открыть техкарту",
    ingredients,
    method,
    serving,
    photo,
    tags: tagArray(row?.Теги),
    status: statusValue(row),
    version: clean(row?.Версия),
    updatedAt: clean(row?.Обновлено),
    updatedBy: clean(row?.["Кем обновлено"]),
    changeNote: rawChangeNote
  };
}

function publicRow(row, source) {
  const canonical = canonicalRecipe(row, source);

  return {
    ...row,
    id: canonical.id,
    recordId: Number.isFinite(Number(canonical.recordId))
      ? Number(canonical.recordId)
      : canonical.recordId,
    source,
    status: canonical.status,
    version: canonical.version,
    updatedAt: canonical.updatedAt,
    updatedBy: canonical.updatedBy,
    changeNote: canonical.changeNote
  };
}

async function nocoRequest(config, path, options = {}) {
  const {
    method = "GET",
    write = false,
    body,
    headers = {}
  } = options;

  const token = write ? config.writeToken : config.readToken;
  if (!config.baseUrl || !token) {
    throw new Error(write
      ? "recipe_admin_write_unavailable"
      : "nocodb_read_unavailable");
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      "xc-token": token,
      ...headers
    },
    body
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const error = new Error(
      write ? "nocodb_write_failed" : `nocodb_${response.status}`
    );
    error.status = response.status;
    error.detail = data;
    throw error;
  }

  return data;
}

function listFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.records)) return data.records;
  return [];
}

async function listTable(config, source) {
  const tableId = tableIdForSource(config, source);
  if (!tableId) throw new Error("invalid_source");

  const data = await nocoRequest(
    config,
    `/api/v2/tables/${encodeURIComponent(tableId)}/records?limit=1000`
  );

  return listFromResponse(data);
}

async function readRecord(config, source, id) {
  const tableId = tableIdForSource(config, source);
  if (!tableId) throw new Error("invalid_source");

  return await nocoRequest(
    config,
    `/api/v2/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(id)}`
  );
}

function capabilities(config) {
  return {
    governance: true,
    recipe_admin_write: Boolean(config.writeToken),
    source_aware_ids: true,
    recipe_admin_create: Boolean(config.writeToken),
    recipe_photo_upload: Boolean(config.writeToken)
  };
}

async function menuResponse(config) {
  const [barRows, kitchenRows] = await Promise.all([
    listTable(config, "bar"),
    listTable(config, "kitchen")
  ]);

  const bar = barRows
    .filter(visibleToStaff)
    .map((row) => publicRow(row, "bar"));
  const kitchen = kitchenRows
    .filter(visibleToStaff)
    .map((row) => publicRow(row, "kitchen"));

  return {
    ok: true,
    source: "nocodb",
    capabilities: capabilities(config),
    bar,
    kitchen,
    recipes: [...bar, ...kitchen]
  };
}

function bearerToken(request) {
  const header = clean(request.headers.get("Authorization"));
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

async function requireAdmin(request, config) {
  const token = bearerToken(request);

  if (!token || !config.supabaseUrl || !config.supabaseAnonKey) {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  }

  const userResponse = await fetch(
    `${config.supabaseUrl}/auth/v1/user`,
    {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!userResponse.ok) {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  }

  const user = await userResponse.json();
  const userId = clean(user?.id);

  if (!userId) {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  }

  const profileUrl = new URL(`${config.supabaseUrl}/rest/v1/profiles`);
  profileUrl.searchParams.set("id", `eq.${userId}`);
  profileUrl.searchParams.set(
    "select",
    "id,first_name,last_name,role,is_active,is_owner"
  );
  profileUrl.searchParams.set("limit", "1");

  const profileResponse = await fetch(profileUrl.toString(), {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${token}`
    }
  });

  if (!profileResponse.ok) {
    throw Object.assign(new Error("admin_profile_failed"), { status: 403 });
  }

  const profiles = await profileResponse.json();
  const profile = Array.isArray(profiles) ? profiles[0] : null;

  if (
    !profile ||
    profile.is_active === false ||
    (profile.role !== "admin" && profile.is_owner !== true)
  ) {
    throw Object.assign(new Error("admin_required"), { status: 403 });
  }

  return {
    token,
    userId,
    profile,
    displayName:
      [profile.first_name, profile.last_name]
        .map(clean)
        .filter(Boolean)
        .join(" ") || "Администратор"
  };
}

async function writeAudit(config, actor, event) {
  try {
    const response = await fetch(
      `${config.supabaseUrl}/rest/v1/audit_log`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal",
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${actor.token}`
        },
        body: JSON.stringify({
          actor_id: actor.userId,
          action: event.action,
          entity_type: "recipe",
          entity_id: event.entityId,
          entity_name: event.entityName || null,
          before_data: event.beforeData || {},
          after_data: event.afterData || {},
          metadata: event.metadata || {}
        })
      }
    );

    if (!response.ok) {
      console.warn("BeerFactory recipe audit failed", response.status);
    }
  } catch (error) {
    console.warn("BeerFactory recipe audit failed", String(error));
  }
}

async function parseEditorRequest(request) {
  const contentType = clean(request.headers.get("Content-Type")).toLowerCase();

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const payloadRaw = clean(form.get("payload"));
    let payload = {};

    if (payloadRaw) {
      try {
        payload = JSON.parse(payloadRaw);
      } catch {
        throw Object.assign(new Error("invalid_payload"), { status: 400 });
      }
    }

    const photoValue = form.get("photo");
    const photo = photoValue instanceof File ? photoValue : null;

    return { payload, photo, editorMode: true };
  }

  if (contentType.includes("application/json")) {
    const payload = await request.json().catch(() => ({}));
    const editorMode = [
      "name",
      "category",
      "description",
      "ingredients",
      "method",
      "serving",
      "tags",
      "remove_photo"
    ].some((key) => Object.prototype.hasOwnProperty.call(payload, key));

    return { payload, photo: null, editorMode };
  }

  throw Object.assign(new Error("unsupported_content_type"), { status: 415 });
}

function normalizeEditorPayload(source, raw, creating) {
  const name = clean(raw?.name);
  const category = clean(raw?.category);
  const status = clean(raw?.status) || "Актуальный";
  const description = clean(raw?.description);
  const ingredients = clean(raw?.ingredients);
  const method = clean(raw?.method);
  const serving = clean(raw?.serving);
  const tags = clean(raw?.tags);
  const changeNote = clean(raw?.change_note);
  const removePhoto = raw?.remove_photo === true;

  if (!name) {
    throw Object.assign(new Error("invalid_name"), { status: 400 });
  }
  if (!category) {
    throw Object.assign(new Error("invalid_category"), { status: 400 });
  }
  if (!VALID_STATUSES.has(status)) {
    throw Object.assign(new Error("invalid_status"), { status: 400 });
  }
  if (source === "bar" && !ingredients) {
    throw Object.assign(new Error("ingredients_required"), { status: 400 });
  }
  if (source === "kitchen" && !description) {
    throw Object.assign(new Error("description_required"), { status: 400 });
  }

  return {
    name,
    category:
      source === "bar" && /^б\/а напитки$/i.test(category)
        ? "Лимонад"
        : category.trim(),
    status,
    description,
    ingredients,
    method,
    serving,
    tags,
    changeNote: changeNote || (creating ? "Создан рецепт" : "Обновлён рецепт"),
    removePhoto
  };
}

function validatePhoto(photo) {
  if (!photo) return;

  if (!PHOTO_MIME_TYPES.has(photo.type)) {
    throw Object.assign(new Error("photo_type_not_allowed"), { status: 400 });
  }

  if (photo.size > MAX_PHOTO_BYTES) {
    throw Object.assign(new Error("photo_too_large"), { status: 400 });
  }
}

async function uploadPhoto(config, photo) {
  validatePhoto(photo);

  const form = new FormData();
  form.append("file", photo, photo.name || "recipe-photo");

  let uploaded;
  try {
    uploaded = await nocoRequest(
      config,
      "/api/v2/storage/upload",
      {
        method: "POST",
        write: true,
        body: form
      }
    );
  } catch (error) {
    const wrapped = new Error("nocodb_photo_upload_failed");
    wrapped.status = error?.status || 502;
    wrapped.detail = error?.detail;
    throw wrapped;
  }

  const files = Array.isArray(uploaded)
    ? uploaded
    : Array.isArray(uploaded?.list)
      ? uploaded.list
      : [];

  if (!files.length) {
    throw Object.assign(new Error("nocodb_photo_upload_failed"), {
      status: 502
    });
  }

  const first = files[0] || {};
  let directUrl = clean(first.url);

  if (directUrl && !/^https?:\/\//i.test(directUrl)) {
    directUrl = `${config.baseUrl}/${directUrl.replace(/^\/+/, "")}`;
  }

  if (!directUrl) {
    directUrl = clean(first.signedUrl);
  }

  return {
    files,
    directUrl
  };
}

function baseRecordForEditor(source, input, actorName, version, changeNote) {
  const common = {
    "Название": input.name,
    "Состав": input.ingredients || null,
    "Теги": input.tags || null,
    "Статус": input.status,
    "Версия": String(version),
    "Обновлено": new Date().toISOString(),
    "Кем обновлено": actorName,
    [changeNoteFieldForSource(source)]: changeNote || null
  };

  if (source === "bar") {
    return {
      ...common,
      "Категория": input.category,
      "Метод": input.method || null
    };
  }

  return {
    ...common,
    "Описание": input.description,
    "Граммовка": input.serving || null
  };
}

function photoFields(source, uploaded, removePhoto) {
  if (uploaded) {
    return {
      [attachmentFieldForSource(source)]: uploaded.files,
      "Фото-ссылка": uploaded.directUrl || null
    };
  }

  if (removePhoto) {
    return {
      [attachmentFieldForSource(source)]: [],
      "Фото-ссылка": null
    };
  }

  return {};
}

async function createRecipe(request, config, source, actor) {
  if (!config.writeToken) {
    throw Object.assign(new Error("recipe_admin_write_unavailable"), {
      status: 503
    });
  }

  const { payload, photo } = await parseEditorRequest(request);
  const input = normalizeEditorPayload(source, payload, true);
  validatePhoto(photo);

  const uploaded = photo ? await uploadPhoto(config, photo) : null;
  const tableId = tableIdForSource(config, source);
  const row = {
    ...baseRecordForEditor(
      source,
      input,
      actor.displayName,
      1,
      input.changeNote || "Создан рецепт"
    ),
    ...photoFields(source, uploaded, false)
  };

  const created = await nocoRequest(
    config,
    `/api/v2/tables/${encodeURIComponent(tableId)}/records`,
    {
      method: "POST",
      write: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row)
    }
  );

  const createdId = recordId(created);
  if (!createdId) {
    throw Object.assign(new Error("nocodb_write_failed"), { status: 502 });
  }

  const canonical = canonicalRecipe(
    { ...row, Id: createdId },
    source
  );

  await writeAudit(config, actor, {
    action: "recipe_create",
    entityId: canonical.id,
    entityName: canonical.name,
    afterData: canonical,
    metadata: { source, record_id: createdId }
  });

  return {
    ok: true,
    id: canonical.id,
    recordId: createdId,
    source,
    recipe: canonical
  };
}

function legacyGovernancePatch(source, payload, actorName) {
  const out = {};

  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    const status = clean(payload.status);
    if (!VALID_STATUSES.has(status)) {
      throw Object.assign(new Error("invalid_status"), { status: 400 });
    }
    out["Статус"] = status;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "version")) {
    out["Версия"] = clean(payload.version) || null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "change_note")) {
    out[changeNoteFieldForSource(source)] = clean(payload.change_note) || null;
  }

  out["Обновлено"] = new Date().toISOString();
  out["Кем обновлено"] = actorName;

  return out;
}

async function updateRecipe(request, config, source, id, actor) {
  if (!config.writeToken) {
    throw Object.assign(new Error("recipe_admin_write_unavailable"), {
      status: 503
    });
  }

  const beforeRaw = await readRecord(config, source, id);
  const beforeCanonical = canonicalRecipe(beforeRaw, source);
  const { payload, photo, editorMode } = await parseEditorRequest(request);
  const tableId = tableIdForSource(config, source);

  let patch;

  if (editorMode) {
    const input = normalizeEditorPayload(source, payload, false);
    validatePhoto(photo);

    const oldVersion = Number(
      beforeRaw?.Версия || beforeCanonical.version || 0
    );
    const version = Number.isFinite(oldVersion) ? oldVersion + 1 : 1;
    const uploaded = photo ? await uploadPhoto(config, photo) : null;

    patch = {
      ...baseRecordForEditor(
        source,
        input,
        actor.displayName,
        version,
        input.changeNote
      ),
      ...photoFields(source, uploaded, input.removePhoto)
    };
  } else {
    patch = legacyGovernancePatch(source, payload, actor.displayName);
  }

  const updated = await nocoRequest(
    config,
    `/api/v2/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      write: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    }
  );

  const merged = {
    ...beforeRaw,
    ...patch,
    ...(updated && typeof updated === "object" ? updated : {}),
    Id: id
  };
  const afterCanonical = canonicalRecipe(merged, source);

  await writeAudit(config, actor, {
    action: editorMode ? "recipe_update" : "recipe_governance_update",
    entityId: `${source}:${id}`,
    entityName: afterCanonical.name,
    beforeData: beforeCanonical,
    afterData: afterCanonical,
    metadata: { source, record_id: id }
  });

  return {
    ok: true,
    id: `${source}:${id}`,
    recordId: clean(id),
    source,
    recipe: afterCanonical
  };
}

async function adminRecipes(config) {
  const [barRows, kitchenRows] = await Promise.all([
    listTable(config, "bar"),
    listTable(config, "kitchen")
  ]);

  return {
    ok: true,
    recipes: [
      ...barRows.map((row) => canonicalRecipe(row, "bar")),
      ...kitchenRows.map((row) => canonicalRecipe(row, "kitchen"))
    ]
  };
}

function parseAdminRecipeRoute(pathname) {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] !== "admin" || parts[1] !== "recipes") return null;

  if (parts.length === 2) {
    return { kind: "collection" };
  }

  if (parts.length === 3) {
    if (parts[2] === "bar" || parts[2] === "kitchen") {
      return { kind: "source", source: parts[2] };
    }
    return { kind: "ambiguous", recordId: parts[2] };
  }

  if (
    parts.length === 4 &&
    (parts[2] === "bar" || parts[2] === "kitchen")
  ) {
    return {
      kind: "record",
      source: parts[2],
      recordId: parts[3]
    };
  }

  return { kind: "invalid" };
}

function errorResponse(error) {
  const code = clean(error?.message) || "backend_error";
  const status = Number(error?.status) || (
    code === "unauthorized" ? 401 :
    code === "admin_required" ? 403 :
    code.startsWith("invalid_") ||
    code.endsWith("_required") ||
    code === "photo_too_large" ||
    code === "photo_type_not_allowed" ? 400 :
    code === "unsupported_content_type" ? 415 :
    code === "recipe_admin_write_unavailable" ? 503 :
    500
  );

  console.error("BeerFactory worker error", code, error?.detail || "");

  return json({ ok: false, error: code }, status);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return noContent();

    const url = new URL(request.url);
    const config = envConfig(env);

    try {
      if (request.method === "GET" && url.pathname === "/") {
        return json({
          ok: true,
          service: "beerfactory-menu-api",
          capabilities: capabilities(config)
        });
      }

      if (
        request.method === "GET" &&
        (url.pathname === "/menu" || url.pathname === "/recipes")
      ) {
        return json(await menuResponse(config));
      }

      const adminRoute = parseAdminRecipeRoute(url.pathname);
      if (adminRoute) {
        if (adminRoute.kind === "ambiguous") {
          return json(
            {
              ok: false,
              error: "source_required",
              message: "Use /admin/recipes/bar/:recordId or /admin/recipes/kitchen/:recordId"
            },
            400
          );
        }

        if (adminRoute.kind === "invalid") {
          return json({ ok: false, error: "not_found" }, 404);
        }

        const actor = await requireAdmin(request, config);

        if (
          request.method === "GET" &&
          adminRoute.kind === "collection"
        ) {
          return json(await adminRecipes(config));
        }

        if (
          request.method === "POST" &&
          adminRoute.kind === "source"
        ) {
          return json(
            await createRecipe(
              request,
              config,
              adminRoute.source,
              actor
            ),
            201
          );
        }

        if (
          request.method === "PATCH" &&
          adminRoute.kind === "record"
        ) {
          return json(
            await updateRecipe(
              request,
              config,
              adminRoute.source,
              adminRoute.recordId,
              actor
            )
          );
        }

        return json({ ok: false, error: "method_not_allowed" }, 405);
      }

      return json({ ok: false, error: "not_found" }, 404);
    } catch (error) {
      return errorResponse(error);
    }
  }
};
