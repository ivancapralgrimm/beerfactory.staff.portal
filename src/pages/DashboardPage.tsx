import { motion } from "motion/react";
import { BookOpen, ClipboardCheck, Search, StickyNote } from "lucide-react";
import { Link } from "react-router-dom";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";

const actions = [
  { to: "/menu", title: "Найти рецепт", text: "Бар и кухня без смешивания источников.", icon: Search },
  { to: "/knowledge", title: "Открыть знания", text: "Короткие статьи и сервисные материалы.", icon: BookOpen },
  { to: "/shift", title: "Смена", text: "Открытие и закрытие без фиктивного offline-success.", icon: ClipboardCheck },
  { to: "/handover", title: "Передача", text: "Важное следующей смене, не очередной чат.", icon: StickyNote }
];

export function DashboardPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-5"
    >
      <section className="py-2">
        <p className="eyebrow">BFSTAFF · R40.4</p>
        <h1 className="mt-2 max-w-[16ch] text-balance text-[38px] font-black leading-[0.98] tracking-[-0.045em]">
          Рабочий портал, а не склад экранов.
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-[var(--bf-muted)]">
          Новый React-каркас запускается отдельно от стабильного r40.3. На первом этапе
          переносим оболочку и авторизацию, затем модули по одному.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="primary"><Link to="/menu">Рецепты</Link></Button>
          <Button asChild><Link to="/profile">Мой профиль</Link></Button>
        </div>
      </section>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {actions.map(({ to, title, text, icon: Icon }, index) => (
          <motion.div
            key={to}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * index, duration: 0.18 }}
          >
            <Link to={to} className="block rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]">
              <Surface className="min-h-36 p-4 transition-colors hover:border-[var(--bf-line-strong)]">
                <div className="flex items-start justify-between gap-3">
                  <Icon className="size-5 text-[var(--bf-copper-hi)]" aria-hidden />
                  <span className="text-xs font-bold tracking-[0.11em] text-[var(--bf-dim)]">
                    0{index + 1}
                  </span>
                </div>
                <h2 className="mt-6 text-xl font-extrabold">{title}</h2>
                <p className="mt-1.5 text-sm leading-5 text-[var(--bf-muted)]">{text}</p>
              </Surface>
            </Link>
          </motion.div>
        ))}
      </div>

      <section className="border-t border-[var(--bf-line)] pt-5">
        <p className="eyebrow">МИГРАЦИЯ</p>
        <div className="mt-3 grid gap-2 text-sm text-[var(--bf-muted)]">
          <p><strong className="text-[var(--bf-cream)]">Сейчас:</strong> React/TS foundation, auth/session, PWA shell.</p>
          <p><strong className="text-[var(--bf-cream)]">Дальше:</strong> Recipes → Knowledge → Attestation → Shift → Handover → Admin.</p>
        </div>
      </section>
    </motion.div>
  );
}
