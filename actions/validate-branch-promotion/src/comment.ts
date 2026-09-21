/**
 * Feature: PR Promotion Feedback Comment
 * Posts or updates an idempotent comment on the Pull Request when a branch promotion violation occurs.
 */

import * as core from "@actions/core";
import { GitHub } from "@actions/github/lib/utils";
import { PromotionValidationResult } from "./promotion-rules";

export const PROMOTION_COMMENT_TAG = "<!-- validate-branch-promotion-comment -->";

export async function postPromotionComment(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  pullNumber: number,
  result: PromotionValidationResult
): Promise<void> {
  const body = !result.valid
    ? `${PROMOTION_COMMENT_TAG}
## ❌ Branch Promotion Policy Violation

According to the repository **${result.strategy.toUpperCase()}** branching strategy, this Pull Request does not follow the required branch promotion sequence.

| Attribute | Details |
| :--- | :--- |
| **Strategy** | \`${result.strategy}\` |
| **Target Branch (Base)** | \`${result.baseBranch}\` |
| **Source Branch (Head)** | \`${result.headBranch}\` |
| **Allowed Source Branches** | ${result.allowedSources.map((s) => `\`${s}\``).join(", ")} |
| **Violation Reason** | ${result.error} |

### 📋 Correct Promotion Flow
${
  result.strategy === "gitops"
    ? "- In GitOps, releases must be promoted sequentially: `dev` ➔ `uat` ➔ `prd`."
    : result.strategy === "gitflow"
    ? "- In GitFlow, production merges into `main` must come from `develop` (or a `release/*` / `hotfix/*` branch)."
    : "- Pull Requests must adhere to the defined stage progression."
}
`
    : `${PROMOTION_COMMENT_TAG}
## ✅ Branch Promotion Policy Compliant

The promotion from \`${result.headBranch}\` into \`${result.baseBranch}\` satisfies the **${result.strategy.toUpperCase()}** promotion policy.
`;

  try {
    core.info(`Checking for existing promotion comments on PR #${pullNumber}...`);
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pullNumber,
    });

    const existing = comments.find((c) => c.body?.includes(PROMOTION_COMMENT_TAG));

    if (existing) {
      core.info(`Updating existing promotion comment #${existing.id}...`);
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body,
      });
    } else if (!result.valid) {
      core.info(`Posting new promotion comment on PR #${pullNumber}...`);
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    core.warning(`Could not post PR promotion comment: ${msg}`);
  }
}
