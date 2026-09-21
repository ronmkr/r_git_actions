/**
 * Feature: PR Dismissal Feedback Comment
 * Posts or updates an idempotent comment on the Pull Request when an approval is dismissed.
 */

import * as core from "@actions/core";
import { GitHub } from "@actions/github/lib/utils";
import { DismissalResult } from "./dismissal";

export const DISMISSAL_COMMENT_TAG = "<!-- prevent-committer-approval-comment -->";

export async function postDismissalComment(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  pullNumber: number,
  violations: DismissalResult[],
  hasViolation = true
): Promise<void> {
  const body = hasViolation
    ? `${DISMISSAL_COMMENT_TAG}
## ⚠️ Committer Approval Dismissed

According to our engineering governance policy, **contributors and authors cannot approve their own pull requests or commits**.

The following approval review(s) were automatically dismissed:
${violations.map((v) => `- **@${v.reviewerLogin}** (${v.isPrAuthor ? "PR Author" : `${v.commitCount} commit(s) in PR`}) — Review #${v.reviewId} ${v.dismissed ? "✅ Dismissed" : `❌ Dismissal failed: ${v.error}`}`).join("\n")}

### 📋 Next Steps
- An independent reviewer who has **not** contributed commits to this Pull Request must review and approve the changes before merge.
`
    : `${DISMISSAL_COMMENT_TAG}
## ✅ Independent Code Review Verified

All active approvals on this Pull Request have been verified as independent. No author or committer self-approvals detected.
`;

  try {
    core.info(`Checking for existing governance comments on PR #${pullNumber}...`);
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pullNumber,
    });

    const existing = comments.find((c) => c.body?.includes(DISMISSAL_COMMENT_TAG));

    if (existing) {
      core.info(`Updating existing governance comment #${existing.id}...`);
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body,
      });
    } else if (hasViolation) {
      core.info(`Posting new governance comment on PR #${pullNumber}...`);
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    core.warning(`Could not post PR governance comment: ${msg}`);
  }
}
