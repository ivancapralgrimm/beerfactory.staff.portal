import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[22px] border border-[var(--bf-line)] bg-[var(--bf-surface)]",
        className
      )}
      {...props}
    />
  );
}
