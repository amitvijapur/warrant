import type { ReactNode } from "react";

/** A full-width table on paper: raised header, hairline row dividers, no rules. */
export function DataTable({
  head,
  children,
  minWidth = 720,
}: {
  head: ReactNode;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-[14px]" style={{ minWidth }}>
        <thead className="bg-raised">
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className = "",
}: {
  children?: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.04em] text-ink-3 ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  mono = false,
  className = "",
}: {
  children?: ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-3 align-middle ${align === "right" ? "text-right" : ""} ${
        mono ? "font-mono text-[13px]" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function Row({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <tr
      className={`border-t border-divider transition-colors duration-[120ms] hover:bg-surface ${className}`}
    >
      {children}
    </tr>
  );
}
