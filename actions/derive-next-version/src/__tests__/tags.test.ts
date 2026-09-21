import { fetchLatestTag } from "../tags";

describe("Tags Module", () => {
  it("fetches the latest valid SemVer tag by creation time from local git", () => {
    const mockGit = () => [
      "latest",
      "v1.2.0", // latest creation
      "v2.0.0", // older creation
      "v1.0.0",
    ];

    const latest = fetchLatestTag(mockGit);
    expect(latest).toEqual({
      tagName: "v1.2.0",
      raw: "1.2.0",
      major: 1,
      minor: 2,
      patch: 0,
    });
  });

  it("returns null when no valid SemVer tags exist", () => {
    const mockGit = () => ["beta", "rc-1", "nightly"];
    const latest = fetchLatestTag(mockGit);
    expect(latest).toBeNull();
  });

  it("returns null for empty tag lists", () => {
    const mockGit = () => [];
    const latest = fetchLatestTag(mockGit);
    expect(latest).toBeNull();
  });
});
