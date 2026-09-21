# Generate Release Audit (`generate-release-audit`)

A production-ready GitHub Action that inspects all commits between two git tags or refs (e.g. `1.0.0` ➔ `1.1.0`), extracts associated Jira issue keys and Pull Requests, verifies review independence, and **fails if any PR approver was also a committer or PR author**.

---

## 🎯 Features

- **Tag-to-Tag Range Inspection**: Automatically traces commits between `base-tag` and `head-tag`.
- **Jira Issue Collection**: Scrapes all unique Jira tickets referenced in commits and PR titles/bodies (with optional `jira-project-keys` filtering).
- **Independent Review Governance Audit**:
  - Checks who authored the PR and who authored/committed any commit in that PR.
  - Verifies all final approving reviews.
  - Flags and fails if any approver self-approved or contributed code to that PR (`fail-on-violation`).
- **Markdown Summary**: Writes a formatted audit table to GitHub Actions Step Summary with links to PRs and Jira issues.

---

## 🚀 Usage

```yaml
name: "Release Governance & Audit"

on:
  push:
    tags:
      - "[0-9]+.[0-9]+.[0-9]+"

jobs:
  audit-release:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate Release Audit
        id: audit
        uses: ronmkr/r_git_actions/actions/generate-release-audit@v1
        with:
          base-tag: "1.0.0"
          head-tag: "1.1.0"
          jira-project-keys: "PROJ,CORE"
          fail-on-violation: "true"

      - name: Output Discovered Jiras
        run: |
          echo "Discovered Jiras: ${{ steps.audit.outputs.all_jiras }}"
          echo "Compliant: ${{ steps.audit.outputs.is_compliant }}"
```

---

## 📥 Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `base-tag` | Previous release tag or git ref (e.g. `1.0.0`) | Yes | - |
| `head-tag` | Current release tag, branch, or ref (e.g. `1.1.0` or `main`) | Yes | - |
| `github-token` | GitHub token for reading commit and PR review history | No | `${{ github.token }}` |
| `jira-project-keys` | Comma-separated Jira project prefixes to filter (e.g. `PROJ,CORE`) | No | `""` (all keys) |
| `fail-on-violation` | Fail workflow if any PR approver was also a committer/author | No | `true` |

---

## 📤 Outputs

| Output | Description |
|---|---|
| `total_commits` | Total commits analyzed between tags |
| `total_prs` | Number of pull requests included in the release |
| `all_jiras` | Comma-separated list of all unique Jira issue keys found |
| `violations_count` | Number of PRs with committer self-approval violations |
| `is_compliant` | `'true'` if 0 violations found, `'false'` otherwise |
