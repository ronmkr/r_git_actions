export const DEFAULT_JIRA_REGEX = /\b([A-Z][A-Z0-9]+-[0-9]+)\b/g;

export function extractJiraKeys(text: string, projectKeys?: string[]): string[] {
  const matches = text.match(DEFAULT_JIRA_REGEX) || [];
  const unique = Array.from(new Set(matches));

  if (!projectKeys || projectKeys.length === 0) return unique;

  const allowedPrefixes = projectKeys.map((k) => k.trim().toUpperCase());
  return unique.filter((key) => allowedPrefixes.includes(key.split("-")[0]?.toUpperCase()));
}
