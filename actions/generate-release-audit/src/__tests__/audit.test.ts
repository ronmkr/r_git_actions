import {
  extractPrNumberFromCommit,
  evaluatePrApprovalCompliance,
} from "../audit";

describe("Feature: Release Audit Evaluation", () => {
  describe("extractPrNumberFromCommit", () => {
    it("extracts PR number from merge commit message", () => {
      expect(extractPrNumberFromCommit("Merge pull request #42 from branch")).toBe(42);
    });

    it("extracts PR number from squash commit message", () => {
      expect(extractPrNumberFromCommit("feat: add new feature (#108)")).toBe(108);
    });

    it("returns null when no PR number exists", () => {
      expect(extractPrNumberFromCommit("Direct commit to branch")).toBeNull();
    });
  });

  describe("evaluatePrApprovalCompliance", () => {
    it("passes when approvers are distinct from author and committers", () => {
      const res = evaluatePrApprovalCompliance("alice", ["alice", "bob"], ["charlie", "dave"]);
      expect(res.hasViolation).toBe(false);
      expect(res.violatingApprovers).toEqual([]);
    });

    it("detects violation when PR author approves", () => {
      const res = evaluatePrApprovalCompliance("alice", ["alice"], ["alice", "charlie"]);
      expect(res.hasViolation).toBe(true);
      expect(res.violatingApprovers).toEqual(["alice"]);
    });

    it("detects violation when committer approves case-insensitively", () => {
      const res = evaluatePrApprovalCompliance("alice", ["bob"], ["BOB"]);
      expect(res.hasViolation).toBe(true);
      expect(res.violatingApprovers).toEqual(["BOB"]);
    });
  });
});
