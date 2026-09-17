#!/usr/bin/env bash
#
# Migrate documentation into the Hugo content tree.
#
# Sources:
#   - site/homepage/     destination-owned homepage and its image assets
#   - site/raw/core/docs/       promoted core documentation
#   - site/raw/features/        promoted feature documentation
#   - site/raw/images/          promoted images
#   - logos/logo.png            site favicon
#
# Published layout:
#   /                       homepage (never overwritten by a promotion)
#   /deploying-resources/   core deployment guides
#   /providers/             provider documentation (incl. nested pages)
#   /features/              feature documentation (incl. nested pages)
#   /backstage/             Firestartr Portal guide (when promoted)
#
# This is the single migration path used by CI
# (.github/workflows/deploy-docs.yml), local contributors (CONTRIBUTING.md),
# and the generated-site test.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

WEB_CONTENT_DIR="site/web/content"
WEB_ASSETS_DIR="site/web/assets"
WEB_STATIC_DIR="site/web/static"
HOMEPAGE_DIR="site/homepage"
RAW_DIR="site/raw"
CORE_DOCS_DIR="${RAW_DIR}/core/docs"
DEPLOYING_RESOURCES_DIR="${WEB_CONTENT_DIR}/deploying-resources"
PROVIDERS_DIR="${WEB_CONTENT_DIR}/providers"
FEATURES_DIR="${WEB_CONTENT_DIR}/features"
BACKSTAGE_DIR="${WEB_CONTENT_DIR}/backstage"

# GNU sed and BSD/macOS sed disagree about in-place editing flags.
if sed --version >/dev/null 2>&1; then
  sed_inplace() { sed -i "$@"; }
else
  sed_inplace() { sed -i '' "$@"; }
fi

# write_page <source> <destination> [front matter lines...]
write_page() {
  local source="$1" destination="$2"
  shift 2
  mkdir -p "$(dirname "${destination}")"
  {
    echo '+++'
    local line
    for line in "$@"; do
      echo "${line}"
    done
    echo '+++'
    echo ''
    cat "${source}"
  } > "${destination}"
}

if [ ! -f "${HOMEPAGE_DIR}/_index.md" ]; then
  echo "ERROR: missing destination-owned homepage at ${HOMEPAGE_DIR}/_index.md" >&2
  exit 1
fi

echo "==> Cleaning generated content"
rm -rf "${WEB_CONTENT_DIR}" "${WEB_STATIC_DIR}" "${WEB_ASSETS_DIR}/images"
mkdir -p "${DEPLOYING_RESOURCES_DIR}" "${PROVIDERS_DIR}" "${FEATURES_DIR}" \
  "${WEB_STATIC_DIR}" "${WEB_ASSETS_DIR}/images"

echo "==> Copying destination-owned homepage"
cp "${HOMEPAGE_DIR}/_index.md" "${WEB_CONTENT_DIR}/_index.md"
echo "    ✓ ${HOMEPAGE_DIR}/_index.md → ${WEB_CONTENT_DIR}/_index.md"

echo "==> Migrating deploying resources"
write_page "${CORE_DOCS_DIR}/README.md" "${DEPLOYING_RESOURCES_DIR}/_index.md" \
  "title = 'Deploying resources'" 'weight = 1' 'bookCollapseSection = true'
echo "    ✓ core/docs/README.md → deploying-resources/_index.md"

# Every core doc except the section README, the providers subtree, and the
# Backstage-owned portal subtree is a deployment guide. Promotions must never
# write to content/_index.md.
while IFS= read -r -d '' file; do
  rel_path="${file#"${CORE_DOCS_DIR}/"}"
  case "${rel_path}" in
    README.md|providers/*|backstage/*) continue ;;
  esac
  write_page "${file}" "${DEPLOYING_RESOURCES_DIR}/${rel_path}" 'weight = 1'
  echo "    ✓ ${rel_path}"
done < <(find "${CORE_DOCS_DIR}" -type f -name '*.md' -print0)

echo "==> Migrating providers"
# The providers README is not the homepage source; it becomes the section index.
while IFS= read -r -d '' file; do
  rel_path="${file#"${CORE_DOCS_DIR}/providers/"}"
  case "${rel_path}" in
    README.md)
      write_page "${file}" "${PROVIDERS_DIR}/_index.md" \
        "title = 'Providers'" 'weight = 2' 'bookCollapseSection = true'
      echo "    ✓ providers/README.md → providers/_index.md"
      ;;
    */README.md)
      write_page "${file}" "${PROVIDERS_DIR}/$(dirname "${rel_path}")/_index.md" \
        'bookCollapseSection = true' 'weight = 1'
      echo "    ✓ providers/${rel_path} → providers/$(dirname "${rel_path}")/_index.md"
      ;;
    *)
      write_page "${file}" "${PROVIDERS_DIR}/${rel_path}" 'weight = 1'
      echo "    ✓ providers/${rel_path}"
      ;;
  esac
