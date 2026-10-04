import { supabase } from "@/lib/supabase";

export async function signKnowledgeMedia(
  paths: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(paths)];
  if (!unique.length) return {};
  const { data, error } = await supabase.storage
    .from("knowledge-media")
    .createSignedUrls(unique, 3600);
  if (error || !data) throw new Error("knowledge_media_read_failed");
  return Object.fromEntries(
    data.flatMap((item) =>
      item.path && item.signedUrl && !item.error
        ? [[item.path, item.signedUrl]]
        : [],
    ),
  );
}

export function legacyKnowledgeImage(src: string | null) {
  return src &&
    /^(?:\/)?assets\/[a-zA-Z0-9_./-]+$/.test(src) &&
    !src.split("/").some((p) => p === ".." || p === ".")
    ? `/${src.replace(/^\//, "")}`
    : "";
}
