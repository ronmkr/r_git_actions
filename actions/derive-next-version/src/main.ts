import * as core from "@actions/core";
import * as github from "@actions/github";
import { fetchLatestTag } from "./tags";
import { fetchCommitMessages, evaluateConventionalBump } from "./commits";
import { incrementSemVer } from "./semver";
import { writeSummary } from "./summary";
import { VersionResolution } from "./types";

export async function run(): Promise<void> {
  try {
    const token = core.getInput("github-token") || process.env.GITHUB_TOKEN || "";
    if (token) core.setSecret(token);
    const defaultVersion = (core.getInput("default-version") || "0.1.0").replace(/^v/, "");
    const alwaysBumpPatch = (core.getInput("always-bump-patch") || "true").toLowerCase() === "true";

    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const sha = github.context.sha;

    core.info(`Evaluating SemVer for ${owner}/${repo} at ref ${sha}`);

    // 1. Discover Previous Version (last valid SemVer tag by creation date)
    const latestTag = fetchLatestTag();
    const previousVersion = latestTag ? latestTag.raw : "";
    const baseTagRef = latestTag ? latestTag.tagName : "";
    core.info(`Previous SemVer: ${previousVersion || "None"} (ref: ${baseTagRef || "None"})`);

    // 2. Analyze Commits between last tag and current commit against Conventional Commits
    const commitMessages = await fetchCommitMessages(octokit, owner, repo, baseTagRef, sha);
    core.info(`Analyzed ${commitMessages.length} commit(s)`);

    // 3. Determine Bump (strictly X.Y.Z)
    let bumpType = evaluateConventionalBump(commitMessages);
    if (bumpType === "none" && alwaysBumpPatch && commitMessages.length > 0) {
      core.info("No breaking/feat/fix commit detected, but commits exist. Bumping PATCH (always-bump-patch=true).");
      bumpType = "patch";
    }

    const nextVersion = incrementSemVer(latestTag, bumpType, defaultVersion);
    const hasBump = bumpType !== "none";

    core.info(`Bump: ${bumpType} -> Next: ${nextVersion}`);

    const resolution: VersionResolution = {
      previousVersion,
      nextVersion,
      bumpType,
      hasBump,
      commitCount: commitMessages.length,
    };

    // 4. Applies & Exports the Version:
    // Sets $GITHUB_OUTPUT parameters (version, version_clean, bump_type, has_bump, previous_version)
    core.setOutput("previous_version", resolution.previousVersion);
    core.setOutput("version", resolution.nextVersion);
    core.setOutput("bump_type", resolution.bumpType);
    core.setOutput("has_bump", String(resolution.hasBump));

    // Exports environment variables ($VERSION, $NEXT_VERSION) into $GITHUB_ENV as X.Y.Z
    core.exportVariable("VERSION", resolution.nextVersion);
    core.exportVariable("NEXT_VERSION", resolution.nextVersion);

    // Job Step Summary
    await writeSummary(resolution);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setFailed(`SemVer failed: ${msg}`);
  }
}

if (require.main === module) {
  run();
}
