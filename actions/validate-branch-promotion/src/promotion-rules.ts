/**
 * Feature: Branch Promotion Hierarchy Rules
 * Enforces structured merge policies across branching strategies (GitFlow develop -> main, GitOps dev -> uat -> prd).
 */

export type StrategyType = "trunk-based" | "gitflow" | "gitops" | "custom";

export interface PromotionValidationResult {
  valid: boolean;
  strategy: string;
  baseBranch: string;
  headBranch: string;
  allowedSources: string[];
  error?: string;
}

function matchesPattern(source: string, pattern: string): boolean {
  if (pattern === "*") return true;
  const s = source.toLowerCase();
  const p = pattern.toLowerCase();
  if (p.endsWith("/*")) {
    const prefix = p.slice(0, -2);
    return s === prefix || s.startsWith(`${prefix}/`);
  }
  return s === p;
}

/**
 * Validates that a Pull Request conforms to the branching strategy's promotion hierarchy.
 */
export function validatePromotionHierarchy(
  strategy: StrategyType,
  baseBranch: string,
  headBranch: string,
  options?: {
    customOrder?: string[];
    defaultBranch?: string;
  }
): PromotionValidationResult {
  const normBase = baseBranch.trim().toLowerCase();
  const normHead = headBranch.trim().toLowerCase();
  const defaultBranch = (options?.defaultBranch || "main").toLowerCase();

  let allowedSources: string[] = ["*"];
  let violationExplanation: string | undefined;

  switch (strategy.toLowerCase().replace(/_/g, "-") as StrategyType) {
    case "gitflow": {
      if (normBase === defaultBranch || normBase === "main") {
        allowedSources = ["develop", "release/*", "hotfix/*"];
        const matched = allowedSources.some((pat) => matchesPattern(headBranch, pat));
        if (!matched) {
          violationExplanation = `In GitFlow, only 'develop' (or 'release/*', 'hotfix/*') branches may be merged into '${baseBranch}'. Found source branch: '${headBranch}'.`;
        }
      }
      break;
    }

    case "gitops": {
      const isProd = normBase === "prd" || normBase === "prod" || normBase === defaultBranch;
      const isUat = normBase === "uat";

      if (isProd) {
        allowedSources = ["uat", "hotfix/*"];
        const matched = allowedSources.some((pat) => matchesPattern(headBranch, pat));
        if (!matched) {
          if (normHead === "dev") {
            violationExplanation = `In GitOps, promotion must follow 'dev -> uat -> ${baseBranch}'. Merging 'dev' directly into '${baseBranch}' skips 'uat' and is prohibited.`;
          } else {
            violationExplanation = `In GitOps, '${baseBranch}' only accepts promoted releases from 'uat' (or 'hotfix/*'). Found source branch: '${headBranch}'.`;
          }
        }
      } else if (isUat) {
        allowedSources = ["dev", "hotfix/*"];
        const matched = allowedSources.some((pat) => matchesPattern(headBranch, pat));
        if (!matched) {
          violationExplanation = `In GitOps, promotion must follow 'dev -> uat'. Merging '${headBranch}' directly into 'uat' violates promotion policy. Only 'dev' is permitted.`;
        }
      }
      break;
    }

    case "custom": {
      if (options?.customOrder && options.customOrder.length > 1) {
        const order = options.customOrder.map((b) => b.trim().toLowerCase());
        const baseIndex = order.indexOf(normBase);
        if (baseIndex > 0) {
          const requiredPredecessor = order[baseIndex - 1];
          allowedSources = [requiredPredecessor, "hotfix/*"];
          const matched = allowedSources.some((pat) => matchesPattern(headBranch, pat));
          if (!matched) {
            violationExplanation = `Custom promotion sequence requires '${requiredPredecessor} -> ${baseBranch}'. Found source branch: '${headBranch}'.`;
          }
        }
      }
      break;
    }

    case "trunk-based":
    default: {
      allowedSources = ["*"];
      break;
    }
  }

  if (violationExplanation) {
    return {
      valid: false,
      strategy,
      baseBranch,
      headBranch,
      allowedSources,
      error: violationExplanation,
    };
  }

  return {
    valid: true,
    strategy,
    baseBranch,
    headBranch,
    allowedSources,
  };
}
