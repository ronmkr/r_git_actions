import * as core from "@actions/core";
import type { VersionResolution } from "./types.js";

export async function writeJobSummary(res: VersionResolution): Promise<void> {
  await core.summary
    .addHeading("Conventional SemVer Resolution", 2)
    .addTable([
      [
        { data: "Metric", header: true },
        { data: "Value", header: true },
      ],
      ["Previous Version", res.previousVersion || "None (Initial)"],
      ["Calculated Version", res.nextVersion],
      ["Bump Strategy", res.bumpType],
      ["Version Changed", res.hasBump ? "Yes" : "No"],
      ["Commits Parsed", res.commitCount.toString()],
    ])
    .write();
}
