import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Loader2,
  LockKeyhole,
  RefreshCw,
  StickyNote
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  confirmPositionShift,
  loadPositionShiftWorkflow,
  setPositionShiftCheck,
  shiftErrorMessage
} from "@/features/shift/shift-api";
import type {
  PositionShiftRow,
  PositionShiftWorkflow,
  ShiftCheckType
} from "@/features/shift/types";
import { cn } from "@/lib/utils";

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: PositionShiftWorkflow };

type StatusMessage = {
  text: string;
  tone: "success" | "error";
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      weekday: "short",
      day: "2-digit",
      month: "long"
    }).format(new Date(`${value}T12:00:00+07:00`));
  } catch {
    return value;
  }
}

function formatTime(
  value: string | null,
  timeZone: string
) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function formatDateTime(
  value: string | null,
  timeZone: string
) {
  if (!value) return "11:00";

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone
    }).format(new Date(value));
  } catch {
    return "11:00";
  }
}

function phaseProgress(
  rows: PositionShiftRow[],
  type: ShiftCheckType
) {
  const list = rows.filter(
    (row) => row.check_type === type
  );
  const completed = list.filter(
    (row) => row.check?.completed
  ).length;

  return {
    list,
    completed,
    total: list.length,
    percent: list.length
      ? Math.round((completed / list.length) * 100)
      : 0
  };
}

function ProgressBar({
  value,
  label
}: {
  value: number;
  label: string;
}) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-[var(--bf-surface-2)]"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div
        className="h-full rounded-full bg-[var(--bf-copper-hi)] transition-[width] duration-200"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function ChecklistRow({
  row,
  locked,
  pending,
  onToggle
}: {
  row: PositionShiftRow;
  locked: boolean;
  pending: boolean;
  onToggle: (
    row: PositionShiftRow,
    completed: boolean
  ) => void;
}) {
  const checked = Boolean(row.check?.completed);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-busy={pending}
      disabled={locked || pending}
      onClick={() => onToggle(row, !checked)}
      className={cn(
        "bf-check-row grid min-h-[60px] w-full grid-cols-[30px_1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left outline-none transition-[background-color,border-color,opacity,transform] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)] active:translate-y-px disabled:cursor-default",
        checked
          ? "border-[color:color-mix(in_srgb,var(--bf-green),transparent_58%)] bg-[color:color-mix(in_srgb,var(--bf-green),transparent_91%)]"
          : row.critical
            ? "border-[color:color-mix(in_srgb,var(--bf-gold),transparent_72%)] bg-[var(--bf-surface)]"
            : "border-[var(--bf-line)] bg-[var(--bf-surface)]",
        pending && "opacity-85"
      )}
    >
      <span
        className={cn(
          "grid size-7 place-items-center rounded-lg border",
          checked
            ? "border-[color:color-mix(in_srgb,var(--bf-green),transparent_35%)] bg-[color:color-mix(in_srgb,var(--bf-green),transparent_76%)] text-[#b7e3ba]"
            : "border-[var(--bf-line-strong)] bg-[var(--bf-surface-2)] text-[var(--bf-dim)]"
        )}
        aria-hidden
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : checked ? (
          <Check className="size-4" />
        ) : null}
      </span>

      <span className="min-w-0">
        <strong className="block text-[14px] leading-5 text-[var(--bf-cream)]">
          {row.label}
        </strong>
        {row.critical ? (
          <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--bf-gold)]">
            Критичный пункт
          </span>
        ) : null}
      </span>

      {checked ? (
        <CheckCircle2
          className="size-4 text-[var(--bf-green)]"
          aria-hidden
        />
      ) : null}
    </button>
  );
}

