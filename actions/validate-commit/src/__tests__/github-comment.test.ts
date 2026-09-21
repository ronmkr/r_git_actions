import { buildPrCommentBody, postOrUpdatePrComment, PR_COMMENT_TAG } from "../github-comment";
import * as github from "@actions/github";

jest.mock("@actions/github");

describe("Feature: GitHub PR Commenting", () => {
  const mockCreateComment = jest.fn().mockResolvedValue({ data: { id: 101 } });
  const mockUpdateComment = jest.fn().mockResolvedValue({ data: { id: 102 } });
  const mockListComments = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (github.getOctokit as jest.Mock).mockReturnValue({
      rest: {
        issues: {
          listComments: mockListComments,
          createComment: mockCreateComment,
          updateComment: mockUpdateComment,
        },
      },
    });
  });

  it("builds an informative error comment with guidelines", () => {
    const body = buildPrCommentBody(
      false,
      ["Commit #1: No valid Jira issue key found."],
      { requireJira: true, checkConventional: true, allowedStatuses: ["In Progress"] }
    );

    expect(body).toContain(PR_COMMENT_TAG);
    expect(body).toContain("Commit Validation Failed");
    expect(body).toContain("No valid Jira issue key found");
    expect(body).toContain("Conventional Commits");
    expect(body).toContain("In Progress");
  });

  it("builds a success comment when validation passes", () => {
    const body = buildPrCommentBody(true, [], { requireJira: true, checkConventional: false });
    expect(body).toContain(PR_COMMENT_TAG);
    expect(body).toContain("Commit Validation Passed");
  });

  it("posts a new comment when no existing bot comment is found", async () => {
    mockListComments.mockResolvedValue({ data: [] });

    await postOrUpdatePrComment({
      githubToken: "fake_token",
      owner: "ronmkr",
      repo: "my-repo",
      pullNumber: 1,
      isValid: false,
      errors: ["Missing Jira key"],
      guidelines: { requireJira: true, checkConventional: false },
    });

    expect(mockCreateComment).toHaveBeenCalledTimes(1);
    expect(mockUpdateComment).not.toHaveBeenCalled();
  });

  it("updates an existing bot comment rather than creating duplicates", async () => {
    mockListComments.mockResolvedValue({
      data: [{ id: 45, body: `${PR_COMMENT_TAG}\nOld comment` }],
    });

    await postOrUpdatePrComment({
      githubToken: "fake_token",
      owner: "ronmkr",
      repo: "my-repo",
      pullNumber: 1,
      isValid: false,
      errors: ["Still missing Jira key"],
      guidelines: { requireJira: true, checkConventional: false },
    });

    expect(mockUpdateComment).toHaveBeenCalledTimes(1);
    expect(mockCreateComment).not.toHaveBeenCalled();
  });
});
