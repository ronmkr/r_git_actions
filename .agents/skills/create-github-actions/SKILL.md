---
name: create-github-actions
description: >-
  Build production-ready, reusable GitHub Actions using TypeScript, Node 20 runtime,
  the official GitHub Actions Toolkit, composite github-script@v7 shortcuts,
  ponytail minimalism, caveman simplicity, and pre-bundled distribution. Use
  whenever designing, implementing, testing, or publishing custom or reusable GitHub Actions.
---

# Create GitHub Actions Skill

A comprehensive playbook and reference for engineering production-ready, high-performance, and radically minimal **reusable GitHub Actions**.

---

## 🏛️ Core Principles & The Ponytail Ladder

Before writing any code or configuring a TypeScript project, climb the **Ponytail Ladder**:

1. **YAGNI & Native Platform First**:
   - Do you actually need a custom action? Can a native GitHub feature (e.g., **GitHub Environments** with review rules for $0 runner approvals) or an existing step cover it?
2. **Composite Action with `actions/github-script@v7`**:
   - If the task only performs API queries, basic branch/tag creation, ref comparison, or simple gate logic, **do not build a TypeScript project**.
   - Build a **Composite Action (`using: "composite"`)** powered by `actions/github-script@v7`. It eliminates `package.json`, `package-lock.json`, `tsconfig.json`, `jest`, and compiled `dist/` bundles (~750KB-1MB payload saved per action).
3. **Compiled TypeScript Action (`using: "node20"`)**:
   - Only escalate to a compiled TypeScript action when there is non-trivial domain logic, multi-step business logic, or algorithmic parsing requiring full modular test suites.
4. **Strict `X.Y.Z` SemVer**:
   - Tags and versions are strictly formatted as `X.Y.Z` (e.g., `1.0.0`, never prefixed with `v` like `v1.0.0`). Sanitize all inputs via `.replace(/^v/, '')`.
5. **Caveman Simplicity (Boring Over Clever)**:
   - 1 Feature = 1 File = 1 Primary Function.
   - No unnecessary abstractions: no interface with 1 implementation, no abstract factories, no speculative scaffolding for "later".
   - Native Node.js `fetch` and standard library (`Buffer.from` over `btoa`, ES6 spread `[...]` over `Array.from`).

---

## 📁 Repository Architecture & Layout

Organize actions by choosing the leanest architecture on the ladder:

```text
<repo-root>/
├── .github/
│   └── workflows/
│       └── ci.yml               # Unit tests, bundle verification & action self-testing
├── actions/
│   ├── <simple-action>/         # 🟢 COMPOSITE ACTION (github-script@v7)
│   │   ├── action.yml           # Runs actions/github-script@v7 directly. No npm build.
│   │   └── README.md            # Inputs, outputs & usage
│   │
│   └── <complex-action>/        # 🟡 COMPILED NODE ACTION (TypeScript)
│       ├── action.yml           # using: "node20", main: "dist/index.js"
│       ├── package.json         # Toolkit dependencies & build/test scripts
│       ├── tsconfig.json        # Target ES2022+
│       ├── jest.config.js       # Unit tests
│       ├── dist/
│       │   └── index.js         # Single compiled bundle via @vercel/ncc (COMMITTED)
│       ├── README.md
│       └── src/
│           ├── main.ts          # Linear entry point (reads inputs, executes, outputs)
│           ├── <feature>.ts     # Pure function with focused responsibility
│           └── __tests__/       # Fast, deterministic unit tests
│               └── <feature>.test.ts
├── LICENSE
└── README.md                    # Catalog of all actions in the repository
```

---

## 🛠️ Pattern 1: Composite GitHub-Script Action (The Minimalist Choice)

Use this pattern for quick guards, gates, ref creation, or PR file detection.

### `actions/<simple-action>/action.yml`

```yaml
name: "Action Approval Gate"
description: "Synchronous guard validating prior step outcomes and actor permissions."
author: "ronmkr"

branding:
  icon: "check-circle"
  color: "green"

inputs:
  previous-outcome:
    description: "Outcome of previous step ('success' or 'failure')."
    required: false
    default: "success"
  expected-outcome:
    description: "Expected outcome required to proceed."
    required: false
    default: "success"
  allowed-actors:
    description: "Comma-separated list of allowed GitHub usernames."
    required: false
    default: ""

outputs:
  is-valid:
    description: "'true' if valid, 'false' otherwise."
    value: ${{ steps.gate.outputs.is-valid }}

runs:
  using: "composite"
  steps:
    - id: gate
      uses: actions/github-script@v7
      with:
        script: |
          const previous = "${{ inputs.previous-outcome }}".trim().toLowerCase() || "success";
          const expected = "${{ inputs.expected-outcome }}".trim().toLowerCase() || "success";
          const allowed = "${{ inputs.allowed-actors }}".split(/[\n,]/).map(s => s.trim().toLowerCase()).filter(Boolean);
          const actor = context.actor.toLowerCase();

          if (previous !== expected) {
            core.setOutput("is-valid", "false");
            core.setFailed(`⛔ Gate Blocked: '${previous}' !== '${expected}'.`);
            return;
          }

          if (allowed.length > 0 && !allowed.includes(actor)) {
            core.setOutput("is-valid", "false");
            core.setFailed(`⛔ Unauthorized actor '@${context.actor}'.`);
            return;
          }

          core.setOutput("is-valid", "true");
          core.info(`✅ Gate Passed: actor '@${context.actor}' authorized.`);
```

