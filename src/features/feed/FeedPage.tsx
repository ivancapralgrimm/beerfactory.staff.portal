import {
  AlertTriangle,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  X
} from "lucide-react";
import {
  useMemo,
  useState,
  type FormEvent
} from "react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import {
  acknowledgeFeedPost,
  createFeedPost,
  resolveFeedPost
} from "@/features/feed/feed-api";
import { FeedPostCard } from "@/features/feed/FeedPostCard";
import { useFeed } from "@/features/feed/use-feed";
import type { FeedPost } from "@/features/feed/types";
import {
  STAFF_POSITION_LABELS,
  type StaffPosition
} from "@/types/auth";
import { cn } from "@/lib/utils";

type StatusFilter = "active" | "resolved" | "all";

const STAFF_POSITIONS: StaffPosition[] = [
  "bartender",
  "waiter",
  "bartender_bb",
  "waiter_bb",
  "manager",
  "hostess"
];

export function FeedPage() {
  const {
    posts,
    loading,
    refreshing,
    error,
    refresh
  } = useFeed();

  const [composerOpen, setComposerOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] =
    useState<"normal" | "critical">("normal");
  const [notifyAll, setNotifyAll] = useState(true);
  const [notifyPositions, setNotifyPositions] =
    useState<StaffPosition[]>([]);
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("active");
  const [submitting, setSubmitting] = useState(false);
  const [pendingIds, setPendingIds] =
    useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const filtered = useMemo(
    () =>
      posts.filter((post) =>
        statusFilter === "all"
          ? true
          : statusFilter === "resolved"
            ? post.status === "resolved"
            : post.status !== "resolved"
      ),
    [posts, statusFilter]
  );

  function togglePosition(position: StaffPosition) {
    setNotifyPositions((current) =>
      current.includes(position)
        ? current.filter((item) => item !== position)
        : [...current, position]
    );
  }

  async function submitPost(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanSubject = subject.trim();
    const cleanBody = body.trim();

    if (
      !cleanSubject ||
      !cleanBody ||
      submitting ||
      (!notifyAll && notifyPositions.length === 0)
    ) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await createFeedPost({
        subject: cleanSubject,
        body: cleanBody,
        priority,
        notifyAll,
        notifyPositions
      });

      setSubject("");
      setBody("");
      setPriority("normal");
      setNotifyAll(true);
      setNotifyPositions([]);
      setComposerOpen(false);
      setMessage({
        tone: "success",
        text: "Запись опубликована в Ленте."
      });
      await refresh(true);
    } catch {
      setMessage({
        tone: "error",
        text: "Не удалось опубликовать запись."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(
    post: FeedPost,
    action: "ack" | "resolve"
  ) {
    if (pendingIds.has(post.id)) return;

    setPendingIds((current) => {
      const next = new Set(current);
      next.add(post.id);
      return next;
    });
    setMessage(null);

    try {
      if (action === "ack") {
        await acknowledgeFeedPost(post.id);
      } else {
        await resolveFeedPost(post.id);
      }

      setMessage({
        tone: "success",
        text:
          action === "ack"
            ? "Отметка «Ознакомился» сохранена."
            : "Запись отмечена как решённая."
      });

      await refresh(true);
    } catch {
      setMessage({
        tone: "error",
        text: "Не удалось обновить запись."
      });
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(post.id);
        return next;
      });
    }
  }

  return (
    <section className="mx-auto max-w-3xl pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">КОМАНДА · ЛЕНТА</p>
          <h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">
            Рабочая Лента
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--bf-muted)]">
            Сообщения для команды и следующих смен.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Обновить Ленту"
            disabled={refreshing}
            onClick={() => void refresh(true)}
          >
            <RefreshCw
              className={cn("size-4", refreshing && "animate-spin")}
              aria-hidden
            />
          </Button>
          <Button
            type="button"
            variant="primary"
            size="icon"
            aria-label={composerOpen ? "Закрыть создание записи" : "Создать запись"}
            onClick={() => setComposerOpen((current) => !current)}
          >
            {composerOpen
              ? <X className="size-4" aria-hidden />
              : <Plus className="size-4" aria-hidden />}
          </Button>
        </div>
      </div>

      {composerOpen ? (
        <Surface className="mt-5 p-4">
          <form onSubmit={submitPost}>
            <div className="flex items-start gap-3">
              <MessageSquareText
                className="mt-0.5 size-5 shrink-0 text-[var(--bf-copper-hi)]"
                aria-hidden
              />
              <div>
                <p className="eyebrow">НОВАЯ ЗАПИСЬ</p>
                <h2 className="mt-1 text-xl font-black">Добавить в Ленту</h2>
              </div>
            </div>

            <label className="mt-4 grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--bf-dim)]">
                Тема
              </span>
              <input
                value={subject}
                maxLength={120}
                placeholder="Коротко: о чём запись"
                onChange={(event) => setSubject(event.target.value)}
                className="min-h-12 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3.5 text-sm font-bold text-[var(--bf-cream)] outline-none placeholder:text-[var(--bf-dim)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
              />
            </label>

            <label className="mt-3 grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--bf-dim)]">
                Сообщение
              </span>
              <textarea
                value={body}
                maxLength={2000}
                rows={5}
                placeholder="Что важно знать следующей смене или команде сейчас."
                onChange={(event) => setBody(event.target.value)}
                className="min-h-32 resize-y rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3.5 py-3 text-[15px] leading-6 text-[var(--bf-cream)] outline-none placeholder:text-[var(--bf-dim)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
              />
            </label>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  ["normal", "Обычная"],
                  ["critical", "Критичная"]
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value)}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 text-sm font-black",
                    priority === value
                      ? "border-[var(--bf-copper-hi)] bg-[var(--bf-surface-2)] text-[var(--bf-cream)]"
                      : "border-[var(--bf-line)] text-[var(--bf-muted)]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--bf-dim)]">
                Кому отправить уведомление
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNotifyAll(true);
                    setNotifyPositions([]);
                  }}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 text-sm font-black",
                    notifyAll
                      ? "border-[var(--bf-copper-hi)] bg-[var(--bf-surface-2)] text-[var(--bf-cream)]"
                      : "border-[var(--bf-line)] text-[var(--bf-muted)]"
                  )}
                >
                  Всем
                </button>
                <button
                  type="button"
                  onClick={() => setNotifyAll(false)}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 text-sm font-black",
                    !notifyAll
                      ? "border-[var(--bf-copper-hi)] bg-[var(--bf-surface-2)] text-[var(--bf-cream)]"
                      : "border-[var(--bf-line)] text-[var(--bf-muted)]"
                  )}
                >
                  По должности
                </button>
              </div>

              {!notifyAll ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {STAFF_POSITIONS.map((position) => (
                    <button
                      key={position}
                      type="button"
                      onClick={() => togglePosition(position)}
                      className={cn(
                        "min-h-10 rounded-xl border px-3 text-xs font-black",
                        notifyPositions.includes(position)
                          ? "border-[var(--bf-copper-hi)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_82%)] text-[var(--bf-cream)]"
                          : "border-[var(--bf-line)] text-[var(--bf-muted)]"
                      )}
                    >
                      {STAFF_POSITION_LABELS[position]}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--bf-dim)]">
                {body.length}/2000
              </span>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={
                  !subject.trim() ||
                  !body.trim() ||
                  submitting ||
                  (!notifyAll && notifyPositions.length === 0)
                }
              >
                {submitting
                  ? <Loader2 className="size-4 animate-spin" aria-hidden />
                  : <Plus className="size-4" aria-hidden />}
                {submitting ? "Публикуем…" : "Опубликовать"}
              </Button>
            </div>
          </form>
        </Surface>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface)] p-1.5">
        {(
          [
            ["active", "Активные"],
            ["resolved", "Решённые"],
            ["all", "Все"]
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            className={cn(
              "min-h-11 rounded-xl border px-2 text-xs font-black",
              statusFilter === value
                ? "border-[var(--bf-copper-hi)] bg-[var(--bf-surface-2)] text-[var(--bf-cream)]"
                : "border-transparent text-[var(--bf-dim)]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <p
        className={cn(
          "mt-3 min-h-5 text-xs leading-5",
          message?.tone === "error" ? "text-[#e99990]" : "text-[#9dd0a0]"
        )}
        role="status"
        aria-live="polite"
      >
        {message?.text || ""}
      </p>

      {loading ? (
        <div className="mt-2 grid gap-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-[20px] bg-[var(--bf-surface)]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="mt-2 rounded-[20px] border border-[color:color-mix(in_srgb,var(--bf-red),transparent_58%)] bg-[color:color-mix(in_srgb,var(--bf-red),transparent_92%)] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-[#e99990]"
              aria-hidden
            />
            <div>
              <p className="text-sm leading-6 text-[var(--bf-muted)]">{error}</p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => void refresh(false)}
              >
                <RefreshCw className="size-4" aria-hidden />
                Повторить
              </Button>
            </div>
          </div>
        </div>
      ) : filtered.length ? (
        <div className="mt-2 grid gap-2">
          {filtered.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              pending={pendingIds.has(post.id)}
              onAcknowledge={(item) => void runAction(item, "ack")}
              onResolve={(item) => void runAction(item, "resolve")}
            />
          ))}
        </div>
      ) : (
        <Surface className="mt-2 p-5 text-center">
          <MessageSquareText
            className="mx-auto size-6 text-[var(--bf-dim)]"
            aria-hidden
          />
          <p className="mt-2 text-sm font-bold">Здесь пока ничего нет</p>
          <p className="mt-1 text-xs leading-5 text-[var(--bf-dim)]">
            Активных записей по этому фильтру нет.
          </p>
        </Surface>
      )}
    </section>
  );
}
