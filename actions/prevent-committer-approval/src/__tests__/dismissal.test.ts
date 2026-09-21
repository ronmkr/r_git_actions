import { dismissCommitterApprovals } from "../dismissal";
import { CommitterInfo } from "../committers";
import { ActiveApproval } from "../reviews";

describe("Feature: Non-Compliant Review Dismissal Manager", () => {
  it("dismisses reviews submitted by PR authors or committers", async () => {
    const mockDismiss = jest.fn().mockResolvedValue({});
    const mockOctokit = {
      rest: {
        pulls: {
          dismissReview: mockDismiss,
        },
      },
    } as any;

    const committers = new Map<string, CommitterInfo>([
      ["alice", { login: "Alice", isPrAuthor: true, commitCount: 0 }],
      ["bob", { login: "bob", isPrAuthor: false, commitCount: 3 }],
    ]);

    const approvals: ActiveApproval[] = [
      { reviewId: 10, reviewerLogin: "Alice" }, // Author
      { reviewId: 20, reviewerLogin: "bob" },   // Committer
      { reviewId: 30, reviewerLogin: "charlie" } // Independent reviewer
    ];

    const results = await dismissCommitterApprovals(
      mockOctokit,
      "owner",
      "repo",
      123,
      approvals,
      committers,
      "Self-approvals are prohibited"
    );

    expect(results).toHaveLength(2);
    expect(results[0].reviewerLogin).toBe("Alice");
    expect(results[0].dismissed).toBe(true);
    expect(results[1].reviewerLogin).toBe("bob");
    expect(results[1].dismissed).toBe(true);

    expect(mockDismiss).toHaveBeenCalledTimes(2);
    expect(mockDismiss).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 123,
      review_id: 10,
      message: expect.stringContaining("Self-approvals are prohibited"),
    });
    expect(mockDismiss).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 123,
      review_id: 20,
      message: expect.stringContaining("Self-approvals are prohibited"),
    });
  });

  it("handles dismissal API errors gracefully", async () => {
    const mockDismiss = jest.fn().mockRejectedValue(new Error("Integration lacks write permissions"));
    const mockOctokit = {
      rest: { pulls: { dismissReview: mockDismiss } },
    } as any;

    const committers = new Map<string, CommitterInfo>([
      ["alice", { login: "Alice", isPrAuthor: true, commitCount: 1 }],
    ]);

    const approvals: ActiveApproval[] = [{ reviewId: 99, reviewerLogin: "Alice" }];

    const results = await dismissCommitterApprovals(
      mockOctokit,
      "owner",
      "repo",
      123,
      approvals,
      committers,
      "Self-approval policy"
    );

    expect(results).toHaveLength(1);
    expect(results[0].dismissed).toBe(false);
    expect(results[0].error).toContain("Integration lacks write permissions");
  });
});
