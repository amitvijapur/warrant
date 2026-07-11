// Seed the demo tenant: Lumen Skincare, a direct-to-consumer skincare brand with
// a mixed workforce (3 OpenAI agent tiers + 2 human specialists) and five task
// types — one irreversible (refunds) so the approval gate is demonstrable, and one
// high-judgment (complaints) so work routes to a person. Re-runnable: it clears any
// prior demo company (Lumen or the retired Northwind) before creating.
//
//   npm run seed
import "./env";

import { getSupabaseClient } from "../lib/supabase";
import { repos, type TaskTypeCreate, type WorkerCreate } from "../lib/repos";

const COMPANY = "Lumen Skincare";
const RETIRED = ["Northwind Trading Co."];

const WORKERS: Omit<WorkerCreate, "companyId">[] = [
  {
    kind: "agent",
    name: "Concierge",
    provider: "openai",
    model: "gpt-4.1-nano",
    humanAxes: { nuance: 0.2, crossDomain: 0.25, unbiasedPushback: 0.05, emotionalStakes: 0.15, trust: 0.15 },
    aiAxes: { multiStepDecisioning: 0.55, contextCapacity: 0.6, salienceWeighing: 0.5 },
    costPerTaskUSD: 0.02,
    typicalLatencySec: 15,
  },
  {
    kind: "agent",
    name: "Analyst",
    provider: "openai",
    model: "gpt-4.1-mini",
    humanAxes: { nuance: 0.35, crossDomain: 0.4, unbiasedPushback: 0.1, emotionalStakes: 0.25, trust: 0.2 },
    aiAxes: { multiStepDecisioning: 0.75, contextCapacity: 0.8, salienceWeighing: 0.75 },
    costPerTaskUSD: 0.09,
    typicalLatencySec: 25,
  },
  {
    kind: "agent",
    name: "Specialist",
    provider: "openai",
    model: "gpt-4.1",
    humanAxes: { nuance: 0.5, crossDomain: 0.55, unbiasedPushback: 0.15, emotionalStakes: 0.35, trust: 0.25 },
    aiAxes: { multiStepDecisioning: 0.9, contextCapacity: 0.9, salienceWeighing: 0.9 },
    costPerTaskUSD: 0.4,
    typicalLatencySec: 45,
  },
  {
    kind: "human",
    name: "Care Lead",
    provider: null,
    model: null,
    humanAxes: { nuance: 0.9, crossDomain: 0.8, unbiasedPushback: 0.85, emotionalStakes: 0.92, trust: 0.95 },
    aiAxes: { multiStepDecisioning: 0.5, contextCapacity: 0.4, salienceWeighing: 0.6 },
    costPerTaskUSD: 6.0,
    typicalLatencySec: 600,
  },
  {
    kind: "human",
    name: "Brand Strategist",
    provider: null,
    model: null,
    humanAxes: { nuance: 0.92, crossDomain: 0.85, unbiasedPushback: 0.7, emotionalStakes: 0.7, trust: 0.8 },
    aiAxes: { multiStepDecisioning: 0.5, contextCapacity: 0.6, salienceWeighing: 0.5 },
    costPerTaskUSD: 8.0,
    typicalLatencySec: 800,
  },
];

const TASK_TYPES: Omit<TaskTypeCreate, "companyId">[] = [
  {
    name: "Support Ticket Reply",
    description: "Answer a customer's product or order question from a support ticket.",
    reversibility: "reversible",
    requiredHumanAxes: { nuance: 0.2, crossDomain: 0.15, unbiasedPushback: 0.0, emotionalStakes: 0.1, trust: 0.1 },
    requiredAiAxes: { multiStepDecisioning: 0.5, contextCapacity: 0.6, salienceWeighing: 0.6 },
    acceptanceCriteria:
      "A correct, on-brand reply that directly resolves the customer's question without inventing product claims.",
  },
  {
    name: "Refund Approval (over $200)",
    description: "Prepare and issue a refund above $200 to a customer. Issuing a refund moves money.",
    reversibility: "irreversible",
    requiredHumanAxes: { nuance: 0.3, crossDomain: 0.3, unbiasedPushback: 0.2, emotionalStakes: 0.2, trust: 0.4 },
    requiredAiAxes: { multiStepDecisioning: 0.6, contextCapacity: 0.6, salienceWeighing: 0.6 },
    acceptanceCriteria:
      "A correctly prepared refund matching the order and the damage/return policy, approved by an authorized human before it is issued.",
  },
  {
    name: "Customer Complaint Response",
    description: "Reply to an upset or escalated customer who needs empathy, judgment, and the right tone.",
    reversibility: "reversible",
    requiredHumanAxes: { nuance: 0.75, crossDomain: 0.5, unbiasedPushback: 0.6, emotionalStakes: 0.85, trust: 0.6 },
    requiredAiAxes: { multiStepDecisioning: 0.4, contextCapacity: 0.4, salienceWeighing: 0.4 },
    acceptanceCriteria:
      "A warm, on-tone reply that acknowledges the customer's history and addresses every concern they raised.",
  },
  {
    name: "Supplier Quality Report Summary",
    description: "Summarize a supplier's batch quality report into its key facts and any flags.",
    reversibility: "reversible",
    requiredHumanAxes: { nuance: 0.3, crossDomain: 0.35, unbiasedPushback: 0.15, emotionalStakes: 0.1, trust: 0.2 },
    requiredAiAxes: { multiStepDecisioning: 0.6, contextCapacity: 0.8, salienceWeighing: 0.7 },
    acceptanceCriteria:
      "A concise summary capturing the key quality metrics and any flagged issues, inventing nothing.",
  },
  {
    name: "Product Marketing Copy",
    description: "Draft on-brand marketing copy for a product launch or campaign.",
    reversibility: "reversible",
    requiredHumanAxes: { nuance: 0.6, crossDomain: 0.5, unbiasedPushback: 0.3, emotionalStakes: 0.4, trust: 0.4 },
    requiredAiAxes: { multiStepDecisioning: 0.5, contextCapacity: 0.6, salienceWeighing: 0.6 },
    acceptanceCriteria:
      "Engaging, on-brand copy that communicates the product's real benefits accurately and in Lumen's voice.",
  },
];

async function main(): Promise<void> {
  const sb = getSupabaseClient();

  // Re-runnable: drop the demo company and the retired one (cascade clears children).
  for (const name of [COMPANY, ...RETIRED]) {
    const { error } = await sb.from("company").delete().eq("name", name);
    if (error) throw new Error(`seed cleanup failed for "${name}": ${error.message}`);
  }

  const company = await repos.company.create({ name: COMPANY });
  console.log(`\ncompany: ${company.name}\n  id: ${company.id}\n`);

  console.log("workers:");
  for (const w of WORKERS) {
    const created = await repos.worker.create({ companyId: company.id, ...w });
    const tag = created.kind === "agent" ? `agent · ${created.model}` : "human";
    console.log(`  - ${created.name.padEnd(18)} [${tag}]  $${created.costPerTaskUSD}/task  ~${created.typicalLatencySec}s`);
  }

  console.log("\ntask types:");
  for (const tt of TASK_TYPES) {
    const created = await repos.taskType.create({ companyId: company.id, ...tt });
    console.log(`  - ${created.name.padEnd(30)} [${created.reversibility}]`);
  }

  console.log(`\nseed complete. COMPANY_ID=${company.id}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nseed failed:", err);
    process.exit(1);
  });
