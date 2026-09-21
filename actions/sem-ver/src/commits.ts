import type { BumpType } from "./types.js";

export function evaluateConventionalBump(messages: string[]): BumpType {
  let currentBump: BumpType = "none";

  for (const message of messages) {
    const isBreaking =
      /^[a-z]+(\([a-z0-9-_.]+\))?!:/.test(message) ||
      /BREAKING[ -]CHANGE:/m.test(message);

    if (isBreaking) {
      return "major"; // Breaking changes take absolute precedence
    }

    if (/^feat(\([a-z0-9-_.]+\))?:/.test(message)) {
      currentBump = "minor";
    } else if (
      currentBump !== "minor" &&
      /^(fix|perf|refactor)(\([a-z0-9-_.]+\))?:/.test(message)
    ) {
      currentBump = "patch";
    }
  }

  return currentBump;
}
