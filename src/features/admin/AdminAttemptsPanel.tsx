import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmEmpty, WarmNotice, WarmRow } from "@/components/warm/WarmPage";
import { loadAdminAttempts } from "./admin-api";
import { staffFullName } from "./staff-presentation";
import type { AdminAttempt, AdminUser } from "./types";

function formatDateTime(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Novosibirsk" }).format(new Date(value));
}
function weakTopics(row: AdminAttempt) {
  const raw = row.category_results;
  if (!raw || typeof raw !== "object" || !("weak_topics" in raw) || !Array.isArray(raw.weak_topics)) return [];
  return raw.weak_topics.flatMap((item: unknown) => {
    if (!item || typeof item !== "object" || !("topic" in item) || typeof item.topic !== "string") return [];
    const value = item as { topic: string; correct?: number; total?: number };
    return [{ topic: value.topic, correct: Number(value.correct || 0), total: Number(value.total || 0) }];
  });
}
export function AdminAttemptsPanel({ users }: { users: AdminUser[] }) {
  const [rows, setRows] = useState<AdminAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("all");
  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  async function load() {
    setLoading(true); setError(false);
    try { setRows(await loadAdminAttempts()); }
    catch { setError(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const categories = [...new Set(rows.map((row) => row.category || row.category_id).filter((value): value is string => Boolean(value)))];
  const filtered = filter === "all" ? rows : rows.filter((row) => (row.category || row.category_id) === filter);
  const passed = filtered.filter((row) => row.passed).length;
  const average = filtered.length ? Math.round(filtered.reduce((sum, row) => sum + Number(row.score || 0), 0) / filtered.length) : 0;
  return <div className="stack bf-team-attempts">
    <div className="bf-profile-group"><WarmRow to="/settings/attestation/questions" title="Вопросы" description="Банк вопросов аттестации" icon="book" /><WarmRow to="/settings/attestation" title="Настройки аттестаций" description="Билеты и правила проведения" icon="shift" /></div>
    <div className="bf-attempts-heading"><h2>Результаты команды</h2><Button type="button" variant="secondary" disabled={loading} onClick={() => void load()}>Обновить</Button></div>
    {loading ? <p role="status" className="bf-account-hint">Загружаем результаты…</p> : error ? <WarmNotice error>Не удалось загрузить результаты аттестаций. Повторите попытку.</WarmNotice> : <>
      <dl className="bf-attempts-summary" aria-label="Статистика результатов аттестации"><div><dt>Попыток</dt><dd>{filtered.length}</dd></div><div><dt>Зачтено</dt><dd>{passed}</dd></div><div><dt>Средний</dt><dd>{average}%</dd></div></dl>
      <label className="bf-field"><span className="bf-field-label">Категория</span><select aria-label="Категория результатов аттестации" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Все категории</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      {filtered.length ? <ol className="bf-attempts-list">{filtered.map((row) => {
        const person = userMap.get(row.user_id);
        const weak = weakTopics(row);
        return <li key={row.id}><article className="bf-personal-result"><div className="bf-attempts-heading"><div><p className="bf-account-hint">{row.category || row.category_id || "Аттестация"}</p><h3>{person ? staffFullName(person) : "Сотрудник"}</h3></div><span className="bf-attempts-result"><WarmIcon name={row.passed ? "check" : "close"} size={17} />{row.score}% · {row.passed ? "Зачтено" : "Не зачтено"}</span></div><p className="bf-account-hint">{row.correct_answers} из {row.total_questions} · {formatDateTime(row.finished_at || row.created_at)}</p>{weak.length ? <p className="bf-account-hint">Повторить: {weak.slice(0, 6).map((item) => `${item.topic} (${item.correct}/${item.total})`).join(" · ")}</p> : null}</article></li>;
      })}</ol> : <WarmEmpty title="Результатов пока нет" body="Здесь появятся завершённые аттестации команды." />}
    </>}
  </div>;
}
