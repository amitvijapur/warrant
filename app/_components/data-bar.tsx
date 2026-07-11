"use client";

import { useEffect, useRef, useState } from "react";
import { AI_AXES, HUMAN_AXES, fmt2 } from "./format";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

type BarProps = {
  value: number; // 0..1
  label?: string;
  valueText?: string;
  /** default = ink fill (magnitude); reliability = mint fill (confidence). */
  variant?: "default" | "reliability";
  className?: string;
};

/**
 * The core evidence primitive: a 6px track with a fill scaled 0..1. The fill
 * animates via transform (scaleX), never width. Quiet by design — many appear
 * at once in rows and tables.
 */
export function DataBar({ value, label, valueText, variant = "default", className = "" }: BarProps) {
  const fill = variant === "reliability" ? "bg-mint-line" : "bg-ink";
  return (
    <div className={className}>
      {(label || valueText) && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          {label && (
            <span className="text-[11px] uppercase tracking-[0.04em] text-ink-3">{label}</span>
          )}
          {valueText && (
            <span className="font-mono text-[12px] text-ink-2">{valueText}</span>
          )}
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
        <div
          className={`bar-fill h-full w-full rounded-full ${fill}`}
          style={{ transform: `scaleX(${clamp01(value)})` }}
        />
      </div>
    </div>
  );
}

/**
 * Worker suitability / task-type requirements as two axis groups. `dense` drops
 * the per-axis value and tightens spacing for use inside a table cell.
 */
export function AxisBars({
  humanAxes,
  aiAxes,
  dense = false,
}: {
  humanAxes: Record<string, number>;
  aiAxes: Record<string, number>;
  dense?: boolean;
}) {
  const gap = dense ? "gap-x-6 gap-y-2.5" : "gap-x-8 gap-y-4";
  const stack = dense ? "space-y-1.5" : "space-y-2";
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${gap}`}>
      <div className={stack}>
        <div className="text-[11px] uppercase tracking-[0.06em] text-ink-3">Human axes</div>
        {HUMAN_AXES.map((a) => (
          <DataBar
            key={a.key}
            label={a.label}
            value={humanAxes[a.key] ?? 0}
            valueText={dense ? undefined : fmt2(humanAxes[a.key] ?? 0)}
          />
        ))}
      </div>
      <div className={stack}>
        <div className="text-[11px] uppercase tracking-[0.06em] text-ink-3">AI axes</div>
        {AI_AXES.map((a) => (
          <DataBar
            key={a.key}
            label={a.label}
            value={aiAxes[a.key] ?? 0}
            valueText={dense ? undefined : fmt2(aiAxes[a.key] ?? 0)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A number that counts from its previous value to the next on change — used for
 * the reputation mean after a Confirm, the one place a number visibly moves.
 */
export function AnimatedNumber({
  value,
  format = fmt2,
  className = "",
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // Reduced motion: jump straight to the value, no animation to sync.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    const duration = 240;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={className}>{format(display)}</span>;
}
