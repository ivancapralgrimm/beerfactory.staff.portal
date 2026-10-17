import { supabase } from "@/lib/supabase";
import {
  enqueueAttestationAttempt,
  listPendingAttestationAttempts,
  removePendingAttestationAttempt
} from "@/features/attestation/attestation-offline";
import type {
  QuizHistoryItem,
  QuizHistorySource,
  QuizResult
} from "@/features/attestation/types";

type LocalLearningRecord = {
  read?: string[];
  history?: Array<{
    clientAttemptId?: string;
    time?: number | string;
    correct?: number;
    total?: number;
    score?: number;
    passed?: boolean;
    category?: string;
    categoryId?: string;
    passPercent?: number;
  }>;
};

const uploadFlights = new Map<string, Promise<unknown>>();
const syncFlights = new Map<string, Promise<{ sent: number; pending: number }>>();
// Only retain acknowledgments whose local deletion failed. A retry cleans up
// without resubmitting an attempt already accepted by the server in this tab.
const acknowledgedUploads = new Map<string, unknown>();
// A background sync can finish between local durability and the page's direct
// save. Remember successful IDs in this tab so that direct save drains its
// re-enqueued copy without making a second ordinary request.
const completedUploads = new Map<string, unknown>();

async function requireCurrentUser(userId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !userId || data.session?.user.id !== userId) {
    throw new Error("attestation_account_changed");
  }
}

async function withUploadLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return await navigator.locks.request(`bfstaff-attestation-upload:${key}`, operation);
  }
  return operation();
}

type RecentTeamAttempt = {
  id: string;
  user_id: string;
  display_name: string;
  category: string;
  category_id: string | null;
  score: number;
  passed: boolean;
  total_questions: number;
  correct_answers: number;
  attempted_at: string;
};

function storageKey(userId: string) {
  return `bf-learning-r18:${userId || "guest"}`;
}

function readLocalRecord(userId: string): LocalLearningRecord {
  try {
    const record = JSON.parse(localStorage.getItem(storageKey(userId)) || "null");
    return record && typeof record === "object" && !Array.isArray(record)
      ? { ...record, history: Array.isArray(record.history) ? record.history : [] }
      : { read: [], history: [] };
  } catch {
    return { read: [], history: [] };
  }
}

function writeLocalRecord(userId: string, record: LocalLearningRecord) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

function createClientAttemptId() {
  const cryptoApi =
    typeof globalThis.crypto !== "undefined"
      ? globalThis.crypto
      : null;

  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join("-");
}

function ensureClientAttemptId(result: QuizResult) {
  if (!result.clientAttemptId) {
    result.clientAttemptId = createClientAttemptId();
  }
  return result.clientAttemptId;
}

function questionRevisions(result: QuizResult) {
  return result.questions.map((question) => ({
    id: question.id,
    revision: question.revision || 1
  }));
}

function uploadAttempt(
  userId: string,
  result: QuizResult,
  syncedFromOffline: boolean,
  requireQueued = true
) {
  const clientAttemptId = ensureClientAttemptId(result);
  const key = `${userId}:${clientAttemptId}`;
  const existing = uploadFlights.get(key);
  if (existing) return existing;

  const flight = withUploadLock(key, async () => {
    const pending = await listPendingAttestationAttempts(userId);
    const queued = pending.find((entry) => entry.clientAttemptId === clientAttemptId);
    if (requireQueued && !queued) {
      // Another tab may have uploaded and deleted it while we waited for its lock.
      acknowledgedUploads.delete(key);
      return null;
    }
    const snapshot = queued?.result || result;
    if (snapshot.clientAttemptId && snapshot.clientAttemptId !== clientAttemptId) {
      throw new Error("attestation_attempt_id_mismatch");
    }
    await requireCurrentUser(userId);

    let data = completedUploads.get(key) || acknowledgedUploads.get(key);
    if (!data) {
      const response = await supabase.rpc(
        "submit_attestation_attempt",
        {
          p_client_attempt_id: clientAttemptId,
          p_category: snapshot.categoryLabel,
          p_category_id: snapshot.categoryId,
          p_total_questions: snapshot.total,
          p_correct_answers: snapshot.correct,
          p_category_results: {
            pass_percent: snapshot.passPercent,
            topics: snapshot.topicResults,
            weak_topics: snapshot.weakTopics
          },
          p_started_at: snapshot.startedAt,
          p_finished_at: snapshot.finishedAt,
          p_question_revisions: questionRevisions(snapshot),
          p_synced_from_offline: syncedFromOffline
        }
      );

      if (response.error || !response.data) {
        throw response.error || new Error("attestation_sync_failed");
      }
      data = response.data;
      acknowledgedUploads.set(key, data);
    }

    try {
      await removePendingAttestationAttempt(clientAttemptId);
    } catch (cause) {
      throw Object.assign(new Error("attestation_ack_cleanup_failed"), {
        savedRemotely: true,
        cause
      });
    }
    acknowledgedUploads.delete(key);
    completedUploads.set(key, data);
    if (completedUploads.size > 500) completedUploads.delete(completedUploads.keys().next().value!);
    return data;
  });

  uploadFlights.set(key, flight);
  const clear = () => uploadFlights.delete(key);
  void flight.then(clear, clear);
  return flight;
}

