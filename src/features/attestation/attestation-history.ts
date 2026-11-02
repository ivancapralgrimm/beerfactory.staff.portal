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
    snapshot?: QuizResult;
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
            weak_topics: snapshot.weakTopics,
            // Immutable answer order is essential: live questions may be edited or deleted later.
            attempt_snapshot: { schemaVersion: 1, questions: snapshot.questions, answers: snapshot.answers }
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

async function deviceHistory(userId: string, limit: number, maximum = 10) {
  const items = new Map<string, QuizHistoryItem>();
  const record = readLocalRecord(userId);
  for (const [index, item] of (record.history || []).entries()) {
    if (!item || typeof item.total !== "number" || typeof item.correct !== "number"
      || typeof item.score !== "number" || typeof item.passed !== "boolean"
      || item.time == null) continue;
    items.set(item.clientAttemptId || `legacy:${index}`, {
      id: item.clientAttemptId,
      userId,
      snapshot: item.snapshot,
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
      id: entry.clientAttemptId,
      userId,
      snapshot: result,
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
      .slice(0, Math.max(1, Math.min(limit, maximum))),
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
        id: item.id,
        userId: item.user_id,
        displayName: item.display_name,
        category: item.category || "Общий тест",
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
      passPercent: result.passPercent,
      snapshot: result
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


/** Decode only a complete immutable snapshot. Never rebuild an old attempt from the current bank. */
export function decodeQuizAttemptSnapshot(row: {
  category?: string | null; category_id?: string | null; total_questions: number;
  correct_answers: number; score: number; passed: boolean; started_at?: string | null;
  finished_at?: string | null; created_at?: string; category_results: unknown;
}): QuizResult | null {
  const payload = row.category_results as { pass_percent?: unknown; attempt_snapshot?: { schemaVersion?: unknown; questions?: unknown; answers?: unknown } } | null;
  const snapshot = payload?.attempt_snapshot;
  if (snapshot?.schemaVersion !== 1 || !Array.isArray(snapshot.questions) || !Array.isArray(snapshot.answers)
    || snapshot.questions.length !== row.total_questions || snapshot.answers.length !== row.total_questions
    || !Number.isInteger(row.total_questions) || row.total_questions < 1 || row.total_questions > 50
    || !Number.isInteger(row.correct_answers) || row.correct_answers < 0 || row.correct_answers > row.total_questions
    || !Number.isInteger(row.score) || typeof row.passed !== "boolean" || !Number.isInteger(payload?.pass_percent)
    || Number(payload?.pass_percent) < 50 || Number(payload?.pass_percent) > 100) return null;
  const questions = snapshot.questions;
  const answers = snapshot.answers;
  const topicResults: QuizResult["topicResults"] = Object.create(null);
  const questionIds = new Set<string>();
  let correct = 0;
  for (const [index, question] of questions.entries()) {
    if (!question || typeof question !== "object" || typeof question.id !== "string" || typeof question.q !== "string"
      || !question.id.trim() || questionIds.has(question.id) || !question.q.trim() || typeof question.topic !== "string"
      || typeof question.group !== "string" || !question.group.trim()
      || !["bar", "kitchen", "wine", "service"].includes(question.knowledgeType)
      || !["bf", "bb", "common"].includes(question.venue)
      || ["source", "sourceRef", "reviewUrl", "reviewLabel", "reviewNote", "subcategory"].some(key => question[key] != null && typeof question[key] !== "string")
      || (question.revision != null && (!Number.isInteger(question.revision) || question.revision < 1))
      || !Array.isArray(question.answers)
      || question.answers.length !== 4 || question.answers.some((answer: unknown) => !answer || typeof answer !== "object"
        || typeof (answer as { text?: unknown }).text !== "string" || !(answer as { text: string }).text.trim()
        || typeof (answer as { correct?: unknown }).correct !== "boolean")
      || new Set(question.answers.map((answer: { text: string }) => answer.text.trim().toLocaleLowerCase("ru"))).size !== 4
      || question.answers.filter((answer: { correct: boolean }) => answer.correct).length !== 1
      || !Number.isInteger(answers[index]) || answers[index] < 0 || answers[index] >= question.answers.length) return null;
    questionIds.add(question.id);
    const topic = question.topic || "Общее";
    if (!topicResults[topic]) topicResults[topic] = { total: 0, correct: 0 };
    topicResults[topic].total += 1;
    if (question.answers[answers[index]].correct) { correct += 1; topicResults[topic].correct += 1; }
  }
  if (correct !== row.correct_answers || Math.round(correct / row.total_questions * 100) !== row.score
    || (correct * 100 >= row.total_questions * Number(payload?.pass_percent)) !== row.passed) return null;
  const finishedAt = row.finished_at || row.created_at;
  if (!finishedAt || !Number.isFinite(Date.parse(finishedAt))) return null;
  // A missing start time is shown as unknown by the result view, never invented.
  const startedAt = row.started_at && Number.isFinite(Date.parse(row.started_at)) && Date.parse(row.started_at) <= Date.parse(finishedAt) ? row.started_at : "";
  return { categoryId: row.category_id || "", categoryLabel: row.category || "Общий тест",
    questions, answers, total: row.total_questions, correct, score: row.score, passed: row.passed,
    passPercent: Number(payload?.pass_percent), startedAt, finishedAt,
    topicResults, weakTopics: Object.entries(topicResults).filter(([, result]) => result.correct < result.total)
      .map(([topic, result]) => ({ topic, ...result })) };
}

export async function getQuizAttemptDetail(attemptId: string, userId: string): Promise<{ summary: QuizHistoryItem; result: QuizResult | null } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId)) return null;
  await requireCurrentUser(userId);
  // This direct read deliberately keeps the existing owner/admin RLS policy.
  // The broad team-summary RPC does not grant access to another person's answers.
  const { data, error } = await supabase.from("quiz_attempts")
    .select("id,user_id,category,category_id,score,passed,total_questions,correct_answers,category_results,started_at,finished_at,created_at")
    .eq("id", attemptId).maybeSingle();
  if (error) throw error;
  await requireCurrentUser(userId);
  if (!data) return null;
  return { summary: { id: data.id, userId: data.user_id, category: data.category || "Общий тест", categoryId: data.category_id,
    score: data.score, passed: data.passed, total: data.total_questions, correct: data.correct_answers,
    time: data.finished_at || data.created_at }, result: decodeQuizAttemptSnapshot(data) };
}

export async function getPersonalQuizHistory(userId: string, limit = 100): Promise<{ items: QuizHistoryItem[]; source: QuizHistorySource }> {
  if (!userId) return { items: [], source: "profile" };
  try {
    await requireCurrentUser(userId);
    const { data, error } = await supabase.from("quiz_attempts")
      .select("id,user_id,category,category_id,score,passed,total_questions,correct_answers,finished_at,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(Math.min(100, Math.max(1, limit)));
    if (error) throw error;
    await requireCurrentUser(userId);
    return { source: "profile", items: (data || []).map(item => ({ id: item.id, userId: item.user_id, category: item.category || "Общий тест",
      categoryId: item.category_id, time: item.finished_at || item.created_at, correct: item.correct_answers,
      total: item.total_questions, score: item.score, passed: item.passed })) };
  } catch { return deviceHistory(userId, limit, 100); }
}
