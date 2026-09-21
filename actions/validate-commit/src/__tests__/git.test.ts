import { getPrCommits } from "../git";
import * as github from "@actions/github";

jest.mock("@actions/github");

describe("Feature: Git Commit Extractor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns explicit commit message if provided", async () => {
    const commits = await getPrCommits({
      explicitMessage: "[PROJ-1] Custom commit message",
    });

    expect(commits).toEqual([{ message: "[PROJ-1] Custom commit message" }]);
  });

  it("fetches all commits in that PR via GitHub API pagination", async () => {
    (github as any).context = {
      eventName: "pull_request",
      repo: { owner: "ronmkr", repo: "test-repo" },
      payload: {
        pull_request: {
          number: 12,
          title: "PR Title",
        },
      },
    };

    const mockPaginate = jest.fn().mockResolvedValue([
      { sha: "abc1234567890", commit: { message: "[PROJ-10] First commit in PR" } },
      { sha: "def4567890123", commit: { message: "[PROJ-20] Second commit in PR" } },
      { sha: "7890123456abc", commit: { message: "[PROJ-30] Third commit in PR" } },
    ]);

    (github.getOctokit as jest.Mock).mockReturnValue({
      paginate: mockPaginate,
      rest: {
        pulls: {
          listCommits: {},
        },
      },
    });

    const commits = await getPrCommits({
      githubToken: "fake_token",
    });

    expect(mockPaginate).toHaveBeenCalledTimes(1);
    expect(commits).toHaveLength(3);
    expect(commits[0]).toEqual({ sha: "abc1234", message: "[PROJ-10] First commit in PR" });
    expect(commits[1]).toEqual({ sha: "def4567", message: "[PROJ-20] Second commit in PR" });
    expect(commits[2]).toEqual({ sha: "7890123", message: "[PROJ-30] Third commit in PR" });
  });

  it("extracts commits from push event payload", async () => {
    (github as any).context = {
      eventName: "push",
      payload: {
        commits: [
          { id: "111222333", message: "[PROJ-1] Push commit 1" },
          { id: "444555666", message: "[PROJ-2] Push commit 2" },
        ],
      },
    };

    const commits = await getPrCommits({});
    expect(commits).toHaveLength(2);
    expect(commits[0]).toEqual({ sha: "1112223", message: "[PROJ-1] Push commit 1" });
    expect(commits[1]).toEqual({ sha: "4445556", message: "[PROJ-2] Push commit 2" });
  });
});
