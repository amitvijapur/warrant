"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ink text-paper hover:bg-[#2a2a2a] disabled:bg-ink-disabled disabled:text-paper",
  secondary:
    "bg-paper border border-ink text-ink hover:bg-raised disabled:border-divider disabled:text-ink-disabled",
  ghost:
    "bg-transparent text-ink-2 hover:bg-raised hover:text-ink disabled:text-ink-disabled disabled:hover:bg-transparent",
  danger:
    "bg-paper border border-blush-line text-blush-ink hover:bg-blush disabled:border-divider disabled:text-ink-disabled",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** In-flight: disables the button and swaps the label. No spinner, no shift. */
  pending?: boolean;
  pendingLabel?: string;
};

/**
 * The one control primitive. Colour alone separates the variants; use at most
 * one `primary` per view/step. While `pending`, the button is disabled and its
 * label becomes `pendingLabel` — guarding against double-submits.
 */
export function Button({
  variant = "secondary",
  pending = false,
  pendingLabel,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`focusable inline-flex h-10 select-none items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors duration-[120ms] active:translate-y-[0.5px] disabled:cursor-not-allowed disabled:active:translate-y-0 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
