import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { PaperCard } from "@/components/craft/CraftPage";

export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <PaperCard
      className={cn(
        "craft-paper-card rounded-[22px] border border-[var(--bf-line)] bg-[var(--bf-surface)]",
        className
      )}
      {...props}
    />
  );
}
