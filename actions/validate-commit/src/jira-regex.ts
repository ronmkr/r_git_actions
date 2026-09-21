/**
 * Feature: Jira Issue Key Regex Validation
 * Extracts and validates Jira issue keys from commit messages.
 */

export const DEFAULT_JIRA_REGEX = /\b([A-Z][A-Z0-9]+-[0-9]+)\b/g;

export interface JiraRegexResult {
  isValid: boolean;
  keys: string[];
  error?: string;
}

/**
 * Extracts Jira keys from text and optionally filters by project prefixes.
 */
export function extractJiraKeys(
  text: string,
  projectKeys?: string[],
  customRegex?: string
): string[] {
  const regex = customRegex ? new RegExp(customRegex, "g") : new RegExp(DEFAULT_JIRA_REGEX.source, "g");
  const matches = text.match(regex) || [];
  const unique = Array.from(new Set(matches));

  if (!projectKeys || projectKeys.length === 0) {
    return unique;
  }

  const allowedPrefixes = projectKeys.map((k) => k.trim().toUpperCase());
  return unique.filter((key) => {
    const prefix = key.split("-")[0]?.toUpperCase();
    return allowedPrefixes.includes(prefix);
  });
}

/**
 * Validates whether a commit message contains at least one required Jira issue key.
 */
export function validateJiraRegex(
  commitMessage: string,
  projectKeys?: string[],
  customRegex?: string
): JiraRegexResult {
  const keys = extractJiraKeys(commitMessage, projectKeys, customRegex);
  if (keys.length === 0) {
    const prefixNote =
      projectKeys && projectKeys.length > 0
        ? ` with project prefix in [${projectKeys.join(", ")}]`
        : "";
    return {
      isValid: false,
      keys: [],
      error: `No valid Jira issue key found${prefixNote}.`,
    };
  }

  return {
    isValid: true,
    keys,
  };
}
