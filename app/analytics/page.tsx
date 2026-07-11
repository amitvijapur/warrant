"use client";

import { useMemo } from "react";
import type { TaskType, Worker } from "@/lib/db-types";
import { api, type ReputationRow } from "../lib/client";
import { useScoped } from "../_components/use-scoped";
import { EmptyState, ErrorNote, LoadingNote, NoCompany, PageHeader } from "../_components/page";
import { ReputationPanel } from "../_components/reputation-panel";

type Bundle = { rep: ReputationRow[]; workers: Worker[]; types: TaskType[] };

const loadAnalytics = (companyId: string): Promise<Bundle> =>
  Promise.all([
    api.reputation(companyId),
    api.workers(companyId),
    api.taskTypes(companyId),
  ]).then(([rep, workers, types]) => ({ rep, workers, types }));

export default function AnalyticsPage() {
  const { data, loading, error, reload, companyId } = useScoped(loadAnalytics);

  const workerName = useMemo(() => {
    const map = new Map((data?.workers ?? []).map((w) => [w.id, w.name]));
    return (id: string) => map.get(id) ?? id;
  }, [data]);

  const typeName = useMemo(() => {
    const map = new Map((data?.types ?? []).map((t) => [t.id, t.name]));
    return (id: string) => map.get(id) ?? id;
  }, [data]);

  let content;
  if (!companyId && !loading) content = <NoCompany />;
  else if (error) content = <ErrorNote message={error} onRetry={reload} />;
  else if (loading) content = <LoadingNote />;
  else if ((data?.rep ?? []).length === 0)
    content = <EmptyState>No outcomes yet — run a task from the Overview.</EmptyState>;
  else
    content = (
      <div className="max-w-2xl">
        <ReputationPanel rows={data!.rep} workerName={workerName} typeName={typeName} />
      </div>
    );

  return (
    <>
      <PageHeader
        title="Analytics"
        caption="Reliability is a Beta posterior over confirmed outcomes; it never resets."
      />
      {content}
    </>
  );
}
