import { motion } from "motion/react";
import {
  BookOpen,
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

export function DashboardPage() {
  const {
    notes,
    loading,
    error
  } = useHandoverFeed();

  const activeNotes = notes.filter(
    (note) => note.status !== "resolved"
  );

  const activeCount = activeNotes.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
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
          Рецепты, знания, аттестация,
          смена и общая передача информации
          в одном месте.
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
            Только то, что ещё требует внимания
          </span>
        </div>

        {loading ? (
          <div className="mt-3 grid gap-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-[20px] bg-[var(--bf-surface)]"
              />
            ))}
          </div>
        ) : error ? (
          <Surface className="mt-3 p-4">
            <p className="text-sm leading-6 text-[var(--bf-muted)]">
              Передача сейчас не загрузилась.
              Остальные разделы портала продолжают работать.
            </p>
          </Surface>
        ) : activeNotes.length ? (
          <div className="mt-3 grid gap-2">
            {activeNotes.map((note) => (
              <HandoverNoteCard
                key={note.id}
                note={note}
                compact
              />
            ))}
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
              Решённые остаются в истории раздела «Передача» и не занимают главную.
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
                delay: 0.04 * index,
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
