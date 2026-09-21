import { ensureBranchExists } from "../branch-manager";

describe("Feature: Branch Manager", () => {
  const mockGetRef = jest.fn();
  const mockCreateRef = jest.fn();

  const mockOctokit = {
    rest: {
      git: {
        getRef: mockGetRef,
        createRef: mockCreateRef,
      },
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns existing status when branch is already present", async () => {
    mockGetRef.mockResolvedValueOnce({
      data: {
        object: { sha: "abc1234567" },
      },
    });

    const result = await ensureBranchExists(mockOctokit, "owner", "repo", "develop", "main");

    expect(result.branch).toBe("develop");
    expect(result.created).toBe(false);
    expect(result.sha).toBe("abc1234567");
    expect(mockCreateRef).not.toHaveBeenCalled();
  });

  it("creates missing branch pointing to base branch SHA", async () => {
    // 1st call: heads/dev -> 404 (not found)
    mockGetRef.mockRejectedValueOnce({ status: 404, message: "Not Found" });
    // 2nd call: heads/main -> found with base SHA
    mockGetRef.mockResolvedValueOnce({
      data: {
        object: { sha: "base_sha_999" },
      },
    });
    // createRef succeeds
    mockCreateRef.mockResolvedValueOnce({
      data: {
        object: { sha: "base_sha_999" },
      },
    });

    const result = await ensureBranchExists(mockOctokit, "owner", "repo", "dev", "main");

    expect(result.branch).toBe("dev");
    expect(result.created).toBe(true);
    expect(result.sha).toBe("base_sha_999");
    expect(mockCreateRef).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      ref: "refs/heads/dev",
      sha: "base_sha_999",
    });
  });

  it("returns error if base branch is not found", async () => {
    // 1st call: heads/dev -> 404
    mockGetRef.mockRejectedValueOnce({ status: 404, message: "Not Found" });
    // 2nd call: heads/main -> 404
    mockGetRef.mockRejectedValueOnce({ status: 404, message: "Base Not Found" });

    const result = await ensureBranchExists(mockOctokit, "owner", "repo", "dev", "main");

    expect(result.created).toBe(false);
    expect(result.error).toContain("base branch 'main' was not found");
    expect(mockCreateRef).not.toHaveBeenCalled();
  });
});
