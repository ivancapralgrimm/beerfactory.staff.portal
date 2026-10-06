import {
  Archive,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState
} from "react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import {
  loadAttestationEditorBank,
  saveAttestationQuestion,
  setAttestationQuestionStatus,
  type AttestationEditorBank,
  type AttestationEditorQuestion
} from "@/features/attestation/attestation-editor-api";
import { cn } from "@/lib/utils";

const EMPTY_ANSWERS = () => [
  { text: "", correct: true },
  { text: "", correct: false },
  { text: "", correct: false },
  { text: "", correct: false }
];

function errorText(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "attestation_revision_conflict") {
    return "Вопрос уже изменён в другой сессии. Обновите банк и повторите правку.";
  }
  if (code === "attestation_ticket_capacity") {
    return "Нельзя убрать этот вопрос: после изменения по теме не соберётся полный билет.";
  }
  if (code === "attestation_answers_invalid") {
    return "Нужно четыре разных ответа и ровно один правильный.";
  }
  if (code === "attestation_category_invalid") {
    return "Выбранная категория больше недоступна. Обновите банк.";
  }
  if (code === "attestation_topic_invalid") {
    return "Укажите корректную тему вопроса.";
  }
  if (code === "attestation_subcategory_invalid") {
    return "Подкатегория слишком длинная или заполнена некорректно.";
  }
  if (code === "forbidden") return "Недостаточно прав для изменения банка.";
  return "Изменение не сохранено. Проверьте сеть и повторите.";
}

