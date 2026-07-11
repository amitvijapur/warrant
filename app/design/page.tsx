"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type DesignProposal, type ProposedTaskType, type ProposedWorker } from "../lib/client";
import { useCompany } from "../_components/company-context";
import { PageHeader, ErrorNote } from "../_components/page";
import { SectionLabel } from "../_components/card";
import { Button } from "../_components/button";
import { Badge } from "../_components/badge";
import { Textarea, TextInput, Field } from "../_components/field";
import { AxisBars } from "../_components/data-bar";
import { fmtSec, fmtUSD } from "../_components/format";

const EXAMPLES: { name: string; needs: string }[] = [
  {
    name: "Meridian Immigration Law",
    needs:
      "A boutique immigration law firm. We handle new client intake, review supporting documents for visa applications, draft client update emails, and file petitions with USCIS. Filings and anything sent to the government must be checked by a person.",
  },
  {
    name: "Lumen Skincare",
    needs:
      "A direct-to-consumer skincare brand. We answer customer support tickets, resolve damaged/late order complaints, summarise supplier quality reports, and write product marketing copy. Refunds above $200 need a human.",
  },
  {
    name: "Cartage Freight",
    needs:
      "A freight logistics startup. We book carriers, reconcile carrier invoices against rate agreements, extract data from bills of lading, and handle damage claims. Booking a carrier and paying an invoice commit money.",
  },
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
  const { reload, setCompanyId } = useCompany();
  const [name, setName] = useState("");
  const [needs, setNeeds] = useState("");
  const [proposal, setProposal] = useState<DesignProposal | null>(null);
  const [proposing, setProposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propose = () => {
    if (!needs.trim()) return;
    setProposing(true);
    setError(null);
    setProposal(null);
    api
      .proposeDesign(name.trim(), needs.trim())
      .then(setProposal)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setProposing(false));
  };

  const save = () => {
    if (!proposal) return;
    const companyName = name.trim() || "New company";
    setSaving(true);
    setError(null);
    api
      .applyDesign(companyName, proposal.workers, proposal.taskTypes)
      .then((res) => {
        reload();
        setCompanyId(res.company.id);
        router.push("/workers");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSaving(false));
  };

  const startOver = () => {
    setProposal(null);
    setError(null);
  };

  return (
    <>
      <PageHeader
        title="Design"
        caption="Describe a company and its needs. warrant proposes a workforce of agents and people, and the kinds of work it routes — tailored to that company."
      />

      {!proposal ? (
        <div className="max-w-[720px]">
          <div className="rounded-[18px] border border-border bg-paper p-5">
            <Field label="Company name" htmlFor="design-name">
              <TextInput
                id="design-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Meridian Immigration Law"
              />
            </Field>
            <div className="mt-4">
              <Field label="What does this company do, and what work does it route?" htmlFor="design-needs">
                <Textarea
                  id="design-needs"
                  rows={6}
                  value={needs}
                  onChange={(e) => setNeeds(e.target.value)}
                  placeholder="Describe the business, the kinds of tasks it handles, and which actions must have a human in the loop…"
                  className="min-h-[140px]"
                />
              </Field>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[12px] text-ink-3">A tailored workforce and task types, ready to review.</span>
              <Button variant="primary" pending={proposing} pendingLabel="Designing…" disabled={!needs.trim()} onClick={propose}>
                Propose architecture
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[13px] text-ink-3">Try</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.name}
                type="button"
                onClick={() => {
                  setName(ex.name);
                  setNeeds(ex.needs);
                }}
                className="focusable rounded-full border border-border bg-paper px-3.5 py-2 text-[13px] text-ink-2 transition-colors duration-[120ms] hover:border-ink-3 hover:text-ink"
              >
                {ex.name}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4">
              <ErrorNote message={error} />
            </div>
          )}
        </div>
      ) : (
        <div className="animate-reveal space-y-10">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-divider pb-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">Proposed for</div>
              <div className="text-[19px] font-medium tracking-[-0.01em] text-ink">{name.trim() || "New company"}</div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={startOver} disabled={saving}>
                Start over
              </Button>
              <Button variant="primary" pending={saving} pendingLabel="Creating…" onClick={save}>
                Save company
              </Button>
            </div>
          </div>

          {error && <ErrorNote message={error} />}

          <section>
            <div className="mb-4 flex items-center gap-2">
              <SectionLabel>Proposed workforce</SectionLabel>
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
              <SectionLabel>Proposed task types</SectionLabel>
              <span className="font-mono text-[12px] text-ink-3">{proposal.taskTypes.length}</span>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {proposal.taskTypes.map((t, i) => (
                <ProposedTaskTypeCard key={`${t.name}-${i}`} t={t} />
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
