"use client";

import { useMemo, useState } from "react";
import type { Worker } from "@/lib/db-types";
import { api } from "../lib/client";
import { useScoped } from "../_components/use-scoped";
import { EmptyState, ErrorNote, LoadingNote, NoCompany, PageHeader } from "../_components/page";
import { SectionLabel } from "../_components/card";
import { Badge } from "../_components/badge";
import { AxisBars } from "../_components/data-bar";
import { TextInput } from "../_components/field";
import { fmtSec, fmtUSD } from "../_components/format";

function Monogram({ worker }: { worker: Worker }) {
  const initial = worker.name.replace(/[^A-Za-z]/, "").charAt(0).toUpperCase() || "?";
  const agent = worker.kind === "agent";
  return (
    <span
      aria-hidden
      className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] text-[16px] font-medium ${
        agent ? "bg-ink text-paper" : "bg-mint text-mint-ink"
      }`}
    >
      {initial}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.05em] text-ink-3">{label}</div>
      <div className="mt-0.5 font-mono text-[14px] text-ink">{value}</div>
    </div>
  );
}

function WorkerCard({ worker }: { worker: Worker }) {
  return (
    <div className="rounded-lg border border-border bg-paper p-5">
      <div className="flex items-center gap-3">
        <Monogram worker={worker} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[16px] font-medium text-ink">{worker.name}</span>
            <Badge tone={worker.kind === "human" ? "mint" : "neutral"}>
              {worker.kind === "human" ? "Human" : "Agent"}
            </Badge>
          </div>
          <div className="truncate font-mono text-[12px] text-ink-3">
            {worker.provider && worker.model ? `${worker.provider} · ${worker.model}` : "Human operator"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-10 border-t border-divider pt-3">
        <Stat label="Cost / task" value={fmtUSD(worker.costPerTaskUSD)} />
        <Stat label="Typical latency" value={fmtSec(worker.typicalLatencySec)} />
      </div>

      <div className="mt-5">
        <AxisBars humanAxes={worker.humanAxes} aiAxes={worker.aiAxes} />
      </div>
    </div>
  );
}

export default function WorkersPage() {
  const { data, loading, error, reload, companyId } = useScoped(api.workers);
  const [q, setQ] = useState("");

  const { agents, people, total } = useMemo(() => {
    const active = (data ?? []).filter((w) => w.active);
    const needle = q.trim().toLowerCase();
    const filtered = needle ? active.filter((w) => w.name.toLowerCase().includes(needle)) : active;
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    return {
      agents: sorted.filter((w) => w.kind === "agent"),
      people: sorted.filter((w) => w.kind === "human"),
      total: sorted.length,
    };
  }, [data, q]);

  let content;
  if (!companyId && !loading) content = <NoCompany />;
  else if (error) content = <ErrorNote message={error} onRetry={reload} />;
  else if (loading) content = <LoadingNote />;
  else if ((data ?? []).filter((w) => w.active).length === 0)
    content = <EmptyState>No active workers yet. Design this company&rsquo;s workforce on the Design page.</EmptyState>;
  else
    content = (
      <>
        <div className="mb-6 max-w-xs">
          <TextInput
            aria-label="Filter workers by name"
            placeholder="Filter by name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-10"
          />
        </div>

        {total === 0 ? (
          <p className="text-[13px] text-ink-3">No workers match &ldquo;{q}&rdquo;.</p>
        ) : (
          <div className="space-y-10">
            {agents.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <SectionLabel>AI agents</SectionLabel>
                  <span className="font-mono text-[12px] text-ink-3">{agents.length}</span>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  {agents.map((w) => (
                    <WorkerCard key={w.id} worker={w} />
                  ))}
                </div>
              </section>
            )}

            {people.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <SectionLabel>People</SectionLabel>
                  <span className="font-mono text-[12px] text-ink-3">{people.length}</span>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  {people.map((w) => (
                    <WorkerCard key={w.id} worker={w} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </>
    );

  return (
    <>
      <PageHeader
        title="Workers"
        caption="The AI agents and people this company can route work to — and what each is suited for."
      />
      {content}
    </>
  );
}
