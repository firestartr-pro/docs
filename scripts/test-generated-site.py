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
import os
import re
import shutil
import subprocess
import sys
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


def book_menu(index: str) -> str:
    match = re.search(r"<aside[^>]*book-menu[^>]*>(.*?)</aside>", index, re.S)
    return match.group(1) if match else ""


def check_navigation(index: str) -> None:
    print("Navigation (site/web/public book menu)")
    menu = book_menu(index)
    check(bool(menu), "book menu is rendered")

    segments = set(re.findall(r'href=/docs/([^/>"]+)', menu))
    check(
        segments == TOP_LEVEL_SECTIONS,
        "top-level destinations are exactly Deploying resources, Providers, and Features",
    )
    if segments != TOP_LEVEL_SECTIONS:
        print(f"      found: {sorted(segments)}")

    for href, label in (
        ("/docs/deploying-resources/", "Deploying resources"),
        ("/docs/providers/", "Providers"),
        ("/docs/features/", "Features"),
    ):
        check(f"href={href}>{label}</a>" in menu, f"menu links {label} to {href}")

    for slug in GUIDES:
        check(f"href=/docs/deploying-resources/{slug}/" in menu, f"menu nests {slug} under Deploying resources")


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
