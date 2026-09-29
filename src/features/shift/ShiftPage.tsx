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
  Sparkles,
  StickyNote
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  confirmPositionShift,
  loadPositionShiftWorkflow,
  setPositionShiftCheck,
  setPositionShiftCheckGroup,
  shiftErrorMessage,
  unlockPositionShiftClosing
} from "@/features/shift/shift-api";
import type {
  PositionShiftCheck,
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

type RowGroup = {
  key: string;
  label: string;
  rows: PositionShiftRow[];
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

function formatTime(value: string | null, timeZone: string) {
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

function formatDateTime(value: string | null, timeZone: string) {
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

function phaseProgress(rows: PositionShiftRow[], type: ShiftCheckType) {
  const list = rows.filter((row) => row.check_type === type);
  const completed = list.filter((row) => row.check?.completed).length;
  return {
    list,
    completed,
    total: list.length,
    percent: list.length ? Math.round((completed / list.length) * 100) : 0
  };
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--bf-surface-2)]" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <div className="h-full rounded-full bg-[var(--bf-copper-hi)] transition-[width] duration-200" style={{ width: `${value}%` }} />
    </div>
  );
}

function ChecklistRow({ row, locked, pending, onToggle }: {
  row: PositionShiftRow;
  locked: boolean;
  pending: boolean;
  onToggle: (row: PositionShiftRow, completed: boolean) => void;
}) {
  const checked = Boolean(row.check?.completed);
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-busy={pending} disabled={locked || pending} onClick={() => onToggle(row, !checked)} className={cn("grid min-h-[50px] w-full grid-cols-[26px_1fr_auto] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left outline-none transition-[background-color,border-color,opacity,transform] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)] active:translate-y-px disabled:cursor-default", checked ? "border-[color:color-mix(in_srgb,var(--bf-green),transparent_58%)] bg-[color:color-mix(in_srgb,var(--bf-green),transparent_91%)]" : "border-[var(--bf-line)] bg-[var(--bf-surface)]", pending && "opacity-85", locked && "opacity-65")}>
      <span className={cn("grid size-6 place-items-center rounded-md border", checked ? "border-[color:color-mix(in_srgb,var(--bf-green),transparent_35%)] bg-[color:color-mix(in_srgb,var(--bf-green),transparent_76%)] text-[#b7e3ba]" : "border-[var(--bf-line-strong)] bg-[var(--bf-surface-2)] text-[var(--bf-dim)]")} aria-hidden>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : checked ? <Check className="size-3.5" /> : null}
      </span>
      <span className="block min-w-0 text-[13px] font-semibold leading-[18px] text-[var(--bf-cream)]">{row.label}</span>
      {checked ? <CheckCircle2 className="size-3.5 text-[var(--bf-green)]" aria-hidden /> : null}
    </button>
  );
}

function splitGroups(rows: PositionShiftRow[]) {
  const groups = new Map<string, RowGroup>();
  const ungrouped: PositionShiftRow[] = [];
  rows.forEach((row) => {
    if (!row.group_key) {
      ungrouped.push(row);
      return;
    }
    const current = groups.get(row.group_key);
    if (current) current.rows.push(row);
    else groups.set(row.group_key, { key: row.group_key, label: row.group_label || row.group_key.toUpperCase(), rows: [row] });
  });
  return { groups: [...groups.values()], ungrouped };
}

function GroupBlock({ group, locked, pendingKeys, groupPending, onToggle, onToggleGroup }: {
  group: RowGroup;
  locked: boolean;
  pendingKeys: ReadonlySet<string>;
  groupPending: boolean;
  onToggle: (row: PositionShiftRow, completed: boolean) => void;
  onToggleGroup: (group: RowGroup, completed: boolean) => void;
}) {
  const completed = group.rows.filter((row) => row.check?.completed).length;
  const allDone = group.rows.length > 0 && completed === group.rows.length;
  const mixed = completed > 0 && !allDone;
  return (
    <div className="rounded-[18px] border border-[var(--bf-line)] bg-[var(--bf-bg)] p-2">
      <button type="button" role="checkbox" aria-checked={mixed ? "mixed" : allDone} disabled={locked || groupPending} onClick={() => onToggleGroup(group, !allDone)} className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)] disabled:opacity-65">
        <span className={cn("grid size-6 place-items-center rounded-md border", allDone ? "border-[color:color-mix(in_srgb,var(--bf-green),transparent_35%)] bg-[color:color-mix(in_srgb,var(--bf-green),transparent_76%)] text-[#b7e3ba]" : mixed ? "border-[var(--bf-copper-hi)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_80%)] text-[var(--bf-cream)]" : "border-[var(--bf-line-strong)] bg-[var(--bf-surface-2)] text-[var(--bf-dim)]")} aria-hidden>
          {groupPending ? <Loader2 className="size-3.5 animate-spin" /> : allDone ? <Check className="size-3.5" /> : mixed ? <span className="h-0.5 w-3 rounded-full bg-current" /> : null}
        </span>
        <span className="min-w-0 flex-1"><strong className="block text-sm font-black text-[var(--bf-cream)]">{group.label}</strong><span className="text-[10px] text-[var(--bf-dim)]">{completed}/{group.rows.length} пунктов</span></span>
      </button>
      <div className="mt-1 grid gap-1.5 pl-0.5">
        {group.rows.map((row) => {
          const key = `${row.check_type}:${row.item_key}`;
          return <ChecklistRow key={key} row={row} locked={locked || groupPending} pending={pendingKeys.has(key)} onToggle={onToggle} />;
        })}
      </div>
    </div>
  );
}

