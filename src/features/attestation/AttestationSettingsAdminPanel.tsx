import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Button } from "@/components/ui/button";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmBack } from "@/components/warm/WarmBack";
import { WarmTitle, WarmNotice, WarmEmpty } from "@/components/warm/WarmPage";
import { WarmDialog } from "@/components/warm/WarmDialog";
import "./attestation.css";
import {
  loadAttestationEditorBank,
  saveAttestationCategory,
  saveAttestationEditorSettings,
  setAttestationCategoryStatus,
  type AttestationEditorBank,
  type AttestationEditorCategory
} from "@/features/attestation/attestation-editor-api";
import { deleteAttestationTicket } from "@/features/attestation/delete-attestation-ticket";
import type { AttestationVenue, KnowledgeType } from "@/features/attestation/types";

type PlanDraft = {
  key: string;
  topic: string;
  count: string;
};

type CategoryDraft = Omit<AttestationEditorCategory, "questionsPerTest" | "specificQuestionCount"> & {
  questionsPerTest: string;
  specificQuestionCount: string;
  plan: PlanDraft[];
};

type AvailableTopic = { topic: string; available: number };

// Tickets draw distinct question groups, not individual answer variants.
// The server uses the same venue rule: a venue ticket may use local + common;
// a BF/BB common ticket can only use questions marked common.
function availableTopics(bank: AttestationEditorBank, category: Pick<CategoryDraft, "knowledgeType" | "venue">): AvailableTopic[] {
  if (!category.knowledgeType) return [];
  const topics = new Map<string, Set<string>>();
  for (const question of bank.questions) {
    if (question.status !== "active" || question.knowledgeType !== category.knowledgeType) continue;
    if (question.venue !== "common" && (category.venue === "common" || question.venue !== category.venue)) continue;
    const topic = question.topic.trim();
    if (!topic || !question.group) continue;
    if (!topics.has(topic)) topics.set(topic, new Set());
    topics.get(topic)!.add(question.group);
  }
  return [...topics.entries()]
    .map(([topic, groups]) => ({ topic, available: groups.size }))
    .filter((item) => item.available > 0)
    .sort((a, b) => a.topic.localeCompare(b.topic, "ru"));
}

function sizedDraft(category: CategoryDraft, plan: PlanDraft[], manuallySized: Set<string>): CategoryDraft {
  const total = plan.reduce((sum, item) => sum + Number(item.count || 0), 0);
  return { ...category, plan, questionsPerTest: !category.active && !manuallySized.has(category.id)
    && total >= 1 && total <= 50 ? String(total) : category.questionsPerTest };
}

type ActionMessage = {
  tone: "success" | "error";
  text: string;
} | null;

