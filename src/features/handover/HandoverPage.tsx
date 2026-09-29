import {
  AlertTriangle,
  Loader2,
  Plus,
  RefreshCw,
  StickyNote
} from "lucide-react";
import {
  useMemo,
  useState,
  type FormEvent
} from "react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import {
  acknowledgeHandover,
  createHandover,
  resolveHandover
} from "@/features/handover/handover-api";
import {
  HandoverNoteCard
} from "@/features/handover/HandoverNoteCard";
import {
  useHandoverFeed
} from "@/features/handover/use-handover-feed";
import type {
  HandoverCategory,
  HandoverNote,
  HandoverPriority
} from "@/features/handover/types";
import { cn } from "@/lib/utils";

const CATEGORIES: Array<{
  value: HandoverCategory;
  label: string;
}> = [
  { value: "bar", label: "Бар" },
  { value: "kitchen", label: "Кухня" },
  { value: "hall", label: "Зал" },
  {
    value: "equipment",
    label: "Оборудование"
  },
  {
    value: "purchasing",
    label: "Закупки"
  },
  { value: "other", label: "Другое" }
];

type StatusFilter =
  | "active"
  | "resolved"
  | "all";

export function HandoverPage() {
  const {
    notes,
    loading,
    refreshing,
    error,
    refresh
  } = useHandoverFeed();

  const [body, setBody] = useState("");
  const [category, setCategory] =
    useState<HandoverCategory>("bar");
  const [priority, setPriority] =
    useState<HandoverPriority>("normal");
  const [categoryFilter, setCategoryFilter] =
    useState<HandoverCategory | "all">("all");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("active");
  const [submitting, setSubmitting] =
    useState(false);
  const [pendingIds, setPendingIds] =
    useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const filtered = useMemo(
    () =>
      notes.filter((note) => {
        const categoryOk =
          categoryFilter === "all" ||
          note.category === categoryFilter;

        const statusOk =
          statusFilter === "all" ||
          (statusFilter === "active" &&
            note.status !== "resolved") ||
          (statusFilter === "resolved" &&
            note.status === "resolved");

        return categoryOk && statusOk;
      }),
    [
      notes,
      categoryFilter,
      statusFilter
    ]
  );

  async function submitNote(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmed = body.trim();

    if (!trimmed || submitting) return;

    setSubmitting(true);
    setMessage(null);

    try {
      await createHandover({
        body: trimmed,
        category,
        priority
      });

      setBody("");
      setPriority("normal");
      setMessage({
        tone: "success",
        text: "Передача сохранена и видна всей команде."
      });

      await refresh(true);
    } catch {
      setMessage({
        tone: "error",
        text: "Не удалось сохранить передачу."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(
    note: HandoverNote,
    action: "ack" | "resolve"
  ) {
    if (pendingIds.has(note.id)) return;

    setPendingIds((current) => {
      const next = new Set(current);
      next.add(note.id);
      return next;
    });
    setMessage(null);

    try {
      if (action === "ack") {
        await acknowledgeHandover(note.id);
      } else {
        await resolveHandover(note.id);
      }

      setMessage({
        tone: "success",
        text:
          action === "ack"
            ? "Передача принята."
            : "Передача отмечена как решённая."
      });

      await refresh(true);
    } catch {
      setMessage({
        tone: "error",
        text: "Не удалось обновить передачу."
      });
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(note.id);
        return next;
      });
    }
  }

  return (
    <section className="bf-handover-page mx-auto max-w-3xl pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">
            ПЕРЕДАЧА СМЕНЫ
          </p>
          <h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">
            Что нельзя потерять
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--bf-muted)]">
            Общие рабочие заметки для всей команды.
            Все сотрудники видят одну и ту же ленту.
            История хранится 60 дней.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Обновить передачу"
          disabled={refreshing}
          onClick={() => void refresh(true)}
        >
          <RefreshCw
            className={cn(
              "size-4",
              refreshing && "animate-spin"
            )}
            aria-hidden
          />
        </Button>
      </div>

      <Surface className="mt-5 p-4">
        <form onSubmit={submitNote}>
          <div className="flex items-start gap-3">
            <StickyNote
              className="mt-0.5 size-5 shrink-0 text-[var(--bf-copper-hi)]"
              aria-hidden
            />
            <div>
              <p className="eyebrow">
                НОВАЯ ПЕРЕДАЧА
              </p>
              <h2 className="mt-1 text-xl font-black">
                Добавить заметку
              </h2>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--bf-dim)]">
                Категория
              </span>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target
                      .value as HandoverCategory
                  )
                }
                className="min-h-12 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-sm font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
              >
                {CATEGORIES.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--bf-dim)]">
                Приоритет
              </span>
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(
                    event.target
                      .value as HandoverPriority
                  )
                }
                className="min-h-12 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-sm font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
              >
                <option value="normal">
                  Обычная
                </option>
                <option value="high">
                  Важная
                </option>
                <option value="critical">
                  Критичная
                </option>
              </select>
            </label>
          </div>

          <label className="mt-3 grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--bf-dim)]">
              Передача
            </span>
            <textarea
              value={body}
              maxLength={2000}
              rows={5}
              placeholder="Например: кран №4 пенит, не использовать до проверки."
              onChange={(event) =>
                setBody(event.target.value)
              }
              className="min-h-32 resize-y rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3.5 py-3 text-[15px] leading-6 text-[var(--bf-cream)] outline-none placeholder:text-[var(--bf-dim)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
            />
          </label>

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--bf-dim)]">
              {body.length}/2000
            </span>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={
                !body.trim() || submitting
              }
            >
              {submitting ? (
                <Loader2
                  className="size-4 animate-spin"
                  aria-hidden
                />
              ) : (
                <Plus
                  className="size-4"
                  aria-hidden
                />
              )}
              {submitting
                ? "Сохраняем…"
                : "Добавить"}
            </Button>
          </div>
        </form>
      </Surface>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">
              ОБЩАЯ ЛЕНТА
            </p>
            <h2 className="mt-1 text-2xl font-black">
              Передача
            </h2>
          </div>
          <span className="rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface)] px-3 py-2 text-xs font-black">
            {filtered.length}
          </span>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 bf-scrollbar-none">
          <button
            type="button"
            onClick={() =>
              setCategoryFilter("all")
            }
            className={cn(
              "min-h-11 shrink-0 rounded-xl border px-3 text-sm font-bold",
              categoryFilter === "all"
                ? "border-[var(--bf-copper-hi)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_82%)] text-[var(--bf-cream)]"
                : "border-[var(--bf-line)] bg-[var(--bf-surface)] text-[var(--bf-muted)]"
            )}
          >
            Все
          </button>

          {CATEGORIES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() =>
                setCategoryFilter(item.value)
              }
              className={cn(
                "min-h-11 shrink-0 rounded-xl border px-3 text-sm font-bold",
                categoryFilter === item.value
                  ? "border-[var(--bf-copper-hi)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_82%)] text-[var(--bf-cream)]"
                  : "border-[var(--bf-line)] bg-[var(--bf-surface)] text-[var(--bf-muted)]"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface)] p-1.5">
          {(
            [
              ["active", "Активные"],
              ["resolved", "Решённые"],
              ["all", "Все"]
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                setStatusFilter(value)
              }
              className={cn(
                "min-h-11 rounded-xl border px-2 text-xs font-black",
                statusFilter === value
                  ? "border-[var(--bf-copper-hi)] bg-[var(--bf-surface-2)] text-[var(--bf-cream)]"
                  : "border-transparent text-[var(--bf-dim)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <p
          className={cn(
            "mt-3 min-h-5 text-xs leading-5",
            message?.tone === "error"
              ? "text-[#e99990]"
              : "text-[#9dd0a0]"
          )}
          role="status"
          aria-live="polite"
        >
          {message?.text || ""}
        </p>

        {loading ? (
          <div className="mt-2 grid gap-2">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-32 animate-pulse rounded-[20px] bg-[var(--bf-surface)]"
              />
            ))}
          </div>
        ) : error ? (
          <div className="mt-2 rounded-[20px] border border-[color:color-mix(in_srgb,var(--bf-red),transparent_58%)] bg-[color:color-mix(in_srgb,var(--bf-red),transparent_92%)] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 size-5 shrink-0 text-[#e99990]"
                aria-hidden
              />
              <div>
                <p className="text-sm leading-6 text-[var(--bf-muted)]">
                  {error}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  onClick={() =>
                    void refresh(false)
                  }
                >
                  <RefreshCw
                    className="size-4"
                    aria-hidden
                  />
                  Повторить
                </Button>
              </div>
            </div>
          </div>
        ) : filtered.length ? (
          <div className="mt-2 grid gap-2">
            {filtered.map((note) => (
              <HandoverNoteCard
                key={note.id}
                note={note}
                pending={pendingIds.has(
                  note.id
                )}
                onAcknowledge={(item) =>
                  void runAction(
                    item,
                    "ack"
                  )
                }
                onResolve={(item) =>
                  void runAction(
                    item,
                    "resolve"
                  )
                }
              />
            ))}
          </div>
        ) : (
          <Surface className="mt-2 p-5 text-center">
            <StickyNote
              className="mx-auto size-6 text-[var(--bf-dim)]"
              aria-hidden
            />
            <p className="mt-2 text-sm font-bold">
              Здесь пока ничего нет
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--bf-dim)]">
              Фильтр пуст или команда ещё не добавила передачу.
            </p>
          </Surface>
        )}
      </div>
    </section>
  );
}
