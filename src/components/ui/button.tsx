import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva('warm-button', {
 variants:{variant:{primary:'primary',secondary:'secondary',ghost:'quiet',danger:'danger'},size:{default:'',lg:'warm-button-lg',icon:'warm-button-icon'}},
 defaultVariants:{variant:'secondary',size:'default'}
});

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
        data-craft-variant={variant || "secondary"}
        data-craft-size={size ?? "default"}
        className={cn("bf-button craft-button", buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
