import * as github from "@actions/github";
import { BumpType } from "./types";

type OctokitClient = ReturnType<typeof github.getOctokit>;

export function cleanHeader(header: string): string {
  return header
    .replace(/^\[[A-Z0-9]+-[0-9]+\]\s*|^[A-Z0-9]+-[0-9]+:\s*|\s*\([A-Z0-9]+-[0-9]+\)$/gi, "")
    .trim();
}

export const CONVENTIONAL_COMMIT_REGEX =
  /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-zA-Z0-9_.\-\/]+\))?(!)?: .+/;

export function evaluateConventionalBump(messages: string[]): BumpType {
  let bump: BumpType = "none";

  for (const message of messages) {
    if (!message || !message.trim()) continue;

    const lines = message.trim().split(/\r?\n/);
    const rawHeader = lines[0] || "";
    const header = cleanHeader(rawHeader);

    const match = header.match(CONVENTIONAL_COMMIT_REGEX);
    const hasBreakingHeader = Boolean(match && match[3] === "!");
    const hasBreakingBody = /(^|\n|\r)BREAKING[ -]CHANGE:\s*.+/m.test(message);

    if (hasBreakingHeader || hasBreakingBody) {
      return "major";
    }

    if (!match) continue;

    const type = match[1].toLowerCase();
    if (type === "feat") {
      bump = "minor";
    } else if (
      bump !== "minor" &&
      (type === "fix" || type === "perf" || type === "refactor" || type === "revert")
    ) {
      bump = "patch";
    }
  }

  return bump;
}

export async function fetchCommitMessages(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  baseTagRef: string,
  headSha: string
): Promise<string[]> {
  if (baseTagRef) {
    const compare = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: baseTagRef,
      head: headSha,
    });
    return compare.data.commits.map((c) => c.commit.message);
  }

  const list = await octokit.rest.repos.listCommits({
    owner,
    repo,
    sha: headSha,
    per_page: 100,
  });
  return list.data.map((c) => c.commit.message);
}
