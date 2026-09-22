#!/usr/bin/env python3
"""Generated-site tests for the Firestartr documentation.

This is the highest-level test seam: it runs the same content migration the
deployment workflow uses, builds the complete Hugo site, and asserts on the
published output only (site/web/public).

Usage:
    python3 scripts/test-generated-site.py             # migrate, build, assert
    python3 scripts/test-generated-site.py --no-build  # assert an existing build

Set HUGO_BIN to point at a specific Hugo binary (default: hugo on PATH).
"""
from __future__ import annotations

import argparse
import base64
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "site" / "web"
PUBLIC_DIR = WEB_DIR / "public"
HUGO = os.environ.get("HUGO_BIN", "hugo")

HOMEPAGE = PUBLIC_DIR / "index.html"
WEB_CONTENT = WEB_DIR / "content"

# slug -> published file name (path-to-lower is disabled, so case is preserved)
GUIDES = {
    "The-dot-firestartr-repository": "the .firestartr repository guide",
    "state-apps-repository": "the State Apps Repository guide",
    "state-sys-services-repository": "the State Sys Services Repository guide",
    "Validating-our-claims": "the Validating Our Claims guide",
    "Migrating-to-our-new-app-state-repo-structure": "the migration guide",
}
TOP_LEVEL_SECTIONS = {"deploying-resources", "providers", "features"}
BACKSTAGE_SOURCE = ROOT / "site" / "raw" / "core" / "docs" / "backstage"
PORTAL_FIXTURE_IMAGE = ROOT / "site" / "raw" / "images" / "backstage-test-fixture.png"

failures: list[str] = []
checks = 0


def check(condition: bool, description: str) -> None:
    global checks
    checks += 1
    print(f"  {'ok' if condition else 'FAIL'}: {description}")
    if not condition:
        failures.append(description)


def read(path: Path) -> str:
    return Path(path).read_text(errors="replace")


def build_site() -> None:
    print("==> Migrating content: scripts/migrate-content.sh")
    subprocess.run(["bash", str(ROOT / "scripts" / "migrate-content.sh")], cwd=ROOT, check=True)
    print(f"==> Building site: {HUGO} --minify (site/web)")
    if PUBLIC_DIR.exists():
        # Stale pages from an earlier layout must not mask regressions locally.
        shutil.rmtree(PUBLIC_DIR)
    subprocess.run([HUGO, "--minify", "--quiet"], cwd=WEB_DIR, check=True)


def iter_pages():
    return sorted(PUBLIC_DIR.rglob("*.html"))


def page_url(page: Path) -> str:
    rel = page.parent.relative_to(PUBLIC_DIR).as_posix()
    return "/" if rel == "." else f"/{rel}/"


def resolve_target(raw_reference: str, page: Path):
    """Map an internal reference to a generated file, or None if it does not exist."""
    url = urllib.parse.urljoin(page_url(page), raw_reference)
    path = url.split("#", 1)[0].split("?", 1)[0]
    rel = path.lstrip("/")
    if rel.startswith("docs/"):
        rel = rel[len("docs/"):]
    if rel == "" or rel.endswith("/"):
        rel = f"{rel}index.html"
    candidate = PUBLIC_DIR / rel
    if candidate.is_file():
        return candidate
    index = PUBLIC_DIR / rel / "index.html"
    return index if index.is_file() else None


def check_homepage() -> None:
    print("Homepage (site/web/public/index.html)")
    index = read(HOMEPAGE)
    lowered = index.lower()

    for phrase in (
        "internal developer platform",
        "domain",
        "system",
        "component",
        "ownership",
        "feature",
        "supporting infrastructure",
        "GitHub",
        "Backstage",
        "Skill",
        "fs-forge",
        "agent",
    ):
        check(phrase.lower() in lowered, f"newcomer narrative mentions {phrase!r}")

    image = re.search(r"<img[^>]*firestartr-control-surfaces\.png[^>]*>", index)
    check(image is not None, "primary control-surfaces image is rendered")
    if image is not None:
        tag = image.group(0)
        check(
            'alt=' in tag and all(word in tag for word in ("GitHub", "Backstage", "Skill", "Firestartr")),
            "primary image alt text names GitHub, Backstage, Skill, and Firestartr",
        )

    check("Firestartr Public Documentation" not in index, "homepage is not the promoted core README index")
    check("Our Features" not in index, "homepage does not contain the old technical index entry")
    for forbidden in ("Qué vamos", "vamos a crear", "team-frontenders", "news-letter"):
        check(forbidden.lower() not in lowered, f"homepage does not contain demo content {forbidden!r}")


