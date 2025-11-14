# 📖 Introduction

We have developed a variety of features that can be installed with `firestartr`. The ones that have documentation are documented within our `features` repo, but for convenience they will all be listed here with a link to their docs if they have any.

## 🌟 Build and dispatch Docker images

- [Latest](https://github.com/prefapp/features/blob/main/packages/build_and_dispatch_docker_images/templates/docs/RELEASE_PLEASE_DEPLOY_README.md)
- [v3](https://github.com/prefapp/features/blob/8c93943d936606e546f23a1a788665eb12155caa/packages/build_and_dispatch_docker_images/templates/.github/BUILD_AND_DISPATCH_DOCKER_IMAGES_README.md)
- [v2](https://github.com/prefapp/features/blob/355d1e5f8230a8b4e286b36fc269d5e2cf87c0c3/packages/build_and_dispatch_docker_images/templates/.github/BUILD_AND_DISPATCH_DOCKER_IMAGES_README.md)

## 🌟 Claims repo

- [Latest](https://github.com/prefapp/features/blob/main/packages/claims_repo/templates/docs/README_CLAIMS_REPO.md)

## 🌟 Issue templates

This feature only adds templates for Github issues, and thus has no documentation. You can see the templates here:

- [Bug report (latest)](https://github.com/prefapp/features/blob/main/packages/issue_templates/templates/bug_report.md)
- [Feature request (latest)](https://github.com/prefapp/features/blob/main/packages/issue_templates/templates/feature_request.md)

## 🌟 Release please

This feature uses the `release-please-action` action and configures it to manage releases, in a GitHub repository. It also accepts monorepos.

- [Release Please docs (latest)](https://github.com/prefapp/features/blob/main/packages/release_please/templates/docs/RELEASE_PLEASE_DEPLOY_README.md)

## 🌟 State infra

- [Latest](https://github.com/prefapp/features/blob/main/packages/state_infra/templates/docs/README.md)

## 🌟 State repo (legacy)

This is a legacy feature, replaced by the new [state repo apps](#state-repo-apps) and [state repo sys services](#state-repo-sys-services) features

- [Latest](https://github.com/prefapp/features/blob/main/packages/state_repo/templates/docs/STATE_REPO_DEPLOY_README.md)

## 🌟 State Repo Apps

**Description**:

State Repo Apps puts you in charge of manual deployments in your GitOps repo! 🚀 With this feature, you can manage infrastructure (`TFWorkspace`), Kubernetes workloads, and secrets—all from one spot. 🌍 Start by tweaking the "values" in your main/master branch with a commit or PR. 📝 Then, fire up GitHub Actions workflows to whip up deployment files (CRs) that land in a PR against `deployment`, ready for ArgoCD to sync.

**What’s Included**:
1. **TFWorkspace Deployment** 🛠️: Deploy infrastructure resources with a `claim_name`.
2. **Kubernetes Deployment** ☸️: Set up Kubernetes workloads using `platform`, `tenant`, and `environment`.
3. **Secrets Deployment** 🔐: Add secrets for a specific `tenant` and `environment`.

**How It Works** 🔄:
- Update the "values" in main/master (commit directly or via PR). ✏️
- Run the corresponding workflow from the "Actions" tab. ▶️
- Get a PR with CRs against `deployment`. 📦
- Merge it, and ArgoCD takes it from there! ✅

**Usage by deployment kind**
1. **Kubernetes Deployment**: https://github.com/prefapp/features/blob/main/packages/state_repo_apps/templates/docs/KUBERNETES_README.md
2. **TFWorkspace Deployment**: https://github.com/prefapp/features/blob/main/packages/state_repo_apps/templates/docs/TFWORKSPACES_README.md
3. **Secrets Deployment**: https://github.com/prefapp/features/blob/main/packages/state_repo_apps/templates/docs/SECRETS_README.md



## 🌟 State repo sys services
This feature manages system services for your Kubernetes clusters (sys-services). It organizes critical components like ingress controllers and configuration utilities in a structured repository.
- [Latest](https://github.com/prefapp/features/blob/main/packages/state_repo_sys_services/templates/docs/README.md)
## 🌟 Tech docs

This features uses `mkdocs` to ease in documentation creation

- [MkDocs documentation](https://www.mkdocs.org/)
