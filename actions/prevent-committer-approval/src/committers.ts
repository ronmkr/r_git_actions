/**
 * Feature: PR Committers and Author Extractor
 * Identifies all GitHub users who contributed commits or authored the Pull Request.
 */

import * as core from "@actions/core";
import { GitHub } from "@actions/github/lib/utils";

export interface CommitterInfo {
  login: string;
  isPrAuthor: boolean;
  commitCount: number;
}

/**
 * Fetches all unique GitHub logins that authored or committed changes to the PR.
 */
export async function getPrCommitters(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  pullNumber: number,
  prAuthor?: string
): Promise<Map<string, CommitterInfo>> {
  const committers = new Map<string, CommitterInfo>();

  if (prAuthor) {
    const norm = prAuthor.trim().toLowerCase();
    committers.set(norm, {
      login: prAuthor.trim(),
      isPrAuthor: true,
      commitCount: 0,
    });
  }

  core.info(`Fetching commits for PR #${pullNumber} in ${owner}/${repo}...`);

  const commits = await octokit.paginate(octokit.rest.pulls.listCommits, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  core.info(`Retrieved ${commits.length} commit(s) from PR #${pullNumber}.`);

  for (const item of commits) {
    const loginsInCommit = new Set<string>();
    if (item.author?.login) loginsInCommit.add(item.author.login.trim().toLowerCase());
    if (item.committer?.login) loginsInCommit.add(item.committer.login.trim().toLowerCase());

    for (const norm of loginsInCommit) {
      const originalLogin =
        item.author?.login?.toLowerCase() === norm
          ? item.author.login.trim()
          : item.committer?.login?.trim() || norm;

      const existing = committers.get(norm);
      if (existing) {
        existing.commitCount += 1;
      } else {
        committers.set(norm, {
          login: originalLogin,
          isPrAuthor: norm === prAuthor?.toLowerCase(),
          commitCount: 1,
        });
      }
    }
  }

  core.info(`Identified ${committers.size} unique author(s)/committer(s) in PR #${pullNumber}: [${Array.from(committers.values()).map(c => c.login).join(", ")}]`);
  return committers;
}
