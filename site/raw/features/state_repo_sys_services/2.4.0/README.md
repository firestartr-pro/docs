# ☸️ How to Deploy a Kubernetes Workload

This feature allows to deploy Kubernetes sys-services, i.e. operators and controllers needed in the cluster, at cluster level, and managed by the platform team.

*The deployment is done via GitOps, using ArgoCD. This means that the deployment is done when new changes arrive to the `deployment` branch in the state GitHub repository, which is then automatically picked up by ArgoCD and deployed to the destination Kubernetes cluster.*

***

## Configuration
To configure a new Kubernetes sys-service deployment, you need to define the Helmfile configuration and Helm values files for each sys-service, in the repository default branch, inside the `kubernetes-sys-services/<platform>/<sys-service-name>/` directory.

### Helmfile Configuration

Each Kubernetes sys-service must have a corresponding configuration file,  located at `kubernetes-sys-services/<platform>/<sys-service-name>.yaml` and a set of values files inside the `kubernetes-sys-services/<platform>/<sys-service-name>/` directory, in the repository default branch.

#### `<sys-service>.yaml` file
This file defines a set of parameters used by the common [`helmfile.yaml.gotmpl` Go template](https://github.com/prefapp/daggerverse/blob/main/hydrate-orchestrator/modules/hydrate-kubernetes/helm-sys-services/helmfile.yaml.gotmpl) which is used by the [hydrate-orchestrator](https://github.com/prefapp/daggerverse/tree/main/hydrate-orchestrator) Dagger module, to download the specified charts and render the Kubernetes workloads. An example of such file is shown below:
https://github.com/prefapp/daggerverse/blob/main/hydrate-orchestrator/modules/hydrate-kubernetes/fixtures/values-repo-dir-sys-services/kubernetes-sys-services/cluster-name/stakater.yaml

```yaml
version: 1.2.0
chart: stakater/reloader

hooks: []

extraPatches: # []
  - target:
      group: rbac.authorization.k8s.io
      kind: ClusterRoleBinding
      name:  stakater-reloader-role-binding
    patch:
      - op: add
        path: /metadata/labels/test-label
        value: test-value
execs: []
```

#### Helm values files
Inside the `kubernetes-sys-services/<platform>/<sys-service-name>/` directory, there must be a set of Helm values YAML files. These files contain the Helm values used to configure the Helm chart for the sys-service.

Helmfile will use the hydrate-orchestrator [helm-sys-services `values.yaml.gotmpl`](https://github.com/prefapp/daggerverse/blob/main/hydrate-orchestrator/modules/hydrate-kubernetes/helm-sys-services/values.yaml.gotmpl) template to render the values to be used for the Helm chart installation.

An example of such file is shown below:
https://github.com/prefapp/daggerverse/blob/main/hydrate-orchestrator/modules/hydrate-kubernetes/fixtures/values-repo-dir-sys-services/kubernetes-sys-services/cluster-name/stakater/values.yaml

```yaml
replicaCount: 2
image:
  repository: stakater/reloader
  tag: v0.0.96
```

### GitHub Variables and Secrets
The feature's workflows can need the following GitHub **vars**, or **secrets** configured (at organization or repository level), to manage the access to the Helm charts registries, depending on the publication method used by the organization:

| Name  | Mandatory | Description   |
|-------|-----------|-----------------------------------------------------------------------------|
| `vars.HELM_CHARTS_PUBLICATION_TYPE` |   NO      | The publication method for the organization's Helm charts, and therefore, **the access method to the organization's helm charts registries** (i.e., `oci`, `https`). Default to `https` (public URL) |
| `vars.DOCKER_REGISTRY_RELEASES`     |   NO 1️⃣     | The registry name, or URL, for the OCI Helm charts releases registry. It must exists in `.firestartr` repository **default** branch, inside the `/docker_registries` folder. 4️⃣    |
| `vars.DOCKER_REGISTRY_SNAPSHOTS`    |   NO 1️⃣     | The registry name, or URL, for the OCI Helm charts snapshots registry. It must exists in `.firestartr` repository **default** branch, inside the `/docker_registries` folder. 4️⃣ |
| `vars.AZURE_CLIENT_ID`               |   NO 2️⃣     | The Managed Identity client ID, with access permissions to the Azure ACR, needed by the auth-oci tool to configure the `azure_oidc` integration. |
| `vars.AZURE_TENANT_ID`               |   NO 2️⃣     | The Tenant ID where the ACR resides, needed by the auth-oci tool to configure the `azure_oidc` integration. |
| `vars.AZURE_SUBSCRIPTION_ID`         |   NO 2️⃣     | The Azure subscription ID, where the ACR resides, needed by the auth-oci tool to configure the `azure_oidc` integration. |
| `vars.AWS_ROLE_ARN`                |   NO 2️⃣     | The AWS IAM Role ARN, with access permissions to the ECR, needed by the auth-oci tool to configure the `aws_oidc` integration. |
| `vars.AWS_DEFAULT_REGION`                  |   NO 2️⃣     | The AWS region where the ECR resides, needed by the auth-oci tool to configure the `aws_oidc` integration. |
| `vars.DOCKER_REGISTRY_RELEASES_USERNAME` |   NO 3️⃣      | The username for the Helm OCI registry for releases.  |
| `vars.DOCKER_REGISTRY_SNAPSHOTS_USERNAME`|   NO 3️⃣     | The username for the Helm OCI registry for snapshots. |
| `secrets.DOCKER_REGISTRY_RELEASES_PASSWORD` |   NO 3️⃣     | The password for the Helm OCI registry for released chart versions. |
| `secrets.DOCKER_REGISTRY_SNAPSHOTS_PASSWORD` |  NO 3️⃣   | The password for the Helm OCI registry for non-released chart versions.|

1️⃣ Only needed if **`HELM_CHARTS_PUBLICATION_TYPE` is set to `oci`**

2️⃣ Only needed if the registry authentication **is OIDC**, i.e.:
  - `azure_oidc` using a Managed Identity.
  - `aws_oidc` using an IAM Role.

3️⃣ Only needed if the registry authentication **is not OIDC**, i.e.:
  - `ghcr` using a PAT distinct from the default actions' `GITHUB_TOKEN`. Else, the action will use the `GITHUB_TOKEN` by default.
  - `generic`, i.e. **user** & **password**.

See [auth-oci](https://github.com/prefapp/auth-oci) tool documentation for more details.

4️⃣ The `docker_registries` folder contains a YAML files for each registry available in the organization, with the necessary configuration.
***

## Workflows
The feature provides the following GitHub Actions workflows:

### Validate PR
This workflow validates changes in pull requests to ensure they meet the required standards.

**Permissions**:
- `id-token: write`: Needed for OIDC authentication to the helm charts registry, if applicable.
- `contents: read`: Needed to clone the repository.
- `pull-requests: write`: Needed to comment on the related pull request.
- `packages: read`: Needed to pull the Helm charts from GitHub Container Registry, if applicable.

### Generate deployment
This workflow generates deployment files (CRs) for a Kubernetes sys-service workload based on a platform and sys_service you specify. It updates your GitOps repo (watched by ArgoCD) on the `deployment` branch.
**Permissions**:
- `id-token: write`: Needed for OIDC authentication to the helm charts registry, if applicable.
- `contents: write`: Needed to clone the repository and push the deployment artifacts branch against the `deployment` branch.
- `pull-requests: write`: Needed to create the pull-request against the `deployment` branch, and comment on it.
- `packages: read`: Needed to pull the Helm charts from GitHub Container Registry, if applicable.

## 1. 🖐️ Manual Deployment

This workflow generates deployment files (CRs) for a Kubernetes workload based on the platform you specify. It updates your GitOps repo (watched by ArgoCD) on the `deployment` branch.

---

### 1.1 📋 How to Use It

1. **Update Values**
   - Go to the state-sys-services repo’s default branch.
   - Edit the helm values files (e.g., in `kubernetes-sys-services/<cluster>/<service>/values.yaml`) with the desired changes.
   - Create a pull-request, wait for the `PR Verify` completion ✅ and merge it into the default branch.

2. **Head to Actions tab**
   - Go to the "Actions" tab on the repository.

3. **Locate the Generate Kubernetes deployment Workflow**
   - Find `Generate deployment` workflow in the list.

4. **Launch It**
   - Click "Run workflow".
   - Fill in the deployment coordinates:
     - `platform` (e.g., `my-eks-cluster`).
     - `sys_service` (e.g., `datadog`).
   - Hit "Run workflow" to start.

---

### 1.2 🌟 What You Get

- **Updated Repo**: Deployment manifests (CRs) are created or updated and land in a pull request against the `deployment` branch.
- **Summary**: Check the workflow logs on GitHub for details.
- **Deploy**: Merge the pull-request, and ArgoCD will sync the changes to the Kubernetes deployment cluster.

---

### 1.3 🛠️ Troubleshooting

- **Fails?** Look at the logs or summary in GitHub Actions. Verify your `platform` and `sys_service` inputs.
- **No PR?** Ensure the inputs match a valid Kubernetes workload path (e.g., `kubernetes-sys-services/my-platform/my-sys_service`).

---

## 2. 🤖 Automated Deployment

The `auto-generate-deployments` workflow runs automatically on pushes to the repository default branch. Its job is to detect changes that affect Kubernetes sys-services and, for each affected sys-service, trigger a run of the `generate-deployment` workflow.

How it works
- Trigger: any push to the repository default branch (the workflow is configured with a push trigger).
- Scan: the workflow inspects the set of changed files in the push and looks for changes under paths that match `kubernetes-sys-services/<platform>/<sys-service>/...`.
- File types considered: only files with `.yaml` or `.yml` extensions are evaluated. Other file types (for example `.md`, `.txt`, or tooling files) are ignored.
- Per-sys-service runs: if one or more YAML files changed inside a given sys-service directory (for example `kubernetes-sys-services/my-platform/my-sys-service/values.yaml`), the workflow invokes `generate-deployment` once for that particular sys-service.

Examples
- Single change: editing `kubernetes-sys-services/cluster-a/datadog/values.yaml` triggers one `generate-deployment` run for `cluster-a/datadog`.
- Multiple services: changing `kubernetes-sys-services/cluster-a/datadog/values.yaml` and `kubernetes-sys-services/cluster-a/stakater/values.yaml` triggers two separate `generate-deployment` runs, one per sys-service.
- Non-triggering change: editing `kubernetes-sys-services/cluster-a/README.md` or a top-level file under `kubernetes-sys-services/cluster-a/` that is not a `.yaml`/`.yml` will not trigger `generate-deployment`.

What to expect
- For each triggered `generate-deployment` run, deployment manifests (CRs) are rendered and a pull request is opened (or updated) against the `deployment` branch. The PR contains the generated artifacts for that sys-service.
- Workflow logs will list which changed files caused the trigger and which sys-service runs were started.

Troubleshooting
- No runs: confirm your changes are pushed to the repository default branch and are under `kubernetes-sys-services/<platform>/<sys-service>/` and that at least one changed file has a `.yaml` or `.yml` extension.
- Unexpected runs: verify the exact paths you changed. If you only want to update a single sys-service, avoid editing files for other services in the same push.


---

## ⚙️ Additional Configuration
- **config file**: A config file can be added to the repository to select the helmfile image version and additional commands to the container before the rendering process.
  - location: `.github`
  - name: `hydrate_k8s_config.yaml`
  - content:
    ```yaml
    # example
    image: ghcr.io/helmfile/helmfile:v1.1.0
    commands:
      - [apk, add, python]
    ```

---
