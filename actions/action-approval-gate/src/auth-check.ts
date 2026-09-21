export interface AuthCheckResult {
  allowed: boolean;
  actor: string;
  allowedActors: string[];
  reason?: string;
}

/**
 * Validates if the responding actor is authorized in allowed-actors.
 * Case-insensitive match. If allowed-actors is empty, anyone is permitted.
 */
export function checkAllowedActors(allowedActorsInput: string, actor: string): AuthCheckResult {
  const allowed = allowedActorsInput.split(/[\n,]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length === 0 || allowed.includes((actor || "").trim().toLowerCase())) {
    return { allowed: true, actor, allowedActors: allowed };
  }
  return {
    allowed: false,
    actor,
    allowedActors: allowed,
    reason: `Actor '${actor}' is not authorized to decide this gate. Permitted actors: [${allowed.join(", ")}]`,
  };
}
