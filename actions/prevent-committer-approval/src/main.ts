import * as core from "@actions/core";
import * as github from "@actions/github";
import { getPrCommitters } from "./committers";
import { getActiveApprovals } from "./reviews";
import { dismissCommitterApprovals } from "./dismissal";
import { postDismissalComment } from "./comment";

function getBool(name: string, defaultValue = false): boolean {
  const val = core.getInput(name).trim().toLowerCase();
  if (!val) return defaultValue;
  return val === "true" || val === "1" || val === "yes";
}

export async function run(): Promise<void> {
  try {
    const githubToken = core.getInput("github-token");
    if (githubToken) core.setSecret(githubToken);

    if (!githubToken) {
      core.setFailed("Input 'github-token' is required to inspect and dismiss PR reviews.");
      return;
    }

    const prPayload = github.context.payload.pull_request;
    const rawPullNumber = core.getInput("pull-number") || prPayload?.number || github.context.issue.number;
    const pullNumber = parseInt(String(rawPullNumber), 10);

    if (!pullNumber || isNaN(pullNumber)) {
      core.setFailed("Could not determine Pull Request number. Please provide 'pull-number' input or run on pull_request / pull_request_review events.");
      return;
    }

    const repoInput =
      core.getInput("repository") ||
      github.context.payload.repository?.full_name ||
      `${github.context.repo.owner}/${github.context.repo.repo}`;

    const [owner, repo] = repoInput.split("/");
    if (!owner || !repo) {
      core.setFailed(`Invalid repository format '${repoInput}'. Expected 'owner/repo'.`);
      return;
    }

    const dismissMessage =
      core.getInput("dismiss-message") ||
      "Automated Governance: PR authors and committers cannot approve their own pull requests.";

    const postComment = getBool("post-comment", true);
    const failOnViolation = getBool("fail-on-violation", true);
    const excludeBots = getBool("exclude-bots", false);

    const prAuthor = prPayload?.user?.login;

    core.info("========================================");
    core.info(`🔍 Enforcing Independent PR Review Governance for ${owner}/${repo}#${pullNumber}`);
    core.info(`- PR Author              : ${prAuthor || "N/A"}`);
    core.info(`- Post PR Comment        : ${postComment}`);
    core.info(`- Fail on Violation      : ${failOnViolation}`);
    core.info(`- Exclude Bots           : ${excludeBots}`);
    core.info("========================================\n");

    const octokit = github.getOctokit(githubToken);

    // 1. Fetch all authors and committers in the PR
    const committers = await getPrCommitters(octokit, owner, repo, pullNumber, prAuthor);

    // 2. Fetch all currently active approval reviews
    const approvals = await getActiveApprovals(octokit, owner, repo, pullNumber, excludeBots);

    // 3. Dismiss any approvals from PR committers or authors
    const dismissalResults = await dismissCommitterApprovals(
      octokit,
      owner,
      repo,
      pullNumber,
      approvals,
      committers,
      dismissMessage
    );

    const hasViolation = dismissalResults.length > 0;
    const dismissedUsers = dismissalResults.map((r) => r.reviewerLogin);

    // 4. Set Outputs
    core.setOutput("has-violation", String(hasViolation));
    core.setOutput("dismissed-approvers", dismissedUsers.join(","));
    core.setOutput("dismissed-count", String(dismissalResults.length));

    // 5. Post or update feedback comment on PR if enabled
    if (postComment) {
      await postDismissalComment(octokit, owner, repo, pullNumber, dismissalResults, hasViolation);
    }

    // 6. Visual Step Summary
    if (hasViolation) {
      try {
        await core.summary
          .addHeading("⚠️ Self-Approval Policy Violation Detected", 2)
          .addTable([
            [{ data: "Reviewer", header: true }, { data: "Role in PR", header: true }, { data: "Review ID", header: true }, { data: "Action", header: true }],
            ...dismissalResults.map((r) => [
              `@${r.reviewerLogin}`,
              r.isPrAuthor ? "PR Author" : `${r.commitCount} commit(s)`,
              `#${r.reviewId}`,
              r.dismissed ? "✅ Dismissed" : `❌ Error: ${r.error}`,
            ]),
          ])
          .write();
      } catch {
        core.debug("Unable to write step summary.");
      }

      if (failOnViolation) {
        core.setFailed(
          `PR #${pullNumber} violates independent review policy: ${dismissalResults.length} committer approval(s) detected and dismissed (${dismissedUsers.join(", ")}). Independent review required.`
        );
      } else {
        core.warning(
          `PR #${pullNumber} committer approvals were dismissed (${dismissedUsers.join(", ")}), but 'fail-on-violation' is disabled.`
        );
      }
    } else {
      core.info("🎉 All PR approvals are compliant! No committer self-approvals detected.");
      try {
        await core.summary
          .addHeading("✅ PR Review Governance Compliant", 2)
          .addTable([
            [{ data: "Attribute", header: true }, { data: "Status", header: true }],
            ["Total Active Approvals", String(approvals.length)],
            ["Committer Approvals Found", "0"],
            ["Independent Reviews Verified", "PASSED ✅"],
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
