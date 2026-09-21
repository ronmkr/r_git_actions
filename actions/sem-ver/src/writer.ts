import * as fs from "node:fs";
import * as path from "node:path";
import * as core from "@actions/core";

export interface SetVersionOptions {
  versionClean: string; // e.g. "1.2.3"
  versionTagged: string; // e.g. "v1.2.3"
  updatePackageJson: boolean;
  packageJsonPath: string;
}

export function applyVersion(options: SetVersionOptions): void {
  const { versionClean, versionTagged, updatePackageJson, packageJsonPath } = options;

  // 1. Export to $GITHUB_ENV so all later workflow steps can read$VERSION directly
  core.exportVariable("VERSION", versionClean);
  core.exportVariable("NEXT_VERSION", versionTagged);
  core.exportVariable("PACKAGE_VERSION", versionClean);
  core.info(`Exported environment variables: VERSION=${versionClean}, NEXT_VERSION=${versionTagged}`);

  // 2. Update package.json if enabled
  if (updatePackageJson) {
    const fullPath = path.resolve(process.cwd(), packageJsonPath);
    if (fs.existsSync(fullPath)) {
      try {
        const raw = fs.readFileSync(fullPath, "utf-8");
        const pkg = JSON.parse(raw);
        const oldVersion = pkg.version;
        pkg.version = versionClean;

        // Preserve trailing newline and 2-space indentation standard
        fs.writeFileSync(fullPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
        core.info(`Updated ${packageJsonPath}: ${oldVersion} -> ${versionClean}`);
      } catch (err) {
        throw new Error(`Failed to update ${packageJsonPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      core.warning(`File not found for version update: ${fullPath}`);
    }
  }
}
