// End-to-end demo of the warrant loop against the seeded Lumen Skincare company.
// Runs three scenarios and prints a readable trace, then the reputation table.
// Prereq: `npm run seed` first, and .env.local with OpenAI + Supabase keys.
//
//   npm run demo
import "./env";

import { mean as posteriorMean } from "../lib/posterior";
import {
  approveAndExecute,
  confirmOutcome,
  executeAssignment,
  routeTask,
  submitHumanOutput,
  submitTask,
} from "../lib/pipeline";
import { repos } from "../lib/repos";
import { buildReputation } from "../lib/reputation";
import { flushTelemetry } from "../lib/substrate";
import { getSupabaseClient } from "../lib/supabase";

const COMPANY = "Lumen Skincare";

function hr(title: string): void {
  console.log("\n" + "=".repeat(74) + "\n  " + title + "\n" + "=".repeat(74));
}
function snip(s: string | null, n = 240): string {
  const one = (s ?? "").replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n) + "…" : one;
}

async function main(): Promise<void> {
  const sb = getSupabaseClient();
  const { data: companyRow, error } = await sb.from("company").select("*").eq("name", COMPANY).maybeSingle();
  if (error) throw new Error(error.message);
  if (!companyRow) throw new Error(`company "${COMPANY}" not found — run \`npm run seed\` first`);
  const companyId = companyRow.id as string;

  const workers = await repos.worker.list(companyId);
  const taskTypes = await repos.taskType.list(companyId);
  const workerName = (id: string): string => workers.find((w) => w.id === id)?.name ?? id;
  const typeName = (id: string): string => taskTypes.find((t) => t.id === id)?.name ?? id;

  async function submitAndRoute(title: string, input: string) {
    const { task, classification } = await submitTask(companyId, title, input);
    console.log(`\n> submitted: "${title}"`);
    console.log(
      `  classified -> ${typeName(classification.taskTypeId)}  ` +
        `(confidence ${classification.confidence.toFixed(2)}, ${classification.reversibility})`,
    );
    const { assignment, allocation } = await routeTask(task.id);
    console.log(`  routed     -> ${workerName(allocation.workerId)}   mode=${allocation.mode}  trigger=${allocation.trigger}`);
    console.log(`  scores     : ${allocation.scores.map((s) => `${workerName(s.workerId)} ${s.score.toFixed(2)}`).join("  |  ")}`);
    console.log(`  rationale  : ${allocation.rationale}`);
    return { assignment };
  }

  // 1 — reversible task -> agent runs autonomously
  hr("SCENARIO 1 - reversible support ticket, routed to an agent, runs autonomously");
  {
    const input =
      "Hi — I ordered the Vitamin C serum last week (order LM-4821) and I'm not sure how often " +
      "I should use it. Morning and night, or just once a day? Thanks!";
    const { assignment } = await submitAndRoute("Vitamin C serum usage question", input);
    const res = await executeAssignment(assignment.id);
    if (res.status === "completed") {
      console.log(`  executed   -> ${snip(res.assignment.output)}`);
      console.log(`  cost $${res.assignment.costUSD?.toFixed(4) ?? "?"}  latency ${res.assignment.latencyMs ?? "?"}ms`);
      console.log(`  judge      -> ${res.outcome.judgePass ? "PASS" : "FAIL"} - ${res.outcome.judgeDetail}`);
      await confirmOutcome(res.outcome.id, res.outcome.judgePass, "Amit");
      console.log("  confirmed  -> reputation updated");
    } else {
      console.log(`  unexpected status: ${res.status}`);
    }
  }

  // 2 — irreversible task -> gate holds the agent until a human approves
  hr("SCENARIO 2 - irreversible refund: the gate holds the agent until a human approves");
  {
    const input =
      "Please issue a $240 refund on order LM-3990 - the customer received a damaged Retinol " +
      "Renewal set and we've approved a full refund under our damage policy.";
    const { assignment } = await submitAndRoute("Refund $240 - order LM-3990", input);
    const res = await executeAssignment(assignment.id);
    if (res.status === "gate_required") {
      console.log("  GATE: execution refused - irreversible agent action requires a signed human approval.");
      const approved = await approveAndExecute(assignment.id, "Amit");
      console.log("  approved by Amit -> executed via signed ApprovalToken");
      console.log(`  executed   -> ${snip(approved.assignment.output)}`);
      console.log(`  judge      -> ${approved.outcome.judgePass ? "PASS" : "FAIL"} - ${approved.outcome.judgeDetail}`);
      await confirmOutcome(approved.outcome.id, approved.outcome.judgePass, "Amit");
      console.log("  confirmed  -> reputation updated");
    } else {
      console.log(`  unexpected status: ${res.status} (expected gate_required)`);
    }
  }

  // 3 — high-judgment task -> routed to a human specialist
  hr("SCENARIO 3 - high-judgment complaint, routed to a human specialist");
  {
    const input =
      "Customer email: 'This is the third time my Lumen order has arrived leaking and ruined. " +
      "I've been a loyal customer for two years and I'm honestly done. What are you going to do about this?'";
    const { assignment } = await submitAndRoute("Upset customer - repeated leaks", input);
    const res = await executeAssignment(assignment.id);
    if (res.status === "human_work_item") {
      console.log("  routed to human - no agent scored competitively; a specialist handles it.");
      const reply =
        "Hi, I'm so sorry - three leaking orders is completely unacceptable after two years with us. " +
        "I've flagged your account for priority packing, arranged a no-cost replacement shipping today " +
        "with signature on delivery, and added a credit for the trouble. I'll follow up personally once it ships. - Care Lead";
      const done = await submitHumanOutput(assignment.id, reply);
      console.log(`  operator   -> ${snip(reply)}`);
      console.log(`  judge      -> ${done.outcome.judgePass ? "PASS" : "FAIL"} - ${done.outcome.judgeDetail}`);
      await confirmOutcome(done.outcome.id, done.outcome.judgePass, "Amit");
      console.log("  confirmed  -> reputation updated");
    } else {
      console.log(`  unexpected status: ${res.status} (expected human_work_item)`);
    }
  }

  hr("REPUTATION - Beta posterior mean per worker x task type");
  const rep = await buildReputation(companyId);
  if (rep.size === 0) console.log("  (none yet)");
  for (const [key, post] of rep) {
    const [wid, ttid] = key.split(":");
    console.log(
      `  ${workerName(wid).padEnd(18)} | ${typeName(ttid).padEnd(30)}  ` +
        `mean ${posteriorMean(post).toFixed(2)}  (alpha=${post.alpha}, beta=${post.beta})`,
    );
  }

  await flushTelemetry();
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\ndemo failed:", err);
    process.exit(1);
  });
