# State GitHub

The `state_github` feature provides the initial setup for the GitHub state repository (generally named `state-github`).

This repository stores the rendered Custom Resources (CRs) for GitHub-related claims such as `ComponentClaim` (repositories), `GroupClaim` (teams), `UserClaim` (memberships), and `OrgWebhookClaim` (organization webhooks). The CRs in this repository are generated (*hydrated*) by the claims repository workflows and managed through pull requests.

## Repository Structure

- **`.config/`** - Configuration directory containing:
  - **`resources/`** - Default values for GitHub resource claims (`defaults_github_group.yaml`, `defaults_github_membership.yaml`, `defaults_github_repository.yaml`).
  - **`branch_strategies.yaml`** - Branch protection strategies configuration.
  - **`expander_branch_strategies.yaml`** - Expander branch strategies for component claims.
- **Root directory** - Contains the rendered CR files (`.yaml`) generated from the claims repository.

## Workflows Provided

- **Auto-merge** (`auto-merge.yaml`) - Automatically merges hydration pull requests when the `AUTO_MERGE` control file is present.

## Auto-Merge Hydration PRs

Hydration pull-requests created by the claims repository workflows can be automatically merged by adding an empty **`AUTO_MERGE`** file to the **root** of this repository, in the **default branch**.

### How to enable

Create an empty `AUTO_MERGE` file at the root of the repository:

```bash
touch AUTO_MERGE
git add AUTO_MERGE
git commit -m "Enable auto-merge for hydration PRs"
git push
```

### How it works

- When the `AUTO_MERGE` file is present, any hydration PR (branches starting with `automated/`) will be automatically merged.
- If the file is removed, hydration PRs will require manual review and merge.
- The auto-merge is also supported via the `automerge` input in the claims repository hydrate workflow.
