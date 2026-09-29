import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "min-h-12 w-full rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3.5 text-base text-[var(--bf-cream)] outline-none placeholder:text-[var(--bf-dim)] focus-visible:border-[var(--bf-copper-hi)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--bf-copper-hi),transparent_72%)] disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
