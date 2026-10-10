import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  RefreshCw,
  Search,
  ScrollText,
  UsersRound
} from "lucide-react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { AdminApiError, loadAdminUsers, mutateAdminUser } from "@/features/admin/admin-api";
import { AdminAuditPanel } from "@/features/admin/AdminAuditPanel";
import { AdminAttemptsPanel } from "@/features/admin/AdminAttemptsPanel";
import { AdminConfirmDialog } from "@/features/admin/AdminConfirmDialog";
import { AdminUserCard } from "@/features/admin/AdminUserCard";
import type { AdminMutation, AdminSelf, AdminUser } from "@/features/admin/types";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";
import { canManageStaffClient, staffAccessLabel, STAFF_POSITION_LABELS } from "@/types/auth";

type AdminSection = "team" | "attempts" | "audit";
type ConfirmState =
  | { kind: "toggle"; user: AdminUser }
  | { kind: "delete"; user: AdminUser }
  | null;

function userName(user: AdminUser) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || "Сотрудник";
}

function errorText(error: unknown) {
  if (!(error instanceof AdminApiError)) return "Не удалось сохранить изменение.";
  switch (error.code) {
    case "owner_required": return "Это действие доступно только владельцу.";
    case "owner_protected": return "Аккаунт владельца защищён.";
    case "cannot_demote_self": return "Нельзя изменить собственные права.";
    case "cannot_disable_self": return "Нельзя отключить собственный доступ.";
    case "cannot_delete_self": return "Нельзя удалить собственный аккаунт.";
    case "invalid_role": return "Выберите другой уровень доступа.";
    case "invalid_position": return "Выберите другую должность.";
    default: return "Изменение не применено.";
  }
}

function AdminMenuRow({
  section,
  icon: Icon,
  title,
  description
}: {
  section: AdminSection;
  icon: typeof UsersRound;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={`/admin?section=${section}`}
      className="group flex min-h-[70px] items-center gap-3 rounded-xl px-2 py-3 outline-none transition-colors hover:bg-[var(--bf-surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)]">
        <Icon className="size-5 text-[var(--bf-copper-hi)]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-[var(--bf-cream)]">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-[var(--bf-muted)]">{description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-[var(--bf-dim)] transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function AdminSectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4">
      <Link
        to="/admin"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold text-[var(--bf-muted)] outline-none hover:text-[var(--bf-cream)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
      >
        <ArrowLeft className="size-4" aria-hidden /> Управление персоналом
      </Link>
      <h1 className="mt-2 text-[28px] font-black leading-tight tracking-[-0.035em] text-[var(--bf-cream)]">{children}</h1>
    </div>
  );
}

function AdminMemberRow({
  user,
  me,
  pending,
  onMutate,
  onRequestToggle,
  onRequestDelete
}: {
  user: AdminUser;
  me: AdminSelf;
  pending: boolean;
  onMutate: (mutation: AdminMutation) => Promise<void>;
  onRequestToggle: (user: AdminUser) => void;
  onRequestDelete: (user: AdminUser) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <details
      className="group rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface)]"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary className="flex min-h-[64px] cursor-pointer list-none items-center gap-3 rounded-2xl px-3 py-3 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)] [&::-webkit-details-marker]:hidden">
        <span className={cn("size-2 shrink-0 rounded-full", user.is_active ? "bg-[var(--bf-green)]" : "bg-[var(--bf-red)]")} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black text-[var(--bf-cream)]">{userName(user)}</span>
          <span className="mt-0.5 block truncate text-xs text-[var(--bf-muted)]">
            {user.position_code ? STAFF_POSITION_LABELS[user.position_code] : "Без должности"} · {staffAccessLabel(user)}
          </span>
        </span>
        <span className={cn("shrink-0 rounded-full border px-1.5 py-1 text-[10px] font-bold", user.is_active ? "border-[color:color-mix(in_srgb,var(--bf-green),transparent_60%)] text-[#9dd0a0]" : "border-[color:color-mix(in_srgb,var(--bf-red),transparent_60%)] text-[#e99990]")}>{user.is_active ? "Активен" : "Отключён"}</span>
        <ChevronDown className="size-4 shrink-0 text-[var(--bf-dim)] transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      {expanded ? (
        <div className="border-t border-[var(--bf-line)] p-2">
          <AdminUserCard
            user={user}
            me={me}
            pending={pending}
            onMutate={onMutate}
            onRequestToggle={onRequestToggle}
            onRequestDelete={onRequestDelete}
          />
        </div>
      ) : null}
    </details>
  );
}

