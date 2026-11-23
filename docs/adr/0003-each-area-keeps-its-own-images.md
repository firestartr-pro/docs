---
status: accepted
---

# Each Area keeps its own images

Every Area that has images keeps them in an `images/` folder inside the Area and links them
relatively. `docs_publisher` writes that folder whenever it publishes the Area, so a source
repository owns its own assets, and `scripts/migrate-content.sh` copies each of those folders
to `site/web/static/images/<area>/`, at any depth, and rewrites the Area's pages to that
path. A page whose Area has no images keeps the shared `/images/` root, which is where the
destination-owned homepage images live.

This supersedes ADR-0001's image rule only: the publisher now decides where an Area's images
live, so the shared `site/raw/images` directory and its deterministic
`backstage-<category>-<basename>` names are gone. ADR-0001's aggregation model and its
Backstage-owned `core/docs/backstage` subtree still stand.

## Considered Options

- **Keep the flat `site/raw/images` directory** — rejected because no repository can name
  another's assets safely: two Areas that ship the same file name collide, and the naming
  convention only worked for the one publisher that followed it.
- **Publish everything under the shared `/images/` root from per-Area folders** — rejected
  because it re-creates the collision, and because a page could no longer resolve its images
  from the Area it came from.

## Consequences

Deleting an Area deletes its images with it, so no orphaned copies are left behind. Image
URLs carry the Area's path (`/docs/images/<area>/...`), so moving a page between Areas
changes its image URLs, and the retired flat `/docs/images/<package>-<image>` URLs stop
resolving once no published page links them.
