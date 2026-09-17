# Context

Lightweight glossary for this repository. This marks the repo as following the lightweight
development workflow; it lists shared terms only and is not a specification.

## Repository map

- **`site/raw/`** — Promoted technical material produced by other repositories (`core/`,
  `features/`, `images/`, `tfm/`). Edited upstream, not editorial content of this site.
- **`site/homepage/`** — Destination-owned editorial homepage source, including its image
  assets. Tracked here and never written by a promotion.
- **`site/web/`** — The Hugo site (`hugo-book` theme). `content/`, `static/`, `public/`, and
  `resources/` are generated and gitignored; only `hugo.toml` and the theme submodule are
  tracked.

## Terms

- **Firestartr** — Internal developer platform that maps an organization's domains, systems,
  components, teams, features, and supporting infrastructure, and acts on instructions coming
  from GitHub, Backstage, and the Skill.
- **Promotion** — Copying `site/raw/` material into the published Hugo hierarchy during the
  docs deploy workflow. A promotion must not replace destination-owned homepage content.
- **Deploying resources** — Top-level published area for the deployment guides: the
  `.firestartr` repository, State Apps Repository, State Sys Services Repository, Validating
  Our Claims, and Migrating to the New App State Repository Structure.
- **Providers** — Top-level published area for provider documentation, including the nested
  Terraform provider pages.
- **Features** — Top-level published area for the feature documentation sourced from
  `site/raw/features/`, including each feature's nested pages.
- **Firestartr Portal** — Top-level published area for the Backstage-owned portal guide,
  sourced from `site/raw/core/docs/backstage/` when that optional promotion is present.
  The audience-facing label is Firestartr Portal; the folder and URL namespace remain
  `backstage` (`/docs/backstage/`).

## Not to be confused

- The repository-root `README.md` is a repository readme, unrelated to the website homepage.
