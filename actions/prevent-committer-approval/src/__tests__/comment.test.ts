import { postDismissalComment, DISMISSAL_COMMENT_TAG } from "../comment";

describe("Feature: PR Dismissal Feedback Comment", () => {
  it("creates a new comment when no existing governance comment is found", async () => {
    const mockListComments = jest.fn().mockResolvedValue({ data: [] });
    const mockCreateComment = jest.fn().mockResolvedValue({ data: { id: 501 } });
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

    await postDismissalComment(mockOctokit, "owner", "repo", 55, [
      {
        reviewId: 10,
        reviewerLogin: "alice",
        isPrAuthor: true,
        commitCount: 0,
        dismissed: true,
      },
    ]);

    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        issue_number: 55,
        body: expect.stringContaining(DISMISSAL_COMMENT_TAG),
      })
    );
    expect(mockUpdateComment).not.toHaveBeenCalled();
  });

  it("updates existing comment in-place without creating duplicate comments", async () => {
    const mockListComments = jest.fn().mockResolvedValue({
      data: [
        { id: 100, body: "Standard PR comment" },
        { id: 200, body: `${DISMISSAL_COMMENT_TAG}\nOld governance warning` },
      ],
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

    await postDismissalComment(mockOctokit, "owner", "repo", 55, [
      {
        reviewId: 20,
        reviewerLogin: "bob",
        isPrAuthor: false,
        commitCount: 4,
        dismissed: true,
      },
    ]);

    expect(mockUpdateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        comment_id: 200,
        body: expect.stringContaining(DISMISSAL_COMMENT_TAG),
      })
    );
    expect(mockCreateComment).not.toHaveBeenCalled();
  });

  it("resolves existing comment when PR is now compliant", async () => {
    const mockListComments = jest.fn().mockResolvedValue({
      data: [{ id: 200, body: `${DISMISSAL_COMMENT_TAG}\nOld governance warning` }],
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

    await postDismissalComment(mockOctokit, "owner", "repo", 55, [], false);

    expect(mockUpdateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        comment_id: 200,
        body: expect.stringContaining("Independent Code Review Verified"),
      })
    );
    expect(mockCreateComment).not.toHaveBeenCalled();
  });
});