async function deviceHistory(userId: string, limit: number) {
  const items = new Map<string, QuizHistoryItem>();
  const record = readLocalRecord(userId);
  for (const [index, item] of (record.history || []).entries()) {
    if (!item || typeof item.total !== "number" || typeof item.correct !== "number"
      || typeof item.score !== "number" || typeof item.passed !== "boolean"
      || item.time == null) continue;
    items.set(item.clientAttemptId || `legacy:${index}`, {
      category: item.category || "Общий тест",
      categoryId: item.categoryId,
      time: item.time,
      correct: item.correct,
      total: item.total,
      score: item.score,
      passed: item.passed
    });
  }
  for (const entry of await listPendingAttestationAttempts(userId)) {
    const result = entry.result;
    items.set(entry.clientAttemptId, {
      category: result.categoryLabel,
      categoryId: result.categoryId,
      time: result.finishedAt,
      correct: result.correct,
      total: result.total,
      score: result.score,
      passed: result.passed
    });
  }
  return {
    items: [...items.values()]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, Math.max(1, Math.min(limit, 10))),
    source: "device" as const
  };
}

export async function getQuizHistory(
  userId: string,
  limit = 5
): Promise<{
  items: QuizHistoryItem[];
  source: QuizHistorySource;
}> {
  if (!userId) return { items: [], source: "profile" };

  try {
    await requireCurrentUser(userId);
    const { data, error } = await supabase.rpc(
      "get_recent_attestation_attempts",
      { p_limit: limit }
    );

    if (error) throw error;

    const attempts = (data || []) as RecentTeamAttempt[];

    return {
      items: attempts.map((item) => ({
        category: `${item.display_name} · ${item.category || "Общий тест"}`,
        categoryId: item.category_id,
        time: item.attempted_at,
        correct: item.correct_answers,
        total: item.total_questions,
        score: item.score,
        passed: item.passed
      })),
      source: "profile"
    };
  } catch {
    return deviceHistory(userId, limit);
  }
}

export async function persistQuizResultLocally(
  userId: string,
  result: QuizResult
): Promise<boolean> {
  if (!userId) return false;
  const record = readLocalRecord(userId);
  const clientAttemptId = ensureClientAttemptId(result);

  record.history = [
    ...(record.history || []).filter((item) => item?.clientAttemptId !== clientAttemptId),
    {
      clientAttemptId,
      time: result.finishedAt,
      correct: result.correct,
      total: result.total,
      score: result.score,
      passed: result.passed,
      category: result.categoryLabel,
      categoryId: result.categoryId,
      passPercent: result.passPercent
    }
  ].slice(-100);

  writeLocalRecord(userId, record);
  try {
    await enqueueAttestationAttempt({
      clientAttemptId,
      userId,
      result,
      queuedAt: new Date().toISOString()
    });
    return true;
  } catch {
    return false;
  }
}

export async function persistQuizResultRemote(
  userId: string,
  result: QuizResult
) {
  if (!userId) throw new Error("auth_required");

  const clientAttemptId = ensureClientAttemptId(result);

  const queued = await enqueueAttestationAttempt({
    clientAttemptId,
    userId,
    result,
    queuedAt: new Date().toISOString()
  }).then(() => true, () => false);

  return uploadAttempt(userId, result, false, queued);
}

export function syncPendingAttestationAttempts(userId: string) {
  if (!userId) return Promise.resolve({ sent: 0, pending: 0 });
  const existing = syncFlights.get(userId);
  if (existing) return existing;
  const flight = syncUserAttempts(userId);
  syncFlights.set(userId, flight);
  const clear = () => syncFlights.delete(userId);
  void flight.then(clear, clear);
  return flight;
}

async function syncUserAttempts(userId: string) {
  const pending = await listPendingAttestationAttempts(userId);
  let sent = 0;

  for (const entry of pending) {
    try {
      const result = { ...entry.result, clientAttemptId: entry.clientAttemptId };
      if (await uploadAttempt(userId, result, true)) sent += 1;
    } catch {
      break;
    }
  }

  const remaining = await listPendingAttestationAttempts(userId);

  return { sent, pending: remaining.length };
}
