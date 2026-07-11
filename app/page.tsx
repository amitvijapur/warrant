"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Assignment, Outcome, Task, TaskType, Worker } from "@/lib/db-types";
import type { Allocation } from "@/lib/types";
import { api, type Classification } from "./lib/client";
import { useCompany } from "./_components/company-context";
import { useScoped } from "./_components/use-scoped";
import { ErrorNote, LoadingNote, NoCompany } from "./_components/page";
import { SectionLabel } from "./_components/card";
import { Button } from "./_components/button";
import { Badge } from "./_components/badge";
import { Textarea } from "./_components/field";
import { Stage } from "./_components/stage";
import { ScoreBreakdown } from "./_components/score-breakdown";
import { GateBanner } from "./_components/gate";
import { ReputationPanel } from "./_components/reputation-panel";
import { fmt2, fmtMs, fmtUSD, modeLabel, triggerMeta } from "./_components/format";

type Phase = "compose" | "route" | "execute" | "confirm" | "done";
type ExecStatus = "completed" | "gate_required" | "human_work_item";

type Meta = { types: TaskType[]; workers: Worker[] };
const loadMeta = (companyId: string): Promise<Meta> =>
  Promise.all([api.taskTypes(companyId), api.workers(companyId)]).then(([types, workers]) => ({
    types,
    workers,
  }));

/** One-click examples that exercise the three routing paths (wording mirrors
 *  scripts/demo.ts): reversible → autonomous, irreversible → gate, judgment → human. */
const EXAMPLES: { chip: string; icon: "doc" | "cart" | "mail"; input: string }[] = [
  {
    chip: "Support ticket",
    icon: "doc",
    input:
      "Hi — I ordered the Vitamin C serum last week (order LM-4821) and I'm not sure how often I should use it. Morning and night, or just once a day? Thanks!",
  },
  {
    chip: "Refund over $200",
    icon: "cart",
    input:
      "Please issue a $240 refund on order LM-3990 — the customer received a damaged Retinol Renewal set and we've approved a full refund under our damage policy.",
  },
  {
    chip: "Upset customer",
    icon: "mail",
    input:
      "Customer email: 'This is the third time my Lumen order has arrived leaking and ruined. I've been a loyal customer for two years and I'm honestly done. What are you going to do about this?'",
  },
];

