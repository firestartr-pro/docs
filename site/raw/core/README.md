# Firestartr Public Documentation

Welcome to the Firestartr public documentation. This documentation is intended for users and administrators of Firestartr, covering configuration, repository structures, and operational guides.

## Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
- [Repository Structures](#repository-structures)
- [Migration Guides](#migration-guides)

---

## Overview

### [Our Features](./Our-features.md)
Comprehensive list of all available Firestartr features with links to their documentation. Features include build and dispatch Docker images, claims repository management, issue templates, release management, state infrastructure, and state repository variants (apps and sys-services).

---

## Configuration

### [The .firestartr Repository](./The-dot-firestartr-repository.md)
Complete guide to the `.firestartr` configuration repository that every Firestartr client should have. Documents the repository structure including app configurations, Docker registries, platforms, providers, and validation policies with detailed field descriptions and examples.

---

## Repository Structures

### [State Apps Repository](./state-apps-repository.md)
Documentation on application repositories for deploying workloads in Kubernetes. Covers the directory structure for both `main` and `deployment` branches, automatic image updates, on-demand deployments, ArgoCD integration with ApplicationSet, notification system setup, and platform control through Argo Projects.

### [State Sys-Services Repository](./state-sys-services-repository.md)
Guide to managing system services for Kubernetes clusters (sys-services). Explains the repository structure for critical components like ingress controllers and configuration utilities, the `main` and `deployment` branch organization, and how ApplicationSets and AppProjects provide granular control per sys-service.

---

## Migration Guides

### [Migrating to Our New App State Repo Structure](./Migrating-to-our-new-app-state-repo-structure.md)
Step-by-step migration guide for transitioning old state repositories to the new application state repository structure. Includes prerequisites, creating new repos, updating charts, configuring `.firestartr`, updating `make_dispatches`, creating Argo projects and application sets, uninstalling old releases, rendering deployments, verification steps, and cleanup procedures. Also covers special cases like leaving production dispatching to old repos, updating namespaces, and migrating secrets.

---

## Additional Resources

For internal development documentation and architecture details, see the `../internal` directory.

## Quick Links

- **Features Documentation**: [Our Features](./Our-features.md)
- **.firestartr Config**: [The .firestartr Repository](./The-dot-firestartr-repository.md)
- **App Deployments**: [State Apps Repository](./state-apps-repository.md)
- **Sys Services**: [State Sys-Services Repository](./state-sys-services-repository.md)
- **Migration Guide**: [Migrating to New Structure](./Migrating-to-our-new-app-state-repo-structure.md)
