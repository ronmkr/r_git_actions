# Action Approval Gate (`action-approval-gate`)

A lean, synchronous approval guard action that validates prior step/workflow outcomes (e.g., verifying `terraform plan` was green) and actor permissions before proceeding to production jobs.

Designed to work seamlessly with **native GitHub Environment Protection Rules**, providing interactive **"Approve and deploy"** and **"Reject"** UI buttons that can stay open for days with **zero runner execution costs**.

---

## 🎯 Why This Architecture?

- **0 Runner Minute Waste**: Active polling loops hold open runners and hit GitHub's 6-hour runner limit.
- **Days-Long Approvals**: GitHub native environments support approval windows of up to **30 days** while runners remain completely idle.
- **Native GitHub UI**: Designated approvers receive email/slack notifications and review directly via GitHub's native **"Review deployments"** dialog:
  - 🟢 **Approve and deploy**
  - 🔴 **Reject**
- **Outcome & Actor Guard**: `action-approval-gate` guarantees that subsequent approval/apply jobs only run if prior steps succeeded (`previous-outcome === expected-outcome`) and the triggering actor is authorized.

---

## 🚀 Recommended Pipeline: Terraform Plan & Apply

```yaml
name: "Terraform Pipeline"

on:
  pull_request:
    branches: [main]

jobs:
  plan:
    name: "1. Terraform Plan"
    runs-on: ubuntu-latest
    outputs:
      plan_outcome: ${{ steps.tf_plan.outcome }}
    steps:
      - uses: actions/checkout@v4
      - id: tf_plan
        run: echo "Running terraform plan... green"

  gate:
    name: "2. Validate Plan Outcome"
    runs-on: ubuntu-latest
    needs: [plan]
    steps:
      - name: Verify Plan Succeeded
        uses: ronmkr/r_git_actions/actions/action-approval-gate@v1
        with:
          previous-outcome: ${{ needs.plan.outputs.plan_outcome }}
          expected-outcome: "success"
          allowed-actors: "ronmkr,alice"

  apply:
    name: "3. Terraform Apply (Awaits Review)"
    runs-on: ubuntu-latest
    needs: [gate]
    # Native GitHub UI Review Buttons ('Approve and deploy' or 'Reject'):
    # Configure in Repo Settings -> Environments -> 'production' -> Required reviewers
    environment: production
    steps:
      - uses: actions/checkout@v4
      - run: echo "Applying terraform changes..."
```

---

## 📥 Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `previous-outcome` | Outcome of previous step/job (e.g. `${{ steps.tf_plan.outcome }}`) | No | `success` |
| `expected-outcome` | Required outcome to proceed | No | `success` |
| `allowed-actors` | Comma-separated list of authorized usernames | No | `""` (allow all) |

---

## 📤 Outputs

| Output | Description |
|---|---|
| `is-valid` | `'true'` if previous outcome matches and actor is authorized, `'false'` otherwise |
| `actor` | Evaluated GitHub username |
