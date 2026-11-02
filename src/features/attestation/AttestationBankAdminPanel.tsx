import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { WarmBack } from "@/components/warm/WarmBack";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmTitle, WarmNotice, WarmEmpty } from "@/components/warm/WarmPage";
import { WarmDialog } from "@/components/warm/WarmDialog";
import {
  loadAttestationEditorBank, saveAttestationQuestion, setAttestationQuestionStatus,
  type AttestationEditorBank, type AttestationEditorQuestion
} from "./attestation-editor-api";
import { loadServerKnowledgeArticles } from "@/features/knowledge/knowledge-server";
import { isArchive, loadRecipes } from "@/features/recipes/recipe-data";
import { normalizeReviewRoute } from "./attestation-data";
import type { AttestationVenue, KnowledgeType } from "./types";
import "./attestation.css";

const TYPES: Record<KnowledgeType, string> = { bar: "Бар", kitchen: "Кухня", wine: "Вино", service: "Сервис" };
const VENUES: Record<AttestationVenue, string> = { bf: "BeerFactory", bb: "BeerBistro", common: "Оба заведения" };
const emptyAnswers = () => Array.from({ length: 4 }, (_, index) => ({ text: "", correct: index === 0 }));
function newGroupKey() { return `manual:${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`; }
function errorText(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    attestation_revision_conflict: "Вопрос уже изменён в другой сессии. Обновите банк и повторите правку.",
    attestation_ticket_capacity: "После изменения не соберётся полный билет. Добавьте вопросы или измените распределение билета.",
    attestation_ticket_quota_capacity: "Изменение нарушит квоту активного билета. Добавьте подходящие вопросы или измените квоту.",
    attestation_ticket_group_cross_topic: "Одна группа вопросов оказалась в разных разделах. Перенесите вопрос в отдельную группу.",
    attestation_answers_invalid: "Нужно четыре разных ответа и ровно один правильный.",
    attestation_category_invalid: "Выбранный тип больше недоступен. Обновите банк.",
    attestation_topic_invalid: "Укажите корректный раздел вопроса.",
    attestation_material_required: "Выберите доступный материал для повторения.",
    forbidden: "Недостаточно прав для изменения банка."
  };
  return messages[code] || "Изменение не сохранено. Проверьте сеть и повторите.";
}

type Draft = {
  id?: string; revision?: number; categoryId: string; knowledgeType: KnowledgeType | null;
  venue: AttestationVenue; q: string; topic: string; subcategory: string; group: string;
  answers: Array<{ text: string; correct: boolean }>; source: string; sourceRef: string;
  reviewUrl: string; reviewLabel: string; reviewNote: string;
};
type ReviewMaterial = { kind: "recipe" | "knowledge"; value: string; label: string; buttonLabel: string; sourceRef: string; type?: KnowledgeType; topic: string; venue: AttestationVenue };
function draftFromQuestion(question: AttestationEditorQuestion): Draft {
  const route = normalizeReviewRoute(question as Parameters<typeof normalizeReviewRoute>[0]);
  return { ...question, subcategory: question.subcategory || "", answers: question.answers.map(answer => ({ ...answer })),
    source: question.source || "", sourceRef: question.sourceRef || "", reviewUrl: route ? `#${route}` : "",
    reviewLabel: question.reviewLabel || "", reviewNote: question.reviewNote || "" };
}

