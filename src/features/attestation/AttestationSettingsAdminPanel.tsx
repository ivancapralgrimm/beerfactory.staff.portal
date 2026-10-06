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
  count: number;
};

type CategoryDraft = AttestationEditorCategory & {
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

function editorErrorText(error: unknown) {
  const code = error instanceof Error ? error.message : "";

  if (code === "attestation_settings_revision_conflict") {
    return "Настройки уже изменены в другой сессии. Обновите редактор и повторите.";
  }
  if (code === "attestation_category_revision_conflict") {
    return "Категория уже изменена в другой сессии. Обновите редактор.";
  }
  if (code === "attestation_ticket_capacity") {
    return "Для выбранного плана не хватает активных вопросов в одной из тем.";
  }
  if (code === "attestation_ticket_total_invalid") {
    return "В активной категории сумма вопросов по темам должна совпадать с размером билета.";
  }
  if (code === "attestation_ticket_plan_duplicate") {
    return "В одной категории одна и та же тема добавлена в план дважды.";
  }
  if (code === "attestation_ticket_plan_invalid") {
    return "План билета заполнен некорректно. Проверьте темы и количество вопросов.";
  }
  if (code === "attestation_category_not_ready") {
    return "Категорию пока нельзя включить: сначала соберите полный план и добавьте достаточно активных вопросов.";
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
  if (code === "attestation_category_sort_invalid") {
    return "Порядок категории указан некорректно.";
  }
  if (code === "attestation_pass_percent_invalid") {
    return "Порог прохождения должен быть от 50 до 100%.";
  }
  if (code === "attestation_question_count_invalid") {
    return "Количество вопросов в билете должно быть от 1 до 50.";
  }
  if (code === "forbidden") {
    return "Недостаточно прав для изменения настроек аттестации.";
  }

  return "Изменение не сохранено. Проверьте соединение и повторите.";
}

function draftCategories(bank: AttestationEditorBank): CategoryDraft[] {
  return bank.categories.map((category) => ({
    ...category,
    plan: category.ticketPlan.map((item) => ({
      key: rowKey(),
      topic: item.topic,
      count: item.count
    }))
  }));
}

function settingsSignature(
  passPercent: number,
  questionsPerTest: number,
  categories: CategoryDraft[]
) {
  return JSON.stringify({
    passPercent,
    questionsPerTest,
    ticketPlan: categories.flatMap((category) =>
      category.plan.map((item, index) => ({
        categoryId: category.id,
        topic: item.topic.trim(),
        count: Number(item.count),
        sortOrder: (index + 1) * 10
      }))
    )
  });
}

export function AttestationSettingsAdminPanel() {
  const [bank, setBank] = useState<AttestationEditorBank | null>(null);
  const [passPercent, setPassPercent] = useState(80);
  const [questionsPerTest, setQuestionsPerTest] = useState(15);
  const [categories, setCategories] = useState<CategoryDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [message, setMessage] = useState<ActionMessage>(null);

  async function load() {
    setLoading(true);
    setMessage(null);

    try {
      const next = await loadAttestationEditorBank(false);
      setBank(next);
      setPassPercent(next.settings.passPercent);
      setQuestionsPerTest(next.settings.questionsPerTest);
      setCategories(draftCategories(next));
    } catch {
      setMessage({
        tone: "error",
        text: "Не удалось загрузить настройки аттестации."
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const originalSignature = useMemo(() => {
    if (!bank) return "";
    return settingsSignature(
      bank.settings.passPercent,
      bank.settings.questionsPerTest,
      draftCategories(bank)
    );
  }, [bank]);

  const currentSignature = useMemo(
    () => settingsSignature(passPercent, questionsPerTest, categories),
    [passPercent, questionsPerTest, categories]
  );

  const settingsDirty = Boolean(bank) && currentSignature !== originalSignature;

  const metadataDirtyIds = useMemo(() => {
    if (!bank) return new Set<string>();
    const original = new Map(bank.categories.map((category) => [category.id, category]));
    return new Set(
      categories
        .filter((category) => {
          const value = original.get(category.id);
          return Boolean(
            value &&
            (value.label !== category.label || value.sortOrder !== category.sortOrder)
          );
        })
        .map((category) => category.id)
    );
  }, [bank, categories]);

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
      result.set(
        category.id,
        [...new Set(values)].sort((a, b) => a.localeCompare(b, "ru"))
      );
    }

    return result;
  }, [bank]);

  function updateCategory(
    categoryId: string,
    patch: Partial<Pick<CategoryDraft, "label" | "sortOrder">>
  ) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId
          ? { ...category, ...patch }
          : category
      )
    );
  }

  function addPlanRow(categoryId: string) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              plan: [
                ...category.plan,
                { key: rowKey(), topic: "", count: 1 }
              ]
            }
          : category
      )
    );
  }

  function updatePlanRow(
    categoryId: string,
    row: string,
    patch: Partial<Pick<PlanDraft, "topic" | "count">>
  ) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              plan: category.plan.map((item) =>
                item.key === row ? { ...item, ...patch } : item
              )
            }
          : category
      )
    );
  }

  function removePlanRow(categoryId: string, row: string) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              plan: category.plan.filter((item) => item.key !== row)
            }
          : category
      )
    );
  }

  function validateSettings() {
    if (!Number.isInteger(passPercent) || passPercent < 50 || passPercent > 100) {
      return "Порог прохождения должен быть целым числом от 50 до 100%.";
    }

    if (
      !Number.isInteger(questionsPerTest) ||
      questionsPerTest < 1 ||
      questionsPerTest > 50
    ) {
      return "Количество вопросов в билете должно быть целым числом от 1 до 50.";
    }

    for (const category of categories) {
      const seen = new Set<string>();

      for (const item of category.plan) {
        const topic = item.topic.trim();
        if (!topic || topic.length > 120) {
          return `Категория «${category.label}»: заполните название каждой темы.`;
        }
        if (!Number.isInteger(item.count) || item.count < 1 || item.count > 50) {
          return `Категория «${category.label}»: количество вопросов по теме должно быть от 1 до 50.`;
        }

        const normalized = topic.toLocaleLowerCase("ru");
        if (seen.has(normalized)) {
          return `Категория «${category.label}»: тема «${topic}» добавлена дважды.`;
        }
        seen.add(normalized);
      }

      if (!category.active) continue;

      const total = category.plan.reduce((sum, item) => sum + item.count, 0);
      if (total !== questionsPerTest) {
        return `Категория «${category.label}»: в плане ${total} вопросов, а в билете должно быть ${questionsPerTest}.`;
      }

      for (const item of category.plan) {
        const available =
          capacity.get(`${category.id}\u0000${item.topic.trim()}`) || 0;
        if (available < item.count) {
          return `Категория «${category.label}», тема «${item.topic.trim()}»: доступно ${available}, нужно ${item.count}.`;
        }
      }
    }

    return "";
  }

  async function saveSettings() {
    if (!bank) return;

    if (metadataDirtyIds.size) {
      setMessage({
        tone: "error",
        text: "Сначала сохраните изменённые названия и порядок категорий."
      });
      return;
    }

    const validation = validateSettings();
    if (validation) {
      setMessage({ tone: "error", text: validation });
      return;
    }

    setSavingSettings(true);
    setMessage(null);

    try {
      await saveAttestationEditorSettings({
        passPercent,
        questionsPerTest,
        expectedRevision: bank.settings.revision,
        ticketPlan: categories.flatMap((category) =>
          category.plan.map((item, index) => ({
            categoryId: category.id,
            topic: item.topic.trim(),
            count: item.count,
            sortOrder: (index + 1) * 10
          }))
        )
      });
      await load();
      setMessage({ tone: "success", text: "Настройки и план билета сохранены." });
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
    if (settingsDirty || metadataDirtyIds.size) {
      setMessage({
        tone: "error",
        text: "Сначала сохраните или сбросьте текущие изменения редактора."
      });
      return;
    }

    setPendingCategoryId("new");
    setMessage(null);
    try {
      await saveAttestationCategory({ label });
      setNewCategory("");
      await load();
      setMessage({
        tone: "success",
        text: "Категория создана как черновик. Добавьте вопросы и план, затем включите её."
      });
    } catch (error) {
      setMessage({ tone: "error", text: editorErrorText(error) });
    } finally {
      setPendingCategoryId("");
    }
  }

  async function saveCategory(category: CategoryDraft) {
    if (settingsDirty) {
      setMessage({
        tone: "error",
        text: "Сначала сохраните или сбросьте изменения плана билета."
      });
      return;
    }

    if ([...metadataDirtyIds].some((id) => id !== category.id)) {
      setMessage({
        tone: "error",
        text: "Сохраните изменения других категорий отдельно, чтобы они не потерялись при обновлении."
      });
      return;
    }

    if (!category.updatedAt) {
      setMessage({ tone: "error", text: "Обновите редактор и повторите." });
      return;
    }

    setPendingCategoryId(category.id);
    setMessage(null);
    try {
      await saveAttestationCategory(
        {
          id: category.id,
          label: category.label.trim(),
          sortOrder: Number(category.sortOrder)
        },
        category.updatedAt
      );
      await load();
      setMessage({ tone: "success", text: "Категория сохранена." });
    } catch (error) {
      setMessage({ tone: "error", text: editorErrorText(error) });
    } finally {
      setPendingCategoryId("");
    }
  }

  async function toggleCategory(category: CategoryDraft) {
    if (settingsDirty) {
      setMessage({
        tone: "error",
        text: "Сначала сохраните или сбросьте изменения плана билета."
      });
      return;
    }

    if (metadataDirtyIds.size) {
      setMessage({
        tone: "error",
        text: "Сначала сохраните изменённые названия и порядок категорий."
      });
      return;
    }

    if (!category.updatedAt) {
      setMessage({ tone: "error", text: "Обновите редактор и повторите." });
      return;
    }

    setPendingCategoryId(category.id);
    setMessage(null);
    try {
      await setAttestationCategoryStatus(
        category.id,
        !category.active,
        category.updatedAt
      );
      await load();
      setMessage({
        tone: "success",
        text: category.active
          ? "Категория отключена и скрыта из аттестации."
          : "Категория включена в аттестацию."
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
          <RefreshCw className="size-4" aria-hidden />
          Повторить
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
              <Settings2 className="size-5" aria-hidden />
              Правила аттестации
            </h3>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Сбросить несохранённые изменения"
            disabled={!settingsDirty || savingSettings}
            onClick={() => void load()}
          >
            <RefreshCw className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs font-bold text-[var(--bf-muted)]">
            Порог прохождения, %
            <input
              type="number"
              min={50}
              max={100}
              step={1}
              value={passPercent}
              onChange={(event) => setPassPercent(Number(event.target.value))}
              className="min-h-12 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-[16px] font-black text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
            />
          </label>

          <label className="grid gap-1 text-xs font-bold text-[var(--bf-muted)]">
            Вопросов в билете
            <input
              type="number"
              min={1}
              max={50}
              step={1}
              value={questionsPerTest}
              onChange={(event) => setQuestionsPerTest(Number(event.target.value))}
              className="min-h-12 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-[16px] font-black text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
            />
          </label>
        </div>

        <p className="mt-3 text-xs leading-5 text-[var(--bf-dim)]">
          Для каждой включённой категории сумма вопросов по темам должна точно совпадать с размером билета.
        </p>
      </Surface>

      <Surface className="p-4">
        <p className="eyebrow">КАТЕГОРИИ</p>
        <h3 className="mt-1 text-xl font-black">Категории и план билета</h3>

        <div className="mt-4 flex gap-2">
          <input
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            placeholder="Новая категория"
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-[16px] text-[var(--bf-cream)] outline-none placeholder:text-[var(--bf-dim)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
          />
          <Button
            type="button"
            variant="primary"
            disabled={pendingCategoryId === "new"}
            onClick={() => void createCategory()}
          >
            {pendingCategoryId === "new" ? (
              <RefreshCw className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            Создать
          </Button>
        </div>

        <div className="mt-4 grid gap-3">
          {categories.map((category) => {
            const total = category.plan.reduce((sum, item) => sum + item.count, 0);
            const totalOk = !category.active || total === questionsPerTest;
            const topics = categoryTopics.get(category.id) || [];

            return (
              <div
                key={category.id}
                className="rounded-[18px] border border-[var(--bf-line)] bg-[var(--bf-surface-2)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[.06em]",
                          category.active
                            ? "border-[color:color-mix(in_srgb,var(--bf-green),transparent_50%)] text-[#9dd0a0]"
                            : "border-[var(--bf-line)] text-[var(--bf-dim)]"
                        )}
                      >
                        {category.active ? "Включена" : "Черновик"}
                      </span>
                      <span className="text-[10px] text-[var(--bf-dim)]">
                        {category.id}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-[1fr_90px] gap-2">
                      <label className="grid gap-1 text-[11px] font-bold text-[var(--bf-muted)]">
                        Название
                        <input
                          value={category.label}
                          onChange={(event) => updateCategory(category.id, { label: event.target.value })}
                          className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] px-3 text-[15px] font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
                        />
                      </label>

                      <label className="grid gap-1 text-[11px] font-bold text-[var(--bf-muted)]">
                        Порядок
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={category.sortOrder}
                          onChange={(event) => updateCategory(category.id, { sortOrder: Number(event.target.value) })}
                          className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] px-2 text-[15px] font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pendingCategoryId === category.id}
                    onClick={() => void saveCategory(category)}
                  >
                    <Save className="size-4" aria-hidden />
                    Название и порядок
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pendingCategoryId === category.id}
                    onClick={() => void toggleCategory(category)}
                  >
                    {category.active ? (
                      <Archive className="size-4" aria-hidden />
                    ) : (
                      <RotateCcw className="size-4" aria-hidden />
                    )}
                    {category.active ? "Отключить" : "Включить"}
                  </Button>
                </div>

                <div className="mt-4 border-t border-[var(--bf-line)] pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-[var(--bf-cream)]">План билета</p>
                      <p className={cn("mt-0.5 text-[11px]", totalOk ? "text-[var(--bf-dim)]" : "text-[#e99990]")}> 
                        {total} / {questionsPerTest} вопросов
                      </p>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => addPlanRow(category.id)}>
                      <Plus className="size-4" aria-hidden />
                      Тема
                    </Button>
                  </div>

                  <datalist id={`attestation-plan-topics-${category.id}`}>
                    {topics.map((topic) => <option key={topic} value={topic} />)}
                  </datalist>

                  <div className="mt-2 grid gap-2">
                    {category.plan.map((item) => {
                      const available = capacity.get(`${category.id}\u0000${item.topic.trim()}`) || 0;
                      const enough = !item.topic.trim() || available >= item.count;

                      return (
                        <div key={item.key} className="grid grid-cols-[1fr_72px_42px] gap-2">
                          <label className="grid gap-1 text-[10px] font-bold text-[var(--bf-dim)]">
                            Тема
                            <input
                              value={item.topic}
                              list={`attestation-plan-topics-${category.id}`}
                              onChange={(event) => updatePlanRow(category.id, item.key, { topic: event.target.value })}
                              className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] px-3 text-[14px] text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
                            />
                            {item.topic.trim() ? (
                              <span className={cn("px-1", enough ? "text-[var(--bf-dim)]" : "text-[#e99990]")}> 
                                доступно {available}
                              </span>
                            ) : null}
                          </label>

                          <label className="grid gap-1 text-[10px] font-bold text-[var(--bf-dim)]">
                            Вопросов
                            <input
                              type="number"
                              min={1}
                              max={50}
                              step={1}
                              value={item.count}
                              onChange={(event) => updatePlanRow(category.id, item.key, { count: Number(event.target.value) })}
                              className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] px-2 text-center text-[14px] font-black text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
                            />
                          </label>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-[18px]"
                            aria-label={`Удалить тему ${item.topic || "из плана"}`}
                            onClick={() => removePlanRow(category.id, item.key)}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </div>
                      );
                    })}

                    {!category.plan.length ? (
                      <div className="flex items-start gap-2 rounded-xl border border-dashed border-[var(--bf-line)] p-3 text-xs text-[var(--bf-dim)]">
                        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                        Добавьте темы и количество вопросов. Черновую категорию можно заполнять до включения.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Surface>

      <p
        className={cn(
          "min-h-5 px-1 text-xs leading-5",
          message?.tone === "error" ? "text-[#e99990]" : "text-[#9dd0a0]"
        )}
        role="status"
        aria-live="polite"
      >
        {message?.text || ""}
      </p>

      <Button
        type="button"
        variant="primary"
        size="lg"
        disabled={!settingsDirty || savingSettings}
        onClick={() => void saveSettings()}
      >
        {savingSettings ? (
          <RefreshCw className="size-4 animate-spin" aria-hidden />
        ) : (
          <Save className="size-4" aria-hidden />
        )}
        {savingSettings ? "Сохраняем…" : "Сохранить правила и план"}
      </Button>
    </section>
  );
}
