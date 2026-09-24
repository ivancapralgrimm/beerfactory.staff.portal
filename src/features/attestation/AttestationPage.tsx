import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  RefreshCw,
  RotateCcw,
  Trophy
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import {
  buildQuizTicket,
  hasPassed,
  normalizeReviewRoute
} from "@/features/attestation/attestation-data";
import {
  getQuizHistory,
  persistQuizResultLocally,
  persistQuizResultRemote
} from "@/features/attestation/attestation-history";
import { CategoryMotionIcon } from "@/features/attestation/CategoryMotionIcon";
import { PassedScoreConfetti } from "@/features/attestation/PassedScoreConfetti";
import { useAttestationBank } from "@/features/attestation/use-attestation-bank";
import type {
  QuizAttempt,
  QuizHistoryItem,
  QuizHistorySource,
  QuizQuestion,
  QuizResult
} from "@/features/attestation/types";
import { cn } from "@/lib/utils";

const ANSWER_LABELS = ["А", "Б", "В", "Г"];

function formatHistoryTime(value: string | number) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Дата неизвестна";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function buildResult(
  attempt: QuizAttempt,
  answers: number[]
): QuizResult {
  const topicResults: QuizResult["topicResults"] = {};

  let correct = 0;

  attempt.questions.forEach((question, index) => {
    const chosen = question.answers[answers[index]];
    const topic = question.topic || "Общее";

    if (!topicResults[topic]) {
      topicResults[topic] = { total: 0, correct: 0 };
    }

    topicResults[topic].total += 1;

    if (chosen?.correct) {
      correct += 1;
      topicResults[topic].correct += 1;
    }
  });

  const total = attempt.questions.length;
  const score = total
    ? Math.round((correct / total) * 100)
    : 0;

  return {
    categoryId: attempt.categoryId,
    categoryLabel: attempt.categoryLabel,
    passPercent: attempt.passPercent,
    questions: attempt.questions,
    answers,
    total,
    correct,
    score,
    passed: hasPassed(correct, total, attempt.passPercent),
    startedAt: attempt.startedAt,
    finishedAt: new Date().toISOString(),
    topicResults,
    weakTopics: Object.entries(topicResults)
      .filter(([, value]) => value.correct < value.total)
      .map(([topic, value]) => ({
        topic,
        total: value.total,
        correct: value.correct
      }))
  };
}

