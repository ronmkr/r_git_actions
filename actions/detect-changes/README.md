# Detect Changes & Needs Build (`detect-changes`)

A lightweight, zero-dependency composite GitHub Action that determines which files changed in a Pull Request or push event, evaluates whether build/test pipelines need to execute, and outputs indicators to drive conditional tagging and releases.

---

## 🎯 Features

- **Fast & Zero Dependencies**: Runs directly in native bash using `git diff`—no Node.js build, no `npm install`, instant execution.
- **Smart Path Filtering**:
  - `watch-paths`: Specify files or directories that trigger builds (e.g. `src/`, `actions/`, `package.json`).
  - `ignore-paths`: Automatically ignore non-functional changes (e.g. `docs/`, `*.md`, `.github/`, `LICENSE`).
- **Build & Tag Triggering**: Outputs `needs_build` and `has_changes` so subsequent build and tagging actions ([`create-tag`](../create-tag), [`derive-next-version`](../derive-next-version)) only execute when meaningful codebase changes occur.

---

## 🚀 Usage

```yaml
name: "CI Pipeline"

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  check-changes:
    runs-on: ubuntu-latest
    outputs:
      needs_build: ${{ steps.detect.outputs.needs_build }}
      has_changes: ${{ steps.detect.outputs.has_changes }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect Modified Files
        id: detect
        uses: ronmkr/r_git_actions/actions/detect-changes@v1
        with:
          watch-paths: "src/,actions/,package.json"
          ignore-paths: "docs/,*.md,.github/,LICENSE"

  build-and-tag:
    runs-on: ubuntu-latest
    needs: [check-changes]
    # Only run build and tagging if codebase changes exist!
    if: needs.check-changes.outputs.needs_build == 'true'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Derive Next Version
        id: semver
        uses: ronmkr/r_git_actions/actions/derive-next-version@v1
        with:
          always-bump-patch: "true"

      - name: Create Git Tag
        uses: ronmkr/r_git_actions/actions/create-tag@v1
        with:
          version: ${{ steps.semver.outputs.version }}
          has-bump: ${{ steps.semver.outputs.has_bump }}
```

---

## 📥 Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `base-ref` | Base git ref, branch, or tag to compare against | No | `origin/$GITHUB_BASE_REF` or latest tag |
| `watch-paths` | Comma-separated directories/files that require build | No | `""` (all non-ignored files) |
| `ignore-paths` | Comma-separated paths to ignore (e.g. docs, markdown) | No | `docs/,.github/,*.md,LICENSE` |

---

## 📤 Outputs

| Output | Description |
|---|---|
| `has_changes` | `'true'` if any non-ignored files changed, `'false'` otherwise |
| `needs_build` | `'true'` if watched codebase files changed requiring build/tests |
| `changed_files` | Space-separated list of modified files |
| `changed_count` | Number of modified files |