export function AdminPage() {
  const { state } = useAuth();
  const [params] = useSearchParams();
  const requestedSection = params.get("section");
  const section: AdminSection | null =
    requestedSection === "team" || requestedSection === "attempts" || requestedSection === "audit"
      ? requestedSection
      : null;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [me, setMe] = useState<AdminSelf | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [actionMessage, setActionMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const authenticated = state.status === "authenticated";
  const canManageStaff = authenticated && canManageStaffClient(state.user);
  const accessToken = authenticated ? state.session.access_token : null;

  const load = useCallback(async (quiet = false) => {
    if (!accessToken || !canManageStaff) return;
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const data = await loadAdminUsers(accessToken);
      setUsers(data.users);
      setMe(data.me);
    } catch {
      setError("Не удалось загрузить команду.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [accessToken, canManageStaff]);

  useEffect(() => {
    if (section) void load(false);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [load, section]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.first_name, user.last_name, user.position, user.role]
        .filter(Boolean).join(" ").toLowerCase().includes(query)
    );
  }, [users, search]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.is_active).length,
    admins: users.filter((user) => user.role === "admin").length,
    noPosition: users.filter((user) => !user.position_code).length
  }), [users]);

  async function mutate(mutation: AdminMutation) {
    if (!accessToken) throw new Error("unauthorized");
    setPendingId(mutation.user_id);
    setActionMessage(null);
    try {
      await mutateAdminUser(accessToken, mutation);
      await load(true);
      setActionMessage({ tone: "success", text: "Изменение сохранено." });
    } catch (actionError) {
      setActionMessage({ tone: "error", text: errorText(actionError) });
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
        await mutate({ action: "set_active", user_id: current.user.id, is_active: !current.user.is_active });
      } else {
        await mutate({ action: "delete_user", user_id: current.user.id });
      }
      setConfirm(null);
    } catch {
      // Mutation error is displayed above the list.
    }
  }

  if (!authenticated) return null;
  if (!canManageStaff) return <Navigate to="/profile" replace />;

  if (!section) {
    return (
      <section className="bf-admin-page mx-auto max-w-4xl pb-8">
        <Link
          to="/profile"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold text-[var(--bf-muted)] outline-none hover:text-[var(--bf-cream)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
        >
          <ArrowLeft className="size-4" aria-hidden /> Личный кабинет
        </Link>
        <p className="eyebrow mt-2">АДМИНИСТРИРОВАНИЕ</p>
        <h1 className="mt-2 text-[clamp(27px,7vw,34px)] font-black leading-tight tracking-[-0.035em] text-[var(--bf-cream)]">Управление персоналом</h1>
        <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--bf-muted)]">Сотрудники, аттестации и журнал в отдельных разделах.</p>
        <Surface className="mt-5 p-3">
          <div className="divide-y divide-[var(--bf-line)]">
            <AdminMenuRow section="team" icon={UsersRound} title="Сотрудники" description="Список команды, должности и доступ" />
            <AdminMenuRow section="attempts" icon={ClipboardCheck} title="Аттестации" description="Результаты, вопросы и настройки" />
            <AdminMenuRow section="audit" icon={ScrollText} title="Журнал" description="Изменения персонала и рабочих процессов" />
          </div>
        </Surface>
      </section>
    );
  }

  return (
    <section className="bf-admin-page mx-auto max-w-4xl pb-8">
      <AdminSectionHeader>
        {section === "team" ? "Сотрудники" : section === "attempts" ? "Аттестации" : "Журнал"}
      </AdminSectionHeader>

      {section === "team" ? (
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">КОМАНДА</p>
            <Button type="button" variant="secondary" size="icon" aria-label="Обновить список сотрудников" disabled={loading} onClick={() => void load(false)}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
            {[["Всего", stats.total], ["Активны", stats.active], ["Админы", stats.admins], ["Без должности", stats.noPosition]].map(([label, value]) => (
              <Surface key={String(label)} className="min-w-0 p-2 text-center">
                <span className="block break-words text-[9px] font-bold leading-4 text-[var(--bf-dim)]">{label}</span>
                <strong className="mt-1 block text-lg font-black text-[var(--bf-cream)]">{value}</strong>
              </Surface>
            ))}
          </div>

          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--bf-dim)]" aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Найти сотрудника, должность или доступ"
              aria-label="Поиск сотрудника"
              className="min-h-12 w-full rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface)] pl-10 pr-3 text-base text-[var(--bf-cream)] outline-none placeholder:text-[var(--bf-dim)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
            />
          </label>

          <p className={cn("mt-2 text-xs leading-5", actionMessage?.tone === "error" ? "text-[#e99990]" : "text-[#9dd0a0]")} role="status" aria-live="polite">
            {actionMessage?.text || ""}
          </p>

          {loading ? (
            <div className="mt-3 grid gap-2">{[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-[var(--bf-surface)]" />)}</div>
          ) : error ? (
            <Surface className="mt-3 p-4 text-sm text-[#e99990]">
              {error}
              <Button type="button" variant="secondary" className="mt-3 w-full" onClick={() => void load(false)}>Повторить</Button>
            </Surface>
          ) : filtered.length && me ? (
            <div className="mt-3 grid gap-2">
              {filtered.map((user) => (
                <AdminMemberRow
                  key={user.id}
                  user={user}
                  me={me}
                  pending={pendingId === user.id}
                  onMutate={mutate}
                  onRequestToggle={(item) => setConfirm({ kind: "toggle", user: item })}
                  onRequestDelete={(item) => setConfirm({ kind: "delete", user: item })}
                />
              ))}
            </div>
          ) : (
            <Surface className="mt-3 p-5 text-center text-sm text-[var(--bf-muted)]">Сотрудники по этому запросу не найдены.</Surface>
          )}
        </div>
      ) : null}

      {section === "attempts" ? <AdminAttemptsPanel users={users} /> : null}
      {section === "audit" ? <AdminAuditPanel users={users} /> : null}

      <AdminConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.kind === "delete" ? `Удалить ${confirm ? userName(confirm.user) : "пользователя"}?` : confirm?.user.is_active ? `Отключить доступ ${confirm ? userName(confirm.user) : "сотруднику"}?` : `Включить доступ ${confirm ? userName(confirm.user) : "сотруднику"}?`}
        description={confirm?.kind === "delete" ? "Пользователь и его личные данные будут удалены. Действие необратимо." : confirm?.user.is_active ? "Сотрудник больше не сможет войти до повторного включения доступа." : "Сотрудник снова сможет войти в портал."}
        confirmLabel={confirm?.kind === "delete" ? "Удалить навсегда" : confirm?.user.is_active ? "Отключить" : "Включить"}
        requirePhrase={confirm?.kind === "delete" ? "УДАЛИТЬ" : undefined}
        pending={Boolean(confirm && pendingId === confirm.user.id)}
        onCancel={() => { if (!pendingId) setConfirm(null); }}
        onConfirm={() => void confirmAction()}
      />
    </section>
  );
}
