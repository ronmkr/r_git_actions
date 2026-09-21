import type { BumpType, SemVer } from "./types.js";

export function parseSemVer(tag: string): SemVer | null {
  const match = tag.match(/^(v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  if (!match) return null;
  return {
    raw: tag,
    hasPrefix: Boolean(match[1]),
    major: parseInt(match[2], 10),
    minor: parseInt(match[3], 10),
    patch: parseInt(match[4], 10),
  };
}

export function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return b.major - a.major;
  if (a.minor !== b.minor) return b.minor - a.minor;
  return b.patch - a.patch;
}

export function incrementSemVer(
  current: SemVer | null,
  bump: BumpType,
  fallbackVersion: string
): string {
  if (!current) {
    return fallbackVersion;
  }

  let { major, minor, patch, hasPrefix } = current;

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

  const raw = `${major}.${minor}.${patch}`;
  return hasPrefix ? `v${raw}` : raw;
}