done < <(find "${CORE_DOCS_DIR}/providers" -type f -name '*.md' -print0)

echo "==> Migrating features"
write_page "${RAW_DIR}/features/README.md" "${FEATURES_DIR}/_index.md" \
  "title = 'Features'" 'weight = 3' 'bookCollapseSection = true'
echo "    ✓ features/README.md → features/_index.md"

while IFS= read -r -d '' feature_dir; do
  feature_name="$(basename "${feature_dir}")"
  mkdir -p "${FEATURES_DIR}/${feature_name}"
  while IFS= read -r -d '' file; do
    filename="$(basename "${file}")"
    case "${filename}" in
      README.md)
        write_page "${file}" "${FEATURES_DIR}/${feature_name}/_index.md" \
          'bookCollapseSection = true' 'weight = 1'
        echo "    ✓ features/${feature_name}/README.md"
        ;;
      CHANGELOG.md)
        cp "${file}" "${FEATURES_DIR}/${feature_name}/${filename}"
        echo "    ✓ features/${feature_name}/${filename}"
        ;;
      *)
        write_page "${file}" "${FEATURES_DIR}/${feature_name}/${filename}" 'weight = 1'
        echo "    ✓ features/${feature_name}/${filename}"
        ;;
    esac
  done < <(find "${feature_dir}" -maxdepth 1 -type f -name '*.md' -print0)
done < <(find "${RAW_DIR}/features" -mindepth 1 -maxdepth 1 -type d -print0)

echo "==> Migrating Firestartr Portal"
# The Backstage-owned subtree is optional: it exists only after a portal
# promotion. When absent, the section is not published at all.
if [ -d "${CORE_DOCS_DIR}/backstage" ]; then
  mkdir -p "${BACKSTAGE_DIR}"
  while IFS= read -r -d '' file; do
    rel_path="${file#"${CORE_DOCS_DIR}/backstage/"}"
    case "${rel_path}" in
      README.md)
        write_page "${file}" "${BACKSTAGE_DIR}/_index.md" \
          "title = 'Firestartr Portal'" 'weight = 4' 'bookCollapseSection = true'
        echo "    ✓ backstage/README.md → backstage/_index.md"
        ;;
      */README.md)
        write_page "${file}" "${BACKSTAGE_DIR}/$(dirname "${rel_path}")/_index.md" \
          'bookCollapseSection = true' 'weight = 1'
        echo "    ✓ backstage/${rel_path} → backstage/$(dirname "${rel_path}")/_index.md"
        ;;
      *)
        write_page "${file}" "${BACKSTAGE_DIR}/${rel_path}" 'weight = 1'
        echo "    ✓ backstage/${rel_path}"
        ;;
    esac
  done < <(find "${CORE_DOCS_DIR}/backstage" -type f -name '*.md' -print0)
else
  echo "    (skipped: no ${CORE_DOCS_DIR}/backstage/ promotion)"
fi

echo "==> Migrating static assets"
if [ -f "logos/logo.png" ]; then
  cp "logos/logo.png" "${WEB_STATIC_DIR}/favicon.png"
  echo "    ✓ logos/logo.png → static/favicon.png"
fi

# Assets (not static) so the portable image render hook resolves relative
# ./images/... references from the moved pages against site/web/assets/images.
if [ -d "${RAW_DIR}/images" ]; then
  cp -R "${RAW_DIR}/images/." "${WEB_ASSETS_DIR}/images/"
  echo "    ✓ site/raw/images → assets/images"
fi
if [ -d "${HOMEPAGE_DIR}/images" ]; then
  cp -R "${HOMEPAGE_DIR}/images/." "${WEB_ASSETS_DIR}/images/"
  echo "    ✓ site/homepage/images → assets/images"
fi

echo "==> Rewriting links for Hugo"
while IFS= read -r -d '' file; do
  # README.md links resolve to their directory index.
  sed_inplace 's|/README\.md)|/)|g' "${file}"
  sed_inplace 's|(\.*/\?\([^)]*\)/README\.md)|(./\1/)|g' "${file}"

  # GitHub feature repository links resolve to the published feature pages.
  # Root-absolute so they work from any section depth.
  sed_inplace -E \
    -e 's|https://github\.com/prefapp/features/blob/[^/]+/packages/([^/]+)/templates/[^/]*/README\.md(#[^)]+)?\)|/features/\1/\2)|g' \
    -e 's|https://github\.com/prefapp/features/blob/[^/]+/packages/([^/]+)/templates/[^/]*/([^/]+)\.md(#[^)]+)?\)|/features/\1/\2/\3)|g' \
    "${file}"
done < <(find "${WEB_CONTENT_DIR}" -type f -name '*.md' -print0)
echo "    ✓ README and feature links rewritten"

echo "Migration complete."
