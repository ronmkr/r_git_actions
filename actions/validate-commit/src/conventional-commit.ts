/**
 * Feature: Conventional Commits Validation
 * Validates commit message header against the Conventional Commits specification.
 */

export const CONVENTIONAL_COMMIT_REGEX =
  /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-zA-Z0-9_.\-\/]+\))?(!)?: .+/;

export interface ConventionalCommitResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates if the commit header matches Conventional Commits format.
 * Strips Jira issue key tags (e.g., [PROJ-123] or PROJ-123:) before validating.
 */
export function validateConventionalCommit(
  commitMessage: string,
  jiraRegex?: string
): ConventionalCommitResult {
  const header = commitMessage.trim().split(/\r?\n/)[0] || "";

  // Strip standard Jira tags: leading [KEY] / KEY: or trailing (KEY)
  const tagPat = jiraRegex && jiraRegex.trim() ? `(?:${jiraRegex.trim()}|[A-Z][A-Z0-9]+-[0-9]+)` : `[A-Z][A-Z0-9]+-[0-9]+`;
  let cleaned = header
    .replace(new RegExp(`^(?:\\[${tagPat}\\]|${tagPat}:)\\s*`, "i"), "")
    .replace(new RegExp(`\\s*\\(?${tagPat}\\)?$`, "i"), "")
    .trim();

  const matches = CONVENTIONAL_COMMIT_REGEX.test(cleaned);
  if (!matches) {
    return {
      isValid: false,
      error:
        `Header "${header}" does not follow Conventional Commits format: ` +
        "<type>(<scope>): <subject> (e.g., feat, fix, chore, docs, refactor, test, etc.)",
    };
  }

  return {
    isValid: true,
  };
}
