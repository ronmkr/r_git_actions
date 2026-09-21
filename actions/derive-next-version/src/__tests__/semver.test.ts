import { parseSemVer, incrementSemVer } from "../semver";
import { SemVer } from "../types";

describe("SemVer Module (X.Y.Z only)", () => {
  describe("parseSemVer", () => {
    it("parses valid semver tags with 'v' prefix and cleans to X.Y.Z", () => {
      const result = parseSemVer("v1.2.3");
      expect(result).toEqual({
        tagName: "v1.2.3",
        raw: "1.2.3",
        major: 1,
        minor: 2,
        patch: 3,
      });
    });

    it("parses valid semver tags without prefix", () => {
      const result = parseSemVer("2.0.1");
      expect(result).toEqual({
        tagName: "2.0.1",
        raw: "2.0.1",
        major: 2,
        minor: 0,
        patch: 1,
      });
    });

    it("returns null for non-semver strings", () => {
      expect(parseSemVer("v1.2")).toBeNull();
      expect(parseSemVer("latest")).toBeNull();
      expect(parseSemVer("release-2026")).toBeNull();
      expect(parseSemVer("v1.0.0-beta")).toBeNull();
    });
  });

  describe("incrementSemVer", () => {
    const current: SemVer = {
      tagName: "v1.2.3",
      raw: "1.2.3",
      major: 1,
      minor: 2,
      patch: 3,
    };

    it("handles MAJOR bump strictly as X.Y.Z (2.0.0)", () => {
      expect(incrementSemVer(current, "major")).toBe("2.0.0");
    });

    it("handles MINOR bump strictly as X.Y.Z (1.3.0)", () => {
      expect(incrementSemVer(current, "minor")).toBe("1.3.0");
    });

    it("handles PATCH bump strictly as X.Y.Z (1.2.4)", () => {
      expect(incrementSemVer(current, "patch")).toBe("1.2.4");
    });

    it("handles NONE bump strictly as X.Y.Z (1.2.3)", () => {
      expect(incrementSemVer(current, "none")).toBe("1.2.3");
    });

    it("returns fallback version stripped of v when current tag is null", () => {
      expect(incrementSemVer(null, "none", "0.1.0")).toBe("0.1.0");
      expect(incrementSemVer(null, "none", "v0.1.0")).toBe("0.1.0");
      expect(incrementSemVer(null, "minor", "v0.1.0")).toBe("0.1.0");
    });
  });
});
