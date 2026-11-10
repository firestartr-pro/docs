# Claims repo feature

## Overview

This feature installs the workflows used to manually hydrate and delete GitHub and Terraform Workspace claims, import existing GitHub resources into claims, and keep claims' features up to date.

This feature installs the workflows necessary for manually hydrating and deleting GitHub and TFWorkspace claims, plus two additional workflows to import manually created GitHub resources into GitHub claims and a `pr-verify` workflow.

## Repository Labels

This feature declares the following GitHub repository label, created on the repository when the feature is installed:

| Label | Color | Purpose |
|---|---|---|
| `auto-hydrate` | `EFE802` | Triggers the auto-hydrate workflow when added to a pull request. |

## Local claims runner

Use the provided `docker-compose.yaml` when you want to run Firestartr CLI commands against a local checkout of the claims repo.

1. Set the image tag you want to run, if needed, with `FIRESTART_CLI_IMAGE_TAG`.
2. Set `TF_CMD` to the command you want the container to execute.
3. Set `CLAIM` to the TFWorkspace claim name you want to target.
4. Run `docker compose up` from the claims repo root.

The compose service mounts your local claims repo checkout (including the `claims/` directory) plus your `~/.kube` and `~/.azure` directories so the CLI can reach local credentials and repository files. The image comes from `ghcr.io/firestartr-pro/firestartr`, so picking the right tag matters when you need a specific CLI build or plan behavior.

## Hydrating claims

1. Create a PR with the desired changes. Check the changes that have been commited are the changes you've actually done.

2. Once the `pr-verify` workflow is finished, if there are no errors, merge your PR into the main branch.

3. Head over to the `Actions` tab of the `claims` repo and select the `<Your claim type> claim: hydrate` workflow on the left side list.

![The Actions tabs](./images/claims_repo-example_1-1.jpg)
*The Actions tabs*

4. Select `Run workflow` on the right hand side of the screen. In the `name` field introduce the name of the claim to be hydrated, a comma-separated list of claim names, or `*` to hydrate **every** claim of the selected kind. Optionally use `excludedClaims` to leave specific names out (each excluded name must be part of the selection). Select the claim type (GitHub claims only). NOTE: a claim name should be the value of the field `name` inside the claim YAML. Setting this value to the file name may result in the workflow not working as expected.

Available GitHub claim types — exactly the kinds the claim type dropdown offers and the workflows route:
- `ComponentClaim` — hydrates `FirestartrGithubRepository`, `FirestartrGithubRepositoryFeature`, and `FirestartrGithubRepositorySecretsSection` CRs.
- `UserClaim` — hydrates `FirestartrGithubMembership` CRs.
- `GroupClaim` — hydrates `FirestartrGithubGroup` CRs.
- `OrgWebhookClaim` — hydrates `FirestartrGithubOrgWebhook` CRs.
- `OrgSettingsClaim` — hydrates **3** CRs: `FirestartrGithubOrganizationSettings`, `FirestartrGithubOrganizationVariableSection` when the claim declares `actions_variables`, and `FirestartrGithubOrganizationSecretsSection`. The org secrets artifact is **not pending**: it is already rendered and applied, and hydrate and delete both carry it in their allowlists.

> **Note:** `GitHubOrgClaim` is no longer supported. If you have existing claim files using `kind: GitHubOrgClaim`, migrate them to `kind: OrgSettingsClaim`.

![Hydrating a GitHub claim](./images/claims_repo-example_1-2.jpg)
*Hydrating a GitHub claim*

![Hydrating a TFWorkspace claim](./images/claims_repo-example_1-3.jpg)
*Hydrating a TFWorkspace claim*

![Hydrating a Secrets claim](./images/claims_repo-example_1-3.1.jpg)
*Hydrating a Secrets claim*

5. Press the green button and wait for the workflow to finish. When it's done, click its entry in the list and there'll be a link to the `state-github`, `state-infra` or `state-secrets` repo PR. You can use it to review the PR and merge it if everything is correct.

![The action summary](./images/claims_repo-example_1-4.jpg)
*The action summary with a link to the state repo*

💡 The hydrate workflows open the state repo PR with the `automated/` branch prefix, so the state repo decides whether to auto-merge it. To keep the PR open for manual review even if the state repo is configured to auto-merge, check **Never auto-merge** (`neverAutomerge`): the PR then opens with the `automated-non-automerge/` prefix, which the state repo ignores. The `reimport` and `uninstall-repository-feature` workflows have the same checkbox.

### Mass hydration

When `name` is a comma-separated list or `*`, the workflow renders and hydrates the whole selection of the chosen kind in a single run and opens **one pull request per state repo** (instead of one per claim). The branch is chosen from the number of claims the selection resolves to:

