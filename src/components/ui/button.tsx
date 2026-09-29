import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-[background-color,border-color,color,transform,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bf-bg)] disabled:pointer-events-none disabled:opacity-45 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "border border-[var(--bf-copper)] bg-[var(--bf-copper)] text-[#fff8ed] hover:bg-[var(--bf-copper-hi)]",
        secondary:
          "border border-[var(--bf-line)] bg-[var(--bf-surface-2)] text-[var(--bf-cream)] hover:border-[var(--bf-line-strong)]",
        ghost:
          "border border-transparent bg-transparent text-[var(--bf-muted)] hover:bg-[var(--bf-surface-2)] hover:text-[var(--bf-cream)]",
        danger:
          "border border-[color:color-mix(in_srgb,var(--bf-red),transparent_35%)] bg-[color:color-mix(in_srgb,var(--bf-red),transparent_86%)] text-[#ffb2aa]"
      },
      size: {
        default: "h-11",
        lg: "min-h-12 px-5 text-base",
        icon: "size-11 px-0"
      }
    },
    defaultVariants: {
      variant: "secondary",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
