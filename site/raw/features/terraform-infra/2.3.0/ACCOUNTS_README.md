# Terrafire script usage guide

To bootstrap the required resources in the AWS account, we will use terraform, through a configuration script (`terrafire.sh`).

### Prerequisites

- **AWS CLI**: Make sure you have the AWS CLI installed and configured with the necessary permissions to create resources in your AWS account. Minimum version required is 2.27.0.
- **Terraform**: Ensure you have Terraform installed on your machine. You can download it from the [Terraform website](https://www.terraform.io/downloads.html).

- aws cli must be configured with the following profiles:
  - `beginners`: For testing purposes
  - `firestartr-pro`: For production

#### Configuration

```ini
[profile profile1] ; For testing purposes
sso_session = my-sso
sso_account_id = 1234567890
sso_role_name = AdministratorAccess
region = eu-west-1
output = json

[profile profile2] ; Production account
sso_session = my-sso
sso_account_id = 0987654321
sso_role_name = AdministratorAccess
region = eu-west-1
output = json

[sso-session my-sso]
sso_region = eu-west-1
sso_start_url = https://my-sso.awsapps.com/start
sso_registration_scopes = sso:account:access
```

## Overview

The `terrafire.sh` script wraps calls to the `terraform` command for a specific Terraform backend. Backends are structured as follows:

- `account`: folders inside the project `accounts` directory. Each one represents an AWS account.
- `environment`: subfolders within each account, representing environments (development, production, staging, etc.).
- `module`: subfolders within each environment, representing distinct configuration units (e.g., VPC, EKS, Route53 domain).

Thus, each module is referenced as `account/environment/module` The script is intended to run Terraform within module directories.

Terraform commands such as `plan`, `apply`, and `destroy` support execution across multiple modules. In these cases, the script accepts a space-separated list of modules. For other commands (`import`, `state`, `force-unlock`), only a single module is supported.

For the specific case of multiple modules usage, if no module is provided, the script will try to automatically find all the modules within the `account/environment` folder and execute for all of them.

### Passing optional arguments to the script

As `terrafire.sh` wraps the usage of the `terraform` command, we need a way to pass optional parameters to the terraform commands.
This is performed with the ` -- ` string.

```bash
# For testing purposes
./terrafire.sh COMMAND ACCOUNT ENVIRONMENT [MODULE(s)] [SUBCOMMAND] -- [PARAMETERS]

# Example
./terrafire.sh -f firestartr-pro dev vpc 12345abcd-6789-ef01-2345-6789abcdef00 -- -force
```

### plan

To see the `terraform plan` of a micro-state, run the following command:

```bash
# For testing purposes
./terrafire.sh -p ACCOUNT ENVIRONMENT [MODULE(S)]

# For example, the state of the VPC module in production ('pro') for 'client-a'...
./terrafire.sh -p client-a pro vpc

# And to test the VPC and the EKS modules in dev environment for 'client-b'...
./terrafire.sh -p client-b dev vpc eks

# And to test all modules in the predev environment for 'client-c'...
./terrafire.sh -p client-c predev
```

### apply

To **apply** `terraform` of a micro-state, run the following command:

```bash
# For testing purposes
./terrafire.sh -a ACCOUNT ENVIRONMENT [MODULE(s)]

# For example, creating the VPC in production (pro) for 'client-a'...
./terrafire.sh -a client-a pro vpc

# And to create the VPC and the EKS in development (dev) for 'client-b'...
./terrafire.sh -a client-b dev vpc eks

# And to apply all microstates in the 'testing' environment for 'client-c'...
./terrafire.sh -a client-c testing
```

### destroy

To **destroy** a `terraform` configuration of a micro-state, run the following command:

```bash
# For testing purposes
./terrafire.sh -d ACCOUNT ENVIRONMENT [MODULE(s)]

# For example, deleting the VPC in production (pro) for 'client-a'...
./terrafire.sh -d client-a pro vpc

# And to delete the VPC and the EKS in 'dev' environment for 'client-b'...
./terrafire.sh -d client-b dev vpc eks

# And to delete all microstates in 'test' environment for 'client-c'...
./terrafire.sh -d client-c test
```

### force-unlock

To forcibly unlock a terraform state. It needs the ID of the Terraform lock, and needs and accepts only one module.

```bash
# For testing purposes
./terrafire.sh -f ACCOUNT ENVIRONMENT MODULE LOCK_ID

# For example, unlocking the state 12345abcd-6789-ef01-2345-6789abcdef00 for the VPC in production for 'client-a'
./terrafire.sh -f client-a pro vpc 12345abcd-6789-ef01-2345-6789abcdef00
```

### state

Allows commands that affect directly the Terraform state. Needs and accepts only one module.

```bash
# For testing purposes
./terrafire.sh -s ACCOUNT ENVIRONMENT MODULE SUBCOMMAND [ -- SUBCOMMAND_OPTIONS]

# For example, show details for the VPC in production for 'client-a'
./terrafire.sh -s client-a pro vpc show -- 'aws_subnet.public'

# And for removing resources for the state in the EKS in dev environment for 'client-b'...
./terrafire.sh -s client-b dev eks rm  -- 'aws_instance.obsolete'
```

### import

Imports existent infrastructure into Terraform control. Needs and accepts only one module.

For this purpose, it is imperative to create a Terraform file, e.g., main.tf, and define there the resources we want to import, just like with a standard Terraform import.

```bash
# For testing purposes
./terrafire.sh -i ACCOUNT ENVIRONMENT MODULE RESOURCE_ADDRESS RESOURCE_ID

# For example, importing an VPC in the production environment into the vpc module for 'client-a'
./terrafire.sh -i client-a pro vpc aws_subnet.public subnet-1234567890abcdef0

# And to import the EKS in dev environment for 'client-b'...
./terrafire.sh -i client-b dev eks aws_eks_cluster.main eks-0fedcba0987654321
```



# Launch script usage guide

This document outlines the usage of the `launch.sh` script for managing Terraform deployments.

## 1. Synopsis

The `launch.sh` script is designed to execute Terraform commands (`plan`, `apply`, `destroy`, `force-unlock`) across different tenants, environments, and modules.

## 2. Requirements

*   Terraform executable installed and configured.
*   A directory structure as expected by the script (see below).

## 3. Directory Structure

The script expects a specific directory layout:
```
accounts/
├── <tenant_name>/
│ ├── <environment_name>/
│ │ ├── <00-module_name1>/
│ │ │ └── ... (Terraform files, terraform.tfvars)
│ │ └── <01-module_name2>/
│ │ ├── providers.tf
│ │ └── ...
│ ├── account.tfvars (optional)
│ ├── providers.tf
│ ├── variables.tf
│ └── ...
├── globals.tfvars (optional)
├── backend.tf
├── launch.sh
├── README.md
```

* `<SCRIPT_DIR>`: The directory where `launch.sh` is located.

* `<tenant_name>`: A directory representing a tenant.

* `<environment_name>`: A subdirectory within a tenant, representing an environment (e.g., `dev`, `pro`). This folder needs the files `variables.tf` and `providers.tf` in order for the system to function properly. The `providers.tf` file cannot be placed directly in its final location because its path depends on the tenant and environment names. In the next section we will explain how this file should be generated.

* `<module_name>`: A subdirectory within an environment, containing the Terraform configuration for a specific module (e.g., `vpc`, `eks`).



### 3.1 Providers file

As previously discussed, we cannot provide the providers.tf as it is dependent on both the **tenant** name and the **environment** name, so we can have different providers for each environment. Each environment needs its own `providers.tf` file.

In the following section, we provide a sample `providers.tf` file that can be used. You can prepare it and place it inside the relevant environment folder

For example, if you have a "my_name" tenant and "dev" environment, the path of this file should be `accounts/my_name/dev/providers.tf`.

To prepare the file, you can change the **AWS region**, and (this is the important part) the **AWS account ID** for the **tenant** you are adding this file to.

You can add whichever configurations to this provider file, such as aliases.

```terraform
provider "aws" {
   region = "eu-west-1"   # change this as needed

   dynamic "assume_role_with_web_identity" {
    for_each = var.is_cicd ? [1] : []
    content {
      role_arn = "arn:aws:iam::<AWS_ACCOUNT_ID>:role/tf-base-role"  # add here the tenant AWS account ID
      web_identity_token_file = "/tmp/web_identity_token_file"
    }
  }

  dynamic "assume_role" {
    for_each = !var.is_cicd ? [1] : []
    content {
      role_arn = "arn:aws:iam::<AWS_ACCOUNT_ID>:role/tf-base-role" # add here the tenant AWS account ID
    }
  }

  assume_role {
    role_arn = "arn:aws:iam::<AWS_ACCOUNT_ID>:role/AccountAdminRole" # add here the tenant AWS account ID
  }


}

```

Also, we have provided a sample `examples/env/providers.tf` file that you can use to add to your current configuration in the right place, in your own tenant/environment folders. This file is only a template, and can be modified to suit your needs.



## 4. Usage

The script is invoked with the following command structure:

```bash
./terrafire.sh OPTION TENANT ENVIRONMENT [MODULE] [-- EXTRA_ARGS]
Arguments:
- OPTION: (Required) The Terraform action to perform.
  -a: Run terraform apply on the specified modules. If no module is specified, it applies to all modules in the environment.
  -p: Run terraform plan on the specified modules. If no module is specified, it plans for all modules in the environment.
  -d: Run terraform destroy on the specified modules. If no module is specified, it destroys all modules in the environment.
  -f: Run terraform force-unlock for the state. This option requires a LOCK_ID to be passed as an extra argument (the first argument after --).

TENANT: (Required) The name of the tenant. This must correspond to a directory at the same level as the script.
Example: my-tenant

ENVIRONMENT: (Required) The name of the environment. This must correspond to a subdirectory within the specified TENANT folder.

Example: dev, staging, pro
MODULE...: (Optional) The name(s) of specific module(s) to target. These must correspond to subdirectories within the specified TENANT/ENVIRONMENT folder. If omitted, the action applies to all modules within the environment. You can specify multiple modules separated by spaces.

Example: vpc, eks database
-- EXTRA_ARGS: (Optional) Any additional arguments to be passed directly to the terraform command (e.g., -var="foo=bar", -target=resource.id). These must be preceded by --. If using -f (force-unlock), the LOCK_ID is the first argument here.
```

Displaying Available Tenants and Modules:
If an invalid tenant or no tenant is provided, the script will list available tenants.
If an invalid option or environment is provided (after a valid tenant), the script will attempt to list available modules for that tenant and environment.

### 5. Examples
Plan all modules in the dev environment for tenant-alpha:

Apply the vpc module in the pro environment for tenant-beta:

Destroy the eks and network modules in the staging environment for tenant-gamma:

Force-unlock a state lock (LOCK_ID must be known):

(Note: The module vpc is specified here as the force-unlock command in the script is associated with a module's directory context, even if the lock ID itself might be global or apply to a specific state file named after the module.)

Plan the webserver module in dev for tenant-delta and pass an extra variable to Terraform:

## 6. Terraform Backend and Variables

Backend Configuration: The script expects a backend.tf file in <SCRIPT_DIR> for backend configuration. It dynamically sets the key for the S3 backend based on tenant, environment, and module.
Provider Configuration: A providers.tf file can be placed in <SCRIPT_DIR>/<tenant>/<environment>/ to be copied into the working directory for the Terraform operations.
Variable Files (.tfvars): The script looks for and uses variable files in the following order of precedence (later files override earlier ones):
<SCRIPT_DIR>/globals.tfvars
<SCRIPT_DIR>/<tenant>/account.tfvars
<SCRIPT_DIR>/<tenant>/<environment>/environment.tfvars
<SCRIPT_DIR>/<tenant>/<environment>/<module>/terraform.tfvars

### 7. Environment Variables for Backend
The script relies on the following environment variables being set for Terraform backend operations (typically sourced from `/tmp/.firestartr-env` or set manually):

FIRESTARTR_BACKEND: S3 bucket name.
FIRESTARTR_LOCK: DynamoDB table name for state locking.
FIRESTARTR_BACKEND_REGION: AWS region for the backend resources.
FIRESTARTR_BACKEND_ROLE_ARN: IAM role ARN for accessing backend resources.
FIRESTARTR_BACKEND_PROFILE: (Assumed, based on script structure) AWS CLI profile to use for backend operations.

### 8. TF state prefix

By default, the Terraform state in Amazon S3 uses the following key structure:
`firestartr/<tenant>/<environment>/<module>`

If you use multiple GitHub repositories with the terraform-infra feature installed, this structure may cause collisions if the `<tenant>/<environment>/<module>` path is repeated across repositories.

To avoid this, you can define a custom prefix by creating a `.firestartr_tfstate_prefix` file. The value in this file will be inserted between `firestartr/` and `<tenant>`, resulting in the following structure: `firestartr/<custom_value>/<tenant>/<environment>/<module>`

We recommend setting this custom value to your GitHub repository name, but you can use any valid string for Amazon S3 object keys.

### 9. Error Handling
The script uses set -euo pipefail and a trap to exit immediately if any command fails or an error occurs. Error messages are printed to standard error.
