import {
  Check,
  CheckCircle2,
  Loader2,
  Megaphone,
  UsersRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STAFF_POSITION_LABELS } from "@/types/auth";
import type { FeedPost } from "@/features/feed/types";

function personName(profile: FeedPost["author"]) {
  if (!profile) return "Сотрудник";
  return [profile.first_name, profile.last_name]
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

function audienceLabel(post: FeedPost) {
  if (post.notify_all) return "Вся команда";
  const labels = post.notify_positions
    .map((item) => STAFF_POSITION_LABELS[item])
    .filter(Boolean);
  return labels.length ? labels.join(", ") : "Выбранные должности";
}

export function FeedPostCard({
  post,
  compact = false,
  pending = false,
  onAcknowledge,
  onResolve
}: {
  post: FeedPost;
  compact?: boolean;
  pending?: boolean;
  onAcknowledge?: (post: FeedPost) => void;
  onResolve?: (post: FeedPost) => void;
}) {
  const critical = post.priority === "critical";
  const resolved = post.status === "resolved";

  return (
    <article
      className={cn(
        "rounded-[20px] border bg-[var(--bf-surface)]",
        compact ? "p-3.5" : "p-4",
        critical
          ? "border-[color:color-mix(in_srgb,var(--bf-red),transparent_52%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bf-red),transparent_93%),transparent_55%),var(--bf-surface)]"
          : "border-[var(--bf-line)]",
        resolved && "opacity-75"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {critical ? (
              <span className="inline-flex min-h-6 items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--bf-red),transparent_45%)] bg-[color:color-mix(in_srgb,var(--bf-red),transparent_90%)] px-2 text-[10px] font-black uppercase tracking-[0.06em] text-[#f0a29a]">
                <Megaphone className="size-3" aria-hidden />
                Критично
              </span>
            ) : (
              <span className="inline-flex min-h-6 items-center rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-2 text-[10px] font-black text-[var(--bf-muted)]">
                Обычная
              </span>
            )}
            <span className="inline-flex min-h-6 items-center gap-1 rounded-full border border-[var(--bf-line)] px-2 text-[10px] font-bold text-[var(--bf-dim)]">
              <UsersRound className="size-3" aria-hidden />
              {audienceLabel(post)}
            </span>
          </div>
          <h3 className={cn(
            "mt-2 font-black leading-tight text-[var(--bf-cream)]",
            compact ? "text-[15px]" : "text-xl"
          )}>
            {post.subject}
          </h3>
        </div>

        {resolved ? (
          <span className="inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--bf-green),transparent_55%)] px-2 text-[10px] font-black text-[#a8d2ab]">
            <CheckCircle2 className="size-3" aria-hidden />
            Решено
          </span>
        ) : null}
      </div>

      <p className={cn(
        "whitespace-pre-wrap break-words text-[var(--bf-muted)]",
        compact ? "mt-2 line-clamp-3 text-sm leading-5" : "mt-3 text-[15px] leading-6"
      )}>
        {post.body}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--bf-dim)]">
        <span>{personName(post.author)} · {formatDateTime(post.created_at)}</span>
        <span>Ознакомились: {post.acknowledgementCount}</span>
      </div>

      {!compact && !resolved ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--bf-line)] pt-3">
          {onAcknowledge ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending || post.acknowledgedByMe}
              onClick={() => onAcknowledge(post)}
            >
              {pending
                ? <Loader2 className="size-4 animate-spin" aria-hidden />
                : <Check className="size-4" aria-hidden />}
              Ознакомился
            </Button>
          ) : null}

          {onResolve ? (
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={() => onResolve(post)}
            >
              {pending
                ? <Loader2 className="size-4 animate-spin" aria-hidden />
                : <CheckCircle2 className="size-4" aria-hidden />}
              Решено
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
