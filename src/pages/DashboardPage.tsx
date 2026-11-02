import { StaffAvatar } from "@/components/staff/StaffAvatar";
import { ReadingCarousel } from "@/features/dashboard/ReadingCarousel";

import { useEffect, useMemo, useState } from "react";
import { loadPositionShiftWorkflow } from "@/features/shift/shift-api";
import type { PositionShiftWorkflow } from "@/features/shift/types";
import { useAuth } from "@/features/auth/auth-context";
import {WarmIcon} from "@/components/warm/WarmIcon";
import {WarmDialog} from "@/components/warm/WarmDialog";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
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

const BIRTHDAY_LABELS = {
  [-1]: "Вчера был день рождения",
  0: "Сегодня день рождения",
  1: "Завтра день рождения",
  2: "Послезавтра день рождения",
  3: "Через 3 дня день рождения"
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
  const [birthdayOpen,setBirthdayOpen]=useState<string|null>(null);
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

  const user=auth.status==='authenticated'?auth.user:null;
  const venue=user?.position_code?.endsWith('_bb')?'BeerBistro':'BeerFactory';
  const position=user?.position_code?STAFF_POSITION_LABELS[user.position_code]:'';
  const date=new Date(shiftWorkflow?.context.server_now??Date.now());
  return <div className="warm-dashboard stack">
    <section className="bf-greeting" aria-labelledby="greeting"><div><h1 id="greeting" tabIndex={-1}>Привет{firstName?',':''}<br/>{firstName?firstName+'.':'команда.'}</h1><p className="muted text-[.8125rem]">{venue}{position?' · '+position:''}</p><p className="muted text-xs mt-2">{new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Novosibirsk'}).format(date)}</p></div>{user && <StaffAvatar user={user} className="bf-staff-avatar--greeting"/>}</section>
    <DashboardGlobalSearch/>
    {showBirthdaySection&&<section className="warm-birthdays" aria-labelledby="birthdays-title"><h2 id="birthdays-title">Дни рождения</h2>{birthdaysLoading?<p className="small muted" role="status">Загружаем дни рождения…</p>:<ul className="warm-birthday-list">{birthdays.map(birthday=>{const name=personName(birthday.first_name,birthday.last_name);return <li key={birthday.profile_id}><button type="button" className="bf-birthday" onClick={()=>setBirthdayOpen(birthday.profile_id)}><span className="person">{[birthday.first_name,birthday.last_name].map(n=>n?.[0]??'').join('')}</span><span><span className="block small muted">{BIRTHDAY_LABELS[birthday.days_until]}</span><strong>{name}</strong></span><WarmIcon name="chevron"/></button></li>;})}</ul>}</section>}
    <section className="bf-shift-panel" aria-labelledby="home-shift"><div className="row spread flex-wrap"><h2 id="home-shift">Твоя смена</h2><span className="small">11:00–03:00</span></div><div className="row spread flex-wrap mt-4"><p className="small">{shiftStatus[0]}<br/>{venue}</p><Button asChild variant="secondary"><Link to="/shift">{shiftWorkflow?.shift?.status==='active'?'К задачам':'Открыть смену'}<WarmIcon name="arrow"/></Link></Button></div></section>
    <DashboardFeedSection/>
    <Link className="bf-material-link" to="/menu"><span>Открыть рецепты</span><WarmIcon name="chevron"/></Link>
    {showReadingSection&&<section aria-labelledby="dashboard-reading-title"><h2 id="dashboard-reading-title">Для тебя</h2>{readingLoading?<p className="small muted" role="status">Загружаем статьи…</p>:<ReadingCarousel articles={readingArticles} readIds={knowledgeProgress.state.readIds}/>}</section>}
    {birthdayOpen&&(()=>{const person=birthdays.find(b=>b.profile_id===birthdayOpen);return person?<WarmDialog title={personName(person.first_name,person.last_name)} onClose={()=>setBirthdayOpen(null)}><p>{BIRTHDAY_LABELS[person.days_until]}.</p><p className="muted mt-2">{positionLabel(person.position_code)}</p>{person.days_until===0&&person.age_years!=null&&<p className="mt-3">Исполняется {ageLabel(person.age_years)}</p>}</WarmDialog>:null;})()}
  </div>;
}
