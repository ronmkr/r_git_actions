import * as core from "@actions/core";
import * as github from "@actions/github";
import { getPrCommits } from "./git";
import { validateJiraRegex } from "./jira-regex";
import { validateConventionalCommit } from "./conventional-commit";
import { validateJiraStatus } from "./jira-api";
import { postOrUpdatePrComment } from "./github-comment";

function getBool(name: string, defaultValue = false): boolean {
  const val = core.getInput(name).trim().toLowerCase();
  if (!val) return defaultValue;
  return val === "true" || val === "1" || val === "yes";
}

const parseCsv = (name: string) =>
  core.getInput(name).split(",").map((s) => s.trim()).filter(Boolean);

export async function run(): Promise<void> {
  try {
    // 1. Read Inputs
    const explicitMessage = core.getInput("commit-message");
    const requireJiraId = getBool("require-jira-id", true);
    const jiraRegex = core.getInput("jira-regex");
    const jiraProjectKeys = parseCsv("jira-project-keys");

    const checkConventional = getBool("check-conventional-commit", false);
    const checkJiraStatus = getBool("validate-jira-status", false);
    const jiraBaseUrl = core.getInput("jira-base-url");
    const jiraApiToken = core.getInput("jira-api-token");
    if (jiraApiToken) core.setSecret(jiraApiToken);

    const jiraUserEmail = core.getInput("jira-user-email");
    const allowedStatuses = parseCsv("allowed-jira-statuses");
    const disallowedStatuses = parseCsv("disallowed-jira-statuses");

    const postPrComment = getBool("post-pr-comment", true);
    const checkAllPrCommits = getBool("check-all-pr-commits", true);
    const githubToken = core.getInput("github-token");
    if (githubToken) core.setSecret(githubToken);

    core.info("🔍 Running Commit Validation");
    core.info(`- Require Jira ID (Regex)   : ${requireJiraId}`);
    core.info(`- Check Conventional Commit : ${checkConventional}`);
    core.info(`- Validate Jira REST Status : ${checkJiraStatus}`);

    // 2. Extract Commit Messages (Strictly all commits in this PR, not whole repo)
    const commits = await getPrCommits({
      explicitMessage,
      githubToken,
      checkAllPrCommits,
    });

    if (commits.length === 0) {
      core.setFailed("No commit messages found to validate.");
      return;
    }

    // 3. Run Validations per Commit
    const allErrors: string[] = [];
    const allDetectedKeys: string[] = [];
    const allDetectedStatuses: string[] = [];

    for (let i = 0; i < commits.length; i++) {
      const { sha, message } = commits[i];
      const header = message.split(/\r?\n/)[0];
      const commitLabel = sha ? `Commit ${sha}` : `Commit #${i + 1}`;
      const commitErrors: string[] = [];

      // Feature 1: Validate Jira ID via Regex (Primary)
      const jiraResult = validateJiraRegex(message, jiraProjectKeys, jiraRegex);
      allDetectedKeys.push(...jiraResult.keys);

      if (requireJiraId && !jiraResult.isValid && jiraResult.error) {
        commitErrors.push(jiraResult.error);
      }

      // Feature 2: Validate Conventional Commit (Optional)
      if (checkConventional) {
        const convResult = validateConventionalCommit(message, jiraRegex);
        if (!convResult.isValid && convResult.error) {
          commitErrors.push(convResult.error);
        }
      }

      // Feature 3: Validate Jira Issue Status via REST API (Optional)
      if (checkJiraStatus && jiraResult.keys.length > 0) {
        for (const key of jiraResult.keys) {
          const statusResult = await validateJiraStatus(key, {
            baseUrl: jiraBaseUrl,
            apiToken: jiraApiToken,
            userEmail: jiraUserEmail,
            allowedStatuses,
            disallowedStatuses,
          });

          if (statusResult.status) {
            allDetectedStatuses.push(statusResult.status);
          }
          if (!statusResult.isValid && statusResult.error) {
            commitErrors.push(statusResult.error);
          }
        }
      }

      // Log results
      if (commitErrors.length > 0) {
        for (const err of commitErrors) {
          const fullErr = `${commitLabel} ("${header}"): ${err}`;
          core.error(fullErr);
          allErrors.push(fullErr);
        }
      } else {
        core.info(`✅ ${commitLabel} passed ("${header}"). Keys: [${jiraResult.keys.join(", ")}]`);
      }
    }

    const isValid = allErrors.length === 0;
    const uniqueKeys = Array.from(new Set(allDetectedKeys));
    const uniqueStatuses = Array.from(new Set(allDetectedStatuses));

    // 4. Output Results
    core.setOutput("is-valid", String(isValid));
    core.setOutput("jira-id", uniqueKeys.join(","));
    core.setOutput("jira-status", uniqueStatuses.join(","));
    core.setOutput("errors", allErrors.join("\n"));

    // 5. GitHub Step Summary (Visible on the Actions run overview tab)
    try {
      core.summary
        .addHeading("Commit Validation Summary", 2)
        .addTable([
          [{ data: "Metric", header: true }, { data: "Value", header: true }],
          ["Result", isValid ? "✅ All checks passed" : "❌ Validation failed"],
          ["Commits Evaluated", String(commits.length)],
          ["Detected Jira Keys", uniqueKeys.length ? uniqueKeys.join(", ") : "None"],
          ["Detected Jira Statuses", uniqueStatuses.length ? uniqueStatuses.join(", ") : "N/A"],
          ["Failure Count", String(allErrors.length)],
        ]);

      if (!isValid && allErrors.length > 0) {
        core.summary.addHeading("Validation Errors", 3);
        core.summary.addList(allErrors);
      }

      await core.summary.write();
    } catch {
      core.debug("Unable to write step summary.");
    }

    // 6. Feature 4: Post or Update Comment on Pull Request
    const prNumber = github.context.payload.pull_request?.number;
    if (postPrComment && prNumber && githubToken) {
      await postOrUpdatePrComment({
        githubToken,
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        pullNumber: prNumber,
        isValid,
        errors: allErrors,
        guidelines: {
          requireJira: requireJiraId,
          checkConventional,
          allowedStatuses,
        },
      });
    }

    // 7. Action Status
    if (!isValid) {
      core.setFailed(`Commit validation failed with ${allErrors.length} error(s).`);
    } else {
      core.info("🎉 All commit validations PASSED successfully!");
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action error: ${msg}`);
  }
}

if (require.main === module) {
  run();
}
