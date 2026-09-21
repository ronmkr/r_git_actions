import { checkAllowedActors } from "../auth-check";

describe("Feature: Actor Authorization Check", () => {
  it("allows all actors when no restrictions are configured", () => {
    const res = checkAllowedActors("", "octocat");
    expect(res.allowed).toBe(true);
    expect(res.allowedActors).toHaveLength(0);
  });

  it("permits allowed actor matching case-insensitively", () => {
    const res = checkAllowedActors("ronmkr, Alice, Bob-Lead", "alice");
    expect(res.allowed).toBe(true);
    expect(res.allowedActors).toEqual(["ronmkr", "alice", "bob-lead"]);
  });

  it("rejects unauthorized actors with reason", () => {
    const res = checkAllowedActors("ronmkr, devops-team", "attacker");
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Actor 'attacker' is not authorized");
  });
});
