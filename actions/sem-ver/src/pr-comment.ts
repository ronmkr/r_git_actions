import * as github from "@actions/github";
import type { VersionResolution } from "./types.js";

type OctokitClient = ReturnType<typeof github.getOctokit>;

const HIDDEN_COMMENT_TAG = "<!-- semver-version-action-reconcile-marker -->";

export async function reconcilePrComment(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  issueNumber: number,
  resolution: VersionResolution
): Promise<void> {
  const body = [
    HIDDEN_COMMENT_TAG,
    `### 🏷️ SemVer 2.0 Proposed Release`,
    `| Attribute | Value |`,
    `| :--- | :--- |`,
    `| **Previous Version** | \`${resolution.previousVersion || "None"}\` |`,
    `| **Next Version** | \`${resolution.nextVersion}\` |`,
    `| **Bump Type** | \`${resolution.bumpType.toUpperCase()}\` |`,
    `| **Commits Analyzed** | \`${resolution.commitCount}\` |`,
    `*Evaluated automatically using Conventional Commit standards.*`,
  ].join("\n");

  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  const existingComment = comments.find((c) => c.body?.includes(HIDDEN_COMMENT_TAG));

  if (existingComment) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }
}
