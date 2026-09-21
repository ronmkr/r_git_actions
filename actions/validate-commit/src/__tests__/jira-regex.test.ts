import { extractJiraKeys, validateJiraRegex } from "../jira-regex";

describe("Feature: Jira Regex Validation", () => {
  it("extracts standard Jira keys", () => {
    const msg = "[PROJ-123] feat: add login button (see CORE-456)";
    expect(extractJiraKeys(msg)).toEqual(["PROJ-123", "CORE-456"]);
  });

  it("filters by project keys prefix", () => {
    const msg = "PROJ-101 and OTHER-202";
    expect(extractJiraKeys(msg, ["PROJ"])).toEqual(["PROJ-101"]);
  });

  it("supports custom regex pattern", () => {
    const msg = "Resolves #TICKET-999";
    expect(extractJiraKeys(msg, undefined, "#TICKET-[0-9]+")).toEqual(["#TICKET-999"]);
  });

  it("validates commit message with valid Jira key", () => {
    const result = validateJiraRegex("[PROJ-100] Updated configuration");
    expect(result.isValid).toBe(true);
    expect(result.keys).toEqual(["PROJ-100"]);
    expect(result.error).toBeUndefined();
  });

  it("fails when Jira key is missing", () => {
    const result = validateJiraRegex("Updated configuration without ticket");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("No valid Jira issue key found");
  });
});