### 1-Call Idempotent Git Ref Creation

Instead of making 2 network calls (`getRef` + `createRef`), directly attempt `createRef` and catch HTTP 422:

```javascript
try {
  await github.rest.git.createRef({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: `refs/tags/${tagName}`,
    sha: context.sha,
  });
  core.setOutput("created", "true");
} catch (err) {
  if (err.status === 422) {
    core.info(`⚠️ Tag '${tagName}' already exists. Skipping.`);
    core.setOutput("created", "false");
    return;
  }
  throw err;
}
```

---

## ⚙️ Pattern 2: Compiled TypeScript Action (For Complex Logic)

When full TypeScript, modular unit testing, and heavy parsing are required:

### 1. `package.json` Standard Setup

```json
{
  "name": "derive-next-version",
  "version": "1.0.0",
  "description": "Calculates next SemVer X.Y.Z bump based on Conventional Commits.",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "bundle": "ncc build src/main.ts -o dist --minify",
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
    "@vercel/ncc": "^0.45.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.7.3"
  }
}
```

### 2. Functional Predicates Over Mutable Loops

Avoid accumulator objects and mutable multi-line loops. Use functional standard methods (`flatMap`, `some`, `filter`, `find`):

```typescript
// ❌ Verbose mutable loop
let bump = "none";
for (const m of messages) {
  if (isMajor(m)) { bump = "major"; break; }
}

// ✅ Ponytail functional predicate
if (messages.some(m => isMajor(m))) return "major";
if (messages.some(m => isMinor(m))) return "minor";
if (messages.some(m => isPatch(m))) return "patch";
return "none";
```

### 3. Safe Boolean and CSV Parsers

```typescript
export const getBool = (name: string, fallback = false): boolean => {
  const val = core.getInput(name).trim().toLowerCase();
  return val ? ["true", "1", "yes"].includes(val) : fallback;
};

export const parseCsv = (name: string): string[] =>
  core.getInput(name).split(",").map((s) => s.trim()).filter(Boolean);
```

### 4. Idempotent PR Comments (No Spam Pattern)

Always tag comments with a unique HTML marker to update existing comments on repeated runs rather than creating clutter:

```typescript
export const COMMENT_TAG = "<!-- my-action-identifier -->";

export async function postOrUpdateComment(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  issue_number: number,
  bodyText: string
): Promise<void> {
  const { data: comments } = await octokit.rest.issues.listComments({ owner, repo, issue_number });
  const existing = comments.find((c) => c.body?.includes(COMMENT_TAG));
  const fullBody = `${COMMENT_TAG}\n${bodyText}`;

  if (existing) {
    await octokit.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body: fullBody });
  } else {
    await octokit.rest.issues.createComment({ owner, repo, issue_number, body: fullBody });
  }
}
```

---

## 🛡️ Governance & Branch Strategy Patterns

When automating branch protection or rulesets:

1. **Use Modern Rulesets (`rest.repos.getRepoRulesets` / `createRepoRuleset` / `updateRepoRuleset`)**:
   - Modern GitHub Rulesets replace legacy branch protection.
   - Always verify if a ruleset with the target name exists; update in-place (`updateRepoRuleset`) to guarantee idempotency.
2. **Baseline Security Governance**:
   - Minimum 2 approvals (`required_approving_review_count: 2`).
   - Dismiss stale reviews on push (`dismiss_stale_reviews_on_push: true`).
   - Require review thread resolution (`required_review_thread_resolution: true`).
   - Require last push approval (`require_last_push_approval: true`).
   - Restrict bypass actors (`bypass_actors: []`).
3. **Independent Review Enforcement**:
   - PR authors and committers must not approve their own PRs.
   - Inspect all PR commit authors/committers against review state `APPROVED`.
   - Dismiss committer approvals automatically or fail the release audit check.

---

## 🚫 Anti-Patterns & Critical Pitfalls

| Anti-Pattern | Correct Ponytail / Caveman Practice | Rationale |
|---|---|---|
| Prefixed Tags (`v1.0.0`) | Strict plain `X.Y.Z` (`1.0.0`) | Eliminates regex hacks and cross-tool discrepancies. Sanitize with `.replace(/^v/, '')`. |
| Active Polling Runners | Native GitHub Environments with Review Rules | Active polling consumes runner minutes and hits 6-hour timeouts. Native environments cost $0 and wait up to 30 days. |
| Ignoring `dist/` in git | Always commit `dist/index.js` | GitHub Actions runs pre-bundled JavaScript directly. Without `dist/index.js`, consumer workflows fail immediately. |
| Rebuilding Wheel (Moment/Axios) | Native `fetch` & `Intl.DateTimeFormat` | Zero external network/parsing dependencies. Built into Node.js 18+. |
| Unmasked Tokens | `core.setSecret(token)` | Prevents secret leakage in action execution logs and exceptions. |
| Multi-call API checks | Catch specific HTTP status errors (e.g. 404, 422) | Cuts GitHub API rate-limit usage and runner latency in half. |
