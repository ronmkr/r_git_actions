import { extractJiraKeys } from "../jira";

describe("Feature: Jira Key Extraction", () => {
  it("extracts multiple standard Jira keys", () => {
    const text = "feat: add user profile [PROJ-123] and PROJ-456 (CORE-999)";
    expect(extractJiraKeys(text)).toEqual(["PROJ-123", "PROJ-456", "CORE-999"]);
  });

  it("filters keys by project prefix", () => {
    const text = "Fix issue PROJ-101 and OTHER-202";
    expect(extractJiraKeys(text, ["PROJ"])).toEqual(["PROJ-101"]);
  });

  it("deduplicates keys", () => {
    const text = "PROJ-100 commit 1, PROJ-100 commit 2";
    expect(extractJiraKeys(text)).toEqual(["PROJ-100"]);
  });
});
