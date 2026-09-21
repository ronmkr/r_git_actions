import * as core from "@actions/core";
import { ReleaseAuditReport } from "./audit";

export function renderAuditMarkdown(report: ReleaseAuditReport): string {
  const lines: string[] = [];

  lines.push(`## 📋 Release Audit Report: \`${report.baseTag}\` ➔ \`${report.headTag}\``);
  lines.push("");
  lines.push(`- **Total Commits Analyzed**: ${report.totalCommits}`);
  lines.push(`- **Total Pull Requests Merged**: ${report.prs.length}`);
  lines.push(`- **Total Jira Issues Discovered**: ${report.allJiraKeys.length}`);
  lines.push(
    `- **Compliance Status**: ${
      report.violationsCount === 0
        ? "✅ **PASSED (All PR reviews were independent)**"
        : `❌ **VIOLATION (${report.violationsCount} PR(s) had committer self-approvals)**`
    }`
  );
  lines.push("");

  // Jira Summary Section
  lines.push("### 🏷️ Discovered Jira Tickets");
  if (report.allJiraKeys.length > 0) {
    lines.push(report.allJiraKeys.map((k) => `\`${k}\``).join(", "));
  } else {
    lines.push("_No Jira issue keys found in commit messages or PR titles._");
  }
  lines.push("");

  // Pull Requests Table
  lines.push("### 🔍 Pull Requests & Independent Review Verification");
  lines.push("");
  lines.push("| PR | Jira(s) | Author | Committers | Approvers | Independent? |");
  lines.push("|---|---|---|---|---|:---:|");

  for (const pr of report.prs) {
    const jiras = pr.jiraKeys.length > 0 ? pr.jiraKeys.join(", ") : "None";
    const committers = pr.committers.map((c) => `@${c}`).join(", ") || `@${pr.author}`;
    const approvers = pr.approvers.map((a) => `@${a}`).join(", ") || "_None_";

    let statusCell = "✅ Passed";
    if (pr.hasCommitterApprovalViolation) {
      statusCell = `❌ **Self-Approval** (@${pr.violatingApprovers.join(", @")})`;
    } else if (pr.approvers.length === 0) {
      statusCell = "⚠️ No Approvals";
    }

    lines.push(
      `| [#${pr.prNumber} - ${pr.title.replace(/\|/g, "\\|")}](${pr.url}) | ${jiras} | @${pr.author} | ${committers} | ${approvers} | ${statusCell} |`
    );
  }

  return lines.join("\n");
}

export async function writeReportSummary(report: ReleaseAuditReport): Promise<void> {
  const md = renderAuditMarkdown(report);
  await core.summary.addRaw(md).write();
}
