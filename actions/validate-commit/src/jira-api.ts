/**
 * Feature: Jira REST API Status Validation
 * Connects to Jira Cloud or Server/Data Center to verify issue status (e.g. 'In Progress').
 */

export interface JiraApiOptions {
  baseUrl: string;
  apiToken: string;
  userEmail?: string;
  allowedStatuses?: string[];
}

export interface JiraStatusCheckResult {
  isValid: boolean;
  issueKey: string;
  status?: string;
  error?: string;
}

/**
 * Fetches the issue status from Jira REST API.
 */
export async function fetchJiraIssueStatus(
  baseUrl: string,
  issueKey: string,
  apiToken: string,
  userEmail?: string
): Promise<{ status?: string; error?: string }> {
  try {
    const cleanUrl = `${baseUrl.replace(/\/+$/, "")}/rest/api/2/issue/${issueKey}?fields=status`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "github-actions-validate-commit",
    };

    if (userEmail && userEmail.trim()) {
      // Jira Cloud: Basic Auth (email + API token)
      const creds = Buffer.from(`${userEmail.trim()}:${apiToken.trim()}`).toString("base64");
      headers["Authorization"] = `Basic ${creds}`;
    } else {
      // Jira Server / Data Center: Bearer Token
      headers["Authorization"] = `Bearer ${apiToken.trim()}`;
    }

    const response = await fetch(cleanUrl, { headers });
    if (!response.ok) {
      return { error: `Jira API returned HTTP ${response.status} for '${issueKey}'.` };
    }

    const data = (await response.json()) as any;
    const statusName = data?.fields?.status?.name;
    if (!statusName) {
      return { error: `Jira issue '${issueKey}' status not found in API response.` };
    }

    return { status: statusName };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Jira connection failed for '${issueKey}': ${msg}` };
  }
}

/**
 * Validates that an issue is in one of the allowed statuses (e.g., 'In Progress').
 */
export async function validateJiraStatus(
  issueKey: string,
  options: JiraApiOptions
): Promise<JiraStatusCheckResult> {
  const { baseUrl, apiToken, userEmail, allowedStatuses = ["In Progress", "Work In Progress", "In Development"] } = options;

  if (!baseUrl || !apiToken) {
    return {
      isValid: false,
      issueKey,
      error: "Jira base URL and API token must be provided to validate Jira status.",
    };
  }

  const { status, error } = await fetchJiraIssueStatus(baseUrl, issueKey, apiToken, userEmail);
  if (error || !status) {
    return {
      isValid: false,
      issueKey,
      error: error || `Unable to retrieve status for '${issueKey}'.`,
    };
  }

  const allowedNormalized = allowedStatuses.map((s) => s.trim().toLowerCase());
  if (!allowedNormalized.includes(status.trim().toLowerCase())) {
    return {
      isValid: false,
      issueKey,
      status,
      error: `Jira issue '${issueKey}' is in status '${status}'. Expected one of: [${allowedStatuses.join(", ")}].`,
    };
  }

  return {
    isValid: true,
    issueKey,
    status,
  };
}
