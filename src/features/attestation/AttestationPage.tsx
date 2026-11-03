import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WarmBack } from "@/components/warm/WarmBack";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmTitle, WarmNotice, WarmEmpty } from "@/components/warm/WarmPage";
import { WarmDialog } from "@/components/warm/WarmDialog";
import { useWarmExam } from "@/components/warm/WarmHeader";
import { useAuth } from "@/features/auth/auth-context";
import { buildQuizTicket, hasPassed, normalizeReviewRoute } from "./attestation-data";
import { decodeQuizAttemptSnapshot, getPersonalQuizHistory, getQuizAttemptDetail, getQuizHistory, persistQuizResultLocally, persistQuizResultRemote } from "./attestation-history";
import { PassedScoreConfetti } from "./PassedScoreConfetti";
import { useAttestationBank } from "./use-attestation-bank";
import type { QuizAttempt, QuizHistoryItem, QuizHistorySource, QuizResult, QuizQuestion } from "./types";
import "./attestation.css";

function formatHistoryTime(value: string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата неизвестна";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}
function buildResult(attempt: QuizAttempt, answers: number[]): QuizResult {
  const topicResults: QuizResult["topicResults"] = Object.create(null);
  let correct = 0;
  attempt.questions.forEach((question, index) => {
    const topic = question.topic || "Общее";
    if (!topicResults[topic]) topicResults[topic] = { total: 0, correct: 0 };
    topicResults[topic].total += 1;
    if (question.answers[answers[index]]?.correct) { correct += 1; topicResults[topic].correct += 1; }
  });
  const total = attempt.questions.length;
  return { categoryId: attempt.categoryId, categoryLabel: attempt.categoryLabel, passPercent: attempt.passPercent,
    questions: attempt.questions, answers, total, correct, score: total ? Math.round(correct / total * 100) : 0,
    passed: hasPassed(correct, total, attempt.passPercent), startedAt: attempt.startedAt, finishedAt: new Date().toISOString(), topicResults,
    weakTopics: Object.entries(topicResults).filter(([, value]) => value.correct < value.total).map(([topic,value]) => ({ topic, ...value })) };
}

function HistoryList({ items, source, onOpen, personal = false }: { items: QuizHistoryItem[]; source: QuizHistorySource; onOpen: (item: QuizHistoryItem) => void; personal?: boolean }) {
  return <section className="stack bf-attestation-history" aria-label={personal ? "История завершённых билетов" : "Последние попытки"}><div>{!personal && <h2>Последние попытки</h2>}<p className="small muted">{source === "device" ? "На этом устройстве" : personal ? "История завершённых билетов" : "Команда"}</p></div>
    {items.length ? <div className="bf-bank-list">{items.map((item,index) => <button type="button" className="item-row bf-attestation-history-row" key={item.id || `${item.time}-${index}`} onClick={() => onOpen(item)}>
      <span><strong>{item.displayName ? `${item.displayName} · ` : ""}{item.category}</strong><span className="small muted">{formatHistoryTime(item.time)}</span></span>
      <span className="bf-attempt-score"><strong className={item.passed ? "bf-answer-correct" : "bf-answer-wrong"}>{item.score}%</strong><span className="small muted">{item.correct}/{item.total}</span></span>
    </button>)}</div> : <WarmEmpty title="Попыток пока нет" body="Завершённые билеты появятся здесь." />}
  </section>;
}

function QuizQuestionView({ attempt, onSelect, onNext, onExit }: { attempt: QuizAttempt; onSelect: (index: number) => void; onNext: () => void; onExit: () => void }) {
  const question = attempt.questions[attempt.index];
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { window.scrollTo(0,0); headingRef.current?.focus(); }, [attempt.index]);
  return <section className="stack bf-exam-run bf-attestation-domain">
    <p className="small muted">{attempt.categoryLabel}</p>
    <section className="bf-panel bf-exam-question" aria-labelledby="bf-exam-question"><h1 id="bf-exam-question" className="bf-exam-question-title" ref={headingRef} tabIndex={-1}>{question.q}</h1><p className="small muted bf-exam-progress">Вопрос {attempt.index + 1} из {attempt.questions.length} · {question.topic}</p></section>
    <fieldset className="bf-exam-options" aria-describedby="bf-exam-answer-help"><legend className="small muted">Выбери один ответ</legend>{question.answers.map((answer,index) => <label className="bf-exam-option" key={`${question.id}-${index}`}><input type="radio" name={`exam-answer-${question.id}`} checked={attempt.selected === index} onChange={() => onSelect(index)} /><span className="bf-exam-option-text">{answer.text}</span></label>)}</fieldset>
    <p className="small muted" id="bf-exam-answer-help">Правильные ответы появятся после завершения всей попытки.</p>
    <div className="bf-exam-actions"><Button onClick={onExit}>Выйти</Button><Button variant="primary" disabled={attempt.selected == null} onClick={onNext}>{attempt.index === attempt.questions.length - 1 ? "Завершить аттестацию" : "Следующий вопрос"}</Button></div>
  </section>;
}

