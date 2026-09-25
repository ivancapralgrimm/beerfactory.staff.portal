import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { loadPositionShiftWorkflow } from "@/features/shift/shift-api";
import type { PositionShiftWorkflow } from "@/features/shift/types";
import { useAuth } from "@/features/auth/auth-context";
import {
  BookCheck,
  BookOpen,
  Cake,
  ChevronRight,
  ClipboardCheck,
  Star,
  StickyNote,
  UserRound,
  UtensilsCrossed
} from "lucide-react";
import { Link } from "react-router-dom";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { HandoverNoteCard } from "@/features/handover/HandoverNoteCard";
import { useHandoverFeed } from "@/features/handover/use-handover-feed";
import { useUpcomingBirthdays } from "@/features/dashboard/use-upcoming-birthdays";
import {
  dashboardReadingDayKey,
  dashboardReadingSelection,
  knowledgeArticleImage
} from "@/features/dashboard/dashboard-reading";
import { useKnowledgeArticles } from "@/features/knowledge/use-knowledge";
import { useKnowledgeProgress } from "@/features/knowledge/use-knowledge-progress";
import {
  STAFF_POSITION_LABELS,
  type StaffPosition
} from "@/types/auth";

const actions = [
  { to: "/menu", title: "Рецепты", text: "Блюда, напитки, технологии", icon: UtensilsCrossed },
  { to: "/knowledge", title: "Знания", text: "Обучение и статьи", icon: BookOpen },
  { to: "/shift", title: "Смена", text: "Чек-листы и отчёты", icon: ClipboardCheck },
  { to: "/handover", title: "Заметки", text: "Обмен информацией", icon: StickyNote }
];

const BIRTHDAY_LABELS = {
  0: "Сегодня",
  1: "Завтра",
  2: "Послезавтра"
} as const;

function personName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ") || "Сотрудник";
}

function positionLabel(value: string | null) {
  if (!value) return "Команда";
  return STAFF_POSITION_LABELS[value as StaffPosition] || "Команда";
}

