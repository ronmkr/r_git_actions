# Prevent Committer Approval Action

Enforces independent code reviews by ensuring no PR author or committer can approve their own Pull Request. If a committer attempts to approve, the action automatically dismisses the review via GitHub REST API, logs the violation, and optionally posts an explanatory PR comment.

---

## Capabilities

- **Author & Committer Tracking**: Scans PR metadata and paginates every commit on the PR to identify all authors and committers.
- **Automatic Review Dismissal**: Revokes non-compliant approvals via `pulls.dismissReview` with an audit reason.
- **PR Feedback**: Posts or updates a sticky comment explaining the governance violation.
- **Configurable Enforcement**: Option to fail the workflow (`fail-on-violation`) or run in audit mode.
- **Bot Exclusions**: Option to ignore bot approvals (`exclude-bots`).

---

## Usage

Trigger on `pull_request` and `pull_request_review` events:

```yaml
name: "Independent Code Review Enforcement"

on:
  pull_request:
    types: [opened, synchronize, reopened]
  pull_request_review:
    types: [submitted, edited]

jobs:
  check-approvals:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write # Required to dismiss reviews and post PR comments
    steps:
      - name: Prevent Committer Approvals
        uses: ronmkr/r_git_actions/actions/prevent-committer-approval@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          fail-on-violation: "true"
          post-comment: "true"
```

---

## Permissions

| Permission | Scope | Rationale |
|---|---|---|
| `contents: read` | Repository contents | Required to read commits and Git metadata |
| `pull-requests: write` | Pull Requests | Required to dismiss reviews (`pulls.dismissReview`) and post comments |

---

## Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `github-token` | GitHub Token or PAT with `pull-requests: write` scope. | No | `${{ github.token }}` |
| `pull-number` | Target PR number (auto-detected from event context). | No | PR context number |
| `repository` | Target repository in `'owner/repo'` format. | No | `${{ github.repository }}` |
| `dismiss-message` | Audit reason supplied when dismissing a review. | No | `"Automated Governance: PR authors and committers cannot approve their own pull requests."` |
| `post-comment` | Post an explanatory comment on the PR when dismissing. | No | `"true"` |
| `fail-on-violation` | Fail the workflow step when a committer approval is detected. | No | `"true"` |
| `exclude-bots` | Ignore bot accounts when inspecting approval reviews. | No | `"false"` |

---

## Outputs

| Output | Description |
|---|---|
| `has-violation` | `'true'` if any committer or author approval was detected, `'false'` otherwise. |
| `dismissed-approvers` | Comma-separated list of reviewer usernames whose approvals were dismissed. |
| `dismissed-count` | Total count of dismissed non-compliant reviews. |
