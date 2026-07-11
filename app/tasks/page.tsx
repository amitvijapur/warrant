"use client";

import { useMemo } from "react";
import type { Task, TaskType } from "@/lib/db-types";
import { api } from "../lib/client";
import { useScoped } from "../_components/use-scoped";
import { EmptyState, ErrorNote, LoadingNote, NoCompany, PageHeader } from "../_components/page";
import { DataTable, Row, Td, Th } from "../_components/table";
import { Badge } from "../_components/badge";
import { absoluteTime, relativeTime, taskStatusMeta } from "../_components/format";

type Bundle = { tasks: Task[]; types: TaskType[] };

const loadTasks = (companyId: string): Promise<Bundle> =>
  Promise.all([api.tasks(companyId), api.taskTypes(companyId)]).then(([tasks, types]) => ({
    tasks,
    types,
  }));

export default function TasksPage() {
  const { data, loading, error, reload, companyId } = useScoped(loadTasks);

  const typeName = useMemo(() => {
    const map = new Map((data?.types ?? []).map((t) => [t.id, t.name]));
    return (id: string) => map.get(id) ?? "—";
  }, [data]);

  const rows = useMemo(
    () =>
      [...(data?.tasks ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    [data],
  );

  let content;
  if (!companyId && !loading) content = <NoCompany />;
  else if (error) content = <ErrorNote message={error} onRetry={reload} />;
  else if (loading) content = <LoadingNote />;
  else if (rows.length === 0)
    content = <EmptyState>No tasks yet — submit one from the Overview.</EmptyState>;
  else
    content = (
      <DataTable
        minWidth={720}
        head={
          <>
            <Th>Title</Th>
            <Th>Type</Th>
            <Th>Status</Th>
            <Th align="right">Created</Th>
          </>
        }
      >
        {rows.map((t) => {
          const status = taskStatusMeta(t.status);
          return (
            <Row key={t.id}>
              <Td className="font-medium text-ink">{t.title}</Td>
              <Td className="text-ink-2">{typeName(t.taskTypeId)}</Td>
              <Td>
                <Badge tone={status.tone} dot>
                  {status.label}
                </Badge>
              </Td>
              <Td align="right" className="text-ink-3">
                <span title={absoluteTime(t.createdAt)}>{relativeTime(t.createdAt)}</span>
              </Td>
            </Row>
          );
        })}
      </DataTable>
    );

  return (
    <>
      <PageHeader
        title="Tasks"
        caption="Every task submitted to this company, newest first — a read-only ledger of the work."
      />
      {content}
    </>
  );
}
