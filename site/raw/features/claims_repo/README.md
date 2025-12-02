# Claims repo feature

This feature installs the workflows necessary for manually hydrating and deleting GitHub and TFWorkspace claims, plus two additional workflows to import manually created GitHub resources into GitHub claims and a `pr-verify` workflow.

## Hydrating claims

1. Create a PR with the desired changes. Check the changes that have been commited are the changes you've actually done.

2. Once the `pr-verify` workflow is finished, if there are no errors, merge your PR into the main branch.

3. Head over to the `Actions` tab of the `claims` repo and select the `<Your claim type> claim: hydrate` workflow on the left side list.

![Select workflow](./images/claims_repo-example_1-1.jpg)
*The Actions tabs*

4. Select `Run workflow` on the right hand side of the screen, introduce the name of the claim to be hydrated and select the claim type (if it is a GitHub claim). NOTE: the name of the claim should be the value of the field `name` inside the claim YAML. Setting this value to the file name may result in the workflow not working as expected.

![Run workflow](./images/claims_repo-example_1-2.jpg)
*Hydrating a GitHub claim*

![Hydrating GitHub claim](./images/claims_repo-example_1-3.jpg)
*Hydrating a TFWorkspace claim*

5. Press the green button and wait for the workflow to finish. When it's done, click its entry in the list and there'll be a link to the `state-github` or `state-infra` repo PR. You can use it to review the PR and merge it if everything is correct.

![Review result](./images/claims_repo-example_1-4.jpg)
*The action summary with a link to the state repo*

## Deleting claims

1. Head over to the `Actions` tab of the `claims` repo and select the `<Your claim type> claim: delete` workflow on the left side list.

![Example 1](https://github.com/user-attachments/assets/ea3b780f-7249-4709-97d9-7d213283cf5a)
*The Actions tabs*

2. Select `Run workflow` on the right hand side of the screen, introduce the name of the claim to be deleted and select the claim type (if it is a GitHub claim). NOTE: the name of the claim should be the value of the field `name` inside the claim YAML. Setting this value to the file name may result in the workflow not working as expected.

![Example 3](https://github.com/user-attachments/assets/e919af1c-6c93-4990-b422-7fd0a1d53f9a)
*Deleting a GitHub claim*

![Example 5](https://github.com/user-attachments/assets/8ef2f628-48f3-4759-af5f-ebffd0922ba8)
*Deleting a TFWorkspace claim*

3. Press the green button and wait for the workflow to finish. When it's done, click its entry in the list and there'll be two links: one to the `state-github` or `state-infra` repo PR, deleting the CR file, and another to the `claims` repo PR, deleting the claim file. You can use them to review both PRs and merge them if everything is correct.

![Example 7](https://github.com/user-attachments/assets/4dccd432-eec3-490e-89ee-b23ff9572937)
*The action summary with two links to the state and claims repo*


## Import already created GitHub resources

1. Head over to the `Actions` tab of the `claims` repo and select the `📜 Import GitHub resources` workflow on the left side list.

![Example 1](https://github.com/user-attachments/assets/ea3b780f-7249-4709-97d9-7d213283cf5a)
*The Actions tabs*

2. Select `Run workflow` on the right hand side of the screen, and add filters to the type of resources you want to import. The filters can be:

- **REGEXP=[regex]**: import all resources that match the regex [regex].
- **NAME=[name]**: import all resources with the name [name]. The name must be an exact match.
- **SKIP=SKIP**: skip this import.

![Example 8](https://github.com/user-attachments/assets/d7a83ab2-a1c3-4946-8d06-09d05bdcb868)

3. Press the green button and wait for the workflow to finish. Once the workflow is finished, a PR will be created both in the `state-github` repo and the `claims` repo. Merge them both and the resource will be imported


## Massively updating claims' features

1. Head over to the `Actions` tab of the `claims` repo and select the `Update claims' features` workflow on the left side list.

![Example 1](https://github.com/user-attachments/assets/ea3b780f-7249-4709-97d9-7d213283cf5a)
*The Actions tabs*

2. Select `Run workflow` on the right hand side of the screen, and add filters to narrow the features and claims you want to update. The filters can be:

- **Features list**: mandatory filter. Either a single feature name or a list of comma separated values, each being a different feature name.
- **Claims list**: optional filter. Either a single `claim.name`, a list of comma separated values, each being a different `claim.name` or an empty value, which will update all applicable claims. Note that `claim.name` refers to the value of the `name` field inside the `claim` YAML file and not to the name of the YAML file itself.
- **Version constraint**: optional filter. Either a valid version, a valid version constraint or an empty value, which will update to the latest avaliable version. A valid version is a version that's avaliable for all features in `Features list`, in the `major.minor.patch` semver format, and will result in the feature being updated to that exact version. Valid version constraint documentation can be found [here](https://github.com/Masterminds/semver?tab=readme-ov-file#basic-comparisons) (comparisions work fine too) and will result in the feature being updated to the latest version avaliable that satisfies the specified constraint.

![Example 9](https://github.com/user-attachments/assets/ea00aa10-18ea-4cd7-af6b-7029c18b3438)


3. Press the green button and wait for the workflow to finish. Once the workflow is finished, a PR will be created for each claim that was updated. The PR body will contain a list of changes made since the version that was currently installed up until the version that was updated to. Merge them all and then [hydrate the claims](#hydrating-claims)

## Feature arguments

- `state_github_repo`: the name of the repository where the GitHub related CRs are stored. Defaults to `state-github`
- `state_infra_repo`: the name of the repository where the Terraform and ExternalSecrets related CRs are stored. Defaults to `state-infra`
- `catalog_repo`: the name of the repository where the Backstage catalog related CRs are stored. Defaults to `catalog`
