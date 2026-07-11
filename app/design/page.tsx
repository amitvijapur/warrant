"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type DesignProposal, type ProposedTaskType, type ProposedWorker } from "../lib/client";
import { useCompany } from "../_components/company-context";
import { useScoped } from "../_components/use-scoped";
import { PageHeader, ErrorNote, NoCompany } from "../_components/page";
import { SectionLabel } from "../_components/card";
import { Button } from "../_components/button";
import { Badge } from "../_components/badge";
import { Textarea, Field } from "../_components/field";
import { AxisBars } from "../_components/data-bar";
import { fmtSec, fmtUSD } from "../_components/format";

const EXAMPLES: string[] = [
  "Customer complaints are spiking and need first-pass triage before a reply goes out.",
  "We're expanding into contract review and need key terms extracted before signoff.",
  "Vendor invoices need reconciling against POs, with mismatches flagged for a person.",
];

function ProposedWorkerCard({ w }: { w: ProposedWorker }) {
  const agent = w.kind === "agent";
  return (
    <div className="rounded-lg border border-border bg-paper p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[16px] font-medium text-ink">{w.name}</span>
            <Badge tone={agent ? "neutral" : "mint"}>{agent ? "Agent" : "Human"}</Badge>
          </div>
          <div className="truncate font-mono text-[12px] text-ink-3">
            {agent ? `${w.provider || "openai"} · ${w.model || "—"}` : "Human operator"}
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-[12px] text-ink-2">
          <div>{fmtUSD(w.costPerTaskUSD)}</div>
          <div className="text-ink-3">{fmtSec(w.typicalLatencySec)}</div>
        </div>
      </div>
      {w.rationale && <p className="mt-3 text-[13px] leading-[1.5] text-ink-2">{w.rationale}</p>}
      <div className="mt-4 border-t border-divider pt-4">
        <AxisBars humanAxes={w.humanAxes} aiAxes={w.aiAxes} dense />
      </div>
    </div>
  );
}

function ProposedTaskTypeCard({ t }: { t: ProposedTaskType }) {
  return (
    <div className="rounded-lg border border-border bg-paper p-5">
      <div className="flex items-center gap-2">
        <span className="text-[16px] font-medium text-ink">{t.name}</span>
        <Badge tone={t.reversibility === "irreversible" ? "butter" : "neutral"}>
          {t.reversibility}
        </Badge>
      </div>
      <p className="mt-2 text-[14px] leading-[1.5] text-ink-2">{t.description}</p>
      <p className="mt-2 text-[13px] leading-[1.5] text-ink-3">
        <span className="font-medium text-ink-2">Accepted when:</span> {t.acceptanceCriteria}
      </p>
      <div className="mt-4 border-t border-divider pt-4">
        <AxisBars humanAxes={t.requiredHumanAxes} aiAxes={t.requiredAiAxes} dense />
      </div>
    </div>
  );
}

export default function DesignPage() {
  const router = useRouter();
  const { companyId, company, reload } = useCompany();
  const { data: workers, loading: workersLoading } = useScoped(api.workers);
  const { data: taskTypes, loading: taskTypesLoading } = useScoped(api.taskTypes);

  const [needs, setNeeds] = useState("");
  const [proposal, setProposal] = useState<DesignProposal | null>(null);
  const [proposing, setProposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propose = () => {
    if (!needs.trim() || !companyId) return;
    setProposing(true);
    setError(null);
    setProposal(null);
    api
      .proposeDesign(companyId, needs.trim())
      .then(setProposal)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setProposing(false));
  };

  const save = () => {
    if (!proposal || !companyId) return;
    setSaving(true);
    setError(null);
    api
      .applyDesign(companyId, proposal.workers, proposal.taskTypes)
      .then(() => {
        reload();
        router.push("/workers");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSaving(false));
  };

  const startOver = () => {
    setProposal(null);
    setError(null);
  };

  const companyName = company?.name ?? "this company";
  const networkLoading = workersLoading || taskTypesLoading;
  const workerCount = workers?.length ?? 0;
  const taskTypeCount = taskTypes?.length ?? 0;

  let content;
  if (!companyId && !workersLoading) {
    content = <NoCompany />;
  } else if (!proposal) {
    content = (
      <div className="max-w-[720px]">
        <p className="mb-4 text-[13px] text-ink-2">
          <span className="font-medium text-ink">{companyName}</span>{" "}
          {networkLoading
            ? "— loading its current network…"
            : `has ${workerCount} worker${workerCount === 1 ? "" : "s"} and ${taskTypeCount} task type${taskTypeCount === 1 ? "" : "s"} today.`}
        </p>

        <div className="rounded-[18px] border border-border bg-paper p-5">
          <Field label="What does this company need now?" htmlFor="design-needs">
            <Textarea
              id="design-needs"
              rows={6}
              value={needs}
              onChange={(e) => setNeeds(e.target.value)}
              placeholder="Describe the new work this company needs to route, and which actions must have a human in the loop…"
              className="min-h-[140px]"
            />
          </Field>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[12px] text-ink-3">Proposed additions, ready to review.</span>
            <Button variant="primary" pending={proposing} pendingLabel="Designing…" disabled={!needs.trim()} onClick={propose}>
              Propose additions
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[13px] text-ink-3">Try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setNeeds(ex)}
              className="focusable rounded-full border border-border bg-paper px-3.5 py-2 text-[13px] text-ink-2 transition-colors duration-[120ms] hover:border-ink-3 hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4">
            <ErrorNote message={error} />
          </div>
        )}
      </div>
    );
  } else {
    content = (
      <div className="animate-reveal space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-divider pb-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">Proposed for</div>
            <div className="text-[19px] font-medium tracking-[-0.01em] text-ink">{companyName}</div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={startOver} disabled={saving}>
              Start over
            </Button>
            <Button variant="primary" pending={saving} pendingLabel="Adding…" onClick={save}>
              Add to {companyName}
            </Button>
          </div>
        </div>

        {error && <ErrorNote message={error} />}

        <section>
          <div className="mb-4 flex items-center gap-2">
            <SectionLabel>Proposed additions — workforce</SectionLabel>
            <span className="font-mono text-[12px] text-ink-3">{proposal.workers.length}</span>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {proposal.workers.map((w, i) => (
              <ProposedWorkerCard key={`${w.name}-${i}`} w={w} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <SectionLabel>Proposed additions — task types</SectionLabel>
            <span className="font-mono text-[12px] text-ink-3">{proposal.taskTypes.length}</span>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {proposal.taskTypes.map((t, i) => (
              <ProposedTaskTypeCard key={`${t.name}-${i}`} t={t} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Design"
        caption={`Extend ${companyName}'s network. Describe what it needs and warrant proposes agents, people, and task types to add — tailored to this company.`}
      />
      {content}
    </>
  );
}
