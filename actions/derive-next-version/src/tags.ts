import { execSync } from "child_process";
import { parseSemVer } from "./semver";
import { SemVer } from "./types";

/**
 * Returns the latest valid SemVer tag ordered chronologically by creation date.
 * Uses local git tags sorted by -creatordate.
 */
export function fetchLatestTag(
  gitExecutor: () => string[] = defaultGetLocalGitTags
): SemVer | null {
  for (const tag of gitExecutor()) {
    const parsed = parseSemVer(tag);
    if (parsed) return parsed;
  }
  return null;
}

export function defaultGetLocalGitTags(): string[] {
  try {
    const raw = execSync(
      'git for-each-ref --sort=-creatordate --format="%(refname:short)" refs/tags',
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return raw.split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
  } catch {
    return [];
  }
}
