const UPSTREAM =
  "https://beerfactory-menu-api.ivan-capral-grimm.workers.dev/menu";

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeVenue(value) {
  const raw = clean(value).toUpperCase().replace(/\s+/g, "");
  if (raw === "BB") return "BB";
  if (raw === "BF/BB" || raw === "BB/BF") return "BF/BB";
  return "BF";
}

function lines(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  return clean(value)
    .split(/\n|·/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tags(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  return clean(value)
    .split(/[\s,;|·]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactRecipe(row) {
  const source = clean(row?.source).toLowerCase() ||
    (clean(row?.id).startsWith("kitchen:") ? "kitchen" : "bar");
  const recordId = clean(row?.recordId ?? row?.Id ?? row?.ID ?? row?._id);
  const venue = normalizeVenue(row?.venue ?? row?.Заведение);
  const isKitchen = source === "kitchen";
  const method = clean(
    row?.method ??
    (isKitchen ? row?.Описание : (row?.Метод ?? row?.Описание))
  );
  const serving = clean(
    row?.serving ??
    row?.Граммовка ??
    row?.Подача ??
    row?.Вес
  );

  return {
    id: clean(row?.id) || `${source}:${recordId}`,
    legacyId: clean(row?.legacyId),
    recordId,
    source,
    venue,
    name: clean(row?.name ?? row?.Название ?? row?.Tittle) || "Без названия",
    category: clean(row?.category) ||
      (isKitchen ? `Кухня ${venue}` : clean(row?.Категория) || "Бар"),
    subcategory: clean(row?.subcategory ?? row?.Подкатегория),
    desc: clean(row?.desc) || method || "Открыть техкарту",
    ingredients: lines(row?.ingredients ?? row?.Состав),
    method,
    serving,
    photo: clean(row?.photo ?? row?.["Фото-ссылка"]),
    tags: tags(row?.tags ?? row?.Теги),
    status: clean(row?.status ?? row?.Статус) || "Актуальный",
    version: clean(row?.version ?? row?.Версия),
    updatedAt: clean(row?.updatedAt ?? row?.Обновлено),
    updatedBy: clean(row?.updatedBy ?? row?.["Кем обновлено"]),
    changeNote: clean(
      row?.changeNote ??
      row?.["Что изменено"] ??
      row?.["Что обновлено"]
    )
  };
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.statusCode = 405;
    response.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const upstream = await fetch(UPSTREAM, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });

    if (!upstream.ok) {
      response.statusCode = 502;
      response.end(JSON.stringify({
        ok: false,
        error: `menu_upstream_${upstream.status}`
      }));
      return;
    }

    const payload = await upstream.json();
    const raw = Array.isArray(payload?.recipes)
      ? payload.recipes
      : [
          ...(Array.isArray(payload?.bar) ? payload.bar : []),
          ...(Array.isArray(payload?.kitchen) ? payload.kitchen : [])
        ];

    const recipes = raw.map(compactRecipe);

    if (!recipes.length) {
      response.statusCode = 502;
      response.end(JSON.stringify({ ok: false, error: "menu_empty" }));
      return;
    }

    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader(
      "Cache-Control",
      "public, s-maxage=30, stale-while-revalidate=300"
    );
    response.statusCode = 200;
    response.end(JSON.stringify({
      ok: true,
      source: payload?.source || "nocodb",
      capabilities: payload?.capabilities || {},
      recipes
    }));
  } catch (error) {
    response.statusCode = 502;
    response.end(JSON.stringify({
      ok: false,
      error: error?.name === "AbortError"
        ? "menu_upstream_timeout"
        : "menu_upstream_failed"
    }));
  } finally {
    clearTimeout(timeout);
  }
}
