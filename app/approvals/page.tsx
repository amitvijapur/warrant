"use client";

import { useMemo, useState } from "react";
import type { Assignment, Task, Worker } from "@/lib/db-types";
import { api } from "../lib/client";
import { useCompany } from "../_components/company-context";
import { useScoped } from "../_components/use-scoped";
import { useToast } from "../_components/toast";
import { EmptyState, ErrorNote, LoadingNote, NoCompany, PageHeader } from "../_components/page";
import { Badge } from "../_components/badge";
import { GateBanner } from "../_components/gate";
import { modeLabel, triggerMeta } from "../_components/format";

type Bundle = { assignments: Assignment[]; tasks: Task[]; workers: Worker[] };

const loadApprovals = (companyId: string): Promise<Bundle> =>
  Promise.all([
    api.assignments(companyId, "awaiting_approval"),
    api.tasks(companyId),
    api.workers(companyId),
  ]).then(([assignments, tasks, workers]) => ({ assignments, tasks, workers }));

export default function ApprovalsPage() {
  const { operator } = useCompany();
  const { show } = useToast();
  const { data, loading, error, reload, companyId } = useScoped(loadApprovals);
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const taskTitle = useMemo(() => {
    const map = new Map((data?.tasks ?? []).map((t) => [t.id, t.title]));
    return (id: string) => map.get(id) ?? "Untitled task";
  }, [data]);

  const workerName = useMemo(() => {
    const map = new Map((data?.workers ?? []).map((w) => [w.id, w.name]));
    return (id: string) => map.get(id) ?? id;
  }, [data]);

  const pending = useMemo(
    () => (data?.assignments ?? []).filter((a) => !removed.has(a.id)),
    [data, removed],
  );

  let content;
  if (!companyId && !loading) content = <NoCompany />;
  else if (error) content = <ErrorNote message={error} onRetry={reload} />;
  else if (loading) content = <LoadingNote />;
  else if (pending.length === 0)
    content = <EmptyState>Nothing is awaiting approval.</EmptyState>;
  else
    content = (
      <div className="space-y-5">
        {pending.map((a) => (
          <ApprovalCard
            key={a.id}
            assignment={a}
            title={taskTitle(a.taskId)}
            worker={workerName(a.workerId)}
            operator={operator}
            onApproved={() => {
              setRemoved((s) => new Set(s).add(a.id));
              show("Approved");
            }}
          />
        ))}
      </div>
    );

  return (
    <>
      <PageHeader
        title="Approvals"
        caption="Irreversible actions held at the gate. Each runs only after a person signs off."
      />
      {content}
    </>
  );
}

function ApprovalCard({
  assignment,
  title,
  worker,
  operator,
  onApproved,
}: {
  assignment: Assignment;
  title: string;
  worker: string;
  operator: string;
  onApproved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const trig = triggerMeta(assignment.trigger);

  const approve = (approvedBy: string) => {
    setBusy(true);
    setErr(null);
    api
      .approve(assignment.id, approvedBy)
      .then(() => onApproved())
      .catch((e: unknown) => {
        setErr(e instanceof Error ? e.message : String(e));
        setBusy(false);
      });
  };

  return (
    <article className="rounded-lg border border-border bg-paper p-6">
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-[19px] font-medium tracking-[-0.01em] text-ink">{title}</h3>
          <Badge tone={trig.tone}>{trig.label}</Badge>
        </div>
        <p className="text-[14px] text-ink-2">
          Proposed by <span className="font-medium text-ink">{worker}</span> ·{" "}
          {modeLabel(assignment.mode)}
        </p>
        <p className="max-w-prose text-[15px] leading-[1.6] text-ink-2">{assignment.rationale}</p>
      </div>
      <GateBanner
        idPrefix={`approve-${assignment.id}`}
        defaultApprovedBy={operator}
        pending={busy}
        onApprove={approve}
      />
      {err && (
        <div className="mt-3">
          <ErrorNote message={err} />
        </div>
      )}
    </article>
  );
}
