import { validatePromotionHierarchy } from "../promotion-rules";

describe("Feature: Branch Promotion Hierarchy Rules", () => {
  describe("GitFlow strategy", () => {
    it("allows merging 'develop' into 'main'", () => {
      const res = validatePromotionHierarchy("gitflow", "main", "develop");
      expect(res.valid).toBe(true);
    });

    it("allows merging 'release/1.0.0' or 'hotfix/patch-1' into 'main'", () => {
      expect(validatePromotionHierarchy("gitflow", "main", "release/1.0.0").valid).toBe(true);
      expect(validatePromotionHierarchy("gitflow", "main", "hotfix/patch-1").valid).toBe(true);
    });

    it("forbids merging feature branch directly into 'main'", () => {
      const res = validatePromotionHierarchy("gitflow", "main", "feature/my-feature");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("only 'develop' (or 'release/*', 'hotfix/*') branches may be merged into 'main'");
    });

    it("allows merging feature branches into 'develop'", () => {
      const res = validatePromotionHierarchy("gitflow", "develop", "feature/my-feature");
      expect(res.valid).toBe(true);
    });
  });

  describe("GitOps strategy (dev -> uat -> prd)", () => {
    it("allows merging feature branches into 'dev'", () => {
      const res = validatePromotionHierarchy("gitops", "dev", "feature/user-auth");
      expect(res.valid).toBe(true);
    });

    it("allows merging 'dev' into 'uat'", () => {
      const res = validatePromotionHierarchy("gitops", "uat", "dev");
      expect(res.valid).toBe(true);
    });

    it("forbids merging feature branch directly into 'uat'", () => {
      const res = validatePromotionHierarchy("gitops", "uat", "feature/direct-bypass");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("promotion must follow 'dev -> uat'");
    });

    it("allows merging 'uat' into 'prd' or 'prod'", () => {
      expect(validatePromotionHierarchy("gitops", "prd", "uat").valid).toBe(true);
      expect(validatePromotionHierarchy("gitops", "prod", "uat").valid).toBe(true);
    });

    it("forbids skipping 'uat' when promoting 'dev' to 'prd'", () => {
      const res = validatePromotionHierarchy("gitops", "prd", "dev");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("skips 'uat' and is prohibited");
    });

    it("forbids merging random feature branch directly into 'prd'", () => {
      const res = validatePromotionHierarchy("gitops", "prd", "feature/shortcut");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("only accepts promoted releases from 'uat'");
    });
  });

  describe("Custom promotion order", () => {
    it("enforces sequential promotion defined in customOrder", () => {
      const customOrder = ["alpha", "beta", "ga"];
      expect(validatePromotionHierarchy("custom", "beta", "alpha", { customOrder }).valid).toBe(true);
      expect(validatePromotionHierarchy("custom", "ga", "beta", { customOrder }).valid).toBe(true);

      const invalid = validatePromotionHierarchy("custom", "ga", "alpha", { customOrder });
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain("Custom promotion sequence requires 'beta -> ga'");
    });
  });

  describe("Trunk-based strategy", () => {
    it("allows any topic branch to merge into 'main'", () => {
      const res = validatePromotionHierarchy("trunk-based", "main", "feature/quick-fix");
      expect(res.valid).toBe(true);
    });
  });
});
