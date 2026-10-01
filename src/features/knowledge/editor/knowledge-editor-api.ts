import { supabase } from "@/lib/supabase";
import {
  validateKnowledgeArticle,
  type KnowledgeArticleDocument,
} from "@/features/knowledge/editor/article-model";

export type KnowledgeEditorContext = {
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_publish: boolean;
  can_manage_permissions: boolean;
};

export type KnowledgeSaveResult = {
  id: string;
  revision: number;
  status: "draft" | "published" | "archived";
  created: boolean;
  updated_at: string;
};

export class KnowledgeEditorApiError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = "KnowledgeEditorApiError";
  }
}

function rpcCode(
  error: { message?: string } | null | undefined,
  fallback: string,
) {
  const message = String(error?.message || "");
  const known = [
    "forbidden",
    "article_not_found",
    "article_revision_conflict",
    "article_schema_unsupported",
    "article_id_invalid",
    "article_title_invalid",
    "article_category_invalid",
    "article_description_invalid",
    "article_status_invalid",
    "article_blocks_invalid",
    "article_block_id_invalid",
    "article_block_type_invalid",
    "article_block_content_invalid",
    "article_text_limit",
    "article_total_text_limit",
    "article_list_invalid",
    "article_media_conflict",
  ];
  if ((error as { code?: string } | null)?.code === "PGRST202")
    return "knowledge_backend_unavailable";
  return known.find((code) => message.includes(code)) || fallback;
}

export async function loadKnowledgeEditorContext() {
  const { data, error } = await supabase.rpc("get_knowledge_editor_context");
  if (error || !data) {
    throw new KnowledgeEditorApiError(
      rpcCode(error, "knowledge_editor_context_failed"),
    );
  }
  if (
    [
      "can_read",
      "can_create",
      "can_edit",
      "can_publish",
      "can_manage_permissions",
    ].some((key) => typeof data[key] !== "boolean")
  )
    throw new KnowledgeEditorApiError("knowledge_editor_context_failed");
  return data as KnowledgeEditorContext;
}

export async function loadKnowledgeArticleForEditor(articleId: string) {
  const { data, error } = await supabase.rpc("get_knowledge_article", {
    p_article_id: articleId,
  });
  if (error || !data) {
    throw new KnowledgeEditorApiError(
      rpcCode(error, "knowledge_article_load_failed"),
    );
  }
  const document = validateKnowledgeArticle(data, { requireTitle: false });
  if (document.id !== articleId)
    throw new KnowledgeEditorApiError("knowledge_article_load_failed");
  return document;
}

export async function saveKnowledgeArticle(
  document: KnowledgeArticleDocument,
  expectedRevision: number,
) {
  const normalized = validateKnowledgeArticle(document);
  const { data, error } = await supabase.rpc("save_knowledge_article", {
    p_document: normalized,
    p_expected_revision: expectedRevision,
  });
  if (error || !data) {
    throw new KnowledgeEditorApiError(
      rpcCode(error, "knowledge_article_save_failed"),
    );
  }
  if (
    data.id !== normalized.id ||
    !Number.isInteger(data.revision) ||
    data.revision !== expectedRevision + 1 ||
    data.status !== normalized.status
  ) {
    throw new KnowledgeEditorApiError(
      "knowledge_article_save_response_invalid",
    );
  }
  return data as KnowledgeSaveResult;
}

export async function uploadKnowledgeImage(file: File) {
  const form = new FormData();
  form.set("file", file);

  const { data, error } = await supabase.functions.invoke(
    "knowledge-media-upload",
    {
      body: form,
    },
  );

  if (error || !data?.ok) {
    let code = String(data?.error || "knowledge_media_upload_failed");
    if (error && "context" in error && error.context instanceof Response) {
      try {
        code = (await error.context.clone().json()).error || code;
      } catch {
        /* Not a JSON response. */
      }
    }
    throw new KnowledgeEditorApiError(code);
  }

  const media = data.media;
  if (
    !media ||
    typeof media.id !== "string" ||
    typeof media.storage_path !== "string" ||
    !/^[a-zA-Z0-9_./-]+$/.test(media.storage_path) ||
    media.storage_path
      .split("/")
      .some((part: string) => !part || part === "." || part === "..") ||
    typeof media.original_name !== "string" ||
    !Number.isInteger(media.width) ||
    !Number.isInteger(media.height) ||
    media.width < 1 ||
    media.height < 1 ||
    typeof data.signed_url !== "string" ||
    (data.signed_url !== "" && !/^https?:\/\//.test(data.signed_url))
  ) {
    throw new KnowledgeEditorApiError(
      "knowledge_media_upload_response_invalid",
    );
  }
  return data as {
    ok: true;
    media: {
      id: string;
      storage_path: string;
      mime_type: string;
      byte_size: number;
      width: number;
      height: number;
      original_name: string;
    };
    signed_url: string;
  };
}

export type KnowledgeEditorSummary = {
  id: string;
  title: string;
  category: string;
  status: "draft" | "published" | "archived";
  revision: number;
};
export async function loadKnowledgeEditorArticles(): Promise<
  KnowledgeEditorSummary[]
> {
  const { data, error } = await supabase.rpc("get_knowledge_editor_articles");
  if (error || !Array.isArray(data))
    throw new KnowledgeEditorApiError(
      rpcCode(error, "knowledge_article_load_failed"),
    );
  return data.map((row) => {
    if (
      !row ||
      typeof row.id !== "string" ||
      typeof row.title !== "string" ||
      typeof row.category !== "string" ||
      !["draft", "published", "archived"].includes(row.status) ||
      !Number.isInteger(row.revision)
    ) {
      throw new KnowledgeEditorApiError("knowledge_article_load_failed");
    }
    return row as KnowledgeEditorSummary;
  });
}
