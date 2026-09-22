# Use Hextra for the documentation site

The documentation site uses Hextra as a pinned Hugo Module because its documentation layout, independent section sidebars, responsive navigation, FlexSearch, theme switching, and Mermaid support fit the existing published structure without changing Promotion or public URLs. The module remains upgradeable without vendoring; a Hextra git submodule is only a fallback if the module path stops passing the fetch, build, and generated-site gate.

## Considered Options

- **Keep hugo-book** — rejected because it preserves the dated presentation this change is intended to replace and keeps the site coupled to theme-specific portable-link behavior.
- **Lotus Docs** — rejected because Hextra already provides the required article homepage and documentation-section behavior, so a parallel theme path would add migration and maintenance work without serving the chosen structure.
