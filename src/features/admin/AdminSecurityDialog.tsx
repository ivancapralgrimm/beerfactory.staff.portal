import {
  useEffect,
  useState,
  type FormEvent
} from "react";
import {
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  AdminMutation
} from "@/features/admin/types";
import { cn } from "@/lib/utils";

type SecurityAction =
  | "password"
  | "secret"
  | null;

const codeOk = (value: string) =>
  /^\d{4,12}$/.test(value.trim());

export function AdminSecurityDialog({
  open,
  userId,
  fullName,
  recoveryConfigured,
  pending,
  onMutate,
  onClose
}: {
  open: boolean;
  userId: string;
  fullName: string;
  recoveryConfigured: boolean;
  pending: boolean;
  onMutate: (
    mutation: AdminMutation
  ) => Promise<void>;
  onClose: () => void;
}) {
  const [password, setPassword] =
    useState("");
  const [secret, setSecret] =
    useState("");
  const [action, setAction] =
    useState<SecurityAction>(null);
  const [message, setMessage] =
    useState<{
      tone: "success" | "error";
      text: string;
    } | null>(null);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setSecret("");
      setAction(null);
      setMessage(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === "Escape" &&
        !pending &&
        !action
      ) {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      onKey
    );

    return () => {
      document.removeEventListener(
        "keydown",
        onKey
      );
    };
  }, [open, pending, action, onClose]);

  if (!open) return null;

  const busy =
    pending || action !== null;

  async function savePassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const value = password.trim();

    if (!codeOk(value) || busy) return;

    setAction("password");
    setMessage(null);

    try {
      await onMutate({
        action: "set_password",
        user_id: userId,
        password: value
      });

      setPassword("");
      setMessage({
        tone: "success",
        text: "Код входа обновлён."
      });
    } catch {
      setMessage({
        tone: "error",
        text: "Не удалось обновить код входа."
      });
    } finally {
      setAction(null);
    }
  }

  async function saveSecret(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const value = secret.trim();

    if (!codeOk(value) || busy) return;

    setAction("secret");
    setMessage(null);

    try {
      await onMutate({
        action: "set_secret",
        user_id: userId,
        secret_code: value
      });

      setSecret("");
      setMessage({
        tone: "success",
        text: "Код восстановления обновлён."
      });
    } catch {
      setMessage({
        tone: "error",
        text: "Не удалось обновить код восстановления."
      });
    } finally {
      setAction(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-black/75 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !busy
        ) {
          onClose();
        }
      }}
    >
      <div
        className="max-h-[86dvh] w-full max-w-md overflow-y-auto rounded-[24px] border border-[var(--bf-line-strong)] bg-[var(--bf-surface)] p-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="securityModeTitle"
      >
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-full border border-[color:color-mix(in_srgb,var(--bf-copper),transparent_45%)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_88%)]">
            <LockKeyhole
              className="size-5 text-[var(--bf-copper-hi)]"
              aria-hidden
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="eyebrow">
              SECURITY MODE
            </p>
            <h2
              id="securityModeTitle"
              className="mt-1 text-xl font-black"
            >
              {fullName}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[var(--bf-muted)]">
              Коды входа и восстановления.
              Используйте только при необходимости.
            </p>
          </div>

          <button
            type="button"
            aria-label="Закрыть Security Mode"
            disabled={busy}
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] text-[var(--bf-muted)] outline-none disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
          >
            <X
              className="size-4"
              aria-hidden
            />
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <form
            onSubmit={savePassword}
            className="rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] p-3"
          >
            <div className="flex items-start gap-2">
              <KeyRound
                className="mt-0.5 size-4 shrink-0 text-[var(--bf-gold)]"
                aria-hidden
              />
              <div>
                <p className="text-sm font-black">
                  Код входа
                </p>
                <p className="mt-0.5 text-xs leading-5 text-[var(--bf-dim)]">
                  Новый персональный код,
                  4–12 цифр.
                </p>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={password}
                disabled={busy}
                inputMode="numeric"
                autoComplete="new-password"
                placeholder="Новый код"
                aria-label="Новый код входа"
                onChange={(event) =>
                  setPassword(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 12)
                  )
                }
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-bg)] px-3 text-sm font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
              />

              <Button
                type="submit"
                variant="primary"
                className="shrink-0 px-3"
                disabled={
                  busy ||
                  !codeOk(password)
                }
              >
                {action === "password"
                  ? "…"
                  : "Сменить"}
              </Button>
            </div>
          </form>

          <form
            onSubmit={saveSecret}
            className="rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] p-3"
          >
            <div className="flex items-start gap-2">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-[var(--bf-copper-hi)]"
                aria-hidden
              />
              <div>
                <p className="text-sm font-black">
                  Код восстановления
                </p>
                <p className="mt-0.5 text-xs leading-5 text-[var(--bf-dim)]">
                  Сейчас:{" "}
                  {recoveryConfigured
                    ? "настроен"
                    : "не настроен"}
                  .
                </p>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={secret}
                disabled={busy}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Новый код"
                aria-label="Новый код восстановления"
                onChange={(event) =>
                  setSecret(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 12)
                  )
                }
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-bg)] px-3 text-sm font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
              />

              <Button
                type="submit"
                variant="secondary"
                className="shrink-0 px-3"
                disabled={
                  busy ||
                  !codeOk(secret)
                }
              >
                {action === "secret"
                  ? "…"
                  : "Сменить"}
              </Button>
            </div>
          </form>
        </div>

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
      </div>
    </div>
  );
}
