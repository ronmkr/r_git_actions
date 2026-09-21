/**
 * Feature: PR Reviews Extractor
 * Retrieves all active approval reviews submitted on the Pull Request.
 */

import * as core from "@actions/core";
import { GitHub } from "@actions/github/lib/utils";

export interface ActiveApproval {
  reviewId: number;
  reviewerLogin: string;
  submittedAt?: string;
}

/**
 * Fetches all currently active approval reviews for a pull request.
 * If a reviewer approved and later requested changes or dismissed, only the latest state counts.
 */
export async function getActiveApprovals(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  pullNumber: number,
  excludeBots = false
): Promise<ActiveApproval[]> {
  core.info(`Fetching reviews for PR #${pullNumber}...`);

  const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  core.info(`Found ${reviews.length} review submission(s). Resolving latest reviewer states...`);

  // Track latest review per reviewer
  // GitHub returns reviews chronologically
  const latestByUser = new Map<string, { id: number; state: string; login: string; submittedAt?: string }>();

  for (const r of reviews) {
    if (!r.user?.login) continue;
    const login = r.user.login.trim();
    const norm = login.toLowerCase();

    if (excludeBots && (login.endsWith("[bot]") || r.user.type === "Bot")) {
      core.debug(`Skipping bot reviewer '${login}'.`);
      continue;
    }

    // Only review states that represent review decisions
    if (r.state === "APPROVED" || r.state === "CHANGES_REQUESTED" || r.state === "DISMISSED") {
      latestByUser.set(norm, {
        id: r.id,
        state: r.state,
        login: login,
        submittedAt: r.submitted_at,
      });
    }
  }

  const activeApprovals: ActiveApproval[] = Array.from(latestByUser.values())
    .filter((r) => r.state === "APPROVED")
    .map((r) => ({
      reviewId: r.id,
      reviewerLogin: r.login,
      submittedAt: r.submittedAt,
    }));

  core.info(`Found ${activeApprovals.length} active approval(s): [${activeApprovals.map(a => a.reviewerLogin).join(", ")}]`);
  return activeApprovals;
}
