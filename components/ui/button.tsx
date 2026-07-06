"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/30 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-green-600 text-white hover:bg-green-700 shadow-sm",
        secondary:
          "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200",
        ghost:
          "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
        destructive:
          "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
        outline:
          "border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300",
        link:
          "text-green-600 underline-offset-4 hover:underline p-0 h-auto",
        success:
          "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-7 px-3 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
        "icon-sm": "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
