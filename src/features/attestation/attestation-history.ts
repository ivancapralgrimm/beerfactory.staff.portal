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

export async function getQuizHistory(
  userId: string,
  limit = 5
): Promise<{
  items: QuizHistoryItem[];
  source: QuizHistorySource;
}> {
  if (!userId) {
    return { items: [], source: "profile" };
  }

  const { data, error } = await supabase.rpc(
    "get_recent_attestation_attempts",
    { p_limit: limit }
  );

  if (error) {
    return { items: [], source: "profile" };
  }

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
