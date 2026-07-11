"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./wordmark";
import { useCompany } from "./company-context";

const NAV: { label: string; href: string }[] = [
  { label: "Overview", href: "/" },
  { label: "Design", href: "/design" },
  { label: "Workers", href: "/workers" },
  { label: "Tasks", href: "/tasks" },
  { label: "Approvals", href: "/approvals" },
  { label: "Policies", href: "/policies" },
  { label: "Analytics", href: "/analytics" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      {open ? (
        <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : (
        <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  );
}

/**
 * Header: the wordmark on the left, and a single menu on the right that holds
 * everything else — the tabs and the workspace (company + operator). Keeping the
 * top row to two elements matches the calm, editorial landing.
 */
export function TopBar() {
  const pathname = usePathname();
  const { companies, company, companyId, setCompanyId, operator, setOperator, loading } =
    useCompany();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur-[6px]">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="focusable shrink-0 rounded-sm" aria-label="warrant — Overview">
          <Wordmark size={24} />
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Menu"
            className="focusable flex h-9 items-center gap-2.5 rounded-md border border-border bg-paper px-3 text-[13px] text-ink-2 transition-colors duration-[120ms] hover:border-ink-3 hover:text-ink"
          >
            <span className="hidden max-w-[160px] truncate sm:inline">
              {company?.name ?? (loading ? "Loading…" : "Menu")}
            </span>
            <MenuIcon open={open} />
          </button>

          {open && (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-lg border border-border bg-paper">
                <nav className="flex flex-col p-2">
                  {NAV.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`focusable relative flex h-9 items-center rounded-md px-3 text-[14px] transition-colors duration-[120ms] ${
                          active ? "bg-raised font-medium text-ink" : "text-ink-2 hover:bg-raised/70 hover:text-ink"
                        }`}
                      >
                        {active && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-lavender-line"
                          />
                        )}
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                <div className="border-t border-divider p-4">
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
                    Workspace
                  </p>
                  <label className="mb-1.5 block text-[13px] text-ink-2" htmlFor="company-select">
                    Company
                  </label>
                  <select
                    id="company-select"
                    value={companyId ?? ""}
                    disabled={loading || companies.length === 0}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="field-focus select-caret mb-4 h-10 w-full cursor-pointer rounded-md border border-border bg-paper pl-3 pr-8 text-[14px] text-ink hover:border-ink-3 disabled:cursor-not-allowed disabled:text-ink-3"
                  >
                    {loading && <option value="">Loading…</option>}
                    {!loading && companies.length === 0 && <option value="">No companies</option>}
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <label className="mb-1.5 block text-[13px] text-ink-2" htmlFor="operator-input">
                    Operator
                  </label>
                  <input
                    id="operator-input"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    placeholder="Your name"
                    className="field-focus h-10 w-full rounded-md border border-border bg-paper px-3 text-[14px] text-ink placeholder:text-ink-3 hover:border-ink-3"
                  />
                  <p className="mt-2 text-[12px] leading-[1.45] text-ink-3">
                    Signs approvals and confirms outcomes.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