def element_with_class(html: str, tag: str, class_name: str) -> str:
    match = re.search(
        rf'<{tag}[^>]*class=(?:"[^"]*\b{re.escape(class_name)}\b[^"]*"|[^ >]*\b{re.escape(class_name)}\b[^ >]*)[^>]*>(.*?)</{tag}>',
        html,
        re.S,
    )
    return match.group(1) if match else ""


def opening_tag_with_class(html: str, tag: str, class_name: str) -> str:
    match = re.search(
        rf'<{tag}[^>]*class=(?:"[^"]*\b{re.escape(class_name)}\b[^"]*"|[^ >]*\b{re.escape(class_name)}\b[^ >]*)[^>]*>',
        html,
    )
    return match.group(0) if match else ""


def split_sidebar_trees(sidebar: str) -> tuple[str, str]:
    """Split a sidebar into its mobile-drawer and desktop-tree regions.

    The hamburger drawer and the desktop tree sit side by side and both hold
    nested lists, so the desktop tree's unique class is the only reliable
    boundary for link assertions.
    """
    mobile_start = sidebar.find("<ul")
    desktop_marker = sidebar.find("hx:max-md:hidden")
    if mobile_start < 0 or desktop_marker < 0:
        return "", ""
    desktop_start = sidebar.rfind("<ul", 0, desktop_marker)
    return sidebar[mobile_start:desktop_start], sidebar[desktop_start:]


def has_labeled_link(html: str, href: str, label: str) -> bool:
    for match in re.finditer(r"<a\b([^>]*)>(.*?)</a>", html, re.S):
        attributes, body = match.groups()
        target = re.search(r'href=(?:"([^"]*)"|\'([^\']*)\'|([^ >]*))', attributes)
        if target and next(value for value in target.groups() if value is not None) == href:
            text = re.sub(r"<[^>]+>", "", body).strip()
            if text == label:
                return True
    return False


def check_navigation(index: str) -> None:
    print("Navigation (Hextra navbar and section sidebar)")
    navbar = element_with_class(index, "nav", "hextra-max-navbar-width")
    check(bool(navbar), "Hextra navbar is rendered")

    expected = set(TOP_LEVEL_SECTIONS)
    expected_labels = ["Deploying resources", "Providers", "Features"]
    if BACKSTAGE_SOURCE.is_dir():
        expected.add("backstage")
        expected_labels.append("Firestartr Portal")
    segments = set(re.findall(r'href=(?:"|\')?/docs/([^/>"\']+)/', navbar))
    check(
        segments == expected,
        "top-level destinations are exactly " + ", ".join(expected_labels),
    )
    if segments != expected:
        print(f"      found: {sorted(segments)}")

    destinations = [
        ("/docs/deploying-resources/", "Deploying resources"),
        ("/docs/providers/", "Providers"),
        ("/docs/features/", "Features"),
    ]
    if BACKSTAGE_SOURCE.is_dir():
        destinations.append(("/docs/backstage/", "Firestartr Portal"))
    for href, label in destinations:
        check(has_labeled_link(navbar, href, label), f"navbar links {label} to {href}")

    check("/docs/images/logo.png" in navbar, "navbar renders the Firestartr logo")
    check("Firestartr Documentation" in navbar, "navbar renders the Firestartr title")
    check("hextra-search-wrapper" in navbar, "navbar renders FlexSearch")
    check("hextra-theme-toggle" in navbar, "navbar renders the theme toggle")

    section_sidebars = {}
    for section in expected:
        section_page = read(PUBLIC_DIR / section / "index.html")
        sidebar = element_with_class(section_page, "aside", "hextra-sidebar-container")
        section_sidebars[section] = sidebar
        check(bool(sidebar), f"{section} sidebar is rendered")
        mobile_tree, desktop_tree = split_sidebar_trees(sidebar)
        check(
            f"/docs/{section}/" in desktop_tree,
            f"{section} sidebar contains its own area tree",
        )
        for other_section in expected - {section}:
            check(
                f"/docs/{other_section}/" not in desktop_tree,
                f"{section} sidebar excludes {other_section}",
            )
        # The navbar hides its links on narrow screens, so the hamburger
        # drawer is the only cross-area navigation there.
        for other_section in expected:
            check(
                f"/docs/{other_section}/" in mobile_tree,
                f"{section} mobile drawer links to {other_section}",
            )

    for slug in GUIDES:
        href = f"/docs/deploying-resources/{slug}/"
        check(
            href in section_sidebars["deploying-resources"],
            f"sidebar nests {slug} under Deploying resources",
        )


