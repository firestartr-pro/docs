# Catalog Repo

The `catalog_repo` feature provides the initial setup for the catalog repository (generally named `catalog`).

This repository stores the rendered Custom Resources (CRs) that represent the organization's service catalog. The CRs are generated (*hydrated*) by rendering all claims from the claims repository using the Firestartr CLI, and the results are managed through pull requests.

## Repository Structure

- **`.config/`** - Configuration directory for globals and initializers used during the hydration process.
- **Root directory** - Contains the rendered [Backstage catalog entities](https://backstage.io/docs/features/software-catalog/descriptor-format/) YAML files representing the catalog entities.

## Workflows Provided

- **Hydrate** (`hydrate.yaml`) - Renders all claims into catalog CRs and opens a pull request with the changes. Runs on a schedule (configurable via `crontab` argument, defaults to every 6 hours) and can also be triggered manually. Supports automatic merging via the `AUTO_MERGE` control file.

## Auto-Merge Hydration PRs

Hydration pull-requests can be automatically merged by adding an empty **`AUTO_MERGE`** file to the **root** of this repository, in the **default branch**.

### How to enable

Create an empty `AUTO_MERGE` file at the root of the repository:

```bash
touch AUTO_MERGE
git add AUTO_MERGE
git commit -m "Enable auto-merge for hydration PRs"
git push
```

### How it works

- When the `AUTO_MERGE` file is present, the hydrate workflow will automatically merge the PR after creating it.
- If the file is removed, hydration PRs will require manual review and merge.
