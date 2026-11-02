import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WarmEmpty, WarmNotice } from "@/components/warm/WarmPage";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { STAFF_POSITION_LABELS } from "@/types/auth";
import { loadOwnPositionShiftHistory, type ShiftHistoryRow } from "./shift-history-api";

const STATUS = { not_started: "Не открыта", active: "Открыта", closed: "Закрыта", expired: "Завершилась по времени" };
const PHASES = [["general_cleaning", "Генеральная уборка"], ["opening", "Открытие"], ["closing", "Закрытие"]] as const;
function date(value: string) { const parsed = new Date(`${value}T12:00:00+07:00`); return Number.isFinite(parsed.valueOf()) ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Novosibirsk" }).format(parsed) : value; }
export function ShiftHistoryPanel() {
  const [rows, setRows] = useState<ShiftHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setLoading(true); setError(null);
    try { setRows(await loadOwnPositionShiftHistory()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "shift_history_load_failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  if (loading) return <p className="bf-account-hint" role="status">Загружаем историю смен…</p>;
  if (error) return <div className="stack" data-history-state={error}>
    {error === "position_required" ? <><WarmEmpty title="Сначала выберите должность" body="История доступна по текущей рабочей должности." /><Link className="bf-registration-link" to="/profile?view=details">Выбрать должность</Link></> : <><WarmNotice error>{error === "shift_history_server_upgrade_required" ? "История смен ещё не подключена. Обратитесь к администратору." : error === "forbidden" ? "История смен недоступна с текущими правами." : "Не удалось загрузить историю смен."}</WarmNotice><Button type="button" variant="secondary" onClick={() => void load()}>Повторить</Button></>}
  </div>;
  return rows.length ? <div className="bf-history-list">{rows.map((row) => <details key={row.id} className="bf-nav-disclosure bf-history-record"><summary className="bf-nav-row"><span className="bf-nav-copy"><span className="bf-nav-title">{date(row.shift_date)}</span><span className="bf-nav-meta">{STAFF_POSITION_LABELS[row.position_code]} · {STATUS[row.status]}</span></span><WarmIcon name="chevron" size={18} /></summary><div className="bf-history-body">{PHASES.map(([type, label]) => {
    const checks = row.checks.filter((check) => check.check_type === type);
    if (!checks.length) return null;
    return <section key={type}><h2>{label} · {checks.filter((check) => check.completed).length} из {checks.length}</h2><ul>{checks.map((check) => <li key={`${type}:${check.item_key}`}><WarmIcon name={check.completed ? "check" : "close"} size={16} /><span>{check.label}</span></li>)}</ul></section>;
  })}{!row.checks.length ? <p className="bf-account-hint">Для этой смены подробности чек-листа не сохранились.</p> : null}</div></details>)}</div> : <WarmEmpty title="История смен пока пуста" body="Здесь появятся смены вашей рабочей должности." />;
}
