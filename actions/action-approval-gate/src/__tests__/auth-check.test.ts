import { checkAllowedActors } from "../auth-check";

describe("Feature: Gate Actor Authorization Check", () => {
  it("permits any actor when allowed-actors is empty", () => {
    const res = checkAllowedActors("", "anyone");
    expect(res.allowed).toBe(true);
  });

  it("permits listed actor case-insensitively", () => {
    const res = checkAllowedActors("alice, Bob, Charlie", "bob");
    expect(res.allowed).toBe(true);
  });

  it("rejects unlisted actor with clear reason", () => {
    const res = checkAllowedActors("alice, bob", "mallory");
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Actor 'mallory' is not authorized");
  });
});
