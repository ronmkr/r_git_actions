# Validate Branch Promotion Flow Action

Enforces Pull Request branch merge promotion policies (e.g. GitOps `dev -> uat -> prd`, GitFlow `develop -> main`) to prevent developers from skipping environments or merging feature branches directly into production.

---

## Supported Promotion Strategies

- **GitOps (`dev -> uat -> prd`)**:
  - `dev`: Accepts feature and bugfix branches.
  - `uat`: Accepts merges **only** from `dev` (or `hotfix/*`).
  - `prd` / `prod`: Accepts merges **only** from `uat` (or `hotfix/*`).
  - Skips (e.g. `dev -> prd`) and direct feature merges to `uat`/`prd` are blocked.
- **GitFlow (`develop -> main`)**:
  - `develop`: Accepts feature and bugfix branches.
  - `main`: Accepts merges **only** from `develop` (or `release/*`, `hotfix/*`).
  - Direct feature merges to `main` are blocked.
- **Trunk-Based (`main`)**:
  - `main`: Accepts feature, fix, and release branches.
- **Custom (`custom-promotion-order`)**:
  - Accepts user-defined order (e.g., `alpha,beta,prod`).
  - Each environment `N` only accepts merges from environment `N-1` (or `hotfix/*`).

---

## Usage

```yaml
name: "Branch Promotion Compliance"

on:
  pull_request:
    branches:
      - main
      - develop
      - uat
      - prd
      - prod

jobs:
  check-promotion:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write # Required if post-comment is true
    steps:
      - name: Validate Promotion Flow
        uses: ronmkr/r_git_actions/actions/validate-branch-promotion@v1
        with:
          strategy: "gitops" # or "gitflow", "trunk-based", "custom"
          fail-on-violation: "true"
          post-comment: "true"
```

---

## Permissions

| Permission | Scope | Rationale |
|---|---|---|
| `contents: read` | Repository contents | Required to read PR base/head branch metadata |
| `pull-requests: write` | Pull Requests | Required when `post-comment: true` to publish feedback |

---

## Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `strategy` | Strategy to enforce: `'gitops'`, `'gitflow'`, `'trunk-based'`, or `'custom'`. | No | `"gitops"` |
| `base-branch` | Target branch being merged into. Defaults to PR base ref. | No | `""` |
| `head-branch` | Source branch being merged from. Defaults to PR head ref. | No | `""` |
| `default-branch` | Primary production branch (typically `'main'`). | No | `"main"` |
| `custom-promotion-order` | Comma-separated sequential branches for custom strategy (e.g. `'dev,staging,prod'`). | No | `""` |
| `fail-on-violation` | Whether to fail the workflow run if promotion hierarchy is violated. | No | `"true"` |
| `post-comment` | Whether to post an idempotent explanatory comment on the PR on failure. | No | `"true"` |
| `github-token` | GitHub token for posting PR comments. | No | `${{ github.token }}` |
| `repository` | Target repository in `'owner/repo'` format. | No | `${{ github.repository }}` |

---

## Outputs

| Output | Description |
|---|---|
| `is-valid` | `'true'` if promotion flow is valid, `'false'` otherwise. |
| `strategy` | Evaluated strategy name. |
| `base-branch` | Evaluated target branch. |
| `head-branch` | Evaluated source branch. |
| `violation-reason` | Reason for violation if invalid. |
