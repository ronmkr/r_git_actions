import { getActiveApprovals } from "../reviews";

describe("Feature: PR Reviews Extractor", () => {
  it("resolves active approvals and filters out changes requested or dismissed reviews", async () => {
    const mockReviews = [
      // Dave approved
      { id: 101, user: { login: "dave", type: "User" }, state: "APPROVED", submitted_at: "2026-09-01T10:00:00Z" },
      // Eve approved then requested changes (latest state: CHANGES_REQUESTED)
      { id: 102, user: { login: "eve", type: "User" }, state: "APPROVED", submitted_at: "2026-09-01T10:05:00Z" },
      { id: 103, user: { login: "eve", type: "User" }, state: "CHANGES_REQUESTED", submitted_at: "2026-09-01T10:10:00Z" },
      // Frank requested changes then approved (latest state: APPROVED)
      { id: 104, user: { login: "frank", type: "User" }, state: "CHANGES_REQUESTED", submitted_at: "2026-09-01T10:15:00Z" },
      { id: 105, user: { login: "frank", type: "User" }, state: "APPROVED", submitted_at: "2026-09-01T10:20:00Z" },
      // Grace's approval was previously dismissed
      { id: 106, user: { login: "grace", type: "User" }, state: "APPROVED", submitted_at: "2026-09-01T10:25:00Z" },
      { id: 107, user: { login: "grace", type: "User" }, state: "DISMISSED", submitted_at: "2026-09-01T10:30:00Z" },
    ];

    const mockOctokit = {
      paginate: jest.fn().mockResolvedValue(mockReviews),
      rest: { pulls: { listReviews: {} } },
    } as any;

    const approvals = await getActiveApprovals(mockOctokit, "owner", "repo", 42);

    expect(approvals).toHaveLength(2);
    const logins = approvals.map((a) => a.reviewerLogin);
    expect(logins).toContain("dave");
    expect(logins).toContain("frank");
    expect(logins).not.toContain("eve");
    expect(logins).not.toContain("grace");
  });

  it("filters out bot reviewers when excludeBots is true", async () => {
    const mockReviews = [
      { id: 201, user: { login: "security-bot[bot]", type: "Bot" }, state: "APPROVED", submitted_at: "2026-09-01T10:00:00Z" },
      { id: 202, user: { login: "dave", type: "User" }, state: "APPROVED", submitted_at: "2026-09-01T10:05:00Z" },
    ];

    const mockOctokit = {
      paginate: jest.fn().mockResolvedValue(mockReviews),
      rest: { pulls: { listReviews: {} } },
    } as any;

    const approvals = await getActiveApprovals(mockOctokit, "owner", "repo", 42, true);

    expect(approvals).toHaveLength(1);
    expect(approvals[0].reviewerLogin).toBe("dave");
  });
});
