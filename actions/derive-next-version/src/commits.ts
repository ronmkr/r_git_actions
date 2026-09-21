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
  const cleanMessages = messages.filter((m) => m && m.trim());
  if (cleanMessages.length === 0) return "none";

  const hasMajor = cleanMessages.some((m) => {
    const header = cleanHeader(m.trim().split(/\r?\n/)[0] || "");
    const match = header.match(CONVENTIONAL_COMMIT_REGEX);
    return Boolean(match && match[3] === "!") || /(^|\n|\r)BREAKING[ -]CHANGE:\s*.+/m.test(m);
  });
  if (hasMajor) return "major";

  const hasFeat = cleanMessages.some((m) => {
    const header = cleanHeader(m.trim().split(/\r?\n/)[0] || "");
    const match = header.match(CONVENTIONAL_COMMIT_REGEX);
    return Boolean(match && match[1].toLowerCase() === "feat");
  });
  if (hasFeat) return "minor";

  const hasPatch = cleanMessages.some((m) => {
    const header = cleanHeader(m.trim().split(/\r?\n/)[0] || "");
    const match = header.match(CONVENTIONAL_COMMIT_REGEX);
    return Boolean(match && ["fix", "perf", "refactor", "revert"].includes(match[1].toLowerCase()));
  });
  return hasPatch ? "patch" : "none";
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
