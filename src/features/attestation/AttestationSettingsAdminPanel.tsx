import {
  Archive,
  CircleAlert,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Trash2
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
  saveAttestationCategory,
  saveAttestationEditorSettings,
  setAttestationCategoryStatus,
  type AttestationEditorBank,
  type AttestationEditorCategory
} from "@/features/attestation/attestation-editor-api";
import { cn } from "@/lib/utils";

type PlanDraft = {
  key: string;
  topic: string;
  count: string;
};

type CategoryDraft = Omit<AttestationEditorCategory, "questionsPerTest"> & {
  questionsPerTest: string;
  plan: PlanDraft[];
};

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

  return "Изменение не сохранено. Проверьте соединение и повторите.";
}

function draftCategories(bank: AttestationEditorBank): CategoryDraft[] {
  return bank.categories.map((category) => ({
    ...category,
    questionsPerTest: String(category.questionsPerTest || bank.settings.questionsPerTest || 15),
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
      actual.questionsPerTest !== Number(expected.questionsPerTest)
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
  const [bank, setBank] = useState<AttestationEditorBank | null>(null);
  const [passPercent, setPassPercent] = useState("80");
  const [categories, setCategories] = useState<CategoryDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [message, setMessage] = useState<ActionMessage>(null);

  function applyBank(next: AttestationEditorBank) {
    setBank(next);
    setPassPercent(String(next.settings.passPercent));
    setCategories(draftCategories(next));
  }

  async function load() {
    setLoading(true);
    setMessage(null);

    try {
      const next = await loadAttestationEditorBank(false);
      applyBank(next);
    } catch {
      setMessage({ tone: "error", text: "Не удалось загрузить настройки аттестации." });
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

  const capacity = useMemo(() => {
    const result = new Map<string, number>();
    if (!bank) return result;

    const groups = new Map<string, Set<string>>();
    for (const question of bank.questions) {
      if (question.status !== "active") continue;
      const key = `${question.categoryId}\u0000${question.topic}`;
      const set = groups.get(key) || new Set<string>();
      set.add(question.group);
      groups.set(key, set);
    }

    for (const [key, groupsForTopic] of groups) {
      result.set(key, groupsForTopic.size);
    }

    return result;
  }, [bank]);

  const categoryTopics = useMemo(() => {
    const result = new Map<string, string[]>();
    if (!bank) return result;

    for (const category of bank.categories) {
      const values = bank.questions
        .filter((question) => question.categoryId === category.id)
        .map((question) => question.topic)
        .filter(Boolean);
      result.set(category.id, [...new Set(values)].sort((a, b) => a.localeCompare(b, "ru")));
    }

    return result;
  }, [bank]);

  function updateCategory(categoryId: string, patch: Partial<Pick<CategoryDraft, "label" | "questionsPerTest">>) {
    setCategories((current) =>
      current.map((category) => category.id === categoryId ? { ...category, ...patch } : category)
    );
  }

  function addPlanRow(categoryId: string) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId
          ? { ...category, plan: [...category.plan, { key: rowKey(), topic: "", count: "1" }] }
          : category
      )
    );
  }

  function updatePlanRow(categoryId: string, row: string, patch: Partial<Pick<PlanDraft, "topic" | "count">>) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId
          ? { ...category, plan: category.plan.map((item) => item.key === row ? { ...item, ...patch } : item) }
          : category
      )
    );
  }

  function removePlanRow(categoryId: string, row: string) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId
          ? { ...category, plan: category.plan.filter((item) => item.key !== row) }
          : category
      )
    );
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

      if (!category.active) continue;

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

  async function saveSettings() {
    if (!bank) return;
    const validation = validateSettings();
    if (validation) {
      setMessage({ tone: "error", text: validation });
      return;
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
    try {
      await saveAttestationEditorSettings({
        passPercent: expectedPassPercent,
        expectedRevision: bank.settings.revision,
        categories: expectedCategories.map((category) => ({
          categoryId: category.id,
          label: category.label,
          questionsPerTest: Number(category.questionsPerTest)
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
    } catch (error) {
      setMessage({ tone: "error", text: editorErrorText(error) });
    } finally {
      setSavingSettings(false);
    }
  }

  async function createCategory() {
    const label = newCategory.trim();
    if (!label) {
      setMessage({ tone: "error", text: "Введите название новой категории." });
      return;
    }
    if (settingsDirty) {
      setMessage({ tone: "error", text: "Сначала сохраните или сбросьте текущие изменения." });
      return;
    }

    setPendingCategoryId("new");
    setMessage(null);
    try {
      await saveAttestationCategory({ label });
      setNewCategory("");
      await load();
      setMessage({ tone: "success", text: "Категория создана как черновик. Настройте её и затем включите." });
    } catch (error) {
      setMessage({ tone: "error", text: editorErrorText(error) });
    } finally {
      setPendingCategoryId("");
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
    try {
      await setAttestationCategoryStatus(category.id, !category.active, category.updatedAt);
      await load();
      setMessage({
        tone: "success",
        text: category.active ? "Категория скрыта из аттестации." : "Категория включена в аттестацию."
      });
    } catch (error) {
      setMessage({ tone: "error", text: editorErrorText(error) });
    } finally {
      setPendingCategoryId("");
    }
  }

  if (loading && !bank) {
    return <div className="mt-4 h-56 animate-pulse rounded-[22px] bg-[var(--bf-surface)]" />;
  }

  if (!bank) {
    return (
      <Surface className="mt-4 p-4 text-sm text-[#e99990]">
        {message?.text || "Не удалось загрузить настройки аттестации."}
        <Button className="mt-3" onClick={() => void load()}>
          <RefreshCw className="size-4" aria-hidden />Повторить
        </Button>
      </Surface>
    );
  }

  return (
    <section className="mt-4 grid gap-4">
      <Surface className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">НАСТРОЙКИ</p>
            <h3 className="mt-1 flex items-center gap-2 text-2xl font-black">
              <Settings2 className="size-5" aria-hidden />Правила аттестации
            </h3>
          </div>
          <Button type="button" variant="secondary" size="icon" aria-label="Сбросить несохранённые изменения" disabled={!settingsDirty || savingSettings} onClick={() => void load()}>
            <RefreshCw className="size-4" aria-hidden />
          </Button>
        </div>

        <label className="mt-4 grid gap-1 text-xs font-bold text-[var(--bf-muted)]">
          Порог прохождения, %
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={passPercent}
            onChange={(event) => setPassPercent(numericDraft(event.target.value))}
            className="min-h-12 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-[16px] font-black text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
          />
        </label>
        <p className="mt-2 text-xs leading-5 text-[var(--bf-dim)]">
          Количество вопросов задаётся отдельно внутри каждой категории.
        </p>
      </Surface>

      <Surface className="p-4">
        <p className="eyebrow">КАТЕГОРИИ</p>
        <h3 className="mt-1 text-xl font-black">Категории и разделы вопросов</h3>

        <div className="mt-4 flex gap-2">
          <input
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            placeholder="Новая категория"
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-[16px] text-[var(--bf-cream)] outline-none placeholder:text-[var(--bf-dim)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
          />
          <Button type="button" variant="primary" disabled={pendingCategoryId === "new"} onClick={() => void createCategory()}>
            {pendingCategoryId === "new" ? <RefreshCw className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            Добавить
          </Button>
        </div>

        <div className="mt-4 grid gap-3">
          {categories.map((category) => {
            const questionCount = Number(category.questionsPerTest || 0);
            const total = category.plan.reduce((sum, item) => sum + Number(item.count || 0), 0);
            const remaining = questionCount - total;
            const invalidTotal = category.active && remaining !== 0;
            const distributionText =
              !category.questionsPerTest
                ? `Распределено ${total}`
                : remaining > 0
                  ? `Распределено ${total} из ${questionCount} · осталось распределить ${remaining}`
                  : remaining < 0
                    ? `Распределено ${total} из ${questionCount} · уберите ${Math.abs(remaining)}`
                    : `Распределено ${total} из ${questionCount} · готово`;

            return (
              <div key={category.id} className="rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <input
                      value={category.label}
                      maxLength={80}
                      onChange={(event) => updateCategory(category.id, { label: event.target.value })}
                      className="min-h-11 w-full rounded-xl border border-transparent bg-transparent px-2 text-[16px] font-black text-[var(--bf-cream)] outline-none focus:border-[var(--bf-line)] focus:bg-[var(--bf-surface)]"
                      aria-label="Название категории"
                    />
                    <span className={cn("ml-2 text-[10px] font-black uppercase tracking-[.08em]", category.active ? "text-[#9dd0a0]" : "text-[var(--bf-dim)]")}>
                      {category.active ? "Включена" : "Черновик"}
                    </span>
                  </div>
                </div>

                <label className="mt-3 grid gap-1 text-xs font-bold text-[var(--bf-muted)]">
                  Вопросов в этой аттестации
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={category.questionsPerTest}
                    onChange={(event) => updateCategory(category.id, { questionsPerTest: numericDraft(event.target.value) })}
                    className="min-h-12 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] px-3 text-[16px] font-black text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
                  />
                </label>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[var(--bf-cream)]">Разделы вопросов</p>
                    <p className="mt-0.5 text-[11px] text-[var(--bf-dim)]">Система возьмёт указанное количество из каждого раздела.</p>
                  </div>
                  <Button type="button" variant="secondary" size="icon" aria-label="Добавить раздел" onClick={() => addPlanRow(category.id)}>
                    <Plus className="size-4" aria-hidden />
                  </Button>
                </div>

                <div className="mt-2 grid gap-2">
                  {category.plan.map((item) => {
                    const available = capacity.get(`${category.id}\u0000${item.topic.trim()}`) || 0;
                    return (
                      <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_78px_40px] gap-2 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] p-2">
                        <label className="grid gap-1 text-[10px] font-bold text-[var(--bf-dim)]">
                          Раздел
                          <input
                            value={item.topic}
                            list={`attestation-topics-${category.id}`}
                            onChange={(event) => updatePlanRow(category.id, item.key, { topic: event.target.value })}
                            className="min-h-10 min-w-0 rounded-lg border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-2 text-[16px] text-[var(--bf-cream)] outline-none"
                            placeholder="Например, Коктейли"
                          />
                          <datalist id={`attestation-topics-${category.id}`}>
                            {(categoryTopics.get(category.id) || []).map((topic) => <option key={topic} value={topic} />)}
                          </datalist>
                          {item.topic.trim() ? <span>Доступно: {available}</span> : null}
                        </label>
                        <label className="grid gap-1 text-[10px] font-bold text-[var(--bf-dim)]">
                          Взять
                          <input
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={item.count}
                            onChange={(event) => updatePlanRow(category.id, item.key, { count: numericDraft(event.target.value) })}
                            className="min-h-10 rounded-lg border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-2 text-center text-[16px] font-black text-[var(--bf-cream)] outline-none"
                          />
                        </label>
                        <Button type="button" variant="ghost" size="icon" aria-label="Удалить раздел" onClick={() => removePlanRow(category.id, item.key)}>
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    );
                  })}
                  {!category.plan.length ? <p className="rounded-xl border border-dashed border-[var(--bf-line)] p-3 text-xs text-[var(--bf-dim)]">Добавьте хотя бы один раздел вопросов.</p> : null}
                </div>

                <div
                  className={cn(
                    "mt-2 rounded-xl px-3 py-2 text-xs font-bold",
                    invalidTotal
                      ? "border border-[color:color-mix(in_srgb,var(--bf-red),transparent_55%)] bg-[color:color-mix(in_srgb,var(--bf-red),transparent_90%)] text-[#e99990]"
                      : "text-[var(--bf-dim)]"
                  )}
                  role={invalidTotal ? "alert" : undefined}
                >
                  {distributionText}
                </div>

                <details className="mt-3 border-t border-[var(--bf-line)] pt-2">
                  <summary className="min-h-10 cursor-pointer py-2 text-xs font-bold text-[var(--bf-dim)]">Дополнительно</summary>
                  <Button type="button" variant="secondary" disabled={pendingCategoryId === category.id} onClick={() => void toggleCategory(category)}>
                    {category.active ? <Archive className="size-4" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
                    {category.active ? "Скрыть категорию" : "Включить категорию"}
                  </Button>
                </details>
              </div>
            );
          })}
        </div>
      </Surface>

      {message ? (
        <Surface className={cn("flex items-start gap-2 p-3 text-xs font-bold", message.tone === "success" ? "text-[#9dd0a0]" : "text-[#e99990]")} role="status" aria-live="polite">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{message.text}
        </Surface>
      ) : null}

      <Button type="button" variant="primary" size="lg" disabled={!settingsDirty || savingSettings} onClick={() => void saveSettings()}>
        {savingSettings ? <RefreshCw className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
        {savingSettings ? "Сохраняем…" : "Сохранить настройки"}
      </Button>
    </section>
  );
}
