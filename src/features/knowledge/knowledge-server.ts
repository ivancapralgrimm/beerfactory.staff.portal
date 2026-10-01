import { supabase } from "@/lib/supabase";
import type { KnowledgeArticle } from "./types";
import {
  signKnowledgeMedia,
  legacyKnowledgeImage,
} from "./editor/knowledge-media";

export async function loadServerKnowledgeArticles(): Promise<
  KnowledgeArticle[]
> {
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
    return row as {
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
  });
  const paths = rows.flatMap((row) =>
    row.first_image?.storagePath ? [row.first_image.storagePath] : [],
  );
  // A media outage must not make the published text index disappear.
  let images: Record<string, string> = {};
  try {
    images = await signKnowledgeMedia(paths);
  } catch {
    /* Reader shows a media-specific error. */
  }
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    // Keep old consumer shape; search text is not used as article markup.
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
          ? images[row.first_image.storagePath]
          : null) ||
        null
      : null,
  }));
}
