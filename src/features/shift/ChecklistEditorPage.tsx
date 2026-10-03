import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { useAuth } from "@/features/auth/auth-context";
import {
  checklistEditorError,
  deleteChecklistDefinition,
  loadChecklistEditorSnapshot,
  reorderChecklistDefinitions,
  saveChecklistDefinition,
  type ChecklistEditorCheckType,
  type ChecklistEditorRow,
  type ChecklistEditorSnapshot
} from "@/features/shift/checklist-editor-api";
import {
  canManageChecklistsClient,
  type StaffPosition
} from "@/types/auth";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS: Array<{
  value: ChecklistEditorCheckType;
  label: string;
}> = [
  { value: "general_cleaning", label: "Генуборка" },
  { value: "opening", label: "Открытие" },
  { value: "closing", label: "Закрытие" }
];

const WEEKDAYS = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 7, label: "Вс" }
];

type EditorDraft = {
  itemKey: string | null;
  label: string;
  checkType: ChecklistEditorCheckType;
  critical: boolean;
  isActive: boolean;
  activeIsoWeekdays: number[];
  groupKey: string;
  revision: number | null;
};

function blankDraft(type: ChecklistEditorCheckType): EditorDraft {
  return {
    itemKey: null,
    label: "",
    checkType: type,
    critical: false,
    isActive: true,
    activeIsoWeekdays:
      type === "general_cleaning"
        ? [7]
        : [1, 2, 3, 4, 5, 6, 7],
    groupKey: "",
    revision: null
  };
}

function rowDraft(row: ChecklistEditorRow): EditorDraft {
  return {
    itemKey: row.item_key,
    label: row.label,
    checkType: row.check_type,
    critical: row.critical,
    isActive: row.is_active,
    activeIsoWeekdays: [...row.active_iso_weekdays],
    groupKey: row.group_key || "",
    revision: row.revision
  };
}

function formatUpdated(row: ChecklistEditorRow) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Novosibirsk"
    }).format(new Date(row.updated_at));
  } catch {
    return "";
  }
}


type ChecklistDraftEditorProps = {
  draft: EditorDraft;
  setDraft: Dispatch<SetStateAction<EditorDraft | null>>;
  selectedPosition: StaffPosition | null;
  saving: boolean;
  inline?: boolean;
  message?: {
    tone: "success" | "error";
    text: string;
  } | null;
  onCancel: () => void;
  onSave: () => void;
};

