# Claims repo feature

This feature installs the workflows necessary for manually hydrating and deleting GitHub and TFWorkspace claims, plus two additional workflows to import manually created GitHub resources into GitHub claims and a `pr-verify` workflow.

## Hydrating claims

1. Create a PR with the desired changes. Check the changes that have been commited are the changes you've actually done.

2. Once the `pr-verify` workflow is finished, if there are no errors, merge your PR into the main branch.

3. Head over to the `Actions` tab of the `claims` repo and select the `<Your claim type> claim: hydrate` workflow on the left side list.

![The Actions tabs](./images/claims_repo-example_1-1.jpg)
*The Actions tabs*

4. Select `Run workflow` on the right hand side of the screen, introduce the name of the claim to be hydrated and select the claim type (if it is a GitHub claim). NOTE: the name of the claim should be the value of the field `name` inside the claim YAML. Setting this value to the file name may result in the workflow not working as expected.

![Hydrating a GitHub claim](./images/claims_repo-example_1-2.jpg)
*Hydrating a GitHub claim*

![Hydrating a TFWorkspace claim](./images/claims_repo-example_1-3.jpg)
*Hydrating a TFWorkspace claim*

5. Press the green button and wait for the workflow to finish. When it's done, click its entry in the list and there'll be a link to the `state-github` or `state-infra` repo PR. You can use it to review the PR and merge it if everything is correct.

![The action summary](./images/claims_repo-example_1-4.jpg)
*The action summary with a link to the state repo*

## Deleting claims

1. Head over to the `Actions` tab of the `claims` repo and select the `<Your claim type> claim: delete` workflow on the left side list.

![The Actions tabs](./images/claims_repo-example_2-1.jpg)
*The Actions tabs*

2. Select `Run workflow` on the right hand side of the screen, introduce the name of the claim to be deleted and select the claim type (if it is a GitHub claim). NOTE: the name of the claim should be the value of the field `name` inside the claim YAML. Setting this value to the file name may result in the workflow not working as expected.

![Deleting a GitHub claim](./images/claims_repo-example_2-2.jpg)
*Deleting a GitHub claim*

![Deleting a TFWorkspace claim](./images/claims_repo-example_2-3.jpg)
*Deleting a TFWorkspace claim*

3. Press the green button and wait for the workflow to finish. When it's done, click its entry in the list and there'll be two links: one to the `state-github` or `state-infra` repo PR, deleting the CR file, and another to the `claims` repo PR, deleting the claim file. You can use them to review both PRs and merge them if everything is correct.

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

3. Press the green button and wait for the workflow to finish. Once the workflow is finished, a PR will be created both in the `state-github` repo and the `claims` repo. Merge them both and the resource will be imported


## Massively updating claims' features

1. Head over to the `Actions` tab of the `claims` repo and select the `Update claims' features` workflow on the left side list.

![The Actions tabs](./images/claims_repo-example_4-1.jpg)
*The Actions tabs*

2. Select `Run workflow` on the right hand side of the screen, and add filters to narrow the features and claims you want to update. The filters can be:

- **Features list**: mandatory filter. Either a single feature name or a list of comma separated values, each being a different feature name.
- **Claims list**: optional filter. Either a single `claim.name`, a list of comma separated values, each being a different `claim.name` or an empty value, which will update all applicable claims. Note that `claim.name` refers to the value of the `name` field inside the `claim` YAML file and not to the name of the YAML file itself.
- **Version constraint**: optional filter. Either a valid version, a valid version constraint or an empty value, which will update to the latest avaliable version. A valid version is a version that's avaliable for all features in `Features list`, in the `major.minor.patch` semver format, and will result in the feature being updated to that exact version. Valid version constraint documentation can be found [here](https://github.com/Masterminds/semver?tab=readme-ov-file#basic-comparisons) (comparisions work fine too) and will result in the feature being updated to the latest version avaliable that satisfies the specified constraint.

![Update claims' features](./images/claims_repo-example_4-2.jpg)


3. Press the green button and wait for the workflow to finish. Once the workflow is finished, a PR will be created for each claim that was updated. The PR body will contain a list of changes made since the version that was currently installed up until the version that was updated to. Merge them all and then [hydrate the claims](#hydrating-claims)

## About the `update-features-with-dot-firestartr-info` workflow

This workflow is executed every day at 00:00 UTC. It clones the `.firestartr` repository and uses it to populate arguments for the following features:

- `build_and_dispatch_docker_images`: populates the arguments `tenant_list`, `platform_list` and `env_list`

This workflow can also be executed manually if needed.

## Feature arguments

- `state_github_repo`: the name of the repository where the GitHub related CRs are stored. Defaults to `state-github`
- `state_infra_repo`: the name of the repository where the Terraform and ExternalSecrets related CRs are stored. Defaults to `state-infra`
- `catalog_repo`: the name of the repository where the Backstage catalog related CRs are stored. Defaults to `catalog`