function rowKey() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function numericDraft(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function editorErrorText(error: unknown) {
  const code = error instanceof Error ? error.message : "";

  if (code === "attestation_settings_revision_conflict") {
    return "Настройки уже изменены в другой сессии. Обновите редактор и повторите.";
  }
  if (code === "attestation_category_revision_conflict") {
    return "Категория уже изменена в другой сессии. Обновите редактор.";
  }
  if (code === "attestation_ticket_group_cross_topic") {
    return "Одна группа вопросов оказалась в разных разделах. Измените раздел одного из вопросов.";
  }
  if (code === "attestation_ticket_quota_capacity") {
    return "Для заданной квоты не хватает общих вопросов или вопросов заведения в выбранных разделах.";
  }
  if (code === "attestation_ticket_quota_invalid") {
    return "Проверьте число вопросов заведения: оно не может превышать размер билета. Общий билет содержит только общие вопросы.";
  }
  if (code === "attestation_ticket_type_required" || code === "attestation_ticket_type_invalid") {
    return "Выберите тип знаний и заведение для билета.";
  }
  if (code === "attestation_ticket_capacity") {
    return "Для выбранного плана не хватает активных вопросов в одном из разделов.";
  }
  if (code === "attestation_ticket_total_invalid") {
    return "Сумма вопросов по разделам должна совпадать с количеством вопросов этой категории.";
  }
  if (code === "attestation_ticket_plan_duplicate") {
    return "Один и тот же раздел добавлен в категорию дважды.";
  }
  if (code === "attestation_ticket_plan_invalid" || code === "attestation_settings_invalid") {
    return "Настройки заполнены некорректно. Проверьте разделы и количество вопросов.";
  }
  if (code === "attestation_category_settings_duplicate" || code === "attestation_category_settings_incomplete") {
    return "Список категорий изменился. Обновите редактор и повторите.";
  }
  if (code === "attestation_category_not_ready") {
    return "Категорию пока нельзя включить: сначала заполните разделы и добавьте достаточно активных вопросов.";
  }
  if (code === "attestation_last_category") {
    return "Нельзя отключить последнюю активную категорию аттестации.";
  }
  if (code === "attestation_category_label_invalid") {
    return "Название категории должно содержать от 1 до 80 символов.";
  }
  if (code === "attestation_category_label_duplicate") {
    return "Категория с таким названием уже существует.";
  }
  if (code === "attestation_pass_percent_invalid") {
    return "Порог прохождения должен быть от 50 до 100%.";
  }
  if (code === "attestation_question_count_invalid") {
    return "Количество вопросов должно быть от 1 до 50.";
  }
  if (code === "attestation_settings_verify_failed") {
    return "Сервер ответил на сохранение, но повторная проверка не подтвердила новые значения. Обновите редактор и повторите.";
  }
  if (code === "forbidden") {
    return "Недостаточно прав для изменения настроек аттестации.";
  }

  if (code === "attestation_ticket_delete_questions_exist") {
    return "К билету привязаны вопросы банка. Перенесите их в другой билет прежде, чем удалять этот.";
  }
  if (code === "attestation_ticket_last_active") {
    return "Нельзя удалить последний включённый билет.";
  }
  if (code === "attestation_ticket_delete_revision_conflict") {
    return "Билет уже изменён в другой сессии. Обновите настройки.";
  }
  if (code === "attestation_category_not_found") {
    return "Билет уже удалён или недоступен. Обновите редактор.";
  }
  if (code === "attestation_ticket_delete_function_missing") {
    return "Сервер не обновлён: сначала установите SQL-миграцию удаления билетов.";
  }
  if (code === "attestation_ticket_delete_failed") {
    return "Сервер не подтвердил удаление билета.";
  }

  return "Изменение не сохранено. Проверьте соединение и повторите.";
}

function draftCategories(bank: AttestationEditorBank): CategoryDraft[] {
  return bank.categories.map((category) => ({
    ...category,
    questionsPerTest: String(category.questionsPerTest || bank.settings.questionsPerTest || 15),
    specificQuestionCount: category.specificQuestionCount === null ? "" : String(category.specificQuestionCount),
    plan: category.ticketPlan.map((item) => ({
      key: rowKey(),
      topic: item.topic,
      count: String(item.count)
    }))
  }));
}

function settingsSignature(passPercent: string, categories: CategoryDraft[]) {
  return JSON.stringify({
    passPercent,
    categories: categories.map((category) => ({
      id: category.id,
      label: category.label,
      questionsPerTest: category.questionsPerTest,
      knowledgeType: category.knowledgeType,
      venue: category.venue,
      specificQuestionCount: category.specificQuestionCount,
      plan: category.plan.map((item) => ({
        topic: item.topic.trim(),
        count: item.count
      }))
    }))
  });
}

function settingsPersisted(
  bank: AttestationEditorBank,
  expectedPassPercent: number,
  expectedCategories: CategoryDraft[]
) {
  if (bank.settings.passPercent !== expectedPassPercent) return false;

  const actualById = new Map(
    bank.categories.map((category) => [category.id, category])
  );

  return expectedCategories.every((expected) => {
    const actual = actualById.get(expected.id);
    if (!actual) return false;

    if (
      actual.label !== expected.label.trim() ||
      actual.questionsPerTest !== Number(expected.questionsPerTest) ||
      actual.knowledgeType !== expected.knowledgeType ||
      actual.venue !== expected.venue ||
      actual.specificQuestionCount !== (expected.specificQuestionCount === "" ? null : Number(expected.specificQuestionCount))
    ) {
      return false;
    }

    const expectedPlan = expected.plan.map((item) => ({
      topic: item.topic.trim(),
      count: Number(item.count)
    }));

    if (actual.ticketPlan.length !== expectedPlan.length) return false;

    return expectedPlan.every((item, index) => {
      const actualItem = actual.ticketPlan[index];
      return (
        actualItem?.topic === item.topic &&
        actualItem?.count === item.count
      );
    });
  });
}

export function AttestationSettingsAdminPanel() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [bank, setBank] = useState<AttestationEditorBank | null>(null);
  const [passPercent, setPassPercent] = useState("80");
  const [categories, setCategories] = useState<CategoryDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newKnowledgeType, setNewKnowledgeType] = useState<KnowledgeType>("bar");
  const [newVenue, setNewVenue] = useState<AttestationVenue>("bf");
  const [manualQuestionCountIds, setManualQuestionCountIds] = useState<string[]>([]);
  const [inlineSaveMessage, setInlineSaveMessage] = useState<{ categoryId: string; tone: "success" | "error"; text: string } | null>(null);
  const [createMessage, setCreateMessage] = useState<ActionMessage>(null);
  const [newTicketId, setNewTicketId] = useState<string | null>(null);
  const [deleteTicketId, setDeleteTicketId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingTicketId, setDeletingTicketId] = useState("");
  const newTicketRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState<ActionMessage>(null);

  function dismissDeleteConfirmation() {
    setDeleteTicketId(null);
    setDeleteConfirmation("");
  }

  function applyBank(next: AttestationEditorBank) {
    setBank(next);
    setPassPercent(String(next.settings.passPercent));
    setCategories(draftCategories(next));
    setManualQuestionCountIds([]);
  }

  async function load() {
    setLoading(true);
    setMessage(null);

    try {
      const next = await loadAttestationEditorBank(false);
      applyBank(next);
    } catch (error) {
      const needsUpgrade = error instanceof Error && error.message === "attestation_server_upgrade_required";
      setMessage({ tone: "error", text: needsUpgrade
        ? "База аттестации ещё не обновлена. Новые настройки появятся после серверной миграции."
        : "Не удалось загрузить настройки аттестации." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const originalSignature = useMemo(() => {
    if (!bank) return "";
    return settingsSignature(String(bank.settings.passPercent), draftCategories(bank));
  }, [bank]);

  const currentSignature = useMemo(
    () => settingsSignature(passPercent, categories),
    [passPercent, categories]
  );

  const settingsDirty = Boolean(bank) && currentSignature !== originalSignature;

  useEffect(() => {
    if (!settingsDirty && !(creating && newCategory.trim())) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [settingsDirty, creating, newCategory]);

  // A newly created draft used to be appended below all existing ticket cards,
  // making a successful save appear to do nothing on a phone. Reorder only the
  // rendered cards: changing the draft-array order would create false unsaved
  // settings because settingsSignature uses the original server order.
  const visibleCategories = useMemo(() => {
    if (!newTicketId) return categories;
    const created = categories.find((category) => category.id === newTicketId);
    return created ? [created, ...categories.filter((category) => category.id !== newTicketId)] : categories;
  }, [categories, newTicketId]);

  useEffect(() => {
    if (!newTicketId) return;
    const frame = requestAnimationFrame(() => {
      newTicketRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [newTicketId, categories.length]);

  const capacity = useMemo(() => {
    const result = new Map<string, number>();
    if (!bank) return result;

    for (const category of categories) {
      for (const item of category.plan) {
        const groups = new Set(bank.questions.filter((q) =>
          q.status === "active" && q.knowledgeType === category.knowledgeType
          && q.topic === item.topic.trim()
          && (q.venue === "common" || (category.venue !== "common" && q.venue === category.venue))
        ).map((q) => q.group));
        result.set(`${category.id}\u0000${item.topic.trim()}`, groups.size);
      }
    }
    return result;
  }, [bank, categories]);

  const categoryTopics = useMemo(() => {
    const result = new Map<string, AvailableTopic[]>();
    if (!bank) return result;
    for (const category of categories) {
      result.set(category.id, availableTopics(bank, category));
    }
    return result;
  }, [bank, categories]);

  function updateCategory(categoryId: string, patch: Partial<Pick<CategoryDraft, "label" | "questionsPerTest" | "knowledgeType" | "venue" | "specificQuestionCount">>) {
    if (patch.questionsPerTest !== undefined) {
      setManualQuestionCountIds((current) => current.includes(categoryId) ? current : [...current, categoryId]);
    }
    setInlineSaveMessage(null);
    setCategories((current) => current.map((category) => {
      if (category.id !== categoryId) return category;
      const changed = { ...category, ...patch };
      if (!bank || (patch.knowledgeType === undefined && patch.venue === undefined)) return changed;
      const valid = new Set(availableTopics(bank, changed).map((part) => part.topic));
      // Prevent a stale section from a different knowledge type / venue silently blocking save.
      return sizedDraft(changed, changed.plan.filter((row) => valid.has(row.topic)), new Set(manualQuestionCountIds));
    }));
  }

  function addPlanRow(categoryId: string) {
    setInlineSaveMessage(null);
    setCategories((current) => current.map((category) => {
      if (category.id !== categoryId) return category;
      return sizedDraft(category, [...category.plan, { key: rowKey(), topic: "", count: "1" }], new Set(manualQuestionCountIds));
    }));
  }

  function updatePlanRow(categoryId: string, row: string, patch: Partial<Pick<PlanDraft, "topic" | "count">>) {
    setInlineSaveMessage(null);
    setCategories((current) => current.map((category) => {
      if (category.id !== categoryId) return category;
      const plan = category.plan.map((item) => item.key === row ? { ...item, ...patch } : item);
      return sizedDraft(category, plan, new Set(manualQuestionCountIds));
    }));
  }

  function removePlanRow(categoryId: string, row: string) {
    setInlineSaveMessage(null);
    setCategories((current) => current.map((category) => {
      if (category.id !== categoryId) return category;
      return sizedDraft(category, category.plan.filter((item) => item.key !== row), new Set(manualQuestionCountIds));
    }));
  }

  function validateSettings() {
    const pass = Number(passPercent);
    if (!Number.isInteger(pass) || pass < 50 || pass > 100) {
      return "Порог прохождения должен быть целым числом от 50 до 100%.";
    }

    for (const category of categories) {
      const questionCount = Number(category.questionsPerTest);
      if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 50) {
        return `Категория «${category.label}»: количество вопросов должно быть от 1 до 50.`;
      }

      const seen = new Set<string>();
      for (const item of category.plan) {
        const topic = item.topic.trim();
        const count = Number(item.count);
        if (!topic || topic.length > 120) {
          return `Категория «${category.label}»: заполните название каждого раздела.`;
        }
        if (!Number.isInteger(count) || count < 1 || count > 50) {
          return `Категория «${category.label}»: количество вопросов в разделе должно быть от 1 до 50.`;
        }
        const normalized = topic.toLocaleLowerCase("ru");
        if (seen.has(normalized)) {
          return `Категория «${category.label}»: раздел «${topic}» добавлен дважды.`;
        }
        seen.add(normalized);
      }

      if (category.active && !category.knowledgeType) {
        return `Билет «${category.label}»: выберите тип знаний.`;
      }
      const exact = category.specificQuestionCount === "" ? null : Number(category.specificQuestionCount);
      if (exact !== null && (!Number.isInteger(exact) || exact < 0 || exact > questionCount || (category.venue === "common" && exact !== 0))) {
        return `Билет «${category.label}»: неправильное число вопросов заведения.`;
      }
      if (!category.active) continue;
      if (exact !== null && bank) {
        const plannedTopics = new Set(category.plan.map((part) => part.topic.trim()));
        const candidates = bank.questions.filter((q) => q.status === "active" && q.knowledgeType === category.knowledgeType && plannedTopics.has(q.topic));
        const venueGroups = new Set(candidates.filter((q) => q.venue === category.venue && category.venue !== "common").map((q) => q.group));
        const commonGroups = new Set(candidates.filter((q) => q.venue === "common").map((q) => q.group));
        if (venueGroups.size < exact || commonGroups.size < questionCount - exact) {
          return `Билет «${category.label}»: недостаточно специфичных или общих вопросов для заданной квоты.`;
        }
      }

      const total = category.plan.reduce((sum, item) => sum + Number(item.count || 0), 0);
      if (total !== questionCount) {
        return `Категория «${category.label}»: по разделам выбрано ${total}, а в аттестации должно быть ${questionCount}.`;
      }

      for (const item of category.plan) {
        const needed = Number(item.count);
        const available = capacity.get(`${category.id}\u0000${item.topic.trim()}`) || 0;
        if (available < needed) {
          return `Категория «${category.label}», раздел «${item.topic.trim()}»: доступно ${available}, нужно ${needed}.`;
        }
      }
    }

    return "";
  }

  async function saveSettings(feedbackCategoryId: string | null = newTicketId): Promise<AttestationEditorBank | null> {
    if (!bank) return null;
    const validation = validateSettings();
    if (validation) {
      setMessage({ tone: "error", text: validation });
      setInlineSaveMessage(feedbackCategoryId ? { categoryId: feedbackCategoryId, tone: "error", text: validation } : null);
      return null;
    }

    const expectedPassPercent = Number(passPercent);
    const expectedCategories = categories.map((category) => ({
      ...category,
      label: category.label.trim(),
      plan: category.plan.map((item) => ({
        ...item,
        topic: item.topic.trim()
      }))
    }));

    setSavingSettings(true);
    setMessage(null);
    setInlineSaveMessage(null);
    try {
      await saveAttestationEditorSettings({
        passPercent: expectedPassPercent,
        expectedRevision: bank.settings.revision,
        categories: expectedCategories.map((category) => ({
          categoryId: category.id,
          label: category.label,
          questionsPerTest: Number(category.questionsPerTest),
          knowledgeType: category.knowledgeType,
          venue: category.venue,
          specificQuestionCount: category.specificQuestionCount === "" ? null : Number(category.specificQuestionCount)
        })),
        ticketPlan: expectedCategories.flatMap((category) =>
          category.plan.map((item, index) => ({
            categoryId: category.id,
            topic: item.topic,
            count: Number(item.count),
            sortOrder: (index + 1) * 10
          }))
        )
      });

      const confirmed = await loadAttestationEditorBank(false);
      if (!settingsPersisted(confirmed, expectedPassPercent, expectedCategories)) {
        throw new Error("attestation_settings_verify_failed");
      }

      applyBank(confirmed);
      setMessage({ tone: "success", text: "Сохранено на сервере." });
      setInlineSaveMessage(feedbackCategoryId ? { categoryId: feedbackCategoryId, tone: "success", text: "Настройки билета сохранены. Теперь его можно включить в аттестацию." } : null);
      return confirmed;
    } catch (error) {
      const text = editorErrorText(error);
      setMessage({ tone: "error", text });
      setInlineSaveMessage(feedbackCategoryId ? { categoryId: feedbackCategoryId, tone: "error", text } : null);
      return null;
    } finally {
      setSavingSettings(false);
    }
  }

  async function createCategory() {
    const label = newCategory.trim();
    if (!label) {
      setCreateMessage({ tone: "error", text: "Введите название нового билета." });
      return;
    }
    if (settingsDirty) {
      setCreateMessage({ tone: "error", text: "Сначала сохраните текущие изменения." });
      return;
    }

    setPendingCategoryId("new");
    setCreateMessage(null);
    setMessage(null);
    let created: AttestationEditorCategory | null = null;
    try {
      created = await saveAttestationCategory({ label, knowledgeType: newKnowledgeType, venue: newVenue });
      // The INSERT is committed before the reload. If the second request
      // fails, never claim that creation failed or suggest retrying INSERT.
      setNewCategory("");
      const fresh = await loadAttestationEditorBank(false);
      if (!fresh.categories.some((ticket) => ticket.id === created?.id)) {
        throw new Error("attestation_category_refresh_unverified");
      }
      applyBank(fresh);
      setNewTicketId(created.id);
      setCreating(false);
      setEditingId(created.id);
      setCreateMessage({ tone: "success", text: `Билет «${label}» создан как черновик. Выберите разделы и число вопросов, затем нажмите «Сохранить и включить билет».` });
    } catch (error) {
      setCreateMessage(created
        ? { tone: "error", text: `Билет «${label}» создан на сервере, но список не обновился. Обновите редактор. Не добавляйте тот же билет повторно.` }
        : { tone: "error", text: editorErrorText(error) });
    } finally {
      setPendingCategoryId("");
    }
  }

  // One explicit action for a draft: persist the plan first, then activate the ticket.
  // A successful save is never rolled back or falsely reported as missing if the
  // separate activation request is rejected by the server's capacity checks.
  async function saveAndEnableTicket(categoryId: string) {
    const source = settingsDirty ? await saveSettings(categoryId) : bank;
    if (!source) return;
    const ticket = source.categories.find((item) => item.id === categoryId);
    if (!ticket || !ticket.updatedAt) {
      const text = "Не удалось подтвердить данные билета. Обновите редактор.";
      setInlineSaveMessage({ categoryId, tone: "error", text });
      return;
    }
    if (ticket.active) return;

    setPendingCategoryId(categoryId);
    let activated = false;
    try {
      await setAttestationCategoryStatus(categoryId, true, ticket.updatedAt);
      activated = true;
      const refreshed = await loadAttestationEditorBank(false);
      applyBank(refreshed);
      if (!refreshed.categories.some((item) => item.id === categoryId && item.active)) {
        throw new Error("attestation_category_refresh_unverified");
      }
      const text = `Билет «${ticket.label}» сохранён, включён и доступен в аттестации.`;
      setInlineSaveMessage({ categoryId, tone: "success", text });
      setMessage({ tone: "success", text });
    } catch (error) {
      const text = activated
        ? "Билет включён на сервере, но список не обновился. Перезагрузите редактор, не повторяйте включение вслепую."
        : `Черновик сохранён, но включение не удалось: ${editorErrorText(error)}`;
      setInlineSaveMessage({ categoryId, tone: "error", text });
      setMessage({ tone: "error", text });
    } finally {
      setPendingCategoryId("");
    }
  }

  async function permanentlyDeleteTicket(category: CategoryDraft) {
    if (!bank || deletingTicketId || deleteConfirmation !== category.label) return;
    if (settingsDirty) {
      setInlineSaveMessage({ categoryId: category.id, tone: "error", text: "Сначала сохраните или отмените другие изменения в настройках." });
      return;
    }
    if (!category.updatedAt) {
      setInlineSaveMessage({ categoryId: category.id, tone: "error", text: "Не удалось проверить версию билета. Обновите редактор." });
      return;
    }

    // This guard mirrors the authoritative SQL guard. No bank question is
    // silently deleted, archived or reassigned together with a ticket.
    const questionCount = bank.questions.filter((question) => question.categoryId === category.id).length;
    if (questionCount > 0) {
      setInlineSaveMessage({ categoryId: category.id, tone: "error", text: `Этот билет содержит ${questionCount} привязанных вопросов. Сначала перенесите их в другие билеты.` });
      return;
    }

    setDeletingTicketId(category.id);
    setInlineSaveMessage(null);
    setMessage(null);
    let removed = false;
    try {
      await deleteAttestationTicket(category.id, category.updatedAt);
      removed = true;
      // Prevent a successful DELETE from being presented as failure when the
      // subsequent readback experiences an unrelated connection problem.
      setBank((current) => current ? {
        ...current,
        categories: current.categories.filter((item) => item.id !== category.id),
        settings: { ...current.settings, revision: current.settings.revision + 1 }
      } : current);
      setCategories((current) => current.filter((item) => item.id !== category.id));
      setNewTicketId((current) => current === category.id ? null : current);
      dismissDeleteConfirmation();
      setEditingId(null);
      setMessage({ tone: "success", text: `Билет «${category.label}» удалён навсегда. Результаты сотрудников сохранены.` });
      try {
        const fresh = await loadAttestationEditorBank(false);
        applyBank(fresh);
      } catch {
        setMessage({ tone: "success", text: `Билет «${category.label}» удалён. Проверка списка не удалась, при необходимости обновите редактор. Результаты сотрудников сохранены.` });
      }
    } catch (error) {
      if (!removed) {
        setInlineSaveMessage({ categoryId: category.id, tone: "error", text: editorErrorText(error) });
      }
    } finally {
      setDeletingTicketId("");
    }
  }

  async function toggleCategory(category: CategoryDraft) {
    if (settingsDirty) {
      setMessage({ tone: "error", text: "Сначала сохраните текущие изменения." });
      return;
    }
    if (!category.updatedAt) {
      setMessage({ tone: "error", text: "Обновите редактор и повторите." });
      return;
    }

    setPendingCategoryId(category.id);
    setMessage(null);
    let changed = false;
    try {
      await setAttestationCategoryStatus(category.id, !category.active, category.updatedAt);
      changed = true;
      applyBank(await loadAttestationEditorBank(false));
      setMessage({
        tone: "success",
        text: category.active ? "Билет отключён." : "Билет включён."
      });
    } catch (error) {
      setMessage({ tone: "error", text: changed
        ? `Билет ${category.active ? "отключён" : "включён"} на сервере, но список не обновился. Обновите редактор.`
        : editorErrorText(error) });
    } finally {
      setPendingCategoryId("");
    }
  }

  const selected = categories.find(category => category.id === editingId);
  const busy = savingSettings || Boolean(pendingCategoryId) || Boolean(deletingTicketId);
  function closeEditor() {
    if (busy) return;
    if (settingsDirty || (creating && newCategory.trim())) setDiscardOpen(true);
    else { setEditingId(null); setCreating(false); }
  }
  if (loading && !bank) return <p role="status">Загружаем билеты…</p>;
  if (!bank) return <div className="stack"><WarmEmpty title="Билеты недоступны" body={message?.text || "Не удалось загрузить настройки аттестации."} /><Button onClick={() => void load()}>Повторить</Button></div>;

  const types: Record<KnowledgeType, string> = { bar: "Бар", kitchen: "Кухня", wine: "Вино", service: "Сервис" };
  const venues: Record<AttestationVenue, string> = { bf: "BeerFactory", bb: "BeerBistro", common: "Оба заведения" };
  const selectedTotal = selected?.plan.reduce((sum, row) => sum + Number(row.count || 0), 0) || 0;
  return <section className="stack bf-exam-editor bf-attestation-domain">
    {selected || creating ? <WarmBack label="К билетам" onClick={closeEditor} /> : null}
    <WarmTitle title={creating ? "Новый билет" : selected ? "Настройки билета" : "Билеты и настройки"} action={selected || creating
      ? <Button variant="ghost" disabled={busy} onClick={closeEditor}>Отмена</Button>
      : <Button variant="primary" disabled={busy} onClick={() => { setCreating(true); setCreateMessage(null); }}>Добавить билет</Button>} />
    {creating ? <form className="form-stack bf-compact-form" onSubmit={event => { event.preventDefault(); void createCategory(); }}>
      <label className="bf-field"><span className="bf-field-label">Название билета</span><input required maxLength={80} value={newCategory} onChange={event => setNewCategory(event.target.value)} /></label>
      <div className="bf-editor-pair"><label className="bf-field"><span className="bf-field-label">Тип билета</span><select value={newKnowledgeType} onChange={event => setNewKnowledgeType(event.target.value as KnowledgeType)}>{Object.entries(types).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="bf-field"><span className="bf-field-label">Заведение</span><select value={newVenue} onChange={event => setNewVenue(event.target.value as AttestationVenue)}>{Object.entries(venues).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <p className="small muted">Сначала создай черновик. Затем выбери разделы, количество вопросов и включи билет.</p>
      {createMessage ? <WarmNotice error={createMessage.tone === "error"}>{createMessage.text}</WarmNotice> : null}
      <Button variant="primary" type="submit" disabled={busy}>{busy ? "Создаём…" : "Создать черновик"}</Button>
    </form> : selected ? <div ref={selected.id === newTicketId ? newTicketRef : undefined} className="stack">
      <form className="form-stack bf-compact-form" onSubmit={event => { event.preventDefault(); void saveSettings(selected.id); }}>
        <fieldset disabled={busy} className="bf-attestation-fields">
          <label className="bf-field"><span className="bf-field-label">Название билета</span><input required maxLength={80} aria-label="Название категории" value={selected.label} onChange={event => updateCategory(selected.id, { label: event.target.value })} /></label>
          <div className="bf-editor-pair">
            <label className="bf-field"><span className="bf-field-label">Тип билета</span><select required aria-label={`Тип билета «${selected.label}»`} value={selected.knowledgeType ?? ""} onChange={event => updateCategory(selected.id, { knowledgeType: event.target.value as KnowledgeType })}><option value="" disabled>Выбери тип билета</option>{Object.entries(types).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="bf-field"><span className="bf-field-label">Заведение</span><select aria-label={`Заведение билета «${selected.label}»`} value={selected.venue} onChange={event => updateCategory(selected.id, { venue: event.target.value as AttestationVenue, specificQuestionCount: "" })}>{Object.entries(venues).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <div className="bf-editor-pair bf-ticket-numbers">
            <label className="bf-field"><span className="bf-field-label">Вопросов в билете</span><input type="number" inputMode="numeric" min={1} max={50} required value={selected.questionsPerTest} onChange={event => updateCategory(selected.id, { questionsPerTest: numericDraft(event.target.value) })} /></label>
            <label className="bf-field"><span className="bf-field-label">Порог зачёта, %</span><input type="number" inputMode="numeric" min={50} max={100} required value={passPercent} onChange={event => setPassPercent(numericDraft(event.target.value))} /></label>
          </div>
          <p className="small muted">Порог зачёта общий для всех билетов.</p>
          <label className="bf-field"><span className="bf-field-label">Вопросов только этого заведения</span><input aria-label="Вопросов только этого заведения" type="number" inputMode="numeric" min={0} max={Number(selected.questionsPerTest) || 50} value={selected.specificQuestionCount} placeholder="Без отдельной квоты" onChange={event => updateCategory(selected.id, { specificQuestionCount: numericDraft(event.target.value) })} /><span className="small muted">Пусто — без отдельной квоты; остальные вопросы общие.</span></label>
          <section className="bf-editor-group"><h2>Разделы и количество вопросов</h2><p className="small muted">Билет выбирает независимые группы вопросов из активного банка.</p>
            {selected.plan.map((item,index) => <div className="bf-quota-row" key={item.key}>
              <label className="bf-field"><span className="bf-field-label">Раздел</span><select required title={item.topic} aria-label={`Раздел ${index + 1}`} value={item.topic} onChange={event => updatePlanRow(selected.id, item.key, { topic: event.target.value })}><option value="" disabled>Выбери раздел</option>{item.topic && !(categoryTopics.get(selected.id) || []).some(topic => topic.topic === item.topic) ? <option value={item.topic} disabled>{item.topic} · нет вопросов</option> : null}{(categoryTopics.get(selected.id) || []).map(topic => <option key={topic.topic} value={topic.topic} disabled={selected.plan.some(row => row.key !== item.key && row.topic === topic.topic)}>{topic.topic}</option>)}</select></label>
              <label className="bf-field"><span className="bf-field-label">Взять</span><input type="number" inputMode="numeric" min={1} max={50} required aria-label={`Вопросов из раздела ${index + 1}`} value={item.count} onChange={event => updatePlanRow(selected.id, item.key, { count: numericDraft(event.target.value) })} /></label>
              <Button type="button" variant="ghost" size="icon" aria-label={`Убрать раздел ${index + 1}`} onClick={() => removePlanRow(selected.id, item.key)}><WarmIcon name="close" size={18} /></Button>
              <p className="small muted bf-quota-availability">Доступно: {capacity.get(`${selected.id}\u0000${item.topic.trim()}`) || 0} независимых вопросов</p>
            </div>)}
            <Button type="button" onClick={() => addPlanRow(selected.id)} disabled={!selected.knowledgeType || (categoryTopics.get(selected.id) || []).every(choice => selected.plan.some(row => row.topic === choice.topic))}>Добавить раздел</Button>
            <p className="small muted">По разделам: {selectedTotal} · всего: {selected.questionsPerTest || 0}{Number(selected.questionsPerTest) > selectedTotal ? ` · осталось распределить ${Number(selected.questionsPerTest) - selectedTotal}` : selectedTotal > Number(selected.questionsPerTest) ? ` · уберите ${selectedTotal - Number(selected.questionsPerTest)}` : " · готово"}</p>
          </section>
        </fieldset>
        {message ? <WarmNotice error={message.tone === "error"}>{message.text}</WarmNotice> : null}
        {inlineSaveMessage?.categoryId === selected.id && inlineSaveMessage.text !== message?.text ? <WarmNotice error={inlineSaveMessage.tone === "error"}>{inlineSaveMessage.text}</WarmNotice> : null}
        <Button variant="primary" type="submit" disabled={!settingsDirty || busy}>{savingSettings ? "Сохраняем…" : "Сохранить настройки"}</Button>
      </form>
      <section className="bf-editor-section stack"><p className="small muted">{selected.active ? "Билет включён в аттестацию" : "Билет отключён"}</p>
        <Button disabled={busy} onClick={() => selected.active ? void toggleCategory(selected) : void saveAndEnableTicket(selected.id)}>{selected.active ? "Отключить билет" : settingsDirty ? "Сохранить и включить билет" : "Включить билет"}</Button>
        <Button variant="ghost" disabled={busy} onClick={() => { setDeleteTicketId(selected.id); setDeleteConfirmation(""); }}>Удалить билет</Button>
      </section>
    </div> : <>
      {message ? <WarmNotice error={message.tone === "error"}>{message.text}</WarmNotice> : null}
      <div className="bf-attestation-ticket-list">{visibleCategories.map(category => <button key={category.id} type="button" className="item-row w-full text-left" onClick={() => { setEditingId(category.id); setMessage(null); setInlineSaveMessage(null); }}><span><strong className="block">{category.label}</strong><span className="small muted">{venues[category.venue]} · {category.active ? "" : "Отключён · "}Вопросов: {category.questionsPerTest}</span></span><span className="small">От {passPercent}%</span></button>)}</div>
      {!categories.length ? <WarmEmpty title="Билетов пока нет" body="Создай черновик, затем выбери разделы и количество вопросов." /> : null}
    </>}
    {deleteTicketId && selected ? <WarmDialog title="Удалить билет?" confirm onClose={() => { if (!deletingTicketId) dismissDeleteConfirmation(); }}><p>Удаляется определение билета и распределение разделов. Вопросы и сохранённые результаты остаются. Для подтверждения введи название билета.</p><label className="bf-field"><span className="bf-field-label">{selected.label}</span><input value={deleteConfirmation} autoComplete="off" onChange={event => setDeleteConfirmation(event.target.value)} /></label><div className="bf-dialog-actions"><Button disabled={Boolean(deletingTicketId)} onClick={dismissDeleteConfirmation}>Отмена</Button><Button variant="primary" disabled={deleteConfirmation !== selected.label || busy || settingsDirty} onClick={() => void permanentlyDeleteTicket(selected)}>{deletingTicketId ? "Удаляем…" : "Удалить билет"}</Button></div>{settingsDirty ? <p className="small critical">Сначала сохрани или отмени изменения.</p> : null}{inlineSaveMessage?.tone === "error" ? <WarmNotice error>{inlineSaveMessage.text}</WarmNotice> : null}</WarmDialog> : null}
    {discardOpen ? <WarmDialog title="Закрыть без сохранения?" confirm onClose={() => setDiscardOpen(false)}><p>Изменения настроек не сохранятся.</p><div className="bf-dialog-actions"><Button onClick={() => setDiscardOpen(false)}>Продолжить</Button><Button variant="primary" onClick={() => { applyBank(bank); setNewCategory(""); setDiscardOpen(false); setEditingId(null); setCreating(false); }}>Закрыть</Button></div></WarmDialog> : null}
  </section>;
}