function HistoryList({
  items,
  source
}: {
  items: QuizHistoryItem[];
  source: QuizHistorySource;
}) {
  return (
    <section className="border-t border-[var(--bf-line)] pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">ИСТОРИЯ</p>
          <h2 className="mt-1 text-xl font-extrabold">
            Последние попытки
          </h2>
        </div>
        <span className="pt-1 text-[11px] text-[var(--bf-dim)]">
          {source === "profile" ? "профиль" : "устройство"}
        </span>
      </div>

      {items.length ? (
        <div className="mt-3 divide-y divide-[var(--bf-line)] border-y border-[var(--bf-line)]">
          {items.map((item, index) => (
            <div
              key={`${item.time}-${index}`}
              className="grid grid-cols-[1fr_auto] gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="font-bold text-[var(--bf-cream)]">
                  {item.category}
                </p>
                <p className="mt-1 text-xs text-[var(--bf-dim)]">
                  {formatHistoryTime(item.time)}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "font-black",
                    item.passed
                      ? "text-[var(--bf-green)]"
                      : "text-[#e99990]"
                  )}
                >
                  {item.score}%
                </p>
                <p className="mt-1 text-xs text-[var(--bf-dim)]">
                  {item.correct}/{item.total}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 border-y border-[var(--bf-line)] py-4 text-sm text-[var(--bf-muted)]">
          Попыток пока нет.
        </p>
      )}
    </section>
  );
}

function QuizQuestionView({
  attempt,
  onSelect,
  onNext,
  onExit
}: {
  attempt: QuizAttempt;
  onSelect: (index: number) => void;
  onNext: () => void;
  onExit: () => void;
}) {
  const question = attempt.questions[attempt.index];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const progress = Math.round(
    ((attempt.index + 1) / attempt.questions.length) * 100
  );

  useEffect(() => {
    window.scrollTo(0, 0);
    headingRef.current?.focus();
  }, [attempt.index]);

  return (
    <section className="mx-auto max-w-2xl pb-6">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          className="-ml-3"
          onClick={onExit}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Выйти
        </Button>
        <span className="rounded-full border border-[var(--bf-line)] px-3 py-2 text-xs font-bold text-[var(--bf-muted)]">
          {attempt.categoryLabel} · {attempt.index + 1}/{attempt.questions.length}
        </span>
      </div>

      <div
        className="mt-4 h-1 overflow-hidden rounded-full bg-[var(--bf-surface-2)]"
        role="progressbar"
        aria-label="Прогресс аттестации"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div
          className="h-full rounded-full bg-[var(--bf-copper-hi)] transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-6 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--bf-copper-hi)]">
        {question.topic}
      </p>

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-balance text-[30px] font-black leading-[1.08] tracking-[-0.035em] outline-none sm:text-[36px]"
      >
        {question.q}
      </h1>

      <div
        className="mt-6 grid gap-2.5"
        role="group"
        aria-label="Варианты ответа"
      >
        {question.answers.map((answer, index) => {
          const selected = attempt.selected === index;

          return (
            <button
              key={`${answer.text}-${index}`}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(index)}
              className={cn(
                "grid min-h-[64px] grid-cols-[34px_1fr] items-center gap-3 rounded-2xl border px-3 py-3 text-left outline-none transition-[background-color,border-color,color,transform] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)] active:translate-y-px",
                selected
                  ? "border-[var(--bf-copper-hi)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_82%)] text-[var(--bf-cream)]"
                  : "border-[var(--bf-line)] bg-[var(--bf-surface)] text-[var(--bf-muted)]"
              )}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full border text-xs font-black",
                  selected
                    ? "border-[var(--bf-copper-hi)] bg-[var(--bf-copper)] text-[#fff8ed]"
                    : "border-[var(--bf-line-strong)] text-[var(--bf-dim)]"
                )}
                aria-hidden
              >
                {ANSWER_LABELS[index]}
              </span>
              <span className="text-[15px] font-semibold leading-5">
                {answer.text}
              </span>
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        variant="primary"
        size="lg"
        className="mt-6 w-full"
        disabled={attempt.selected == null}
        onClick={onNext}
      >
        {attempt.index === attempt.questions.length - 1
          ? "Завершить аттестацию"
          : "Ответить"}
      </Button>

      <p className="mt-3 text-center text-xs leading-5 text-[var(--bf-dim)]">
        Правильный ответ будет показан только после завершения попытки.
      </p>
    </section>
  );
}

function ResultView({
  result,
  saveStatus,
  onRestart
}: {
  result: QuizResult;
  saveStatus: string;
  onRestart: () => void;
}) {
  const mistakes = result.questions.flatMap((question, index) => {
    const chosen = question.answers[result.answers[index]];

    return chosen?.correct
      ? []
      : [{ question, chosenIndex: result.answers[index] }];
  });

  return (
    <section className="bf-result-page mx-auto max-w-3xl pb-7">
      <div className="bf-result-celebration relative isolate border-y border-[var(--bf-line)] py-7 text-center sm:py-9">
        {result.passed && result.total > 0 ? (
          <PassedScoreConfetti />
        ) : null}
        <p className="eyebrow">
          РЕЗУЛЬТАТ · {result.categoryLabel.toUpperCase()}
        </p>

        <div className="bf-result-trophy" aria-hidden>{result.passed ? "🏆" : "✦"}</div>

        <div
          className={cn(
            "bf-result-score mt-3 text-[72px] font-black leading-none tracking-[-0.06em]",
            result.passed
              ? "text-[var(--bf-green)]"
              : "text-[#e99990]"
          )}
        >
          {result.score}%
        </div>

        <h1 className="mt-3 text-2xl font-black">
          {result.passed
            ? "Аттестация пройдена"
            : "Нужно повторить материал"}
        </h1>
        <p className="mt-2 text-sm text-[var(--bf-muted)]">
          {result.correct} из {result.total} · проходной порог{" "}
          {result.passPercent}%
        </p>

        <p
          className="mt-3 min-h-5 text-xs text-[var(--bf-dim)]"
          role="status"
          aria-live="polite"
        >
          {saveStatus}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="primary" onClick={onRestart}>
            <RotateCcw className="size-4" aria-hidden />
            Новая попытка
          </Button>
          <Button asChild>
            <Link to="/knowledge">
              <BookOpen className="size-4" aria-hidden />
              К знаниям
            </Link>
          </Button>
        </div>
      </div>

      {result.weakTopics.length ? (
        <section className="mt-6 border-b border-[var(--bf-line)] pb-5">
          <p className="eyebrow">ПОВТОРИТЬ</p>
          <h2 className="mt-1 text-xl font-extrabold">
            Темы с ошибками
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.weakTopics.map((topic) => (
              <span
                key={topic.topic}
                className="rounded-full border border-[var(--bf-line)] px-3 py-2 text-xs font-bold text-[var(--bf-muted)]"
              >
                {topic.topic} · {topic.correct}/{topic.total}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {mistakes.length ? (
        <section className="mt-6">
          <p className="eyebrow">РАЗБОР ОШИБОК</p>
          <h2 className="mt-1 text-2xl font-black">
            Что стоит повторить
          </h2>

          <div className="mt-3 divide-y divide-[var(--bf-line)] border-y border-[var(--bf-line)]">
            {mistakes.map(({ question, chosenIndex }, index) => {
              const chosen = question.answers[chosenIndex];
              const correct = question.answers.find(
                (answer) => answer.correct
              );
              const reviewRoute = normalizeReviewRoute(question);

              return (
                <article
                  key={question.id}
                  className="py-5"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[color:color-mix(in_srgb,var(--bf-red),transparent_55%)] text-xs font-black text-[#e99990]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--bf-copper-hi)]">
                        {question.topic}
                      </p>
                      <h3 className="mt-1 text-lg font-extrabold leading-6">
                        {question.q}
                      </h3>

                      <p className="mt-3 text-sm leading-6 text-[var(--bf-muted)]">
                        Ваш ответ:{" "}
                        <span className="text-[#e99990]">
                          {chosen?.text || "Нет ответа"}
                        </span>
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--bf-muted)]">
                        Верно:{" "}
                        <span className="font-bold text-[#9dd0a0]">
                          {correct?.text || "Ответ не найден"}
                        </span>
                      </p>

                      {question.reviewNote ? (
                        <p className="mt-2 text-xs text-[var(--bf-dim)]">
                          {question.reviewNote}
                        </p>
                      ) : null}

                      {reviewRoute ? (
                        <Button
                          asChild
                          variant="secondary"
                          className="mt-3"
                        >
                          <Link to={reviewRoute}>
                            <BookOpen className="size-4" aria-hidden />
                            {question.reviewLabel || "Повторить тему"}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="mt-6 flex items-start gap-3 border-y border-[var(--bf-line)] py-5">
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-[var(--bf-green)]"
            aria-hidden
          />
          <div>
            <h2 className="font-extrabold">
              Без ошибок
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--bf-muted)]">
              Все ответы в этой попытке верные.
            </p>
          </div>
        </section>
      )}
    </section>
  );
}

export function AttestationPage() {
  const { state: auth } = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : "";
  const { state, reload } = useAttestationBank();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);
  const [historySource, setHistorySource] =
    useState<QuizHistorySource>("device");
  const [historyLoading, setHistoryLoading] = useState(true);

  async function refreshHistory() {
    setHistoryLoading(true);

    try {
      const loaded = await getQuizHistory(userId, 5);
      setHistory(loaded.items);
      setHistorySource(loaded.source);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void refreshHistory();
  }, [userId]);

  const selectedCategory = useMemo(() => {
    if (state.status !== "ready" || !selectedCategoryId) return null;

    return (
      state.bank.categories.find(
        (category) => category.id === selectedCategoryId
      ) || null
    );
  }, [selectedCategoryId, state]);

  function startQuiz() {
    if (state.status !== "ready" || !selectedCategory) return;

    const questions = buildQuizTicket(selectedCategory);

    if (questions.length !== state.bank.questionsPerTest) {
      return;
    }

    setSaveStatus("");
    setResult(null);
    setAttempt({
      categoryId: selectedCategory.id,
      categoryLabel: selectedCategory.label,
      passPercent: state.bank.passPercent,
      questions,
      index: 0,
      answers: [],
      selected: null,
      startedAt: new Date().toISOString()
    });
  }

  function exitQuiz() {
    if (!attempt) return;

    if (
      window.confirm(
        "Прервать попытку? Незавершённый результат не сохранится."
      )
    ) {
      setAttempt(null);
      window.scrollTo(0, 0);
    }
  }

  function submitAnswer() {
    if (!attempt || attempt.selected == null) return;

    const answers = [...attempt.answers, attempt.selected];

    if (attempt.index < attempt.questions.length - 1) {
      setAttempt({
        ...attempt,
        index: attempt.index + 1,
        answers,
        selected: null
      });
      return;
    }

    const completed = buildResult(attempt, answers);

    persistQuizResultLocally(userId, completed);
    setAttempt(null);
    setResult(completed);
    setSaveStatus("Сохраняем результат в профиль…");
    window.scrollTo(0, 0);

    void persistQuizResultRemote(userId, completed)
      .then(() => {
        setSaveStatus("Результат сохранён в профиле.");
        return refreshHistory();
      })
      .catch(() => {
        setSaveStatus(
          "Профиль сейчас недоступен. Результат сохранён на этом устройстве."
        );
      });
  }

  if (attempt) {
    return (
      <QuizQuestionView
        attempt={attempt}
        onSelect={(index) =>
          setAttempt((current) =>
            current ? { ...current, selected: index } : current
          )
        }
        onNext={submitAnswer}
        onExit={exitQuiz}
      />
    );
  }

  if (result) {
    return (
      <ResultView
        result={result}
        saveStatus={saveStatus}
        onRestart={() => {
          setResult(null);
          setSaveStatus("");
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  return (
    <section className="bf-attestation-page mx-auto max-w-3xl pb-6">
      <div className="max-w-2xl">
        <p className="eyebrow">ПРОВЕРКА ЗНАНИЙ</p>
        <h1 className="mt-2 text-[36px] font-black leading-none tracking-[-0.04em]">
          Аттестация
        </h1>
        <p className="mt-3 text-pretty text-[15px] leading-6 text-[var(--bf-muted)]">
          15 вопросов. Зачёт от 12 верных ответов (80%).
        </p>
      </div>

      {state.status === "loading" ? (
        <div className="mt-6 grid grid-cols-2 gap-2.5" aria-label="Загрузка банка вопросов">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface)]"
            />
          ))}
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-6 border-y border-[var(--bf-line)] py-6">
          <p className="text-lg font-extrabold">
            Банк вопросов не загрузился
          </p>
          <p className="mt-1 max-w-lg text-sm leading-6 text-[var(--bf-muted)]">
            Аттестацию нельзя начинать с неполными или повреждёнными данными.
          </p>
          <Button className="mt-4" onClick={reload}>
            <RefreshCw className="size-4" aria-hidden />
            Повторить
          </Button>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <>
          <section className="mt-6 border-y border-[var(--bf-line)] py-5">
            <p className="eyebrow">КАТЕГОРИЯ</p>
            <h2 className="mt-1 text-xl font-extrabold">
              Выбери блок вопросов
            </h2>

            <div
              className="bf-category-grid mt-4 grid grid-cols-2 gap-2.5"
              role="group"
              aria-label="Категория вопросов"
            >
              {state.bank.categories.map((category) => {
                const selected =
                  category.id === selectedCategoryId;

                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setSelectedCategoryId(category.id)
                    }
                    className={cn(
                      "bf-category-option grid min-h-[88px] grid-cols-[1fr_56px] items-center gap-3 rounded-2xl border p-4 text-left outline-none transition-[background-color,border-color,transform] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)] active:translate-y-px",
                      selected
                        ? "border-[var(--bf-copper-hi)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_82%)]"
                        : "border-[var(--bf-line)] bg-[var(--bf-surface)]"
                    )}
                  >
                    <strong className="block text-xl font-black text-[var(--bf-cream)]">
                      {category.label}
                    </strong>
                    <CategoryMotionIcon
                      categoryId={category.id}
                      selected={selected}
                    />
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                size="lg"
                disabled={!selectedCategory}
                onClick={startQuiz}
              >
                Начать
                {selectedCategory
                  ? ` · ${selectedCategory.label}`
                  : ""}
              </Button>

              <Button asChild size="lg">
                <Link to="/knowledge">
                  <BookOpen className="size-4" aria-hidden />
                  К знаниям
                </Link>
              </Button>
            </div>

          </section>

          {historyLoading ? (
            <section className="mt-5 border-t border-[var(--bf-line)] pt-5">
              <div className="h-20 animate-pulse rounded-xl bg-[var(--bf-surface)]" />
            </section>
          ) : (
            <div className="mt-5">
              <HistoryList
                items={history}
                source={historySource}
              />
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
