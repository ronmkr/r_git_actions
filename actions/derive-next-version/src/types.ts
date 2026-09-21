export type BumpType = "major" | "minor" | "patch" | "none";

export interface SemVer {
  tagName: string; // The exact git ref name on GitHub (e.g. "v1.0.0")
  raw: string;     // Clean SemVer X.Y.Z (e.g. "1.0.0")
  major: number;
  minor: number;
  patch: number;
}

export interface VersionResolution {
  previousVersion: string;
  nextVersion: string;
  bumpType: BumpType;
  hasBump: boolean;
  commitCount: number;
}
