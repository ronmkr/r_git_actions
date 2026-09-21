export type BumpType = "none" | "patch" | "minor" | "major";

export interface SemVer {
  raw: string;
  hasPrefix: boolean;
  major: number;
  minor: number;
  patch: number;
}

export interface ActionInputs {
  token: string;
  createTag: boolean;
  postPrComment: boolean;
  defaultVersion: string;
  updatePackageJson: boolean;
  packageJsonPath: string;
}

export interface VersionResolution {
  previousVersion: string;
  nextVersion: string;
  cleanVersion: string;
  bumpType: BumpType;
  hasBump: boolean;
  commitCount: number;
}
