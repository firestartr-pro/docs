# State repo deploy workflows

Summarizing up it deploys applications using a push model, using Helm and Helmfile to manage the deployments. It is triggered by pull requests made to the state repository, which contains configuration files for the applications to be deployed. It is designed to work with multiple cloud providers, including Azure and AWS, by leveraging GitHub's OIDC capabilities for secure authentication.

## Overview

This feature is a collection of two sets of workflows, with one configuration file for each of them.
In general lines, the workflows perform the following actions:
* When a pull request is **opened**, the feature analyzes the changes in the state repo and writes a commentary for each affected environment.
* When a pull request is **merged**, the feature analyzes the changes in the state repo and deploys the upcoming changes.
* When triggered **manually**, the feature can also apply or **destroy** the deployed resources in a specific environment.

### apps
- `apps-apply.yml`: triggered when a pull request is merged, it deploys the applications defined in the state repo to the target environments.
- `apps-destroy.yml`: triggered manually, it removes the applications defined in the state repo from the target environment.
- `apps-manual-apply.yml`: triggered manually, it deploys the applications defined in the state repo to the target environment.
- `apps-pr-verify.yml`: triggered when a pull request is opened, it comments on the pull request with the changes that will be applied to each environment.
- `dispatch-image-v4.yml`: (legacy) triggered by a repository dispatch event, from the source code repository, it dispatches a workflow to update the image tags in the application configuration files to a new version.
- `dispatch-image-v5.yml`: triggered manually, it dispatches a workflow to update the image tags in the application helmfiles to the latest version. **The new v5 version has newer structure for the image update configuration received from the dispatch event.** See the [action-state-repo-update-image](https://github.com/prefapp/action-state-repo-update-image) documentation for more information about `client_payload` structures.
### sys-services
- `sys-services-apply.yml`: triggered when a pull request is merged, it deploys the system services defined in the state repo to the target environments.
- `sys-services-destroy.yml`: triggered manually, it removes the system services defined in the state repo from the target environment.
- `sys-services-manual-apply.yml`: triggered manually, it deploys the system services defined in the state repo to the target environment.
- `sys-services-pr-verify.yml`: triggered when a pull request is opened, it comments on the pull request with the changes that will be applied to each environment.

## Prerequisites

In order to use this feature, you need to have the following prerequisites

### Provider Resources

A registered app or a role, depending on the provider you are using, to establish the OIDC connection from these GitHub workflows. Also make sure that the app or role has the necessary permissions:

* Access private chart repositories
* Kubernetes cluster access to deploy the applications

### State repo file structure

Every deployment is governed by a Helmfile, which defines the charts to be deployed and their configuration. The Helmfile is located in a specific path depending on the type of deployment: application or system service. The following is the required file structure for each type of deployment:

Applications:
```
apps/
└── <tenant>/
    └── <app-name>/
        │ <environment>/
        │    ├── <environment>.yaml
        └── helmfile.yaml(.gotmpl) # helmfile for the app

```
Example:
```
apps/
└── contoso/
    └── webapp/
        ├─── dev/
        │   ├── globals.yaml
        │   ├── secrets.yaml
        │   └── values.yaml
        ├── dev.yaml
        ├── pre/
        │   ├── globals.yaml
        │   ├── secrets.yaml
        │   └── values.yaml
        ├── pre.yaml
        ├── pro/
        │   ├── globals.yaml
        │   ├── secrets.yaml
        │   └── values.yaml
        └── helmfile.yaml(.gotmpl) # helmfile for the app
```

System Services:
```
sys-services/
└── <sys-service-name>/
     ├── <cluster1>/
     │  ├── cluster.yaml
     │  ├── secrets.yaml
     │  └── values.yaml
     ├── <cluster2>/
     │  ├── cluster.yaml
     │  ├── secrets.yaml
     │  └── values.yaml
     └── helmfile.yaml(.gotmpl) # helmfile for the sys-service
```

Example:
```
sys-services/
└── cert-manager/
     ├── cluster-a/
     │  ├── cluster.yaml
     │  ├── secrets.yaml
     │  └── values.yaml
     └── helmfile.yaml(.gotmpl) #  the cert-manager sys-service installation chart
```

## Configuration

The feature requires two configuration file, expected in the `.github/` directory, one for each workflow:

* `.github/apps-config.yaml`.
* `.github/sys-services-config.yaml`.

The configuration file has the following structure depending on the provider:

### Azure

```yaml
provider:
  kind: azure
  tenant_id: 9998228a-e7c9-4ee7-ae9d-a57ba495ab64
  subscription_id: 2968ccbc-92a1-49ae-bd09-14e44a85eefd
helm_registries:
  - <REGISTRY>.azurecr.io
environments:
  dev:
    cluster_name: <CLUSTER_NAME>
    resource_group_name: <RESOURCE_GROUP_NAME>
    identifier: 5b54c04e-5d7d-4d66-954b-144ebd50ac67
  pre:
    cluster_name: <CLUSTER_NAME>
    resource_group_name: <RESOURCE_GROUP_NAME>
    identifier: 5b54c04e-5d7d-4d66-954b-144ebd50ac67
  pro:
    cluster_name: <CLUSTER_NAME>
    resource_group_name: <RESOURCE_GROUP_NAME>
    identifier: 5b54c04e-5d7d-4d66-954b-144ebd50ac67
```

### AWS

```yaml
provider:
  kind: aws
  region: us-west-2
helm_registries:
  - <AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
environments:
    dev:
        cluster_name: <CLUSTER_NAME>
        role-to-assume: <ARN>
```
