export type KnowledgeType = "bar" | "kitchen" | "wine" | "service";
export type AttestationVenue = "bf" | "bb" | "common";

export type QuizAnswer = { text: string; correct: boolean };
export type QuizQuestion = {
  id: string;
  q: string;
  answers: QuizAnswer[];
  source?: string;
  sourceRef?: string;
  group: string;
  reviewUrl?: string;
  reviewLabel?: string;
  topic: string;
  subcategory?: string | null;
  reviewNote?: string;
  revision?: number;
  knowledgeType: KnowledgeType;
  venue: AttestationVenue;
};
export type QuizTicketPlanPart = { topic: string; count: number };
export type QuizCategory = {
  id: string;
  label: string;
  questionsPerTest: number;
  knowledgeType: KnowledgeType;
  venue: AttestationVenue;
  specificQuestionCount: number | null;
  questions: QuizQuestion[];
  ticketPlan: QuizTicketPlanPart[];
};
export type QuestionBank = {
  schemaVersion: 3;
  /** Transitional, in-memory view of the original BF tickets before v3 SQL. Never persisted. */
  legacyCompatibility?: true;
  passPercent: number;
  questionsPerTest: number;
  revision?: number;
  generatedAt?: string;
  categories: QuizCategory[];
};
export type QuizAttempt = {
  categoryId: string;
  categoryLabel: string;
  passPercent: number;
  questions: QuizQuestion[];
  index: number;
  answers: number[];
  selected: number | null;
  startedAt: string;
};
export type TopicResult = { total: number; correct: number };
export type QuizResult = {
  clientAttemptId?: string;
  categoryId: string;
  categoryLabel: string;
  passPercent: number;
  questions: QuizQuestion[];
  answers: number[];
  total: number;
  correct: number;
  score: number;
  passed: boolean;
  startedAt: string;
  finishedAt: string;
  topicResults: Record<string, TopicResult>;
  weakTopics: Array<{ topic: string; total: number; correct: number }>;
};
export type QuizHistoryItem = {
  category: string;
  categoryId?: string | null;
  time: string | number;
  correct: number;
  total: number;
  score: number;
  passed: boolean;
};
export type QuizHistorySource = "profile" | "device";
