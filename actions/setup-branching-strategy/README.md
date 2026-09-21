# Setup Branching Strategy Action

Idempotently creates branches and configures **GitHub Repository Rulesets** with enterprise best practices: minimum 2 approvers, CODEOWNERS approval, thread resolution, last push approval, linear history, and direct commit blocking.

---

## Capabilities

- **GitHub Repository Rulesets**: Uses GitHub's modern Rulesets API instead of legacy branch protection.
- **Idempotent Updates**: Checks if the named ruleset already exists; updates it in-place (`PUT`) rather than creating duplicates.
- **Direct Commits Blocked**: Requires pull requests with zero bypasses—no direct pushes to protected branches (`main`, `develop`, `dev`, `uat`, `prd`).
- **Production Guardrails**:
  - Minimum 2 required approvers
  - Dismiss stale approvals on push
  - Require review thread resolution
  - Require approval from someone other than the last pusher
  - Require CODEOWNERS review
  - Require linear history (squash/rebase only)
  - Prevent branch deletion and force pushes
- **Execution Control**: Restrict who can trigger branching setup via `allowed-actors`.

---

## Usage

### 1. GitOps Strategy (`dev`, `uat`, `prd`)

```yaml
name: "Setup GitOps Strategy"

on:
  workflow_dispatch:

jobs:
  configure-strategy:
    runs-on: ubuntu-latest
    steps:
      - name: Configure GitOps Branches and Ruleset
        uses: ronmkr/r_git_actions/actions/setup-branching-strategy@v1
        with:
          strategy: "gitops"
          allowed-actors: "ronmkr,lead-devops"
          github-token: ${{ secrets.ADMIN_PAT }} # Requires admin:repo or repo scope
          required-approvals: "2"
          dismiss-stale-reviews: "true"
          require-review-thread-resolution: "true"
          require-last-push-approval: "true"
          require-code-owner-review: "true"
          require-linear-history: "true"
```

### 2. GitFlow Strategy (`main`, `develop`)

```yaml
name: "Setup GitFlow Strategy"

on:
  workflow_dispatch:

jobs:
  configure-strategy:
    runs-on: ubuntu-latest
    steps:
      - name: Configure GitFlow Branches and Ruleset
        uses: ronmkr/r_git_actions/actions/setup-branching-strategy@v1
        with:
          strategy: "gitflow"
          github-token: ${{ secrets.ADMIN_PAT }}
          update-default-branch: "true" # Sets 'develop' as default branch on GitHub
```

---

## Permissions & Token Requirements

Managing repository rulesets and default branches requires elevated permissions that exceed the default `GITHUB_TOKEN`.

| Auth Option | Required Scope / Permissions |
|---|---|
| **Personal Access Token (PAT)** | `repo` or `admin:repo` |
| **Fine-Grained PAT / GitHub App** | Repository permissions: `Administration: Read and write`, `Contents: Read and write` |

---

## Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `strategy` | Branching model: `'trunk-based'`, `'gitflow'`, `'gitops'`, or `'custom'`. | No | `"trunk-based"` |
| `allowed-actors` | Comma-separated usernames permitted to execute this action. Leave empty to allow all. | No | `""` |
| `ruleset-name` | Name of GitHub Ruleset (updates existing ruleset if found). | No | `"Strategy: <STRATEGY>"` |
| `repository` | Target repository in `'owner/repo'` format. | No | `${{ github.repository }}` |
| `github-token` | GitHub Token or PAT with admin scope. | No | `${{ github.token }}` |
| `default-branch` | Base branch to branch new branches from. | No | `"main"` |
| `branches` | Comma-separated branches (used when `strategy: custom` or to add extras). | No | `""` |
| `enforce-protection` | Whether to create or update GitHub Rulesets on the managed branches. | No | `"true"` |
| `required-approvals` | Number of required approving reviews (best practice: minimum 2). | No | `"2"` |
| `dismiss-stale-reviews` | Dismiss previous approvals when new commits are pushed. | No | `"true"` |
| `require-review-thread-resolution` | Require all review conversations to be resolved before merge. | No | `"true"` |
| `require-last-push-approval` | Require approval from someone other than the last pusher. | No | `"true"` |
| `require-code-owner-review` | Require approval from designated CODEOWNERS. | No | `"true"` |
| `require-linear-history` | Prevent merge commits and enforce linear history. | No | `"true"` |
| `require-signed-commits` | Require all commits pushed to protected branches to be signed. | No | `"false"` |
| `update-default-branch` | Update repo's default branch on GitHub to match strategy. | No | `"false"` |
| `post-comment` | Post or update an explanatory comment on the PR if executed in PR context. | No | `"true"` |

---

## Outputs

| Output | Description |
|---|---|
| `strategy` | Branching strategy that was applied. |
| `created-branches` | Comma-separated list of branches newly created. |
| `ruleset-id` | The GitHub Ruleset ID created or updated. |
| `ruleset-action` | Whether the ruleset was `'created'` or `'updated'`. |
| `default-branch` | Configured default branch. |
