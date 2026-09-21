import { evaluateConventionalBump, fetchCommitMessages, cleanHeader } from "../commits";

describe("Commits Module (Conventional Commits matching validate-commit)", () => {
  describe("cleanHeader", () => {
    it("strips Jira prefix and suffix tags correctly", () => {
      expect(cleanHeader("[PROJ-123] feat: add new feature")).toBe("feat: add new feature");
      expect(cleanHeader("CORE-456: fix(auth): handle token expiry")).toBe("fix(auth): handle token expiry");
      expect(cleanHeader("chore(deps): bump typescript (PROJ-789)")).toBe("chore(deps): bump typescript");
    });
  });

  describe("evaluateConventionalBump", () => {
    it("detects BREAKING CHANGE in message body as MAJOR bump", () => {
      const messages = [
        "chore: update readme",
        "refactor: re-architect module\n\nBREAKING CHANGE: changes public API contract",
      ];
      expect(evaluateConventionalBump(messages)).toBe("major");
    });

    it("detects BREAKING-CHANGE: with hyphen as MAJOR bump", () => {
      const messages = [
        "fix: resolve race condition\n\nBREAKING-CHANGE: payload format altered",
      ];
      expect(evaluateConventionalBump(messages)).toBe("major");
    });

    it("detects '!' breaking indicator on any conventional type as MAJOR bump", () => {
      expect(evaluateConventionalBump(["feat!: drop node 18 support"])).toBe("major");
      expect(evaluateConventionalBump(["fix(auth)!: require token in headers"])).toBe("major");
      expect(evaluateConventionalBump(["refactor(core)!: redesign pipeline"])).toBe("major");
      expect(evaluateConventionalBump(["chore!: remove deprecated endpoints"])).toBe("major");
      expect(evaluateConventionalBump(["[PROJ-101] perf(db)!: change query format"])).toBe("major");
    });

    it("detects feat(...) as MINOR bump", () => {
      expect(evaluateConventionalBump(["feat: add semantic versioning action"])).toBe("minor");
      expect(evaluateConventionalBump(["feat(core): support custom regex"])).toBe("minor");
      expect(evaluateConventionalBump(["[PROJ-200] feat(api): new endpoint"])).toBe("minor");
    });

    it("detects fix, perf, refactor, and revert as PATCH bump", () => {
      expect(evaluateConventionalBump(["fix: handle null tag scenario"])).toBe("patch");
      expect(evaluateConventionalBump(["perf: optimize tag pagination"])).toBe("patch");
      expect(evaluateConventionalBump(["refactor(tags): simplify sorting"])).toBe("patch");
      expect(evaluateConventionalBump(["revert(auth): rollback broken auth commit"])).toBe("patch");
      expect(evaluateConventionalBump(["[PROJ-300] fix(core): patch memory leak"])).toBe("patch");
    });

    it("treats build, chore, ci, docs, style, test as NONE bump", () => {
      const messages = [
        "build(deps): bump @vercel/ncc from 0.44 to 0.45",
        "chore: update dependencies",
        "ci: add test step to workflow",
        "docs: fix typo in README",
        "style: format with prettier",
        "test: add unit tests for bump",
      ];
      expect(evaluateConventionalBump(messages)).toBe("none");
    });

    it("resolves bump precedence: MAJOR > MINOR > PATCH > NONE", () => {
      const patchAndChore = [
        "chore: initial setup",
        "fix: correct typo",
      ];
      expect(evaluateConventionalBump(patchAndChore)).toBe("patch");

      const withFeat = [
        ...patchAndChore,
        "feat: add export env step",
      ];
      expect(evaluateConventionalBump(withFeat)).toBe("minor");

      const withBreaking = [
        ...withFeat,
        "chore!: upgrade major dependencies",
      ];
      expect(evaluateConventionalBump(withBreaking)).toBe("major");
    });

    it("returns none for empty messages array or non-conventional commits", () => {
      expect(evaluateConventionalBump([])).toBe("none");
      expect(evaluateConventionalBump(["just a random commit message", "wip"])).toBe("none");
    });
  });

  describe("fetchCommitMessages", () => {
    it("compares commits when baseTagRef is provided", async () => {
      const compareCommitsMock = jest.fn().mockResolvedValue({
        data: {
          commits: [
            { commit: { message: "feat: add first feature" } },
            { commit: { message: "fix: fix edge case" } },
          ],
        },
      });

      const octokitMock: any = {
        rest: {
          repos: {
            compareCommits: compareCommitsMock,
          },
        },
      };

      const messages = await fetchCommitMessages(
        octokitMock,
        "test-owner",
        "test-repo",
        "v1.0.0",
        "sha123"
      );

      expect(compareCommitsMock).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        base: "v1.0.0",
        head: "sha123",
      });
      expect(messages).toEqual(["feat: add first feature", "fix: fix edge case"]);
    });

    it("falls back to listCommits when baseTagRef is empty", async () => {
      const listCommitsMock = jest.fn().mockResolvedValue({
        data: [
          { commit: { message: "feat: initial commit" } },
          { commit: { message: "chore: add license" } },
        ],
      });

      const octokitMock: any = {
        rest: {
          repos: {
            listCommits: listCommitsMock,
          },
        },
      };

      const messages = await fetchCommitMessages(
        octokitMock,
        "test-owner",
        "test-repo",
        "",
        "sha123"
      );

      expect(listCommitsMock).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        sha: "sha123",
        per_page: 100,
      });
      expect(messages).toEqual(["feat: initial commit", "chore: add license"]);
    });
  });
});
