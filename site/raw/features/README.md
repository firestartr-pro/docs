# Firestartr Features Repository

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

## Local Installation

To install dependencies locally, you need a GitHub token with `package:read` permissions to authenticate against the GitHub npm registry.

1. Create a [GitHub personal access token](https://github.com/settings/tokens) with the `package:read` scope.
2. Save the token in a `.token` file at the root of this repository:
   ```bash
   echo "ghp_your_token_here" > .token
   ```
3. Run the Makefile to configure pnpm and install dependencies:
   ```bash
   make init
   ```

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
# There are two types of args:
# $ref: replaced by the value from the metadata section of the config.yaml file
# $lit: literal value
args:
  ORG:
    $ref: [spec, org]
  REPO_NAME:
    $ref: [metadata, name]

# Files to render from the templates/ folder
files:
  - src: mkdocs.yaml
    dest: mkdocs.yaml
    # If upgradable is true, the user can modify it. It will not be overridden or deleted on update/uninstall.
    upgradable: true
  - src: docs/index.md
    dest: docs/index.md
    upgradable: true

# Patches to apply in the component catalog file using JSON Patch (RFC 6902) when the feature is installed
patches:
  - name: "add_annotation"
    op: "add"
    path: "/metadata/annotations/backstage.io~1techdocs-ref"
    # Values can use Mustache syntax with 
    value: "url:https://github.com/prefapp/features/tree/main"
```

### Template syntax

We use the [Mustache](https://mustache.github.io/mustache.5.html) template engine.
You can add logic with conditionals:

```mustache

  In case the condition is false
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

### Using generic-fixtures/cr.yaml

The `generic-fixtures/cr.yaml` file provides a reusable Custom Resource (CR) fixture for testing feature rendering. This fixture contains a complete example of a `FirestartrGithubRepository` resource with all common fields populated.

#### How to use it

Each feature package includes a `render_tests.yaml` file that defines test cases. To use the generic fixture:

```yaml
# packages/<feature-name>/render_tests.yaml
tests:
  - name: test1
    cr: "../../generic-fixtures/cr.yaml"
```

#### What the fixture provides

The generic CR fixture includes:

- **Metadata**: annotations, labels, and resource name
- **Spec.org**: Organization name (`firestartr-test`)
- **Spec.context**: Backend and provider references
- **Spec.firestartr**: Technology stack and state key configuration
- **Spec.repo**: Repository settings (visibility, branches, merge options, etc.)
- **Spec.actions**: OIDC configuration
- **Spec.permissions**: Team/group permissions
- **Spec.branchProtections**: Branch protection rules

#### Creating custom fixtures

If your feature requires specific CR fields not covered by the generic fixture, you can:

1. Create a custom fixture in your feature's `__tests__/` folder:

   ```yaml
   # packages/<feature-name>/__tests__/custom-cr.yaml
   apiVersion: firestartr.dev/v1
   kind: FirestartrGithubRepository
   metadata:
     name: my-custom-resource
   spec:
     # ... your custom fields
   ```

2. Reference it in your `render_tests.yaml`:
   ```yaml
   tests:
     - name: custom-test
       cr: "./__tests__/custom-cr.yaml"
   ```

---

## Links

- [Firestartr Documentation](https://docs.firestartr.dev)
- [All Official Features](https://docs.firestartr.dev/docs/features/)

Built with ❤️ using Firestartr
