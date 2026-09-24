import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  ClipboardCheck,
  RefreshCw,
  Search,
  ScrollText,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import {
  AdminApiError,
  loadAdminUsers,
  mutateAdminUser
} from "@/features/admin/admin-api";
import {
  AdminAuditPanel
} from "@/features/admin/AdminAuditPanel";
import {
  AdminAttemptsPanel
} from "@/features/admin/AdminAttemptsPanel";
import {
  AdminConfirmDialog
} from "@/features/admin/AdminConfirmDialog";
import {
  AdminUserCard
} from "@/features/admin/AdminUserCard";
import type {
  AdminMutation,
  AdminSelf,
  AdminUser
} from "@/features/admin/types";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";

type Tab = "team" | "attempts" | "audit";

type ConfirmState =
  | {
      kind: "toggle";
      user: AdminUser;
    }
  | {
      kind: "delete";
      user: AdminUser;
    }
  | null;

function userName(user: AdminUser) {
  return [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ") || "Сотрудник";
}

function errorText(error: unknown) {
  if (!(error instanceof AdminApiError)) {
    return "Не удалось выполнить административное действие.";
  }

  switch (error.code) {
    case "owner_required":
      return "Это действие доступно только владельцу.";
    case "owner_protected":
      return "Аккаунт владельца защищён.";
    case "cannot_demote_self":
      return "Нельзя снять административные права с самого себя.";
    case "cannot_disable_self":
      return "Нельзя отключить собственный доступ.";
    case "cannot_delete_self":
      return "Нельзя удалить собственный аккаунт.";
    case "invalid_role":
      return "Недопустимый уровень доступа.";
    case "invalid_position":
      return "Недопустимая рабочая должность.";
    default:
      return "Изменение не применено.";
  }
}

export function AdminPage() {
  const { state } = useAuth();
  const [tab, setTab] = useState<Tab>("team");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [me, setMe] = useState<AdminSelf | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [actionMessage, setActionMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const authenticated =
    state.status === "authenticated";
  const isAdmin =
    authenticated && state.user.role === "admin";
  const accessToken =
    authenticated ? state.session.access_token : null;

  const load = useCallback(async (quiet = false) => {
    if (!accessToken || !isAdmin) return;

    if (!quiet) setLoading(true);
    setError(null);

    try {
      const data = await loadAdminUsers(accessToken);
      setUsers(data.users);
      setMe(data.me);
    } catch {
      setError("Не удалось загрузить управление персоналом.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [accessToken, isAdmin]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return users;

    return users.filter((user) =>
      [
        user.first_name,
        user.last_name,
        user.position,
        user.role
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [users, search]);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.is_active).length,
      admins: users.filter((user) => user.role === "admin").length,
      noPosition: users.filter((user) => !user.position_code).length
    }),
    [users]
  );

  async function mutate(
    mutation: AdminMutation
  ) {
    if (!accessToken) {
      throw new Error("unauthorized");
    }

    setPendingId(mutation.user_id);
    setActionMessage(null);

    try {
      await mutateAdminUser(accessToken, mutation);
      await load(true);
      setActionMessage({
        tone: "success",
        text: "Изменение сохранено."
      });
    } catch (actionError) {
      setActionMessage({
        tone: "error",
        text: errorText(actionError)
      });
      throw actionError;
    } finally {
      setPendingId(null);
    }
  }

  async function confirmAction() {
    if (!confirm) return;

    const current = confirm;

    try {
      if (current.kind === "toggle") {
        await mutate({
          action: "set_active",
          user_id: current.user.id,
          is_active: !current.user.is_active
        });
      } else {
        await mutate({
          action: "delete_user",
          user_id: current.user.id
        });
      }
      setConfirm(null);
    } catch {
      // Message is already surfaced above.
    }
  }

  if (!authenticated) return null;

  if (!isAdmin) {
    return <Navigate to="/profile" replace />;
  }

  const tabs: Array<{
    value: Tab;
    label: string;
    icon: typeof UsersRound;
  }> = [
    {
      value: "team",
      label: "Команда",
      icon: UsersRound
    },
    {
      value: "attempts",
      label: "Аттестации",
      icon: ClipboardCheck
    },
    {
      value: "audit",
      label: "Журнал",
      icon: ScrollText
    }
  ];

  return (
    <section className="bf-admin-page mx-auto max-w-4xl pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">АДМИНИСТРИРОВАНИЕ</p>
          <h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">
            Команда и доступ
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--bf-muted)]">
            Рабочая должность и права доступа управляются отдельно. Изменение должности не выдаёт административные права.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Обновить админ-панель"
          disabled={loading}
          onClick={() => void load(false)}
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

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface)] p-1.5">
        {tabs.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-black",
              tab === value
                ? "border-[var(--bf-copper-hi)] bg-[var(--bf-surface-2)] text-[var(--bf-cream)]"
                : "border-transparent text-[var(--bf-dim)]"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <p
        className={cn(
          "mt-3 min-h-5 text-xs leading-5",
          actionMessage?.tone === "error"
            ? "text-[#e99990]"
            : "text-[#9dd0a0]"
        )}
        role="status"
        aria-live="polite"
      >
        {actionMessage?.text || ""}
      </p>

      {tab === "team" ? (
        <div className="mt-1">
          <div className="grid grid-cols-4 gap-2">
            {[
              ["Всего", stats.total],
              ["Активны", stats.active],
              ["Админы", stats.admins],
              ["Без должности", stats.noPosition]
            ].map(([label, value]) => (
              <Surface
                key={String(label)}
                className="p-2.5 text-center"
              >
                <span className="text-[9px] font-black uppercase tracking-[0.06em] text-[var(--bf-dim)]">
                  {label}
                </span>
                <strong className="mt-1 block text-xl">
                  {value}
                </strong>
              </Surface>
            ))}
          </div>

          <label className="relative mt-3 block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--bf-dim)]"
              aria-hidden
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Имя, должность или роль"
              className="min-h-12 w-full rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface)] pl-10 pr-3 text-sm text-[var(--bf-cream)] outline-none placeholder:text-[var(--bf-dim)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
            />
          </label>

          {loading ? (
            <div className="mt-3 grid gap-2">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-64 animate-pulse rounded-[22px] bg-[var(--bf-surface)]"
                />
              ))}
            </div>
          ) : error ? (
            <Surface className="mt-3 p-4 text-sm text-[#e99990]">
              {error}
            </Surface>
          ) : filtered.length && me ? (
            <div className="mt-3 grid gap-3">
              {filtered.map((user) => (
                <AdminUserCard
                  key={user.id}
                  user={user}
                  me={me}
                  pending={pendingId === user.id}
                  onMutate={mutate}
                  onRequestToggle={(item) =>
                    setConfirm({
                      kind: "toggle",
                      user: item
                    })
                  }
                  onRequestDelete={(item) =>
                    setConfirm({
                      kind: "delete",
                      user: item
                    })
                  }
                />
              ))}
            </div>
          ) : (
            <Surface className="mt-3 p-5 text-center text-sm text-[var(--bf-muted)]">
              Сотрудники по этому запросу не найдены.
            </Surface>
          )}
        </div>
      ) : null}

      {tab === "attempts" ? (
        <div className="mt-2">
          <AdminAttemptsPanel users={users} />
        </div>
      ) : null}

      {tab === "audit" ? (
        <div className="mt-2">
          <AdminAuditPanel users={users} />
        </div>
      ) : null}

      <AdminConfirmDialog
        open={Boolean(confirm)}
        title={
          confirm?.kind === "delete"
            ? `Удалить ${confirm ? userName(confirm.user) : "пользователя"}?`
            : confirm?.user.is_active
              ? `Отключить доступ ${confirm ? userName(confirm.user) : "сотруднику"}?`
              : `Включить доступ ${confirm ? userName(confirm.user) : "сотруднику"}?`
        }
        description={
          confirm?.kind === "delete"
            ? "Будут удалены Auth-аккаунт и персональные данные. Общие операционные ссылки будут очищены. Действие необратимо."
            : confirm?.user.is_active
              ? "Сотрудник больше не сможет войти в портал до повторного включения доступа."
              : "Сотрудник снова сможет использовать портал со своими текущими данными входа."
        }
        confirmLabel={
          confirm?.kind === "delete"
            ? "Удалить навсегда"
            : confirm?.user.is_active
              ? "Отключить"
              : "Включить"
        }
        requirePhrase={
          confirm?.kind === "delete"
            ? "УДАЛИТЬ"
            : undefined
        }
        pending={Boolean(
          confirm && pendingId === confirm.user.id
        )}
        onCancel={() => {
          if (!pendingId) setConfirm(null);
        }}
        onConfirm={() => void confirmAction()}
      />
    </section>
  );
}
