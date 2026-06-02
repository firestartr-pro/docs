# GitHub Actions Workflows Overview

This repository uses **four main workflows** to automate Helm chart validation and publication. Automated release creation is intentionally handled by the separate `release_please` feature when needed. This feature no longer scaffolds `release-please-config.json` or `.release-please-manifest.json` for new repositories. The following sections provide a concise description of what each workflow does without delving into implementation details.

---

## 1. `publish-release.yaml`

Publishes a released chart version.

* **Runs on**: every GitHub `release` event with type `released`, or manually via `workflow_dispatch`.
* **Key actions**:

  1. Checks out the exact released Git ref or the manually provided ref.
  2. Resolves which chart belongs to that release tag, using `release-please-config.json` when available for custom component mappings.
  3. Calls `generate-artifact.yaml` with `release_type: releases` to publish the immutable chart version.
  4. For OCI registries, optionally refreshes the rolling major alias (for example `v1`) only when `HELM_CHARTS_ENABLE_OCI_ROLLING_MAJOR_TAGS=true`.

---

## 2. `generate-artifact.yaml`

Builds and publishes a Helm chart as either a release or snapshot artifact.

* **Invocation method**: called via `workflow_call` with inputs for chart path, version, and publication type (`releases` or `snapshots`).
* **Main steps**:

  1. Checks out the charts repository and recursively updates dependencies using `helm dep up`.
  2. When publishing to OCI, resolves the target registry and base path.
  3. For registries configured through `.firestartr`, retrieves a token from a GitHub App and loads the shared registry metadata.
  4. For `ghcr.io`, logs in directly with the workflow token (or optional explicit registry credentials) and does not require `.firestartr`.
  5. Packages the chart, determines its name and version, then uploads it to **(a)** an OCI registry or **(b)** GitHub Pages, based on the `HELM_CHARTS_PUBLICATION_TYPE` variable.
  6. When publishing to GitHub Pages, indexes the Helm repo and pushes to the configured branch and path.

If you publish to `ghcr.io`, the workflow needs `packages: write` permission.

---

## Required Configuration

The following repository variables and secrets must be configured for artifact generation to work:

### Repository Variables (`vars`)

| Variable | Required | Description |
|----------|----------|-------------|
| `HELM_CHARTS_PUBLICATION_TYPE` | **Yes** | Publication target: `oci` or `github_pages` (case-insensitive) |
| `DOCKER_REGISTRY_RELEASES` | For OCI | Registry for releases (e.g., `ghcr.io` or `myregistry.azurecr.io`) |
| `DOCKER_REGISTRY_SNAPSHOTS` | For OCI | Registry for snapshots (can be same as releases) |
| `HELM_CHARTS_ENABLE_OCI_ROLLING_MAJOR_TAGS` | Optional | Set to `true` to publish/update OCI rolling major tags such as `v1` for releases. Disabled by default. |
| `FS_STATE_APP_ID` | For non-ghcr OCI | GitHub App ID for accessing `.firestartr` registry metadata |
| `DOCKER_REGISTRY_RELEASES_USERNAME` | Optional | Registry username for releases (default: `github.actor`) |
| `DOCKER_REGISTRY_SNAPSHOTS_USERNAME` | Optional | Registry username for snapshots (default: `github.actor`) |
| `AZURE_CLIENT_ID` | Optional | Azure service principal for ACR authentication |
| `AZURE_TENANT_ID` | Optional | Azure tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Optional | Azure subscription ID |
| `AWS_ROLE_ARN` | Optional | AWS IAM role for ECR authentication |
| `AWS_DEFAULT_REGION` | Optional | AWS region for ECR |

### Repository Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `FS_STATE_PEM_FILE` | For non-ghcr OCI | GitHub App private key for `.firestartr` access |
| `DOCKER_REGISTRY_RELEASES_PASSWORD` | Optional | Registry password for releases (default: `GITHUB_TOKEN`) |
| `DOCKER_REGISTRY_SNAPSHOTS_PASSWORD` | Optional | Registry password for snapshots (default: `GITHUB_TOKEN`) |

### Configuration Scenarios

**For GitHub Container Registry (`ghcr.io`):**
```
HELM_CHARTS_PUBLICATION_TYPE=oci
DOCKER_REGISTRY_RELEASES=ghcr.io
DOCKER_REGISTRY_SNAPSHOTS=ghcr.io
```
No additional secrets needed—uses `GITHUB_TOKEN` by default.

