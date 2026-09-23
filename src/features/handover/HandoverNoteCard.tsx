import {
  CheckCircle2,
  Clock3,
  Loader2,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  HandoverNote,
  HandoverPriority,
  HandoverStatus
} from "@/features/handover/types";

const CATEGORY_LABELS = {
  bar: "Бар",
  kitchen: "Кухня",
  hall: "Зал",
  equipment: "Оборудование",
  purchasing: "Закупки",
  other: "Другое"
} as const;

const PRIORITY_LABELS = {
  normal: "Обычная",
  high: "Важная",
  critical: "Критичная"
} as const;

const STATUS_LABELS = {
  new: "Новая",
  acknowledged: "Принята",
  resolved: "Решена"
} as const;

function personName(
  profile: HandoverNote["author"]
) {
  if (!profile) return "Сотрудник";

  return [
    profile.first_name,
    profile.last_name
  ]
    .filter(Boolean)
    .join(" ") || "Сотрудник";
}

function formatDateTime(value: string | null) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Novosibirsk"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function priorityClass(
  priority: HandoverPriority
) {
  if (priority === "critical") {
    return "border-[color:color-mix(in_srgb,var(--bf-red),transparent_48%)] bg-[color:color-mix(in_srgb,var(--bf-red),transparent_91%)] text-[#f0a29a]";
  }

  if (priority === "high") {
    return "border-[color:color-mix(in_srgb,var(--bf-gold),transparent_55%)] bg-[color:color-mix(in_srgb,var(--bf-gold),transparent_92%)] text-[#e1bc75]";
  }

  return "border-[var(--bf-line)] bg-[var(--bf-surface-2)] text-[var(--bf-muted)]";
}

function statusClass(status: HandoverStatus) {
  if (status === "resolved") {
    return "border-[color:color-mix(in_srgb,var(--bf-green),transparent_60%)] text-[#a8d2ab]";
  }

  if (status === "acknowledged") {
    return "border-[color:color-mix(in_srgb,var(--bf-copper-hi),transparent_60%)] text-[var(--bf-copper-hi)]";
  }

  return "border-[color:color-mix(in_srgb,var(--bf-gold),transparent_60%)] text-[var(--bf-gold)]";
}

export function HandoverNoteCard({
  note,
  compact = false,
  pending = false,
  onAcknowledge,
  onResolve
}: {
  note: HandoverNote;
  compact?: boolean;
  pending?: boolean;
  onAcknowledge?: (note: HandoverNote) => void;
  onResolve?: (note: HandoverNote) => void;
}) {
  return (
    <article
      className={cn(
        "rounded-[20px] border bg-[var(--bf-surface)]",
        compact ? "p-3.5" : "p-4",
        note.priority === "critical"
          ? "border-[color:color-mix(in_srgb,var(--bf-red),transparent_58%)]"
          : note.priority === "high"
            ? "border-[color:color-mix(in_srgb,var(--bf-gold),transparent_68%)]"
            : "border-[var(--bf-line)]",
        note.status === "resolved" && "opacity-75"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <span className="inline-flex min-h-6 items-center rounded-full border border-[color:color-mix(in_srgb,var(--bf-copper),transparent_60%)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_92%)] px-2 text-[10px] font-black text-[var(--bf-copper-hi)]">
            {CATEGORY_LABELS[note.category]}
          </span>
          <span
            className={cn(
              "inline-flex min-h-6 items-center rounded-full border px-2 text-[10px] font-black",
              priorityClass(note.priority)
            )}
          >
            {PRIORITY_LABELS[note.priority]}
          </span>
        </div>

        <span
          className={cn(
            "inline-flex min-h-6 shrink-0 items-center rounded-full border px-2 text-[10px] font-black",
            statusClass(note.status)
          )}
        >
          {STATUS_LABELS[note.status]}
        </span>
      </div>

      <p
        className={cn(
          "whitespace-pre-wrap break-words font-semibold text-[var(--bf-cream)]",
          compact
            ? "mt-3 text-sm leading-5"
            : "mt-4 text-[16px] leading-6"
        )}
      >
        {note.body}
      </p>

      <div className="mt-3 grid gap-1 text-[11px] leading-4 text-[var(--bf-dim)]">
        <span>
          {personName(note.author)}
          {" · "}
          {formatDateTime(note.created_at)}
        </span>

        {note.acknowledged_by &&
        note.acknowledged_at ? (
          <span>
            Принял:{" "}
            {personName(note.acknowledgedBy)}
            {" · "}
            {formatDateTime(
              note.acknowledged_at
            )}
          </span>
        ) : null}

        {note.resolved_by &&
        note.resolved_at ? (
          <span>
            Решил:{" "}
            {personName(note.resolvedBy)}
            {" · "}
            {formatDateTime(note.resolved_at)}
          </span>
        ) : null}
      </div>

      {!compact &&
      note.status !== "resolved" &&
      (onAcknowledge || onResolve) ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--bf-line)] pt-3">
          {note.status === "new" &&
          onAcknowledge ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                onAcknowledge(note)
              }
            >
              {pending ? (
                <Loader2
                  className="size-4 animate-spin"
                  aria-hidden
                />
              ) : (
                <UserCheck
                  className="size-4"
                  aria-hidden
                />
              )}
              Принял
            </Button>
          ) : null}

          {onResolve ? (
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={() => onResolve(note)}
            >
              {pending ? (
                <Loader2
                  className="size-4 animate-spin"
                  aria-hidden
                />
              ) : (
                <CheckCircle2
                  className="size-4"
                  aria-hidden
                />
              )}
              Решено
            </Button>
          ) : null}
        </div>
      ) : null}

      {compact &&
      note.status !== "resolved" ? (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--bf-dim)]">
          <Clock3
            className="size-3.5"
            aria-hidden
          />
          Требует внимания
        </div>
      ) : null}
    </article>
  );
}
