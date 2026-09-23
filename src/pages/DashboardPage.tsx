import { motion } from "motion/react";
import {
  BookOpen,
  Cake,
  ClipboardCheck,
  Search,
  StickyNote
} from "lucide-react";
import { Link } from "react-router-dom";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import {
  HandoverNoteCard
} from "@/features/handover/HandoverNoteCard";
import {
  useHandoverFeed
} from "@/features/handover/use-handover-feed";
import {
  useUpcomingBirthdays
} from "@/features/dashboard/use-upcoming-birthdays";
import {
  STAFF_POSITION_LABELS,
  type StaffPosition
} from "@/types/auth";

const actions = [
  {
    to: "/menu",
    title: "Найти рецепт",
    text: "Бар и кухня без смешивания источников.",
    icon: Search
  },
  {
    to: "/knowledge",
    title: "Открыть знания",
    text: "Статьи и сервисные материалы.",
    icon: BookOpen
  },
  {
    to: "/shift",
    title: "Смена",
    text: "Открытие и закрытие по рабочей должности.",
    icon: ClipboardCheck
  },
  {
    to: "/handover",
    title: "Передача",
    text: "Общие рабочие заметки всей команды.",
    icon: StickyNote
  }
];

const BIRTHDAY_LABELS = {
  0: "Сегодня",
  1: "Завтра",
  2: "Послезавтра"
} as const;

function personName(
  firstName: string | null,
  lastName: string | null
) {
  return [
    firstName,
    lastName
  ]
    .filter(Boolean)
    .join(" ") || "Сотрудник";
}

function positionLabel(
  value: string | null
) {
  if (!value) return "Команда";

  return (
    STAFF_POSITION_LABELS[
      value as StaffPosition
    ] || "Команда"
  );
}

function ageLabel(age: number) {
  const mod100 = age % 100;
  const mod10 = age % 10;

  if (
    mod100 >= 11 &&
    mod100 <= 14
  ) {
    return `${age} лет`;
  }

  if (mod10 === 1) {
    return `${age} год`;
  }

  if (
    mod10 >= 2 &&
    mod10 <= 4
  ) {
    return `${age} года`;
  }

  return `${age} лет`;
}