- **One claim** — a single name, or a list/`*`/`excludedClaims` narrowed to one — uses the same deterministic branch as a normal hydration of that claim (`automated/<claim>-<name>`, or `automated-non-automerge/...`). It is shared with single-claim runs, so a later run for that claim replaces it.
- **Two or more** — uses the run-scoped branch `automated/mass-<kind>-<run-id>` (or `automated-non-automerge/mass-<kind>-<run-id>`), where `<run-id>` is the workflow run id, so each run gets its own branch and never replaces another run's open pull request.

Every hydrated CR gets its `firestartr.dev/last-state-pr` annotation updated to that pull request.

- `name` is mandatory: use a comma-separated list, or `*` for all claims of the kind.
- `excludedClaims` is optional; it must match names in the selection, and the run fails if any excluded value is not part of the selection.
- If the selection ends up empty, the run finishes without opening a pull request.
- If an explicitly requested (non-`*`) claim does not exist, the run fails fast without opening a pull request.
- TFWorkspace variants are still hydrated as separate pull requests (one per variant).

### Auto-hydrate

The `♻️ Auto Hydrate` workflow hydrates the claims a PR touches when the PR is merged into the base branch, so you don't have to run the hydrate workflow by hand.

- Hydration happens once, after the merge. Change detection uses the merge commit, so only the claims that PR touched are hydrated. The hydrate workflow then renders the base branch as it was when that run was dispatched, so the state repos converge to the latest `main` and an older snapshot never overwrites a later merge.
- The state repo PRs open with the `automated/` branch prefix, so each state repo decides whether to auto-merge them with its own rules (the `AUTO_MERGE` file and its required checks). Auto-hydrate has no auto-merge configuration of its own.
- To skip auto-hydrate for a single PR, add the `no-auto-hydrate` label before merging.
- PRs that don't touch `claims/` and PRs from forks are ignored.
- PRs opened by a bot (the `provision-claim`, import and delete workflows) are ignored, and so are PRs merged by a bot. `provision-claim` dispatches its own hydration, the delete workflows must not hydrate, and bot-opened import and `update-features` PRs need a manual hydrate after merging.
- Auto-hydrate never deletes claims. If a PR deletes one claim and changes another, the changes hydrate and the deletion is skipped with a comment pointing at the delete workflows. Use those workflows to remove a claim.

## Deleting claims

1. Head over to the `Actions` tab of the `claims` repo and select the `<Your claim type> claim: delete` workflow on the left side list.

![The Actions tabs](./images/claims_repo-example_2-1.jpg)
*The Actions tabs*

2. Select `Run workflow` on the right hand side of the screen, introduce the name of the claim to be deleted and select the claim type (if it is a GitHub claim). NOTE: the name of the claim should be the value of the field `name` inside the claim YAML. Setting this value to the file name may result in the workflow not working as expected.

