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
    return JSON.parse(localStorage.getItem(storageKey(userId)) || "null") || {
      read: [],
      history: []
    };
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

async function uploadAttempt(
  userId: string,
  result: QuizResult,
  syncedFromOffline: boolean
) {
  const clientAttemptId = ensureClientAttemptId(result);

  const { data, error } = await supabase.rpc(
    "submit_attestation_attempt",
    {
      p_client_attempt_id: clientAttemptId,
      p_category: result.categoryLabel,
      p_category_id: result.categoryId,
      p_total_questions: result.total,
      p_correct_answers: result.correct,
      p_category_results: {
        pass_percent: result.passPercent,
        topics: result.topicResults,
        weak_topics: result.weakTopics
      },
      p_started_at: result.startedAt,
      p_finished_at: result.finishedAt,
      p_question_revisions: questionRevisions(result),
      p_synced_from_offline: syncedFromOffline
    }
  );

  if (error || !data) {
    throw error || new Error("attestation_sync_failed");
  }

  await removePendingAttestationAttempt(clientAttemptId).catch(
    () => undefined
  );

  return data;
}

export async function getQuizHistory(
  userId: string,
  limit = 5
): Promise<{
  items: QuizHistoryItem[];
  source: QuizHistorySource;
}> {
  if (!userId) return { items: [], source: "profile" };

  const { data, error } = await supabase.rpc(
    "get_recent_attestation_attempts",
    { p_limit: limit }
  );

  if (error) return { items: [], source: "profile" };

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
}

export function persistQuizResultLocally(
  userId: string,
  result: QuizResult
) {
  const record = readLocalRecord(userId);
  const clientAttemptId = ensureClientAttemptId(result);

  record.history = [
    ...(record.history || []),
    {
      time: Date.now(),
      correct: result.correct,
      total: result.total,
      score: result.score,
      passed: result.passed,
      category: result.categoryLabel,
      categoryId: result.categoryId,
      passPercent: result.passPercent
    }
  ].slice(-100);

  void enqueueAttestationAttempt({
    clientAttemptId,
    userId,
    result,
    queuedAt: new Date().toISOString()
  }).catch(() => undefined);

  return writeLocalRecord(userId, record);
}

export async function persistQuizResultRemote(
  userId: string,
  result: QuizResult
) {
  if (!userId) throw new Error("auth_required");

  const clientAttemptId = ensureClientAttemptId(result);

  await enqueueAttestationAttempt({
    clientAttemptId,
    userId,
    result,
    queuedAt: new Date().toISOString()
  }).catch(() => undefined);

  return uploadAttempt(userId, result, false);
}

export async function syncPendingAttestationAttempts(userId: string) {
  if (!userId) return { sent: 0, pending: 0 };

  const pending = await listPendingAttestationAttempts(userId).catch(
    () => []
  );
  let sent = 0;

  for (const entry of pending) {
    try {
      await uploadAttempt(userId, entry.result, true);
      sent += 1;
    } catch {
      break;
    }
  }

  const remaining = await listPendingAttestationAttempts(userId).catch(
    () => []
  );

  return { sent, pending: remaining.length };
}