function ChecklistDraftEditor({
  draft,
  setDraft,
  selectedPosition,
  saving,
  inline = false,
  message = null,
  onCancel,
  onSave
}: ChecklistDraftEditorProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">
            {draft.itemKey ? "РЕДАКТИРОВАНИЕ" : "НОВЫЙ ПУНКТ"}
          </p>
          <h2 className="mt-1 text-xl font-black">
            {draft.itemKey ? "Изменить пункт" : "Добавить пункт"}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Закрыть редактор пункта"
          onClick={onCancel}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <label className="mt-4 grid gap-1.5">
        <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--bf-dim)]">
          Текст пункта
        </span>
        <textarea
          rows={4}
          maxLength={500}
          value={draft.label}
          onChange={(event) =>
            setDraft((current) =>
              current ? { ...current, label: event.target.value } : current
            )
          }
          className="min-h-28 resize-y rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3.5 py-3 text-[15px] leading-6 text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
        />
      </label>

      <div className={cn("mt-3 grid gap-3", selectedPosition === "manager" && "sm:grid-cols-2")}>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--bf-dim)]">
            Раздел
          </span>
          <select
            value={draft.checkType}
            onChange={(event) => {
              const checkType = event.target.value as ChecklistEditorCheckType;
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      checkType,
                      activeIsoWeekdays:
                        checkType === "general_cleaning" && current.itemKey === null
                          ? [7]
                          : current.activeIsoWeekdays
                    }
                  : current
              );
            }}
            className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-sm font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
          >
            {TYPE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {selectedPosition === "manager" ? (
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--bf-dim)]">
              Заведение
            </span>
            <select
              value={draft.groupKey}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, groupKey: event.target.value } : current
                )
              }
              className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-sm font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
            >
              <option value="">Без группы</option>
              <option value="bf">BF</option>
              <option value="bb">BB</option>
            </select>
          </label>
        ) : null}
      </div>

      <div className="mt-3">
        <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--bf-dim)]">
          Дни недели
        </span>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((day) => {
            const active = draft.activeIsoWeekdays.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setDraft((current) => {
                    if (!current) return current;
                    const next = active
                      ? current.activeIsoWeekdays.filter((value) => value !== day.value)
                      : [...current.activeIsoWeekdays, day.value].sort((a, b) => a - b);
                    return { ...current, activeIsoWeekdays: next };
                  })
                }
                className={cn(
                  "min-h-10 rounded-xl border text-[11px] font-black",
                  active
                    ? "border-[var(--bf-copper-hi)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_82%)] text-[var(--bf-cream)]"
                    : "border-[var(--bf-line)] text-[var(--bf-dim)]"
                )}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3">
        <input
          type="checkbox"
          checked={draft.critical}
          onChange={(event) =>
            setDraft((current) =>
              current ? { ...current, critical: event.target.checked } : current
            )
          }
          className="size-4 accent-[var(--bf-copper)]"
        />
        <span className="text-sm font-bold">Критичный пункт</span>
      </label>

      {inline && message ? (
        <p
          className={cn(
            "mt-3 rounded-xl border px-3 py-2 text-xs leading-5",
            message.tone === "error"
              ? "border-[color:color-mix(in_srgb,var(--bf-red),transparent_55%)] text-[#9f302a]"
              : "border-[color:color-mix(in_srgb,var(--bf-green),transparent_55%)] text-[#376b3c]"
          )}
          role={message.tone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {message.text}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={saving}
          onClick={onCancel}
        >
          Отмена
        </Button>
        <Button
          type="button"
          variant="primary"
          className="flex-1"
          disabled={saving || !draft.label.trim()}
          onClick={onSave}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {saving ? "Сохраняем…" : "Сохранить"}
        </Button>
      </div>
    </>
  );

  if (inline) {
    return (
      <div className="bf-checklist-inline-editor" role="region" aria-label="Редактирование пункта">
        {content}
      </div>
    );
  }

  return <Surface className="mt-3 p-4">{content}</Surface>;
}

export function ChecklistEditorPage() {
  const { state } = useAuth();
  const canManageChecklists =
    state.status === "authenticated" &&
    canManageChecklistsClient(state.user);
  const currentPosition =
    state.status === "authenticated"
      ? state.user.position_code || null
      : null;

  const [snapshot, setSnapshot] =
    useState<ChecklistEditorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPosition, setSelectedPosition] =
    useState<StaffPosition | null>(null);
  const [selectedType, setSelectedType] =
    useState<ChecklistEditorCheckType>("opening");
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await loadChecklistEditorSnapshot();
      setSnapshot(data);
      setSelectedPosition((current) => {
        if (
          current &&
          data.positions.some((item) => item.code === current)
        ) {
          return current;
        }
        if (
          currentPosition &&
          data.positions.some((item) => item.code === currentPosition)
        ) {
          return currentPosition;
        }
        return data.positions[0]?.code || null;
      });
      if (!quiet) setMessage(null);
    } catch (error) {
      setMessage({
        tone: "error",
        text: checklistEditorError(error)
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPosition]);

  useEffect(() => {
    if (!canManageChecklists) return;
    void load(false);
  }, [canManageChecklists, load]);

  const positionLabel = useMemo(
    () =>
      snapshot?.positions.find(
        (item) => item.code === selectedPosition
      )?.label || "Должность",
    [snapshot?.positions, selectedPosition]
  );

  const rows = useMemo(() => {
    if (!snapshot || !selectedPosition) return [];
    return snapshot.rows
      .filter(
        (row) =>
          row.position_code === selectedPosition &&
          row.check_type === selectedType &&
          (showArchived || row.is_active)
      )
      .sort((a, b) => {
        if (a.is_active !== b.is_active) {
          return a.is_active ? -1 : 1;
        }
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return a.item_key.localeCompare(b.item_key);
      });
  }, [snapshot, selectedPosition, selectedType, showArchived]);

  const activeRows = useMemo(
    () => rows.filter((row) => row.is_active),
    [rows]
  );

  const archivedCount = useMemo(() => {
    if (!snapshot || !selectedPosition) return 0;
    return snapshot.rows.filter(
      (row) =>
        row.position_code === selectedPosition &&
        row.check_type === selectedType &&
        !row.is_active
    ).length;
  }, [snapshot, selectedPosition, selectedType]);

  function openNew() {
    setDraft(blankDraft(selectedType));
    setMessage(null);
  }

  function openEdit(row: ChecklistEditorRow) {
    setDraft((current) =>
      current?.itemKey === row.item_key ? null : rowDraft(row)
    );
    setMessage(null);
  }

  async function saveDraft() {
    if (!draft || !selectedPosition || saving) return;
    if (!draft.label.trim()) {
      setMessage({ tone: "error", text: "Введите текст пункта." });
      return;
    }
    if (!draft.activeIsoWeekdays.length) {
      setMessage({
        tone: "error",
        text: "Выберите хотя бы один день недели."
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await saveChecklistDefinition({
        positionCode: selectedPosition,
        itemKey: draft.itemKey,
        checkType: draft.checkType,
        label: draft.label,
        critical: draft.critical,
        isActive: draft.isActive,
        activeIsoWeekdays: draft.activeIsoWeekdays,
        groupKey: selectedPosition === "manager" ? draft.groupKey : null,
        groupLabel: null,
        expectedRevision: draft.revision
      });
      setSelectedType(draft.checkType);
      setDraft(null);
      setMessage({
        tone: "success",
        text: draft.itemKey
          ? "Пункт обновлён."
          : "Пункт добавлен."
      });
      await load(true);
    } catch (error) {
      setMessage({
        tone: "error",
        text: checklistEditorError(error)
      });
      if (String(error).includes("checklist_revision_conflict")) {
        await load(true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: ChecklistEditorRow) {
    if (pendingKey) return;
    setPendingKey(row.item_key);
    setMessage(null);
    try {
      await saveChecklistDefinition({
        positionCode: row.position_code,
        itemKey: row.item_key,
        checkType: row.check_type,
        label: row.label,
        critical: row.critical,
        isActive: !row.is_active,
        activeIsoWeekdays: row.active_iso_weekdays,
        groupKey: row.group_key,
        groupLabel: row.group_label,
        expectedRevision: row.revision
      });
      setMessage({
        tone: "success",
        text: row.is_active
          ? "Пункт отправлен в архив."
          : "Пункт восстановлен."
      });
      await load(true);
    } catch (error) {
      setMessage({
        tone: "error",
        text: checklistEditorError(error)
      });
      await load(true);
    } finally {
      setPendingKey(null);
    }
  }

  async function deleteRow(row: ChecklistEditorRow) {
    if (pendingKey) return;

    const confirmed = window.confirm(
      `Удалить пункт «${row.label}»? Это действие нельзя отменить.`
    );
    if (!confirmed) return;

    setPendingKey(row.item_key);
    setMessage(null);

    try {
      await deleteChecklistDefinition({
        positionCode: row.position_code,
        itemKey: row.item_key,
        expectedRevision: row.revision
      });
      if (draft?.itemKey === row.item_key) {
        setDraft(null);
      }
      setMessage({ tone: "success", text: "Пункт удалён." });
      await load(true);
    } catch (error) {
      setMessage({
        tone: "error",
        text: checklistEditorError(error)
      });
      await load(true);
    } finally {
      setPendingKey(null);
    }
  }

  async function moveRow(row: ChecklistEditorRow, delta: -1 | 1) {
    if (!selectedPosition || pendingKey) return;
    const index = activeRows.findIndex(
      (item) => item.item_key === row.item_key
    );
    const target = index + delta;
    if (index < 0 || target < 0 || target >= activeRows.length) return;

    const next = [...activeRows];
    [next[index], next[target]] = [next[target], next[index]];

    setPendingKey(row.item_key);
    setMessage(null);
    try {
      await reorderChecklistDefinitions({
        positionCode: selectedPosition,
        checkType: selectedType,
        itemKeys: next.map((item) => item.item_key)
      });
      setMessage({ tone: "success", text: "Порядок сохранён." });
      await load(true);
    } catch (error) {
      setMessage({
        tone: "error",
        text: checklistEditorError(error)
      });
      await load(true);
    } finally {
      setPendingKey(null);
    }
  }

  if (!canManageChecklists) {
    return (
      <section className="mx-auto max-w-2xl pb-6">
        <p className="eyebrow">РЕДАКТОР ЧЕК-ЛИСТОВ</p>
        <h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">
          Недостаточно прав
        </h1>
        <Surface className="mt-5 p-5">
          <p className="text-sm leading-6 text-[var(--bf-muted)]">
            Редактор недоступен.
          </p>
          <Button asChild variant="secondary" className="mt-4">
            <Link to="/shift">Вернуться к смене</Link>
          </Button>
        </Surface>
      </section>
    );
  }

  if (loading && !snapshot) {
    return (
      <section className="mx-auto max-w-3xl pb-6">
        <div className="h-10 w-52 animate-pulse rounded-xl bg-[var(--bf-surface)]" />
        <div className="mt-5 h-28 animate-pulse rounded-[22px] bg-[var(--bf-surface)]" />
        <div className="mt-3 h-72 animate-pulse rounded-[22px] bg-[var(--bf-surface)]" />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">СМЕНА · РЕДАКТОР</p>
          <h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">
            Редактор чек-листов
          </h1>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button asChild variant="secondary" size="icon" aria-label="Назад к смене">
            <Link to="/shift">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Обновить редактор"
            disabled={refreshing || saving || Boolean(pendingKey)}
            onClick={() => void load(true)}
          >
            <RefreshCw
              className={cn("size-4", refreshing && "animate-spin")}
              aria-hidden
            />
          </Button>
        </div>
      </div>

      <Surface className="mt-5 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <Settings2 className="size-5 text-[var(--bf-copper-hi)]" aria-hidden />
          <strong className="text-sm">Выбор чек-листа</strong>
        </div>

        <label className="mt-3 grid gap-1.5">
          <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--bf-dim)]">
            Должность
          </span>
          <div className="relative">
            <select
              value={selectedPosition || ""}
              aria-label="Должность"
              onChange={(event) => {
                setSelectedPosition(event.target.value as StaffPosition);
                setDraft(null);
                setShowArchived(false);
                setMessage(null);
              }}
              className="h-11 min-h-11 w-full appearance-none rounded-xl border border-[var(--bf-line-strong)] bg-[var(--bf-surface-2)] px-4 pr-12 text-base font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
            >
              {snapshot?.positions.map((position) => (
                <option key={position.code} value={position.code}>
                  {position.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-[var(--bf-muted)]"
              aria-hidden
            />
          </div>
        </label>

        <label className="mt-3 grid gap-1.5">
          <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--bf-dim)]">
            Чек-лист
          </span>
          <div className="relative">
            <select
              value={selectedType}
              aria-label="Тип чек-листа"
              onChange={(event) => {
                setSelectedType(event.target.value as ChecklistEditorCheckType);
                setDraft(null);
                setShowArchived(false);
                setMessage(null);
              }}
              className="h-11 min-h-11 w-full appearance-none rounded-xl border border-[var(--bf-line-strong)] bg-[var(--bf-surface-2)] px-4 pr-12 text-base font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-[var(--bf-muted)]"
              aria-hidden
            />
          </div>
        </label>
      </Surface>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[var(--bf-cream)]">
            {positionLabel} · {TYPE_OPTIONS.find((item) => item.value === selectedType)?.label}
          </p>
          <p className="mt-1 text-xs text-[var(--bf-dim)]">
            Активных: {activeRows.length}
            {archivedCount ? ` · в архиве: ${archivedCount}` : ""}
          </p>
        </div>

        <Button type="button" variant="primary" onClick={openNew}>
          <Plus className="size-4" aria-hidden />
          Добавить
        </Button>
      </div>

      {draft?.itemKey === null ? (
        <ChecklistDraftEditor
          draft={draft}
          setDraft={setDraft}
          selectedPosition={selectedPosition}
          saving={saving}
          onCancel={() => setDraft(null)}
          onSave={() => void saveDraft()}
        />
      ) : null}

      <p
        className={cn(
          "mt-3 min-h-5 text-xs leading-5",
          message?.tone === "error" ? "text-[#e99990]" : "text-[#9dd0a0]"
        )}
        role="status"
        aria-live="polite"
      >
        {message?.text || ""}
      </p>

      {!rows.length ? (
        <Surface className="mt-2 p-5 text-center">
          <Sparkles className="mx-auto size-6 text-[var(--bf-dim)]" aria-hidden />
          <p className="mt-2 text-sm font-bold">Пунктов пока нет</p>
          <p className="mt-1 text-xs leading-5 text-[var(--bf-dim)]">
            Добавьте первый пункт.
          </p>
        </Surface>
      ) : (
        <div className="mt-2 grid gap-2">
          {rows.map((row, rowIndex) => {
            const activeIndex = activeRows.findIndex(
              (item) => item.item_key === row.item_key
            );
            const busy = pendingKey === row.item_key;
            const editing = draft?.itemKey === row.item_key;
            const editorId = `checklist-item-editor-${rowIndex}-${row.item_key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

            return (
              <Surface
                key={`${row.position_code}:${row.item_key}`}
                className={cn("p-3.5", !row.is_active && "opacity-65")}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border",
                      row.is_active
                        ? "border-[color:color-mix(in_srgb,var(--bf-green),transparent_55%)] bg-[color:color-mix(in_srgb,var(--bf-green),transparent_88%)] text-[#b7e3ba]"
                        : "border-[var(--bf-line)] bg-[var(--bf-surface-2)] text-[var(--bf-dim)]"
                    )}
                  >
                    {row.is_active ? (
                      <Check className="size-4" aria-hidden />
                    ) : (
                      <Archive className="size-4" aria-hidden />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.group_label ? (
                        <span className="rounded-full border border-[var(--bf-line)] px-2 py-1 text-[10px] font-black text-[var(--bf-muted)]">
                          {row.group_label}
                        </span>
                      ) : null}
                      {row.critical ? (
                        <span className="rounded-full border border-[color:color-mix(in_srgb,var(--bf-red),transparent_55%)] px-2 py-1 text-[10px] font-black text-[#e99990]">
                          КРИТИЧНЫЙ
                        </span>
                      ) : null}
                      {!row.is_active ? (
                        <span className="rounded-full border border-[var(--bf-line)] px-2 py-1 text-[10px] font-black text-[var(--bf-dim)]">
                          АРХИВ
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm font-black leading-5 text-[var(--bf-cream)]">
                      {row.label}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-[var(--bf-dim)]">
                      Ревизия {row.revision}
                      {row.updated_by_name ? ` · ${row.updated_by_name}` : ""}
                      {formatUpdated(row) ? ` · ${formatUpdated(row)}` : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Поднять пункт"
                    disabled={!row.is_active || activeIndex <= 0 || Boolean(pendingKey)}
                    onClick={() => void moveRow(row, -1)}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Опустить пункт"
                    disabled={
                      !row.is_active ||
                      activeIndex < 0 ||
                      activeIndex >= activeRows.length - 1 ||
                      Boolean(pendingKey)
                    }
                    onClick={() => void moveRow(row, 1)}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant={editing ? "primary" : "secondary"}
                    size="icon"
                    aria-label={editing ? "Закрыть редактор пункта" : "Редактировать пункт"}
                    aria-expanded={editing}
                    aria-controls={editorId}
                    disabled={Boolean(pendingKey)}
                    onClick={() => openEdit(row)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="icon"
                    aria-label="Удалить пункт"
                    disabled={Boolean(pendingKey)}
                    onClick={() => void deleteRow(row)}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-4" aria-hidden />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant={row.is_active ? "danger" : "secondary"}
                    size="icon"
                    aria-label={row.is_active ? "Архивировать пункт" : "Восстановить пункт"}
                    disabled={Boolean(pendingKey)}
                    onClick={() => void toggleActive(row)}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : row.is_active ? (
                      <Archive className="size-4" aria-hidden />
                    ) : (
                      <RotateCcw className="size-4" aria-hidden />
                    )}
                  </Button>
                </div>

                {editing && draft ? (
                  <div id={editorId}>
                    <ChecklistDraftEditor
                      draft={draft}
                      setDraft={setDraft}
                      selectedPosition={selectedPosition}
                      saving={saving}
                      inline
                      message={message}
                      onCancel={() => setDraft(null)}
                      onSave={() => void saveDraft()}
                    />
                  </div>
                ) : null}
              </Surface>
            );
          })}
        </div>
      )}

      {archivedCount ? (
        <button
          type="button"
          onClick={() => setShowArchived((current) => !current)}
          className="mt-3 min-h-11 w-full rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] px-3 text-xs font-black text-[var(--bf-muted)]"
        >
          {showArchived ? "Скрыть архив" : `Показать архив (${archivedCount})`}
        </button>
      ) : null}

    </section>
  );
}
