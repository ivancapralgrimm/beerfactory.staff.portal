import { supabase } from "@/lib/supabase";
import type { KnowledgeArticle } from "./types";
import {
  signKnowledgeMedia,
  legacyKnowledgeImage,
} from "./editor/knowledge-media";

type ServerKnowledgeRow = {
  id: string;
  title: string;
  category: string;
  description?: string;
  search_text: string;
  revision: number;
  first_image?: {
    mediaId: string | null;
    storagePath: string | null;
    legacySrc: string | null;
    alt: string;
  } | null;
};

type MediaReadyCallback = (articles: KnowledgeArticle[]) => void;

const SIGNED_MEDIA_CACHE_MS = 10 * 60_000;
const signedMediaCache = new Map<string, { url: string; at: number }>();
const signingInflight = new Map<string, Promise<Record<string, string>>>();

function cachedMediaUrl(path: string) {
  const cached = signedMediaCache.get(path);
  if (!cached) return null;
  if (Date.now() - cached.at > SIGNED_MEDIA_CACHE_MS) {
    signedMediaCache.delete(path);
    return null;
  }
  return cached.url;
}

function mapRows(
  rows: ServerKnowledgeRow[],
  signedImages?: ReadonlyMap<string, string>,
): KnowledgeArticle[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    body: row.search_text,
    searchText: row.search_text,
    excerpt:
      row.description ||
      `${row.search_text.slice(0, 170)}${row.search_text.length > 170 ? "…" : ""}`,
    readingMinutes: Math.max(
      1,
      Math.ceil(row.search_text.split(/\s+/).filter(Boolean).length / 180),
    ),
    source: "supabase",
    revision: row.revision,
    firstImage: row.first_image
      ? legacyKnowledgeImage(row.first_image.legacySrc) ||
        (row.first_image.storagePath
          ? signedImages?.get(row.first_image.storagePath) ||
            cachedMediaUrl(row.first_image.storagePath)
          : null)
      : null,
  }));
}

function startMediaSigning(
  rows: ServerKnowledgeRow[],
  onMediaReady?: MediaReadyCallback,
) {
  const paths = [
    ...new Set(
      rows.flatMap((row) =>
        row.first_image?.storagePath ? [row.first_image.storagePath] : [],
      ),
    ),
  ];
  const missing = paths.filter((path) => !cachedMediaUrl(path));

  if (!missing.length) {
    if (paths.length && onMediaReady) onMediaReady(mapRows(rows));
    return;
  }

  const key = [...missing].sort().join("\n");
  const request = signingInflight.get(key) ?? signKnowledgeMedia(missing);
  signingInflight.set(key, request);

  void request
    .then((images) => {
      const now = Date.now();
      Object.entries(images).forEach(([path, url]) => {
        if (url) signedMediaCache.set(path, { url, at: now });
      });
      onMediaReady?.(mapRows(rows));
    })
    .catch(() => {
      // Text readiness is intentionally independent from private media signing.
    })
    .finally(() => {
      if (signingInflight.get(key) === request) signingInflight.delete(key);
    });
}

export async function loadServerKnowledgeArticles(
  onMediaReady?: MediaReadyCallback,
): Promise<KnowledgeArticle[]> {
  const { data, error } = await supabase.rpc("get_knowledge_articles");
  if (error || !Array.isArray(data))
    throw new Error("knowledge_server_read_failed");

  const ids = new Set<string>();
  const rows = data.map((row) => {
    if (
      !row ||
      typeof row.id !== "string" ||
      !/^[a-zA-Z0-9:_-]{1,100}$/.test(row.id) ||
      typeof row.title !== "string" ||
      typeof row.category !== "string" ||
      typeof row.search_text !== "string" ||
      row.status !== "published" ||
      !Number.isInteger(row.revision) ||
      row.revision < 1 ||
      (row.description !== undefined && typeof row.description !== "string") ||
      (row.first_image !== undefined &&
        row.first_image !== null &&
        (typeof row.first_image !== "object" ||
          typeof row.first_image.alt !== "string" ||
          !(
            row.first_image.legacySrc === null ||
            typeof row.first_image.legacySrc === "string"
          ) ||
          !(
            row.first_image.storagePath === null ||
            typeof row.first_image.storagePath === "string"
          ) ||
          !(
            row.first_image.mediaId === null ||
            typeof row.first_image.mediaId === "string"
          ))) ||
      ids.has(row.id)
    )
      throw new Error("knowledge_server_schema_invalid");
    ids.add(row.id);
    return row as ServerKnowledgeRow;
  });

  const articles = mapRows(rows);
  startMediaSigning(rows, onMediaReady);
  return articles;
}
