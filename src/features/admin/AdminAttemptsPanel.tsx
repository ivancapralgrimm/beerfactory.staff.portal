import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  CheckCircle2,
  RefreshCw,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import {
  loadAdminAttempts
} from "@/features/admin/admin-api";
import type {
  AdminAttempt,
  AdminUser
} from "@/features/admin/types";
import { cn } from "@/lib/utils";

function formatDateTime(value: string | null) {
  if (!value) return "";

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
    return "";
  }
}

function weakTopics(row: AdminAttempt) {
  const raw = row.category_results;

  if (
    !raw ||
    typeof raw !== "object" ||
    !("weak_topics" in raw)
  ) {
    return [] as Array<{
      topic: string;
      correct: number;
      total: number;
    }>;
  }

  const topics = (
    raw as {
      weak_topics?: unknown;
    }
  ).weak_topics;

  if (!Array.isArray(topics)) return [];

  return topics.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      !("topic" in item)
    ) {
      return [];
    }

    const value = item as {
      topic?: unknown;
      correct?: unknown;
      total?: unknown;
    };

    return [{
      topic: String(value.topic || ""),
      correct: Number(value.correct || 0),
      total: Number(value.total || 0)
    }];
  });
}

export function AdminAttemptsPanel({
  users
}: {
  users: AdminUser[];
}) {
  const [rows, setRows] = useState<AdminAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const userMap = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  );

  async function load() {
    setLoading(true);
    setError(null);

    try {
      setRows(await loadAdminAttempts());
    } catch {
      setError("Не удалось загрузить результаты аттестаций.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const categories = useMemo(
    () => [
      ...new Set(
        rows
          .map((row) => row.category || row.category_id)
          .filter((value): value is string => Boolean(value))
      )
    ],
    [rows]
  );

  const filtered = useMemo(
    () =>
      filter === "all"
        ? rows
        : rows.filter(
            (row) =>
              (row.category || row.category_id) === filter
          ),
    [rows, filter]
  );

  const average = filtered.length
    ? Math.round(
        filtered.reduce(
          (sum, row) => sum + Number(row.score || 0),
          0
        ) / filtered.length
      )
    : 0;

  const passed = filtered.filter(
    (row) => row.passed
  ).length;

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">АТТЕСТАЦИИ</p>
          <h2 className="mt-1 text-2xl font-black">
            Результаты команды
          </h2>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Обновить результаты"
          disabled={loading}
          onClick={() => void load()}
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

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Surface className="p-3 text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--bf-dim)]">
            Попыток
          </span>
          <strong className="mt-1 block text-2xl">
            {filtered.length}
          </strong>
        </Surface>
        <Surface className="p-3 text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--bf-dim)]">
            Зачтено
          </span>
          <strong className="mt-1 block text-2xl">
            {passed}
          </strong>
        </Surface>
        <Surface className="p-3 text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--bf-dim)]">
            Средний
          </span>
          <strong className="mt-1 block text-2xl">
            {average}%
          </strong>
        </Surface>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 bf-scrollbar-none">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "min-h-11 shrink-0 rounded-xl border px-3 text-sm font-bold",
            filter === "all"
              ? "border-[var(--bf-copper-hi)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_82%)] text-[var(--bf-cream)]"
              : "border-[var(--bf-line)] bg-[var(--bf-surface)] text-[var(--bf-muted)]"
          )}
        >
          Все
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setFilter(category)}
            className={cn(
              "min-h-11 shrink-0 rounded-xl border px-3 text-sm font-bold",
              filter === category
                ? "border-[var(--bf-copper-hi)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_82%)] text-[var(--bf-cream)]"
                : "border-[var(--bf-line)] bg-[var(--bf-surface)] text-[var(--bf-muted)]"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-3 grid gap-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-[20px] bg-[var(--bf-surface)]"
            />
          ))}
        </div>
      ) : error ? (
        <Surface className="mt-3 p-4 text-sm text-[#e99990]">
          {error}
        </Surface>
      ) : filtered.length ? (
        <div className="mt-3 grid gap-2">
          {filtered.map((row) => {
            const person = userMap.get(row.user_id);
            const name = person
              ? [person.first_name, person.last_name]
                  .filter(Boolean)
                  .join(" ")
              : "Сотрудник";
            const weak = weakTopics(row);

            return (
              <Surface key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow">
                      {row.category || row.category_id || "АТТЕСТАЦИЯ"}
                    </p>
                    <h3 className="mt-1 break-words text-lg font-black">
                      {name}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--bf-dim)]">
                      {row.correct_answers}/{row.total_questions} · {formatDateTime(row.finished_at || row.created_at)}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-sm font-black",
                      row.passed
                        ? "border-[color:color-mix(in_srgb,var(--bf-green),transparent_55%)] text-[#a8d2ab]"
                        : "border-[color:color-mix(in_srgb,var(--bf-red),transparent_55%)] text-[#e99990]"
                    )}
                  >
                    {row.passed ? (
                      <CheckCircle2 className="size-4" aria-hidden />
                    ) : (
                      <XCircle className="size-4" aria-hidden />
                    )}
                    {row.score}%
                  </div>
                </div>

                {weak.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {weak.slice(0, 6).map((item) => (
                      <span
                        key={`${row.id}:${item.topic}`}
                        className="rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-2 py-1 text-[10px] font-bold text-[var(--bf-muted)]"
                      >
                        {item.topic} · {item.correct}/{item.total}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Surface>
            );
          })}
        </div>
      ) : (
        <Surface className="mt-3 p-5 text-center text-sm text-[var(--bf-muted)]">
          Результатов по этому фильтру пока нет.
        </Surface>
      )}
    </section>
  );
}
