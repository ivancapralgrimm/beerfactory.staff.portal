import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmEmpty, WarmNotice, WarmTitle } from "@/components/warm/WarmPage";
import { confirmPositionShift, loadPositionShiftWorkflow, setPositionShiftCheck, setPositionShiftCheckGroup, shiftErrorMessage, unlockPositionShiftClosing } from "@/features/shift/shift-api";
import type { PositionShiftCheck, PositionShiftRow, PositionShiftWorkflow, ShiftCheckType } from "@/features/shift/types";
import "./shift.css";

type ViewState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: PositionShiftWorkflow };
type StatusMessage = { text: string; tone: "success" | "error" };
type RowGroup = { key: string; label: string; rows: PositionShiftRow[] };

function formatDate(value: string) {
  try { return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Novosibirsk" }).format(new Date(`${value}T12:00:00+07:00`)); }
  catch { return value; }
}
function formatDateTime(value: string | null, timeZone: string) {
  if (!value) return "11:00";
  try { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value)); }
  catch { return "11:00"; }
}
function phaseProgress(rows: PositionShiftRow[], type: ShiftCheckType) {
  const list = rows.filter(row => row.check_type === type);
  const completed = list.filter(row => row.check?.completed).length;
  return { list, completed, total: list.length };
}
function ChecklistBody({ rows, locked, pendingKeys, pendingGroups, onToggle, onToggleGroup }: {
  rows: PositionShiftRow[]; locked: boolean; pendingKeys: ReadonlySet<string>; pendingGroups: ReadonlySet<string>;
  onToggle: (row: PositionShiftRow, completed: boolean) => void;
  onToggleGroup: (group: RowGroup, completed: boolean) => void;
}) {
  const groups = new Map<string, RowGroup>();
  rows.forEach(row => { if (row.group_key) { const group = groups.get(row.group_key); if (group) group.rows.push(row); else groups.set(row.group_key, { key: row.group_key, label: row.group_label || row.group_key.toUpperCase(), rows: [row] }); } });
  const printed = new Set<string>();
  return <div className="bf-shift-tasks">{rows.map(row => {
    const key = `${row.check_type}:${row.item_key}`;
    const group = row.group_key ? groups.get(row.group_key) : undefined;
    const groupPending = Boolean(group && pendingGroups.has(`${row.check_type}:${group.key}`));
    const showGroup = group && !printed.has(group.key); if (group) printed.add(group.key);
    const completed = group?.rows.filter(item => item.check?.completed).length || 0;
    return <div key={key}>
      {showGroup && group ? <button type="button" className="bf-shift-group" role="checkbox" aria-checked={completed === group.rows.length ? true : completed > 0 ? "mixed" : false} disabled={locked || groupPending || group.rows.some(item => pendingKeys.has(`${item.check_type}:${item.item_key}`))} onClick={() => onToggleGroup(group, completed !== group.rows.length)}><strong>{group.label}</strong><span>{completed}/{group.rows.length}</span></button> : null}
      <button type="button" className="bf-task-check" role="checkbox" aria-checked={Boolean(row.check?.completed)} aria-busy={pendingKeys.has(key)} disabled={locked || pendingKeys.has(key) || groupPending} onClick={() => onToggle(row, !row.check?.completed)}>
        <span className={`bf-check-box ${row.check?.completed ? "is-checked" : ""}`} aria-hidden="true">{pendingKeys.has(key) ? <span className="bf-shift-wait"/> : row.check?.completed ? <WarmIcon name="check" size={15}/> : null}</span><span>{row.label}</span>
      </button>
    </div>;
  })}</div>;
}

