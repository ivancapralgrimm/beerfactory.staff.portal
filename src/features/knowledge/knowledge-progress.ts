import { supabase } from "@/lib/supabase";

type LocalKnowledgeRecord = {
  read?: string[];
  history?: unknown[];
};

const remoteCache = new Map<
  string,
  { readIds: Set<string>; loadedAt: number }
>();

const REMOTE_FRESH_MS = 30_000;

function storageKey(userId: string) {
  return `bf-learning-r18:${userId || "guest"}`;
}

function readLocalRecord(userId: string): LocalKnowledgeRecord {
  try {
    return (
      JSON.parse(localStorage.getItem(storageKey(userId)) || "null") || {
        read: [],
        history: []
      }
    );
  } catch {
    return { read: [], history: [] };
  }
}

function writeLocalRecord(userId: string, record: LocalKnowledgeRecord) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function getLocalReadIds(userId: string) {
  return new Set(readLocalRecord(userId).read || []);
}

export function markLocalArticleRead(userId: string, articleId: string) {
  const record = readLocalRecord(userId);

  record.read = [...new Set([...(record.read || []), articleId])];
  writeLocalRecord(userId, record);

  return new Set(record.read);
}

export async function getKnowledgeReadState(
  userId: string,
  options?: { force?: boolean }
) {
  const local = getLocalReadIds(userId);

  if (!userId) {
    return { readIds: local, source: "device" as const };
  }

  const cached = remoteCache.get(userId);
  const force = options?.force === true;

  if (!force && cached && Date.now() - cached.loadedAt < REMOTE_FRESH_MS) {
    return {
      readIds: new Set([...local, ...cached.readIds]),
      source: "profile" as const
    };
  }

  const { data, error } = await supabase
    .from("training_progress")
    .select("article_id,completed")
    .eq("user_id", userId)
    .eq("completed", true);

  if (error) throw error;

  const remote = new Set(
    (data || [])
      .map((item) => item.article_id)
      .filter((id): id is string => Boolean(id))
  );

  remoteCache.set(userId, {
    readIds: remote,
    loadedAt: Date.now()
  });

  const merged = new Set([...local, ...remote]);

  const record = readLocalRecord(userId);
  record.read = [...merged];
  writeLocalRecord(userId, record);

  return { readIds: merged, source: "profile" as const };
}

export async function markArticleReadRemote(
  userId: string,
  articleId: string
) {
  if (!userId) throw new Error("auth_required");

  const { error } = await supabase.from("training_progress").upsert(
    {
      user_id: userId,
      article_id: articleId,
      completed: true,
      progress_percent: 100,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,article_id" }
  );

  if (error) throw error;

  const cached = remoteCache.get(userId);
  const readIds = new Set(cached?.readIds || []);
  readIds.add(articleId);

  remoteCache.set(userId, {
    readIds,
    loadedAt: Date.now()
  });
}
