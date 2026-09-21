import * as core from "@actions/core";
import * as github from "@actions/github";
import { checkAllowedActors } from "./auth-check";

export async function run(): Promise<void> {
  try {
    const previousOutcome = (core.getInput("previous-outcome") || "success").trim().toLowerCase();
    const expectedOutcome = (core.getInput("expected-outcome") || "success").trim().toLowerCase();
    const allowedActors = core.getInput("allowed-actors");
    const actor = github.context.actor;

    core.info("========================================");
    core.info("🚦 Action Approval Gate Evaluation");
    core.info(`- Previous Outcome : ${previousOutcome}`);
    core.info(`- Expected Outcome : ${expectedOutcome}`);
    core.info(`- Triggering Actor : ${actor}`);
    core.info("========================================\n");

    // 1. Validate Previous Outcome
    if (previousOutcome !== expectedOutcome) {
      core.setOutput("is-valid", "false");
      core.setFailed(
        `⛔ Gate Blocked: Previous action/step outcome was '${previousOutcome}', but expected '${expectedOutcome}'. Halting execution.`
      );
      return;
    }

    // 2. Validate Triggering Actor Authorization
    const auth = checkAllowedActors(allowedActors, actor);
    if (!auth.allowed) {
      core.setOutput("is-valid", "false");
      core.setFailed(`⛔ Security Violation: ${auth.reason}`);
      return;
    }

    core.setOutput("is-valid", "true");
    core.setOutput("actor", actor);
    core.info(`✅ Gate Passed: Previous outcome is '${previousOutcome}' and actor '@${actor}' is authorized.`);

    await core.summary
      .addHeading("✅ Action Approval Gate Passed", 2)
      .addTable([
        [{ data: "Metric", header: true }, { data: "Value", header: true }],
        ["Previous Outcome", previousOutcome.toUpperCase()],
        ["Status", "APPROVED / READY"],
        ["Actor", `@${actor}`],
      ])
      .write();
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

if (process.env.NODE_ENV !== "test") {
  run();
}
