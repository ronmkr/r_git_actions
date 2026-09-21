import { validateConventionalCommit } from "../conventional-commit";

describe("Feature: Conventional Commits Validation", () => {
  it("passes standard valid conventional commit formats", () => {
    const valid = [
      "feat: add new feature",
      "fix(core): handle edge case",
      "chore(deps): update dependencies",
      "docs: update README with API keys",
      "refactor!: redesign database model",
      "test(unit): add coverage",
      "ci: configure workflow",
    ];

    for (const msg of valid) {
      const res = validateConventionalCommit(msg);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    }
  });

  it("passes when Jira tag is prefixed or suffixed", () => {
    const valid = [
      "[PROJ-123] feat: add user profile",
      "PROJ-123: fix(auth): session expiration",
      "feat: add export functionality (PROJ-999)",
    ];

    for (const msg of valid) {
      const res = validateConventionalCommit(msg);
      expect(res.isValid).toBe(true);
    }
  });

  it("passes when custom Jira regex pattern is prefixed or suffixed", () => {
    const customRegex = "[A-Z]{3,4}_[0-9]+";
    const valid = [
      "[PROJ_123] feat: add user profile",
      "CORE_456: fix(auth): session expiration",
      "feat: add export functionality (PROJ_999)",
    ];

    for (const msg of valid) {
      const res = validateConventionalCommit(msg, customRegex);
      expect(res.isValid).toBe(true);
    }
  });

  it("fails when commit does not match conventional format", () => {
    const invalid = [
      "Fixed bug in auth",
      "WIP: working on payments",
      "Update README.md",
      "random message",
    ];

    for (const msg of invalid) {
      const res = validateConventionalCommit(msg);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("does not follow Conventional Commits format");
    }
  });
});
