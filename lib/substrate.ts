// Execution substrate: runs a Task through an agent Worker and returns the
// raw model output. Human workers are handled entirely through the UI — this
// module never executes a human allocation itself.
//
// GENERALIZED from a single hardcoded vendor into a provider abstraction: an
// agent worker's config carries { provider, modelId, costPerTaskUSD }, and
// executeTask resolves the named provider from a registry. OpenAIProvider is
// the only implementation shipped now; additional providers (Qwen, Kimi,
// Featherless — all OpenAI-compatible, so they can reuse OpenAIProvider with
// a different baseURL, or implement LLMProvider directly for bespoke REST)
// register via registerProvider without touching this file.
//
// Langfuse is sidecar telemetry ONLY. It must never be a data source and it
// must never fail an execution: every Langfuse call is wrapped in try/catch
// that logs one console.warn and continues.

import OpenAI from "openai";
import { Langfuse } from "langfuse";

import type { Task, Worker } from "./types";

/** USD per million tokens, for usage-based cost display. */
export type TokenPrice = { input: number; output: number };

export type GenerateOptions = {
  system?: string;
  maxTokens?: number;
  /** Flat per-task cost used when the provider has no usage-based price for the model. */
  costPerTaskUSD?: number;
};

export type GenerateResult = {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  costUSD: number;
  latencyMs: number;
};

/**
 * The single extension point for adding model vendors. Implement this and
 * register it with registerProvider(name, instance). generate() must never
 * pass a temperature a model might reject — determinism lives in the scorer,
 * not in sampling.
 */
export interface LLMProvider {
  generate(model: string, prompt: string, opts?: GenerateOptions): Promise<GenerateResult>;
}

export type OpenAIProviderOptions = {
  /** Explicit API key; falls back to the env var named by apiKeyEnvVar. */
  apiKey?: string;
  /** Env var to read the key from. Defaults to OPENAI_API_KEY. */
  apiKeyEnvVar?: string;
  /** Base URL override for OpenAI-compatible endpoints (Qwen, Kimi, Featherless, ...). */
  baseURL?: string;
  /** Optional usage-based price table keyed by model id. */
  pricePerMTok?: Record<string, TokenPrice>;
};

/**
 * OpenAIProvider — talks to any OpenAI-compatible /chat/completions endpoint.
 * The client is created lazily so importing this module never requires a key;
 * the key is only read the first time generate() is called.
 */
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI | null = null;

  constructor(private readonly options: OpenAIProviderOptions = {}) {}

  private getClient(): OpenAI {
    if (this.client) return this.client;
    const envVar = this.options.apiKeyEnvVar ?? "OPENAI_API_KEY";
    const apiKey = this.options.apiKey ?? process.env[envVar];
    if (!apiKey) {
      throw new Error(
        `${envVar} environment variable is not set; OpenAIProvider requires an API key.`,
      );
    }
    this.client = new OpenAI({ apiKey, baseURL: this.options.baseURL });
    return this.client;
  }

  private costFor(model: string, inputTokens: number, outputTokens: number): number | undefined {
    const price = this.options.pricePerMTok?.[model];
    if (!price) return undefined;
    return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
  }

  async generate(model: string, prompt: string, opts: GenerateOptions = {}): Promise<GenerateResult> {
    const client = this.getClient();

    // No temperature anywhere: some models reject a non-default value, and
    // our determinism guarantee lives in the scorer, not sampling.
    const start = Date.now();
    const completion = await client.chat.completions.create({
      model,
      max_tokens: opts.maxTokens,
      messages: opts.system
        ? [
            { role: "system", content: opts.system },
            { role: "user", content: prompt },
          ]
        : [{ role: "user", content: prompt }],
    });
    const latencyMs = Date.now() - start;

    const text = completion.choices[0]?.message?.content ?? "";
    const inputTokens = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;
    const usage = { inputTokens, outputTokens };
    const costUSD = this.costFor(model, inputTokens, outputTokens) ?? opts.costPerTaskUSD ?? 0;

    return { text, usage, costUSD, latencyMs };
  }
}

// ---------------------------------------------------------------------------
// Provider registry — the extension point. Register additional providers at
// app startup: registerProvider("qwen", new OpenAIProvider({ baseURL, ... })).
// ---------------------------------------------------------------------------

const providerRegistry: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
};

export function registerProvider(name: string, provider: LLMProvider): void {
  providerRegistry[name] = provider;
}

export function getProvider(name: string): LLMProvider {
  const provider = providerRegistry[name];
  if (!provider) {
    throw new Error(
      `no LLM provider registered under "${name}"; register one with registerProvider(name, provider).`,
    );
  }
  return provider;
}

export type ExecutionResult = {
  output: string;
  latencyMs: number;
  usage?: { inputTokens: number; outputTokens: number };
  costUSD?: number;
};

export type PromptSpec = {
  system?: string;
  user: string;
  maxTokens: number;
};

/** Shared system framing + token budget for the config-driven generic path. */
export const GENERIC_AGENT_SYSTEM =
  "You are a capable worker executing a business task. Follow the task type's " +
  "description and acceptance criteria precisely, and return only the requested " +
  "output with no preamble.";
export const GENERIC_AGENT_MAX_TOKENS = 800;

/**
 * The requirement profile a config-driven (tenant DB) task type carries. Only
 * the fields the generic prompt needs — kept structurally compatible with
 * lib/db-types.ts TaskType so a full TaskType row is assignable here.
 */
export type TaskTypeProfile = {
  name: string;
  description: string;
  acceptanceCriteria: string;
};

