---
name: create-github-actions
description: >-
  Build production-ready, reusable GitHub Actions using TypeScript, Node 20 runtime,
  the official GitHub Actions Toolkit, modular single-responsibility features, and
  pre-bundled distribution. Use whenever designing, implementing, testing, or publishing
  custom or reusable GitHub Actions.
---

# Create GitHub Actions Skill

A comprehensive playbook and reference for creating production-ready, high-performance, and easily maintainable **reusable GitHub Actions**.

---

## 🏛️ Core Principles & Architecture

Follow these standards for every GitHub Action:

1. **Native Node 20 Runtime (`using: 'node20'`)**:
   - Runs natively on GitHub runners (`ubuntu-latest`, `macos-latest`, `windows-latest`) without requiring setup steps (e.g. `setup-python` or `setup-node`).
2. **Official GitHub Actions Toolkit**:
   - Use [`@actions/core`](https://github.com/actions/toolkit/tree/main/packages/core) for inputs, outputs, logging, secrets masking, and step summaries.
   - Use [`@actions/github`](https://github.com/actions/toolkit/tree/main/packages/github) for Octokit and event context payloads.
   - Prefer native Node.js `fetch` over external HTTP libraries.
3. **Modular Single-Responsibility Structure**:
   - **1 Feature = 1 Dedicated File = 1 Primary Export Function**.
   - Avoid helper sprawl, abstract factories, or deep inheritance ("caveman simplicity within modules").
4. **Pre-Bundled Distribution (`@vercel/ncc`)**:
   - Bundle all TypeScript and dependencies into a single executable file: `dist/index.js`.
   - Consumers reference `uses: owner/repo/actions/<name>@v1` with **zero `npm install` overhead**.
5. **Anti-Drift CI Check**:
   - Every action repository MUST enforce `git diff --exit-code dist/` in CI to ensure committed bundles never drift from source code.

---

## 📁 Recommended Repository Layout

```text
<repo-root>/
├── .github/
│   ├── dependabot.yml           # Automated dependency updates for npm and actions
│   └── workflows/
│       └── ci.yml               # Unit tests, bundle verification & action self-testing
├── actions/                     # Scalable folder holding multiple reusable actions
│   └── <action-name>/
│       ├── action.yml           # GitHub Action definition (runs on Node 20)
│       ├── package.json         # Toolkit dependencies & build/test scripts
│       ├── tsconfig.json        # TypeScript configuration
│       ├── jest.config.js       # Unit testing configuration
│       ├── README.md            # Action usage guide, inputs, outputs & permissions
│       ├── dist/
│       │   └── index.js         # Single compiled bundle (COMMITTED)
│       └── src/
│           ├── main.ts          # Linear orchestration entry point
│           ├── <feature-1>.ts   # Focused feature module
│           ├── <feature-2>.ts   # Focused feature module
│           └── __tests__/       # Matching unit tests for each feature
│               ├── <feature-1>.test.ts
│               └── <feature-2>.test.ts
├── .gitignore
├── LICENSE
└── README.md                    # Root catalog of all actions in the repository
```

---

## 📋 Step-by-Step Implementation Guide

### Step 1: Initialize Action Package

In `actions/<action-name>/package.json`:

```json
{
  "name": "<action-name>",
  "version": "1.0.0",
  "description": "Reusable GitHub Action description",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "bundle": "ncc build src/main.ts -o dist --source-map --license licenses.txt",
    "test": "jest",
    "all": "npm run test && npm run bundle"
  },
  "dependencies": {
    "@actions/core": "^1.11.1",
    "@actions/github": "^6.0.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "@types/node": "^20.17.19",
    "@vercel/ncc": "^0.38.3",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.7.3"
  }
}
```

### Step 2: Define `action.yml`

```yaml
name: "Action Name"
description: "Clear summary of what the action does"
author: "Author or Org Name"

branding:
  icon: "check-circle"
  color: "blue"

inputs:
  my-input:
    description: "Input description"
    required: false
    default: "true"
  github-token:
    description: "GitHub token for API calls and PR comments"
    required: false
    default: ${{ github.token }}

outputs:
  is-valid:
    description: "'true' if validation passed, 'false' otherwise."
  result-data:
    description: "Output data"

runs:
  using: "node20"
  main: "dist/index.js"
```

### Step 3: Implement Modular Features (`src/`)

Keep each feature file strictly focused on **one task** with **one primary function**:

```typescript
// src/<feature>.ts
export interface FeatureResult {
  isValid: boolean;
  data?: string;
  error?: string;
}

export function validateFeature(input: string): FeatureResult {
  if (!input.trim()) {
    return { isValid: false, error: "Input is empty." };
  }
  // Perform core check directly
  return { isValid: true, data: input.trim() };
}
```

### Step 4: Implement Orchestrator (`src/main.ts`)

`main.ts` should be a clean, linear script connecting inputs, features, outputs, and reporting:

```typescript
import * as core from "@actions/core";
import * as github from "@actions/github";
import { validateFeature } from "./feature";

// Safe boolean helper: avoids crashing if empty string or non-YAML value passed
function getBool(name: string, defaultValue = false): boolean {
  const val = core.getInput(name).trim().toLowerCase();
  if (!val) return defaultValue;
  return val === "true" || val === "1" || val === "yes";
}

export async function run(): Promise<void> {
  try {
    // 1. Read Inputs
    const token = core.getInput("github-token");
    if (token) core.setSecret(token); // Mask sensitive tokens in runner logs

    const isEnabled = getBool("my-input", true);

    // 2. Execute Feature Validations
    const result = validateFeature("some-value");

    // 3. Set Outputs
    core.setOutput("is-valid", String(result.isValid));

    // 4. GitHub Job Step Summary (Visible on Actions run overview page)
    try {
      await core.summary
        .addHeading("Action Run Summary", 2)
        .addTable([
          [{ data: "Item", header: true }, { data: "Status", header: true }],
          ["Result", result.isValid ? "✅ Passed" : "❌ Failed"],
        ])
        .write();
    } catch {
      core.debug("Unable to write step summary.");
    }

    // 5. Fail job on error
    if (!result.isValid) {
      core.setFailed(result.error || "Validation failed.");
    } else {
      core.info("🎉 All checks passed!");
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action execution failed: ${msg}`);
  }
}

