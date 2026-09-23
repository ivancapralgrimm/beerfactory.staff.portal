import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  UserRoundX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import {
  ACCESS_ROLE_LABELS,
  type AdminMutation,
  type AdminSelf,
  type AdminUser
} from "@/features/admin/types";
import {
  STAFF_POSITION_LABELS,
  type StaffPosition,
  type StaffRole
} from "@/types/auth";
import { cn } from "@/lib/utils";

const ROLES = Object.keys(
  ACCESS_ROLE_LABELS
) as StaffRole[];

const POSITIONS = Object.keys(
  STAFF_POSITION_LABELS
) as StaffPosition[];

function formatDate(value: string | null) {
  if (!value) return "Не указана";

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(new Date(`${value}T12:00:00Z`));
  } catch {
    return value;
  }
}

function formatDateTime(value: string | null) {
  if (!value) return "Нет данных";

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
    return "Нет данных";
  }
}

export function AdminUserCard({
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
  const [role, setRole] = useState<StaffRole>(user.role);
  const [position, setPosition] =
    useState<StaffPosition | "">(
      user.position_code || ""
    );
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setRole(user.role);
    setPosition(user.position_code || "");
  }, [user.role, user.position_code]);

  const isSelf = user.id === me.id;

  const roleLocked =
    user.is_owner ||
    isSelf ||
    (!me.is_owner && user.role === "admin");

  const activeLocked =
    user.is_owner ||
    isSelf ||
    (!me.is_owner && user.role === "admin");

  const positionLocked =
    user.is_owner && !isSelf;

  const securityLocked =
    !me.is_owner &&
    user.role === "admin" &&
    !isSelf;

  const canDelete =
    !isSelf &&
    !user.is_owner &&
    (me.is_owner || user.role !== "admin");

  const allowedRoles = useMemo(() => {
    if (me.is_owner) return ROLES;
    return ROLES.filter(
      (item) => item !== "admin"
    );
  }, [me.is_owner]);

  const roleDirty = role !== user.role;
  const positionDirty =
    (position || null) !==
    (user.position_code || null);

  const codeOk = (value: string) =>
    /^\d{4,12}$/.test(value.trim());

  async function run(
    mutation: AdminMutation,
    successText: string
  ) {
    setMessage(null);

    try {
      await onMutate(mutation);
      setMessage({
        tone: "success",
        text: successText
      });
      return true;
    } catch {
      setMessage({
        tone: "error",
        text: "Изменение не применено."
      });
      return false;
    }
  }

  const fullName = [
    user.first_name,
    user.last_name
  ]
    .filter(Boolean)
    .join(" ") || "Сотрудник";

  return (
    <Surface
      className={cn(
        "p-4",
        !user.is_active && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {user.is_owner ? (
              <span className="rounded-full border border-[color:color-mix(in_srgb,var(--bf-gold),transparent_50%)] bg-[color:color-mix(in_srgb,var(--bf-gold),transparent_90%)] px-2 py-1 text-[10px] font-black text-[var(--bf-gold)]">
                ВЛАДЕЛЕЦ
              </span>
            ) : null}
            {isSelf ? (
              <span className="rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-2 py-1 text-[10px] font-black text-[var(--bf-muted)]">
                ВЫ
              </span>
            ) : null}
            <span
              className={cn(
                "rounded-full border px-2 py-1 text-[10px] font-black",
                user.is_active
                  ? "border-[color:color-mix(in_srgb,var(--bf-green),transparent_58%)] text-[#a8d2ab]"
                  : "border-[color:color-mix(in_srgb,var(--bf-red),transparent_58%)] text-[#e99990]"
              )}
            >
              {user.is_active
                ? "АКТИВЕН"
                : "ОТКЛЮЧЁН"}
            </span>
          </div>

          <h3 className="mt-2 break-words text-xl font-black text-[var(--bf-cream)]">
            {fullName}
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--bf-dim)]">
            Последняя активность: {formatDateTime(user.last_seen_at)}
          </p>
        </div>

        <div className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface-2)]">
          <ShieldCheck
            className="size-5 text-[var(--bf-copper-hi)]"
            aria-hidden
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck
              className="size-4 text-[var(--bf-gold)]"
              aria-hidden
            />
            <span className="text-xs font-black uppercase tracking-[0.08em] text-[var(--bf-dim)]">
              Права доступа
            </span>
          </div>

          <select
            value={role}
            disabled={roleLocked || pending}
            onChange={(event) =>
              setRole(
                event.target.value as StaffRole
              )
            }
            className="mt-2 min-h-11 w-full rounded-xl border border-[var(--bf-line)] bg-[var(--bf-bg)] px-3 text-sm font-bold text-[var(--bf-cream)] outline-none disabled:opacity-55 focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
          >
            {(roleLocked && !allowedRoles.includes(user.role)
              ? [user.role]
              : allowedRoles
            ).map((item) => (
              <option key={item} value={item}>
                {ACCESS_ROLE_LABELS[item]}
              </option>
            ))}
          </select>

          <Button
            type="button"
            variant="secondary"
            className="mt-2 w-full"
            disabled={
              pending ||
              roleLocked ||
              !roleDirty
            }
            onClick={() =>
              void run(
                {
                  action: "set_role",
                  user_id: user.id,
                  role
                },
                "Права доступа обновлены."
              )
            }
          >
            <Save className="size-4" aria-hidden />
            Сохранить доступ
          </Button>
        </div>

        <div className="rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] p-3">
          <div className="flex items-center gap-2">
            <BriefcaseBusiness
              className="size-4 text-[var(--bf-copper-hi)]"
              aria-hidden
            />
            <span className="text-xs font-black uppercase tracking-[0.08em] text-[var(--bf-dim)]">
              Рабочая должность
            </span>
          </div>

          <select
            value={position}
            disabled={pending || positionLocked}
            onChange={(event) =>
              setPosition(
                event.target.value as StaffPosition | ""
              )
            }
            className="mt-2 min-h-11 w-full rounded-xl border border-[var(--bf-line)] bg-[var(--bf-bg)] px-3 text-sm font-bold text-[var(--bf-cream)] outline-none disabled:opacity-55 focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
          >
            <option value="">Не задана</option>
            {POSITIONS.map((item) => (
              <option key={item} value={item}>
                {STAFF_POSITION_LABELS[item]}
              </option>
            ))}
          </select>

          <Button
            type="button"
            variant="secondary"
            className="mt-2 w-full"
            disabled={pending || positionLocked || !positionDirty}
            onClick={() =>
              void run(
                {
                  action: "set_position",
                  user_id: user.id,
                  position_code:
                    position || null
                },
                "Рабочая должность обновлена."
              )
            }
          >
            <Save className="size-4" aria-hidden />
            Сохранить должность
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs leading-5 text-[var(--bf-dim)] sm:grid-cols-2">
        <div className="flex items-start gap-2 rounded-xl border border-[var(--bf-line)] px-3 py-2">
          <CalendarDays
            className="mt-0.5 size-4 shrink-0"
            aria-hidden
          />
          <span>
            День рождения: {formatDate(user.birth_date)}
          </span>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-[var(--bf-line)] px-3 py-2">
          <KeyRound
            className="mt-0.5 size-4 shrink-0"
            aria-hidden
          />
          <span>
            Код восстановления: {user.recovery_set_at ? "настроен" : "не настроен"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={
            user.is_active
              ? "danger"
              : "secondary"
          }
          disabled={pending || activeLocked}
          onClick={() => onRequestToggle(user)}
        >
          {pending ? (
            <Loader2
              className="size-4 animate-spin"
              aria-hidden
            />
          ) : user.is_active ? (
            <UserRoundX
              className="size-4"
              aria-hidden
            />
          ) : (
            <UserRoundCheck
              className="size-4"
              aria-hidden
            />
          )}
          {user.is_active
            ? "Отключить доступ"
            : "Включить доступ"}
        </Button>
      </div>

      <details className="mt-3 rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] p-3">
        <summary className="cursor-pointer text-sm font-black text-[var(--bf-cream)]">
          Безопасность аккаунта
        </summary>

        {securityLocked ? (
          <p className="mt-3 text-xs leading-5 text-[var(--bf-muted)]">
            Управление данными другого администратора доступно только владельцу.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-[var(--bf-muted)]">
                Новый код входа
              </span>
              <input
                value={password}
                disabled={pending}
                inputMode="numeric"
                autoComplete="new-password"
                placeholder="4–12 цифр"
                onChange={(event) =>
                  setPassword(
                    event.target.value.replace(/\D/g, "").slice(0, 12)
                  )
                }
                className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-bg)] px-3 text-sm font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !codeOk(password)}
                onClick={async () => {
                  const saved = await run(
                    {
                      action: "set_password",
                      user_id: user.id,
                      password: password.trim()
                    },
                    "Код входа обновлён."
                  );
                  if (saved) setPassword("");
                }}
              >
                Обновить код
              </Button>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-[var(--bf-muted)]">
                Новый код восстановления
              </span>
              <input
                value={secret}
                disabled={pending}
                inputMode="numeric"
                autoComplete="off"
                placeholder="4–12 цифр"
                onChange={(event) =>
                  setSecret(
                    event.target.value.replace(/\D/g, "").slice(0, 12)
                  )
                }
                className="min-h-11 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-bg)] px-3 text-sm font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !codeOk(secret)}
                onClick={async () => {
                  const saved = await run(
                    {
                      action: "set_secret",
                      user_id: user.id,
                      secret_code: secret.trim()
                    },
                    "Код восстановления обновлён."
                  );
                  if (saved) setSecret("");
                }}
              >
                Обновить восстановление
              </Button>
            </label>
          </div>
        )}
      </details>

      {canDelete ? (
        <Button
          type="button"
          variant="danger"
          className="mt-3 w-full"
          disabled={pending}
          onClick={() => onRequestDelete(user)}
        >
          <Trash2
            className="size-4"
            aria-hidden
          />
          Удалить пользователя
        </Button>
      ) : null}

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
    </Surface>
  );
}