function Editor({ bank, draft: initial, onClose, onSaved }: {
  bank: AttestationEditorBank; draft: Draft; onClose: () => void;
  onSaved: (question: AttestationEditorQuestion) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [reviewMaterials, setReviewMaterials] = useState<ReviewMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [materialsError, setMaterialsError] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const materialRef = useRef<HTMLSelectElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([loadRecipes(), loadServerKnowledgeArticles()]).then(([recipes, articles]) => {
      if (!active) return;
      const items: ReviewMaterial[] = [];
      if (recipes.status === "fulfilled") {
        const seen = new Set<string>();
        for (const recipe of recipes.value.recipes) {
          if (isArchive(recipe) || !recipe.id || seen.has(recipe.id)) continue;
          seen.add(recipe.id);
          items.push({ kind: "recipe", value: `#/menu/${encodeURIComponent(recipe.id)}`, label: `Рецепт · ${recipe.name}`, buttonLabel: "Открыть рецепт",
            sourceRef: recipe.id, type: recipe.source === "kitchen" ? "kitchen" : "bar", topic: recipe.category,
            venue: recipe.venue === "BF" ? "bf" : recipe.venue === "BB" ? "bb" : "common" });
        }
      }
      if (articles.status === "fulfilled") for (const article of articles.value) {
        items.push({ kind: "knowledge", value: `#/knowledge/${article.id}`, label: `Статья · ${article.title}`, buttonLabel: "Открыть статью",
          sourceRef: article.id, topic: article.category, venue: "common" });
      }
      setReviewMaterials(items.sort((a, b) => a.label.localeCompare(b.label, "ru")));
      // A partial list must not silently invalidate the currently selected source.
      setMaterialsError(recipes.status === "rejected" || articles.status === "rejected");
      setMaterialsLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const topics = useMemo(() => [...new Set([
    "Общее", ...bank.categories.filter(c => c.knowledgeType === draft.knowledgeType).flatMap(c => c.ticketPlan.map(p => p.topic)),
    ...bank.questions.filter(q => q.knowledgeType === draft.knowledgeType).map(q => q.topic),
    ...reviewMaterials.filter(m => !m.type || m.type === draft.knowledgeType).map(m => m.topic), draft.topic
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")), [bank, draft.knowledgeType, draft.topic, reviewMaterials]);
  // Main articles expose a shared category, without the prototype's invented type/section metadata.
  // Offer every published article; recipes can be matched to their actual type and venue.
  const materials = reviewMaterials.filter(m => !m.type || (m.type === draft.knowledgeType
    && (m.venue === "common" || (draft.venue !== "common" && m.venue === draft.venue))));
  function patch(next: Partial<Draft>) { setDraft(current => ({ ...current, ...next })); setMessage(""); }
  function close() { if (!saving) dirty ? setDiscardOpen(true) : onClose(); }

  async function save() {
    const answerTexts = draft.answers.map(answer => answer.text.trim());
    if (!draft.q.trim() || !draft.categoryId || !draft.knowledgeType || !draft.topic.trim()
      || answerTexts.some(text => !text) || new Set(answerTexts.map(text => text.toLocaleLowerCase("ru"))).size !== 4
      || draft.answers.filter(answer => answer.correct).length !== 1) {
      setMessage("Заполните вопрос, тип знаний, раздел, заведение и четыре разных ответа. Правильный ответ должен быть один."); return;
    }
    const material = materials.find(item => item.value === draft.reviewUrl);
    if (materialsLoading || !material) {
      setMessage(materialsError ? "Не удалось проверить материал. Обновите редактор и повторите." : "Выберите доступный материал для повторения.");
      materialRef.current?.focus(); return;
    }
    setSaving(true); setMessage("");
    try {
      const savedQuestion = await saveAttestationQuestion({ ...draft, knowledgeType: draft.knowledgeType,
        q: draft.q.trim(), topic: draft.topic.trim(), subcategory: draft.subcategory.trim() || null,
        group: draft.group || newGroupKey(), answers: draft.answers.map(answer => ({ text: answer.text.trim(), correct: answer.correct })),
        source: material.kind, sourceRef: material.sourceRef, reviewUrl: material.value,
        reviewLabel: material.buttonLabel, reviewNote: draft.reviewNote.trim() || null }, draft.revision ?? null);
      await onSaved(savedQuestion); onClose();
    } catch (error) { setMessage(errorText(error)); } finally { setSaving(false); }
  }

  return <section className="stack bf-exam-editor bf-attestation-domain">
    <WarmBack label="В банк вопросов" onClick={close} />
    <WarmTitle title={draft.id ? "Редактировать вопрос" : "Новый вопрос"} action={<Button variant="ghost" onClick={close} disabled={saving}>Отмена</Button>} />
    <form className="form-stack bf-compact-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={saving} className="bf-attestation-fields">
        <div className="bf-editor-pair">
          <label className="bf-field"><span className="bf-field-label">Тип знаний</span><select required aria-label="Тип знаний" value={draft.knowledgeType ?? ""} onChange={event => {
            const knowledgeType = event.target.value as KnowledgeType;
            const home = bank.categories.find(c => c.id === knowledgeType && c.knowledgeType === knowledgeType) || bank.categories.find(c => c.knowledgeType === knowledgeType);
            patch({ knowledgeType, categoryId: home?.id || draft.categoryId, group: newGroupKey(), topic: home?.ticketPlan[0]?.topic || "Общее", reviewUrl: "" });
          }}><option value="" disabled>Выбери тип знаний</option>{Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="bf-field"><span className="bf-field-label">Раздел</span><select required aria-label="Раздел" title={draft.topic} value={draft.topic} onChange={event => patch({ topic: event.target.value, group: newGroupKey(), reviewUrl: "" })}>{topics.map(topic => <option key={topic}>{topic}</option>)}</select></label>
        </div>
        <label className="bf-field"><span className="bf-field-label">Заведение</span><select required value={draft.venue} onChange={event => patch({ venue: event.target.value as AttestationVenue, reviewUrl: "" })}>{Object.entries(VENUES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="bf-field"><span className="bf-field-label">Текст вопроса</span><textarea aria-label="Текст вопроса" required rows={3} maxLength={1000} value={draft.q} onChange={event => patch({ q: event.target.value })} /></label>
        <fieldset className="bf-editor-answers"><legend>Варианты ответа</legend><p className="small muted">Отметь один правильный ответ.</p>{draft.answers.map((answer, index) => <div className="bf-editor-answer bf-attestation-answer-edit" key={index}>
          <label className="bf-editor-correct"><input type="radio" name="correct-answer" aria-label={`Правильный ответ ${index + 1}`} checked={answer.correct} onChange={() => patch({ answers: draft.answers.map((item, i) => ({ ...item, correct: i === index })) })} /></label>
          <input className="bf-editor-answer-text" aria-label={`Ответ ${index + 1}`} placeholder={`Ответ ${index + 1}`} maxLength={500} required value={answer.text} onChange={event => patch({ answers: draft.answers.map((item, i) => i === index ? { ...item, text: event.target.value } : item) })} />
        </div>)}</fieldset>
        <label className="bf-field bf-review-field"><span className="bf-field-label">Материал для повторения</span><select ref={materialRef} required aria-label="Материал для повторения" value={draft.reviewUrl} disabled={materialsLoading} onChange={event => patch({ reviewUrl: event.target.value })}>
          <option value="" disabled>{materialsLoading ? "Загружаем материалы…" : "Выбери материал"}</option>
          {draft.reviewUrl && !materials.some(m => m.value === draft.reviewUrl) ? <option value={draft.reviewUrl} disabled>Материал недоступен</option> : null}
          {materials.map(material => <option key={material.value} value={material.value}>{material.label}</option>)}
        </select><span className="small muted">{materialsError ? "Часть материалов не загрузилась. Сохранение доступно только с проверенным материалом." : "Выбери статью или рецепт. Ссылка появится при ошибке в результатах билета."}</span></label>
      </fieldset>
      {message ? <WarmNotice error>{message}</WarmNotice> : null}
      <Button type="submit" variant="primary" disabled={saving || materialsLoading}>{saving ? "Сохраняем…" : "Сохранить вопрос"}</Button>
    </form>
    {discardOpen ? <WarmDialog title="Закрыть редактор без сохранения?" confirm onClose={() => setDiscardOpen(false)}><p>Изменения вопроса не сохранятся.</p><div className="bf-dialog-actions"><Button onClick={() => setDiscardOpen(false)}>Продолжить редактирование</Button><Button variant="primary" onClick={onClose}>Закрыть</Button></div></WarmDialog> : null}
  </section>;
}

export function AttestationBankAdminPanel() {
  const [bank, setBank] = useState<AttestationEditorBank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [section, setSection] = useState("all");
  const [venue, setVenue] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "archive">("active");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pendingId, setPendingId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [confirmation, setConfirmation] = useState<{ question: AttestationEditorQuestion; status: "active" | "archive" | "deleted" } | null>(null);
  async function load() {
    setLoading(true); setError("");
    try { setBank(await loadAttestationEditorBank(false)); } catch (error) {
      setError(error instanceof Error && error.message === "attestation_server_upgrade_required"
        ? "Редактор банка ещё недоступен: требуется обновление серверной базы аттестации." : "Не удалось загрузить онлайн-банк вопросов.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const sections = useMemo(() => [...new Set(bank?.questions.filter(q => category === "all" || q.knowledgeType === category).map(q => q.topic))].sort((a,b) => a.localeCompare(b,"ru")), [bank, category]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("ru");
    return bank?.questions.filter(q => (category === "all" || q.knowledgeType === category) && (status === "all" || q.status === status)
      && (section === "all" || !sections.includes(section) || q.topic === section) && (venue === "all" || q.venue === venue)
      && (!needle || [q.q, q.topic, q.subcategory || "", ...q.answers.map(a => a.text)].join(" ").toLocaleLowerCase("ru").includes(needle))) || [];
  }, [bank, category, status, section, venue, search, sections]);
  async function changeStatus() {
    if (!confirmation) return;
    const { question, status: nextStatus } = confirmation;
    setPendingId(question.id); setActionMessage("");
    try {
      const savedQuestion = await setAttestationQuestionStatus(question.id, nextStatus, question.revision);
      setBank(current => current ? { ...current, questions: nextStatus === "deleted" ? current.questions.filter(q => q.id !== savedQuestion.id) : current.questions.map(q => q.id === savedQuestion.id ? savedQuestion : q) } : current);
      setConfirmation(null);
      setActionMessage(nextStatus === "archive" ? "Вопрос перемещён в архив." : nextStatus === "active" ? "Вопрос возвращён в активный банк." : "Вопрос удалён из рабочего банка.");
      await load();
    } catch (error) { setActionMessage(errorText(error)); setConfirmation(null); } finally { setPendingId(""); }
  }
  function addQuestion() {
    if (!bank) return;
    const first = bank.categories.find(c => c.id === "bar") || bank.categories.find(c => c.knowledgeType) || bank.categories[0];
    setEditing({ categoryId: first?.id || "bar", knowledgeType: first?.knowledgeType || "bar", venue: "bf", q: "", topic: first?.ticketPlan[0]?.topic || "Общее", subcategory: "", group: newGroupKey(), answers: emptyAnswers(), source: "", sourceRef: "", reviewUrl: "", reviewLabel: "", reviewNote: "" });
  }
  if (loading && !bank) return <p role="status">Загружаем банк вопросов…</p>;
  if (!bank) return <div className="stack"><WarmEmpty title="Банк вопросов недоступен" body={error} /><Button onClick={() => void load()}>Повторить</Button></div>;
  if (editing) return <Editor bank={bank} draft={editing} onClose={() => setEditing(null)} onSaved={async savedQuestion => {
    setBank(current => current ? { ...current, questions: current.questions.some(q => q.id === savedQuestion.id) ? current.questions.map(q => q.id === savedQuestion.id ? savedQuestion : q) : [...current.questions, savedQuestion] } : current);
    setActionMessage("Вопрос сохранён на сервере."); await load();
  }} />;
  const active = bank.questions.filter(q => q.status === "active").length;
  const archived = bank.questions.filter(q => q.status === "archive").length;
  return <section className="stack bf-question-bank bf-attestation-domain">
    <WarmTitle title="Банк вопросов" action={<Button variant="primary" onClick={addQuestion}>Добавить вопрос</Button>} />
    <div className="bf-bank-tools">
      <label className="bf-field bf-bank-search"><span className="bf-field-label">Найти вопрос</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Вопрос, раздел или ответ" /></label>
      <div className="bf-bank-filter-grid" role="group" aria-label="Фильтры вопросов">
        <label className="bf-field"><span className="bf-field-label">Показывать</span><select aria-label="Статус вопросов" value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="active">Активные</option><option value="archive">Архив</option><option value="all">Все статусы</option></select></label>
        <label className="bf-field"><span className="bf-field-label">Тип знаний</span><select aria-label="Тип знаний вопросов" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Все типы</option>{Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="bf-field"><span className="bf-field-label">Раздел</span><select value={sections.includes(section) ? section : "all"} onChange={event => setSection(event.target.value)}><option value="all">Все разделы</option>{sections.map(topic => <option key={topic}>{topic}</option>)}</select></label>
        <label className="bf-field bf-bank-venue-filter"><span className="bf-field-label">Заведение</span><select value={venue} onChange={event => setVenue(event.target.value)}><option value="all">Все заведения</option>{Object.entries(VENUES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <p className="bf-bank-counts"><span>Найдено: <strong>{filtered.length}</strong> из {bank.questions.length}</span><span>Активны {active} · архив {archived}</span></p>
      <Button className="bf-bank-reset" variant="ghost" onClick={() => { setSearch(""); setCategory("all"); setSection("all"); setVenue("all"); setStatus("active"); }}>Сбросить фильтры</Button>
    </div>
    {actionMessage ? <WarmNotice error={!/^Вопрос (перемещён|возвращён|удалён|сохранён)/.test(actionMessage)}>{actionMessage}</WarmNotice> : null}
    {error ? <WarmNotice error>{error} <Button onClick={() => void load()}>Повторить</Button></WarmNotice> : null}
    <div className="bf-bank-list">{filtered.map(question => <details key={question.id} className="bf-bank-question">
      <summary><span className="bf-bank-summary"><span className="bf-bank-meta">{question.knowledgeType ? TYPES[question.knowledgeType] : "Не настроено"} · {question.topic} · {VENUES[question.venue]}{question.status === "archive" ? <span className="bf-bank-archived">Архив</span> : null}</span><span className="bf-bank-question-text">{question.q}</span></span><WarmIcon name="chevron" size={18} /></summary>
      <div className="bf-bank-question-body"><ol className="bf-bank-answers">{question.answers.map((answer,index) => <li key={index}><span className="bf-bank-answer-index">{index + 1}.</span><span>{answer.text}{answer.correct ? <span className="bf-bank-correct"><WarmIcon name="check" size={14} />Правильный ответ</span> : null}</span></li>)}</ol>
        <div className="bf-bank-actions"><Button onClick={() => setEditing(draftFromQuestion(question))}><WarmIcon name="edit" size={16} />Изменить</Button><Button disabled={pendingId === question.id} onClick={() => setConfirmation({ question, status: question.status === "active" ? "archive" : "active" })}>{question.status === "active" ? "В архив" : "Вернуть"}</Button><Button variant="ghost" disabled={pendingId === question.id} onClick={() => setConfirmation({ question, status: "deleted" })}>Удалить</Button></div>
      </div>
    </details>)}{!filtered.length ? <WarmEmpty title="Вопросов по этим фильтрам нет" body="Измени запрос или сбрось фильтры." /> : null}</div>
    {confirmation ? <WarmDialog title={confirmation.status === "deleted" ? "Удалить вопрос?" : confirmation.status === "archive" ? "Перенести вопрос в архив?" : "Вернуть вопрос?"} confirm onClose={() => { if (!pendingId) setConfirmation(null); }}><p>Начатые и завершённые попытки сохранят свои вопросы. Сервер проверит состав активных билетов.</p><div className="bf-dialog-actions"><Button disabled={Boolean(pendingId)} onClick={() => setConfirmation(null)}>Отмена</Button><Button variant="primary" disabled={Boolean(pendingId)} onClick={() => void changeStatus()}>{pendingId ? "Сохраняем…" : confirmation.status === "deleted" ? "Удалить вопрос" : "Подтвердить"}</Button></div></WarmDialog> : null}
  </section>;
}

export function AttestationBankPage() {
  return <><WarmBack to="/settings/attestation" label="К управлению аттестацией" /><AttestationBankAdminPanel /></>;
}
