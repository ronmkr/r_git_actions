/**
 * Feature: Workflow Execution Actor Authorization Check
 * Ensures only authorized GitHub users or bot identities can trigger strategy setup.
 */

export interface AuthCheckResult {
  allowed: boolean;
  actor: string;
  allowedActors: string[];
  reason?: string;
}

/**
 * Checks if the current GitHub actor is permitted to run the workflow.
 * If allowedActorsInput is empty, all actors are permitted by default.
 */
export function checkAllowedActors(allowedActorsInput: string, actor: string): AuthCheckResult {
  const allowed = allowedActorsInput
    .split(/[\n,]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) {
    return { allowed: true, actor, allowedActors: [] };
  }

  const currentActor = (actor || "").trim().toLowerCase();
  const isAuthorized = allowed.includes(currentActor);

  if (!isAuthorized) {
    return {
      allowed: false,
      actor,
      allowedActors: allowed,
      reason: `Actor '${actor}' is not authorized to execute this strategy workflow. Permitted actors: [${allowed.join(", ")}]`,
    };
  }

  return { allowed: true, actor, allowedActors: allowed };
}
