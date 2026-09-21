/**
 * Feature: Repository Ruleset Manager
 * Declarative JSON-style GitHub Ruleset manager with simple feature flags.
 * Includes all branch protection rules and repository settings in one place.
 */

import * as core from "@actions/core";
import { GitHub } from "@actions/github/lib/utils";

export interface RulesetConfig {
  requiredApprovals?: number;
  dismissStaleReviews?: boolean;
  requireLinearHistory?: boolean;
  requireCodeOwnerReview?: boolean;
  requireLastPushApproval?: boolean;
  requireReviewThreadResolution?: boolean;
  requireSignedCommits?: boolean;
  blockDeletion?: boolean;
  blockForcePush?: boolean;
  autoDeleteHeadBranches?: boolean;
  bypassActors?: any[];
}

export const DEFAULT_RULESET_CONFIG: Required<RulesetConfig> = {
  requiredApprovals: 2,
  dismissStaleReviews: true,
  requireLinearHistory: true,
  requireCodeOwnerReview: true,
  requireLastPushApproval: true,
  requireReviewThreadResolution: true,
  requireSignedCommits: false,
  blockDeletion: true,
  blockForcePush: true,
  autoDeleteHeadBranches: true,
  bypassActors: [],
};

export interface RulesetUpsertResult {
  id: number;
  name: string;
  action: "created" | "updated";
  branches: string[];
  error?: string;
}

/**
 * Builds the declarative GitHub Ruleset JSON payload from configuration flags.
 */
export function buildRulesetPayload(
  rulesetName: string,
  branches: string[],
  config: RulesetConfig = {}
) {
  const merged = { ...DEFAULT_RULESET_CONFIG, ...config };
  const minApprovals = Math.max(merged.requiredApprovals, 2);

  const rules: any[] = [];

  // 1. Core Branch Protection: Block Deletion
  if (merged.blockDeletion) {
    rules.push({ type: "deletion" });
  }

  // 2. Core Branch Protection: Block Non-Fast-Forward (Force Pushes)
  if (merged.blockForcePush) {
    rules.push({ type: "non_fast_forward" });
  }

  // 3. Pull Request Requirements
  rules.push({
    type: "pull_request",
    parameters: {
      required_approving_review_count: minApprovals,
      dismiss_stale_reviews_on_push: merged.dismissStaleReviews,
      require_code_owner_review: merged.requireCodeOwnerReview,
      require_last_push_approval: merged.requireLastPushApproval,
      required_review_thread_resolution: merged.requireReviewThreadResolution,
    },
  });

  // 4. Linear Commit History
  if (merged.requireLinearHistory) {
    rules.push({ type: "required_linear_history" });
  }

  // 5. Signed Commits
  if (merged.requireSignedCommits) {
    rules.push({ type: "required_signatures" });
  }

  const refIncludes = branches.map((b) => (b.startsWith("refs/") ? b : `refs/heads/${b}`));

  return {
    name: rulesetName,
    target: "branch" as const,
    enforcement: "active" as const,
    conditions: {
      ref_name: {
        include: refIncludes,
        exclude: [],
      },
    },
    rules,
    bypass_actors: merged.bypassActors,
  };
}

/**
 * Idempotently creates or updates the GitHub Ruleset and configures repository auto-deletion.
 */
export async function upsertRepoRuleset(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  rulesetName: string,
  branches: string[],
  config: RulesetConfig = {}
): Promise<RulesetUpsertResult> {
  const merged = { ...DEFAULT_RULESET_CONFIG, ...config };
  const payload = buildRulesetPayload(rulesetName, branches, merged);

  core.info(`Configuring GitHub Ruleset '${rulesetName}' for [${branches.join(", ")}]`);
  core.info(`- Approvals (min 2)           : ${merged.requiredApprovals}`);
  core.info(`- Dismiss Stale Reviews       : ${merged.dismissStaleReviews}`);
  core.info(`- Require Thread Resolution   : ${merged.requireReviewThreadResolution}`);
  core.info(`- Require Last Push Approval  : ${merged.requireLastPushApproval}`);
  core.info(`- Require CODEOWNERS Review   : ${merged.requireCodeOwnerReview}`);
  core.info(`- Require Linear History      : ${merged.requireLinearHistory}`);
  core.info(`- Protect Core from Deletion  : ${merged.blockDeletion}`);
  core.info(`- Auto-Delete Merged Branches : ${merged.autoDeleteHeadBranches}`);

  try {
    // 1. Check for existing ruleset by name (avoids duplicates)
    const { data: existingRulesets } = await octokit.request("GET /repos/{owner}/{repo}/rulesets", {
      owner,
      repo,
      headers: { "X-GitHub-Api-Version": "2022-11-28" },
    });

    const targetName = rulesetName.trim().toLowerCase();
    const existing = Array.isArray(existingRulesets)
      ? existingRulesets.find((r: { id?: number; name?: string }) => r.name?.trim().toLowerCase() === targetName)
      : undefined;

    let resultId = 0;
    let resultName = rulesetName;
    let resultAction: "created" | "updated" = "created";

    if (existing && existing.id) {
      core.info(`Updating existing ruleset #${existing.id} ('${existing.name}')...`);
      const { data: updated } = await octokit.request("PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}", {
        owner,
        repo,
        ruleset_id: existing.id,
        ...payload,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });
      core.info(`✅ Successfully updated repository ruleset #${updated.id} ('${updated.name}').`);
      resultId = updated.id;
      resultName = updated.name;
      resultAction = "updated";
    } else {
      core.info(`Creating new ruleset '${rulesetName}'...`);
      const { data: created } = await octokit.request("POST /repos/{owner}/{repo}/rulesets", {
        owner,
        repo,
        ...payload,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });
      core.info(`✨ Successfully created repository ruleset #${created.id} ('${created.name}').`);
      resultId = created.id;
      resultName = created.name;
      resultAction = "created";
    }

    // 2. Configure repository: automatically delete head/feat branch when PR is merged
    if (merged.autoDeleteHeadBranches) {
      try {
        core.info(`Enforcing repository setting: delete_branch_on_merge = true (auto-delete feature branches on merge)...`);
        await octokit.request("PATCH /repos/{owner}/{repo}", {
          owner,
          repo,
          delete_branch_on_merge: true,
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        });
        core.info(`✅ Successfully enabled automatic head branch deletion on merge.`);
      } catch (repoErr: unknown) {
        const msg = repoErr instanceof Error ? repoErr.message : String(repoErr);
        core.warning(`Could not configure 'delete_branch_on_merge' repository setting: ${msg}`);
      }
    }

    return {
      id: resultId,
      name: resultName,
      action: resultAction,
      branches,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    core.error(`Failed to upsert repository ruleset '${rulesetName}': ${msg}`);
    return {
      id: 0,
      name: rulesetName,
      action: "created",
      branches,
      error: msg,
    };
  }
}