function newGroupKey() {
  const uuid = globalThis.crypto?.randomUUID?.();

  if (uuid) return `manual:${uuid}`;

  return `manual:${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

type Draft = {
  id?: string;
  revision?: number;
  categoryId: string;
  q: string;
  topic: string;
  subcategory: string;
  group: string;
  answers: Array<{ text: string; correct: boolean }>;
  source: string;
  sourceRef: string;
  reviewUrl: string;
  reviewLabel: string;
  reviewNote: string;
};

function draftFromQuestion(question: AttestationEditorQuestion): Draft {
  return {
    id: question.id,
    revision: question.revision,
    categoryId: question.categoryId,
    q: question.q,
    topic: question.topic,
    subcategory: question.subcategory || "",
    group: question.group,
    answers: question.answers.map((answer) => ({ ...answer })),
    source: question.source || "",
    sourceRef: question.sourceRef || "",
    reviewUrl: question.reviewUrl || "",
    reviewLabel: question.reviewLabel || "",
    reviewNote: question.reviewNote || ""
  };
}

function Editor({
  bank,
  draft: initial,
  onClose,
  onSaved
}: {
  bank: AttestationEditorBank;
  draft: Draft;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const initialSignature = useMemo(
    () => JSON.stringify(initial),
    [initial]
  );
  const dirty = useMemo(
    () => JSON.stringify(draft) !== initialSignature,
    [draft, initialSignature]
  );

  function closeEditor() {
    if (saving) return;

    if (
      dirty &&
      !window.confirm("Закрыть редактор без сохранения изменений?")
    ) {
      return;
    }

    onClose();
  }

  const topics = useMemo(() => {
    const values = bank.questions
      .filter((question) => question.categoryId === draft.categoryId)
      .map((question) => question.topic)
      .filter(Boolean);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, "ru"));
  }, [bank.questions, draft.categoryId]);

  const subcategories = useMemo(() => {
    const values = bank.questions
      .filter((question) => question.categoryId === draft.categoryId)
      .map((question) => question.subcategory || "")
      .filter(Boolean);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, "ru"));
  }, [bank.questions, draft.categoryId]);

  async function save() {
    const answerTexts = draft.answers.map((answer) => answer.text.trim());
    if (
      !draft.q.trim() ||
      !draft.categoryId ||
      !draft.topic.trim() ||
      answerTexts.some((text) => !text) ||
      new Set(answerTexts.map((text) => text.toLowerCase())).size !== 4 ||
      draft.answers.filter((answer) => answer.correct).length !== 1
    ) {
      setMessage("Заполните вопрос, тему и четыре разных ответа. Правильный ответ должен быть один.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await saveAttestationQuestion(
        {
          id: draft.id,
          categoryId: draft.categoryId,
          q: draft.q.trim(),
          topic: draft.topic.trim(),
          subcategory: draft.subcategory.trim() || null,
          group: draft.group || newGroupKey(),
          answers: draft.answers.map((answer) => ({
            text: answer.text.trim(),
            correct: answer.correct
          })),
          source: draft.source.trim() || null,
          sourceRef: draft.sourceRef.trim() || null,
          reviewUrl: draft.reviewUrl.trim() || null,
          reviewLabel: draft.reviewLabel.trim() || null,
          reviewNote: draft.reviewNote.trim() || null
        },
        draft.revision ?? null
      );
      await onSaved();
      onClose();
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Surface className="mt-4 overflow-hidden p-0">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--bf-line)] p-4">
        <div>
          <p className="eyebrow">БАНК ВОПРОСОВ</p>
          <h3 className="mt-1 text-xl font-black">
            {draft.id ? "Редактирование вопроса" : "Новый вопрос"}
          </h3>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={closeEditor} aria-label="Закрыть редактор">
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="grid gap-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs font-bold text-[var(--bf-muted)]">
            Категория
            <select
              value={draft.categoryId}
              onChange={(event) => setDraft((current) => ({
                ...current,
                categoryId: event.target.value,
                topic: "",
                subcategory: ""
              }))}
              className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-sm text-[var(--bf-cream)]"
            >
              {bank.categories.map((category) => (
                <option key={category.id} value={category.id}>{category.label}{category.active ? "" : " · черновик"}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-bold text-[var(--bf-muted)]">
            Тема
            <input
              value={draft.topic}
              list="attestation-topics"
              onChange={(event) => setDraft((current) => ({ ...current, topic: event.target.value }))}
              className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-sm text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
              placeholder="Например, Коктейли"
            />
            <datalist id="attestation-topics">
              {topics.map((topic) => <option key={topic} value={topic} />)}
            </datalist>
          </label>
        </div>

        <label className="grid gap-1 text-xs font-bold text-[var(--bf-muted)]">
          Подкатегория
          <input
            value={draft.subcategory}
            list="attestation-subcategories"
            onChange={(event) => setDraft((current) => ({ ...current, subcategory: event.target.value }))}
            className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-sm text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
            placeholder="Можно оставить пустой и распределить позже"
          />
          <datalist id="attestation-subcategories">
            {subcategories.map((item) => <option key={item} value={item} />)}
          </datalist>
        </label>

        <label className="grid gap-1 text-xs font-bold text-[var(--bf-muted)]">
          Вопрос
          <textarea
            value={draft.q}
            onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
            rows={4}
            maxLength={1000}
            className="w-full resize-y rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] p-3 text-[16px] font-semibold leading-6 text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
          />
        </label>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-xs font-black uppercase tracking-[0.08em] text-[var(--bf-dim)]">
            Ответы · отметьте один правильный
          </legend>
          {draft.answers.map((answer, index) => (
            <label
              key={index}
              className={cn(
                "grid min-h-12 grid-cols-[36px_1fr] items-center gap-2 rounded-xl border p-2",
                answer.correct
                  ? "border-[var(--bf-copper-hi)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_84%)]"
                  : "border-[var(--bf-line)] bg-[var(--bf-surface-2)]"
              )}
            >
              <input
                type="radio"
                name="correct-answer"
                checked={answer.correct}
                onChange={() => setDraft((current) => ({
                  ...current,
                  answers: current.answers.map((item, answerIndex) => ({
                    ...item,
                    correct: answerIndex === index
                  }))
                }))}
                className="size-5 justify-self-center accent-[var(--bf-copper-hi)]"
                aria-label={`Ответ ${index + 1} правильный`}
              />
              <input
                value={answer.text}
                maxLength={500}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  answers: current.answers.map((item, answerIndex) =>
                    answerIndex === index ? { ...item, text: event.target.value } : item
                  )
                }))}
                className="min-h-11 min-w-0 bg-transparent px-1 text-[16px] text-[var(--bf-cream)] outline-none"
                placeholder={`Ответ ${index + 1}`}
              />
            </label>
          ))}
        </fieldset>

        <details className="rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] p-3">
          <summary className="cursor-pointer text-sm font-black">Дополнительно</summary>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-xs font-bold text-[var(--bf-muted)]">
              Группа вопроса
              <input value={draft.group} onChange={(event) => setDraft((current) => ({ ...current, group: event.target.value }))} className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] px-3 text-sm text-[var(--bf-cream)]" />
            </label>
            <label className="grid gap-1 text-xs font-bold text-[var(--bf-muted)]">
              Источник
              <input value={draft.source} onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))} className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] px-3 text-sm text-[var(--bf-cream)]" />
            </label>
            <label className="grid gap-1 text-xs font-bold text-[var(--bf-muted)]">
              Ссылка / ID источника
              <input value={draft.sourceRef} onChange={(event) => setDraft((current) => ({ ...current, sourceRef: event.target.value }))} className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] px-3 text-sm text-[var(--bf-cream)]" />
            </label>
            <label className="grid gap-1 text-xs font-bold text-[var(--bf-muted)]">
              Материал для повторения
              <input value={draft.reviewNote} onChange={(event) => setDraft((current) => ({ ...current, reviewNote: event.target.value }))} className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] px-3 text-sm text-[var(--bf-cream)]" placeholder="Название рецепта или темы" />
            </label>
            <label className="grid gap-1 text-xs font-bold text-[var(--bf-muted)]">
              Ссылка для повторения
              <input value={draft.reviewUrl} onChange={(event) => setDraft((current) => ({ ...current, reviewUrl: event.target.value }))} className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] px-3 text-sm text-[var(--bf-cream)]" placeholder="#/menu или #/knowledge/..." />
            </label>
            <label className="grid gap-1 text-xs font-bold text-[var(--bf-muted)]">
              Текст кнопки повторения
              <input value={draft.reviewLabel} onChange={(event) => setDraft((current) => ({ ...current, reviewLabel: event.target.value }))} className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] px-3 text-sm text-[var(--bf-cream)]" placeholder="Повторить тему" />
            </label>
          </div>
        </details>

        <p className={cn("min-h-5 text-xs", message ? "text-[#e99990]" : "text-[var(--bf-dim)]")} role="status" aria-live="polite">
          {message}
        </p>

        <Button type="button" variant="primary" size="lg" onClick={() => void save()} disabled={saving}>
          {saving ? <RefreshCw className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          {saving ? "Сохраняем…" : "Сохранить вопрос"}
        </Button>
      </div>
    </Surface>
  );
}

export function AttestationBankAdminPanel() {
  const [bank, setBank] = useState<AttestationEditorBank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "archive">("active");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pendingId, setPendingId] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setBank(await loadAttestationEditorBank(false));
    } catch {
      setError("Не удалось загрузить онлайн-банк вопросов.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    if (!bank) return [];
    const needle = search.trim().toLowerCase();
    return bank.questions.filter((question) => {
      if (category !== "all" && question.categoryId !== category) return false;
      if (status !== "all" && question.status !== status) return false;
      if (!needle) return true;
      return [
        question.q,
        question.topic,
        question.subcategory || "",
        question.answers.map((answer) => answer.text).join(" ")
      ].join(" ").toLowerCase().includes(needle);
    });
  }, [bank, category, search, status]);

  const categoryMap = useMemo(
    () => new Map((bank?.categories || []).map((item) => [item.id, item.label])),
    [bank]
  );

  async function setQuestionStatus(
    question: AttestationEditorQuestion,
    nextStatus: "active" | "archive" | "deleted"
  ) {
    if (
      nextStatus === "deleted" &&
      !window.confirm(
        "Удалить вопрос из рабочего банка? Историческая версия сохранится."
      )
    ) {
      return;
    }

    setPendingId(question.id);
    setActionMessage("");
    try {
      await setAttestationQuestionStatus(
        question.id,
        nextStatus,
        question.revision
      );
      setActionMessage(
        nextStatus === "archive"
          ? "Вопрос перемещён в архив."
          : nextStatus === "active"
            ? "Вопрос возвращён в активный банк."
            : "Вопрос удалён из рабочего банка."
      );
      await load();
    } catch (actionError) {
      setActionMessage(errorText(actionError));
    } finally {
      setPendingId("");
    }
  }

  if (loading && !bank) {
    return <div className="mt-4 h-48 animate-pulse rounded-[22px] bg-[var(--bf-surface)]" />;
  }

  if (error && !bank) {
    return (
      <Surface className="mt-4 p-4 text-sm text-[#e99990]">
        {error}
        <Button className="mt-3" onClick={() => void load()}><RefreshCw className="size-4" />Повторить</Button>
      </Surface>
    );
  }

  if (!bank) return null;

  if (editing) {
    return <Editor bank={bank} draft={editing} onClose={() => setEditing(null)} onSaved={load} />;
  }

  const active = bank.questions.filter((question) => question.status === "active").length;
  const archived = bank.questions.filter((question) => question.status === "archive").length;
  const actionSucceeded =
    !actionMessage ||
    /^Вопрос (перемещён|возвращён|удалён)/.test(actionMessage);

  return (
    <section className="mt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">ОНЛАЙН-БАНК</p>
          <h3 className="mt-1 text-2xl font-black">Вопросы аттестации</h3>
          <p className="mt-1 text-xs text-[var(--bf-dim)]">
            {bank.settings.questionsPerTest} вопросов в билете · зачёт {bank.settings.passPercent}%
          </p>
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="secondary" size="icon" onClick={() => void load()} aria-label="Обновить банк">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="primary"
            size="icon"
            aria-label="Добавить вопрос"
            onClick={() => {
              const firstCategory = bank.categories.find((item) => item.active) || bank.categories[0];
              const firstTopic = firstCategory?.ticketPlan?.[0]?.topic || "Общее";
              setEditing({
                categoryId: firstCategory?.id || "bar",
                q: "",
                topic: firstTopic,
                subcategory: "",
                group: newGroupKey(),
                answers: EMPTY_ANSWERS(),
                source: "",
                sourceRef: "",
                reviewUrl: "",
                reviewLabel: "",
                reviewNote: ""
              });
            }}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Surface className="p-3 text-center"><span className="text-[9px] font-black uppercase tracking-[.08em] text-[var(--bf-dim)]">Активных</span><strong className="mt-1 block text-xl">{active}</strong></Surface>
        <Surface className="p-3 text-center"><span className="text-[9px] font-black uppercase tracking-[.08em] text-[var(--bf-dim)]">Архив</span><strong className="mt-1 block text-xl">{archived}</strong></Surface>
        <Surface className="p-3 text-center"><span className="text-[9px] font-black uppercase tracking-[.08em] text-[var(--bf-dim)]">Показано</span><strong className="mt-1 block text-xl">{filtered.length}</strong></Surface>
      </div>

      <label className="relative mt-3 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--bf-dim)]" aria-hidden />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по вопросу, теме или ответам" className="min-h-12 w-full rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface)] pl-10 pr-3 text-[16px] text-[var(--bf-cream)] outline-none placeholder:text-[var(--bf-dim)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]" />
      </label>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 bf-scrollbar-none">
        <button type="button" onClick={() => setCategory("all")} className={cn("min-h-11 shrink-0 rounded-xl border px-3 text-xs font-black", category === "all" ? "border-[var(--bf-copper-hi)] bg-[var(--bf-copper)] text-[#fff8ed]" : "border-[var(--bf-line)] bg-[var(--bf-surface)] text-[var(--bf-muted)]")}>Все</button>
        {bank.categories.map((item) => (
          <button key={item.id} type="button" onClick={() => setCategory(item.id)} className={cn("min-h-11 shrink-0 rounded-xl border px-3 text-xs font-black", category === item.id ? "border-[var(--bf-copper-hi)] bg-[var(--bf-copper)] text-[#fff8ed]" : "border-[var(--bf-line)] bg-[var(--bf-surface)] text-[var(--bf-muted)]")}>{item.label}</button>
        ))}
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 bf-scrollbar-none">
        {([[
          "active", "Активные"
        ], ["archive", "Архив"], ["all", "Все статусы"]] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setStatus(value)} className={cn("min-h-10 shrink-0 rounded-full border px-3 text-xs font-bold", status === value ? "border-[var(--bf-copper-hi)] text-[var(--bf-cream)]" : "border-[var(--bf-line)] text-[var(--bf-dim)]")}>{label}</button>
        ))}
      </div>

      <p className={cn("mt-2 min-h-5 text-xs", actionSucceeded ? "text-[#9dd0a0]" : "text-[#e99990]")} role="status" aria-live="polite">{actionMessage}</p>

      <div className="mt-1 grid gap-2">
        {filtered.map((question) => (
          <Surface key={question.id} className="p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-[.06em] text-[var(--bf-dim)]">
                  <span>{categoryMap.get(question.categoryId) || question.categoryId}</span>
                  <span>·</span>
                  <span>{question.topic}</span>
                  {question.subcategory ? <><span>·</span><span>{question.subcategory}</span></> : null}
                  {question.status === "archive" ? <span className="rounded-full border border-[var(--bf-line)] px-2 py-0.5">Архив</span> : null}
                </div>
                <h4 className="mt-1 text-[15px] font-extrabold leading-5 text-[var(--bf-cream)]">{question.q}</h4>
                <p className="mt-2 text-[11px] text-[var(--bf-dim)]">rev. {question.revision} · {question.id}</p>
              </div>
              <Button type="button" variant="secondary" size="icon" onClick={() => setEditing(draftFromQuestion(question))} aria-label="Редактировать вопрос">
                <Pencil className="size-4" aria-hidden />
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {question.status === "active" ? (
                <Button type="button" variant="secondary" disabled={pendingId === question.id} onClick={() => void setQuestionStatus(question, "archive")}>
                  <Archive className="size-4" aria-hidden />В архив
                </Button>
              ) : (
                <Button type="button" variant="secondary" disabled={pendingId === question.id} onClick={() => void setQuestionStatus(question, "active")}>
                  <RotateCcw className="size-4" aria-hidden />Вернуть
                </Button>
              )}
              <Button type="button" variant="ghost" disabled={pendingId === question.id} onClick={() => void setQuestionStatus(question, "deleted")}>
                <Trash2 className="size-4" aria-hidden />Удалить
              </Button>
            </div>
          </Surface>
        ))}

        {!filtered.length ? (
          <Surface className="p-5 text-center text-sm text-[var(--bf-muted)]">
            Вопросов по этим фильтрам нет.
          </Surface>
        ) : null}
      </div>
    </section>
  );
}
