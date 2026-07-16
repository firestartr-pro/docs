# 🔍 GitHub Pages Support

Firestartr supports configuring GitHub Pages directly from your component claims. This documentation explains how to enable and configure GitHub Pages for your repositories.

## 📋 Overview

GitHub Pages allows you to publish websites directly from your GitHub repository. With Firestartr, you can configure GitHub Pages as part of your component claim, enabling a GitOps-driven approach to managing your static sites.

> ⚠️ **Important**: Only the **legacy** GitHub Pages build type is supported. Repositories using GitHub Actions for Pages deployment (`build_type: workflow`) are **not supported** and will be skipped during import.

## 🚀 Quick Start

To enable GitHub Pages on a repository, add the `pages` configuration to your ComponentClaim:

```yaml
kind: ComponentClaim
name: my-frontend-app
version: "1.0"
type: "service"
lifecycle: "production"
system: "system:my-system"
owner: "group:my-team"
providers:
  github:
    name: "my-frontend-app"
    org: "myorganization"
    visibility: "public"
    branchStrategy:
      name: trunkBasedDevelopment
      defaultBranch: "main"
    pages:
      cname: "docs.example.com"
      source:
        branch: "main"
        path: "/docs"
```

> 💡 **Tip**: The recommended values for `pages.source.path` are `"/"` (root) or `"/docs"` (docs directory).

## 📖 Configuration Reference

### Pages Configuration

```yaml
providers:
  github:
    pages: object                    # Optional. GitHub Pages configuration
      cname: string                  # Optional. Custom domain for GitHub Pages
      source: object                 # Optional. Pages source configuration
        branch: string               # Optional. Branch to publish from
        path: string                 # Optional. Directory to publish from (recommended: "/" or "/docs")
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pages` | object | No | GitHub Pages configuration block |
| `pages.cname` | string | No | Custom domain name for your GitHub Pages site (e.g., `docs.example.com`) |
| `pages.source.branch` | string | No | The branch to publish from. Defaults to the repository's default branch |
| `pages.source.path` | string | No | The directory to publish from. Defaults to `/` (root). Recommended values: `"/"` or `"/docs"` |

## 💡 Examples

### Basic GitHub Pages

Enable GitHub Pages with default settings (publishes from root of default branch):

```yaml
kind: ComponentClaim
name: my-docs-site
version: "1.0"
type: "service"
lifecycle: "production"
system: "system:documentation"
owner: "group:docs-team"
providers:
  github:
    name: "my-docs-site"
    org: "myorganization"
    visibility: "public"
    branchStrategy:
      name: trunkBasedDevelopment
      defaultBranch: "main"
    pages: {}
```

### Custom Domain Configuration

Configure GitHub Pages with a custom domain:

```yaml
kind: ComponentClaim
name: my-docs-site
version: "1.0"
type: "service"
lifecycle: "production"
system: "system:documentation"
owner: "group:docs-team"
providers:
  github:
    name: "my-docs-site"
    org: "myorganization"
    visibility: "public"
    branchStrategy:
      name: trunkBasedDevelopment
      defaultBranch: "main"
    pages:
      cname: "docs.mycompany.com"
```

### Specific Directory Publishing

Publish from a specific directory (e.g., `/docs` folder):

```yaml
kind: ComponentClaim
name: my-docs-site
version: "1.0"
type: "service"
lifecycle: "production"
system: "system:documentation"
owner: "group:docs-team"
providers:
  github:
    name: "my-docs-site"
    org: "myorganization"
    visibility: "public"
    branchStrategy:
      name: trunkBasedDevelopment
      defaultBranch: "main"
    pages:
      source:
        branch: "main"
        path: "/docs"
```

## ⚠️ Important Notes

### Branch Requirements

- **On Repository Creation**: The Pages source branch **must** match the repository's default branch
- **On Repository Update**: If the Pages branch differs from the default branch, it must already exist in the repository

### Build Type Limitations

Only the **legacy** GitHub Pages build type is supported. This means:

- ✅ Legacy build type: Direct publishing from a branch (configured via GitHub UI or API)
- ❌ Workflow build type: GitHub Actions-based deployment (managed via workflow files)

If your repository uses GitHub Actions for Pages deployment, the Pages configuration will be **skipped** during import and will not be managed by Firestartr.

### Import Behavior

When importing an existing repository with GitHub Pages already enabled:

1. The importer detects the existing Pages configuration
2. If using `build_type: legacy`, the configuration is added to the claim
3. If using `build_type: workflow`, the Pages configuration is **skipped**
4. The provisioner imports the existing Pages resource to prevent conflicts
5. Subsequent updates manage the Pages configuration normally

## 🔧 Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Pages branch must equal default branch on creation | Pages branch differs from default branch when creating a new repository | Set `pages.source.branch` to match your `branchStrategy.defaultBranch` |
| Pages branch does not exist in the repository | Pages branch is different from default branch and doesn't exist yet | Create the branch first, or use the default branch |
| 409 Conflict during import | Repository already has Pages enabled | Ensure the provisioner is configured to import existing Pages resources |
| Pages configuration ignored | Repository uses workflow build type | Only legacy build type is supported; configure Pages via GitHub Actions workflows instead |

### Validation Rules

- `pages.cname` must be a valid domain name if provided
- `pages.source.path` should start with `/` if specified. Recommended values are `"/"` (root) or `"/docs"` (docs directory)
- `pages.source.branch` must exist in the repository (unless it's the default branch on creation)

## 📚 Related Documentation

- [Component Claim Reference](../claims/component-claim.md)
- [The .firestartr Repository](./The-dot-firestartr-repository.md)
- [State Apps Repository](./state-apps-repository.md)

## 🔄 Migration Guide

### Enabling Pages on Existing Repository

To enable GitHub Pages on an existing repository managed by Firestartr:

1. Update your ComponentClaim with the `pages` configuration
2. Create a pull request with the changes
3. Merge the pull request to trigger the hydration workflow
4. The provisioner will configure GitHub Pages on your repository

### Disabling Pages

To disable GitHub Pages:

1. Remove the `pages` configuration from your ComponentClaim
2. Create a pull request with the changes
3. Merge the pull request to trigger the hydration workflow
4. The provisioner will remove the GitHub Pages configuration

---

**Note**: GitHub Pages is only supported for repositories using the legacy build type. Repositories using GitHub Actions for Pages deployment should manage their Pages configuration through workflow files instead.