export function ResultView({ result, saveStatus, onRestart, onRetrySave }: { result: QuizResult; saveStatus: string; onRestart: () => void; onRetrySave?: () => void }) {
  const mistakes = result.questions.flatMap((question,index) => question.answers[result.answers[index]]?.correct ? [] : [{ question, chosenIndex: result.answers[index] }]);
  const elapsed = Math.max(0, Math.floor((Date.parse(result.finishedAt) - Date.parse(result.startedAt)) / 1000));
  const duration = Number.isFinite(elapsed) ? [Math.floor(elapsed / 3600), Math.floor(elapsed % 3600 / 60), elapsed % 60].map(n => String(n).padStart(2,"0")).join(":") : "—";
  const date = new Date(result.finishedAt);
  const completedDate = Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  const feedback = result.score === 100 ? ["Отличный результат!", "Ты отлично знаешь материал."] : result.passed ? ["Хороший результат!", "Аттестация пройдена. Продолжай учиться."] : ["Повтори материал", "Разбери ошибки и попробуй ещё раз."];
  return <section className="stack bf-result-page bf-attestation-domain">
    <section className="bf-panel bf-result-summary" aria-label="Итог попытки">
      <p className="bf-result-ticket">{result.categoryLabel}</p>
      <div className="bf-result-stage">{result.passed && result.total > 0 ? <PassedScoreConfetti /> : null}<span className={`bf-result-symbol ${result.passed ? "success" : "failure"}`}><WarmIcon name={result.passed ? "check" : "alert"} size={28} /></span><p className={`bf-result-score ${result.passed ? "success" : "failure"}`}>{result.score}%</p></div>
      <h1>{result.passed ? "Аттестация пройдена" : "Нужно повторить материал"}</h1><p className="small muted">{result.correct} из {result.total} · проходной порог {result.passPercent}%</p>
      <p className="small muted bf-result-save" role="status" aria-live="polite">{saveStatus}</p>
      {onRetrySave && saveStatus.startsWith("Не удалось сохранить") ? <Button onClick={onRetrySave}>Повторить сохранение</Button> : null}
      <dl className="bf-result-meta" aria-label="Сведения о попытке"><div><dt>Время</dt><dd>{duration}</dd></div><div><dt>Дата</dt><dd>{completedDate}</dd></div></dl>
      <div className={`bf-result-feedback ${result.passed ? "success" : "failure"}`}><WarmIcon name={result.passed ? "check" : "alert"} /><div><strong>{feedback[0]}</strong><p className="small">{feedback[1]}</p></div></div>
      <div className="bf-result-actions"><Button variant="primary" onClick={onRestart}>Новая попытка</Button><Button asChild><Link to="/knowledge">К знаниям</Link></Button></div>
    </section>
    {mistakes.length ? <section className="bf-result-errors"><p className="small muted">Разбор ошибок</p><h2>Что стоит повторить</h2><ol>{mistakes.map(({question,chosenIndex},index) => {
      const correct = question.answers.find(answer => answer.correct);
      const route = normalizeReviewRoute(question);
      return <li key={`${question.id}-${index}`}><article className="bf-result-mistake"><span className="bf-mistake-number" aria-hidden>{index + 1}</span><div className="bf-mistake-content"><p className="small muted">{question.topic}</p><h3>{question.q}</h3><p className="small">Ваш ответ: <span className="bf-answer-wrong">{question.answers[chosenIndex]?.text || "Нет ответа"}</span></p><p className="small">Верно: <span className="bf-answer-correct">{correct?.text || "Ответ не найден"}</span></p>{route ? <Link className="bf-button light bf-review-link" to={route} aria-label={`Повторить: ${question.reviewLabel || question.topic}`}><span className="bf-review-pill">Повторить</span></Link> : <p className="small muted">Материал для повторения сейчас недоступен.</p>}</div></article></li>;
    })}</ol></section> : <section className="bf-result-perfect"><WarmIcon name="check" /><div><h2>Без ошибок</h2><p className="small muted">Все ответы в этой попытке верные.</p></div></section>}
  </section>;
}

function SummaryView({ item }: { item: QuizHistoryItem | null }) {
  return <section className="stack bf-attestation-domain"><WarmTitle title="Результат попытки" />{item ? <section className="bf-panel bf-result-summary"><p className="bf-result-ticket">{item.category}</p><p className={`bf-result-score ${item.passed ? "success" : "failure"}`}>{item.score}%</p><h2>{item.passed ? "Аттестация пройдена" : "Нужно повторить материал"}</h2><p className="small muted">{item.correct} из {item.total} · {formatHistoryTime(item.time)}</p></section> : null}<WarmNotice>Подробный разбор недоступен: для этой попытки нет сохранённого снимка вопросов или доступа к нему.</WarmNotice></section>;
}

