import * as core from "@actions/core";
import * as github from "@actions/github";
import { resolveStrategyConfig, StrategyType } from "./strategies";
import { ensureBranchExists } from "./branch-manager";
import { upsertRepoRuleset } from "./ruleset-manager";
import { checkAllowedActors } from "./auth-check";
import { postStrategyComment } from "./comment";

function getBool(name: string, defaultValue = false): boolean {
  const val = core.getInput(name).trim().toLowerCase();
  if (!val) return defaultValue;
  return val === "true" || val === "1" || val === "yes";
}

export async function run(): Promise<void> {
  try {
    // 1. Verify Actor Authorization
    const allowedActorsInput = core.getInput("allowed-actors");
    const actor = github.context.actor;
    const auth = checkAllowedActors(allowedActorsInput, actor);
    if (!auth.allowed) {
      core.setFailed(`⛔ Security Violation: ${auth.reason}`);
      return;
    }

    // 2. Read Inputs
    const strategyInput = (core.getInput("strategy") || "trunk-based").trim();
    const repoInput =
      core.getInput("repository") ||
      github.context.payload.repository?.full_name ||
      `${github.context.repo.owner}/${github.context.repo.repo}`;
    const githubToken = core.getInput("github-token");
    if (githubToken) core.setSecret(githubToken);

    if (!githubToken) {
      core.setFailed("Input 'github-token' is required to manage repository branches and rulesets.");
      return;
    }

    const [owner, repo] = repoInput.split("/");
    if (!owner || !repo) {
      core.setFailed(`Invalid repository format '${repoInput}'. Expected 'owner/repo'.`);
      return;
    }

    const baseDefaultBranch = core.getInput("default-branch") || "main";
    const customBranchesInput = core.getInput("branches");
    const customBranches = customBranchesInput
      ? customBranchesInput.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const enforceProtection = getBool("enforce-protection", true);
    const rawApprovals = parseInt(core.getInput("required-approvals") || "2", 10);
    const requiredApprovals = isNaN(rawApprovals) ? 2 : Math.max(rawApprovals, 2);

    const dismissStaleReviews = getBool("dismiss-stale-reviews", true);
    const requireLinearHistory = getBool("require-linear-history", true);
    const requireCodeOwnerReview = getBool("require-code-owner-review", true);
    const requireLastPushApproval = getBool("require-last-push-approval", true);
    const requireReviewThreadResolution = getBool("require-review-thread-resolution", true);
    const requireSignedCommits = getBool("require-signed-commits", false);
    const updateDefaultBranch = getBool("update-default-branch", false);
    const postComment = getBool("post-comment", true);
    const rulesetName = (core.getInput("ruleset-name") || `Strategy: ${strategyInput.toUpperCase()}`).trim();

    core.info("========================================");
    core.info(`🚀 Configuring Branching Strategy for: ${owner}/${repo}`);
    core.info(`- Selected Strategy           : ${strategyInput}`);
    core.info(`- Base Default Branch         : ${baseDefaultBranch}`);
    core.info(`- Ruleset Name                : ${rulesetName}`);
    core.info(`- Enforce Ruleset             : ${enforceProtection}`);
    core.info(`- Required Approvals (min 2)  : ${requiredApprovals}`);
    core.info(`- Dismiss Stale Reviews       : ${dismissStaleReviews}`);
    core.info(`- Require Thread Resolution   : ${requireReviewThreadResolution}`);
    core.info(`- Require Last Push Approval  : ${requireLastPushApproval}`);
    core.info(`- Require CODEOWNERS Review   : ${requireCodeOwnerReview}`);
    core.info(`- Require Linear History      : ${requireLinearHistory}`);
    core.info(`- Require Signed Commits      : ${requireSignedCommits}`);
    core.info(`- Update Repo Default Ref     : ${updateDefaultBranch}`);
    core.info(`- Triggering Actor            : ${actor}`);
    core.info("========================================\n");

    const octokit = github.getOctokit(githubToken);

    // 3. Resolve Strategy Configuration
    const strategyConfig = resolveStrategyConfig(strategyInput as StrategyType, {
      customBranches,
      defaultBranch: baseDefaultBranch,
      requiredApprovals,
    });

    core.info(`Target branches for '${strategyConfig.name}': [${strategyConfig.branches.join(", ")}]`);

    // 4. Ensure All Required Branches Exist
    const createdBranches: string[] = [];
    const existingBranches: string[] = [];
    const branchErrors: string[] = [];

    for (const branch of strategyConfig.branches) {
      const result = await ensureBranchExists(octokit, owner, repo, branch, baseDefaultBranch);
      if (result.error) {
        branchErrors.push(result.error);
        core.error(result.error);
      } else if (result.created) {
        createdBranches.push(branch);
      } else {
        existingBranches.push(branch);
      }
    }

    // 5. Upsert GitHub Ruleset (Idempotent: updates existing ruleset, avoiding duplicates)
    let rulesetResult: { id: number; name: string; action: "created" | "updated"; branches: string[]; error?: string } = {
      id: 0,
      name: rulesetName,
      action: "created",
      branches: strategyConfig.branches,
      error: undefined,
    };
    if (enforceProtection) {
      rulesetResult = await upsertRepoRuleset(octokit, owner, repo, rulesetName, strategyConfig.branches, {
        requiredApprovals,
        dismissStaleReviews,
        requireLinearHistory,
        requireCodeOwnerReview,
        requireLastPushApproval,
        requiredReviewThreadResolution: requireReviewThreadResolution,
        requireSignedCommits,
      });
    }

    // 6. Optionally Update Repository Default Branch
    let defaultBranchUpdated = false;
    if (updateDefaultBranch && strategyConfig.defaultBranch && strategyConfig.defaultBranch !== baseDefaultBranch) {
      try {
        await octokit.rest.repos.update({
          owner,
          repo,
          default_branch: strategyConfig.defaultBranch,
        });
        core.info(`📌 Updated repository default branch to '${strategyConfig.defaultBranch}'.`);
        defaultBranchUpdated = true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        core.warning(`Could not update default branch to '${strategyConfig.defaultBranch}': ${msg}`);
      }
    }

    // 7. Set Outputs
    core.setOutput("strategy", strategyConfig.name);
    core.setOutput("created-branches", createdBranches.join(","));
    core.setOutput("ruleset-id", rulesetResult.id ? String(rulesetResult.id) : "");
    core.setOutput("ruleset-action", rulesetResult.action);
    core.setOutput("default-branch", strategyConfig.defaultBranch || baseDefaultBranch);

    // 8. Visual Step Summary
    try {
      await core.summary
        .addHeading("Branching Strategy Configuration Summary", 2)
        .addTable([
          [{ data: "Attribute", header: true }, { data: "Details", header: true }],
          ["Repository", `${owner}/${repo}`],
          ["Strategy Model", strategyConfig.name.toUpperCase()],
          ["Branches Managed", strategyConfig.branches.join(", ")],
          ["Newly Created Branches", createdBranches.length ? createdBranches.join(", ") : "None (all existed)"],
          ["Ruleset Name", rulesetName],
          ["Ruleset Action", enforceProtection ? (rulesetResult.error ? `Failed: ${rulesetResult.error}` : `${rulesetResult.action.toUpperCase()} (#${rulesetResult.id})`) : "Disabled"],
          ["Direct Commits Blocked", enforceProtection ? "Yes (Pull Request Required)" : "No"],
          ["Approvals Required", `${requiredApprovals} (min 2)`],
          ["Dismiss Stale Reviews", dismissStaleReviews ? "Yes" : "No"],
          ["Require Thread Resolution", requireReviewThreadResolution ? "Yes" : "No"],
          ["Require Last Push Approval", requireLastPushApproval ? "Yes" : "No"],
          ["Require CODEOWNERS Review", requireCodeOwnerReview ? "Yes" : "No"],
          ["Linear History Enforced", requireLinearHistory ? "Yes" : "No"],
          ["Default Branch", strategyConfig.defaultBranch || baseDefaultBranch],
          ["Default Branch Updated", defaultBranchUpdated ? "Yes" : "No"],
        ])
        .write();
    } catch {
      core.debug("Unable to write step summary.");
    }

    // 9. Post or update PR comment if running in PR context
    const prNumber = github.context.payload.pull_request?.number;
    if (postComment && prNumber && githubToken) {
      await postStrategyComment(octokit, owner, repo, prNumber, {
        strategyConfig,
        rulesetResult,
        createdBranches,
        enforceProtection,
        requiredApprovals,
      });
    }

    // 10. Fail job if critical errors occurred
    const totalErrors = branchErrors.length + (rulesetResult.error ? 1 : 0);
    if (totalErrors > 0) {
      core.setFailed(`Branching strategy configuration encountered ${totalErrors} error(s). Check logs above.`);
    } else {
      core.info(`🎉 Successfully configured '${strategyConfig.name}' branching strategy with GitHub Ruleset for ${owner}/${repo}!`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action execution failed: ${msg}`);
  }
}

if (require.main === module) {
  run();
}
