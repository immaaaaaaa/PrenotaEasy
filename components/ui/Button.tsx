"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
}

const base =
  // Instant press feedback (fires on pointer-down via :active), per the design skill.
  "relative inline-flex select-none items-center justify-center gap-2 font-[590] " +
  "rounded-[var(--r-md)] transition-[transform,background-color,opacity] duration-100 " +
  "ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] " +
  "touch-manipulation";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--on-accent)] shadow-[var(--shadow-sm)] active:bg-[var(--accent-press)]",
  secondary:
    "bg-[var(--surface-2)] text-[var(--ink)] active:bg-[var(--surface-3)]",
  ghost: "bg-transparent text-[var(--accent)] active:bg-[var(--accent-soft)]",
  danger: "bg-[var(--danger)] text-white active:brightness-95",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-4 text-[0.95rem]",
  lg: "h-[54px] px-5 text-[1.05rem]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth,
      loading,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          base,
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "inline-flex items-center gap-2 transition-opacity",
            loading && "opacity-0",
          )}
        >
          {children}
        </span>
        {loading && (
          <span className="absolute inset-0 grid place-items-center">
            <Spinner />
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
