# Validate Commit Messages Action

Validates Git commit messages against Jira issue key regex patterns, optional Conventional Commits formatting, and optional Jira REST API issue status checks.

---

## Usage

### 1. Jira Key Validation (Default)

Validates that all commit messages contain a Jira issue key (e.g. `PROJ-123`).

```yaml
name: "Commit Validation"

on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write # Required if post-pr-comment is true
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Validate Jira ID
        uses: ronmkr/r_git_actions/actions/validate-commit@v1
        with:
          require-jira-id: "true"
          jira-project-keys: "PROJ,CORE" # Optional: restrict to specific prefixes
```

### 2. Jira Key + Conventional Commits

```yaml
      - name: Validate Jira ID and Conventional Commit
        uses: ronmkr/r_git_actions/actions/validate-commit@v1
        with:
          require-jira-id: "true"
          check-conventional-commit: "true"
```

### 3. Jira Key + Jira REST API Status Check

Verifies that the referenced Jira ticket exists and is in an acceptable workflow state:

```yaml
      - name: Validate Jira ID and Jira Status
        uses: ronmkr/r_git_actions/actions/validate-commit@v1
        with:
          require-jira-id: "true"
          validate-jira-status: "true"
          jira-base-url: "https://yourcompany.atlassian.net"
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
          jira-user-email: ${{ secrets.JIRA_USER_EMAIL }}
          allowed-jira-statuses: "In Progress,Work In Progress,In Development"
          disallowed-jira-statuses: "Open,To Do,To-Do,Todo,Backlog"
```

---

## Permissions

| Permission | Scope | Rationale |
|---|---|---|
| `contents: read` | Repository contents | Required to read commits and Git log |
| `pull-requests: write` | Pull Requests | Required when `post-pr-comment: true` to publish feedback |

---

## Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `commit-message` | Explicit commit message to validate. If omitted, extracted from PR commits or HEAD. | No | `""` |
| `require-jira-id` | Require a Jira issue key (regex) in commit messages. | No | `"true"` |
| `jira-regex` | Custom regex pattern for Jira keys. | No | `""` (`\b([A-Z][A-Z0-9]+-[0-9]+)\b`) |
| `jira-project-keys` | Comma-separated allowed Jira project prefixes (e.g. `PROJ,CORE`). | No | `""` (allows any valid key) |
| `check-conventional-commit` | Validate Conventional Commits format (`<type>(<scope>): <subject>`). | No | `"false"` |
| `validate-jira-status` | Query Jira REST API to verify issue status. | No | `"false"` |
| `jira-base-url` | Jira instance base URL. Required if `validate-jira-status: true`. | No | `""` |
| `jira-api-token` | Jira API token (Cloud) or PAT (Server/DC). Required if `validate-jira-status: true`. | No | `""` |
| `jira-user-email` | Jira account email (Cloud Basic Auth). Required if `validate-jira-status: true` on Cloud. | No | `""` |
| `allowed-jira-statuses` | Comma-separated acceptable Jira issue statuses. | No | `"In Progress,Work In Progress,In Development"` |
| `check-all-pr-commits` | Validate all commits in PR (`true`) or only HEAD (`false`). | No | `"true"` |
| `post-pr-comment` | Post or update sticky comment on PR when validation fails. | No | `"true"` |
| `github-token` | GitHub token for reading PR commits and posting PR comments. | No | `${{ github.token }}` |

---

## Outputs

| Output | Description |
|---|---|
| `is-valid` | `"true"` if all enabled validations passed, `"false"` otherwise. |
| `jira-id` | Comma-separated list of detected Jira issue keys. |
| `jira-status` | Comma-separated list of issue statuses returned from Jira API. |
| `errors` | Newline-separated list of validation failure messages. |

---

## Valid Commit Examples

- `[PROJ-123] Updated database schema` (Passes Jira regex)
- `PROJ-123: fix(auth): resolve session timeout` (Passes Jira regex + Conventional Commits)
- `feat(billing): [PROJ-456] integrate stripe elements` (Passes Jira regex + Conventional Commits)
- `feat: implement user onboarding flow (PROJ-789)` (Passes Jira regex + Conventional Commits)
