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

Features are automatically versioned with **Release Please** using Conventional Commits.

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
│   └── workflows/                 # Optional CI/release workflows
└── README.md
```

## Contributing to Features

### Creating a new feature

- Create a new branch from main with the name of the feature you want to create.
- Create a new folder in packages/ with the name of the feature (kebab-case recommended).
- Create a templates/ folder inside it.
- Create a config.yaml file using the structure below.
- Add the new feature to .release-please-manifest.json and release-please-config.json.
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
    # Values can use Mustache syntax with {{| VAR |}}
    value: "url:https://github.com/{{| ORG |}}/{{| REPO_NAME |}}/tree/main"
```

### Template syntax

We use the [Mustache](https://mustache.github.io/mustache.5.html) template engine.
You can add logic with conditionals:
```mustache
{{| #condition |}}
  {{| variable |}}   ← this renders when condition is true
{{| /condition |}}

{{| ^condition |}}
  In case the condition is false
{{| /condition |}}
```

### Updating an existing feature

- Create a new branch from main.
- Modify the feature inside packages/<feature-name>/.
- Merge the branch using a [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) → Release Please will automatically create a new release.

### Removing an existing feature

- Create a new branch from ```main```.
- Remove the feature directory under ```packages/```.
- Remove the feature from ```.release-please-manifest.json```.
- Merge the branch using a Conventional Commit → new release is created without the feature.


## Links

- [Firestartr Documentation](https://docs.firestartr.dev)
- [All Official Features](https://docs.firestartr.dev/docs/features/)

Built with ❤️  using Firestartr