The same claim types listed for [hydrating](#hydrating-claims) are available for deletion.

![Deleting a GitHub claim](./images/claims_repo-example_2-2.jpg)
*Deleting a GitHub claim*

![Deleting a TFWorkspace claim](./images/claims_repo-example_2-3.jpg)
*Deleting a TFWorkspace claim*

![Deleting a Secrets claim](./images/claims_repo-example_2-3.1.jpg)
*Deleting a Secrets claim*

3. Press the green button and wait for the workflow to finish. When it's done, click its entry in the list and there'll be two links: one to the `state-github`, `state-infra` or `state-secrets` repo PR, deleting the CR file, and another to the `claims` repo PR, deleting the claim file. You can use them to review both PRs and merge them if everything is correct.

![The action summary](./images/claims_repo-example_2-4.jpg)
*The action summary with two links to the state and claims repo*


## Import already created GitHub resources

1. Head over to the `Actions` tab of the `claims` repo and select the `📜 Import GitHub resources` workflow on the left side list.

![The Actions tabs](./images/claims_repo-example_3-1.jpg)
*The Actions tabs*

2. Select `Run workflow` on the right hand side of the screen, and add filters to the type of resources you want to import. The filters can be:

- **REGEXP=[regex]**: import all resources that match the regex [regex].
- **NAME=[name]**: import all resources with the name [name]. The name must be an exact match.
- **SKIP=SKIP**: skip this import.

![Import GitHub resources](./images/claims_repo-example_3-2.jpg)

3. Press the green button and wait for the workflow to finish. Once the workflow is finished, a PR will be created both in the `state-github` repo and the `claims` repo. Merge them both and the resource will be imported.

- **Never auto-merge** (`neverAutomerge`): keeps the `state-github` PR open for manual review even if the state repo is configured to auto-merge. Defaults to `false`.
- **Auto-merge claims PR** (`automergeClaimsPr`): merges the PR opened in the `claims` repo as long as it passes all checks. Defaults to `true`.

## Update feature in all claims
1. Head over to the `Actions` tab of the `claims` repo and select the `Update features` workflow on the left side list.
2. Select `Run workflow` on the right hand side of the screen, and add filters to narrow the features and claims you want to update. The filters can be:
  - **Features list**: mandatory filter. Either a single feature name or a list of comma separated values, each being a different feature name.
  - **Claims list**: optional filter. Either a single `claim.name`, a list of comma separated values, each being a different `claim.name` or an empty value, which will update all applicable claims. Note that `claim.name` refers to the value of the `name` field inside the `claim` YAML file and not to the name of the YAML file itself.
  - **Version constraint**: optional filter. Either a valid version, a valid version constraint or an empty value, which will update to the latest avaliable version. A valid version is a version that's avaliable for all features in `Features list`, in the `major.minor.patch` semver format, and will result in the feature being updated to that exact version. Valid version constraint documentation can be found [here](https://github.com/Masterminds/semver?tab=readme-ov-file#basic-comparisons) (comparisions work fine too) and will result in the feature being updated to the latest version avaliable that satisfies the specified constraint.
  The workflow will then create a PR for each claim that was updated, with a list of changes made since the version that was currently installed up until the version that was updated to. Merge them all and then [hydrate the claims](#hydrating-claims).
  - **Automerge**: optional filter. Setting this value to `true` will automerge the PRs created by this workflow as long as they pass all checks and have no conflicts. Defaults to `false`.

![alt text](./images/claims_repo-update-features.png)

💡 If you are using a **ref** instead of a version for the feature you want to update, the workflow will trigger the hydration process, to update the claims with the latest changes from the ref. In this case, the version constraint filter will be ignored.

## Massively updating claims' features

1. Head over to the `Actions` tab of the `claims` repo and select the `Update claims' features` workflow on the left side list.

![The Actions tabs](./images/claims_repo-example_4-1.jpg)
*The Actions tabs*

2. Select `Run workflow` on the right hand side of the screen, and add filters to narrow the features and claims you want to update. The filters can be:

- **Features list**: mandatory filter. Either a single feature name or a list of comma separated values, each being a different feature name.
- **Claims list**: optional filter. Either a single `claim.name`, a list of comma separated values, each being a different `claim.name` or an empty value, which will update all applicable claims. Note that `claim.name` refers to the value of the `name` field inside the `claim` YAML file and not to the name of the YAML file itself.
- **Version constraint**: optional filter. Either a valid version, a valid version constraint or an empty value, which will update to the latest avaliable version. A valid version is a version that's avaliable for all features in `Features list`, in the `major.minor.patch` semver format, and will result in the feature being updated to that exact version. Valid version constraint documentation can be found [here](https://github.com/Masterminds/semver?tab=readme-ov-file#basic-comparisons) (comparisions work fine too) and will result in the feature being updated to the latest version avaliable that satisfies the specified constraint.
- **Automerge**: optional filter. Setting this value to `true` will automerge the PRs created by this workflow as long as they pass all checks and have no conflicts. Defaults to `false`.
![Update claims' features](./images/claims_repo-example_4-2.jpg)


3. Press the green button and wait for the workflow to finish. Once the workflow is finished, a PR will be created for each claim that was updated. The PR body will contain a list of changes made since the version that was currently installed up until the version that was updated to. Merge them all and then [hydrate the claims](#hydrating-claims)

## Feature arguments

- `state_github_repo`: the name of the repository where the GitHub related CRs are stored. Defaults to `state-github`
- `state_infra_repo`: the name of the repository where the Terraform related CRs are stored. Defaults to `state-infra`
- `state_secrets_repo`: the name of the repository where the ExternalSecrets related CRs are stored. Defaults to `state-secrets`
- `catalog_repo`: the name of the repository where the Backstage catalog related CRs are stored. Defaults to `catalog`
- `custom_features_repo_owner`: the GitHub user or organization that owns the custom features repository from which claim features are fetched. The GitHub App token used for that repository is minted against this owner. Defaults to the owner of the claims repository.

## CLI version requirements

The workflows in this feature rely on the Firestartr CLI (`@firestartr/cli`) to render and import claims. Before running, they check that the CLI version pinned by the `FIRESTARTR_CLI_VERSION` repository variable satisfies the `>=2.11.0` constraint. Set that variable to a release that satisfies the constraint. Snapshot builds (non-canonical semver versions) can skip the check via the `--ignore-snapshots` flag.

The check can be tuned with the `cli_version_constraint` argument (the minimum CLI version, defaults to `>=2.11.0`) and disabled entirely by setting `cli_version_check_enabled` to `false` (defaults to `true`).
