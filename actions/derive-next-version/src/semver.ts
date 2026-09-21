import { BumpType, SemVer } from "./types";

/**
 * Parses a git tag into a SemVer 2.0 object.
 * Strips optional leading 'v' for the clean SemVer 'raw' field.
 */
export function parseSemVer(tag: string): SemVer | null {
  const trimmed = tag.trim();
  const clean = trimmed.replace(/^v/, "");
  const match = clean.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  if (!match) return null;
  return {
    tagName: trimmed,
    raw: `${match[1]}.${match[2]}.${match[3]}`,
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}


/**
 * Increments SemVer version strictly formatted as X.Y.Z (no v prefix).
 */
export function incrementSemVer(
  current: SemVer | null,
  bump: BumpType,
  fallbackVersion: string = "0.1.0"
): string {
  const cleanFallback = fallbackVersion.trim().replace(/^v/, "");
  if (!current) {
    const parsedFallback = parseSemVer(cleanFallback);
    if (!parsedFallback || bump === "none") {
      return cleanFallback || "0.1.0";
    }
    if (parsedFallback.major === 0 && parsedFallback.minor === 0 && parsedFallback.patch === 0) {
      return incrementSemVer(parsedFallback, bump, cleanFallback);
    }
    return cleanFallback;
  }

  let { major, minor, patch } = current;

  switch (bump) {
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
      patch += 1;
      break;
    case "none":
      break;
  }

  return `${major}.${minor}.${patch}`;
}
