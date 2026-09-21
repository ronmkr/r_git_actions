import { resolveStrategyConfig } from "../strategies";

describe("Feature: Branching Strategy Configurations", () => {
  it("resolves trunk-based strategy defaults with minimum 2 approvals", () => {
    const config = resolveStrategyConfig("trunk-based");
    expect(config.name).toBe("trunk-based");
    expect(config.branches).toEqual(["main"]);
    expect(config.defaultBranch).toBe("main");
    expect(config.requiredApprovals).toBe(2);
  });

  it("resolves gitflow strategy with main and develop", () => {
    const config = resolveStrategyConfig("gitflow");
    expect(config.name).toBe("gitflow");
    expect(config.branches).toEqual(["main", "develop"]);
    expect(config.defaultBranch).toBe("develop");
    expect(config.requiredApprovals).toBe(2);
  });

  it("resolves gitops strategy with dev, uat, prod", () => {
    const config = resolveStrategyConfig("gitops");
    expect(config.name).toBe("gitops");
    expect(config.branches).toEqual(["dev", "uat", "prod"]);
    expect(config.defaultBranch).toBe("dev");
    expect(config.requiredApprovals).toBe(2);
  });

  it("resolves custom strategy with user-specified branches and custom approvals", () => {
    const config = resolveStrategyConfig("custom", {
      customBranches: ["staging", "production"],
      requiredApprovals: 3,
    });
    expect(config.name).toBe("custom");
    expect(config.branches).toEqual(["staging", "production"]);
    expect(config.requiredApprovals).toBe(3);
  });

  it("enforces baseline minimum of 2 approvals even if lower is passed", () => {
    const config = resolveStrategyConfig("gitflow", {
      requiredApprovals: 1,
    });
    expect(config.requiredApprovals).toBe(2);
  });
});
