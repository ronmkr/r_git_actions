/**
 * Feature: Branching Strategy Preset Configurations
 * Supports Trunk-Based, GitFlow, GitOps (dev, uat, prod), and Custom models.
 */

export type StrategyType = "trunk-based" | "gitflow" | "gitops" | "custom";

export interface BranchingStrategyConfig {
  name: StrategyType;
  branches: string[];
  defaultBranch?: string;
  requiredApprovals: number;
}

/**
 * Returns the branching specification and target branches for a given strategy.
 */
export function resolveStrategyConfig(
  strategy: StrategyType,
  overrides?: {
    customBranches?: string[];
    defaultBranch?: string;
    requiredApprovals?: number;
  }
): BranchingStrategyConfig {
  // Production best practice: default minimum 2 approvals
  const rawApprovals = overrides?.requiredApprovals ?? 2;
  const approvals = Math.max(rawApprovals, 2);

  switch (strategy.toLowerCase().replace(/_/g, "-") as StrategyType) {
    case "trunk-based": {
      const defBranch = overrides?.defaultBranch || "main";
      return {
        name: "trunk-based",
        branches: [defBranch],
        defaultBranch: defBranch,
        requiredApprovals: approvals,
      };
    }

    case "gitflow": {
      const mainBranch = overrides?.defaultBranch || "main";
      const developBranch = "develop";
      return {
        name: "gitflow",
        branches: [mainBranch, developBranch],
        defaultBranch: developBranch,
        requiredApprovals: approvals,
      };
    }

    case "gitops": {
      const devBranch = "dev";
      const uatBranch = "uat";
      const prodBranch = overrides?.defaultBranch || "prod";
      return {
        name: "gitops",
        branches: [devBranch, uatBranch, prodBranch],
        defaultBranch: devBranch,
        requiredApprovals: approvals,
      };
    }

    case "custom":
    default: {
      const branchList =
        overrides?.customBranches && overrides.customBranches.length > 0
          ? overrides.customBranches
          : [overrides?.defaultBranch || "main"];

      return {
        name: "custom",
        branches: branchList,
        defaultBranch: overrides?.defaultBranch || branchList[0],
        requiredApprovals: approvals,
      };
    }
  }
}
