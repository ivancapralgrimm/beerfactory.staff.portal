import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmNotice } from "@/components/warm/WarmPage";
import { STAFF_POSITION_LABELS } from "@/types/auth";
import { loadAdminAudit } from "./admin-api";
import { staffFullName } from "./staff-presentation";
import type { AdminAuditRow, AdminUser } from "./types";

function formatTime(value: string) {
  return Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Novosibirsk", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "Дата не указана";
}
const TITLES: Record<string, string> = {
  profile_role_update: "Изменены права доступа", profile_position_update: "Изменена должность", profile_activation_update: "Изменён доступ к порталу", credential_reset: "Обновлён персональный код", profile_delete: "Сотрудник удалён", recipe_governance_update: "Обновлён рецепт", knowledge_article_create: "Создана статья", knowledge_article_update: "Обновлена статья", knowledge_article_archive: "Статья перемещена в архив", knowledge_article_delete: "Статья удалена", checklist_definition_create: "Добавлен пункт чек-листа", checklist_definition_update: "Изменён пункт чек-листа", checklist_definition_delete: "Удалён пункт чек-листа", checklist_definition_reorder: "Изменён порядок чек-листа", operational_critical_update: "Изменение по смене"
};
function group(row: AdminAuditRow) { return row.entity_type === "profile" || row.action.startsWith("profile_") || row.action === "credential_reset" ? "staff" : "portal"; }
function readable(value: unknown, positions = false) {
  const key = String(value || "");
  if (positions) return STAFF_POSITION_LABELS[key as keyof typeof STAFF_POSITION_LABELS] || key || "Не назначена";
  return ({ staff: "Сотрудник", senior: "Старший", admin: "Администратор", manager: "Прежняя роль менеджера" } as Record<string, string>)[key] || "Не указано";
}
function detail(row: AdminAuditRow) {
  if (row.action === "profile_role_update") return `${readable(row.before_data.role)} → ${readable(row.after_data.role)}`;
  if (row.action === "profile_position_update") return `${readable(row.before_data.position_code || row.before_data.position, true)} → ${readable(row.after_data.position_code || row.after_data.position, true)}`;
  if (row.action === "profile_activation_update") return row.after_data.is_active === false ? "Доступ отключён" : "Доступ включён";
  if (row.action === "credential_reset") return row.metadata.credential === "recovery_code" ? "Код восстановления" : "Код входа";
  if (row.action === "recipe_governance_update" && row.after_data.change_note) return String(row.after_data.change_note);
  return "";
}
export function AdminAuditPanel({ users }: { users: AdminUser[] }) {
  const [rows, setRows] = useState<AdminAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  async function load() { setLoading(true); setError(false); try { setRows(await loadAdminAudit()); } catch { setError(true); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  const needle = search.trim().toLocaleLowerCase("ru");
  const groups = [{ id: "staff", title: "Персонал и доступ", description: "Роли, должности и учётные записи", icon: "people" }, { id: "portal", title: "Портал", description: "Рецепты, знания и чек-листы", icon: "admin" }] as const;
  if (loading) return <p role="status" className="bf-account-hint">Загружаем журнал…</p>;
  if (error) return <><WarmNotice error>Не удалось загрузить журнал изменений.</WarmNotice><Button type="button" variant="secondary" onClick={() => void load()}>Повторить</Button></>;
  return <div className="stack bf-audit-page">
    <label className="bf-field"><span className="bf-field-label">Найти изменение</span><input type="search" placeholder="Действие или сотрудник" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    <div className="bf-nav-list">{groups.map((config) => {
      const list = rows.filter((row) => group(row) === config.id && row.entity_type !== "position_shift_window_summary").slice(0, 30).filter((row) => {
        const actor = row.actor_id ? userMap.get(row.actor_id) : null;
        return `${TITLES[row.action] || "Изменение в портале"} ${row.entity_name || ""} ${detail(row)} ${actor ? staffFullName(actor) : "Система"}`.toLocaleLowerCase("ru").includes(needle);
      });
      return <details key={config.id} className="bf-nav-disclosure bf-audit-group" open={needle ? true : undefined}><summary className="bf-nav-row"><span className="bf-nav-leading"><WarmIcon name={config.icon} size={20} /></span><span className="bf-nav-copy"><span className="bf-nav-title">{config.title}</span><span className="bf-nav-meta">{config.description}</span></span><WarmIcon name="chevron" size={18} /></summary><div className="bf-audit-body">{list.length ? <ol className="bf-audit-list">{list.map((row) => {
        const actor = row.actor_id ? userMap.get(row.actor_id) : null;
        const extra = detail(row);
        return <li key={row.id}><article><h2>{TITLES[row.action] || "Изменение в портале"}{row.entity_name ? ` · ${row.entity_name}` : ""}</h2>{extra ? <p className="bf-account-hint">{extra}</p> : null}<p className="bf-account-hint">{actor ? staffFullName(actor) : "Система"} · <time dateTime={row.created_at}>{formatTime(row.created_at)}</time></p></article></li>;
      })}</ol> : <p className="bf-account-hint">{needle ? "По запросу ничего не найдено." : "В этом разделе пока нет изменений."}</p>}</div></details>;
    })}</div>
  </div>;
}
