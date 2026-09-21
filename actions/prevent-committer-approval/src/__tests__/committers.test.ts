import { getPrCommitters } from "../committers";

describe("Feature: PR Committers and Author Extractor", () => {
  it("includes PR author even if PR has no commits yet", async () => {
    const mockOctokit = {
      paginate: jest.fn().mockResolvedValue([]),
      rest: {
        pulls: {
          listCommits: {},
        },
      },
    } as any;

    const committers = await getPrCommitters(mockOctokit, "owner", "repo", 1, "alice");

    expect(committers.has("alice")).toBe(true);
    expect(committers.get("alice")?.isPrAuthor).toBe(true);
  });

  it("extracts distinct commit authors and committers with commit counts", async () => {
    const mockCommits = [
      {
        author: { login: "bob" },
        committer: { login: "bob" },
      },
      {
        author: { login: "charlie" },
        committer: { login: "github-actions[bot]" },
      },
      {
        author: { login: "bob" },
        committer: { login: "bob" },
      },
    ];

    const mockOctokit = {
      paginate: jest.fn().mockResolvedValue(mockCommits),
      rest: { pulls: { listCommits: {} } },
    } as any;

    const committers = await getPrCommitters(mockOctokit, "owner", "repo", 42, "alice");

    expect(committers.size).toBe(4);
    expect(committers.has("alice")).toBe(true);
    expect(committers.has("bob")).toBe(true);
    expect(committers.get("bob")?.commitCount).toBe(2);
    expect(committers.has("charlie")).toBe(true);
    expect(committers.has("github-actions[bot]")).toBe(true);
  });
});
