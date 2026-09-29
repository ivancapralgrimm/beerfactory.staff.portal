import type { KnowledgeArticle } from "@/features/knowledge/types";

const STORAGE_PREFIX = "bf-dashboard-reading-v1";

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function stableOrder(
  articles: KnowledgeArticle[],
  seed: string
) {
  return [...articles].sort(
    (left, right) =>
      hashString(`${seed}:${left.id}`) -
      hashString(`${seed}:${right.id}`)
  );
}

function localDateParts(
  value: Date,
  timeZone: string
) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour)
  };
}

function isoDate(
  year: number,
  month: number,
  day: number
) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("-");
}

export function dashboardReadingDayKey(
  serverNow?: string | null,
  timeZone = "Asia/Novosibirsk"
) {
  const parsed =
    serverNow && Number.isFinite(Date.parse(serverNow))
      ? new Date(serverNow)
      : new Date();

  const parts = localDateParts(parsed, timeZone);

  if (parts.hour >= 11) {
    return isoDate(parts.year, parts.month, parts.day);
  }

  const previous = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day)
  );

  previous.setUTCDate(previous.getUTCDate() - 1);

  return isoDate(
    previous.getUTCFullYear(),
    previous.getUTCMonth() + 1,
    previous.getUTCDate()
  );
}

function chooseDiverse(
  source: KnowledgeArticle[],
  picked: KnowledgeArticle[],
  usedCategories: Set<string>,
  limit: number,
  uniqueCategoryOnly: boolean
) {
  for (const article of source) {
    if (picked.length >= limit) break;
    if (picked.some((item) => item.id === article.id)) continue;

    if (
      uniqueCategoryOnly &&
      usedCategories.has(article.category)
    ) {
      continue;
    }

    picked.push(article);
    usedCategories.add(article.category);
  }
}

function freshSelection(input: {
  articles: KnowledgeArticle[];
  readIds: Set<string>;
  seed: string;
  limit: number;
}) {
  const unread = stableOrder(
    input.articles.filter(
      (article) => !input.readIds.has(article.id)
    ),
    `${input.seed}:unread`
  );

  const read = stableOrder(
    input.articles.filter(
      (article) => input.readIds.has(article.id)
    ),
    `${input.seed}:read`
  );

  const picked: KnowledgeArticle[] = [];
  const usedCategories = new Set<string>();

  chooseDiverse(unread, picked, usedCategories, input.limit, true);
  chooseDiverse(unread, picked, usedCategories, input.limit, false);
  chooseDiverse(read, picked, usedCategories, input.limit, true);
  chooseDiverse(read, picked, usedCategories, input.limit, false);

  return picked;
}

export function dashboardReadingSelection(input: {
  articles: KnowledgeArticle[];
  readIds: Set<string>;
  userId: string;
  dayKey: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(input.limit ?? 6, 4), 6);

  if (!input.articles.length) return [];

  const storageKey =
    `${STORAGE_PREFIX}:${input.userId || "guest"}:${input.dayKey}`;

  try {
    const savedIds = JSON.parse(
      localStorage.getItem(storageKey) || "[]"
    ) as string[];

    const byId = new Map(
      input.articles.map((article) => [article.id, article])
    );

    const saved = savedIds
      .map((id) => byId.get(id))
      .filter(
        (article): article is KnowledgeArticle => Boolean(article)
      );

    if (
      saved.length >= Math.min(4, input.articles.length) &&
      saved.length <= limit
    ) {
      return saved;
    }
  } catch {
    // Deterministic fallback below is sufficient.
  }

  const selected = freshSelection({
    articles: input.articles,
    readIds: input.readIds,
    seed: `${input.userId}:${input.dayKey}`,
    limit
  });

  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(selected.map((article) => article.id))
    );
  } catch {
    // Persistence is a UX enhancement, not authority.
  }

  return selected;
}

export function knowledgeArticleImage(
  article: KnowledgeArticle
) {
  const match = article.body.match(/!\[[^\]]*\]\(([^)]+)\)/);
  return match?.[1]?.trim() || null;
}