def check_page_headings() -> None:
    print("Page headings (a single H1 per page)")
    pages = [
        "index.html",
        "deploying-resources/index.html",
        "providers/index.html",
        "features/index.html",
        "deploying-resources/state-apps-repository/index.html",
        "providers/terraform/workspace-sync/index.html",
        "features/charts_repo/index.html",
        "features/charts_repo/CHANGELOG/index.html",
    ]
    if BACKSTAGE_SOURCE.is_dir():
        pages.append("backstage/index.html")
    for page in pages:
        h1_count = len(re.findall(r"<h1[ >]", read(PUBLIC_DIR / page)))
        check(h1_count == 1, f"{page} renders exactly one H1")


def check_theme_chrome(index: str) -> None:
    print("Hextra page chrome")
    homepage_sidebar = element_with_class(index, "aside", "hextra-sidebar-container")
    homepage_sidebar_tag = opening_tag_with_class(index, "aside", "hextra-sidebar-container")
    check(
        "hx:md:hidden" in homepage_sidebar_tag
        and "hx:xl:block" not in homepage_sidebar_tag
        and "hx:md:sticky" not in homepage_sidebar_tag
        and "hx:max-md:hidden" not in homepage_sidebar,
        "homepage has no desktop documentation sidebar chrome",
    )
    # Hextra's theme-toggle markup hard-codes data-theme="light"; the
    # configured default only appears as the fallback in the head theme script.
    head_scripts = sorted((PUBLIC_DIR / "js").glob("main-head*.js"))
    head_script = read(head_scripts[0]) if head_scripts else ""
    check(
        bool(head_scripts)
        and re.search(r'''getItem\("color-theme"\)\s*:\s*['"]light['"]''', head_script) is not None,
        "first-paint theme script falls back to light",
    )
    # The test build runs `hugo --minify`, which strips attribute quotes.
    check(
        "href=/docs/favicon.png" in index,
        "favicon is the Firestartr logo at /docs/favicon.png",
    )
    check("href=/docs/favicon.svg" not in index, "Hextra default favicon.svg is not used")

    docs_page = read(PUBLIC_DIR / "deploying-resources" / "index.html")
    check("hextra-toc" in docs_page, "documentation pages render a table of contents")
    check("Edit this page" not in docs_page, "documentation pages omit edit links")
    check("Last updated on" not in docs_page, "documentation pages omit last-modified dates")

    mermaid_page = read(PUBLIC_DIR / "features" / "release_please" / "index.html")
    check('<pre class="mermaid ' in mermaid_page, "Mermaid diagrams are enabled")


PORTAL_FIXTURE_PAGES = {
    "resources-provisioning": "Fixture marker: provisioning guide",
    "resource-edition": "Fixture marker: nested section home",
    "features-control": "Fixture marker: features control guide",
    "batch-actions": "Fixture marker: batch actions guide",
}
PORTAL_FIXTURE_IMAGE_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


def create_portal_fixture() -> None:
    """Write a temporary Backstage-owned promotion under site/raw/core/docs/backstage."""
    (BACKSTAGE_SOURCE / "resource-edition").mkdir(parents=True)
    (BACKSTAGE_SOURCE / "README.md").write_text(
        "# Firestartr Portal\n\nFixture marker: portal section home.\n"
    )
    (BACKSTAGE_SOURCE / "resources-provisioning.md").write_text(
        "# Resources provisioning\n\nFixture marker: provisioning guide.\n\n"
        "![Portal fixture image](./images/backstage-test-fixture.png)\n"
    )
    (BACKSTAGE_SOURCE / "features-control.md").write_text(
        "# Features control\n\nFixture marker: features control guide.\n"
    )
    (BACKSTAGE_SOURCE / "batch-actions.md").write_text(
        "# Batch actions\n\nFixture marker: batch actions guide.\n"
    )
    (BACKSTAGE_SOURCE / "resource-edition" / "README.md").write_text(
        "# Resource edition\n\nFixture marker: nested section home.\n"
    )
    PORTAL_FIXTURE_IMAGE.write_bytes(PORTAL_FIXTURE_IMAGE_BYTES)


