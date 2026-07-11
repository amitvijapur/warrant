# Warrant

A config-driven task routing engine backend, built on Next.js (App Router) +
TypeScript. Warrant decides **who should do a task** — a specific agent, a human,
or an agent proposing work for a human to approve — from a tenant's own workers
and per-task-type requirement profiles, and it gates irreversible work behind a
signed human approval.

The routing engine was ported from an earlier static prototype and generalized
so nothing is hardcoded: workers, task types, and their axis requirements are
data (see `lib/db-types.ts`), and the LLM backing an agent worker is pluggable
(see `lib/substrate.ts`).

## Engine (`lib/`)

- **`posterior.ts`** — Beta-Bernoulli reliability math (`update`, `mean`, `ci90`,
  `pdfPoints`), hand-rolled with no special functions; validated against
  `golden-fixtures.json` (scipy `beta.ppf`).
- **`config.ts`** — frozen `ROUTER_WEIGHTS` and the capability-trigger threshold.
- **`types.ts`** — engine domain types, including the generalized `RoutableTask`
  / `RoutableWorker` shapes the router accepts.
- **`router.ts`** — `route(task, workers, reputationFor)` scores a dynamic worker
  list (axis match, log-scale cost, latency, posterior-mean reliability) and runs
  the capability → judgment → risk → score trigger cascade to produce an
  `Allocation` with a plain-language rationale.
- **`gate.ts`** — the Authority Gate: HMAC-signed `ApprovalToken` mint/verify
  (timing-safe, never throws on bad input) and reversibility-keyed
  `executeIrreversible` / `executeReversible`.
- **`scorer.ts`** — optional deterministic "structured scoring" strategy for the
  known task types with a ground-truth contract.
- **`substrate.ts`** — the execution substrate behind an `LLMProvider` interface.
  `OpenAIProvider` is shipped; additional OpenAI-compatible or REST providers
  register via `registerProvider` without changing calling code. Langfuse tracing
  is a sidecar wrapped in try/catch, so telemetry can never fail an execution.
- **`supabase.ts`** — lazy, server-only service-role Supabase client.
- **`db-types.ts`** — hand-written row types for the tenant tables (`Company`,
  `Worker`, `TaskType`, `Task`, `Assignment`, `Outcome`).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in what you need; tests and build don't require live keys
```

## Running tests

The engine has a Vitest suite (`lib/__tests__/`):

```bash
npm test          # vitest run
```

## Other scripts

```bash
npm run dev       # next dev
npm run build     # next build
npm run start     # next start
npm run lint      # eslint
```