/**
 * Generic agent instruction for an arbitrary company task type: composes the
 * task type's name/description/acceptance criteria with the task input into a
 * single self-contained user prompt under a shared system framing.
 *
 * The produced `user` string is intentionally self-contained: callers store it
 * as the engine Task's `input`, so executeTask's default (unknown-type) prompt
 * path — reached through the frozen gate, which forwards only (task, worker) —
 * reconstructs the IDENTICAL prompt from `task.input` alone. Reversible and
 * irreversible executions of the same task type therefore prompt identically.
 */
export function buildAgentPrompt(profile: TaskTypeProfile, input: string): PromptSpec {
  const user =
    `Task type: ${profile.name}\n` +
    `Description: ${profile.description}\n\n` +
    `Acceptance criteria:\n${profile.acceptanceCriteria}\n\n` +
    `Task input:\n${input}\n\n` +
    "Produce the output that best satisfies the task type and its acceptance criteria.";
  return { system: GENERIC_AGENT_SYSTEM, user, maxTokens: GENERIC_AGENT_MAX_TOKENS };
}

function buildPrompt(task: Task): PromptSpec {
  switch (task.type) {
    case "email_triage":
      return {
        system: "You are an operations assistant for a B2B services company.",
        user:
          `${task.input}\n\n` +
          "Reply with your response's first line as exactly " +
          "`CATEGORY: <billing|technical|complaint|general>`, followed by a professional reply draft.",
        maxTokens: 600,
      };
    case "invoice_extraction":
      return {
        user:
          `${task.input}\n\n` +
          'Return ONLY one JSON object {"vendor", "invoiceNumber", "date" (YYYY-MM-DD), ' +
          '"totalAmount" (number), "currency"} with no commentary.',
        maxTokens: 300,
      };
    case "report_summary":
      return {
        user: `${task.input}\n\nWrite a concise summary (~120 words) covering the report's key facts.`,
        maxTokens: 400,
      };
    default:
      // Config-driven task type (id is a tenant task_type_id, not a legacy
      // literal): the caller has already composed the full instruction into
      // task.input via buildAgentPrompt, so pass it through under the shared
      // generic framing. This is the path the gate reaches for arbitrary types.
      return { system: GENERIC_AGENT_SYSTEM, user: task.input, maxTokens: GENERIC_AGENT_MAX_TOKENS };
  }
}

function isLangfuseEnabled(): boolean {
  return (
    process.env.LANGFUSE_ENABLED === "true" &&
    !!process.env.LANGFUSE_PUBLIC_KEY &&
    !!process.env.LANGFUSE_SECRET_KEY
  );
}

let langfuseClient: Langfuse | null = null;

function getLangfuseClient(): Langfuse | null {
  if (!isLangfuseEnabled()) return null;
  if (langfuseClient) return langfuseClient;
  langfuseClient = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com",
  });
  return langfuseClient;
}

/** Sidecar telemetry only — never throws, never affects the returned ExecutionResult. */
function recordTelemetry(
  task: Task,
  worker: Worker,
  prompt: PromptSpec,
  output: string,
  usage: { inputTokens: number; outputTokens: number } | undefined,
): void {
  try {
    const client = getLangfuseClient();
    if (!client) return;

    const trace = client.trace({
      name: `exec:${task.id}`,
      input: prompt.user,
      output,
    });
    trace.generation({
      model: worker.modelId,
      input: prompt.user,
      output,
      usage: usage ? { input: usage.inputTokens, output: usage.outputTokens } : undefined,
      metadata: {
        workerId: worker.id,
        taskType: task.type,
        provider: worker.provider ?? "openai",
      },
    });
  } catch (err) {
    console.warn("langfuse telemetry failed, continuing:", err);
  }
}

export async function executeTask(
  task: Task,
  worker: Worker,
  prompt?: PromptSpec,
): Promise<ExecutionResult> {
  if (worker.kind === "human") {
    throw new Error("human execution happens through the UI, not the substrate");
  }
  if (!worker.modelId) {
    throw new Error(`agent worker ${worker.id} has no modelId configured`);
  }

  const provider = getProvider(worker.provider ?? "openai");
  // A caller can hand in a prebuilt prompt (config-driven generic path); the
  // legacy per-literal builder remains the default for the known task types.
  const resolvedPrompt = prompt ?? buildPrompt(task);

  const result = await provider.generate(worker.modelId, resolvedPrompt.user, {
    system: resolvedPrompt.system,
    maxTokens: resolvedPrompt.maxTokens,
    costPerTaskUSD: worker.costPerTaskUSD,
  });

  recordTelemetry(task, worker, resolvedPrompt, result.text, result.usage);

  // Netlify Functions (and serverless generally) freeze or tear down the
  // process as soon as this function resolves — before the Langfuse SDK's
  // background batch timer (default flushInterval ~10s / flushAt ~15 events)
  // would otherwise fire. Without an explicit await here, the trace/generation
  // events queued by recordTelemetry above are silently dropped and nothing
  // reaches Langfuse. Awaiting the flush per-execution guarantees delivery.
  // flushTelemetry() already wraps its own body in try/catch and only warns,
  // but it's awaited inside a try/catch again here as defense-in-depth: a
  // sidecar telemetry flush must never be able to throw into or delay-fail
  // the ExecutionResult this function returns.
  try {
    await flushTelemetry();
  } catch {
    // Unreachable today (flushTelemetry swallows internally), kept as a
    // guarantee against that contract changing later.
  }

  return {
    output: result.text,
    latencyMs: result.latencyMs,
    usage: result.usage,
    costUSD: result.costUSD,
  };
}

/** Flushes any queued Langfuse events. No-op when Langfuse is disabled or was never used. */
export async function flushTelemetry(): Promise<void> {
  if (!langfuseClient) return;
  try {
    await langfuseClient.flushAsync();
  } catch (err) {
    console.warn("langfuse flush failed, continuing:", err);
  }
}
