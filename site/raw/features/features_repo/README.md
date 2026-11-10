# Firestartr Features Repository

## Overview

This feature provides the initial setup for the Firestartr features monorepo, your organization's private registry of reusable, Mustache-templated Firestartr features.

<p align="center">
  <img src="https://docs.firestartr.dev/docs/favicon.png" alt="Firestartr" width="320">
</p>

<p align="center">
  <strong>Your organization’s private registry of reusable Firestartr features</strong>
</p>

---

## About

This repository is a **monorepo** that holds all custom Firestartr features for your organization.

Every feature lives under `packages/`, uses **Mustache** templating, and is defined via a powerful `config.yaml` (file rendering + JSON Patch support for Backstage catalog, etc.).

Features are automatically versioned using **Conventional Commits** via the `release_please` companion feature (see [Required companion features](#required-companion-features)).

---

## Required companion features

The `release_please` feature must be applied to this repository alongside `features_repo`. It handles automated versioning and changelog generation for each package under `packages/` using Conventional Commits.

Add it to your repository's feature list with the following configuration:

```yaml
- name: release_please
  ref: release_please-v1 # Use the latest stable version
  args:
    release_type: node
```

---

## Repository structure

```bash
.
├── packages/
│   ├── my-awesome-feature/
│   │   ├── templates/             # Mustache templates go here
│   │   ├── config.yaml            # Feature definition
│   │   ├── package.json
│   │   └── README.md
│   └── another-feature/
├── .release-please-manifest.json
├── release-please-config.json
├── .github/
│   └── workflows/                 # CI/release workflows (managed by features)
└── README.md
```

## Centrally managed tooling

Root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and shared `scripts/*.js` are centrally managed by `features_repo`. Do not edit them: feature updates restore their canonical content. The root `packageManager` field pins the pnpm version used locally and in CI.

Feature packages under `packages/` are not pnpm workspace members. They **must not declare dependencies**, including `devDependencies`, because those dependencies are not installed. Feature tests use the shared tooling in root `node_modules` instead.

Run `pnpm test` to run root tests and each feature's `test` script. Packages without a `test` script are skipped.

## Contributing to Features

### Creating a new feature

- Create a new branch from main with the name of the feature you want to create.
- Create a new folder in packages/ with the name of the feature (kebab-case recommended).
- Create a templates/ folder inside it.
- Create a config.yaml file using the structure below.
- Add the new package to `.release-please-manifest.json` and `release-please-config.json` (these files are created/managed by the `release_please` feature).
- Create a package.json file using npm init.

config.yaml structure

```
feature_name: example

# The following are the args that will be used to render the templates.
# $ref: replaced by the value at the given path in the Claim
# $lit: literal value
# $arg: The name of the argument as consumed by the claim (each $arg becomes a schema property)
# $default: The default value for the argument
# $format: Optional named value type resolved from the registry in scripts/arg-formats.js
#          (string, int, bool, semver, semver-range, string-list). It controls the JSON
#          type emitted for the argument in schema.json:
#            string         -> { type: "string" } (no pattern)
#            int            -> { type: "integer" }
#            bool           -> { type: "boolean" }
#            semver         -> { type: "string", pattern: <semver regexp> }
#            semver-range   -> { type: "string", pattern: <npm semver range regexp> }
#            string-list    -> { type: "array", items: { type: "string" } }
#          The generated schema.json validates claimed values against these native
#          types; only $defaults are checked at schema generation and emitted as native
#          types (a quoted "8080" becomes the integer 8080). Unknown formats fail
#          schema generation.
args:
  ORG:
    $ref: [providers, github, org]
  REPO_NAME:
    $ref: [providers, github, name]
  APP_NAME:
    $default: "my-app"
    $arg: app_name
    $format: string

# Files to render from the templates/ folder
files:
  - src: mkdocs.yaml
    dest: mkdocs.yaml
    # If upgradable is true, the user can modify it. It will not be overridden or deleted on update/uninstall.
    upgradable: true
  - src: docs/index.md
    dest: docs/index.md
    upgradable: true

# Patches to apply to the Claim using [JSON patch](https://www.rfc-editor.org/rfc/rfc6902)
# notation when the feature is installed. Use a flat list with Claim-relative paths
# (for example, /annotations/... or /providers/github/labels/-).
# Values can be rendered the same way as the files.
claimPatches:
  - name: "add_annotation"
    op: "add"
    path: "/annotations/backstage.io~1techdocs-ref"
{{|=<% %>=|}}
    # Values can use Mustache syntax with {{| VAR |}}
    value: "url:https://github.com/{{| ORG |}}/{{| REPO_NAME |}}/tree/main"
<%={{| |}}=%>
```

### Template syntax

We use the [Mustache](https://mustache.github.io/mustache.5.html) template engine.
You can add logic with conditionals:

```mustache
{{|=<% %>=|}}
{{| #condition |}}
  {{| variable |}}   ← this renders when condition is true
{{| /condition |}}

{{| ^condition |}}
  In case the condition is false
{{| /condition |}}
<%={{| |}}=%>
```

### Updating an existing feature

- Create a new branch from main.
- Modify the feature inside packages/<feature-name>/.
- Merge the branch using a [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) → `release_please` will automatically create a new release.

### Removing an existing feature

- Create a new branch from `main`.
- Remove the feature directory under `packages/`.
- Remove the feature from `.release-please-manifest.json` and `release-please-config.json`.
- Merge the branch using a Conventional Commit → `release_please` creates a new release without the feature.

---

## Testing Features

### Using generic-fixtures/claim.yaml

The `generic-fixtures/claim.yaml` file provides a reusable `ComponentClaim` fixture for testing feature rendering. It uses the stitched-claim shape the renderer expects — top-level `providers.github` — which is what the `$ref`s in each feature's `config.yaml` resolve against.

#### How to use it

Each feature package includes a `render_tests.yaml` file that defines test cases. To use the generic fixture:

```yaml
# packages/<feature-name>/render_tests.yaml
tests:
  - name: test1
    claim: "../../generic-fixtures/claim.yaml"
```

#### Legacy fixture: generic-fixtures/cr.yaml

`generic-fixtures/cr.yaml` retains the legacy `FirestartrGithubRepository` fixture for features whose `render_tests.yaml` still uses `cr:`. Use `claim.yaml` with `claim:` for features migrated to ComponentClaims.

#### What the fixture provides

The generic claim fixture includes:

- **kind**: `ComponentClaim`, the input kind the renderer validates by default
- **name**: Claim name (`claims`)
- **providers.github.org**: Organization name (`firestartr-test`)
- **providers.github.name**: Repository name (`claims`)
- **providers.github.branchStrategy.defaultBranch**: Default branch (`main`)
- **providers.github.actions.oidc**: OIDC configuration

#### Creating custom fixtures

If your feature requires specific claim fields not covered by the generic fixture, you can:

1. Create a custom fixture in your feature's `__tests__/` folder:

   ```yaml
   # packages/<feature-name>/__tests__/custom-claim.yaml
   apiVersion: firestartr.dev/v1
   kind: ComponentClaim
   name: my-custom-claim
   providers:
     github:
       org: my-org
       # ... your custom fields
   ```

2. Reference it in your `render_tests.yaml`:
   ```yaml
   tests:
     - name: custom-test
       claim: "./__tests__/custom-claim.yaml"
   ```

---

## Schema promotion

Each feature package has a `schema.json` that documents its user-feedable arguments and file manifest. It is generated from `config.yaml` with:

```bash
pnpm generate:schemas
```

Regeneration preserves the manual enrichments already present in a `schema.json`: property
`description`/`examples`, and top-level `required` entries that `config.yaml` does not
contradict — a `$default` declared for an arg keeps it optional, and an entry whose `$arg`
was removed is dropped. Running it twice produces identical output. The result is kept in
sync by the `pr_verify` workflow.

Schema promotion is opt-in: the **Promote Schemas to Docs Repo** workflow is only installed when `disable_promote_schemas` is set to `false`. When enabled, on every feature release it promotes the generated schemas to the objective docs repository `{{| DOCS_ORG |}}/{{| DOCS_REPO_NAME |}}` (defaults: `firestartr-pro/docs`). For each feature and version it writes:

- `site/raw/features/<feature>/<version>/schema.json`
- an updated `site/raw/features/versions.json`

### Arguments

- `docs_org`: the GitHub organization that owns the docs repository (default: `firestartr-pro`).
- `docs_repo_name`: the repository that receives the generated feature schemas (default: `docs`).
- `disable_promote_schemas`: whether to skip the schema promotion workflow (default: `true`). Set it to `false` to install it.

The workflow authenticates with a GitHub App that has write access to the docs repository. Configure it in the repository settings with the `FIRESTARTER_DOCS_APP_ID` variable and the `FIRESTARTR_DOCS_APP_PEM_FILE` secret.

---

## Links

- [Firestartr Documentation](https://docs.firestartr.dev)
- [All Official Features](https://docs.firestartr.dev/docs/features/)

Built with ❤️ using Firestartr
