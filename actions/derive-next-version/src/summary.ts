import * as core from "@actions/core";
import { VersionResolution } from "./types";

export async function writeSummary(res: VersionResolution): Promise<void> {
  await core.summary
    .addHeading("SemVer 2.0 (X.Y.Z)", 2)
    .addTable([
      [{ data: "Metric", header: true }, { data: "Value", header: true }],
      ["Previous Version", res.previousVersion || "None"],
      ["Next Version", res.nextVersion],
      ["Bump Strategy", res.bumpType.toUpperCase()],
      ["Has Bump", res.hasBump ? "Yes" : "No"],
      ["Commits Analyzed", res.commitCount.toString()],
    ])
    .write();
}
