import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  RefreshCw,
  ScrollText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import {
  loadAdminAudit
} from "@/features/admin/admin-api";
import type {
  AdminAuditRow,
  AdminUser
} from "@/features/admin/types";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  recipe_governance_update: "Рецепт",
  profile_role_update: "Права доступа",
  profile_position_update: "Рабочая должность",
  profile_activation_update: "Доступ",
  credential_reset: "Безопасность",
  profile_delete: "Удаление",
  position_shift_open: "Открытие смены",
  position_shift_close: "Закрытие смены"
};

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

function detail(row: AdminAuditRow) {
  if (row.action === "profile_role_update") {
    return `Роль: ${String(row.before_data.role || "—")} → ${String(row.after_data.role || "—")}`;
  }

  if (row.action === "profile_position_update") {
    return `Должность: ${String(row.before_data.position || "—")} → ${String(row.after_data.position || "—")}`;
  }

  if (row.action === "profile_activation_update") {
    return `Доступ: ${row.before_data.is_active === false ? "отключён" : "активен"} → ${row.after_data.is_active === false ? "отключён" : "активен"}`;
  }

  if (row.action === "credential_reset") {
    return row.metadata.credential === "recovery_code"
      ? "Обновлён код восстановления"
      : "Обновлён код входа";
  }

  if (row.action === "profile_delete") {
    return "Пользователь удалён, персональные данные очищены.";
  }

  if (row.action === "recipe_governance_update") {
    const note = row.after_data.change_note;
    return note
      ? String(note)
      : "Изменены данные рецепта.";
  }

  return "Зафиксировано системное изменение.";
}

export function AdminAuditPanel({
  users
}: {
  users: AdminUser[];
}) {
  const [rows, setRows] = useState<AdminAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const userMap = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  );

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

  const groups = useMemo(
    () => [
      ...new Set(rows.map((row) => row.action))
    ],
    [rows]
  );

  const filtered = useMemo(
    () =>
      filter === "all"
        ? rows
        : rows.filter((row) => row.action === filter),
    [rows, filter]
  );

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">ЖУРНАЛ</p>
          <h2 className="mt-1 text-2xl font-black">
            Административные действия
          </h2>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Обновить журнал"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw
            className={cn(
              "size-4",
              loading && "animate-spin"
            )}
            aria-hidden
          />
        </Button>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 bf-scrollbar-none">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "min-h-11 shrink-0 rounded-xl border px-3 text-sm font-bold",
            filter === "all"
              ? "border-[var(--bf-copper-hi)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_82%)] text-[var(--bf-cream)]"
              : "border-[var(--bf-line)] bg-[var(--bf-surface)] text-[var(--bf-muted)]"
          )}
        >
          Все
        </button>
        {groups.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => setFilter(action)}
            className={cn(
              "min-h-11 shrink-0 rounded-xl border px-3 text-sm font-bold",
              filter === action
                ? "border-[var(--bf-copper-hi)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_82%)] text-[var(--bf-cream)]"
                : "border-[var(--bf-line)] bg-[var(--bf-surface)] text-[var(--bf-muted)]"
            )}
          >
            {ACTION_LABELS[action] || action}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-3 grid gap-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-[20px] bg-[var(--bf-surface)]"
            />
          ))}
        </div>
      ) : error ? (
        <Surface className="mt-3 p-4 text-sm text-[#e99990]">
          {error}
        </Surface>
      ) : filtered.length ? (
        <div className="mt-3 grid gap-2">
          {filtered.map((row) => {
            const actor = row.actor_id
              ? userMap.get(row.actor_id)
              : null;
            const actorName = actor
              ? [actor.first_name, actor.last_name]
                  .filter(Boolean)
                  .join(" ")
              : "Система / удалённый пользователь";

            return (
              <Surface key={row.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface-2)]">
                    <ScrollText
                      className="size-4 text-[var(--bf-copper-hi)]"
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-[0.08em] text-[var(--bf-copper-hi)]">
                        {ACTION_LABELS[row.action] || row.action}
                      </span>
                      <span className="text-[10px] text-[var(--bf-dim)]">
                        {formatDateTime(row.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-black text-[var(--bf-cream)]">
                      {row.entity_name || row.entity_type}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--bf-muted)]">
                      {detail(row)}
                    </p>
                    <p className="mt-2 text-[10px] text-[var(--bf-dim)]">
                      Выполнил: {actorName}
                    </p>
                  </div>
                </div>
              </Surface>
            );
          })}
        </div>
      ) : (
        <Surface className="mt-3 p-5 text-center text-sm text-[var(--bf-muted)]">
          В журнале пока нет записей по этому фильтру.
        </Surface>
      )}
    </section>
  );
}
