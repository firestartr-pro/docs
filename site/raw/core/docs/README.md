# Deploying resources

This section covers the repositories that Firestartr manages, and the guides for
configuring and migrating them. It collects the `.firestartr` configuration
repository, the application and system-service state repositories, claim validation,
and the migration to the new application state repository structure.

## Guides

### [The .firestartr Repository](./The-dot-firestartr-repository.md)
Complete guide to the `.firestartr` configuration repository that every Firestartr client should have. Documents the repository structure including app configurations, Docker registries, platforms, providers, and validation policies with detailed field descriptions and examples.

### [State Apps Repository](./state-apps-repository.md)
Documentation on application repositories for deploying workloads in Kubernetes. Covers the directory structure for both `main` and `deployment` branches, automatic image updates, on-demand deployments, ArgoCD integration with ApplicationSet, notification system setup, and platform control through Argo Projects.

### [State Sys-Services Repository](./state-sys-services-repository.md)
Guide to managing system services for Kubernetes clusters (sys-services). Explains the repository structure for critical components like ingress controllers and configuration utilities, the `main` and `deployment` branch organization, and how ApplicationSets and AppProjects provide granular control per sys-service.

### [Validating Our Claims](./Validating-our-claims.md)
Step-by-step guide to validating claims: define the rule as a Rego policy in the `.firestartr` repository, attach it to apps and claim kinds with `applyTo`, and test it quickly.

### [Migrating to Our New App State Repo Structure](./Migrating-to-our-new-app-state-repo-structure.md)
Step-by-step migration guide for transitioning old state repositories to the new application state repository structure. Includes prerequisites, creating new repos, updating charts, configuring `.firestartr`, updating `make_dispatches`, creating Argo projects and application sets, uninstalling old releases, rendering deployments, verification steps, and cleanup procedures. Also covers special cases like leaving production dispatching to old repos, updating namespaces, and migrating secrets.

## Related sections

- [Features](../features/) — the catalog of features you can apply to repositories.
- [Providers](../providers/) — provider documentation, including the [Terraform provider](../providers/terraform/).