export function ShiftPage() {
  const [visiblePhase, setVisiblePhase] = useState<"opening" | "closing">("opening");
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
  const opening = useMemo(() => data ? phaseProgress(data.rows, "opening") : { list: [], completed: 0, total: 0 }, [data]);
  const closing = useMemo(() => data ? phaseProgress(data.rows, "closing") : { list: [], completed: 0, total: 0 }, [data]);
  const cleaning = useMemo(() => data ? phaseProgress(data.rows, "general_cleaning") : { list: [], completed: 0, total: 0 }, [data]);
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
      setMessage({ tone: "success", text: action === "open" ? "Смена открыта." : "Смена закрыта." });
    } catch (error) {
      setMessage({ tone: "error", text: shiftErrorMessage(error) });
    } finally {
      mutationVersionRef.current += 1;
      setConfirming(null);
    }
  }

  if (view.status === "loading") return <section className="bf-shift-page" aria-busy="true"><WarmTitle title="Смена"/><p role="status">Загружаем чек-лист…</p></section>;
  if (view.status === "error") return <section className="bf-shift-page"><WarmTitle title="Смена"/><WarmNotice error>{view.message}</WarmNotice><Button onClick={() => void load(false)}>Повторить</Button></section>;
  const { context, shift, configured } = view.data;
  if (context.state === "position_required") return <section className="bf-shift-page"><WarmTitle title="Смена"/><WarmEmpty title="Должность не назначена" body="Выберите рабочую должность в профиле, чтобы открыть свой чек-лист."/><Button asChild><Link to="/profile">Открыть профиль</Link></Button></section>;
  if (context.state === "locked") return <section className="bf-shift-page"><WarmTitle title="Смена"/><WarmEmpty title="Новая смена откроется в 11:00" body={`Следующее открытие: ${formatDateTime(context.next_open_at, context.venue_timezone)}. С 03:00 до 10:59 смена недоступна.`}/></section>;
  if (!configured || !shift) return <section className="bf-shift-page"><WarmTitle title="Смена"/><WarmEmpty title="Чек-лист пока не настроен" body="Для вашей должности пока нет доступного чек-листа."/></section>;

  const openingEditable = shift.status === "not_started";
  const closingUnlocked = shift.status === "active" || Boolean(shift.closing_unlocked_at);
  const closingEditable = shift.status !== "closed" && shift.status !== "expired" && closingUnlocked;
  const mutationPending = interactionLocked || pendingKeys.size > 0 || pendingGroups.size > 0;
  const currentPhase = visiblePhase === "opening" ? opening : closing;
  const total = opening.total + closing.total + cleaning.total;
  const done = opening.completed + closing.completed + cleaning.completed;
  const common = { pendingKeys, pendingGroups, onToggle: toggleCheck, onToggleGroup: toggleGroup };
  return <section className="bf-shift-page">
    <WarmTitle title="Смена" description={`${shift.position_label} · ${formatDate(shift.shift_date)}`} action={<Button variant="ghost" disabled={mutationPending} onClick={() => void load(true)}>{refreshing ? "Обновляем…" : "Обновить"}</Button>}/>
    <section className="bf-shift-summary"><div><h2>{shift.status === "closed" ? "Смена закрыта" : shift.status === "active" ? "Смена открыта" : shift.status === "expired" ? "Смена истекла" : "Рабочее время"}</h2><span>11:00 - 03:00</span></div><p>Выполнено {done} из {total} задач</p></section>
    {shift.status === "not_started" ? <Button variant="primary" disabled={mutationPending} onClick={() => void confirmPhase("open")}>{confirming === "open" ? "Открываем…" : "Открыть смену"}</Button> : null}
    {context.general_cleaning_day ? <section className="bf-shift-task-board"><h2>Генуборка <span>{cleaning.completed}/{cleaning.total}</span></h2>{cleaning.total ? <ChecklistBody rows={cleaning.list} locked={interactionLocked || shift.status === "closed" || shift.status === "expired"} {...common}/> : <p className="small muted">Пунктов пока нет.</p>}</section> : null}
    <div className="bf-shift-segments" role="group" aria-label="Этап чек-листа">{(["opening", "closing"] as const).map(phase => <Button key={phase} variant={visiblePhase === phase ? "primary" : "ghost"} aria-pressed={visiblePhase === phase} onClick={() => setVisiblePhase(phase)}>{phase === "opening" ? "Открытие" : "Закрытие"}</Button>)}</div>
    {visiblePhase === "closing" && !closingUnlocked && shift.status === "not_started" ? <section className="bf-shift-task-board"><h2>Закрытие</h2><p className="small muted">Пункты закрытия можно подготовить заранее.</p><Button disabled={mutationPending} onClick={() => void unlockClosing()}>{unlocking ? "Открываем…" : "Открыть чек-лист закрытия"}</Button></section> : <section className="bf-shift-task-board"><h2>{visiblePhase === "opening" ? "Открытие" : "Закрытие"} <span>{currentPhase.completed}/{currentPhase.total}</span></h2><ChecklistBody rows={currentPhase.list} locked={interactionLocked || (visiblePhase === "opening" ? !openingEditable : !closingEditable)} {...common}/>{!currentPhase.total ? <p className="small muted">Пунктов на сегодня нет.</p> : null}</section>}
    {shift.status === "active" ? <Button variant="primary" disabled={mutationPending} onClick={() => void confirmPhase("close")}>{confirming === "close" ? "Закрываем…" : "Закрыть смену"}</Button> : null}
    {message ? <WarmNotice error={message.tone === "error"}>{message.text}</WarmNotice> : null}
  </section>;
}
