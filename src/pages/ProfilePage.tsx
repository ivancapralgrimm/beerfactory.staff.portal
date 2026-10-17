import {
  ArrowLeft,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Loader2,
  LogOut,
  Settings2,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { updateStaffProfile } from "@/features/auth/auth-api";
import { useAuth } from "@/features/auth/auth-context";
import { NotificationSettingsCard } from "@/features/notifications/NotificationSettingsCard";
import {
  STAFF_POSITION_LABELS,
  staffAccessLabel,
  canManageStaffClient,
  type StaffPosition
} from "@/types/auth";
import { cn } from "@/lib/utils";

const POSITIONS = Object.keys(STAFF_POSITION_LABELS) as StaffPosition[];

type ProfileView = "home" | "details" | "notifications";

function formatPositionChangeTime(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function ProfileMenuRow({
  to,
  icon: Icon,
  title,
  description
}: {
  to: string;
  icon: typeof UserRound;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex min-h-[66px] items-center gap-3 rounded-xl px-2 py-3 outline-none transition-colors hover:bg-[var(--bf-surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
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

function ProfileSubheader({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4">
      <Link
        to="/profile"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold text-[var(--bf-muted)] outline-none hover:text-[var(--bf-cream)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
      >
        <ArrowLeft className="size-4" aria-hidden /> Личный кабинет
      </Link>
      <h1 className="mt-2 text-[28px] font-black leading-tight tracking-[-0.035em] text-[var(--bf-cream)]">{children}</h1>
    </div>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedView = params.get("view");
  const view: ProfileView =
    requestedView === "details" || requestedView === "notifications"
      ? requestedView
      : "home";

  const { state, logout, refreshProfile } = useAuth();
  const user = state.status === "authenticated" ? state.user : null;
  const [selectedPosition, setSelectedPosition] = useState<StaffPosition | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [savingPosition, setSavingPosition] = useState(false);
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setSelectedPosition(user?.position_code || null);
    setBirthDate(user?.birth_date || "");
  }, [user?.position_code, user?.birth_date]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setMessage(null);
  }, [view]);

  const positionLocked = user?.position_change_allowed === false;
  const positionDirty = useMemo(
    () => Boolean(selectedPosition && selectedPosition !== (user?.position_code || null)),
    [selectedPosition, user?.position_code]
  );
  const birthdayDirty = birthDate !== (user?.birth_date || "");

  if (state.status !== "authenticated" || !user) return null;

  const accessToken = state.session.access_token;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Сотрудник";
  const positionName = user.position_code
    ? STAFF_POSITION_LABELS[user.position_code]
    : "Должность не выбрана";
  const nextPositionChangeLabel = formatPositionChangeTime(user.position_change_available_at);
  const positionLockText = user.position_change_reason === "window_locked"
    ? "Должность можно изменить с 11:00 до 02:59."
    : "Должность уже менялась в эту смену.";

  async function savePosition() {
    if (!selectedPosition || !positionDirty || positionLocked || savingPosition) return;
    setSavingPosition(true);
    setMessage(null);
    try {
      await updateStaffProfile(accessToken, { positionCode: selectedPosition });
      await refreshProfile();
      setMessage({ tone: "success", text: "Должность сохранена." });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "position_change_next_window" || code === "position_change_window_locked") {
        await refreshProfile();
        setMessage({
          tone: "error",
          text: code === "position_change_window_locked"
            ? "Сейчас должность изменить нельзя."
            : "Должность уже менялась в эту смену."
        });
      } else {
        setMessage({ tone: "error", text: "Не удалось сохранить должность. Изменение не применено." });
      }
    } finally {
      setSavingPosition(false);
    }
  }

  async function saveBirthday() {
    if (!birthdayDirty || savingBirthday) return;
    setSavingBirthday(true);
    setMessage(null);
    try {
      await updateStaffProfile(accessToken, { birthDate: birthDate || null });
      await refreshProfile();
      setMessage({
        tone: "success",
        text: birthDate ? "Дата рождения сохранена." : "Дата рождения удалена из профиля."
      });
    } catch {
      setMessage({ tone: "error", text: "Не удалось сохранить дату рождения." });
    } finally {
      setSavingBirthday(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  if (view === "notifications") {
    return (
      <section className="bf-profile-page mx-auto max-w-2xl pb-6">
        <ProfileSubheader>Уведомления</ProfileSubheader>
        <NotificationSettingsCard accessToken={accessToken} />
      </section>
    );
  }

  if (view === "details") {
    return (
      <section className="bf-profile-page mx-auto max-w-2xl pb-6">
        <ProfileSubheader>Личные данные</ProfileSubheader>
        <Surface className="p-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-[var(--bf-gold)]" aria-hidden />
            <h2 className="text-base font-black text-[var(--bf-cream)]">Дата рождения</h2>
          </div>
          <div className="mt-3 h-11 w-full min-w-0 overflow-hidden rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] focus-within:ring-2 focus-within:ring-[var(--bf-copper-hi)]">
            <input
              type="date"
              aria-label="Дата рождения"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => { setBirthDate(event.target.value); setMessage(null); }}
              className="bf-birthday-input block h-full w-full min-w-0 max-w-full border-0 bg-transparent px-3 py-0 text-base font-bold text-[var(--bf-cream)] outline-none"
              style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", boxShadow: "none" }}
            />
          </div>
          {birthdayDirty ? (
            <Button type="button" variant="secondary" className="mt-3 w-full" disabled={savingBirthday} onClick={() => void saveBirthday()}>
              {savingBirthday ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarDays className="size-4" aria-hidden />}
              {savingBirthday ? "Сохраняем…" : "Сохранить дату рождения"}
            </Button>
          ) : null}
        </Surface>

        <Surface className="mt-3 p-4">
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="size-5 text-[var(--bf-copper-hi)]" aria-hidden />
            <h2 className="text-base font-black text-[var(--bf-cream)]">Рабочая должность</h2>
          </div>
          <div className="relative mt-3">
            <select
              value={selectedPosition || ""}
              disabled={positionLocked || savingPosition}
              aria-label="Рабочая должность"
              onChange={(event) => {
                setSelectedPosition(event.target.value ? event.target.value as StaffPosition : null);
                setMessage(null);
              }}
              className="h-11 min-h-11 w-full appearance-none rounded-xl border border-[var(--bf-line-strong)] bg-[var(--bf-surface-2)] px-3 pr-11 text-base font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <option value="" disabled>Не задана</option>
              {POSITIONS.map((position) => (
                <option key={position} value={position}>{STAFF_POSITION_LABELS[position]}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-[var(--bf-muted)]" aria-hidden />
          </div>
          {positionLocked ? (
            <p className="mt-3 rounded-xl border border-[color:color-mix(in_srgb,var(--bf-gold),transparent_60%)] bg-[color:color-mix(in_srgb,var(--bf-gold),transparent_92%)] px-3 py-2 text-xs leading-5 text-[var(--bf-muted)]">
              {positionLockText}{nextPositionChangeLabel ? ` Следующая возможность: ${nextPositionChangeLabel}.` : ""}
            </p>
          ) : !user.position_code ? (
            <p className="mt-3 text-xs leading-5 text-[var(--bf-muted)]">Пока должность не выбрана, позиционная смена недоступна.</p>
          ) : (
            <p className="mt-3 text-xs leading-5 text-[var(--bf-dim)]">Сменить должность можно один раз за рабочую смену.</p>
          )}
          {positionDirty && !positionLocked ? (
            <Button type="button" variant="primary" className="mt-3 w-full" disabled={savingPosition} onClick={() => void savePosition()}>
              {savingPosition ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BriefcaseBusiness className="size-4" aria-hidden />}
              {savingPosition ? "Сохраняем…" : "Сохранить должность"}
            </Button>
          ) : null}
        </Surface>

        {message ? (
          <p className={cn("mt-3 rounded-xl border border-[var(--bf-line)] px-3 py-2 text-sm", message.tone === "error" ? "text-[#e99990]" : "text-[#9dd0a0]")} role="status" aria-live="polite">
            {message.text}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="bf-profile-page mx-auto max-w-2xl pb-6">
      <p className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</p>
      <div className="craft-profile-id">
        <div className="craft-profile-photo" aria-hidden="true">
          <img src="/assets/icons/profile-avatar.png" alt="" width="96" height="96" />
        </div>
        <div className="min-w-0">
          <p className="craft-profile-heading">BFSTAFF</p>
          <h1 className="mt-2 break-words text-[clamp(24px,6.5vw,34px)] font-black leading-tight tracking-[-0.035em]">{fullName}</h1>
          <p className="mt-1 text-sm text-[var(--bf-muted)]">{positionName}</p>
          <p className="mt-1 text-xs font-bold text-[var(--bf-copper-hi)]">{staffAccessLabel(user)}</p>
        </div>
      </div>

      <Surface className="mt-5 p-3">
        <p className="eyebrow px-2 pt-1">МОЁ</p>
        <div className="mt-2 divide-y divide-[var(--bf-line)]">
          <ProfileMenuRow to="/profile?view=details" icon={UserRound} title="Личные данные" description="Дата рождения и рабочая должность" />
          <ProfileMenuRow to="/profile?view=notifications" icon={Bell} title="Уведомления" description="Оповещения Ленты на этом устройстве" />
        </div>
      </Surface>

      {canManageStaffClient(user) ? (
        <Surface className="mt-3 p-3">
          <p className="eyebrow px-2 pt-1">АДМИНИСТРИРОВАНИЕ</p>
          <div className="mt-2">
            <ProfileMenuRow to="/admin" icon={Settings2} title="Управление персоналом" description="Сотрудники, аттестации и журнал" />
          </div>
        </Surface>
      ) : null}

      <Surface className="mt-3 p-3">
        <button type="button" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-bold text-[#e99990] outline-none hover:bg-[var(--bf-surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]" onClick={() => void handleLogout()}>
          <LogOut className="size-5 shrink-0" aria-hidden /> Выйти из аккаунта
        </button>
      </Surface>
    </section>
  );
}
