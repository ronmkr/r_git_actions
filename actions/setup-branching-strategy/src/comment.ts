/**
 * Feature: PR Branching Strategy Feedback Comment
 * Posts or updates an idempotent comment on the Pull Request summarizing the configured branching strategy.
 */

import * as core from "@actions/core";
import { GitHub } from "@actions/github/lib/utils";
import { BranchingStrategyConfig } from "./strategies";
import { RulesetUpsertResult } from "./ruleset-manager";

export const STRATEGY_COMMENT_TAG = "<!-- setup-branching-strategy-comment -->";

export interface StrategyCommentOptions {
  strategyConfig: BranchingStrategyConfig;
  rulesetResult: RulesetUpsertResult;
  createdBranches: string[];
  enforceProtection: boolean;
  requiredApprovals: number;
}

export async function postStrategyComment(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  pullNumber: number,
  options: StrategyCommentOptions
): Promise<void> {
  const { strategyConfig, rulesetResult, createdBranches, enforceProtection, requiredApprovals } = options;

  const isSuccess = !rulesetResult.error;
  const statusIcon = isSuccess ? "✅" : "⚠️";

  const body = `${STRATEGY_COMMENT_TAG}
## ${statusIcon} Branching Strategy Configured: \`${strategyConfig.name.toUpperCase()}\`

| Attribute | Value |
| :--- | :--- |
| **Strategy Model** | \`${strategyConfig.name.toUpperCase()}\` |
| **Target Branches** | ${strategyConfig.branches.map((b) => `\`${b}\``).join(", ")} |
| **New Branches Created** | ${createdBranches.length ? createdBranches.map((b) => `\`${b}\``).join(", ") : "None (all existed)"} |
| **Ruleset Name** | \`${rulesetResult.name}\` |
| **Ruleset Action** | ${enforceProtection ? (rulesetResult.error ? `❌ Failed: ${rulesetResult.error}` : `\`${rulesetResult.action.toUpperCase()}\` (#${rulesetResult.id})`) : "Disabled"} |
| **Direct Commits Blocked** | ${enforceProtection ? "Yes (PR required, 0 bypasses)" : "No"} |
| **Minimum Approvals** | \`${requiredApprovals}\` (baseline ≥ 2) |

---
*Configured automatically via setup-branching-strategy action.*
`;

  try {
    core.info(`Checking for existing strategy comments on PR #${pullNumber}...`);
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pullNumber,
    });

    const existing = comments.find((c) => c.body?.includes(STRATEGY_COMMENT_TAG));

    if (existing) {
      core.info(`Updating existing strategy comment #${existing.id}...`);
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body,
      });
    } else {
      core.info(`Posting new strategy comment on PR #${pullNumber}...`);
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    core.warning(`Could not post PR strategy comment: ${msg}`);
  }
}
