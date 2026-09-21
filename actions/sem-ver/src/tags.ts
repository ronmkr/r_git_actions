import * as github from "@actions/github";
import { parseSemVer, compareSemVer } from "./semver.js";
import type { SemVer } from "./types.js";

type OctokitClient = ReturnType<typeof github.getOctokit>;

export async function fetchLatestTag(
  octokit: OctokitClient,
  owner: string,
  repo: string
): Promise<SemVer | null> {
  const parsedTags: SemVer[] = [];

  for await (const res of octokit.paginate.iterator(octokit.rest.repos.listTags, {
    owner,
    repo,
    per_page: 100,
  })) {
    for (const item of res.data) {
      const parsed = parseSemVer(item.name);
      if (parsed) parsedTags.push(parsed);
    }
  }

  if (parsedTags.length === 0) return null;
  parsedTags.sort(compareSemVer);
  return parsedTags[0];
}

export async function createAnnotatedTag(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  tag: string,
  sha: string
): Promise<void> {
  const tagObject = await octokit.rest.git.createTag({
    owner,
    repo,
    tag,
    message: `Release ${tag}`,
    object: sha,
    type: "commit",
  });

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/tags/${tag}`,
    sha: tagObject.data.sha,
  });
}
