import * as core from "@actions/core";
import * as github from "@actions/github";
import { validatePromotionHierarchy, StrategyType } from "./promotion-rules";
import { postPromotionComment } from "./comment";

function getBool(name: string, defaultValue = false): boolean {
  const val = core.getInput(name).trim().toLowerCase();
  if (!val) return defaultValue;
  return val === "true" || val === "1" || val === "yes";
}

export async function run(): Promise<void> {
  try {
    const strategyInput = (core.getInput("strategy") || "gitops").trim();
    const prPayload = github.context.payload.pull_request;
    const baseBranch = (core.getInput("base-branch") || prPayload?.base?.ref || "").trim();
    const headBranch = (core.getInput("head-branch") || prPayload?.head?.ref || "").trim();
    const defaultBranch = (core.getInput("default-branch") || "main").trim();

    const customOrder = core
      .getInput("custom-promotion-order")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const failOnViolation = getBool("fail-on-violation", true);
    const postComment = getBool("post-comment", true);
    const githubToken = core.getInput("github-token");
    if (githubToken) core.setSecret(githubToken);

    if (!baseBranch || !headBranch) {
      core.setFailed(
        "Could not determine target (base) or source (head) branch. Provide 'base-branch' and 'head-branch' inputs or run on pull_request events."
      );
      return;
    }

    core.info("========================================");
    core.info(`🔍 Validating Branch Promotion Hierarchy`);
    core.info(`- Strategy        : ${strategyInput}`);
    core.info(`- Target (Base)   : ${baseBranch}`);
    core.info(`- Source (Head)   : ${headBranch}`);
    core.info(`- Fail on Error   : ${failOnViolation}`);
    core.info(`- Post PR Comment : ${postComment}`);
    core.info("========================================\n");

    const result = validatePromotionHierarchy(strategyInput as StrategyType, baseBranch, headBranch, {
      customOrder,
      defaultBranch,
    });

    core.setOutput("is-valid", String(result.valid));
    core.setOutput("strategy", result.strategy);
    core.setOutput("base-branch", result.baseBranch);
    core.setOutput("head-branch", result.headBranch);
    core.setOutput("violation-reason", result.error || "");

    // 1. Post or update PR comment if enabled and in PR context
    const pullNumber = prPayload?.number || github.context.issue.number;
    if (postComment && githubToken && pullNumber) {
      const repoInput =
        core.getInput("repository") ||
        github.context.payload.repository?.full_name ||
        `${github.context.repo.owner}/${github.context.repo.repo}`;
      const [owner, repo] = repoInput.split("/");
      if (owner && repo) {
        const octokit = github.getOctokit(githubToken);
        await postPromotionComment(octokit, owner, repo, pullNumber, result);
      }
    }

    if (!result.valid) {
      core.error(`❌ Branch Promotion Violation: ${result.error}`);

      // 2. Visual Step Summary (Failure)
      try {
        await core.summary
          .addHeading("❌ Branch Promotion Policy Violation", 2)
          .addTable([
            [{ data: "Attribute", header: true }, { data: "Details", header: true }],
            ["Strategy Model", result.strategy.toUpperCase()],
            ["Target Branch (Base)", `<code>${result.baseBranch}</code>`],
            ["Source Branch (Head)", `<code>${result.headBranch}</code>`],
            ["Allowed Source Branches", result.allowedSources.map((s) => `<code>${s}</code>`).join(", ")],
            ["Status", "FAILED ❌"],
            ["Reason", result.error || "Disallowed branch promotion flow"],
          ])
          .write();
      } catch {
        core.debug("Unable to write step summary.");
      }

      // 3. Fail workflow run if configured
      if (failOnViolation) {
        core.setFailed(`Branch promotion check failed: ${result.error}`);
      } else {
        core.warning(`Branch promotion violation detected, but 'fail-on-violation' is disabled.`);
      }
    } else {
      core.info(`✅ Promotion flow is valid: '${headBranch}' -> '${baseBranch}' under '${strategyInput}'.`);
      try {
        await core.summary
          .addHeading("✅ Branch Promotion Flow Verified", 2)
          .addTable([
            [{ data: "Attribute", header: true }, { data: "Details", header: true }],
            ["Strategy Model", result.strategy.toUpperCase()],
            ["Target Branch (Base)", `<code>${result.baseBranch}</code>`],
            ["Source Branch (Head)", `<code>${result.headBranch}</code>`],
            ["Status", "PASSED ✅"],
          ])
          .write();
      } catch {
        core.debug("Unable to write step summary.");
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action execution failed: ${msg}`);
  }
}

if (require.main === module) {
  run();
}
