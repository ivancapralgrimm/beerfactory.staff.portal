import {
  useEffect,
  useState
} from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  requirePhrase,
  pending,
  onCancel,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  requirePhrase?: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [phrase, setPhrase] = useState("");

  useEffect(() => {
    if (!open) setPhrase("");
  }, [open]);

  if (!open) return null;

  const phraseOk =
    !requirePhrase ||
    phrase.trim().toUpperCase() ===
      requirePhrase.toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/75 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !pending
        ) {
          onCancel();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-[24px] border border-[color:color-mix(in_srgb,var(--bf-red),transparent_55%)] bg-[var(--bf-surface)] p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adminConfirmTitle"
      >
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-full border border-[color:color-mix(in_srgb,var(--bf-red),transparent_55%)] bg-[color:color-mix(in_srgb,var(--bf-red),transparent_90%)]">
            <AlertTriangle
              className="size-5 text-[#e99990]"
              aria-hidden
            />
          </div>
          <div>
            <p className="eyebrow">ПОДТВЕРЖДЕНИЕ</p>
            <h2
              id="adminConfirmTitle"
              className="mt-1 text-xl font-black"
            >
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--bf-muted)]">
              {description}
            </p>
          </div>
        </div>

        {requirePhrase ? (
          <label className="mt-4 grid gap-1.5">
            <span className="text-xs font-bold text-[var(--bf-muted)]">
              Для подтверждения введите {requirePhrase}
            </span>
            <input
              value={phrase}
              disabled={pending}
              onChange={(event) =>
                setPhrase(event.target.value)
              }
              autoComplete="off"
              className="min-h-12 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 text-sm font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
            />
          </label>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={onCancel}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending || !phraseOk}
            onClick={onConfirm}
          >
            {pending ? "Выполняем…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
