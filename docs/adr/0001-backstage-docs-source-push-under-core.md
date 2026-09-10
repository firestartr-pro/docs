# Keep source-push aggregation with a Backstage-owned core/docs subtree

The central Firestartr documentation repository remains an aggregation target using the established source-push model. Backstage owns `site/raw/core/docs/backstage/` for its public guide, sourced only from `prefapp-backstage/docs/public/**`, and places image assets in the shared `site/raw/images` directory with deterministic category-qualified names of the form `backstage-<category>-<basename>`. This gives a distinct `/docs/backstage/` section through the existing recursive Hugo migration while minimizing cross-repository changes and preserving existing URLs.

## Considered Options

- **New top-level Backstage namespace** — rejected because it would require destination deployment changes.
- **Centralized target-side pulling** — rejected as a larger redesign of the source-push model.
- **Merge Backstage pages into GitOps-owned pages** — rejected because ownership would be unclear.

## Consequences

Every source publisher may replace or delete only content it owns and must preserve other publishers' namespaces. The GitOps docs publisher must therefore preserve the Backstage subtree even though both publishers live under `core/docs`.
