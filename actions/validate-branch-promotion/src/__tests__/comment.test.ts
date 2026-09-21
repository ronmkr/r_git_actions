import { postPromotionComment, PROMOTION_COMMENT_TAG } from "../comment";

describe("Feature: PR Promotion Feedback Comment", () => {
  it("creates a new comment on PR when no existing comment is found", async () => {
    const mockListComments = jest.fn().mockResolvedValue({ data: [] });
    const mockCreateComment = jest.fn().mockResolvedValue({ data: { id: 101 } });
    const mockUpdateComment = jest.fn().mockResolvedValue({});

    const mockOctokit = {
      rest: {
        issues: {
          listComments: mockListComments,
          createComment: mockCreateComment,
          updateComment: mockUpdateComment,
        },
      },
    } as any;

    await postPromotionComment(mockOctokit, "owner", "repo", 20, {
      valid: false,
      strategy: "gitops",
      baseBranch: "prd",
      headBranch: "dev",
      allowedSources: ["uat"],
      error: "Skipped uat",
    });

    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        issue_number: 20,
        body: expect.stringContaining(PROMOTION_COMMENT_TAG),
      })
    );
    expect(mockUpdateComment).not.toHaveBeenCalled();
  });

  it("updates existing comment in-place without duplicate comments", async () => {
    const mockListComments = jest.fn().mockResolvedValue({
      data: [{ id: 88, body: `${PROMOTION_COMMENT_TAG}\nPrevious promotion failure` }],
    });
    const mockCreateComment = jest.fn().mockResolvedValue({});
    const mockUpdateComment = jest.fn().mockResolvedValue({});

    const mockOctokit = {
      rest: {
        issues: {
          listComments: mockListComments,
          createComment: mockCreateComment,
          updateComment: mockUpdateComment,
        },
      },
    } as any;

    await postPromotionComment(mockOctokit, "owner", "repo", 20, {
      valid: false,
      strategy: "gitops",
      baseBranch: "uat",
      headBranch: "feature/foo",
      allowedSources: ["dev"],
      error: "Only dev can merge to uat",
    });

    expect(mockUpdateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        comment_id: 88,
        body: expect.stringContaining(PROMOTION_COMMENT_TAG),
      })
    );
    expect(mockCreateComment).not.toHaveBeenCalled();
  });

  it("resolves existing comment when promotion flow is now compliant", async () => {
    const mockListComments = jest.fn().mockResolvedValue({
      data: [{ id: 88, body: `${PROMOTION_COMMENT_TAG}\nPrevious promotion failure` }],
    });
    const mockCreateComment = jest.fn().mockResolvedValue({});
    const mockUpdateComment = jest.fn().mockResolvedValue({});

    const mockOctokit = {
      rest: {
        issues: {
          listComments: mockListComments,
          createComment: mockCreateComment,
          updateComment: mockUpdateComment,
        },
      },
    } as any;

    await postPromotionComment(mockOctokit, "owner", "repo", 20, {
      valid: true,
      strategy: "gitops",
      baseBranch: "uat",
      headBranch: "dev",
      allowedSources: ["dev"],
    });

    expect(mockUpdateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        comment_id: 88,
        body: expect.stringContaining("Branch Promotion Policy Compliant"),
      })
    );
    expect(mockCreateComment).not.toHaveBeenCalled();
  });
});
