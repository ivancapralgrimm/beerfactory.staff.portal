export type QuizAnswer = {
  text: string;
  correct: boolean;
};

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
  reviewNote?: string;
};

export type QuizTicketPlanPart = {
  topic: string;
  count: number;
};

export type QuizCategory = {
  id: string;
  label: string;
  questions: QuizQuestion[];
  ticketPlan: QuizTicketPlanPart[];
};

export type QuestionBank = {
  passPercent: number;
  questionsPerTest: number;
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

export type TopicResult = {
  total: number;
  correct: number;
};

export type QuizResult = {
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
  weakTopics: Array<{
    topic: string;
    total: number;
    correct: number;
  }>;
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
