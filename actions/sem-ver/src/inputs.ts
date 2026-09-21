import * as core from "@actions/core";
import type { ActionInputs } from "./types.js";

function parseBooleanInput(name: string, defaultValue: boolean): boolean {
  const val = core.getInput(name);
  if (!val) return defaultValue;
  return val.trim().toLowerCase() === "true";
}

export function parseInputs(): ActionInputs {
  const token = core.getInput("github-token") || process.env.GITHUB_TOKEN || "";
  if (!token) {
    throw new Error("Missing required GitHub token. Pass inputs.github-token or GITHUB_TOKEN.");
  }

  core.setSecret(token);

  return {
    token,
    createTag: parseBooleanInput("create-tag", true),
    postPrComment: parseBooleanInput("post-pr-comment", true),
    defaultVersion: core.getInput("default-version") || "v0.1.0",
    // New setters:
    updatePackageJson: parseBooleanInput("update-package-json", true),
    packageJsonPath: core.getInput("package-json-path") || "package.json",
  };
}
