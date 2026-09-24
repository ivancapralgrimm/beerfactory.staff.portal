import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Loader2,
  LogOut,
  Settings2,
  ShieldCheck
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  Link,
  useNavigate
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import {
  updateStaffProfile
} from "@/features/auth/auth-api";
import { useAuth } from "@/features/auth/auth-context";
import {
  NotificationSettingsCard
} from "@/features/notifications/NotificationSettingsCard";
import {
  STAFF_POSITION_LABELS,
  type StaffPosition
} from "@/types/auth";
import { cn } from "@/lib/utils";

const POSITIONS = (
  Object.keys(STAFF_POSITION_LABELS) as StaffPosition[]
);

function accessLabel(
  role: string | null | undefined,
  isOwner: boolean | null | undefined
) {
  if (isOwner) return "Владелец";
  if (role === "admin") return "Администратор";
  if (role === "manager") return "Менеджерские права";
  if (role === "senior") return "Старший сотрудник";
  return "Сотрудник";
}

export function ProfilePage() {
  const navigate = useNavigate();
  const {
    state,
    logout,
    refreshProfile
  } = useAuth();

  const [selectedPosition, setSelectedPosition] =
    useState<StaffPosition | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [savingPosition, setSavingPosition] = useState(false);
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const user =
    state.status === "authenticated" ? state.user : null;

  useEffect(() => {
    setSelectedPosition(user?.position_code || null);
    setBirthDate(user?.birth_date || "");
  }, [user?.position_code, user?.birth_date]);

  const positionDirty = useMemo(
    () =>
      Boolean(
        selectedPosition &&
        selectedPosition !== (user?.position_code || null)
      ),
    [selectedPosition, user?.position_code]
  );

  const birthdayDirty =
    birthDate !== (user?.birth_date || "");

  if (state.status !== "authenticated" || !user) {
    return null;
  }

  const accessToken = state.session.access_token;

  const fullName = [
    user.first_name,
    user.last_name
  ]
    .filter(Boolean)
    .join(" ");

  async function savePosition() {
    if (
      !selectedPosition ||
      !positionDirty ||
      savingPosition
    ) {
      return;
    }

    setSavingPosition(true);
    setMessage(null);

    try {
      await updateStaffProfile(
        accessToken,
        { positionCode: selectedPosition }
      );
      await refreshProfile();
      setMessage({
        tone: "success",
        text: "Должность сохранена. Раздел «Смена» будет использовать её чек-лист."
      });
    } catch {
      setMessage({
        tone: "error",
        text: "Не удалось сохранить должность. Изменение не применено."
      });
    } finally {
      setSavingPosition(false);
    }
  }

  async function saveBirthday() {
    if (!birthdayDirty || savingBirthday) return;

    setSavingBirthday(true);
    setMessage(null);

    try {
      await updateStaffProfile(
        accessToken,
        { birthDate: birthDate || null }
      );
      await refreshProfile();
      setMessage({
        tone: "success",
        text: birthDate
          ? "Дата рождения сохранена."
          : "Дата рождения удалена из профиля."
      });
    } catch {
      setMessage({
        tone: "error",
        text: "Не удалось сохранить дату рождения."
      });
    } finally {
      setSavingBirthday(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <section className="bf-profile-page mx-auto max-w-2xl pb-6">
      <p className="eyebrow">ЛИЧНЫЙ ПРОФИЛЬ</p>
      <h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">
        {fullName || "Сотрудник"}
      </h1>

      <Surface className="mt-5 p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface-2)]">
            <ShieldCheck
              className="size-5 text-[var(--bf-gold)]"
              aria-hidden
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">ДОСТУП</p>
            <p className="mt-1 text-lg font-black text-[var(--bf-cream)]">
              {accessLabel(user.role, user.is_owner)}
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--bf-muted)]">
              Права доступа и рабочая должность разделены. Выбор должности не выдаёт административные права.
            </p>

            {user.role === "admin" ? (
              <Button
                asChild
                variant="secondary"
                className="mt-3"
              >
                <Link to="/admin">
                  <Settings2
                    className="size-4"
                    aria-hidden
                  />
                  Управление персоналом
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </Surface>

      <Surface className="mt-3 p-4">
        <div className="flex items-start gap-3">
          <BriefcaseBusiness
            className="mt-0.5 size-5 shrink-0 text-[var(--bf-copper-hi)]"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">ДОЛЖНОСТЬ</p>
            <h2 className="mt-1 text-xl font-black">
              Рабочая должность
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--bf-muted)]">
              Определяет, какой чек-лист открытия и закрытия показывается в разделе «Смена».
            </p>
          </div>
        </div>

        <div
          className="mt-4 grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label="Рабочая должность"
        >
          {POSITIONS.map((position) => {
            const selected =
              position === selectedPosition;

            return (
              <button
                key={position}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setSelectedPosition(position);
                  setMessage(null);
                }}
                className={cn(
                  "relative min-h-14 rounded-xl border px-2 py-3 text-center text-sm font-extrabold outline-none transition-[background-color,border-color,transform] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)] active:translate-y-px",
                  selected
                    ? "border-[var(--bf-copper-hi)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_78%)] text-[var(--bf-cream)]"
                    : "border-[var(--bf-line)] bg-[var(--bf-surface-2)] text-[var(--bf-muted)]"
                )}
              >
                {selected ? (
                  <Check
                    className="absolute right-1.5 top-1.5 size-3.5 text-[var(--bf-copper-hi)]"
                    aria-hidden
                  />
                ) : null}
                {STAFF_POSITION_LABELS[position]}
              </button>
            );
          })}
        </div>

        {!user.position_code ? (
          <p className="mt-3 rounded-xl border border-[color:color-mix(in_srgb,var(--bf-gold),transparent_60%)] bg-[color:color-mix(in_srgb,var(--bf-gold),transparent_92%)] px-3 py-2 text-xs leading-5 text-[var(--bf-muted)]">
            Пока должность не выбрана, позиционная смена недоступна.
          </p>
        ) : null}

        <Button
          type="button"
          variant="primary"
          className="mt-4 w-full"
          disabled={!positionDirty || savingPosition}
          onClick={savePosition}
        >
          {savingPosition ? (
            <Loader2
              className="size-4 animate-spin"
              aria-hidden
            />
          ) : (
            <BriefcaseBusiness
              className="size-4"
              aria-hidden
            />
          )}
          {savingPosition
            ? "Сохраняем…"
            : "Сохранить должность"}
        </Button>
      </Surface>

      <Surface className="mt-3 p-4">
        <div className="flex items-start gap-3">
          <CalendarDays
            className="mt-0.5 size-5 shrink-0 text-[var(--bf-gold)]"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">ДЕНЬ РОЖДЕНИЯ</p>
            <h2 className="mt-1 text-xl font-black">
              Для внутренних напоминаний
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--bf-muted)]">
              Используется для поздравлений и будущего блока «Сегодня» на главной.
            </p>
          </div>
        </div>

        <input
          type="date"
          value={birthDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(event) => {
            setBirthDate(event.target.value);
            setMessage(null);
          }}
          className="mt-4 min-h-12 w-full rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-sm font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
        />

        <Button
          type="button"
          variant="secondary"
          className="mt-3 w-full"
          disabled={!birthdayDirty || savingBirthday}
          onClick={saveBirthday}
        >
          {savingBirthday ? (
            <Loader2
              className="size-4 animate-spin"
              aria-hidden
            />
          ) : (
            <CalendarDays
              className="size-4"
              aria-hidden
            />
          )}
          {savingBirthday
            ? "Сохраняем…"
            : "Сохранить дату рождения"}
        </Button>
      </Surface>

      <p
        className={cn(
          "mt-3 min-h-5 text-xs leading-5",
          message?.tone === "error"
            ? "text-[#e99990]"
            : "text-[#9dd0a0]"
        )}
        role="status"
        aria-live="polite"
      >
        {message?.text || ""}
      </p>

      <NotificationSettingsCard accessToken={accessToken} />

      <Button
        variant="danger"
        className="mt-5 w-full"
        onClick={handleLogout}
      >
        <LogOut className="size-4" aria-hidden />
        Выйти из аккаунта
      </Button>
    </section>
  );
}