def remove_portal_fixture() -> None:
    shutil.rmtree(BACKSTAGE_SOURCE, ignore_errors=True)
    PORTAL_FIXTURE_IMAGE.unlink(missing_ok=True)


def check_portal_fixture() -> None:
    """Exercise both the present and absent states of the optional portal promotion."""
    print("Firestartr Portal (temporary Backstage promotion fixture)")
    if PORTAL_FIXTURE_IMAGE.exists():
        raise RuntimeError(f"fixture path already exists: {PORTAL_FIXTURE_IMAGE}")

    with tempfile.TemporaryDirectory(prefix="firestartr-portal-source-") as temp_dir:
        backup = Path(temp_dir) / "backstage"
        had_promotion = BACKSTAGE_SOURCE.is_dir()
        if had_promotion:
            shutil.copytree(BACKSTAGE_SOURCE, backup)
            shutil.rmtree(BACKSTAGE_SOURCE)

        try:
            create_portal_fixture()
            build_site()

            check((PUBLIC_DIR / "backstage" / "index.html").is_file(), "/backstage/ section home is published")
            home = read(PUBLIC_DIR / "backstage" / "index.html")
            check("Fixture marker: portal section home" in home, "/backstage/ renders the section README")

            for route, marker in PORTAL_FIXTURE_PAGES.items():
                page = PUBLIC_DIR / "backstage" / route / "index.html"
                check(page.is_file(), f"/backstage/{route}/ is published")
                if page.is_file():
                    check(marker in read(page), f"/backstage/{route}/ renders its source page")

            check(
                not (PUBLIC_DIR / "deploying-resources" / "backstage").exists(),
                "Firestartr Portal is not nested under Deploying resources",
            )

            index = read(HOMEPAGE)
            check_navigation(index)
            navbar = element_with_class(index, "nav", "hextra-max-navbar-width")
            check(
                not has_labeled_link(navbar, "/docs/backstage/", "Backstage"),
                "navbar does not label the section 'Backstage'",
            )

            provisioning = read(PUBLIC_DIR / "backstage" / "resources-provisioning" / "index.html")
            match = re.search(
                r'src=("([^"]*backstage-test-fixture[^"]*)"|([^ >]*backstage-test-fixture[^ >]*))',
                provisioning,
            )
            image_src = (match.group(2) or match.group(3)) if match else ""
            check(
                image_src == "/docs/images/backstage-test-fixture.png",
                "portal image resolves under /docs/images/backstage-*",
            )
            if image_src != "/docs/images/backstage-test-fixture.png":
                print(f"      found image src: {image_src!r}")
            check(
                (PUBLIC_DIR / "images" / "backstage-test-fixture.png").is_file(),
                "portal image is published",
            )

            remove_portal_fixture()
            build_site()
            check(not (PUBLIC_DIR / "backstage").exists(), "/backstage/ is absent without a portal promotion")
            check_navigation(read(HOMEPAGE))
        finally:
            remove_portal_fixture()
            if had_promotion:
                shutil.copytree(backup, BACKSTAGE_SOURCE)


def check_guides() -> None:
    print("Deploying resources section")
    for slug, label in GUIDES.items():
        check((PUBLIC_DIR / "deploying-resources" / slug / "index.html").is_file(), f"{label} is published")
        check(not (PUBLIC_DIR / slug).exists(), f"{label} is not a root-level entry")
    check((PUBLIC_DIR / "deploying-resources" / "index.html").is_file(), "section index is published")

    index = read(PUBLIC_DIR / "deploying-resources" / "index.html")
    check("href=/docs/features/" in index, "section index links Features as a sibling section")
    check("href=/docs/providers/" in index, "section index links Providers as a sibling section")

    dot = read(PUBLIC_DIR / "deploying-resources" / "The-dot-firestartr-repository" / "index.html")
    check(
        "Validating-our-claims/#-about-the-applyto-field-values" in dot,
        "applyTo cross-reference points at the Validating guide anchor",
    )
    validating = read(PUBLIC_DIR / "deploying-resources" / "Validating-our-claims" / "index.html")
    check(
        'id="-about-the-applyto-field-values"' in validating or "id=-about-the-applyto-field-values" in validating,
        "Validating guide exposes the applyTo anchor",
    )


