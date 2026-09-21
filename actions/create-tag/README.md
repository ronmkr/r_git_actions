# Create Git Tag (`create-tag`)

A fast, zero-dependency composite GitHub Action that creates and pushes an annotated git tag (`X.Y.Z`) when a SemVer bump is detected by [`derive-next-version`](../derive-next-version).

---

## 🎯 Features

- **Ponytail Simplicity**: Native bash composite action—no Node.js build, no dependencies, no bundle drift checks.
- **Idempotent**: Skips tag creation if the tag already exists locally or remotely.
- **Strict `X.Y.Z` SemVer**: Automatically strips any leading `v` to maintain standard SemVer 2.0 tags.
- **Conditional Creation**: Skips tagging if `has-bump` is `false`.

---

## 🚀 Usage

```yaml
name: "Release & Tag"

on:
  push:
    branches: [main]

jobs:
  version-and-tag:
    runs-on: ubuntu-latest
    permissions:
      contents: write # Required to push git tags
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Calculate Next Version
        id: semver
        uses: ronmkr/r_git_actions/actions/derive-next-version@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Tag Repository
        id: tagger
        uses: ronmkr/r_git_actions/actions/create-tag@v1
        with:
          version: ${{ steps.semver.outputs.version }}
          has-bump: ${{ steps.semver.outputs.has_bump }}
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Output Tag Result
        run: |
          echo "Tag: ${{ steps.tagger.outputs.tag }}"
          echo "Created: ${{ steps.tagger.outputs.created }}"
```

---

## 📥 Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `version` | SemVer version strictly formatted as `X.Y.Z` | Yes | - |
| `has-bump` | Whether a version bump occurred (`true`/`false`). Skips tagging if `false`. | No | `true` |
| `github-token` | GitHub token or PAT with `contents: write` permission to push tag | No | `${{ github.token }}` |

---

## 📤 Outputs

| Output | Description |
|---|---|
| `tag` | The created tag name (e.g. `1.2.3`), or empty if skipped |
| `created` | `'true'` if created and pushed, `'false'` if skipped |
