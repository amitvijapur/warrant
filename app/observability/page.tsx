"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "../_components/badge";
import { Card, SectionLabel } from "../_components/card";
import { ErrorNote, LoadingNote, PageHeader } from "../_components/page";

// This page is system-level (not scoped to a company), so it fetches
// /api/observability directly rather than through app/lib/client.ts.

type ObservabilityStatus = {
  langfuse: { enabled: boolean; host: string };
  openai: { classifier: string; judge: string; design: string };
  supabase: { configured: boolean };
  netlify: { hosting: true };
};

async function fetchStatus(): Promise<ObservabilityStatus> {
  let res: Response;
  try {
    res = await fetch("/api/observability");
  } catch {
    throw new Error("Network error — the console could not reach the server.");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // fall through to the status-based message below
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as ObservabilityStatus;
}

const TRACE_STEPS = ["Agent execution", "Langfuse trace()", "generation()", "Langfuse → ClickHouse"];

function StepArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="shrink-0 text-ink-3">
      <path
        d="M4 2.5 9 7l-5 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const RECORDED_FIELDS: { label: string; value: string }[] = [
  { label: "Trace name", value: "exec:<taskId> — one trace per task execution" },
  { label: "Input", value: "The resolved prompt sent to the worker's model" },
  { label: "Output", value: "The model's raw output text" },
  { label: "Model", value: "The worker's model id — the model actually invoked" },
  { label: "Token usage", value: "Input / output token counts, when the provider returns them" },
  { label: "Metadata", value: "{ workerId, taskType, provider }" },
];

function partners(data: ObservabilityStatus) {
  return [
    {
      name: "Langfuse",
      role: "LLM observability",
      detail:
        "Traces every agent execution — one trace() plus a generation() call per task — as a sidecar that never sources data and never fails an execution.",
    },
    {
      name: "ClickHouse",
      role: "Columnar analytics store",
      detail: "Powers Langfuse's latency, token, and cost analytics at scale behind the scenes.",
    },
    {
      name: "OpenAI",
      role: "Model substrate",
      detail: `Classify (${data.openai.classifier}), judge (${data.openai.judge}), design (${data.openai.design}), and agent execution via a pluggable LLMProvider.`,
    },
    {
      name: "Supabase",
      role: "Postgres system of record",
      detail:
        "Companies, workers, task types, assignments, and outcomes/reputation — accessed server-side only, via the service role key.",
    },
    {
      name: "Netlify",
      role: "Hosting & deploy",
      detail: "Hosting and continuous deployment for the console, via the OpenNext adapter.",
    },
  ];
}

export default function ObservabilityPage() {
  const [data, setData] = useState<ObservabilityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchStatus()
      .then((d) => setData(d))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  let content;
  if (error) content = <ErrorNote message={error} onRetry={load} />;
  else if (loading || !data) content = <LoadingNote />;
  else
    content = (
      <>
        <Card className="mb-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {TRACE_STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink-2">
                    {step}
                  </span>
                  {i < TRACE_STEPS.length - 1 && <StepArrow />}
                </div>
              ))}
            </div>
            <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
              <Badge tone={data.langfuse.enabled ? "mint" : "neutral"} dot>
                {data.langfuse.enabled ? "Live" : "Sidecar off"}
              </Badge>
              <span className="font-mono text-[12px] text-ink-3">{data.langfuse.host}</span>
            </div>
          </div>
          <p className="mt-5 border-t border-divider pt-4 text-[13px] leading-[1.5] text-ink-2">
            Telemetry is sidecar-only — Langfuse never sources data and never fails an execution; every
            call is wrapped and continues on error.
          </p>
          {!data.langfuse.enabled && (
            <p className="mt-3 text-[13px] leading-[1.5] text-ink-3">
              Tracing is currently off. It turns on via env flags — LANGFUSE_ENABLED plus a public and
              secret key — no key values are shown here.
            </p>
          )}
        </Card>

        <Card title="Recorded per execution" className="mb-6">
          <dl className="divide-y divide-divider">
            {RECORDED_FIELDS.map((f) => (
              <div
                key={f.label}
                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-4"
              >
                <dt className="w-40 shrink-0 text-[12px] uppercase tracking-[0.05em] text-ink-3">
                  {f.label}
                </dt>
                <dd className="text-[14px] text-ink-2">{f.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div>
          <div className="mb-4">
            <SectionLabel>Partner tools</SectionLabel>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {partners(data).map((p) => (
              <div key={p.name} className="rounded-lg border border-border bg-paper p-5">
                <h3 className="text-[16px] font-medium text-ink">{p.name}</h3>
                <p className="mt-0.5 text-[12px] uppercase tracking-[0.05em] text-ink-3">{p.role}</p>
                <p className="mt-3 text-[13px] leading-[1.5] text-ink-2">{p.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </>
    );

  return (
    <>
      <PageHeader
        title="Observability"
        caption="How warrant instruments the routing loop — tracing every agent execution and the partner tools behind it."
      />
      {content}
    </>
  );
}
