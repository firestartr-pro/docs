# Terraform Infra workflows

This feature contains GitHub Actions workflows and supporting scripts to automate the planning and application of Terraform infrastructure changes across multiple tenants, environments, and modules.

## Overview

The automation is designed to:
- Validate changes to Terraform modules on pull requests.
- Run `terraform plan` for changed modules on pull requests.
- Apply Terraform changes automatically when a pull request is merged and labeled with `terraform/apply`, or manually via workflow dispatch.
- Provide detailed feedback and logs as pull request comments.

## Repository Structure
The repository is structured to support multiple accounts and environments, with Terraform modules organized by account and environment. Here’s a simplified view of the structure:
```
.
├── accounts
│   ├── account1
│   │   └── pro
│   │       ├── 010-vpc
│   │       ├── 020-eks
│   │       ├── 030-iam
│   │       └── 040-lambda
│   ├── account2
│   │   ├── dev
│   │   │   ├── 10-vpc
│   │   │   └── 20-eks
│   │   └── pre
│   └── test-account
│       └── dev
│           ├── 00-state1
│           └── 01-state2
```

## Workflow Summary

### 1. Pull Request Workflow

When a pull request is opened or updated:
- **Validation**: The workflow checks which modules are affected by the changes.
- **Plan**: For each affected module, `terraform plan` is executed and the results are posted as a comment on the pull request.

When a pull request is **merged and closed** with the `terraform/apply` label:
- **Apply**: The workflow runs `terraform apply` for the affected modules and posts the results as a comment.

### 2. Manual Trigger (Workflow Dispatch)

You can manually trigger the workflow from the GitHub Actions UI:
- **Plan or Apply**: By setting the `run_plan` or `run_apply` input to `true`, you can run `terraform plan` or `terraform apply` for specified modules.

## Key Workflow Conditions

- **Terraform Apply** runs when:
  - The workflow is manually triggered with `run_apply: true`, **or**
  - A pull request is merged, closed, and labeled with `terraform/apply`.

- **Terraform Plan** runs when:
  - The workflow is manually triggered with `run_plan: true`, **or**
  - A pull request is open or updated (not closed).

## Supporting Scripts

### `.github/scripts/functions.sh`

- Contains helper functions for running Terraform commands and posting results as PR comments.
- `run_terrafire_command`: Executes a Terraform command for a specific module, captures output, cleans logs, and posts results to the pull request if running in GitHub Actions.
- `populate_github_vars_file`: Loads and exports variables from a file in GitHub Actions format, supporting both simple and multi-line values.

### `.github/scripts/run_terrafire.sh`

- Invoked by the workflow to run `terraform plan` or `terraform apply` for the specified modules, using the logic defined in `functions.sh`.



## Environment variables

### Required variables for GitHub Actions Workflows and Manual Execution

The scripts rely on several environment variables for Terraform backend configuration. These variables:
- should be defined in your GitHub repository settings as environment variables.
-  or be defined as shell environment variables in case of manual execution.

> [!TIP]
>
> Each GitHub Actions environment (e.g., `account1/staging`, `account2/production`) can define its own set of variables.

| Variable                    | Description                                                  | Example value                                 |
| --------------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| FIRESTARTR_BACKEND          | Name of the S3 bucket where the Terraform backend will reside | `example-tfstate-storage`                     |
| FIRESTARTR_BACKEND_REGION   | AWS region where the Terraform backend will be stored        | `us-east-1`                                   |
| FIRESTARTR_BACKEND_ROLE_ARN | IAM Role ARN for accessing backend resources                 | `arn:aws:iam::123456789012:role/example-role` |
| FIRESTARTR_LOCK             | DynamoDB table name for state lock                           | `example-tf-lock`                             |

### Additional variables for Manual Execution

For manual use of `terrafire.sh`, you also **need the following environment variables** (in addition to the shared backend variables documented above):

| Variable                    | Description                                                                                                 | Example value                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| FIRESTARTR_BACKEND_PROFILE  | AWS profile used for local/manual backend access. Required for non-CI execution.                           | `default`                              |
| FIRESTARTR_TENANTS_FOLDER   | Full path to the folder where tenant configuration directories reside. If unset, it defaults to `pwd`.     | `/home/path/to/your/project/accounts/` |



### Initializing the Terraform backend

The script `bootstrap/prepare.sh` initializes and configures the Terraform backend for its use. It generates the S3 bucket, the DynamoDB table for the Terraform backend, and the IAM role for accessing these resources. When it completes its execution, it will output all the values for these variables.

> [!CAUTION]
>
> This script generates a new Terraform backend each time it is executed, so it must be **executed only once** to avoid **overwriting existing state**.



## Usage in GitHub Actions

### Automatic

- Open a pull request to trigger validation and planning.
- Merge a pull request with the `terraform/apply` label to trigger an apply.

### Manual

- Go to the Actions tab in GitHub.
- Select the workflow and click "Run workflow".
- Set the desired inputs (`run_plan` or `run_apply`, tenant, modules, etc.).

## Notes & Troubleshooting

- **Labels and PR Merges**: The workflow checks for the `terraform/apply` label at the time the pull request is closed and merged. If the label is added too late (right before merging), GitHub's event payload may not include it, and the apply step may not trigger. To ensure reliable automation, add the label before merging.
- **Logs and Feedback**: All Terraform output is posted as a PR comment and grouped in the Actions logs for easy review.

---

For more details, see the workflow file at `.github/workflows/terraform-plan-apply.yaml` and the scripts in `.github/scripts/`.
