import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

export function PlaceholderPage({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-4"
    >
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">{title}</h1>
      <p className="mt-3 max-w-xl text-pretty leading-7 text-[var(--bf-muted)]">
        {description}
      </p>
      <p className="mt-4 text-sm leading-6 text-[var(--bf-dim)]">
        Этот модуль намеренно ещё не перенесён. Стабильная версия остаётся в production
        r40.3, пока новая реализация не пройдёт отдельный smoke-test.
      </p>
      <Button asChild className="mt-5">
        <Link to="/"><ArrowLeft className="size-4" />На главную</Link>
      </Button>
    </motion.section>
  );
}
