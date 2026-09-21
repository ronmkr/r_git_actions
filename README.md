# Reusable GitHub Actions (`r_git_actions`)

A centralized collection of production-ready, reusable GitHub Actions built with the **official GitHub Actions Toolkit** and running natively on **Node 20**.

---

## 📦 Available Actions

| Action | Description | Path | Runtime |
|---|---|---|---|
| **[validate-commit](actions/validate-commit/README.md)** | Validates commit messages across PR commits with Jira key regex, optional Conventional Commits, and optional Jira REST API status check. | `ronmkr/r_git_actions/actions/validate-commit@v1` | Node 20 |
| **[setup-branching-strategy](actions/setup-branching-strategy/README.md)** | Idempotently creates branches and applies **GitHub Repository Rulesets** with industry best practices (minimum 2 approvers, CODEOWNERS, thread resolution, blocks direct commits). | `ronmkr/r_git_actions/actions/setup-branching-strategy@v1` | Node 20 |
| **[prevent-committer-approval](actions/prevent-committer-approval/README.md)** | Enforces strictly independent code reviews by preventing PR authors and committers from approving their own PRs, automatically dismissing self-approvals via GitHub REST API. | `ronmkr/r_git_actions/actions/prevent-committer-approval@v1` | Node 20 |
| **[validate-branch-promotion](actions/validate-branch-promotion/README.md)** | Enforces structured branch merge promotion policies (e.g. `dev -> uat -> prd` in GitOps, `develop -> main` in GitFlow) on Pull Requests. | `ronmkr/r_git_actions/actions/validate-branch-promotion@v1` | Node 20 |

---

## 🚀 Quick Usage

### 1. Enforce Commit Standards (`validate-commit`)

```yaml
name: "Commit Compliance"

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Validate PR Commits
        uses: ronmkr/r_git_actions/actions/validate-commit@v1
        with:
          require-jira-id: "true"
          jira-project-keys: "PROJ,CORE"
          check-conventional-commit: "true"
```

### 2. Prevent Committer Self-Approvals (`prevent-committer-approval`)

```yaml
name: "Independent Code Review Enforcement"

on:
  pull_request:
    types: [opened, synchronize, reopened]
  pull_request_review:
    types: [submitted, edited]

jobs:
  enforce-independent-review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write # Required to dismiss non-compliant reviews
    steps:
      - name: Dismiss Committer Approvals
        uses: ronmkr/r_git_actions/actions/prevent-committer-approval@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          fail-on-violation: "true"
          post-comment: "true"
```

### 3. Validate PR Branch Promotion Flow (`validate-branch-promotion`)

```yaml
name: "Branch Promotion Compliance"

on:
  pull_request:
    branches: [main, develop, uat, prd]

jobs:
  check-promotion:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write # Required for posting explanatory PR feedback comments
    steps:
      - name: Validate Promotion Hierarchy
        uses: ronmkr/r_git_actions/actions/validate-branch-promotion@v1
        with:
          strategy: "gitops" # Enforces dev -> uat -> prd
          fail-on-violation: "true"
          post-comment: "true"
```

### 4. Setup Branches & GitHub Rulesets (`setup-branching-strategy`)

```yaml
name: "Setup Branching Strategy"

on:
  workflow_dispatch:

jobs:
  setup-rulesets:
    runs-on: ubuntu-latest
    steps:
      - name: Setup GitOps Strategy with Rulesets
        uses: ronmkr/r_git_actions/actions/setup-branching-strategy@v1
        with:
          strategy: "gitops"
          allowed-actors: "ronmkr,alice" # Restrict workflow execution
          required-approvals: "2"       # Production baseline (min 2)
          require-code-owner-review: "true"
          require-review-thread-resolution: "true"
          require-last-push-approval: "true"
          github-token: ${{ secrets.ADMIN_PAT }}
```

---

## 🗂 Repository Structure

```text
r_git_actions/
├── .github/
│   ├── dependabot.yml           # Automated weekly dependency updates across all actions
│   └── workflows/
│       └── ci.yml               # Automated CI test suite, linting, and bundle drift checks
├── actions/                     # Individual reusable actions
│   ├── prevent-committer-approval/
│   │   ├── action.yml           # Action metadata (Node 20 runtime)
│   │   ├── package.json         # Toolkit dependencies
│   │   ├── src/
│   │   │   ├── main.ts          # Action orchestration
│   │   │   ├── committers.ts    # Extract all PR authors & committers
│   │   │   ├── reviews.ts       # Resolve active approval decisions
│   │   │   ├── dismissal.ts     # Dismiss non-compliant self-approvals
│   │   │   ├── comment.ts       # Idempotent PR governance comment
│   │   │   └── __tests__/       # Comprehensive Jest unit test suite (9 tests)
│   │   ├── dist/
│   │   │   └── index.js         # Compiled standalone executable
│   │   └── README.md            # Action documentation
│   ├── setup-branching-strategy/
│   │   ├── action.yml           # Action metadata (Node 20 runtime)
│   │   ├── package.json         # Toolkit dependencies
│   │   ├── src/
│   │   │   ├── main.ts          # Action orchestration (branch & ruleset provisioning)
│   │   │   ├── strategies.ts    # Model configurations (Trunk, GitFlow, GitOps, Custom)
│   │   │   ├── branch-manager.ts# Branch existence and base SHA branch creation
│   │   │   ├── ruleset-manager.ts# Modern GitHub Rulesets API (idempotent, no duplicates)
│   │   │   ├── auth-check.ts    # Workflow execution actor authorization
│   │   │   ├── comment.ts       # PR branching strategy feedback comment
│   │   │   └── __tests__/       # Comprehensive Jest unit test suite (16 tests)
│   │   ├── dist/
│   │   │   └── index.js         # Compiled standalone executable
│   │   └── README.md            # Action documentation
│   ├── validate-branch-promotion/
│   │   ├── action.yml           # Action metadata (Node 20 runtime)
│   │   ├── package.json         # Toolkit dependencies
│   │   ├── src/
│   │   │   ├── main.ts          # Action orchestration (promotion validation)
│   │   │   ├── promotion-rules.ts# Promotion hierarchy rules engine
│   │   │   ├── comment.ts       # Idempotent PR promotion feedback comment
│   │   │   └── __tests__/       # Comprehensive Jest unit test suite (15 tests)
│   │   ├── dist/
│   │   │   └── index.js         # Compiled standalone executable
│   │   └── README.md            # Action documentation
│   └── validate-commit/
│       ├── action.yml           # Action metadata (Node 20 runtime)
│       ├── package.json         # Toolkit dependencies
│       ├── src/
│       │   ├── main.ts          # Action orchestration
│       │   ├── jira-regex.ts    # Regex parsing & project key validation
│       │   ├── conventional-commit.ts # Conventional Commits parsing
│       │   ├── jira-api.ts      # Native fetch Jira REST API client
│       │   ├── github-comment.ts# Idempotent PR commenting
│       │   ├── git.ts           # Octokit commit extractor (PR pagination)
│       │   └── __tests__/       # Comprehensive Jest unit test suite (19 tests)
│       ├── dist/
│       │   └── index.js         # Compiled standalone executable
│       └── README.md            # Action documentation
├── .gitignore                   # Ignores node_modules, keeps dist/ tracked
├── LICENSE                      # MIT License
└── README.md
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
