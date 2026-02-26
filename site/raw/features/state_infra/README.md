# State Infra

The `state_infra` feature provides the initial setup for the infrastructure state repository (generally named `state-infra`).

This repository stores the rendered Custom Resources (CRs) for infrastructure-related claims such as `TFWorkspaceClaim` and `SecretsClaim`. The CRs in this repository are generated (*hydrated*) by the claims repository workflows and managed through pull requests.

## Repository Structure

- **`.config/`** - Configuration directory for resource defaults and initializers used during hydration.
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