function ChipIcon({ kind }: { kind: "doc" | "cart" | "mail" }) {
  const common = { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true } as const;
  if (kind === "doc")
    return (
      <svg {...common}>
        <path d="M4 2h5l3 3v9H4V2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M9 2v3h3M6 8.5h4M6 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  if (kind === "cart")
    return (
      <svg {...common}>
        <path d="M2 2.5h1.4L5 10.5h6.5l1.3-5.5H4.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="13" r="0.9" fill="currentColor" />
        <circle cx="11" cy="13" r="0.9" fill="currentColor" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="2" y="3.5" width="12" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="m2.5 4.5 5.5 4 5.5-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 13V3M8 3 4 7M8 3l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Derive a short task title from the free-text input (there is no title field). */
function deriveTitle(input: string): string {
  const firstLine = input.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const cleaned = firstLine.replace(/^(invoice|customer email:?)/i, "").trim() || firstLine;
  const words = cleaned.split(/\s+/).slice(0, 9).join(" ");
  const title = words.length > 64 ? `${words.slice(0, 61)}…` : words;
  return title || "Untitled task";
}

export default function Overview() {
  const { companyId, operator, loading: companiesLoading } = useCompany();
  const meta = useScoped(loadMeta);
  const rep = useScoped(api.reputation);

  // ── Run-trace state ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("compose");
  const [input, setInput] = useState("");
  const [task, setTask] = useState<Task | null>(null);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [allocation, setAllocation] = useState<Allocation | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [execStatus, setExecStatus] = useState<ExecStatus | null>(null);
  const [finalAssignment, setFinalAssignment] = useState<Assignment | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [humanResponse, setHumanResponse] = useState("");
  const [confirmedPass, setConfirmedPass] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetTrace = useCallback(() => {
    setPhase("compose");
    setInput("");
    setTask(null);
    setClassification(null);
    setAllocation(null);
    setAssignment(null);
    setExecStatus(null);
    setFinalAssignment(null);
    setOutcome(null);
    setHumanResponse("");
    setConfirmedPass(null);
    setBusy(false);
    setError(null);
  }, []);

  // A new company means a new run; clear the trace.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resetTrace();
  }, [companyId, resetTrace]);

  const workerName = useMemo(() => {
    const map = new Map((meta.data?.workers ?? []).map((w) => [w.id, w.name]));
    return (id: string) => map.get(id) ?? id;
  }, [meta.data]);

  const typeName = useMemo(() => {
    const map = new Map((meta.data?.types ?? []).map((t) => [t.id, t.name]));
    return (id: string) => map.get(id) ?? id;
  }, [meta.data]);

  const onError = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  // ── Actions ───────────────────────────────────────────────────────────────
  const submit = () => {
    if (!companyId || !input.trim()) return;
    setBusy(true);
    setError(null);
    api
      .submitTask(companyId, deriveTitle(input), input.trim())
      .then((res) => {
        setTask(res.task);
        setClassification(res.classification);
        setPhase("route");
      })
      .catch(onError)
      .finally(() => setBusy(false));
  };

  const route = () => {
    if (!task) return;
    setBusy(true);
    setError(null);
    api
      .route(task.id)
      .then((res) => {
        setAssignment(res.assignment);
        setAllocation(res.allocation);
        setPhase("execute");
      })
      .catch(onError)
      .finally(() => setBusy(false));
  };

  const execute = () => {
    if (!assignment) return;
    setBusy(true);
    setError(null);
    api
      .execute(assignment.id)
      .then((res) => {
        setExecStatus(res.status);
        if (res.status === "completed") {
          setFinalAssignment(res.assignment);
          setOutcome(res.outcome);
          setPhase("confirm");
        } else {
          setFinalAssignment(res.assignment);
        }
      })
      .catch(onError)
      .finally(() => setBusy(false));
  };

  const approve = (approvedBy: string) => {
    if (!assignment) return;
    setBusy(true);
    setError(null);
    api
      .approve(assignment.id, approvedBy)
      .then((res) => {
        setFinalAssignment(res.assignment);
        setOutcome(res.outcome);
        setPhase("confirm");
      })
      .catch(onError)
      .finally(() => setBusy(false));
  };

  const submitHuman = () => {
    if (!assignment) return;
    setBusy(true);
    setError(null);
    api
      .submitOutput(assignment.id, humanResponse.trim())
      .then((res) => {
        setFinalAssignment(res.assignment);
        setOutcome(res.outcome);
        setPhase("confirm");
      })
      .catch(onError)
      .finally(() => setBusy(false));
  };

  const confirm = (pass: boolean) => {
    if (!outcome) return;
    setBusy(true);
    setError(null);
    api
      .confirm(outcome.id, pass, operator)
      .then(() => {
        setConfirmedPass(pass);
        setPhase("done");
        rep.reload();
      })
      .catch(onError)
      .finally(() => setBusy(false));
  };

  // ── No company ────────────────────────────────────────────────────────────
  if (!companyId) {
    return (
      <div className="mx-auto max-w-[640px] pt-24 text-center">
        {companiesLoading ? <LoadingNote /> : <NoCompany />}
      </div>
    );
  }

  // ── Landing: the calm, centered composer (no task yet) ─────────────────────
  if (!task) {
    return (
      <div className="animate-reveal mx-auto flex max-w-[720px] flex-col pt-[8vh] sm:pt-[12vh]">
        <h1 className="text-center font-serif text-ink" style={{ fontSize: "clamp(2.4rem, 5vw, 3.4rem)", fontStyle: "italic", lineHeight: 1.05 }}>
          Who should do this work?
        </h1>

        <div className="mt-9 rounded-[22px] border border-border bg-paper p-2 shadow-none transition-colors focus-within:border-ink-3">
          <Textarea
            aria-label="Task"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
            placeholder="Assign a task, or paste a ticket, an email, a request…"
            rows={4}
            className="min-h-[112px] resize-none border-0 bg-transparent px-4 pt-3 text-[16px] leading-[1.55] hover:border-0 focus:shadow-none"
          />
          <div className="flex items-center justify-between gap-3 px-3 pb-1.5">
            <span className="text-[12px] text-ink-3">
              warrant classifies, routes, and gates it — you stay in control.
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim() || busy}
              aria-label="Assign task"
              className="focusable inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink text-paper transition-colors duration-[120ms] hover:bg-[#2a2a2a] disabled:bg-ink-disabled"
            >
              <SendIcon />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.chip}
              type="button"
              onClick={() => setInput(ex.input)}
              className="focusable inline-flex items-center gap-2 rounded-full border border-border bg-paper px-3.5 py-2 text-[13px] text-ink-2 transition-colors duration-[120ms] hover:border-ink-3 hover:text-ink"
            >
              <span className="text-ink-3">
                <ChipIcon kind={ex.icon} />
              </span>
              {ex.chip}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 text-center">
            <ErrorNote message={error} />
          </div>
        )}
      </div>
    );
  }

  // ── Run view: the trace unfolds, reputation alongside ──────────────────────
  const routeNode = allocation ? "done" : "active";
  const executeNode = outcome ? "done" : execStatus === "gate_required" ? "gate" : "active";
  const confirmNode = confirmedPass !== null ? "done" : "active";
  const trig = allocation ? triggerMeta(allocation.trigger) : null;

  const trace = (
    <ol className="relative">
      {/* 1 — Classified */}
      <Stage node="done" title="Classified" animate>
        <div className="space-y-2">
          {classification && (
            <span className="animate-reveal inline-block">
              <Badge tone="sky" dot>
                {typeName(classification.taskTypeId)} · confidence {fmt2(classification.confidence)} ·{" "}
                {classification.reversibility}
              </Badge>
            </span>
          )}
          {classification?.reasoning && (
            <p className="max-w-prose text-[13px] leading-[1.5] text-ink-3">{classification.reasoning}</p>
          )}
        </div>
      </Stage>

      {/* 2 — Route */}
      <Stage node={routeNode} title="Route" last={!assignment} animate>
        {!allocation ? (
          <div className="space-y-3">
            <p className="text-[14px] text-ink-2">
              Ask the router to choose a worker and show its reasoning.
            </p>
            {error && <ErrorNote message={error} />}
            <Button variant="primary" pending={busy} pendingLabel="Routing…" onClick={route}>
              Route to a worker
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-[20px] font-medium tracking-[-0.01em] text-ink">
                  {workerName(allocation.workerId)}
                </h3>
                {trig && <Badge tone={trig.tone}>{trig.label}</Badge>}
              </div>
              <p className="text-[13px] text-ink-3">
                {modeLabel(allocation.mode)}
                {trig ? ` · ${trig.gloss}` : ""}
              </p>
            </div>
            <div className="space-y-2">
              <SectionLabel>Score breakdown</SectionLabel>
              <ScoreBreakdown scores={allocation.scores} chosenId={allocation.workerId} workerName={workerName} />
            </div>
            <div className="space-y-1">
              <SectionLabel>Rationale</SectionLabel>
              <p className="max-w-prose text-[15px] leading-[1.6] text-ink-2">{allocation.rationale}</p>
            </div>
          </div>
        )}
      </Stage>

      {/* 3 — Execute */}
      {assignment && (
        <Stage node={executeNode} title="Execute" last={!outcome} animate>
          {outcome ? (
            <div className="space-y-5">
              <div>
                <SectionLabel>Output</SectionLabel>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-raised p-4 font-mono text-[13px] leading-[1.6] text-ink-2">
                  {finalAssignment?.output ?? ""}
                </pre>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[12px] text-ink-3">
                  <span>cost {fmtUSD(finalAssignment?.costUSD ?? null)}</span>
                  <span>latency {fmtMs(finalAssignment?.latencyMs ?? null)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <SectionLabel>Judge verdict</SectionLabel>
                <div className="animate-reveal flex items-start gap-3">
                  <Badge tone={outcome.judgePass ? "mint" : "blush"} dot>
                    {outcome.judgePass ? "PASS" : "FAIL"}
                  </Badge>
                  <p className="text-[14px] leading-[1.55] text-ink-2">{outcome.judgeDetail}</p>
                </div>
              </div>
            </div>
          ) : execStatus === "gate_required" ? (
            <div className="space-y-3">
              <GateBanner idPrefix="overview" defaultApprovedBy={operator} pending={busy} onApprove={approve} />
              {error && <ErrorNote message={error} />}
            </div>
          ) : execStatus === "human_work_item" ? (
            <div className="rounded-lg border border-mint-line bg-mint p-5">
              <h3 className="text-[19px] font-medium tracking-[-0.01em] text-ink">
                Routed to a human operator
              </h3>
              <p className="mt-1 text-[14px] text-mint-ink">
                No agent scored competitively — this needs a person&rsquo;s judgment.
              </p>
              <div className="mt-4">
                <label className="mb-1.5 block text-[13px] text-mint-ink" htmlFor="human-response">
                  Operator response
                </label>
                <Textarea
                  id="human-response"
                  rows={5}
                  value={humanResponse}
                  onChange={(e) => setHumanResponse(e.target.value)}
                  placeholder="Write the response the operator will send…"
                  className="min-h-32 bg-paper"
                />
              </div>
              {error && (
                <div className="mt-3">
                  <ErrorNote message={error} />
                </div>
              )}
              <div className="mt-3">
                <Button variant="primary" pending={busy} pendingLabel="Submitting…" disabled={!humanResponse.trim()} onClick={submitHuman}>
                  Submit response
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[14px] text-ink-2">
                Run the assignment. Reversible agent work runs now; an irreversible action halts for approval.
              </p>
              {error && <ErrorNote message={error} />}
              <Button variant="primary" pending={busy} pendingLabel="Executing…" onClick={execute}>
                Execute
              </Button>
            </div>
          )}
        </Stage>
      )}

      {/* 4 — Confirm */}
      {outcome && (
        <Stage node={confirmNode} title="Confirm" last animate>
          {confirmedPass === null ? (
            <div className="space-y-3">
              <p className="text-[14px] text-ink-2">
                Ratify the judge&rsquo;s verdict, or override it. Either updates{" "}
                <span className="font-medium text-ink">{workerName(outcome.workerId)}</span>&rsquo;s reliability.
              </p>
              {error && <ErrorNote message={error} />}
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" pending={busy} pendingLabel="Confirming…" onClick={() => confirm(outcome.judgePass)}>
                  {outcome.judgePass ? "Confirm pass" : "Confirm fail"}
                </Button>
                <Button variant={outcome.judgePass ? "danger" : "secondary"} disabled={busy} onClick={() => confirm(!outcome.judgePass)}>
                  {outcome.judgePass ? "Override → fail" : "Override → pass"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge tone={confirmedPass ? "mint" : "blush"} dot>
                  {confirmedPass ? "Confirmed pass" : "Confirmed fail"}
                </Badge>
                <span className="text-[13px] text-ink-3">Reputation updated.</span>
              </div>
            </div>
          )}
        </Stage>
      )}
    </ol>
  );

  const repPanel = (
    <div className="lg:sticky lg:top-24">
      <div className="mb-4 flex items-baseline justify-between border-b border-divider pb-3">
        <SectionLabel>Reputation</SectionLabel>
        {rep.loading && <span className="text-[12px] text-ink-3">Loading…</span>}
      </div>
      {rep.error ? (
        <ErrorNote message={rep.error} onRetry={rep.reload} />
      ) : rep.data && rep.data.length > 0 ? (
        <ReputationPanel rows={rep.data} workerName={workerName} typeName={typeName} />
      ) : !rep.loading ? (
        <p className="text-[14px] text-ink-3">No outcomes yet.</p>
      ) : null}
    </div>
  );

  return (
    <div className="animate-reveal pt-2">
      <div className="mb-8 flex items-start justify-between gap-4 border-b border-divider pb-4">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">Task</div>
          <div className="truncate text-[19px] font-medium tracking-[-0.01em] text-ink">{task.title}</div>
        </div>
        <Button variant="ghost" onClick={resetTrace} className="shrink-0 px-3">
          New task
        </Button>
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-12">
        <div className="min-w-0">{trace}</div>
        <aside className="min-w-0">{repPanel}</aside>
      </div>
    </div>
  );
}
