import type { ReactNode } from "react";
import type { Tone } from "./format";

const TONES: Record<Tone, string> = {
  neutral: "bg-raised text-ink-2",
  sky: "bg-sky text-sky-ink",
  mint: "bg-mint text-mint-ink",
  butter: "bg-butter text-butter-ink",
  blush: "bg-blush text-blush-ink",
  lavender: "bg-lavender text-lavender-ink",
  peach: "bg-peach text-peach-ink",
};

type Props = {
  tone?: Tone;
  /** A leading 6px dot in the chip's ink colour, to reinforce a status. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
};

/** Status & meta chip. Neutral for information; a pastel tone for meaning. */
export function Badge({ tone = "neutral", dot = false, children, className = "" }: Props) {
  return (
    <span
      className={`inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium tracking-[0.02em] ${TONES[tone]} ${className}`}
    >
      {dot && (
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-current opacity-80"
        />
      )}
      {children}
    </span>
  );
}