export function DashboardPage() {
  const {
    notes,
    loading,
    error
  } = useHandoverFeed();

  const {
    birthdays,
    loading: birthdaysLoading,
    error: birthdaysError
  } = useUpcomingBirthdays();

  const activeNotes = notes.filter(
    (note) =>
      note.status !== "resolved"
  );

  const activeCount =
    activeNotes.length;

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 8
      }}
      animate={{
        opacity: 1,
        y: 0
      }}
      transition={{
        duration: 0.22,
        ease: "easeOut"
      }}
      className="space-y-5"
    >
      <section className="py-2">
        <p className="eyebrow">
          BFSTAFF · R40.4
        </p>

        <h1 className="mt-2 max-w-[16ch] text-balance text-[38px] font-black leading-[0.98] tracking-[-0.045em]">
          Рабочий портал команды
        </h1>

        <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-[var(--bf-muted)]">
          Всё, что требует внимания
          сегодня, плюс быстрый доступ
          к рабочим разделам.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            asChild
            variant="primary"
          >
            <Link to="/menu">
              Рецепты
            </Link>
          </Button>

          <Button asChild>
            <Link to="/profile">
              Мой профиль
            </Link>
          </Button>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">
              СЕГОДНЯ · КОМАНДА
            </p>
            <h2 className="mt-1 text-2xl font-black">
              Ближайшие дни рождения
            </h2>
          </div>

          <Cake
            className="size-5 shrink-0 text-[var(--bf-gold)]"
            aria-hidden
          />
        </div>

        {birthdaysLoading ? (
          <div className="mt-3 grid gap-2">
            {[0, 1].map(
              (item) => (
                <div
                  key={item}
                  className="h-20 animate-pulse rounded-[20px] bg-[var(--bf-surface)]"
                />
              )
            )}
          </div>
        ) : birthdaysError ? (
          <Surface className="mt-3 p-4">
            <p className="text-sm leading-6 text-[var(--bf-muted)]">
              Дни рождения сейчас
              не загрузились. Остальной
              Dashboard продолжает работать.
            </p>
          </Surface>
        ) : birthdays.length ? (
          <div className="mt-3 grid gap-2">
            {birthdays.map(
              (birthday) => {
                const name = personName(
                  birthday.first_name,
                  birthday.last_name
                );

                const todayAge =
                  birthday.days_until === 0 &&
                  birthday.age_years != null
                    ? ageLabel(
                        birthday.age_years
                      )
                    : null;

                return (
                  <Surface
                    key={`${birthday.profile_id}:${birthday.days_until}`}
                    className="flex min-h-20 items-center gap-3 p-3.5"
                  >
                    <div className="grid size-11 shrink-0 place-items-center rounded-full border border-[color:color-mix(in_srgb,var(--bf-gold),transparent_48%)] bg-[color:color-mix(in_srgb,var(--bf-gold),transparent_90%)]">
                      <Cake
                        className="size-5 text-[var(--bf-gold)]"
                        aria-hidden
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--bf-cream)]">
                          {
                            BIRTHDAY_LABELS[
                              birthday.days_until
                            ]
                          }
                        </span>

                        <span className="text-[11px] font-bold text-[var(--bf-dim)]">
                          {positionLabel(
                            birthday.position_code
                          )}
                        </span>
                      </div>

                      <p className="mt-1.5 text-base font-black leading-5 text-[var(--bf-cream)]">
                        {birthday.days_until === 0
                          ? `${name} сегодня отмечает день рождения`
                          : `${name} — ${
                              BIRTHDAY_LABELS[
                                birthday.days_until
                              ].toLowerCase()
                            } день рождения`}
                      </p>

                      {todayAge ? (
                        <p className="mt-1 text-sm font-bold text-[var(--bf-gold)]">
                          Исполняется {todayAge}
                        </p>
                      ) : null}
                    </div>
                  </Surface>
                );
              }
            )}
          </div>
        ) : (
          <Surface className="mt-3 p-4">
            <p className="text-sm font-black text-[var(--bf-cream)]">
              На ближайшие три дня
              дней рождения нет
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--bf-dim)]">
              Здесь появятся только
              актуальные поздравления:
              сегодня, завтра и послезавтра.
            </p>
          </Surface>
        )}
      </section>

      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">
              СЕГОДНЯ · ПЕРЕДАЧА
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Активные передачи
            </h2>
          </div>

          <Button
            asChild
            variant="secondary"
          >
            <Link to="/handover">
              <StickyNote
                className="size-4"
                aria-hidden
              />
              Открыть
            </Link>
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--bf-dim)]">
          <span className="rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface)] px-2.5 py-1.5 font-black text-[var(--bf-cream)]">
            {activeCount} активных
          </span>

          <span>
            Только то, что ещё
            требует внимания
          </span>
        </div>

        {loading ? (
          <div className="mt-3 grid gap-2">
            {[0, 1].map(
              (item) => (
                <div
                  key={item}
                  className="h-28 animate-pulse rounded-[20px] bg-[var(--bf-surface)]"
                />
              )
            )}
          </div>
        ) : error ? (
          <Surface className="mt-3 p-4">
            <p className="text-sm leading-6 text-[var(--bf-muted)]">
              Передача сейчас
              не загрузилась. Остальные
              разделы портала продолжают
              работать.
            </p>
          </Surface>
        ) : activeNotes.length ? (
          <div className="mt-3 grid gap-2">
            {activeNotes.map(
              (note) => (
                <HandoverNoteCard
                  key={note.id}
                  note={note}
                  compact
                />
              )
            )}
          </div>
        ) : (
          <Surface className="mt-3 p-5 text-center">
            <StickyNote
              className="mx-auto size-6 text-[var(--bf-dim)]"
              aria-hidden
            />

            <p className="mt-2 text-sm font-black">
              Активных передач нет
            </p>

            <p className="mt-1 text-xs leading-5 text-[var(--bf-dim)]">
              Решённые остаются
              в истории раздела
              «Передача» и не занимают
              главную.
            </p>
          </Surface>
        )}
      </section>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {actions.map(
          (
            {
              to,
              title,
              text,
              icon: Icon
            },
            index
          ) => (
            <motion.div
              key={to}
              initial={{
                opacity: 0,
                y: 6
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              transition={{
                delay:
                  0.04 * index,
                duration: 0.18
              }}
            >
              <Link
                to={to}
                className="block rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]"
              >
                <Surface className="min-h-36 p-4 transition-colors hover:border-[var(--bf-line-strong)]">
                  <div className="flex items-start justify-between gap-3">
                    <Icon
                      className="size-5 text-[var(--bf-copper-hi)]"
                      aria-hidden
                    />

                    <span className="text-xs font-bold tracking-[0.11em] text-[var(--bf-dim)]">
                      0{index + 1}
                    </span>
                  </div>

                  <h2 className="mt-6 text-xl font-extrabold">
                    {title}
                  </h2>

                  <p className="mt-1.5 text-sm leading-5 text-[var(--bf-muted)]">
                    {text}
                  </p>
                </Surface>
              </Link>
            </motion.div>
          )
        )}
      </div>
    </motion.div>
  );
}
