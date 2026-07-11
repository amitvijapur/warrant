"use client";

import { useMemo } from "react";
import { api } from "../lib/client";
import { useScoped } from "../_components/use-scoped";
import { EmptyState, ErrorNote, LoadingNote, NoCompany, PageHeader } from "../_components/page";
import { Badge } from "../_components/badge";
import { AxisBars } from "../_components/data-bar";
import { SectionLabel } from "../_components/card";

export default function PoliciesPage() {
  const { data, loading, error, reload, companyId } = useScoped(api.taskTypes);

  const types = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );

  let content;
  if (!companyId && !loading) content = <NoCompany />;
  else if (error) content = <ErrorNote message={error} onRetry={reload} />;
  else if (loading) content = <LoadingNote />;
  else if (types.length === 0)
    content = <EmptyState>No task types defined for this company.</EmptyState>;
  else
    content = (
      <div className="divide-y divide-divider">
        {types.map((t) => (
          <section key={t.id} className="grid gap-8 py-10 first:pt-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-[24px] font-semibold tracking-[-0.01em] text-ink">{t.name}</h2>
                <Badge tone={t.reversibility === "irreversible" ? "butter" : "neutral"} dot>
                  {t.reversibility === "irreversible" ? "Irreversible" : "Reversible"}
                </Badge>
              </div>
              <p className="max-w-prose text-[15px] leading-[1.6] text-ink-2">{t.description}</p>
              <div className="space-y-1.5">
                <SectionLabel>Acceptance criteria</SectionLabel>
                <p className="max-w-prose text-[15px] leading-[1.6] text-ink-2">
                  {t.acceptanceCriteria}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <SectionLabel>Required of a worker</SectionLabel>
              <AxisBars humanAxes={t.requiredHumanAxes} aiAxes={t.requiredAiAxes} />
            </div>
          </section>
        ))}
      </div>
    );

  return (
    <>
      <PageHeader
        title="Policies"
        caption="Each kind of work, its reversibility, how it is judged, and what the router expects of a worker."
      />
      {content}
    </>
  );
}
