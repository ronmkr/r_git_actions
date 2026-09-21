import { upsertRepoRuleset, buildRulesetPayload } from "../ruleset-manager";

describe("Feature: Repository Ruleset Manager", () => {
  const defaultOptions = {
    requiredApprovals: 2,
    dismissStaleReviews: true,
    requireLinearHistory: true,
  };

  it("builds a declarative JSON ruleset blueprint with flag overrides", () => {
    const payload = buildRulesetPayload("Strategy: TRUNK-BASED", ["main"], {
      requiredApprovals: 3,
      dismissStaleReviews: true,
      requireLinearHistory: true,
      requireSignedCommits: true,
      blockDeletion: true,
      blockForcePush: true,
    });

    expect(payload.name).toBe("Strategy: TRUNK-BASED");
    expect(payload.target).toBe("branch");
    expect(payload.enforcement).toBe("active");
    expect(payload.conditions.ref_name.include).toEqual(["refs/heads/main"]);

    // Verify rules JSON array
    expect(payload.rules).toContainEqual({ type: "deletion" });
    expect(payload.rules).toContainEqual({ type: "non_fast_forward" });
    expect(payload.rules).toContainEqual({ type: "required_linear_history" });
    expect(payload.rules).toContainEqual({ type: "required_signatures" });

    const prRule = payload.rules.find((r) => r.type === "pull_request");
    expect(prRule?.parameters.required_approving_review_count).toBe(3);
  });

  it("creates a new ruleset when no existing matching ruleset is found", () => {
    const mockRequest = jest.fn().mockImplementation((route: string) => {
      if (route === "GET /repos/{owner}/{repo}/rulesets") {
        return Promise.resolve({ data: [] });
      }
      if (route === "POST /repos/{owner}/{repo}/rulesets") {
        return Promise.resolve({
          data: {
            id: 99,
            name: "Strategy: GITOPS",
            target: "branch",
            enforcement: "active",
          },
        });
      }
      if (route === "PATCH /repos/{owner}/{repo}") {
        return Promise.resolve({ data: { delete_branch_on_merge: true } });
      }
      return Promise.reject(new Error(`Unexpected route ${route}`));
    });

    const mockOctokit = { request: mockRequest } as any;

    return upsertRepoRuleset(
      mockOctokit,
      "test-owner",
      "test-repo",
      "Strategy: GITOPS",
      ["dev", "uat", "prod"],
      defaultOptions
    ).then((result) => {
      expect(result.action).toBe("created");
      expect(result.id).toBe(99);
      expect(result.name).toBe("Strategy: GITOPS");
      expect(mockRequest).toHaveBeenCalledWith(
        "GET /repos/{owner}/{repo}/rulesets",
        expect.objectContaining({ owner: "test-owner", repo: "test-repo" })
      );
      expect(mockRequest).toHaveBeenCalledWith(
        "POST /repos/{owner}/{repo}/rulesets",
        expect.objectContaining({
          owner: "test-owner",
          repo: "test-repo",
          name: "Strategy: GITOPS",
          conditions: {
            ref_name: {
              include: ["refs/heads/dev", "refs/heads/uat", "refs/heads/prod"],
              exclude: [],
            },
          },
        })
      );
    });
  });

  it("updates existing ruleset in-place without creating duplicates", () => {
    const mockRequest = jest.fn().mockImplementation((route: string) => {
      if (route === "GET /repos/{owner}/{repo}/rulesets") {
        return Promise.resolve({
          data: [
            { id: 42, name: "Strategy: GITFLOW", target: "branch", enforcement: "active" },
            { id: 10, name: "Lint Checks", target: "branch", enforcement: "active" },
          ],
        });
      }
      if (route === "PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}") {
        return Promise.resolve({
          data: {
            id: 42,
            name: "Strategy: GITFLOW",
            target: "branch",
            enforcement: "active",
          },
        });
      }
      if (route === "PATCH /repos/{owner}/{repo}") {
        return Promise.resolve({ data: { delete_branch_on_merge: true } });
      }
      return Promise.reject(new Error(`Unexpected route ${route}`));
    });

    const mockOctokit = { request: mockRequest } as any;

    return upsertRepoRuleset(
      mockOctokit,
      "test-owner",
      "test-repo",
      "Strategy: GITFLOW",
      ["main", "develop"],
      defaultOptions
    ).then((result) => {
      expect(result.action).toBe("updated");
      expect(result.id).toBe(42);
      expect(mockRequest).toHaveBeenCalledWith(
        "PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}",
        expect.objectContaining({
          owner: "test-owner",
          repo: "test-repo",
          ruleset_id: 42,
          conditions: {
            ref_name: {
              include: ["refs/heads/main", "refs/heads/develop"],
              exclude: [],
            },
          },
        })
      );
    });
  });

  it("enforces delete_branch_on_merge=true on repository setting alongside ruleset creation", async () => {
    const mockRequest = jest.fn().mockImplementation((route: string) => {
      if (route === "GET /repos/{owner}/{repo}/rulesets") {
        return Promise.resolve({ data: [] });
      }
      if (route === "POST /repos/{owner}/{repo}/rulesets") {
        return Promise.resolve({
          data: { id: 100, name: "Strategy: TRUNK-BASED", target: "branch", enforcement: "active" },
        });
      }
      if (route === "PATCH /repos/{owner}/{repo}") {
        return Promise.resolve({ data: { delete_branch_on_merge: true } });
      }
      return Promise.reject(new Error(`Unexpected route ${route}`));
    });

    const mockOctokit = { request: mockRequest } as any;

    const result = await upsertRepoRuleset(
      mockOctokit,
      "test-owner",
      "test-repo",
      "Strategy: TRUNK-BASED",
      ["main"],
      { ...defaultOptions, autoDeleteHeadBranches: true }
    );

    expect(result.id).toBe(100);
    expect(mockRequest).toHaveBeenCalledWith(
      "PATCH /repos/{owner}/{repo}",
      expect.objectContaining({
        owner: "test-owner",
        repo: "test-repo",
        delete_branch_on_merge: true,
      })
    );
  });

  it("skips delete_branch_on_merge when autoDeleteHeadBranches is false", async () => {
    const mockRequest = jest.fn().mockImplementation((route: string) => {
      if (route === "GET /repos/{owner}/{repo}/rulesets") {
        return Promise.resolve({ data: [] });
      }
      if (route === "POST /repos/{owner}/{repo}/rulesets") {
        return Promise.resolve({
          data: { id: 101, name: "Strategy: CUSTOM", target: "branch", enforcement: "active" },
        });
      }
      return Promise.reject(new Error(`Unexpected route ${route}`));
    });

    const mockOctokit = { request: mockRequest } as any;

    const result = await upsertRepoRuleset(
      mockOctokit,
      "test-owner",
      "test-repo",
      "Strategy: CUSTOM",
      ["main"],
      { ...defaultOptions, autoDeleteHeadBranches: false }
    );

    expect(result.id).toBe(101);
    expect(mockRequest).not.toHaveBeenCalledWith(
      "PATCH /repos/{owner}/{repo}",
      expect.anything()
    );
  });
});