To publish moving OCI major aliases such as `v1`, also set:
```
HELM_CHARTS_ENABLE_OCI_ROLLING_MAJOR_TAGS=true
```
Rolling major tags are disabled when this variable is unset, empty, or any value other than `true`.

**For Azure Container Registry (via `.firestartr`):**
```
HELM_CHARTS_PUBLICATION_TYPE=oci
DOCKER_REGISTRY_RELEASES=myregistry.azurecr.io
DOCKER_REGISTRY_SNAPSHOTS=myregistry.azurecr.io
FS_STATE_APP_ID=<github-app-id>
AZURE_CLIENT_ID=<sp-client-id>
AZURE_TENANT_ID=<tenant-id>
AZURE_SUBSCRIPTION_ID=<subscription-id>
```
Secrets: `FS_STATE_PEM_FILE`, `DOCKER_REGISTRY_RELEASES_PASSWORD`, `DOCKER_REGISTRY_SNAPSHOTS_PASSWORD`

---

## 3. `generate-snapshot.yaml`

Automatically generates chart snapshots during Pull Requests.

* **Runs on**:

  * Every `pull_request` event when a PR is labeled or updated (`labeled`, `synchronize`).
  * Manually via `workflow_dispatch`, allowing the user to specify a chart.
* **What it does**:

  1. Detects charts modified in the PR.
  2. Calls `generate-artifact.yaml` with `release_type: snapshots` to build and upload a snapshot version to the designated registry.

---

## 4. `pr-verify.yaml`

Validates chart changes before a Pull Request is merged.

* **Runs on**: every PR that touches `charts/**` or manually via `workflow_dispatch`.
* **Validation tasks**:

  1. **Change Detection** — identifies every chart modified in the PR.
  2. **Dependency Update** — refreshes Helm dependencies, including local and remote subcharts, once per changed chart.
  3. **Linting** — executes `helm lint --strict` for each changed chart, including library charts.
  4. **Template & Yamllint** — renders templates and runs `yamllint` for application charts, while library charts skip rendering because Helm cannot install them. The workflow still posts one persistent comment per chart using *sticky‑pull‑request‑comment*.
  5. Fails the workflow if any chart validation reports lint errors.

---

## Upgrading to v2.0.0 (Breaking Change)

Version 2.0.0 removes the built-in `release-please` integration. To maintain the same automated release behavior as before, you must install the `release_please` feature alongside the new `charts_repo` version and reconfigure your release-please settings.

### Migration Steps

1. **Install the `release_please` feature** alongside `charts_repo` version 2.0.0 in your repository.

2. **Configure release-please files** with the following structure:

   **`.release-please-manifest.json`**
   ```json
   {
     "charts/<chart-1>": "<the latest released version>",
     "charts/<chart-2>": "<the latest released version>"
   }
   ```

   **`release-please-config.json`**
   ```json
   {
       "bootstrap-sha": "<the commit that adds the new charts_repo version>",
       "release-type": "helm",
       "packages": {
           "charts/<chart-1>": {},
           "charts/<chart-2>": {}
       }
   }
   ```

3. **Important**: Set `bootstrap-sha` to the commit that adds the new `charts_repo` version. This ensures release-please correctly tracks versions from that point forward.

---

## Summary Flow

1. **Release creation**:

   * If you want automated GitHub releases and tags, install the `release_please` feature alongside `charts_repo`, then configure `release-please-config.json` and `.release-please-manifest.json` for your chart packages (for example `{{| CHARTS_DIR |}}/payments`).
   * Repositories already carrying user-managed `release-please-config.json` and `.release-please-manifest.json` can keep using them after upgrading `charts_repo`.
   * If you do not use `release_please`, you can still create a GitHub release manually. For multi-chart repositories, use `workflow_dispatch` and provide the `chart` input when the tag alone is ambiguous.
2. **Release publication** → `publish-release.yaml` resolves the released chart and calls `generate-artifact.yaml` to publish it.
3. **Pull Request** cycle:

   * `pr-verify.yaml` validates each changed chart and leaves per-chart feedback.
   * If on‑demand testing is needed, `generate-snapshot.yaml` builds and uploads a snapshot.