function ActivePhase({
  type,
  rows,
  completed,
  total,
  percent,
  locked,
  pendingKeys,
  confirming,
  onToggle,
  onConfirm
}: {
  type: ShiftCheckType;
  rows: PositionShiftRow[];
  completed: number;
  total: number;
  percent: number;
  locked: boolean;
  pendingKeys: ReadonlySet<string>;
  confirming: "open" | "close" | null;
  onToggle: (
    row: PositionShiftRow,
    completed: boolean
  ) => void;
  onConfirm: () => void;
}) {
  const opening = type === "opening";
  const allDone =
    total > 0 && completed === total;

  return (
    <section className="bf-active-phase rounded-[22px] border border-[var(--bf-line)] bg-[var(--bf-surface)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">
            {opening ? "ОТКРЫТИЕ" : "ЗАКРЫТИЕ"}
          </p>
          <h2 className="mt-1 text-2xl font-black">
            {opening
              ? "Чек-лист открытия смены"
              : "Чек-лист закрытия смены"}
          </h2>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--bf-line)] px-3 py-2 text-xs font-black text-[var(--bf-cream)]">
          {completed}/{total}
        </span>
      </div>

      <div className="mt-4">
        <ProgressBar
          value={percent}
          label={
            opening
              ? "Прогресс открытия смены"
              : "Прогресс закрытия смены"
          }
        />
        <div className="mt-2 flex justify-between text-[11px] text-[var(--bf-dim)]">
          <span>Выполнено</span>
          <span>{percent}%</span>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {rows.map((row) => {
          const key =
            `${row.check_type}:${row.item_key}`;

          return (
            <ChecklistRow
              key={key}
              row={row}
              locked={locked}
              pending={pendingKeys.has(key)}
              onToggle={onToggle}
            />
          );
        })}
      </div>

      <Button
        type="button"
        variant="primary"
        size="lg"
        className="mt-4 w-full"
        disabled={
          !allDone ||
          locked ||
          confirming !== null ||
          pendingKeys.size > 0
        }
        onClick={onConfirm}
      >
        {confirming ? (
          <Loader2
            className="size-4 animate-spin"
            aria-hidden
          />
        ) : (
          <ClipboardCheck
            className="size-4"
            aria-hidden
          />
        )}
        {confirming
          ? opening
            ? "Открываем…"
            : "Закрываем…"
          : opening
            ? "Подтвердить открытие смены"
            : "Подтвердить закрытие смены"}
      </Button>

      {!allDone ? (
        <p className="mt-2 text-center text-xs leading-5 text-[var(--bf-dim)]">
          Сначала выполните все активные пункты чек-листа.
        </p>
      ) : null}
    </section>
  );
}

