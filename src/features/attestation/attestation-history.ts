import { supabase } from "@/lib/supabase";
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

function storageKey(userId: string) {
  return `bf-learning-r18:${userId || "guest"}`;
}

function readLocalRecord(userId: string): LocalLearningRecord {
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

function writeLocalRecord(userId: string, record: LocalLearningRecord) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

function localHistory(userId: string, limit = 5): QuizHistoryItem[] {
  const record = readLocalRecord(userId);

  return (record.history || [])
    .slice(-limit)
    .reverse()
    .flatMap((item) => {
      if (
        item.time == null ||
        typeof item.correct !== "number" ||
        typeof item.total !== "number" ||
        typeof item.score !== "number" ||
        typeof item.passed !== "boolean"
      ) {
        return [];
      }

      return [
        {
          category: item.category || "Общий тест",
          categoryId: item.categoryId || null,
          time: item.time,
          correct: item.correct,
          total: item.total,
          score: item.score,
          passed: item.passed
        }
      ];
    });
}

export async function getQuizHistory(
  userId: string,
  limit = 5
): Promise<{
  items: QuizHistoryItem[];
  source: QuizHistorySource;
}> {
  if (!userId) {
    return {
      items: localHistory(userId, limit),
      source: "device"
    };
  }

  const { data, error } = await supabase
    .from("quiz_attempts")
    .select(
      "category,category_id,score,passed,total_questions,correct_answers,created_at,finished_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      items: localHistory(userId, limit),
      source: "device"
    };
  }

  return {
    items: (data || []).map((item) => ({
      category: item.category || "Общий тест",
      categoryId: item.category_id,
      time: item.finished_at || item.created_at,
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

  return writeLocalRecord(userId, record);
}

export async function persistQuizResultRemote(
  userId: string,
  result: QuizResult
) {
  if (!userId) throw new Error("auth_required");

  const { error } = await supabase.from("quiz_attempts").insert({
    user_id: userId,
    category: result.categoryLabel,
    category_id: result.categoryId,
    score: result.score,
    passed: result.passed,
    total_questions: result.total,
    correct_answers: result.correct,
    category_results: {
      pass_percent: result.passPercent,
      topics: result.topicResults,
      weak_topics: result.weakTopics
    },
    started_at: result.startedAt,
    finished_at: result.finishedAt
  });

  if (error) throw error;
}
