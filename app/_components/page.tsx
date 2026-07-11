import type { ReactNode } from "react";

/** Page header: H1 title + a one-line caption. Left-aligned, editorial. */
export function PageHeader({
  title,
  caption,
  action,
}: {
  title: string;
  caption?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex items-end justify-between gap-6">
      <div className="space-y-1.5">
        <h1 className="font-serif text-[40px] font-semibold leading-[1.05] tracking-[-0.005em] text-ink">
          {title}
        </h1>
        {caption && <p className="max-w-2xl text-[15px] text-ink-2">{caption}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/** An empty state that teaches the next action, never a blank grid. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center text-[15px] text-ink-3">
      {children}
    </div>
  );
}

/** Shown when no company is available to scope a page. */
export function NoCompany() {
  return (
    <EmptyState>
      No companies yet. Run{" "}
      <code className="rounded-sm bg-raised px-1.5 py-0.5 font-mono text-[13px] text-ink-2">
        npm run seed
      </code>{" "}
      to create one.
    </EmptyState>
  );
}

/** A quiet loading caption; keep layout stable, never a full-page spinner. */
export function LoadingNote({ children = "Loading…" }: { children?: ReactNode }) {
  return <p className="text-[13px] text-ink-3">{children}</p>;
}

/** An error surfaced from the API's `{ error }`, with an optional retry. */
export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <p className="text-[13px] text-blush-ink">
      {message}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="focusable ml-2 rounded-sm underline underline-offset-2 hover:text-ink"
        >
          Retry
        </button>
      )}
    </p>
  );
}