export function ShiftPage() {
  const [view, setView] = useState<ViewState>({
    status: "loading"
  });
  const [refreshing, setRefreshing] =
    useState(false);
  const [pendingKeys, setPendingKeys] =
    useState<Set<string>>(() => new Set());
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const mutationVersionRef = useRef(0);
  const [confirming, setConfirming] =
    useState<"open" | "close" | null>(null);
  const [message, setMessage] =
    useState<StatusMessage | null>(null);

  const load = useCallback(async (quiet = false) => {
    const versionAtStart = mutationVersionRef.current;

    if (quiet) setRefreshing(true);
    else setView({ status: "loading" });

    try {
      const data =
        await loadPositionShiftWorkflow();

      if (versionAtStart === mutationVersionRef.current) {
        setView({ status: "ready", data });
        if (!quiet) setMessage(null);
      }
    } catch (error) {
      if (versionAtStart === mutationVersionRef.current) {
        setView({
          status: "error",
          message: shiftErrorMessage(error)
        });
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const refresh = () => void load(true);
    const visibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", refresh);
    document.addEventListener(
      "visibilitychange",
      visibility
    );

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener(
        "visibilitychange",
        visibility
      );
    };
  }, [load]);

  const data =
    view.status === "ready"
      ? view.data
      : null;

  const opening = useMemo(
    () =>
      data
        ? phaseProgress(data.rows, "opening")
        : {
            list: [],
            completed: 0,
            total: 0,
            percent: 0
          },
    [data]
  );

  const closing = useMemo(
    () =>
      data
        ? phaseProgress(data.rows, "closing")
        : {
            list: [],
            completed: 0,
            total: 0,
            percent: 0
          },
    [data]
  );

  const interactionLocked =
    refreshing ||
    confirming !== null;

  async function toggleCheck(
    row: PositionShiftRow,
    completed: boolean
  ) {
    if (!data || interactionLocked) return;

    const key =
      `${row.check_type}:${row.item_key}`;

    if (pendingKeysRef.current.has(key)) return;

    mutationVersionRef.current += 1;
    pendingKeysRef.current.add(key);
    setPendingKeys(new Set(pendingKeysRef.current));
    setMessage(null);

    try {
      const updated =
        await setPositionShiftCheck({
          checkType: row.check_type,
          itemKey: row.item_key,
          completed
        });

      setView((current) => {
        if (current.status !== "ready") {
          return current;
        }

        return {
          status: "ready",
          data: {
            ...current.data,
            rows: current.data.rows.map((item) =>
              item.check_type === updated.check_type &&
              item.item_key === updated.item_key
                ? { ...item, check: updated }
                : item
            )
          }
        };
      });

      setMessage({
        tone: "success",
        text: "Сохранено."
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: shiftErrorMessage(error)
      });
    } finally {
      mutationVersionRef.current += 1;
      pendingKeysRef.current.delete(key);
      setPendingKeys(new Set(pendingKeysRef.current));
    }
  }

  async function confirmCurrentPhase() {
    if (
      !data?.shift ||
      interactionLocked ||
      pendingKeys.size > 0
    ) {
      return;
    }

    const action =
      data.shift.status === "not_started"
        ? "open"
        : data.shift.status === "active"
          ? "close"
          : null;

    if (!action) return;

    mutationVersionRef.current += 1;
    setConfirming(action);
    setMessage(null);

    try {
      await confirmPositionShift(action);

      const fresh =
        await loadPositionShiftWorkflow();
      setView({ status: "ready", data: fresh });

      setMessage({
        tone: "success",
        text:
          action === "open"
            ? "Смена этой должности открыта и зафиксирована сервером."
            : "Смена этой должности закрыта и зафиксирована сервером."
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: shiftErrorMessage(error)
      });
    } finally {
      mutationVersionRef.current += 1;
      setConfirming(null);
    }
  }

  if (view.status === "loading") {
    return (
      <section className="mx-auto max-w-3xl pb-6">
        <div className="h-9 w-40 animate-pulse rounded-xl bg-[var(--bf-surface)]" />
        <div className="mt-5 h-32 animate-pulse rounded-[22px] bg-[var(--bf-surface)]" />
        <div className="mt-3 h-80 animate-pulse rounded-[22px] bg-[var(--bf-surface)]" />
      </section>
    );
  }

  if (view.status === "error") {
    return (
      <section className="mx-auto max-w-3xl pb-6">
        <p className="eyebrow">СМЕНА НЕДОСТУПНА</p>
        <h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">
          Рабочий чек-лист не загрузился
        </h1>

        <div className="mt-5 rounded-[22px] border border-[color:color-mix(in_srgb,var(--bf-red),transparent_55%)] bg-[color:color-mix(in_srgb,var(--bf-red),transparent_92%)] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-[#e99990]"
              aria-hidden
            />
            <p className="text-sm leading-6 text-[var(--bf-muted)]">
              {view.message} Локальная копия не выдаётся за актуальное
              состояние смены.
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={() => void load(false)}
          >
            <RefreshCw className="size-4" aria-hidden />
            Повторить
          </Button>
        </div>
      </section>
    );
  }

  const { context, shift, configured } =
    view.data;

  if (context.state === "position_required") {
    return (
      <section className="mx-auto max-w-2xl pb-6">
        <p className="eyebrow">СМЕНА</p>
        <h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">
          Выберите должность в вашем профиле
        </h1>

        <div className="mt-5 rounded-[22px] border border-[var(--bf-line)] bg-[var(--bf-surface)] p-5">
          <BriefcaseBusiness
            className="size-6 text-[var(--bf-copper-hi)]"
            aria-hidden
          />
          <p className="mt-3 text-sm leading-6 text-[var(--bf-muted)]">
            Выберите должность в вашем профиле. После этого здесь появится
            соответствующий чек-лист смены: Бармен, Официант, Менеджер или Хостес.
          </p>

          <Button
            asChild
            variant="primary"
            className="mt-4"
          >
            <Link to="/profile">
              <BriefcaseBusiness
                className="size-4"
                aria-hidden
              />
              Открыть профиль
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  if (context.state === "locked") {
    return (
      <section className="mx-auto max-w-2xl pb-6">
        <p className="eyebrow">
          СМЕНА · {context.position_label}
        </p>
        <h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">
          Операционное окно закрыто
        </h1>

        <div className="mt-5 rounded-[22px] border border-[var(--bf-line)] bg-[var(--bf-surface)] p-5">
          <LockKeyhole
            className="size-6 text-[var(--bf-gold)]"
            aria-hidden
          />
          <h2 className="mt-3 text-xl font-black">
            До 11:00 новая смена заблокирована
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--bf-muted)]">
            Рабочее окно: с 11:00 до 03:00 следующего дня. После 03:00
            незавершённая смена больше не доступна для изменения.
          </p>
          <p className="mt-3 text-sm font-bold text-[var(--bf-cream)]">
            Следующее открытие:{" "}
            {formatDateTime(
              context.next_open_at,
              context.venue_timezone
            )}
          </p>
        </div>
      </section>
    );
  }

  if (!configured || !shift) {
    return (
      <section className="mx-auto max-w-2xl pb-6">
        <p className="eyebrow">
          СМЕНА · {context.position_label}
        </p>
        <h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">
          Чек-лист пока не настроен
        </h1>

        <div className="mt-5 rounded-[22px] border border-[var(--bf-line)] bg-[var(--bf-surface)] p-5">
          <ClipboardCheck
            className="size-6 text-[var(--bf-copper-hi)]"
            aria-hidden
          />
          <p className="mt-3 text-sm leading-6 text-[var(--bf-muted)]">
            Для должности «{context.position_label}» пока нет активных
            пунктов открытия и закрытия. Никакие универсальные пункты
            автоматически не подставляются.
          </p>
        </div>
      </section>
    );
  }

  const activePhase =
    shift.status === "not_started"
      ? "opening"
      : shift.status === "active"
        ? "closing"
        : null;

  return (
    <section className="bf-shift-page mx-auto max-w-3xl pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">
            СМЕНА · {shift.position_label.toUpperCase()}
          </p>
          <h1 className="mt-1 text-[36px] font-black leading-none tracking-[-0.04em]">
            Чек-листы и контроль
          </h1>
          <p className="mt-2 text-sm text-[var(--bf-muted)]">
            Рабочее окно 11:00–03:00.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Обновить состояние смены"
          disabled={
            interactionLocked ||
            pendingKeys.size > 0
          }
          onClick={() => void load(true)}
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

      <div className="mt-5 rounded-[22px] border border-[var(--bf-line)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bf-copper),transparent_90%),transparent_50%),var(--bf-surface)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {shift.status === "closed" ? (
                <CheckCircle2
                  className="size-5 text-[var(--bf-green)]"
                  aria-hidden
                />
              ) : (
                <Clock3
                  className="size-5 text-[var(--bf-copper-hi)]"
                  aria-hidden
                />
              )}
              <h2 className="text-xl font-black">
                {shift.status === "not_started"
                  ? "Смена не открыта"
                  : shift.status === "active"
                    ? "Смена открыта"
                    : shift.status === "closed"
                      ? "Смена закрыта"
                      : "Смена истекла"}
              </h2>
            </div>

            <p className="mt-2 text-sm leading-6 text-[var(--bf-muted)]">
              {shift.status === "not_started"
                ? "Выполните пункты открытия."
                : shift.status === "active"
                  ? "До 03:00 выполните закрытие и подтвердите его."
                  : shift.status === "closed"
                    ? "Обе фазы зафиксированы сервером."
                    : "Операционное окно этой смены закончилось."}
            </p>
          </div>

          <div className="shrink-0 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-bg)] px-3 py-2 text-right">
            <CalendarDays
              className="ml-auto size-4 text-[var(--bf-copper-hi)]"
              aria-hidden
            />
            <p className="mt-1 max-w-[11ch] text-xs font-bold capitalize leading-4">
              {formatDate(shift.shift_date)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[var(--bf-line)] bg-[var(--bf-bg)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--bf-dim)]">
              Открыта
            </p>
            <p className="mt-1 font-black">
              {formatTime(
                shift.opened_at,
                context.venue_timezone
              )}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--bf-line)] bg-[var(--bf-bg)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--bf-dim)]">
              Закрыта
            </p>
            <p className="mt-1 font-black">
              {formatTime(
                shift.closed_at,
                context.venue_timezone
              )}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--bf-line)] bg-[var(--bf-bg)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--bf-dim)]">
              Крайний срок
            </p>
            <p className="mt-1 font-black">
              {formatTime(
                context.closes_at,
                context.venue_timezone
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface)] p-4">
          <p className="eyebrow">ОТКРЫТИЕ</p>
          <p className="mt-1 text-xl font-black">
            {opening.completed}/{opening.total}
          </p>
          <div className="mt-3">
            <ProgressBar
              value={opening.percent}
              label="Прогресс открытия"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface)] p-4">
          <p className="eyebrow">ЗАКРЫТИЕ</p>
          <p className="mt-1 text-xl font-black">
            {closing.completed}/{closing.total}
          </p>
          <div className="mt-3">
            <ProgressBar
              value={closing.percent}
              label="Прогресс закрытия"
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        {activePhase === "opening" ? (
          <ActivePhase
            type="opening"
            rows={opening.list}
            completed={opening.completed}
            total={opening.total}
            percent={opening.percent}
            locked={interactionLocked}
            pendingKeys={pendingKeys}
            confirming={confirming}
            onToggle={toggleCheck}
            onConfirm={confirmCurrentPhase}
          />
        ) : null}

        {activePhase === "closing" ? (
          <ActivePhase
            type="closing"
            rows={closing.list}
            completed={closing.completed}
            total={closing.total}
            percent={closing.percent}
            locked={interactionLocked}
            pendingKeys={pendingKeys}
            confirming={confirming}
            onToggle={toggleCheck}
            onConfirm={confirmCurrentPhase}
          />
        ) : null}

        {shift.status === "closed" ? (
          <div className="rounded-[22px] border border-[color:color-mix(in_srgb,var(--bf-green),transparent_62%)] bg-[color:color-mix(in_srgb,var(--bf-green),transparent_92%)] p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 size-6 shrink-0 text-[var(--bf-green)]"
                aria-hidden
              />
              <div>
                <h2 className="text-xl font-black">
                  Смена должности полностью зафиксирована
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--bf-muted)]">
                  Повторное редактирование этой смены недоступно.
                </p>
              </div>
            </div>
          </div>
        ) : null}
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

      <section className="mt-5 rounded-[22px] border border-[var(--bf-line)] bg-[var(--bf-surface)] p-4">
        <div className="flex items-start gap-3">
          <StickyNote
            className="mt-0.5 size-5 shrink-0 text-[var(--bf-copper-hi)]"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">ПЕРЕДАЧА</p>
            <h2 className="mt-1 text-lg font-black">
              Есть проблема, которую нельзя потерять?
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--bf-muted)]">
              Передайте её следующей смене отдельно от чек-листа.
            </p>

            <Button
              asChild
              variant="secondary"
              className="mt-3"
            >
              <Link to="/handover">
                <StickyNote
                  className="size-4"
                  aria-hidden
                />
                Открыть передачу смены
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-[var(--bf-dim)]">
        <LockKeyhole
          className="mt-0.5 size-4 shrink-0"
          aria-hidden
        />
        <p>
          Просмотр страницы не создаёт смену. Операционная запись появляется
          только после первого сохранённого действия и считается выполненной
          только после ответа сервера.
        </p>
      </div>
    </section>
  );
}
