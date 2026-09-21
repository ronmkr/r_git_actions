/**
 * Feature: Git Commit Message Extractor
 * Strictly extracts only the commits within the Pull Request (or push event),
 * never the whole repository.
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import { execSync } from "child_process";

export interface CommitInfo {
  sha?: string;
  message: string;
}

export interface CommitExtractionOptions {
  explicitMessage?: string;
  githubToken?: string;
  checkAllPrCommits?: boolean;
}

/**
 * Retrieves only the commits belonging to the Pull Request or push event.
 */
export async function getPrCommits(options: CommitExtractionOptions): Promise<CommitInfo[]> {
  const { explicitMessage, githubToken, checkAllPrCommits = true } = options;

  // 1. Explicit message takes highest precedence
  if (explicitMessage && explicitMessage.trim()) {
    core.info("Using explicitly provided 'commit-message' input.");
    return [{ message: explicitMessage.trim() }];
  }

  const context = github.context;

  // 2. Pull Request: Extract strictly all commits in this PR
  if (context.eventName === "pull_request" && context.payload.pull_request) {
    const pr = context.payload.pull_request;
    const prNumber = pr.number;
    core.info(`Detected Pull Request #${prNumber}: "${pr.title}"`);

    // Fetch all commits in this PR via GitHub API (with automatic pagination)
    if (githubToken) {
      try {
        const octokit = github.getOctokit(githubToken);
        const commits = await octokit.paginate(octokit.rest.pulls.listCommits, {
          owner: context.repo.owner,
          repo: context.repo.repo,
          pull_number: prNumber,
          per_page: 100,
        });

        const prCommits: CommitInfo[] = commits
          .map((c) => ({
            sha: c.sha.substring(0, 7),
            message: c.commit.message?.trim() || "",
          }))
          .filter((c) => c.message.length > 0);

        if (prCommits.length > 0) {
          const selected = checkAllPrCommits ? prCommits : prCommits.slice(-1);
          core.info(`Selected ${selected.length} commit(s) belonging to Pull Request #${prNumber}.`);
          return selected;
        }
      } catch (err) {
        core.warning(`GitHub API failed to list PR commits: ${err}. Attempting git log fallback.`);
      }
    }

    // Fallback: git log strictly between base and head SHA
    if (pr.base?.sha && pr.head?.sha) {
      try {
        // Ensure base reference commit is fetched
        try {
          execSync(`git fetch origin ${pr.base.sha} --depth=50`, { stdio: "ignore" });
        } catch {
          // ignore fetch error
        }

        const cmd = `git log ${pr.base.sha}..${pr.head.sha} --format="---COMMIT---%h%n%B"`;
        const output = execSync(cmd, { encoding: "utf-8" });
        const rawBlocks = output.split("---COMMIT---").map((b) => b.trim()).filter(Boolean);

        const prCommits: CommitInfo[] = [];
        for (const block of rawBlocks) {
          const lines = block.split(/\r?\n/);
          const sha = lines[0]?.trim();
          const message = lines.slice(1).join("\n").trim();
          if (message) {
            prCommits.push({ sha, message });
          }
        }

        if (prCommits.length > 0) {
          core.info(`Retrieved ${prCommits.length} commit(s) from git range ${pr.base.sha.substring(0, 7)}..${pr.head.sha.substring(0, 7)}.`);
          return prCommits;
        }
      } catch (gitErr) {
        core.debug(`Git range log failed: ${gitErr}`);
      }
    }

    // Fallback to PR title if no commits could be extracted
    core.warning("Could not extract individual PR commits; falling back to PR title.");
    return [{ message: pr.title.trim() }];
  }

  // 3. Push event: Validate only the commits included in the push
  if (context.eventName === "push" && Array.isArray(context.payload.commits) && context.payload.commits.length > 0) {
    const pushCommits: CommitInfo[] = (context.payload.commits as any[])
      .map((c) => ({
        sha: c.id ? String(c.id).substring(0, 7) : undefined,
        message: String(c.message || "").trim(),
      }))
      .filter((c) => c.message.length > 0);

    if (pushCommits.length > 0) {
      core.info(`Fetched ${pushCommits.length} commit(s) from push event.`);
      return pushCommits;
    }
  }

  // 4. Default / local test: Latest commit only (HEAD)
  try {
    const headOutput = execSync('git log -1 --format="%h%n%B"', { encoding: "utf-8" }).trim();
    if (headOutput) {
      const lines = headOutput.split(/\r?\n/);
      const sha = lines[0]?.trim();
      const message = lines.slice(1).join("\n").trim();
      return [{ sha, message }];
    }
  } catch {
    core.debug("git log -1 failed.");
  }

  return [];
}
