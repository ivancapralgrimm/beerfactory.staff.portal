import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ScrollText, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { loadAdminAudit } from "@/features/admin/admin-api";
import type { AdminAuditRow, AdminUser } from "@/features/admin/types";
import { cn } from "@/lib/utils";

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Novosibirsk"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function asNumber(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function shiftSummary(row: AdminAuditRow) {
  const opening = typeof row.after_data.opening === "object" && row.after_data.opening
    ? row.after_data.opening as Record<string, unknown>
    : {};
  const closing = typeof row.after_data.closing === "object" && row.after_data.closing
    ? row.after_data.closing as Record<string, unknown>
    : {};
  const cleaning = typeof row.after_data.general_cleaning === "object" && row.after_data.general_cleaning
    ? row.after_data.general_cleaning as Record<string, unknown>
    : null;

  const parts = [
    `Открытие ${asNumber(opening.completed)}/${asNumber(opening.total)}`,
    `Закрытие ${asNumber(closing.completed)}/${asNumber(closing.total)}`
  ];
  if (cleaning) {
    parts.unshift(`Генуборка ${asNumber(cleaning.completed)}/${asNumber(cleaning.total)}`);
  }

  const missing = [
    ...stringList(row.metadata.general_cleaning_missing),
    ...stringList(row.metadata.opening_missing),
    ...stringList(row.metadata.closing_missing)
  ];

  return {
    text: parts.join(" · "),
    note: missing.length ? `Не завершено: ${missing.join(" · ")}` : "Все обязательные пункты завершены."
  };
}

function eventTitle(row: AdminAuditRow) {
  switch (row.action) {
    case "profile_role_update": return "Изменены права доступа";
    case "profile_position_update": return "Изменена должность";
    case "profile_activation_update": return "Изменён доступ к порталу";
    case "credential_reset": return row.metadata.credential === "recovery_code" ? "Обновлён код восстановления" : "Обновлён код входа";
    case "profile_delete": return "Сотрудник удалён";
    case "recipe_governance_update": return "Обновлён рецепт";
    case "knowledge_article_create": return "Создана статья";
    case "knowledge_article_update": return "Обновлена статья";
    case "knowledge_article_archive": return "Статья перемещена в архив";
    case "checklist_definition_create": return "Добавлен пункт чек-листа";
    case "checklist_definition_update": return "Изменён пункт чек-листа";
    case "checklist_definition_delete": return "Удалён пункт чек-листа";
    case "checklist_definition_reorder": return "Изменён порядок чек-листа";
    case "operational_critical_update": return "Изменение по смене";
    default:
      return row.entity_type === "position_shift_window_summary" ? "Итог смены" : "Системное изменение";
  }
}

function eventDetail(row: AdminAuditRow) {
  if (row.entity_type === "position_shift_window_summary") return shiftSummary(row).text;
  if (row.action === "profile_role_update") {
    return `Роль: ${String(row.before_data.role || "—")} → ${String(row.after_data.role || "—")}`;
  }
  if (row.action === "profile_position_update") {
    return `Должность: ${String(row.before_data.position || "—")} → ${String(row.after_data.position || "—")}`;
  }
  if (row.action === "profile_activation_update") {
    return row.after_data.is_active === false ? "Доступ отключён." : "Доступ включён.";
  }
  if (row.action === "profile_delete") return "Учётная запись удалена, персональные данные очищены.";
  if (row.action === "recipe_governance_update") {
    return row.after_data.change_note ? String(row.after_data.change_note) : "Данные рецепта изменены.";
  }
  if (row.action.startsWith("knowledge_article_")) return row.entity_name ? `«${row.entity_name}»` : "Изменение материала базы знаний.";
  if (row.action.startsWith("checklist_definition_")) return row.entity_name || "Изменение рабочего чек-листа.";
  if (row.action === "operational_critical_update") return "Обновлено состояние рабочей смены.";
  return "Изменение сохранено в журнале.";
}

