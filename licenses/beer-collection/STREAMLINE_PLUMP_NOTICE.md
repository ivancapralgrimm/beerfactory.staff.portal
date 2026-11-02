# Streamline Plump Line Free — third-party notice

Creator: **Streamline / Webalys** — https://www.streamlinehq.com/
Collection: https://www.streamlinehq.com/icons/plump-line-free
License: **Creative Commons Attribution 4.0 International (CC BY 4.0)**
License terms: https://creativecommons.org/licenses/by/4.0/legalcode.en
License summary: https://creativecommons.org/licenses/by/4.0/
Author repository: https://github.com/webalys-hq/streamline-vectors
Pinned commit: 52d750c9ce051e51cb181b7a78932120c48541d0
Author license notice: licenses/beer-collection/AUTHOR_PLUMP_README.md

Only SVGs from the author's **plump/line/** directory are used. The official
free Line collection contains500icons. Solid, Duo/Remix and premium icons
are not used. The raw source SVGs retain their original creator descriptions.

BFStaff uses 25 semantic icon keys from 24 free source SVGs. All icons are
rendered locally, without an external CDN, service or runtime package.
The original SVGs are redistributed in licenses/beer-collection/streamline-plump-line-free/.

## Changes / adaptations

For all rendered icons: black converted to currentColor; source element IDs
removed to prevent duplicate DOM IDs; viewBox48 preserved and icons resized to
existing UI slots. Source descriptions with the creator's link are retained.

The free set has no separate plain plus, close-X, search magnifier, bare
navigation arrows/chevron, or logout icon. The following are **BFStaff adaptations
of free Plump Line SVGs**, not separately supplied official standalone icons:

| BFStaff key | Free source | Adaptation |
| --- | --- | --- |
| close | receipt-cross | Cross path extracted, centered/fitted |
| plus | add-layer-2 | Plus path extracted, centered/fitted |
| search | zoom-in | Magnifier outline retained; zoom markings removed |
| arrow | arrow-right-circle-2 | Arrow path retained; outer circle/end bar removed; centered/fitted |
| back | arrow-right-circle-2 | Same extracted arrow rotated180degrees |
| chevron | arrow-right-circle-1 | Inner chevron retained; outer circle removed; centered/fitted |
| logout | login-1 | Door retained; arrow mirrored horizontally to point out |

Fitted adaptations preserve the nominal3px stroke on the48px design grid by
compensating the local transform's scale. No new icon paths are hand drawn.
Derived SVG files and exact path indices, transforms, source URLs, commit and
SHA hashes are documented in licenses/beer-collection/ICON_MAPPING.json.

Visible attribution in the app footer links to Streamline and CC BY4.0 and states
that SVGs are adapted. No rel=nofollow is applied. This notice is included in the
source/ZIP, and the before/after PDF also contains a credit. No endorsement of
BFStaff by Streamline is implied. CC BY applies to these icon assets; it does not
relicense the entire application.

## License verification scope

Author Plump README explicitly grants sharing and adaptation, including
commercial use, for the free collection under CC BY4.0. The official collection
page also identifies CC BY4.0. The Streamline general Free License help page
mentions a50icon/project limit alongside its open-source redistribution clause;
CC BY itself has no50icon limit. This project uses 24 unique source SVGs and 25
rendered variants, below50 under either straightforward count; no premium
content or full asset library is redistributed.

The root executor received HTTP403 for the help/legalcode HTML; the source
README and collection page were successfully retrieved, and an independent
reviewer separately read the official help page and CC legalcode. Retrieval
failures are not labelled successful license-text downloads. The canonical
license links above remain the legal references.


Beer Collection integration: reuses the exact existing BFStaff helper (25 keys/24 sources); back/arrow/chevron/check are displayed by the map, and the new beer-pitch icon is used for the standalone section and search result. This is not a new icon-family migration of historic main. The page credit links are visible; the direct Sections/Dashboard entry links to that attributed page. Original source SVGs and creator desc nodes remain available in the source bundle.

V3.2 adds `beer`: official `plump/line/food-drink/beer-pitch.svg` at the same pinned commit. Stroke currentColor, author IDs removed, original creator description preserved. Exact source hashes and URL: evidence/BEER_ICON_PROVENANCE.json.

2026-11-01: added original free Line icons share-link.svg and synchronize.svg from the same pinned commit. Stroke colors changed to currentColor; IDs removed; SVG attributes converted for React. Attribution moved from working UI to distributed notices.
