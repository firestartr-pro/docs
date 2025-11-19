# GitHub Actions Workflows Overview

This repository uses **four main workflows** to automate the Helm chart lifecycle and version management. The following sections provide a concise description of what each workflow does without delving into implementation details.

---

## 1. `release-please.yaml`

Automates semantic versioning and release generation.

* **Runs on**: every push to the `main` branch or via `workflow_dispatch`.
* **Key actions**:

  1. Executes **Release Please** to scan commits, update the manifest, and create PRs/tags when required.
  2. Exposes outputs with the impacted charts (`paths_released`) and their new versions.
  3. If releases are detected, triggers `generate-artifact.yaml` (one run per chart) through a matrix with `max-parallel: 1` to build and publish artifacts.

---

## 2. `generate-artifact.yaml`

Builds and publishes a Helm chart as either a release or snapshot artifact.

* **Invocation method**: called via `workflow_call` with inputs for chart path, version, and publication type (`releases` or `snapshots`).
* **Main steps**:

  1. Retrieves a token from a GitHub App to access the private `.firestartr` repository with registry configs.
  2. Checks out the charts repository and recursively updates dependencies using `helm dep up`.
  3. Packages the chart, determines its name and version, then uploads it to **(a)** an OCI registry or **(b)** GitHub Pages, based on the `HELM_CHARTS_PUBLICATION_TYPE` variable.
  4. When publishing to GitHub Pages, indexes the Helm repo and pushes to the configured branch and path.

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

  1. **Scope Check** — blocks PRs that modify more than one chart at a time.
  2. **Dependency Update** — refreshes Helm dependencies, including local and remote subcharts.
  3. **Linting & Template** — executes `helm lint --strict` and renders templates for inspection.
  4. **Yamllint** — runs `yamllint` on rendered output and posts results in a persistent comment using *sticky‑pull‑request‑comment*.
  5. Fails the workflow if lint errors are found.

---

## Summary Flow

1. **Push to `main`** → `release-please.yaml` decides if new releases are required.
2. For each chart needing a release → `generate-artifact.yaml` publishes the new version.
3. **Pull Request** cycle:

   * `pr-verify.yaml` validates the PR and leaves feedback.
   * If on‑demand testing is needed, `generate-snapshot.yaml` builds and uploads a snapshot.


