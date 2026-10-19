# Third-party notices

This repository is licensed under the [MIT License](LICENSE). It bundles or loads the following third-party software. Each component keeps its own license; the notices below list what is used, how it is delivered, and where the license text lives.

## Bundled in this repository

| Component | Version | License | Location | Used for |
|---|---|---|---|---|
| [@mlightcad/libredwg-web](https://github.com/mlightcad/libredwg-web) (LibreDWG compiled to WebAssembly) | 0.7.11 | [GPL-3.0](js/vendor/libredwg-web/LICENSE) | `js/vendor/libredwg-web/` | Parsing DWG files in the browser |

LibreDWG itself is a GNU project licensed under the GPL-3.0-or-later. The vendored folder contains a [README](js/vendor/libredwg-web/README.md) with the exact source URLs and checksums of the copied files. Because the GPL applies to this component, redistributions of the app must keep that license text and its notices alongside the WebAssembly build.

## Loaded from content delivery networks at runtime

These libraries are not stored in the repository. The browser fetches them on first use of the feature named below.

| Component | Version | License | Loaded from | Used for |
|---|---|---|---|---|
| [jsPDF](https://github.com/parallax/jsPDF) | 2.5.2 | MIT | cdn.jsdelivr.net | PDF report (main app) |
| [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) | 3.8.4 | MIT | cdn.jsdelivr.net | Tables in the PDF report (main app) |
| [SheetJS Community Edition](https://sheetjs.com/) | 0.20.3 | Apache-2.0 | cdn.sheetjs.com | Excel report (main app) |
| [Lucide](https://lucide.dev/) | 0.562.0 | ISC | unpkg.com | Icons (`prototype1/` mockup) |
| [MapLibre GL JS](https://maplibre.org/) | 4.7.1 | BSD-3-Clause | unpkg.com | Map view (`prototype1/` mockup) |

## Fonts

The stylesheets reference "IBM Plex Sans" (SIL Open Font License 1.1) by name only, as plan-extract does. No font files are bundled and the app loads none; browsers use it when it is installed and otherwise fall back to the system font stack declared in `css/tokens.css`.

The explainer film ([media/how-it-works.html](media/how-it-works.html)) loads IBM Plex Sans from Google Fonts while it is rendered by [media/render.py](media/render.py), so the font is part of the rendered videos; the app itself does not contact Google Fonts.

## Standards and guidelines referenced

The validation rules implement requirements of the CAD-Richtlinie BBL V1.0 and refer to the area definitions of SIA 416 and DIN 277. Those documents are not part of this repository.