function groupKey(row: AdminAuditRow) {
  if (
    row.entity_type === "profile" ||
    row.action.startsWith("profile_") ||
    row.action === "credential_reset"
  ) {
    return "staff" as const;
  }
  return "portal" as const;
}

export function AdminAuditPanel({ users }: { users: AdminUser[] }) {
  const [rows, setRows] = useState<AdminAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await loadAdminAudit());
    } catch {
      setError("Не удалось загрузить журнал действий.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const groups = useMemo(() => {
    const staff = rows.filter((row) => groupKey(row) === "staff");
    const portal = rows.filter((row) => groupKey(row) === "portal");
    return [
      {
        id: "staff",
        title: "Персонал и доступ",
        description: "Роли, должности, доступ и учётные записи.",
        icon: UserRoundCog,
        rows: staff
      },
      {
        id: "portal",
        title: "Портал и смены",
        description: "Рецепты, статьи, чек-листы и рабочие события.",
        icon: ScrollText,
        rows: portal
      }
    ] as const;
  }, [rows]);

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">ЖУРНАЛ</p>
          <h2 className="mt-1 text-2xl font-black">Последние изменения</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--bf-dim)]">Технические коды и внутренние ID скрыты. Здесь только то, что полезно администратору.</p>
        </div>
        <Button type="button" variant="secondary" size="icon" aria-label="Обновить журнал" disabled={loading} onClick={() => void load()}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
        </Button>
      </div>

      {loading ? (
        <div className="mt-4 grid gap-3">{[0, 1].map((item) => <div key={item} className="h-44 animate-pulse rounded-[20px] bg-[var(--bf-surface)]" />)}</div>
      ) : error ? (
        <Surface className="mt-4 p-4 text-sm text-[#e99990]">{error}</Surface>
      ) : (
        <div className="mt-4 grid gap-3">
          {groups.map((group) => {
            const Icon = group.icon;
            const visible = group.rows.slice(0, 8);
            return (
              <Surface key={group.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface-2)]">
                    <Icon className="size-4 text-[var(--bf-copper-hi)]" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-black text-[var(--bf-cream)]">{group.title}</h3>
                      <span className="rounded-full border border-[var(--bf-line)] px-2 py-1 text-[10px] font-black text-[var(--bf-dim)]">{group.rows.length}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--bf-muted)]">{group.description}</p>
                  </div>
                </div>

                {visible.length ? (
                  <div className="mt-3 divide-y divide-[var(--bf-line)] border-t border-[var(--bf-line)]">
                    {visible.map((row) => {
                      const actor = row.actor_id ? userMap.get(row.actor_id) : null;
                      const actorName = actor ? [actor.first_name, actor.last_name].filter(Boolean).join(" ") : "Система";
                      const summary = row.entity_type === "position_shift_window_summary" ? shiftSummary(row) : null;
                      return (
                        <div key={row.id} className="py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-[var(--bf-cream)]">{eventTitle(row)}</p>
                              <p className="mt-1 text-xs leading-5 text-[var(--bf-muted)]">{eventDetail(row)}</p>
                              {summary ? <p className={cn("mt-1 text-[11px]", summary.note.startsWith("Не завершено") ? "text-[#e99990]" : "text-[#9dd0a0]")}>{summary.note}</p> : null}
                            </div>
                            <time className="shrink-0 text-[10px] text-[var(--bf-dim)]">{formatDateTime(row.created_at)}</time>
                          </div>
                          <p className="mt-1 text-[10px] text-[var(--bf-dim)]">{row.entity_type === "position_shift_window_summary" ? "Сформировано автоматически" : `Кто изменил: ${actorName}`}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 border-t border-[var(--bf-line)] pt-3 text-xs text-[var(--bf-dim)]">Событий пока нет.</p>
                )}

                {group.rows.length > visible.length ? (
                  <p className="mt-2 text-[11px] text-[var(--bf-dim)]">Показаны последние {visible.length} из {group.rows.length} событий.</p>
                ) : null}
              </Surface>
            );
          })}
        </div>
      )}
    </section>
  );
}
