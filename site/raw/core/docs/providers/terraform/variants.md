# TFWorkspaceClaim Variants

## What is a variant?

A **variant** is a Terraform workspace derived from a parent TFWorkspaceClaim that
inherits all of the parent's configuration but applies targeted differences. The
parent claim remains the single source of truth; each variant is a full workspace
with its own lifecycle, state, and identity.

Variants are for **nearly identical workspaces that should evolve together**. The
canonical example is a **disaster recovery** resource — same configuration as the
primary, small per-environment differences.

For example, a parent workspace `s3-demo-staging` with a variant `dr` produces
**two** independent workspaces: the parent (`s3-demo-staging`) and the disaster
recovery copy (`s3-demo-staging-dr`).

## Simple example

Given an org named `foo` with a Terraform workspace `s3-bucket` in staging,
you can create a disaster recovery variant for the `us-west-1` region:

```yaml
kind: TFWorkspaceClaim
lifecycle: staging
name: s3-bucket
owner: "group:foo"
system: "system:foo"
version: "1.0"
providers:
  terraform:
    name: s3-bucket
    policy: full-control
    source: Inline
    values:
      bucket_name: foo-staging-data
      environment: staging
      region: eu-west-1
    context:
      providers:
        - name: aws-foo-eu
      backend:
        name: tfstate-foo-staging
    variants:
      - name: dr-us
        overrides:
          values:
            bucket_name: foo-staging-data-dr
            environment: staging-dr
            region: us-west-1
          context:
            providers:
              - name: aws-foo-us
```

This produces **two** FirestartrTerraformWorkspace CRs:
- `s3-bucket` — the original parent
- `s3-bucket-dr-us` — the variant for us-west-1

## How to use variants

### Declare a variant

Add a `variants` array under `providers.terraform` in any TFWorkspaceClaim. Each
variant entry needs:

| Field | Description |
|---|---|
| `name` | Short suffix (max 10 characters). Combined with the parent's terraform name to form the composed name. |
| `overrides` | Fields you want to change from the parent. Everything else is inherited. |

### What you can override

| Allowed | Prohibited |
|---|---|
| `values` | `source` |
| `context` | `module` |
| `policy` | `name` |
| `sync` | |
| `tfStateKey` | |
| `files` | |
| `valuesSchema` | |

`source`, `module`, and `name` are prohibited because they would change
fundamental provisioning semantics. The composed name is always automatically
derived and can never be overridden.

Overrides use **deep merge** — you can change a single key inside `values` or
a single tag without re-declaring everything else. Some blocks (like `sync`)
require the full block to be re-declared in the override.

### Parent and variant lifecycle

- The parent continues to exist as a **real workspace** alongside its variants.
  It is not converted into a template.
- Deleting the parent claim file **deletes all its variants**.
- Each variant has its own state (tfStateKey), policy, and sync schedule.
- Changes to the parent (source, module, values) **propagate to all variants**
  unless a variant explicitly overrides that field.

### Reference a variant from another workspace

Other TFWorkspaceClaims can reference a variant's outputs using the **composed
name** in the standard reference syntax:

```yaml
${{ tfworkspace:<composed-name>:outputs.<key> }}
```

For example, to reference the `s3-bucket-dr-us` variant's bucket ARN from
another workspace:

```yaml
kind: TFWorkspaceClaim
name: data-processor
providers:
  terraform:
    name: data-processor
    source: Inline
    values:
      source_bucket: ${{ tfworkspace:s3-bucket-dr-us:outputs.bucket_arn }}
      source_region: us-west-1
```

The parent and each variant are **independently referenceable** — you can target
the parent (`s3-bucket`) or either variant separately.

## Limitations

- No nested variants — a variant cannot itself declare variants.
- Parent changes propagate to all variants — no per-variant opt-out.
- Migrating a variant to a standalone claim is a manual process.
