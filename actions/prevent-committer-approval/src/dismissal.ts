/**
 * Feature: Non-Compliant Review Dismissal Manager
 * Identifies approvals from committers/authors and dismisses them via the GitHub REST API.
 */

import * as core from "@actions/core";
import { GitHub } from "@actions/github/lib/utils";
import { CommitterInfo } from "./committers";
import { ActiveApproval } from "./reviews";

export interface DismissalResult {
  reviewId: number;
  reviewerLogin: string;
  isPrAuthor: boolean;
  commitCount: number;
  dismissed: boolean;
  error?: string;
}

/**
 * Checks active approvals against the set of committers/authors and dismisses non-compliant reviews.
 */
export async function dismissCommitterApprovals(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  pullNumber: number,
  approvals: ActiveApproval[],
  committers: Map<string, CommitterInfo>,
  dismissMessage: string
): Promise<DismissalResult[]> {
  const results: DismissalResult[] = [];

  for (const approval of approvals) {
    const norm = approval.reviewerLogin.toLowerCase();
    const committerInfo = committers.get(norm);

    if (committerInfo) {
      core.warning(
        `🚨 Policy Violation Detected: Reviewer '@${approval.reviewerLogin}' has contributed commits or authored PR #${pullNumber} (isAuthor: ${committerInfo.isPrAuthor}, commits: ${committerInfo.commitCount}). Self-approval is disallowed.`
      );

      const fullMessage = `${dismissMessage.trim()} (Reviewer: @${approval.reviewerLogin} contributed to this PR).`;

      try {
        await octokit.rest.pulls.dismissReview({
          owner,
          repo,
          pull_number: pullNumber,
          review_id: approval.reviewId,
          message: fullMessage,
        });

        core.info(`🗑️ Successfully dismissed approval review #${approval.reviewId} from '@${approval.reviewerLogin}'.`);
        results.push({
          reviewId: approval.reviewId,
          reviewerLogin: approval.reviewerLogin,
          isPrAuthor: committerInfo.isPrAuthor,
          commitCount: committerInfo.commitCount,
          dismissed: true,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        core.error(`Failed to dismiss review #${approval.reviewId} from '@${approval.reviewerLogin}': ${msg}`);
        results.push({
          reviewId: approval.reviewId,
          reviewerLogin: approval.reviewerLogin,
          isPrAuthor: committerInfo.isPrAuthor,
          commitCount: committerInfo.commitCount,
          dismissed: false,
          error: msg,
        });
      }
    }
  }

  return results;
}