export function AttestationPage() {
  const { state: auth } = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : "";
  const { state, reload } = useAttestationBank();
  const [params, setParams] = useSearchParams();
  const attemptId = params.get("attempt");
  const personalHistory = params.get("view") === "history";
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [startError, setStartError] = useState("");
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);
  const [ownHistory, setOwnHistory] = useState<QuizHistoryItem[]>([]);
  const [historySource, setHistorySource] = useState<QuizHistorySource>("device");
  const [ownHistorySource, setOwnHistorySource] = useState<QuizHistorySource>("device");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyDetail, setHistoryDetail] = useState<{ summary: QuizHistoryItem | null; result: QuizResult | null } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const currentUserId = useRef(userId);
  const attemptUserId = useRef(userId);
  currentUserId.current = userId;
  useWarmExam(Boolean(attempt));
  useEffect(() => { setAttempt(null); setResult(null); setHistoryDetail(null); setSaveStatus(""); setHistory([]); setOwnHistory([]); setStartError(""); setExitOpen(false); }, [userId]);
  useEffect(() => {
    if (!attempt) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [attempt]);
  async function refreshHistory() {
    setHistoryLoading(true);
    try {
      const [loaded, personal] = await Promise.all([getQuizHistory(userId,5), getPersonalQuizHistory(userId)]);
      if (currentUserId.current !== userId) return;
      setHistory(loaded.items); setHistorySource(loaded.source); setOwnHistory(personal.items); setOwnHistorySource(personal.source);
    } finally { if (currentUserId.current === userId) setHistoryLoading(false); }
  }
  useEffect(() => { void refreshHistory(); }, [userId]);
  useEffect(() => {
    if (!attemptId) { setHistoryDetail(null); setDetailLoading(false); return; }
    let active = true;
    setDetailLoading(true); setHistoryDetail(null);
    void getQuizAttemptDetail(attemptId,userId).then(detail => {
      if (active && currentUserId.current === userId) setHistoryDetail(detail || { summary: null, result: null });
    }).catch(() => {
      if (active && currentUserId.current === userId) setHistoryDetail({ summary: null, result: null });
    }).finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [attemptId,userId]);
  const selectedCategory = useMemo(() => state.status === "ready" ? state.bank.categories.find(category => category.id === selectedCategoryId) || null : null, [state,selectedCategoryId]);
  function startQuiz() {
    if (state.status !== "ready" || !selectedCategory) return;
    let questions: QuizQuestion[];
    try { questions = buildQuizTicket(selectedCategory); setStartError(""); } catch { setStartError("В билете недостаточно подходящих вопросов. Сообщите администратору."); return; }
    if (questions.length !== selectedCategory.questionsPerTest) { setStartError("Не удалось сформировать полный билет."); return; }
    setSaveStatus(""); setResult(null); setHistoryDetail(null); attemptUserId.current = userId;
    setAttempt({ categoryId: selectedCategory.id, categoryLabel: selectedCategory.label, passPercent: state.bank.passPercent, questions, index: 0, answers: [], selected: null, startedAt: new Date().toISOString() });
  }
  function submitAnswer() {
    if (!attempt || attempt.selected == null) return;
    const answers = [...attempt.answers,attempt.selected];
    if (attempt.index < attempt.questions.length - 1) { setAttempt({ ...attempt, index: attempt.index + 1, answers, selected: null }); return; }
    const completed = buildResult(attempt,answers);
    setAttempt(null); setResult(completed); window.scrollTo(0,0); void saveCompletedResult(completed,attemptUserId.current);
  }
  async function saveCompletedResult(completed: QuizResult, ownerId: string) {
    if (currentUserId.current !== ownerId) return;
    setSaveStatus("Сохраняем результат…");
    const durable = await persistQuizResultLocally(ownerId,completed).catch(() => false);
    try {
      await persistQuizResultRemote(ownerId,completed);
      if (currentUserId.current !== ownerId) return;
      setSaveStatus("Результат сохранён."); await refreshHistory();
    } catch (error) {
      if (currentUserId.current !== ownerId) return;
      const savedRemotely = Boolean(error && typeof error === "object" && "savedRemotely" in error && error.savedRemotely);
      setSaveStatus(savedRemotely ? "Результат сохранён на сервере. Очередь будет обновлена при синхронизации." : durable ? "Результат сохранён на этом устройстве. Ожидает синхронизации." : "Не удалось сохранить результат. Повторите сохранение, пока эта страница открыта.");
    }
  }
  function openHistory(item: QuizHistoryItem) {
    if (item.snapshot && item.userId === userId) {
      const snapshot = item.snapshot;
      const valid = decodeQuizAttemptSnapshot({ category: snapshot.categoryLabel, category_id: snapshot.categoryId,
        total_questions: snapshot.total, correct_answers: snapshot.correct, score: snapshot.score, passed: snapshot.passed,
        started_at: snapshot.startedAt, finished_at: snapshot.finishedAt, category_results: { pass_percent: snapshot.passPercent,
          attempt_snapshot: { schemaVersion: 1, questions: snapshot.questions, answers: snapshot.answers } } });
      setHistoryDetail({ summary: item, result: valid }); return;
    }
    if (item.id) setParams({ ...(personalHistory ? { view: "history" } : {}), attempt: item.id });
    else setHistoryDetail({ summary: item, result: null });
  }
  function restart() { setResult(null); setHistoryDetail(null); setSaveStatus(""); setParams({}); window.scrollTo(0,0); }
  if (attempt) return <><QuizQuestionView attempt={attempt} onSelect={index => setAttempt(current => current ? { ...current, selected: index } : current)} onNext={submitAnswer} onExit={() => setExitOpen(true)} />{exitOpen ? <WarmDialog title="Вы хотите выйти из аттестационного билета?" confirm onClose={() => setExitOpen(false)}><p>Незавершённая попытка будет прервана. Ответы этой попытки не сохранятся.</p><div className="bf-dialog-actions"><Button onClick={() => setExitOpen(false)}>Продолжить</Button><Button variant="primary" onClick={() => { setAttempt(null); setExitOpen(false); window.scrollTo(0,0); }}>Выйти</Button></div></WarmDialog> : null}</>;
  if (result && !personalHistory && !attemptId) return <><WarmBack to="/knowledge" label="К знаниям" /><ResultView result={result} saveStatus={saveStatus} onRetrySave={() => void saveCompletedResult(result,attemptUserId.current)} onRestart={restart} /></>;
  if (detailLoading) return <><WarmBack to={personalHistory ? "/attestation?view=history" : "/attestation"} label="К истории" /><p role="status">Загружаем результат…</p></>;
  if (historyDetail) {
    const summary = historyDetail.summary || history.find(item => item.id === attemptId) || ownHistory.find(item => item.id === attemptId) || null;
    return <><WarmBack label="К истории" onClick={() => { setHistoryDetail(null); setParams(personalHistory ? { view: "history" } : {}); }} />{historyDetail.result ? <ResultView result={historyDetail.result} saveStatus="Сохранённая попытка" onRestart={restart} /> : <SummaryView item={summary} />}</>;
  }
  if (personalHistory) return <section className="stack bf-attestation-domain"><WarmBack to="/profile" label="В профиль" /><WarmTitle title="Мои результаты" />{historyLoading ? <p role="status">Загружаем историю…</p> : <HistoryList items={ownHistory} source={ownHistorySource} personal onOpen={openHistory} />}</section>;
  return <section className="stack bf-attestation-page bf-attestation-domain"><WarmBack to="/knowledge" label="К знаниям" /><WarmTitle title="Аттестация" />
    {state.status === "loading" ? <p role="status">Загружаем билеты…</p> : null}
    {state.status === "error" ? <WarmNotice error>{state.error.message === "question_bank_cache_incompatible" ? "Офлайн-банк устарел. Подключитесь к интернету и обновите вопросы." : "Не удалось загрузить вопросы. Проверьте соединение и повторите."}<Button onClick={() => void reload()}>Повторить</Button></WarmNotice> : null}
    {state.status === "ready" ? <><section className="bf-panel form-stack bf-compact-form"><h2>Проверь знания</h2><p className="small muted">Выбери билет. Количество вопросов зависит от темы · зачёт от {state.bank.passPercent}%.</p><label className="bf-field"><span className="bf-field-label">Билет</span><select aria-label="Выбери тему" value={selectedCategoryId ?? ""} onChange={event => { setSelectedCategoryId(event.target.value || null); setStartError(""); }}><option value="" disabled>Выбери билет</option>{state.bank.categories.map(category => <option key={category.id} value={category.id}>{category.label} · {category.questionsPerTest} вопросов · {category.venue === "bf" ? "BeerFactory" : category.venue === "bb" ? "BeerBistro" : "Оба заведения"}</option>)}</select></label><Button variant="primary" disabled={!selectedCategory} onClick={startQuiz}>Начать аттестацию</Button>{startError ? <WarmNotice error>{startError}</WarmNotice> : null}</section>{state.bank.legacyCompatibility ? <WarmNotice>Доступны прежние билеты BeerFactory. Новые билеты появятся после обновления серверной базы.</WarmNotice> : null}{historyLoading ? <p role="status">Загружаем историю…</p> : <HistoryList items={history} source={historySource} onOpen={openHistory} />}</> : null}
  </section>;
}
