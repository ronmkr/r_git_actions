import { postStrategyComment, STRATEGY_COMMENT_TAG } from "../comment";

describe("Feature: PR Strategy Feedback Comment", () => {
  it("creates a new comment on PR when no existing comment is found", async () => {
    const mockListComments = jest.fn().mockResolvedValue({ data: [] });
    const mockCreateComment = jest.fn().mockResolvedValue({ data: { id: 301 } });
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

    await postStrategyComment(mockOctokit, "owner", "repo", 42, {
      strategyConfig: {
        name: "gitops",
        branches: ["dev", "uat", "prod"],
        defaultBranch: "dev",
        requiredApprovals: 2,
      },
      rulesetResult: {
        id: 99,
        name: "Strategy: GITOPS",
        action: "created",
        branches: ["dev", "uat", "prod"],
      },
      createdBranches: ["uat", "prod"],
      enforceProtection: true,
      requiredApprovals: 2,
    });

    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        issue_number: 42,
        body: expect.stringContaining(STRATEGY_COMMENT_TAG),
      })
    );
    expect(mockUpdateComment).not.toHaveBeenCalled();
  });

  it("updates existing comment in-place without duplicate comments", async () => {
    const mockListComments = jest.fn().mockResolvedValue({
      data: [{ id: 77, body: `${STRATEGY_COMMENT_TAG}\nOld strategy comment` }],
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

    await postStrategyComment(mockOctokit, "owner", "repo", 42, {
      strategyConfig: {
        name: "gitflow",
        branches: ["main", "develop"],
        defaultBranch: "develop",
        requiredApprovals: 2,
      },
      rulesetResult: {
        id: 42,
        name: "Strategy: GITFLOW",
        action: "updated",
        branches: ["main", "develop"],
      },
      createdBranches: [],
      enforceProtection: true,
      requiredApprovals: 2,
    });

    expect(mockUpdateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        comment_id: 77,
        body: expect.stringContaining(STRATEGY_COMMENT_TAG),
      })
    );
    expect(mockCreateComment).not.toHaveBeenCalled();
  });
});