function ChecklistBody({ rows, locked, pendingKeys, pendingGroups, onToggle, onToggleGroup }: {
  rows: PositionShiftRow[];
  locked: boolean;
  pendingKeys: ReadonlySet<string>;
  pendingGroups: ReadonlySet<string>;
  onToggle: (row: PositionShiftRow, completed: boolean) => void;
  onToggleGroup: (group: RowGroup, completed: boolean) => void;
}) {
  const { groups, ungrouped } = splitGroups(rows);
  return (
    <div className="mt-3 grid gap-1.5">
      {groups.map((group) => <GroupBlock key={group.key} group={group} locked={locked} pendingKeys={pendingKeys} groupPending={pendingGroups.has(`${group.rows[0]?.check_type}:${group.key}`)} onToggle={onToggle} onToggleGroup={onToggleGroup} />)}
      {ungrouped.map((row) => {
        const key = `${row.check_type}:${row.item_key}`;
        return <ChecklistRow key={key} row={row} locked={locked} pending={pendingKeys.has(key)} onToggle={onToggle} />;
      })}
    </div>
  );
}

function PhaseSection({ title, eyebrow, rows, completed, total, percent, locked, pendingKeys, pendingGroups, onToggle, onToggleGroup, footer }: {
  title: string;
  eyebrow: string;
  rows: PositionShiftRow[];
  completed: number;
  total: number;
  percent: number;
  locked: boolean;
  pendingKeys: ReadonlySet<string>;
  pendingGroups: ReadonlySet<string>;
  onToggle: (row: PositionShiftRow, completed: boolean) => void;
  onToggleGroup: (group: RowGroup, completed: boolean) => void;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-[var(--bf-line)] bg-[var(--bf-surface)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">{eyebrow}</p><h2 className="mt-1 text-2xl font-black">{title}</h2></div><span className="shrink-0 rounded-full border border-[var(--bf-line)] px-3 py-2 text-xs font-black text-[var(--bf-cream)]">{completed}/{total}</span></div>
      <div className="mt-4"><ProgressBar value={percent} label={`Прогресс: ${title}`} /></div>
      <ChecklistBody rows={rows} locked={locked} pendingKeys={pendingKeys} pendingGroups={pendingGroups} onToggle={onToggle} onToggleGroup={onToggleGroup} />
      {footer}
    </section>
  );
}

export function ShiftPage() {
  const [view, setView] = useState<ViewState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set());
  const [pendingGroups, setPendingGroups] = useState<Set<string>>(() => new Set());
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const mutationVersionRef = useRef(0);
  const [confirming, setConfirming] = useState<"open" | "close" | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const load = useCallback(async (quiet = false) => {
    const versionAtStart = mutationVersionRef.current;
    if (quiet) setRefreshing(true); else setView({ status: "loading" });
    try {
      const data = await loadPositionShiftWorkflow();
      if (versionAtStart === mutationVersionRef.current) {
        setView({ status: "ready", data });
        if (!quiet) setMessage(null);
      }
    } catch (error) {
      if (versionAtStart === mutationVersionRef.current) setView({ status: "error", message: shiftErrorMessage(error) });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);
  useEffect(() => {
    const refresh = () => void load(true);
    const visibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visibility); };
  }, [load]);

  const data = view.status === "ready" ? view.data : null;
  const opening = useMemo(() => data ? phaseProgress(data.rows, "opening") : { list: [], completed: 0, total: 0, percent: 0 }, [data]);
  const closing = useMemo(() => data ? phaseProgress(data.rows, "closing") : { list: [], completed: 0, total: 0, percent: 0 }, [data]);
  const cleaning = useMemo(() => data ? phaseProgress(data.rows, "general_cleaning") : { list: [], completed: 0, total: 0, percent: 0 }, [data]);
  const interactionLocked = refreshing || confirming !== null || unlocking;

  function patchChecks(updated: PositionShiftCheck[]) {
    setView((current) => {
      if (current.status !== "ready") return current;
      const map = new Map(updated.map((item) => [`${item.check_type}:${item.item_key}`, item]));
      return { status: "ready", data: { ...current.data, rows: current.data.rows.map((row) => { const next = map.get(`${row.check_type}:${row.item_key}`); return next ? { ...row, check: next } : row; }) } };
    });
  }

  async function toggleCheck(row: PositionShiftRow, completed: boolean) {
    if (!data || interactionLocked) return;
    const key = `${row.check_type}:${row.item_key}`;
    if (pendingKeysRef.current.has(key)) return;
    mutationVersionRef.current += 1;
    pendingKeysRef.current.add(key);
    setPendingKeys(new Set(pendingKeysRef.current));
    setMessage(null);
    try {
      const updated = await setPositionShiftCheck({ checkType: row.check_type, itemKey: row.item_key, completed });
      patchChecks([updated]);
    } catch (error) {
      setMessage({ tone: "error", text: shiftErrorMessage(error) });
    } finally {
      mutationVersionRef.current += 1;
      pendingKeysRef.current.delete(key);
      setPendingKeys(new Set(pendingKeysRef.current));
    }
  }

  async function toggleGroup(group: RowGroup, completed: boolean) {
    if (!data || interactionLocked) return;
    const checkType = group.rows[0]?.check_type;
    if (!checkType) return;
    const pendingGroupKey = `${checkType}:${group.key}`;
    if (pendingGroups.has(pendingGroupKey)) return;
    mutationVersionRef.current += 1;
    setPendingGroups((current) => { const next = new Set(current); next.add(pendingGroupKey); return next; });
    setMessage(null);
    try {
      const updated = await setPositionShiftCheckGroup({ checkType, groupKey: group.key, completed });
      patchChecks(updated);
    } catch (error) {
      setMessage({ tone: "error", text: shiftErrorMessage(error) });
    } finally {
      mutationVersionRef.current += 1;
      setPendingGroups((current) => { const next = new Set(current); next.delete(pendingGroupKey); return next; });
    }
  }

  async function unlockClosing() {
    if (!data?.shift || interactionLocked) return;
    mutationVersionRef.current += 1;
    setUnlocking(true);
    setMessage(null);
    try {
      await unlockPositionShiftClosing();
      const fresh = await loadPositionShiftWorkflow();
      setView({ status: "ready", data: fresh });
      setMessage({ tone: "success", text: "Закрытие доступно." });
    } catch (error) {
      setMessage({ tone: "error", text: shiftErrorMessage(error) });
    } finally {
      mutationVersionRef.current += 1;
      setUnlocking(false);
    }
  }

  async function confirmPhase(action: "open" | "close") {
    if (!data?.shift || interactionLocked || pendingKeys.size > 0 || pendingGroups.size > 0) return;
    mutationVersionRef.current += 1;
    setConfirming(action);
    setMessage(null);
    try {
      await confirmPositionShift(action);
      const fresh = await loadPositionShiftWorkflow();
      setView({ status: "ready", data: fresh });
      setMessage({ tone: "success", text: action === "open" ? "Открытие смены подтверждено." : "Закрытие смены подтверждено." });
    } catch (error) {
      setMessage({ tone: "error", text: shiftErrorMessage(error) });
    } finally {
      mutationVersionRef.current += 1;
      setConfirming(null);
    }
  }

  if (view.status === "loading") return <section className="mx-auto max-w-3xl pb-6"><div className="h-9 w-40 animate-pulse rounded-xl bg-[var(--bf-surface)]" /><div className="mt-5 h-32 animate-pulse rounded-[22px] bg-[var(--bf-surface)]" /><div className="mt-3 h-80 animate-pulse rounded-[22px] bg-[var(--bf-surface)]" /></section>;

  if (view.status === "error") return (
    <section className="mx-auto max-w-3xl pb-6">
      <p className="eyebrow">СМЕНА НЕДОСТУПНА</p>
      <h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">Не удалось загрузить чек-лист</h1>
      <div className="mt-5 rounded-[22px] border border-[color:color-mix(in_srgb,var(--bf-red),transparent_55%)] bg-[color:color-mix(in_srgb,var(--bf-red),transparent_92%)] p-4">
        <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#e99990]" aria-hidden /><p className="text-sm leading-6 text-[var(--bf-muted)]">{view.message}</p></div>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => void load(false)}><RefreshCw className="size-4" aria-hidden />Повторить</Button>
      </div>
    </section>
  );

  const { context, shift, configured } = view.data;

  if (context.state === "position_required") return (
    <section className="mx-auto max-w-2xl pb-6"><p className="eyebrow">СМЕНА</p><h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">Выберите должность в профиле</h1><div className="mt-5 rounded-[22px] border border-[var(--bf-line)] bg-[var(--bf-surface)] p-5"><BriefcaseBusiness className="size-6 text-[var(--bf-copper-hi)]" aria-hidden /><p className="mt-3 text-sm leading-6 text-[var(--bf-muted)]">После выбора появится ваш чек-лист.</p><Button asChild variant="primary" className="mt-4"><Link to="/profile">Открыть профиль</Link></Button></div></section>
  );

  if (context.state === "locked") return (
    <section className="mx-auto max-w-2xl pb-6">
      <p className="eyebrow">СМЕНА · {context.position_label}</p>
      <h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">Смена недоступна</h1>
      <div className="mt-5 rounded-[22px] border border-[var(--bf-line)] bg-[var(--bf-surface)] p-5">
        <LockKeyhole className="size-6 text-[var(--bf-gold)]" aria-hidden />
        <h2 className="mt-3 text-xl font-black">Новая смена с 11:00</h2>
        <p className="mt-3 text-sm font-bold text-[var(--bf-cream)]">Следующее открытие: {formatDateTime(context.next_open_at, context.venue_timezone)}</p>
      </div>
    </section>
  );

  if (!configured || !shift) return <section className="mx-auto max-w-2xl pb-6"><p className="eyebrow">СМЕНА · {context.position_label}</p><h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">Чек-лист пока не настроен</h1></section>;

  const openingEditable = shift.status === "not_started";
  const closingUnlocked = shift.status === "active" || Boolean(shift.closing_unlocked_at);
  const closingEditable = shift.status !== "closed" && closingUnlocked;

  return (
    <section className="mx-auto max-w-3xl pb-6">
      <div className="flex items-start justify-between gap-3">
        <div><p className="eyebrow">СМЕНА · {shift.position_label.toUpperCase()}</p><h1 className="mt-1 text-[36px] font-black leading-none tracking-[-0.04em]">Чек-листы</h1><p className="mt-2 text-sm text-[var(--bf-muted)]">11:00–03:00</p></div>
        <Button type="button" variant="secondary" size="icon" aria-label="Обновить смену" disabled={interactionLocked} onClick={() => void load(true)}><RefreshCw className={cn("size-4", refreshing && "animate-spin")} aria-hidden /></Button>
      </div>

      <div className="mt-5 rounded-[22px] border border-[var(--bf-line)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bf-copper),transparent_90%),transparent_50%),var(--bf-surface)] p-4">
        <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2">{shift.status === "closed" ? <CheckCircle2 className="size-5 text-[var(--bf-green)]" aria-hidden /> : <Clock3 className="size-5 text-[var(--bf-copper-hi)]" aria-hidden />}<h2 className="text-xl font-black">{shift.status === "not_started" ? "Смена не открыта" : shift.status === "active" ? "Смена открыта" : shift.status === "closed" ? "Смена закрыта" : "Смена истекла"}</h2></div></div><div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-bg)] px-2.5 py-2"><CalendarDays className="size-4 text-[var(--bf-copper-hi)]" aria-hidden /><p className="whitespace-nowrap text-[11px] font-bold capitalize leading-none">{formatDate(shift.shift_date)}</p></div></div>
        {shift.opened_at || shift.closed_at ? <p className="mt-3 text-xs text-[var(--bf-muted)]">{shift.opened_at ? `Открыта ${formatTime(shift.opened_at, context.venue_timezone)}` : "Открытие не подтверждено"}{shift.closed_at ? ` · закрыта ${formatTime(shift.closed_at, context.venue_timezone)}` : ""}{context.closes_at ? ` · до ${formatTime(context.closes_at, context.venue_timezone)}` : ""}</p> : null}
      </div>

      {context.general_cleaning_day ? <div className="mt-4">{cleaning.total ? <PhaseSection eyebrow="ВОСКРЕСЕНЬЕ · ГЕНУБОРКА" title="Генуборка" rows={cleaning.list} completed={cleaning.completed} total={cleaning.total} percent={cleaning.percent} locked={interactionLocked} pendingKeys={pendingKeys} pendingGroups={pendingGroups} onToggle={toggleCheck} onToggleGroup={toggleGroup} /> : <section className="rounded-[22px] border border-[color:color-mix(in_srgb,var(--bf-gold),transparent_60%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bf-gold),transparent_92%),transparent_55%),var(--bf-surface)] p-4 sm:p-5"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-5 shrink-0 text-[var(--bf-gold)]" aria-hidden /><div><p className="eyebrow">ВОСКРЕСЕНЬЕ · ГЕНУБОРКА</p><h2 className="mt-1 text-2xl font-black">Генуборка</h2><p className="mt-2 text-sm leading-6 text-[var(--bf-muted)]">Пунктов пока нет.</p></div></div></section>}</div> : null}

      <div className="mt-4"><PhaseSection eyebrow="ОТКРЫТИЕ" title="Открытие" rows={opening.list} completed={opening.completed} total={opening.total} percent={opening.percent} locked={!openingEditable || interactionLocked} pendingKeys={pendingKeys} pendingGroups={pendingGroups} onToggle={toggleCheck} onToggleGroup={toggleGroup} footer={shift.status === "not_started" ? <Button type="button" variant="primary" size="lg" className="mt-4 w-full" disabled={opening.total === 0 || opening.completed !== opening.total || interactionLocked || pendingKeys.size > 0 || pendingGroups.size > 0} onClick={() => void confirmPhase("open")}>{confirming === "open" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ClipboardCheck className="size-4" aria-hidden />}Подтвердить открытие</Button> : <p className="mt-4 text-xs font-bold text-[#9dd0a0]">Открытие подтверждено.</p>} /></div>

      <div className="mt-4">{!closingUnlocked && shift.status === "not_started" ? <section className="rounded-[22px] border border-[var(--bf-line)] bg-[var(--bf-surface)] p-4 sm:p-5"><p className="eyebrow">ЗАКРЫТИЕ</p><h2 className="mt-1 text-2xl font-black">Закрытие</h2><p className="mt-2 text-sm leading-6 text-[var(--bf-muted)]">При необходимости закрытие можно начать раньше.</p><Button type="button" variant="secondary" size="lg" className="mt-4 w-full" disabled={interactionLocked} onClick={() => void unlockClosing()}>{unlocking ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LockKeyhole className="size-4" aria-hidden />}Открыть закрытие</Button></section> : <PhaseSection eyebrow="ЗАКРЫТИЕ" title="Закрытие" rows={closing.list} completed={closing.completed} total={closing.total} percent={closing.percent} locked={!closingEditable || interactionLocked} pendingKeys={pendingKeys} pendingGroups={pendingGroups} onToggle={toggleCheck} onToggleGroup={toggleGroup} footer={shift.status === "active" ? <Button type="button" variant="primary" size="lg" className="mt-4 w-full" disabled={closing.total === 0 || closing.completed !== closing.total || interactionLocked || pendingKeys.size > 0 || pendingGroups.size > 0} onClick={() => void confirmPhase("close")}>{confirming === "close" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ClipboardCheck className="size-4" aria-hidden />}Подтвердить закрытие</Button> : shift.status === "not_started" ? <p className="mt-4 text-xs leading-5 text-[var(--bf-dim)]">Отмечать пункты можно заранее. Подтверждение доступно после открытия.</p> : <p className="mt-4 text-xs font-bold text-[#9dd0a0]">Закрытие подтверждено.</p>} />}</div>

      <p className={cn("mt-3 min-h-5 text-xs leading-5", message?.tone === "error" ? "text-[#e99990]" : "text-[#9dd0a0]")} role="status" aria-live="polite">{message?.text || ""}</p>

      <section className="mt-5 rounded-[22px] border border-[var(--bf-line)] bg-[var(--bf-surface)] p-4"><div className="flex items-start gap-3"><StickyNote className="mt-0.5 size-5 shrink-0 text-[var(--bf-copper-hi)]" aria-hidden /><div className="min-w-0 flex-1"><p className="eyebrow">ЛЕНТА</p><h2 className="mt-1 text-lg font-black">Есть важная информация?</h2><p className="mt-1 text-sm leading-6 text-[var(--bf-muted)]">Добавьте её в Ленту.</p><Button asChild variant="secondary" className="mt-3"><Link to="/feed">Открыть Ленту</Link></Button></div></div></section>
    </section>
  );
}
