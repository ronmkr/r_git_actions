import * as github from "@actions/github";
import { extractJiraKeys } from "./jira";

type OctokitClient = ReturnType<typeof github.getOctokit>;

export interface PrAuditRecord {
  prNumber: number;
  title: string;
  url: string;
  author: string;
  committers: string[];
  approvers: string[];
  jiraKeys: string[];
  hasCommitterApprovalViolation: boolean;
  violatingApprovers: string[];
}

export interface ReleaseAuditReport {
  baseTag: string;
  headTag: string;
  totalCommits: number;
  prs: PrAuditRecord[];
  allJiraKeys: string[];
  violationsCount: number;
}

/**
 * Extracts PR number from commit messages (e.g. 'Merge pull request #123' or 'feat: add login (#123)').
 */
export function extractPrNumberFromCommit(message: string): number | null {
  const match = message.match(/\(#(\d+)\)$/) || message.match(/Merge pull request #(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Evaluates whether any approver of the PR is also among the committers or author.
 */
export function evaluatePrApprovalCompliance(
  author: string,
  committers: string[],
  approvers: string[]
): { hasViolation: boolean; violatingApprovers: string[] } {
  const authorNorm = author.trim().toLowerCase();
  const committerSet = new Set(committers.map((c) => c.trim().toLowerCase()));
  if (authorNorm) committerSet.add(authorNorm);

  const violating = approvers.filter((appr) => committerSet.has(appr.trim().toLowerCase()));
  return {
    hasViolation: violating.length > 0,
    violatingApprovers: violating,
  };
}

export async function generateReleaseAudit(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  baseTag: string,
  headTag: string,
  projectKeys?: string[]
): Promise<ReleaseAuditReport> {
  const compare = await octokit.rest.repos.compareCommits({
    owner,
    repo,
    base: baseTag,
    head: headTag,
  });

  const commits = compare.data.commits || [];
  const prNumbers = new Set(
    commits.map((c) => extractPrNumberFromCommit(c.commit.message)).filter((n): n is number => Boolean(n))
  );

  const prRecords: PrAuditRecord[] = [];
  const allJiraSet = new Set<string>();

  // Collect Jiras directly from commits
  commits.flatMap((c) => extractJiraKeys(c.commit.message, projectKeys)).forEach((k) => allJiraSet.add(k));

  for (const prNumber of prNumbers) {
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    const prCommits = await octokit.paginate(octokit.rest.pulls.listCommits, {
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    const committersSet = new Set<string>();
    const prAuthor = pr.user?.login || "";

    for (const item of prCommits) {
      if (item.author?.login) committersSet.add(item.author.login);
      if (item.committer?.login) committersSet.add(item.committer.login);
      extractJiraKeys(item.commit.message, projectKeys).forEach((k) => allJiraSet.add(k));
    }

    const prJiras = extractJiraKeys(`${pr.title} ${pr.body || ""}`, projectKeys);
    prJiras.forEach((k) => allJiraSet.add(k));

    // Fetch Reviews
    const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    // Resolve latest review decision per reviewer
    const latestByUser = new Map<string, string>();
    for (const r of reviews) {
      if (r.user?.login && (r.state === "APPROVED" || r.state === "CHANGES_REQUESTED" || r.state === "DISMISSED")) {
        latestByUser.set(r.user.login.toLowerCase(), r.state);
      }
    }

    const approvers = [...latestByUser].filter(([_, s]) => s === "APPROVED").map(([u]) => u);
    const committers = [...committersSet];
    const compliance = evaluatePrApprovalCompliance(prAuthor, committers, approvers);

    prRecords.push({
      prNumber,
      title: pr.title,
      url: pr.html_url,
      author: prAuthor,
      committers,
      approvers,
      jiraKeys: prJiras,
      hasCommitterApprovalViolation: compliance.hasViolation,
      violatingApprovers: compliance.violatingApprovers,
    });
  }

  const violationsCount = prRecords.filter((p) => p.hasCommitterApprovalViolation).length;

  return {
    baseTag,
    headTag,
    totalCommits: commits.length,
    prs: prRecords,
    allJiraKeys: [...allJiraSet].sort(),
    violationsCount,
  };
}
