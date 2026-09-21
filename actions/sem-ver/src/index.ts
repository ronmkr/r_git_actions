import * as core from "@actions/core";
import * as github from "@actions/github";
import { parseInputs } from "./inputs.js";
import { fetchLatestTag, createAnnotatedTag } from "./tags.js";
import { evaluateConventionalBump } from "./commits.js";
import { incrementSemVer } from "./semver.js";
import { reconcilePrComment } from "./pr-comment.js";
import { writeJobSummary } from "./summary.js";
import { applyVersion } from "./writer.js";
import type { VersionResolution } from "./types.js";

async function run(): Promise<void> {
  try {
    const inputs = parseInputs();
    const octokit = github.getOctokit(inputs.token);
    const { owner, repo } = github.context.repo;
    const sha = github.context.sha;

    core.info(`Evaluating SemVer for ${owner}/${repo} at ref ${sha}`);

    const latestTag = await fetchLatestTag(octokit, owner, repo);
    const prevVersionStr = latestTag ? latestTag.raw : "";

    let commitMessages: string[] = [];

    if (latestTag) {
      const compare = await octokit.rest.repos.compareCommits({
        owner,
        repo,
        base: latestTag.raw,
        head: sha,
      });
      commitMessages = compare.data.commits.map((c) => c.commit.message);
    } else {
      const list = await octokit.rest.repos.listCommits({
        owner,
        repo,
        sha,
        per_page: 100,
      });
      commitMessages = list.data.map((c) => c.commit.message);
    }

    const bumpType = evaluateConventionalBump(commitMessages);
    const nextVersion = incrementSemVer(latestTag, bumpType, inputs.defaultVersion);
    const cleanVersion = nextVersion.replace(/^v/, "");
    const hasBump = bumpType !== "none";

    const resolution: VersionResolution = {
      previousVersion: prevVersionStr,
      nextVersion,
      cleanVersion,
      bumpType,
      hasBump,
      commitCount: commitMessages.length,
    };

    // 1. SET VERSION: Mutate package.json and inject $VERSION into GITHUB_ENV
    if (hasBump) {
      applyVersion({
        versionClean: cleanVersion,
        versionTagged: nextVersion,
        updatePackageJson: inputs.updatePackageJson,
        packageJsonPath: inputs.packageJsonPath,
      });
    }

    // 2. Output to $GITHUB_OUTPUT
    core.setOutput("previous_version", resolution.previousVersion);
    core.setOutput("version", resolution.nextVersion);
    core.setOutput("version_clean", resolution.cleanVersion);
    core.setOutput("bump_type", resolution.bumpType);
    core.setOutput("has_bump", resolution.hasBump.toString());

    // 3. Render visual summary
    await writeJobSummary(resolution);

    // 4. Create Git Tag if applicable
    if (inputs.createTag && hasBump && github.context.eventName === "push") {
      core.info(`Tagging commit ${sha} with ${nextVersion}...`);
      await createAnnotatedTag(octokit, owner, repo, nextVersion, sha);
    }

    // 5. Upsert PR Comment
    if (inputs.postPrComment && github.context.payload.pull_request) {
      await reconcilePrComment(
        octokit,
        owner,
        repo,
        github.context.payload.pull_request.number,
        resolution
      );
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

void run();
