/**
 * Feature: Branch Existence and Creation Manager
 * Ensures required branches exist on GitHub, creating them from base SHA if missing.
 */

import * as core from "@actions/core";
import { GitHub } from "@actions/github/lib/utils";

export interface BranchEnsureResult {
  branch: string;
  created: boolean;
  sha?: string;
  error?: string;
}

/**
 * Ensures a branch exists in the target repository.
 * If the branch does not exist, creates it pointing to the base branch SHA.
 */
export async function ensureBranchExists(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  branchName: string,
  baseBranchName: string
): Promise<BranchEnsureResult> {
  // 1. Check if the branch already exists
  try {
    const { data: existingRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
    });

    core.info(`Branch '${branchName}' already exists at ${existingRef.object.sha.substring(0, 7)}.`);
    return {
      branch: branchName,
      created: false,
      sha: existingRef.object.sha,
    };
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status !== 404) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        branch: branchName,
        created: false,
        error: `Failed to check branch '${branchName}': ${msg}`,
      };
    }
  }

  // 2. Branch does not exist: find base branch SHA
  let baseSha: string;
  try {
    const { data: baseRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranchName}`,
    });
    baseSha = baseRef.object.sha;
  } catch (baseErr: unknown) {
    const msg = baseErr instanceof Error ? baseErr.message : String(baseErr);
    return {
      branch: branchName,
      created: false,
      error: `Cannot create branch '${branchName}' because base branch '${baseBranchName}' was not found: ${msg}`,
    };
  }

  // 3. Create the missing branch ref
  try {
    const { data: newRef } = await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });

    core.info(`✨ Created new branch '${branchName}' from '${baseBranchName}' at ${baseSha.substring(0, 7)}.`);
    return {
      branch: branchName,
      created: true,
      sha: newRef.object.sha,
    };
  } catch (createErr: unknown) {
    const msg = createErr instanceof Error ? createErr.message : String(createErr);
    return {
      branch: branchName,
      created: false,
      error: `Failed to create branch '${branchName}': ${msg}`,
    };
  }
}
