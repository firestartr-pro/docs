# State Repo Apps

This feature enables GitOps-based deployment workflows for application state repositories. It provides automated CI/CD pipelines for managing Kubernetes workloads, Terraform workspaces, and secrets through GitHub Actions and ArgoCD.

## Overview

The `state_repo_apps` feature installs GitHub Actions workflows that manage three types of deployments:

1. **Kubernetes Workloads** - Deploy and auto-update containerized applications
2. **Terraform Workspaces** - Manage infrastructure as code with TFWorkspace claims
3. **Secrets Management** - Deploy and sync secrets using External Secrets Operator

All deployments follow a GitOps pattern where changes are validated in pull requests, rendered into deployment manifests (CRs), and synced to clusters via ArgoCD.

## Workflows Provided

### Validation
- **Validate PR** (`validate-pr.yml`) - Validates all pull request changes before merging

### Manual Deployments
- **Generate Kubernetes Deployment** (`generate-deployment-kubernetes.yml`) - Manually deploy Kubernetes workloads
- **Generate TFWorkspace Deployment** (`generate-deployment-tfworkspaces.yml`) - Manually deploy Terraform workspaces
- **Generate Secrets Deployment** (`generate-deployment-secrets.yml`) - Manually deploy secrets

### Auto-Update Workflows
- **Dispatch Image to Kubernetes** (`dispatch-image-kubernetes.yml`) - Auto-update Kubernetes workloads when new images are pushed
- **Dispatch Image to TFWorkspaces** (`dispatch-image-tfworkspaces.yml`) - Auto-update TFWorkspace images

## Documentation

For detailed information on each deployment type:

- **[Kubernetes Deployments](KUBERNETES_README.md)** - Complete guide for deploying containerized applications
- **[TFWorkspace Deployments](TFWORKSPACES_README.md)** - Guide for managing Terraform infrastructure
- **[Secrets Management](SECRETS_README.md)** - How to deploy and manage secrets

## Key Features

- GitOps-based deployment using ArgoCD
- Automated image updates with optional auto-merge
- Support for multiple helm chart registries (OCI, HTTPS)
- OIDC authentication for cloud providers (Azure, AWS)
- Pull request validation and preview
- Customizable rendering configurations

## Quick Start

1. **Configure your workload** - Add configuration files to `kubernetes/`, `tfworkspaces/`, or `secrets/` directories
2. **Create a pull request** - The PR will be validated automatically
3. **Merge to main** - Once approved, merge your changes
4. **Deploy manually** - Run the appropriate "Generate deployment" workflow from the Actions tab
5. **Auto-deploy** (optional) - Add `AUTO_MERGE` file to enable automatic deployments on image updates

## Configuration

The workflows support customization through configuration files in `.github/`:

- `hydrate_k8s_config.yaml` - Configure helmfile image version for Kubernetes deployments
- `hydrate_tfworkspaces_config.yaml` - Configure firestartr image version for TFWorkspace deployments

See the individual documentation files for complete configuration details and GitHub variables/secrets required.