if (require.main === module) {
  run();
}
```

### Step 5: Pull Request Commenting Pattern (Idempotent / No Spam)

When publishing PR comments, use a hidden HTML comment marker to detect and **update existing comments** on new pushes rather than spamming new comments:

```typescript
export const COMMENT_TAG = "<!-- my-action-comment-tag -->";

export async function postOrUpdatePrComment(options: {
  githubToken: string;
  owner: string;
  repo: string;
  pullNumber: number;
  body: string;
}): Promise<void> {
  const { githubToken, owner, repo, pullNumber, body } = options;
  const octokit = github.getOctokit(githubToken);

  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: pullNumber,
  });

  const existing = comments.find((c) => c.body?.includes(COMMENT_TAG));
  const fullBody = `${COMMENT_TAG}\n${body}`;

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: fullBody,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body: fullBody,
    });
  }
}
```

### Step 6: GitHub Rulesets & Branch Governance Pattern (Idempotent / No Duplicates)

When configuring repository branch strategies, use **GitHub Repository Rulesets** instead of legacy branch protection API:

1. **Check Existing Rulesets First**: Query `GET /repos/{owner}/{repo}/rulesets` to locate existing rulesets by name.
2. **Update in Place (`PUT`)**: If an existing ruleset matches, call `PUT /repos/{owner}/{repo}/rulesets/{id}` rather than `POST` to avoid confusing duplicate rulesets.
3. **Block Direct Commits**: Adding a `pull_request` rule with empty bypass actors (`bypass_actors: []`) automatically blocks direct pushes to protected branches.
4. **Bake In Governance Best Practices**:
   - Minimum 2 required approvers (`required_approving_review_count: 2`).
   - Dismiss stale approvals on push (`dismiss_stale_reviews_on_push: true`).
   - Require review thread resolution (`required_review_thread_resolution: true`).
   - Require last push approval (`require_last_push_approval: true`).
   - Require CODEOWNERS review (`require_code_owner_review: true`).
   - Prevent deletions (`type: "deletion"`) & force pushes (`type: "non_fast_forward"`).
   - Linear history (`type: "required_linear_history"`).
5. **PR Promotion Validation**:
   - Enforce sequential branch promotion hierarchies in PR workflows (e.g. `develop -> main` in GitFlow, `dev -> uat -> prd` in GitOps).
6. **Actor Authorization**:
   - Restrict administrative action execution to permitted GitHub usernames (`allowed-actors`) via `github.context.actor` checks.

---

## 🔒 Crucial Best Practices & Pitfalls

| Category | Best Practice | Rationale |
|---|---|---|
| **Git Tracking** | **NEVER ignore `actions/*/dist/` in `.gitignore`** | GitHub Actions downloads the action source at runtime. If `dist/index.js` is ignored, the action fails immediately with file not found. |
| **Drift Prevention** | Run `git diff --exit-code dist/` in CI | Guarantees that contributors always bundle their TypeScript changes before pushing. |
| **Security** | Always call `core.setSecret(token)` | Prevents tokens from leaking into logs during exceptions or debugging. |
| **Governance** | Default to minimum 2 approvers & thread resolution | Prevents self-merges and unreviewed bug promotions in production. |
| **Rulesets** | Upsert rulesets idempotently | Avoids duplicate, conflicting ruleset entries in repository settings. |
| **Permissions** | Specify required permissions in docs | e.g. `pull-requests: write` when commenting, `administration: write` for rulesets. |
| **Inputs** | Use safe boolean parsing | `core.getBooleanInput` throws if string is empty; a fallback parser prevents avoidable crashes. |
| **Dependencies** | Automate updates with Dependabot | Keeps action dependencies patched for vulnerabilities without manual overhead. |
