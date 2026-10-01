import type { KnowledgeArticle } from "@/features/knowledge/types";
import { loadServerKnowledgeArticles } from './knowledge-server';

export const knowledgeSource = import.meta.env.VITE_KNOWLEDGE_SOURCE === 'supabase' ? 'supabase' : 'legacy';
let cacheGeneration = 0;
export function invalidateKnowledgeArticles() {
  cacheGeneration++;
  cachedArticles = null;
  serverCache.clear();
  serverInflight.clear();
  window.dispatchEvent(new Event('bf-knowledge-changed'));
}
const serverCache = new Map<string,{ articles: KnowledgeArticle[]; at: number }>();
const serverInflight = new Map<string,Promise<KnowledgeArticle[]>>();

const ARTICLES_URL = "/assets/training-data.txt";

let cachedArticles: KnowledgeArticle[] | null = null;
let inflight: Promise<KnowledgeArticle[]> | null = null;

function cleanCategory(raw: string, title = "") {
  const category = raw
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/^[\s:·-]+|[\s:·-]+$/g, "")
    .trim();

  if (/как появилось пиво/i.test(title)) return "Пиво";
  if (/крепкий алкоголь/i.test(category)) return "Алкоголь";
  if (/винная карта/i.test(category) || /^вино$/i.test(category)) return "Вино";
  if (/сервис/i.test(category)) return "Сервис";
  if (/пиво/i.test(category)) return "Пиво";
  if (/бар/i.test(category)) return "Бар";
  if (/кухн/i.test(category)) return "Кухня";
  if (/sop|инструкц/i.test(category)) return "SOP";

  return category || "Обучение";
}

export function knowledgePlainText(value: string) {
  return String(value ?? "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/[*=#>_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readingMinutes(body: string) {
  const words = knowledgePlainText(body).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

export function parseArticles(text: string): KnowledgeArticle[] {
  const articles: Array<{
    id: string;
    category: string;
    title: string;
    body: string;
  }> = [];

  let category = "Обучение";
  let active: (typeof articles)[number] | null = null;

  for (const rawLine of String(text ?? "").replace(/\r/g, "").split("\n")) {
    if (rawLine.startsWith("### ")) {
      category = rawLine.slice(4).trim().replace(/:$/, "");
      active = null;
      continue;
    }

    if (rawLine.startsWith("## ")) {
      const title = rawLine.slice(3).trim();
      active = {
        id: `lesson-${articles.length + 1}`,
        category: cleanCategory(category, title),
        title,
        body: ""
      };
      articles.push(active);
      continue;
    }

    if (active) active.body += `${rawLine}\n`;
  }

  return articles
    .filter((article) => !/^Раздел в разработке$/i.test(article.title))
    .map((article) => {
      const body = article.body.trim();
      const plain = knowledgePlainText(body);

      return {
        ...article,
        body,
        readingMinutes: readingMinutes(body),
        excerpt: plain.length > 170 ? `${plain.slice(0, 170).trim()}…` : plain
      };
    });
}

async function fetchArticles() {
  const response = await fetch(ARTICLES_URL, { cache: "no-cache" });

  if (!response.ok) throw new Error("knowledge_materials_unavailable");

  const text = await response.text();
  const articles = parseArticles(text);

  if (!articles.length) throw new Error("knowledge_materials_empty");

  cachedArticles = articles;
  return articles;
}

export async function loadKnowledgeArticles(options?: { force?: boolean; scope?: string }) {
  const force = options?.force === true;
  if (knowledgeSource === 'supabase') {
    const scope = options?.scope || '';
    if (!scope) throw new Error('knowledge_session_required');
    const cached = serverCache.get(scope);
    if (!force && cached && Date.now() - cached.at < 120_000) return cached.articles;
    const pending = serverInflight.get(scope);
    if (pending) return pending;
    const generation = cacheGeneration;
    const request: Promise<KnowledgeArticle[]> = loadServerKnowledgeArticles().then(articles => {
      if (generation === cacheGeneration) serverCache.set(scope,{ articles, at: Date.now() }); return articles;
    }).finally(() => { if (serverInflight.get(scope) === request) serverInflight.delete(scope); });
    serverInflight.set(scope,request);
    return request;
  }

  if (!force && cachedArticles) return cachedArticles;
  if (!force && inflight) return inflight;

  inflight = fetchArticles();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
