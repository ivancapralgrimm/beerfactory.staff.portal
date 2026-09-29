import type {
  QuestionBank,
  QuizAnswer,
  QuizCategory,
  QuizQuestion
} from "@/features/attestation/types";

const BANK_URL = "/assets/question-banks.json";
const EXPECTED_LABELS: Record<string, string> = {
  bar: "Бар",
  kitchen: "Кухня",
  wine: "Вино",
  service: "Сервис"
};
const MINIMUM_QUESTIONS: Record<string, number> = {
  bar: 50,
  kitchen: 100,
  wine: 50,
  service: 100
};

let cachedBank: QuestionBank | null = null;
let inflight: Promise<QuestionBank> | null = null;

function shuffle<T>(input: readonly T[]) {
  const output = [...input];

  for (let index = output.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[randomIndex]] = [
      output[randomIndex],
      output[index]
    ];
  }

  return output;
}

function isAnswer(value: unknown): value is QuizAnswer {
  if (!value || typeof value !== "object") return false;

  const answer = value as Record<string, unknown>;
  return (
    typeof answer.text === "string" &&
    answer.text.trim().length > 0 &&
    typeof answer.correct === "boolean"
  );
}

function isQuestion(value: unknown): value is QuizQuestion {
  if (!value || typeof value !== "object") return false;

  const question = value as Record<string, unknown>;

  return (
    typeof question.id === "string" &&
    question.id.length > 0 &&
    typeof question.q === "string" &&
    question.q.trim().length > 0 &&
    typeof question.group === "string" &&
    question.group.length > 0 &&
    typeof question.topic === "string" &&
    question.topic.length > 0 &&
    Array.isArray(question.answers) &&
    question.answers.length === 4 &&
    question.answers.every(isAnswer) &&
    question.answers.filter(
      (answer) => (answer as QuizAnswer).correct
    ).length === 1 &&
    new Set(
      question.answers.map((answer) =>
        (answer as QuizAnswer).text.trim().toLowerCase()
      )
    ).size === 4
  );
}

export function validateQuestionBank(value: unknown): QuestionBank {
  if (!value || typeof value !== "object") {
    throw new Error("question_bank_invalid");
  }

  const data = value as Record<string, unknown>;

  if (
    data.passPercent !== 80 ||
    data.questionsPerTest !== 15 ||
    !Array.isArray(data.categories) ||
    data.categories.length !== 4
  ) {
    throw new Error("question_bank_settings_invalid");
  }

  const seenCategoryIds = new Set<string>();
  const seenQuestionIds = new Set<string>();

  for (const rawCategory of data.categories) {
    if (!rawCategory || typeof rawCategory !== "object") {
      throw new Error("question_bank_category_invalid");
    }

    const category = rawCategory as unknown as QuizCategory;
    const minimum = MINIMUM_QUESTIONS[category.id];

    if (
      !minimum ||
      EXPECTED_LABELS[category.id] !== category.label ||
      seenCategoryIds.has(category.id) ||
      !Array.isArray(category.questions) ||
      category.questions.length < minimum ||
      !Array.isArray(category.ticketPlan)
    ) {
      throw new Error(`question_bank_category_invalid:${category.id || "unknown"}`);
    }

    seenCategoryIds.add(category.id);

    for (const question of category.questions) {
      if (
        !isQuestion(question) ||
        seenQuestionIds.has(question.id)
      ) {
        throw new Error(
          `question_bank_question_invalid:${question?.id || "unknown"}`
        );
      }

      seenQuestionIds.add(question.id);
    }

    const ticketCount = category.ticketPlan.reduce(
      (total, part) => total + part.count,
      0
    );

    if (ticketCount !== data.questionsPerTest) {
      throw new Error(`question_bank_ticket_invalid:${category.id}`);
    }

    const seenTopics = new Set<string>();

    for (const part of category.ticketPlan) {
      if (
        !part ||
        typeof part.topic !== "string" ||
        !Number.isInteger(part.count) ||
        part.count < 1 ||
        seenTopics.has(part.topic)
      ) {
        throw new Error(`question_bank_ticket_invalid:${category.id}`);
      }

      seenTopics.add(part.topic);

      const groups = new Set(
        category.questions
          .filter((question) => question.topic === part.topic)
          .map((question) => question.group)
      );

      if (groups.size < part.count) {
        throw new Error(
          `question_bank_ticket_capacity:${category.id}:${part.topic}`
        );
      }
    }
  }

  return data as unknown as QuestionBank;
}

async function fetchQuestionBank() {
  const response = await fetch(BANK_URL, { cache: "no-cache" });

  if (!response.ok) {
    throw new Error(`question_bank_http_${response.status}`);
  }

  const bank = validateQuestionBank(await response.json());
  cachedBank = bank;
  return bank;
}

export async function loadQuestionBank(options?: { force?: boolean }) {
  const force = options?.force === true;

  if (!force && cachedBank) return cachedBank;
  if (!force && inflight) return inflight;

  inflight = fetchQuestionBank();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

function copyQuestionWithShuffledAnswers(question: QuizQuestion) {
  return {
    ...question,
    answers: shuffle(
      question.answers.map((answer) => ({ ...answer }))
    )
  };
}

export function buildQuizTicket(category: QuizCategory) {
  const ticket: QuizQuestion[] = [];

  for (const part of category.ticketPlan) {
    const groups = new Map<string, QuizQuestion[]>();

    for (const question of category.questions) {
      if (question.topic !== part.topic) continue;

      const group = groups.get(question.group) || [];
      group.push(question);
      groups.set(question.group, group);
    }

    const selectedGroups = shuffle([...groups.values()]).slice(
      0,
      part.count
    );

    for (const group of selectedGroups) {
      const question = shuffle(group)[0];
      ticket.push(copyQuestionWithShuffledAnswers(question));
    }
  }

  return shuffle(ticket);
}

export function hasPassed(
  correct: number,
  total: number,
  passPercent: number
) {
  return total > 0 && correct * 100 >= total * passPercent;
}

export function normalizeReviewRoute(question: QuizQuestion) {
  const reviewUrl = question.reviewUrl || "";

  if (reviewUrl === "#/menu") {
    const query = question.reviewNote?.trim();

    return query
      ? `/menu?q=${encodeURIComponent(query)}`
      : "/menu";
  }

  const legacyArticle = reviewUrl.match(
    /^#\/article\/(lesson-\d+)$/
  );

  if (legacyArticle) {
    return `/knowledge/${legacyArticle[1]}`;
  }

  if (reviewUrl.startsWith("#/knowledge/")) {
    return reviewUrl.slice(1);
  }

  return null;
}