def check_providers_and_features() -> None:
    print("Providers and Features sections")
    for page in (
        "providers/index.html",
        "providers/terraform/index.html",
        "providers/terraform/workspace-sync/index.html",
    ):
        check((PUBLIC_DIR / page).is_file(), f"{page} is reachable")
    check(
        not (PUBLIC_DIR / "deploying-resources" / "providers").exists(),
        "Providers stays independent from Deploying resources",
    )

    for page in (
        "features/index.html",
        "features/claims_repo/index.html",
        "features/state_repo_apps/KUBERNETES_README/index.html",
    ):
        check((PUBLIC_DIR / page).is_file(), f"{page} is reachable")


def check_internal_links() -> None:
    print("Internal links and anchors")
    link_cache: dict[Path, str] = {}
    missing_targets: dict[str, str] = {}
    missing_fragments: dict[str, str] = {}

    def target_html(path: Path) -> str:
        if path not in link_cache:
            link_cache[path] = read(path)
        return link_cache[path]

    def fragment_exists(target: Path, fragment: str) -> bool:
        html = target_html(target)
        return f'id="{fragment}"' in html or f"id={fragment}" in html

    for page in iter_pages():
        html = read(page)
        rel = page.parent.relative_to(PUBLIC_DIR).as_posix()
        in_scope = page == HOMEPAGE or rel.startswith("deploying-resources")
        for match in re.finditer(r'(?:href|src)=("([^"]*)"|([^ >]*))', html):
            raw = (match.group(2) or match.group(3) or "").strip()
            if not raw or raw.startswith(("http://", "https://", "mailto:", "data:", "javascript:")):
                continue
            if raw.startswith("#"):
                if in_scope and raw[1:] and not fragment_exists(page, raw[1:]):
                    missing_fragments.setdefault(raw, str(page.relative_to(PUBLIC_DIR)))
                continue
            target = resolve_target(raw, page)
            if target is None:
                missing_targets.setdefault(raw, str(page.relative_to(PUBLIC_DIR)))
                continue
            fragment = raw.partition("#")[2]
            if fragment and in_scope and not fragment_exists(target, fragment):
                missing_fragments.setdefault(raw, str(page.relative_to(PUBLIC_DIR)))

    check(not missing_targets, f"every internal link target resolves ({len(missing_targets)} missing)")
    for raw, page in list(missing_targets.items())[:10]:
        print(f"      missing target: {page} -> {raw}")
    check(
        not missing_fragments,
        f"anchors on the homepage and Deploying resources resolve ({len(missing_fragments)} missing)",
    )
    for raw, page in list(missing_fragments.items())[:10]:
        print(f"      missing anchor: {page} -> {raw}")


def check_promotion_cannot_own_homepage() -> None:
    """The destination-owned homepage must win over a promotion-style copy."""
    print("Promotion safety")
    check(
        (ROOT / "site" / "homepage" / "_index.md").is_file(),
        "homepage source lives outside site/raw (site/homepage/_index.md)",
    )
    published = read(HOMEPAGE)
    check(
        "internal developer platform" in published.lower(),
        "published root page is the destination-owned homepage, not a promoted README",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--no-build",
        action="store_true",
        help="assert the existing site/web/public instead of migrating and rebuilding",
    )
    args = parser.parse_args()

    if not args.no_build:
        try:
            # The portal promotion is optional in git. Exercise it with a
            # temporary fixture, then rebuild the committed state below.
            check_portal_fixture()
            build_site()
        except subprocess.CalledProcessError as error:
            print(f"build failed: {error}", file=sys.stderr)
            return 2

    if not HOMEPAGE.is_file():
        print("FAIL: no generated site at site/web/public", file=sys.stderr)
        return 2

    index = read(HOMEPAGE)
    check_homepage()
    check_navigation(index)
    check_page_headings()
    check_theme_chrome(index)
    check_guides()
    check_providers_and_features()
    check_internal_links()
    check_promotion_cannot_own_homepage()

    print()
    if failures:
        print(f"{len(failures)} of {checks} checks failed")
        return 1
    print(f"All {checks} checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
