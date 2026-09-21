import { fetchJiraIssueStatus, validateJiraStatus } from "../jira-api";

describe("Feature: Jira REST API Status Validation", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetches status successfully via REST API", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        fields: { status: { name: "In Progress" } },
      }),
    } as any);

    const res = await fetchJiraIssueStatus("https://example.atlassian.net", "PROJ-123", "token", "user@test.com");
    expect(res.status).toBe("In Progress");
    expect(res.error).toBeUndefined();
  });

  it("handles HTTP errors gracefully", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as any);

    const res = await fetchJiraIssueStatus("https://example.atlassian.net", "PROJ-404", "token");
    expect(res.status).toBeUndefined();
    expect(res.error).toContain("404");
  });

  it("passes validation when Jira status matches allowed list", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        fields: { status: { name: "In Progress" } },
      }),
    } as any);

    const res = await validateJiraStatus("PROJ-123", {
      baseUrl: "https://example.atlassian.net",
      apiToken: "secret",
      allowedStatuses: ["In Progress", "Work In Progress"],
    });

    expect(res.isValid).toBe(true);
    expect(res.status).toBe("In Progress");
  });

  it("fails validation when Jira status is Open or To Do", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        fields: { status: { name: "To Do" } },
      }),
    } as any);

    const res = await validateJiraStatus("PROJ-123", {
      baseUrl: "https://example.atlassian.net",
      apiToken: "secret",
      allowedStatuses: ["In Progress"],
    });

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("cannot be Open/To-Do");
  });

  it("fails validation when Jira status is Open even if included in custom allowed statuses", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        fields: { status: { name: "Open" } },
      }),
    } as any);

    const res = await validateJiraStatus("PROJ-123", {
      baseUrl: "https://example.atlassian.net",
      apiToken: "secret",
      allowedStatuses: ["Open", "In Progress"],
    });

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("disallowed state 'Open'");
  });

  it("respects custom disallowed-jira-statuses variable", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        fields: { status: { name: "Draft" } },
      }),
    } as any);

    const res = await validateJiraStatus("PROJ-123", {
      baseUrl: "https://example.atlassian.net",
      apiToken: "secret",
      allowedStatuses: ["In Progress", "Draft"],
      disallowedStatuses: ["Draft", "Blocked"],
    });

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("disallowed state 'Draft'");
  });
});
