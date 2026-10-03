import { ReadingCarousel } from "@/features/dashboard/ReadingCarousel";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { loadPositionShiftWorkflow } from "@/features/shift/shift-api";
import type { PositionShiftWorkflow } from "@/features/shift/types";
import { useAuth } from "@/features/auth/auth-context";
import {
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
import { DashboardFeedSection } from "@/features/feed/DashboardFeedSection";
import { DashboardGlobalSearch } from "@/features/dashboard/DashboardGlobalSearch";
import { useUpcomingBirthdays } from "@/features/dashboard/use-upcoming-birthdays";
import {
  dashboardReadingDayKey,
  dashboardReadingSelection
} from "@/features/dashboard/dashboard-reading";
import { useKnowledgeArticles } from "@/features/knowledge/use-knowledge";
import { useKnowledgeProgress } from "@/features/knowledge/use-knowledge-progress";
import {
  STAFF_POSITION_LABELS,
  type StaffPosition
} from "@/types/auth";

const actions = [
  { to: "/shift", title: "Смена", text: "Открытие, задачи, закрытие", icon: ClipboardCheck },
  { to: "/menu", title: "Рецепты", text: "Блюда, напитки, технологии", icon: UtensilsCrossed },
  { to: "/knowledge", title: "Знания", text: "Обучение и статьи", icon: BookOpen },
  { to: "/feed", title: "Лента", text: "Новости и сообщения", icon: StickyNote }
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
    ? ["Смена недоступна до 11:00", "Новая смена откроется в 11:00"]
    : shiftWorkflow?.context.state === "position_required"
      ? ["Выберите должность", "Укажите должность в профиле"]
      : shiftWorkflow?.shift?.status === "not_started"
        ? ["Смена не открыта", "Открой смену перед началом работы"]
        : shiftWorkflow?.shift?.status === "active"
          ? ["Смена открыта", "Проверь задачи текущей смены"]
          : shiftWorkflow?.shift?.status === "closed"
            ? ["Смена закрыта", "Все этапы завершены"]
            : ["Смена", "Проверить чек-лист"];

  const {
    birthdays,
    loading: birthdaysLoading
  } = useUpcomingBirthdays();

  const knowledge = useKnowledgeArticles();
  const knowledgeProgress = useKnowledgeProgress(userId);

  const showBirthdaySection = birthdaysLoading || birthdays.length > 0;

  const readingDayKey = useMemo(
    () => dashboardReadingDayKey(
      shiftWorkflow?.context.server_now,
      shiftWorkflow?.context.venue_timezone || "Asia/Novosibirsk"
    ),
    [shiftWorkflow?.context.server_now, shiftWorkflow?.context.venue_timezone]
  );

  const readingArticles = useMemo(() => {
    if (knowledge.state.status !== "ready" || knowledgeProgress.state.loading) return [];
    return dashboardReadingSelection({
      articles: knowledge.state.articles,
      readIds: knowledgeProgress.state.readIds,
      userId,
      dayKey: readingDayKey,
      limit: 6
    });
  }, [knowledge.state, knowledgeProgress.state.loading, knowledgeProgress.state.readIds, readingDayKey, userId]);

  const readingLoading = knowledge.state.status === "loading" || knowledgeProgress.state.loading;
  const showReadingSection = readingLoading || readingArticles.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }} className="craft-dashboard space-y-5">
      <section className="bf-dashboard-hero">
        <div className="bf-dashboard-brand">BFSTAFF <span>BeerFactory<br />Staff Portal</span></div>
        <h1>Привет{firstName ? `, ${firstName}` : ""}!</h1>
        <p className="bf-workspace-date">{new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Novosibirsk" }).format(new Date())}</p>
      </section>

      <DashboardGlobalSearch />

      <div className="bf-dashboard-content">
        <Link to="/profile" className="bf-dashboard-profile"><UserRound aria-hidden className="size-4" /> Мой профиль <ChevronRight aria-hidden className="size-4" /></Link>
        <div className="bf-day-status" role="status"><ClipboardCheck aria-hidden className="size-5" /><span><strong>{shiftStatus[0]}</strong><small>{shiftStatus[1]}</small></span></div>

        <h2 className="bf-workspace-label">Рабочий стол</h2>
        <div className="bf-dashboard-actions">
          {actions.map(({ to, title, text, icon: Icon }) => (
            <Link key={to} to={to} className="bf-dashboard-action"><Icon aria-hidden className="size-6" /><ChevronRight aria-hidden className="bf-action-chevron size-4" /><strong>{title}</strong><span>{text}</span></Link>
          ))}
        </div>
        <Link to="/attestation" className="bf-dashboard-wide-action"><Star aria-hidden className="size-5" /><span><strong>Аттестация</strong><small>Проверь свои знания</small></span><ChevronRight aria-hidden className="size-4" /></Link>
      </div>

      {showBirthdaySection ? (
        <section>
          <div className="flex items-end justify-between gap-3"><div><p className="eyebrow">СЕГОДНЯ · КОМАНДА</p><h2 className="mt-1 text-2xl font-black">Ближайшие дни рождения</h2></div><Cake className="size-5 shrink-0 text-[var(--bf-gold)]" aria-hidden /></div>
          {birthdaysLoading ? (
            <div className="mt-3 grid gap-2">{[0, 1].map((item) => <div key={item} className="h-20 animate-pulse rounded-[20px] bg-[var(--bf-surface)]" />)}</div>
          ) : (
            <div className="mt-3 grid gap-2">
              {birthdays.map((birthday) => {
                const name = personName(birthday.first_name, birthday.last_name);
                const todayAge = birthday.days_until === 0 && birthday.age_years != null ? ageLabel(birthday.age_years) : null;
                return (
                  <Surface key={`${birthday.profile_id}:${birthday.days_until}`} className="flex min-h-20 items-center gap-3 p-3.5">
                    <div className="grid size-11 shrink-0 place-items-center rounded-full border border-[color:color-mix(in_srgb,var(--bf-gold),transparent_48%)] bg-[color:color-mix(in_srgb,var(--bf-gold),transparent_90%)]"><Cake className="size-5 text-[var(--bf-gold)]" aria-hidden /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--bf-cream)]">{BIRTHDAY_LABELS[birthday.days_until]}</span><span className="text-[11px] font-bold text-[var(--bf-dim)]">{positionLabel(birthday.position_code)}</span></div>
                      <p className="mt-1.5 text-base font-black leading-5 text-[var(--bf-cream)]">{birthday.days_until === 0 ? `${name} сегодня отмечает день рождения` : `${name} — ${BIRTHDAY_LABELS[birthday.days_until].toLowerCase()} день рождения`}</p>
                      {todayAge ? <p className="mt-1 text-sm font-bold text-[var(--bf-gold)]">Исполняется {todayAge}</p> : null}
                    </div>
                  </Surface>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      <DashboardFeedSection />

      {showReadingSection ? (
        <section aria-labelledby="dashboard-reading-title">
          <h2 id="dashboard-reading-title" className="text-[28px] font-black leading-none tracking-[-0.035em]">Что почитать</h2>
          {readingLoading ? (
            <div className="bf-scrollbar-none -mr-4 mt-4 flex gap-3 overflow-x-auto pr-4 pb-1" aria-label="Загрузка подборки статей">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-[188px] w-[156px] shrink-0 animate-pulse rounded-[18px] border border-[var(--bf-line)] bg-[var(--bf-surface)]" />)}</div>
          ) : (
            <ReadingCarousel articles={readingArticles} readIds={knowledgeProgress.state.readIds} />
          )}
        </section>
      ) : null}
    </motion.div>
  );
}
