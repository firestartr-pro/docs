# Permissions

The portal uses an annotation-based permission system to control who can modify
resources. Permissions are driven by annotations declared in your claim files
and rendered into User and Group catalog entities — no separate admin UI is
needed.

## How it works

Every authenticated user can **read** any resource in the catalog. To **modify**
resources (provision, edit settings, install features), a user needs write
access. Write access is granted through two mechanisms:

1. **Org owner** — users with `firestartr.backstage.dev/org-role: owner` on
   their User entity have unconditional full access.
2. **Group membership** — users who belong to a Group with
   `firestartr.backstage.dev/role: write` inherit write access from that group.

If neither applies, the user is read-only.

## Setting up permission annotations

Permission annotations are declared in your **claim files** (the YAML resources
that describe your users and groups). When the portal provisions or updates a
resource, the renderer reads the `annotations` field from the claim and injects
it into the corresponding Backstage catalog entity. The permission policy then
evaluates those annotations at runtime.

### Org-owner access (User claims)

To grant a user unconditional full access, add the
`firestartr.backstage.dev/org-role: owner` annotation to your User claim:

**Claim file** (`claims/users/admin.yaml`):

```yaml
kind: UserClaim
name: admin
providers:
  github:
    name: Admin User
    org: my-org
    role: admin
annotations:
  firestartr.backstage.dev/org-role: owner
```

**Rendered catalog entity:**

```yaml
apiVersion: backstage.io/v1alpha1
kind: User
metadata:
  name: admin
  annotations:
    github.com/user-login: admin
    firestartr.backstage.dev/org-role: owner
spec:
  memberOf:
    - my-org
```

Org-owner access is granted **only** by this annotation. The GitHub
`providers.github.role: admin` value does not grant it on its own.

### Write access via group membership (Group claims)

To grant write access to all members of a group, add the
`firestartr.backstage.dev/role: write` annotation to your Group claim:

**Claim file** (`claims/groups/platform-team.yaml`):

```yaml
kind: GroupClaim
name: platform-team
type: team
providers:
  github:
    name: Platform Team
annotations:
  firestartr.backstage.dev/role: write
members:
  - admin
  - developer-1
```

**Rendered catalog entity:**

```yaml
apiVersion: backstage.io/v1alpha1
kind: Group
metadata:
  name: platform-team
  annotations:
    github.com/team-slug: my-org/platform-team
    firestartr.backstage.dev/role: write
spec:
  type: team
  members:
    - user:default/admin
    - user:default/developer-1
  children: []
```

All members of `platform-team` (here: `admin`, `developer-1`) inherit write
access through group membership.

### Regular users (read-only)

Users with `providers.github.role: member` and no explicit
`firestartr.backstage.dev/org-role` annotation receive **no** org-role
annotation. They are treated as read-only by the permission policy:

**Claim file** (`claims/users/regular-dev.yaml`):

```yaml
kind: UserClaim
name: regular-dev
providers:
  github:
    name: Regular Developer
    org: my-org
    role: member
```

**Rendered catalog entity** (no org-role annotation):

```yaml
apiVersion: backstage.io/v1alpha1
kind: User
metadata:
  name: regular-dev
  annotations:
    github.com/user-login: regular-dev
spec:
  memberOf:
    - my-org
```

## Annotation namespace

All Backstage permission annotations use the `firestartr.backstage.dev/`
namespace. This is distinct from the `firestartr.dev/` namespace used on
Kubernetes custom resources, so the two never collide.

## Caching

Permission lookups are cached for 5 minutes. If you change a user's or group's
annotations, the change takes effect within that window. Org owners can
invalidate the cache immediately by calling `POST /api/firestartr-backend/claims-ctl/admin/catalog-refresh`.

## Failure mode

If the catalog service is temporarily unavailable, the permission system
**fails closed** — all users become read-only until the catalog recovers. This
prevents unauthorized writes during transient outages.

## What is affected

Write access is checked on the following operations:

- Provisioning new resources
- Editing resource settings
- Installing, modifying or removing features
- Batch operations
- Deleting resources (unprovision, from the Danger zone)
- Force rehydrating a claim

Read operations (browsing the catalog, viewing resource details) are always
allowed for authenticated users. Only org owners can call the catalog-refresh
admin endpoint, which requires the org-owner annotation specifically.
