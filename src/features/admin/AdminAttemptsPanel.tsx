import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ListChecks,
  RefreshCw,
  Settings2,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { loadAdminAttempts } from "@/features/admin/admin-api";
import type { AdminAttempt, AdminUser } from "@/features/admin/types";
import { AttestationBankAdminPanel } from "@/features/attestation/AttestationBankAdminPanel";
import { AttestationSettingsAdminPanel } from "@/features/attestation/AttestationSettingsAdminPanel";
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
  if (!raw || typeof raw !== "object" || !("weak_topics" in raw)) {
    return [] as Array<{ topic: string; correct: number; total: number }>;
  }
  const topics = (raw as { weak_topics?: unknown }).weak_topics;
  if (!Array.isArray(topics)) return [];
  return topics.flatMap((item) => {
    if (!item || typeof item !== "object" || !("topic" in item)) return [];
    const value = item as { topic?: unknown; correct?: unknown; total?: unknown };
    return [{
      topic: String(value.topic || ""),
      correct: Number(value.correct || 0),
      total: Number(value.total || 0)
    }];
  });
}

function ResultsPanel({ users }: { users: AdminUser[] }) {
  const [rows, setRows] = useState<AdminAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  async function load() {
    setLoading(true);
    setError(null);
    try { setRows(await loadAdminAttempts()); }
    catch { setError("Не удалось загрузить результаты аттестаций."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const categories = useMemo(() => [
    ...new Set(rows.map((row) => row.category || row.category_id).filter((value): value is string => Boolean(value)))
  ], [rows]);

  const filtered = useMemo(() => filter === "all" ? rows : rows.filter((row) => (row.category || row.category_id) === filter), [rows, filter]);
  const average = filtered.length ? Math.round(filtered.reduce((sum, row) => sum + Number(row.score || 0), 0) / filtered.length) : 0;
  const passed = filtered.filter((row) => row.passed).length;

  return (
    <section className="mt-4">
      <div className="flex items-end justify-between gap-3">
        <h3 className="min-w-0 text-2xl font-black">Результаты команды</h3>
        <Button type="button" variant="secondary" size="icon" aria-label="Обновить результаты" disabled={loading} onClick={() => void load()}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
        </Button>
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-3 gap-1.5" aria-label="Статистика результатов аттестации">
        {([
          ["Попыток", filtered.length],
          ["Зачтено", passed],
          ["Средний", `${average}%`]
        ] as const).map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] px-1.5 py-2 text-center shadow-sm">
            <span className="block truncate text-[9px] font-black uppercase leading-3 tracking-[.04em] text-[var(--bf-dim)]">{label}</span>
            <strong className="mt-0.5 block text-lg font-black leading-6 tabular-nums text-[var(--bf-cream)]">{value}</strong>
          </div>
        ))}
      </div>

      <label className="relative mt-3 flex min-w-0 max-w-full flex-col gap-1 text-[11px] font-bold text-[var(--bf-dim)]">
        <span>Категория</span>
        <select
          aria-label="Категория результатов аттестации"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="h-11 min-h-11 w-full min-w-0 max-w-full appearance-none truncate rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface)] py-2 pl-3 pr-9 text-[16px] font-bold text-[var(--bf-cream)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
        >
          <option value="all">Все категории</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute bottom-[14px] right-3 size-4 text-[var(--bf-dim)]" aria-hidden />
      </label>

      {loading ? <div className="mt-3 grid gap-2">{[0,1,2].map((item) => <div key={item} className="h-28 animate-pulse rounded-[20px] bg-[var(--bf-surface)]" />)}</div> : error ? <Surface className="mt-3 p-4 text-sm text-[#e99990]">{error}</Surface> : filtered.length ? <div className="mt-3 grid gap-2">{filtered.map((row) => {
        const person = userMap.get(row.user_id);
        const name = person ? [person.first_name, person.last_name].filter(Boolean).join(" ") : "Сотрудник";
        const weak = weakTopics(row);
        return <Surface key={row.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="eyebrow">{row.category || row.category_id || "АТТЕСТАЦИЯ"}</p><h4 className="mt-1 break-words text-lg font-black">{name}</h4><p className="mt-1 text-xs text-[var(--bf-dim)]">{row.correct_answers}/{row.total_questions} · {formatDateTime(row.finished_at || row.created_at)}</p></div><div className={cn("flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-sm font-black", row.passed ? "border-[color:color-mix(in_srgb,var(--bf-green),transparent_55%)] text-[#a8d2ab]" : "border-[color:color-mix(in_srgb,var(--bf-red),transparent_55%)] text-[#e99990]")}>{row.passed ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}{row.score}%</div></div>{weak.length ? <div className="mt-3 flex flex-wrap gap-1.5">{weak.slice(0,6).map((item) => <span key={`${row.id}:${item.topic}`} className="rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-2 py-1 text-[10px] font-bold text-[var(--bf-muted)]">{item.topic} · {item.correct}/{item.total}</span>)}</div> : null}</Surface>;
      })}</div> : <Surface className="mt-3 p-5 text-center text-sm text-[var(--bf-muted)]">Результатов по этому фильтру пока нет.</Surface>}
    </section>
  );
}

export function AdminAttemptsPanel({ users }: { users: AdminUser[] }) {
  const [view, setView] = useState<"results" | "bank" | "settings">("results");

  return (
    <section>
      <div className="grid min-w-0 grid-cols-3 gap-1 rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface)] p-1.5">
        {([
          ["results", "Результаты", ListChecks],
          ["bank", "Вопросы", BookOpenCheck],
          ["settings", "Настройки", Settings2]
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-pressed={view === id}
            className={cn(
              "flex min-h-11 min-w-0 w-full items-center justify-center gap-1 rounded-xl border px-1 text-center text-[11px] font-black leading-tight sm:gap-1.5 sm:px-2 sm:text-xs",
              view === id
                ? "border-[var(--bf-copper-hi)] bg-[var(--bf-surface-2)] text-[var(--bf-cream)]"
                : "border-transparent text-[var(--bf-dim)]"
            )}
          >
            <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden />
            <span className="min-w-0 text-center">{label}</span>
          </button>
        ))}
      </div>
      {view === "results" ? <ResultsPanel users={users} /> : null}
      {view === "bank" ? <AttestationBankAdminPanel /> : null}
      {view === "settings" ? <AttestationSettingsAdminPanel /> : null}
    </section>
  );
}