function ageLabel(age: number) {
  const mod100 = age % 100;
  const mod10 = age % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${age} лет`;
  if (mod10 === 1) return `${age} год`;
  if (mod10 >= 2 && mod10 <= 4) return `${age} года`;
  return `${age} лет`;
}

export function DashboardPage() {
  const { state: auth } = useAuth();
  const firstName = auth.status === "authenticated" ? auth.user.first_name : "";
  const userId = auth.status === "authenticated" ? auth.user.id : "";
  const [shiftWorkflow, setShiftWorkflow] = useState<PositionShiftWorkflow | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let active = true;
    void loadPositionShiftWorkflow()
      .then((data) => { if (active) setShiftWorkflow(data); })
      .catch(() => { if (active) setShiftWorkflow(null); });
    return () => { active = false; };
  }, [auth.status]);

  const shiftStatus = shiftWorkflow?.context.state === "locked"
    ? ["Смена недоступна до 11:00", "Операционное окно закрыто"]
    : shiftWorkflow?.context.state === "position_required"
      ? ["Выберите должность", "Настройте чек-лист в профиле"]
      : shiftWorkflow?.shift?.status === "not_started"
        ? ["Смена не открыта", "Открой смену перед началом работы"]
        : shiftWorkflow?.shift?.status === "active"
          ? ["Смена открыта", "Проверь задачи текущей смены"]
          : shiftWorkflow?.shift?.status === "closed"
            ? ["Смена закрыта", "Все этапы зафиксированы"]
            : ["Смена", "Проверить чек-лист и статус смены"];

  const { notes, loading, error } = useHandoverFeed();
  const {
    birthdays,
    loading: birthdaysLoading,
    error: birthdaysError
  } = useUpcomingBirthdays();

  const knowledge = useKnowledgeArticles();
  const knowledgeProgress = useKnowledgeProgress(userId);

  const activeNotes = notes.filter((note) => note.status !== "resolved");
  const activeCount = activeNotes.length;
  const showBirthdaySection = birthdaysLoading || Boolean(birthdaysError) || birthdays.length > 0;
  const showHandoverSection = loading || Boolean(error) || activeNotes.length > 0;

  const readingDayKey = useMemo(
    () => dashboardReadingDayKey(
      shiftWorkflow?.context.server_now,
      shiftWorkflow?.context.venue_timezone || "Asia/Novosibirsk"
    ),
    [shiftWorkflow?.context.server_now, shiftWorkflow?.context.venue_timezone]
  );

  const readingArticles = useMemo(() => {
    if (knowledge.state.status !== "ready" || knowledgeProgress.state.loading) {
      return [];
    }

    return dashboardReadingSelection({
      articles: knowledge.state.articles,
      readIds: knowledgeProgress.state.readIds,
      userId,
      dayKey: readingDayKey,
      limit: 6
    });
  }, [
    knowledge.state,
    knowledgeProgress.state.loading,
    knowledgeProgress.state.readIds,
    readingDayKey,
    userId
  ]);

  const readingLoading =
    knowledge.state.status === "loading" || knowledgeProgress.state.loading;

  const showReadingSection = readingLoading || readingArticles.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-5"
    >
      <section className="bf-dashboard-hero">
        <div className="bf-dashboard-brand">BEERFACTORY <span>STAFF PORTAL</span></div>
        <h1>Привет{firstName ? `, ${firstName}` : ""}!</h1>
        <p>Хорошего рабочего дня!<br />«Вкус начинается с команды»</p>
      </section>

      <div className="bf-dashboard-content">
        <Link to="/profile" className="bf-dashboard-profile"><UserRound aria-hidden className="size-4" /> Мой профиль <ChevronRight aria-hidden className="size-4" /></Link>
        <div className="bf-day-status" role="status">
          <ClipboardCheck aria-hidden className="size-5" />
          <span><strong>{shiftStatus[0]}</strong><small>{shiftStatus[1]}</small></span>
        </div>

        <div className="bf-dashboard-actions">
          {actions.map(({ to, title, text, icon: Icon }) => (
            <Link key={to} to={to} className="bf-dashboard-action">
              <Icon aria-hidden className="size-6" />
              <ChevronRight aria-hidden className="bf-action-chevron size-4" />
              <strong>{title}</strong><span>{text}</span>
            </Link>
          ))}
        </div>
        <Link to="/attestation" className="bf-dashboard-wide-action"><Star aria-hidden className="size-5" /><span><strong>Аттестация</strong><small>Проверь свои знания</small></span><ChevronRight aria-hidden className="size-4" /></Link>
      </div>

      {showBirthdaySection ? (
        <section>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">СЕГОДНЯ · КОМАНДА</p>
              <h2 className="mt-1 text-2xl font-black">Ближайшие дни рождения</h2>
            </div>
            <Cake className="size-5 shrink-0 text-[var(--bf-gold)]" aria-hidden />
          </div>

          {birthdaysLoading ? (
            <div className="mt-3 grid gap-2">
              {[0, 1].map((item) => <div key={item} className="h-20 animate-pulse rounded-[20px] bg-[var(--bf-surface)]" />)}
            </div>
          ) : birthdaysError ? (
            <Surface className="mt-3 p-4">
              <p className="text-sm leading-6 text-[var(--bf-muted)]">Дни рождения сейчас не загрузились. Остальной Dashboard продолжает работать.</p>
            </Surface>
          ) : (
            <div className="mt-3 grid gap-2">
              {birthdays.map((birthday) => {
                const name = personName(birthday.first_name, birthday.last_name);
                const todayAge = birthday.days_until === 0 && birthday.age_years != null ? ageLabel(birthday.age_years) : null;
                return (
                  <Surface key={`${birthday.profile_id}:${birthday.days_until}`} className="flex min-h-20 items-center gap-3 p-3.5">
                    <div className="grid size-11 shrink-0 place-items-center rounded-full border border-[color:color-mix(in_srgb,var(--bf-gold),transparent_48%)] bg-[color:color-mix(in_srgb,var(--bf-gold),transparent_90%)]">
                      <Cake className="size-5 text-[var(--bf-gold)]" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--bf-cream)]">{BIRTHDAY_LABELS[birthday.days_until]}</span>
                        <span className="text-[11px] font-bold text-[var(--bf-dim)]">{positionLabel(birthday.position_code)}</span>
                      </div>
                      <p className="mt-1.5 text-base font-black leading-5 text-[var(--bf-cream)]">
                        {birthday.days_until === 0 ? `${name} сегодня отмечает день рождения` : `${name} — ${BIRTHDAY_LABELS[birthday.days_until].toLowerCase()} день рождения`}
                      </p>
                      {todayAge ? <p className="mt-1 text-sm font-bold text-[var(--bf-gold)]">Исполняется {todayAge}</p> : null}
                    </div>
                  </Surface>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {showHandoverSection ? (
        <section>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">СЕГОДНЯ · ПЕРЕДАЧА</p>
              <h2 className="mt-1 text-2xl font-black">Активные передачи</h2>
            </div>
            <Button asChild variant="secondary">
              <Link to="/handover"><StickyNote className="size-4" aria-hidden />Открыть</Link>
            </Button>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--bf-dim)]">
            <span className="rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface)] px-2.5 py-1.5 font-black text-[var(--bf-cream)]">{activeCount} активных</span>
            <span>Только то, что ещё требует внимания</span>
          </div>

          {loading ? (
            <div className="mt-3 grid gap-2">
              {[0, 1].map((item) => <div key={item} className="h-28 animate-pulse rounded-[20px] bg-[var(--bf-surface)]" />)}
            </div>
          ) : error ? (
            <Surface className="mt-3 p-4">
              <p className="text-sm leading-6 text-[var(--bf-muted)]">Передача сейчас не загрузилась. Остальные разделы портала продолжают работать.</p>
            </Surface>
          ) : (
            <div className="mt-3 grid gap-2">
              {activeNotes.map((note) => <HandoverNoteCard key={note.id} note={note} compact />)}
            </div>
          )}
        </section>
      ) : null}

      {showReadingSection ? (
        <section aria-labelledby="dashboard-reading-title">
          <h2 id="dashboard-reading-title" className="text-[28px] font-black leading-none tracking-[-0.035em]">Что почитать</h2>

          {readingLoading ? (
            <div className="bf-scrollbar-none -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1" aria-label="Загрузка подборки статей">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="h-[188px] w-[156px] shrink-0 animate-pulse rounded-[18px] border border-[var(--bf-line)] bg-[var(--bf-surface)]" />
              ))}
            </div>
          ) : (
            <div className="bf-scrollbar-none -mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2" aria-label="Подборка статей">
              {readingArticles.map((article) => {
                const image = knowledgeArticleImage(article);
                const read = knowledgeProgress.state.readIds.has(article.id);
                return (
                  <Link
                    key={article.id}
                    to={`/knowledge/${encodeURIComponent(article.id)}`}
                    state={{ from: "/" }}
                    className="group flex h-[188px] w-[156px] shrink-0 snap-start flex-col overflow-hidden rounded-[18px] border border-[var(--bf-line)] bg-[var(--bf-surface)] outline-none transition-[border-color,transform] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)] active:translate-y-px"
                    aria-label={`Открыть статью ${article.title}`}
                  >
                    <div className="relative h-[82px] shrink-0 overflow-hidden border-b border-[var(--bf-line)] bg-[linear-gradient(145deg,var(--bf-surface-2),var(--bf-surface))]">
                      {image ? (
                        <img src={image} alt="" loading="lazy" className="h-full w-full object-cover opacity-90" />
                      ) : (
                        <div className="grid h-full place-items-center">
                          <BookOpen className="size-7 text-[var(--bf-copper-hi)]" aria-hidden />
                        </div>
                      )}
                      {read ? (
                        <span className="absolute right-2 top-2 inline-flex min-h-6 items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--bf-green),transparent_55%)] bg-[#162016e8] px-2 text-[9px] font-black text-[#9dd0a0]">
                          <BookCheck className="size-3" aria-hidden />Прочитано
                        </span>
                      ) : null}
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col p-3">
                      <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--bf-copper-hi)]">{article.category}</span>
                      <strong className="mt-1 line-clamp-3 text-[13px] leading-[1.28] tracking-[-0.01em] text-[var(--bf-cream)]">{article.title}</strong>
                      <span className="mt-auto pt-2 text-[10px] font-semibold text-[var(--bf-dim)]">{article.readingMinutes} мин</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </motion.div>
  );
}
