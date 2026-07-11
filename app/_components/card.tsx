import type { ReactNode } from "react";

type CardProps = {
  /** Optional header title (H3). */
  title?: ReactNode;
  /** Optional right-aligned header content (caption or a quiet action). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Body padding. Defaults to 24px; pass "tight" for 20px. */
  pad?: "default" | "tight" | "none";
};

const PAD = { default: "p-6", tight: "p-5", none: "" } as const;

/**
 * A surface: white paper, 1px border, 16px radius, no shadow. Elevation is the
 * border, never a drop shadow. Do not nest cards — flatten to hairline sections.
 */
export function Card({ title, action, children, className = "", pad = "default" }: CardProps) {
  return (
    <section
      className={`rounded-lg border border-border bg-paper ${PAD[pad]} ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex items-baseline justify-between gap-4 border-b border-divider pb-3">
          {title && <h3 className="text-[19px] font-medium tracking-[-0.01em] text-ink">{title}</h3>}
          {action && <div className="text-[13px] text-ink-3">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** A hairline-divided section title used inside a card or on bare paper. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">
      {children}
    </div>
  );
}
