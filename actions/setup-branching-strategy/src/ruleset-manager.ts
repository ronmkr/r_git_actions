/**
 * Feature: Repository Ruleset Manager
 * Creates or updates GitHub Repository Rulesets idempotently to avoid duplicate rulesets.
 * Enforces production-grade best practices:
 * - Minimum 2 approving reviews
 * - Dismiss stale approvals on new commits
 * - Require review conversation thread resolution
 * - Require approval from someone other than the last pusher
 * - Require CODEOWNERS review
 * - Block direct commits (all changes require PR)
 * - Block branch deletions
 * - Block force-pushes (non-fast-forward)
 * - Enforce linear commit history
 */

import * as core from "@actions/core";
import { GitHub } from "@actions/github/lib/utils";

export interface RulesetOptions {
  requiredApprovals: number;
  dismissStaleReviews: boolean;
  requireLinearHistory: boolean;
  requireCodeOwnerReview?: boolean;
  requireLastPushApproval?: boolean;
  requiredReviewThreadResolution?: boolean;
  requireSignedCommits?: boolean;
}

export interface RulesetUpsertResult {
  id: number;
  name: string;
  action: "created" | "updated";
  branches: string[];
  error?: string;
}

/**
 * Ensures a single repository ruleset exists for the specified branching strategy.
 * If one already exists with the given name, it updates it instead of creating a duplicate.
 */
export async function upsertRepoRuleset(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  rulesetName: string,
  branches: string[],
  options: RulesetOptions
): Promise<RulesetUpsertResult> {
  const minApprovals = Math.max(options.requiredApprovals || 2, 2);

  core.info(`Ensuring GitHub Ruleset '${rulesetName}' for branches: [${branches.join(", ")}]...`);
  core.info(`- Enforcing minimum approvals: ${minApprovals}`);
  core.info(`- Enforcing dismiss stale reviews: ${options.dismissStaleReviews}`);
  core.info(`- Enforcing review thread resolution: ${options.requiredReviewThreadResolution ?? true}`);
  core.info(`- Enforcing last push approval: ${options.requireLastPushApproval ?? true}`);
  core.info(`- Enforcing linear history: ${options.requireLinearHistory}`);

  const refIncludes = branches.map((b) => (b.startsWith("refs/") ? b : `refs/heads/${b}`));

  const rules: any[] = [
    { type: "deletion" },
    { type: "non_fast_forward" },
    {
      type: "pull_request",
      parameters: {
        required_approving_review_count: minApprovals,
        dismiss_stale_reviews_on_push: options.dismissStaleReviews,
        require_code_owner_review: options.requireCodeOwnerReview ?? true,
        require_last_push_approval: options.requireLastPushApproval ?? true,
        required_review_thread_resolution: options.requiredReviewThreadResolution ?? true,
      },
    },
  ];

  if (options.requireLinearHistory) {
    rules.push({ type: "required_linear_history" });
  }

  if (options.requireSignedCommits) {
    rules.push({ type: "required_signatures" });
  }

  const payload = {
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
    bypass_actors: [],
  };

  try {
    // 1. Check for existing rulesets to avoid confusing duplicates
    const { data: existingRulesets } = await octokit.request("GET /repos/{owner}/{repo}/rulesets", {
      owner,
      repo,
      headers: { "X-GitHub-Api-Version": "2022-11-28" },
    });

    const normalizedTargetName = rulesetName.trim().toLowerCase();
    const existing = Array.isArray(existingRulesets)
      ? existingRulesets.find((r: { id?: number; name?: string }) => r.name?.trim().toLowerCase() === normalizedTargetName)
      : undefined;

    if (existing && existing.id) {
      core.info(`Found existing ruleset '${existing.name}' (ID: ${existing.id}). Updating in-place to prevent duplicates...`);
      const { data: updated } = await octokit.request("PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}", {
        owner,
        repo,
        ruleset_id: existing.id,
        ...payload,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });

      core.info(`✅ Successfully updated repository ruleset #${updated.id} ('${updated.name}').`);
      return {
        id: updated.id,
        name: updated.name,
        action: "updated",
        branches,
      };
    }

    // 2. Create new ruleset if not already present
    core.info(`No existing ruleset found matching '${rulesetName}'. Creating new ruleset...`);
    const { data: created } = await octokit.request("POST /repos/{owner}/{repo}/rulesets", {
      owner,
      repo,
      ...payload,
      headers: { "X-GitHub-Api-Version": "2022-11-28" },
    });

    core.info(`✨ Successfully created repository ruleset #${created.id} ('${created.name}').`);
    return {
      id: created.id,
      name: created.name,
      action: "created",
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
