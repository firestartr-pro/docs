# build_and_publish_lambda_code

## Overview

This feature provides templates and workflows to automate building, publishing, and deploying Node.js service code to Amazon S3 and existing AWS Lambda functions. It follows the standard organization convention of separating code build from infrastructure deployment.

It does **not** deploy Lambda infrastructure. Its optional deploy workflow only updates the code of an existing Lambda with `aws lambda update-function-code`; Terraform or another infrastructure workflow remains responsible for creating and changing resources.

The workflow uses **esbuild** to bundle your TypeScript/JavaScript Lambda handler into a single file, packages it as a `.zip`, and publishes it to the configured S3 bucket with a standardized path convention.

The artifact zip contains the build output at its root: the default bundle is zipped as `index.js`, a directory output is zipped with its contents at the root, and `node_modules/` is added at the root when `include_node_modules` is enabled. Point the Lambda handler at the root (e.g. `index.handler`).

Two build modes are supported:

- **Release mode** — triggered by a GitHub Release with a tag like `my-service-v1.2.3`. Produces a versioned zip at `{bucket}/{repo}/{service-name}/{version}.zip`, where `{version}` includes the leading `v`.
- **Snapshot mode** (`workflow_dispatch`) — triggered manually from a branch. Computes the short SHA after checkout and produces `{sha}.zip` artifacts. Supports building all services from the config file at once.

---

## How It Works

### Release mode

1. A GitHub Release is published with a tag matching `{service-name}-v{semver}`
2. The `build_and_publish_lambda_code.yaml` workflow fires automatically
3. It reads the build config file, resolves the service path and name, checks out the tag, installs dependencies with pnpm, bundles the handler with esbuild, and publishes `{version}.zip` to S3

### Snapshot mode

1. Trigger `build_and_publish_lambda_code.yaml` via `workflow_dispatch`, providing a branch name
2. The workflow checks out the branch, computes the short SHA, and builds:
   - **All mode** (`all: true`, default): processes every service declared in the config file, publishing each as `{repo}/{service-name}/{sha}.zip`
   - **Single mode** (`all: false`): builds the service at `prefix`, publishing as `{repo}/{service-name}/{sha}.zip`

---

## Monorepo Layout

By default the feature expects services under `packages/`:

```
repo/
  packages/
    my-service/
      package.json
      src/handler.ts
    another-service/
      package.json
      ...
  .github/
    build_lambda_packages.yaml
  pnpm-workspace.yaml        ← repo root
  .node-version              ← repo root
  pnpm-lock.yaml
```

The build config file (`.github/build_lambda_packages.yaml`) declares each service, its path, its logical service name (used in the S3 path), and an optional handler override.

---

## pnpm and Supply Chain Security

The feature uses **pnpm** with the following supply chain security measures:

- **Corepack** — pnpm version is pinned via `corepack` (not `latest`)
- **`--frozen-lockfile`** — build fails if lockfile is out of sync with `package.json`
- **`--ignore-scripts`** — all postinstall scripts are blocked during the workspace-root `pnpm install`. The workflow invokes a pinned esbuild version with `pnpm dlx`; for services with `include_node_modules: true`, the `pnpm deploy` step does **not** use `--ignore-scripts` and instead honours `onlyBuiltDependencies` in `pnpm-workspace.yaml` — list any native dependency (e.g. `sharp`, `bcrypt`, `prisma`) there to allow its install script to run in the deployed artifact.
- **`minimumReleaseAge`** — only package versions at least 2 days old are installed (configured in `pnpm-workspace.yaml`)

A `pnpm-workspace.yaml` file is placed in the repository root (user-managed) with security defaults:

```yaml
onlyBuiltDependencies:
  - esbuild   # esbuild needs its postinstall to download its binary
  # Add other packages here as needed

minimumReleaseAge: 2880

# Required for pnpm deploy to include workspace-local packages.
injectWorkspacePackages: true
```

Edit `pnpm-workspace.yaml` to allow additional packages as needed.

---

## Using Variables in Claims

```yaml
apiVersion: features.prefapp.io/v1
kind: BuildAndPublishLambdaCodeClaim
metadata:
  name: my-service-claim
spec:
  feature: build_and_publish_lambda_code
  variables:
    s3_bucket: "zepo-lambda-sources"
    # Must match the exact uppercase GitHub repository variable name.
    aws_oidc_s3_role_var_name: "AWS_OIDC_S3_ROLE"
    aws_region: "eu-west-3"
    handler_path: "src/handler.ts"
    service_root_dir: "packages/"
```

---

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `s3_bucket` | `zepo-lambda-sources` | S3 bucket for Lambda zip artifacts |
| `aws_oidc_s3_role_var_name` | `AWS_OIDC_S3_ROLE` | Exact uppercase GitHub Actions repository variable name containing the IAM role ARN for OIDC authentication |
| `aws_region` | `eu-west-3` | AWS region of the S3 bucket |
| `handler_path` | `src/handler.ts` | esbuild entry point; applied to all services |
| `minify_default` | `"true"` | Default for esbuild minification |
| `service_root_dir` | `packages/` | Root directory scanned for services in dispatch/all mode (fallback when no config file) |
| `build_config_file` | `.github/build_lambda_packages.yaml` | Path to per-service build configuration file |
| `pnpm_version` | `"11"` | Version of pnpm to pin via corepack |
| `esbuild_version` | `0.27.0` | Version of esbuild to invoke with `pnpm dlx` |
