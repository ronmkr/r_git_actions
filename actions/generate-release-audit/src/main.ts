import * as core from "@actions/core";
import * as github from "@actions/github";
import { generateReleaseAudit } from "./audit";
import { writeReportSummary } from "./reporter";

const parseCsv = (name: string) =>
  core.getInput(name).split(",").map((s) => s.trim()).filter(Boolean);

export async function run(): Promise<void> {
  try {
    const token = core.getInput("github-token", { required: true });
    core.setSecret(token);

    const baseTag = core.getInput("base-tag", { required: true }).trim().replace(/^v/, "");
    const headTag = core.getInput("head-tag", { required: true }).trim().replace(/^v/, "");
    const failOnViolation = (core.getInput("fail-on-violation") || "true").toLowerCase() === "true";
    const projectKeys = parseCsv("jira-project-keys");

    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;

    core.info(`📋 Generating Release Audit Report for ${owner}/${repo}`);
    core.info(`- Base Tag          : ${baseTag}`);
    core.info(`- Head Tag          : ${headTag}`);
    core.info(`- Fail On Violation : ${failOnViolation}`);

    const report = await generateReleaseAudit(octokit, owner, repo, baseTag, headTag, projectKeys);

    core.setOutput("total_commits", String(report.totalCommits));
    core.setOutput("total_prs", String(report.prs.length));
    core.setOutput("all_jiras", report.allJiraKeys.join(","));
    core.setOutput("violations_count", String(report.violationsCount));
    core.setOutput("is_compliant", report.violationsCount === 0 ? "true" : "false");

    await writeReportSummary(report);

    if (report.violationsCount > 0) {
      const msg = `⛔ Release Audit Compliance Failed: ${report.violationsCount} PR(s) contained approvers who were also committers or PR authors.`;
      if (failOnViolation) {
        core.setFailed(msg);
      } else {
        core.warning(msg);
      }
    } else {
      core.info("✨ Release audit report completed. All PR reviews were strictly independent.");
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

if (process.env.NODE_ENV !== "test") {
  run();
}
