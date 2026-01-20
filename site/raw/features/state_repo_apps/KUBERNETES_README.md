# ☸️ How to Deploy a Kubernetes Workload

This feature makes deploying a Kubernetes workload a breeze! It allows changing the deployment configuration manually and also supports automatic updates of the services’ images when new versions are built and pushed to the registry.

*The deployment is done via GitOps, using ArgoCD. This means that the deployment is triggered when new changes arrive to the `deployment` branch in the state GitHub repository, which is then automatically picked up by ArgoCD and deployed to the Kubernetes cluster.*

***
## Configuration
To configure a new Kubernetes deployment for your application, you need to define the Helmfile configuration and Helm values files for each environment, in the repository default branch, inside the `kubernetes/<platform>/<tenant>/<environment>/` directory.

But, you first need to check if the deployment coordinates (platform, tenant, environment) are allowed for your application. You can check this in your `.firestartr` organization repository.

If the coordinates are not allowed, you need to add them in the `.firestartr` repository, following the instructions in the [Firestartr documentation](https://docs.firestartr.dev/docs/The-dot-firestartr-repository/).

### Helmfile Configuration

The Kubernetes workloads are defined using Helm charts, and rendered using Helmfile. Also Kustomize patches and exec commands can be defined to customize the rendered manifests.

Each Kubernetes environment must have a corresponding environment configuration file, located at `kubernetes/<platform>/<tenant>/<environment>/<environment_name>.yaml` in the repository default branch, and a set of values files inside the `kubernetes/<platform>/<tenant>/<environment>/` directory.

#### `<environment>.yaml` configuration file
This file defines a set of parameters used by the common [helm-apps Helmfile Go template](https://github.com/prefapp/daggerverse/blob/{{| ORCHESTRATOR_VERSION |}}/hydrate-orchestrator/modules/hydrate-kubernetes/helm-apps/helmfile.yaml.gotmpl) which is used by the [hydrate-orchestrator](https://github.com/prefapp/daggerverse/tree/{{| ORCHESTRATOR_VERSION |}}/hydrate-orchestrator) Dagger module, to render the specified charts and render the Kubernetes workload. An example of such file is shown below:

https://github.com/prefapp/daggerverse/blob/{{| ORCHESTRATOR_VERSION |}}/hydrate-orchestrator/modules/hydrate-kubernetes/fixtures/values-repo-dir/kubernetes/cluster-name/test-tenant/pre.yaml
```yaml
version: 0.1.0  # chart version
chart: prefapp/aws-web-service-umbrella # chart name
releaseName: sample-app # helm release name
namespace: my-namespace # kubernetes namespace
hooks: []

extraPatches: # Kustomize patches to apply to the rendered manifests
  - target:
      group: apps
      version: v1
      kind: Deployment
      name: sample-app-micro-a
    patch:
      - op: add
        path: /metadata/labels/manolo
        value: escobar
execs: # Exec commands to run after rendering the manifests
  - command: ".github/certs_to_ca_yaml.py"
    args: [
      "--ca_certs_path",
      "./kubernetes/{{.StateValues.cluster}}/{{.StateValues.tenant}}/{{$.Environment.Name}}/ca-certs",
      "--ca_yml_path",
      "./kubernetes/{{.StateValues.cluster}}/{{.StateValues.tenant}}/{{$.Environment.Name}}/ca.yaml"
    ]
```
#### Helm values files
Inside the `kubernetes/<platform>/<tenant>/<environment>/` directory, there must be a set of Helm values YAML files. These files contain the Helm values used to configure the Helm chart for the workload.

Helmfile will use the hydrate-orchestrator [helm-apps `values.yaml.gotmpl`](https://github.com/prefapp/daggerverse/blob/main/hydrate-orchestrator/modules/hydrate-kubernetes/helm-apps/values.yaml.gotmpl) template to render the values to be used for the Helm chart installation.

### GitHub Variables and Secrets
The feature's workflows can need the following GitHub **vars**, or **secrets** configured (at organization or repository level), to manage the access to the Helm charts registries, depending on the publication method used by the organization:

| Name  | Mandatory | Description   |
|-------|-----------|-----------------------------------------------------------------------------|
| `vars.HELM_CHARTS_PUBLICATION_TYPE` |   NO      | The publication method for the organization's Helm charts, and therefore, **the access method to the organization's helm charts registries** (i.e., `oci`, `https`). Default to `https` (public URL) |
| `vars.DOCKER_REGISTRY_RELEASES`     |   NO :one:     | The registry name, or URL, for the OCI Helm charts releases registry. It must exists in `.firestartr` repository **default** branch, inside the `/docker_registries` folder. :four:    |
| `vars.DOCKER_REGISTRY_SNAPSHOTS`    |   NO :one:     | The registry name, or URL, for the OCI Helm charts snapshots registry. It must exists in `.firestartr` repository **default** branch, inside the `/docker_registries` folder. :four: |
| `vars.AZURE_CLIENT_ID`               |   NO :two:     | The Managed Identity client ID, with access permissions to the Azure ACR, needed by the oci-auth tool to configure the `azure_oidc` integration. |
| `vars.AZURE_TENANT_ID`               |   NO :two:     | The Tenant ID where the ACR resides, needed by the oci-auth tool to configure the `azure_oidc` integration. |
| `vars.AZURE_SUBSCRIPTION_ID`         |   NO :two:     | The Azure subscription ID, where the ACR resides, needed by the oci-auth tool to configure the `azure_oidc` integration. |
| `vars.AWS_ROLE_ARN`                |   NO :two:     | The AWS IAM Role ARN, with access permissions to the ECR, needed by the oci-auth tool to configure the `aws_oidc` integration. |
| `vars.AWS_DEFAULT_REGION`                  |   NO :two:     | The AWS region where the ECR resides, needed by the oci-auth tool to configure the `aws_oidc` integration. |
| `vars.DOCKER_REGISTRY_RELEASES_USERNAME` |   NO :three:      | The username for the Helm OCI registry for releases.  |
| `vars.DOCKER_REGISTRY_SNAPSHOTS_USERNAME`|   NO :three:     | The username for the Helm OCI registry for snapshots. |
| `secrets.DOCKER_REGISTRY_RELEASES_PASSWORD` |   NO :three:     | The password for the Helm OCI registry for released chart versions. |
| `secrets.DOCKER_REGISTRY_SNAPSHOTS_PASSWORD` |  NO :three:   | The password for the Helm OCI registry for non-released chart versions.|

:one: Only needed if **`HELM_CHARTS_PUBLICATION_TYPE` is set to `oci`**

:two: Only needed if the registry authentication **is OIDC**, i.e.:
  - `azure_oidc` using a Managed Identity.
  - `aws_oidc` using an IAM Role.

:three: Only needed if the registry authentication **is not OIDC**, i.e.:
  - `ghcr` using a PAT distinct from the default actions' `GITHUB_TOKEN`. Else, the action will use the `GITHUB_TOKEN` by default.
  - `generic`, i.e. **user** & **password**.

See [auth-oci](https://github.com/prefapp/auth-oci) tool documentation for more details.

:four: The `docker_registries` folder contains a YAML files for each registry available in the organization, with the necessary configuration.
***

## Workflows
The feature provides the following GitHub Actions workflows:

### 🔎 Validate pull-requests (Validate PR)
This workflow validates changes in pull requests to ensure they meet the required standards.

**Permissions**:
- `id-token: write`: Needed for OIDC authentication to the helm charts registry, if applicable.
- `contents: read`: Needed to clone the repository.
- `pull-requests: write`: Needed to comment on the related pull request.
- `packages: read`: Needed to pull the Helm charts from GitHub Container Registry, if applicable.
***

### 🖐️ Manual Deployment (Generate Kubernetes Deployment)
This workflow is triggered manually, normally after merging a pull request with `kubernetes/**` configuration changes, and generates deployment files (CRs) for a Kubernetes workload based on a platform, tenant, and environment you specify. It updates your GitOps repo (watched by ArgoCD) on the `deployment` branch.

**Permissions**:
- `id-token: write`: Needed for OIDC authentication to the helm charts registry, if applicable.
- `contents: write`: Needed to clone the repository and push the deployment artifacts branch against the `deployment` branch.
- `pull-requests: write`: Needed to create the pull-request against the `deployment` branch, and comment on it.
- `packages: read`: Needed to pull the Helm charts from GitHub Container Registry, if applicable.
***

### 🤖 Automatic Deployment (Auto-generate Deployments)
This workflow automatically creates a deployment pull-request when changes are merged to the main branch in this repository. It scans for changes in `kubernetes/**` and automatically launches the deployment generation workflow if changes are detected.

**Permissions**:
- `contents: write`: Needed to clone the repository.
- `actions: write`: Needed to execute the other workflows in the repository.
***

#### 📋 How to Use The Manual Workflow

1. **Update Values**
   - Go to the relate state repo’s default branch. Normally this repositories are named `app-<application_name>`.
   - Edit the helm values files (e.g., in `kubernetes/<cluster>/<tenant>/<environment>/values.yaml`) with the desired changes.
   - Create a pull-request, wait for the `PR Verify` completion ✅ and merge it into the default branch.

2. **Head to Actions tab**
   - Go to the "Actions" tab on the state repository.

3. **Locate the Generate Kubernetes deployment Workflow**
   - Find `Generate kubernetes deployment` in the list.

4. **Launch It**
   - Click "Run workflow".
   - Fill in the deployment coordinates:
     - `platform` (e.g., `my-eks-cluster`).
     - `tenant` (e.g., `customer1`).
     - `environment` (e.g., `prod`).
   - Hit "Run workflow" to start.

---

#### 1.2 🌟 What You Get

- **Updated Repo**: Deployment manifests (CRs) are created or updated and land in a pull request against the `deployment` branch.
- **Summary**: Check the workflow logs on GitHub for details.
- **Deploy**: Merge the pull-request, and ArgoCD will sync the changes to the Kubernetes deployment cluster.

---

#### 1.3 🛠️ Troubleshooting

- **Fails?** Look at the logs or summary in GitHub Actions. Verify your `platform`, `tenant`, and `environment` inputs.
- **No PR?** Ensure the inputs match a valid Kubernetes workload path (e.g., `kubernetes/my-app/customer1/prod`).

***
### 🤖 Auto-Update (Dispatch Image to Kubernetes)
This workflow dispatches an event to trigger the auto-update of a Kubernetes workload when a new image is built and pushed to the registry.

**Permissions**:
- `id-token: write`: Needed for OIDC authentication to the helm charts registry, if applicable.
- `contents: write`: Needed to clone the repository and push the deployment artifacts branch against the `deployment` branch.
- `pull-requests: write`: Needed to create the pull-request against the `deployment` branch, and comment on it.
- `packages: read`: Needed to pull the Helm charts from GitHub Container Registry, if applicable.

This workflow automatically updates image versions in your Kubernetes workloads when a new image is built and pushed to the organization registry, creating a deployment pull-request for you.

---

#### 2.1 🔄 How It Works

- **Trigger**: Runs when a `dispatch-image-kubernetes` event hits the repo (e.g., a new image is built in the service's code repository).
- **Process**: Updates your Kubernetes workload with the new image and generates a pull-request against the `deployment` branch.

1. It grabs the new image from the event.
2. Updates the workload in `kubernetes/<platform>/<tenant>/<environment>`.
3. Opens a pull-request with updated deployment files (CRs).

- **Auto-Merge feature**:
  - If `kubernetes/<platform>/<tenant>/<environment>/AUTO_MERGE` exists in the state repo default branch, the pull-request is auto-merged!
  - Otherwise, it waits for your approval and merge.

---

#### 2.2 🌈 What You Get

- **PR Ready**: Updated CRs in a PR against `deployment`.
- **Auto or Manual**: Auto-merged if `AUTO_MERGE` is there; otherwise, merge it yourself.
- **Logs**: See the summary in the workflow logs on GitHub.

---

#### 2.3 ⚙️ Additional Configuration
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

#### 2.4 🛠️ Troubleshooting

- **Fails?** Check the logs. Ensure the event includes valid image data.
- **PR Not Merging?** Verify `AUTO_MERGE` is in `kubernetes/<platform>/<tenant>/<environment/>`.
- **No PR?** Confirm the event was triggered correctly.

***

### 🎉 Quick Tips
- **Manual (1)**: Great for testing or specific deployments.
- **Auto (2)**: Keeps your workloads fresh with zero effort.
- Merge the PR, and ArgoCD will roll it out to your cluster!
