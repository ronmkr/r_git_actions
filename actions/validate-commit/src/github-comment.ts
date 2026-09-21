/**
 * Feature: GitHub Pull Request Commenting
 * Builds and publishes or updates failure/success feedback comments on PRs.
 */

import * as core from "@actions/core";
import * as github from "@actions/github";

export const PR_COMMENT_TAG = "<!-- validate-commit-comment -->";

export interface CommentGuidelines {
  requireJira: boolean;
  checkConventional: boolean;
  allowedStatuses?: string[];
}

export interface PrCommentOptions {
  githubToken: string;
  owner: string;
  repo: string;
  pullNumber: number;
  isValid: boolean;
  errors: string[];
  guidelines: CommentGuidelines;
}

/**
 * Formats Markdown body for PR comment.
 */
export function buildPrCommentBody(
  isValid: boolean,
  errors: string[],
  guidelines: CommentGuidelines
): string {
  if (isValid) {
    return `${PR_COMMENT_TAG}\n### ✅ Commit Validation Passed\n\nAll commit messages in this pull request meet the required standards.`;
  }

  let body = `${PR_COMMENT_TAG}\n### ❌ Commit Validation Failed\n\n`;
  body += "The following validation errors were detected in your commits:\n\n";

  for (const error of errors) {
    body += `- ⚠️ ${error}\n`;
  }

  body += "\n---\n#### 📌 Repository Commit Guidelines:\n";
  if (guidelines.requireJira) {
    body += "- **Jira Issue Key**: Every commit must reference a Jira ticket (e.g., `[PROJ-123]` or `PROJ-123:`).\n";
  }
  if (guidelines.checkConventional) {
    body += "- **Conventional Commits**: Format must follow `<type>(<scope>): <subject>` (e.g., `feat:`, `fix:`, `chore:`).\n";
  }
  if (guidelines.allowedStatuses && guidelines.allowedStatuses.length > 0) {
    body += `- **Jira Status**: Issue status must be one of: \`${guidelines.allowedStatuses.join(", ")}\`.\n`;
  }

  body += "\n*Tip: Amend your commit messages using `git commit --amend` or `git rebase -i` and force-push.*";
  return body;
}

/**
 * Publishes or updates a comment on the Pull Request.
 */
export async function postOrUpdatePrComment(options: PrCommentOptions): Promise<void> {
  const { githubToken, owner, repo, pullNumber, isValid, errors, guidelines } = options;

  if (!githubToken) {
    core.warning("github-token is required to post or update PR comments.");
    return;
  }

  const octokit = github.getOctokit(githubToken);

  try {
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pullNumber,
    });

    const existingComment = comments.find((c) => c.body?.includes(PR_COMMENT_TAG));
    const commentBody = buildPrCommentBody(isValid, errors, guidelines);

    if (existingComment) {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body: commentBody,
      });
      core.info(`Updated existing PR comment #${existingComment.id}.`);
    } else if (!isValid) {
      const { data: newComment } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body: commentBody,
      });
      core.info(`Posted PR comment #${newComment.id}.`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    core.warning(`Failed to post or update PR comment: ${msg}`);
  }
}
