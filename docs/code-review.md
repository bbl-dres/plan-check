# Code review and refactoring notes (September 2026)

Scope: the main application (`index.html`, `css/`, `js/`, `locales/`, `docs/`). The `prototype1/` mockup was out of scope.

The review looked at correctness, performance, duplication, maintainability (comments, naming, English-only code, i18n coverage), accessibility and the DWG/CAD domain logic. Every finding below was verified against the code and, for the parser, against the vendored `@mlightcad/libredwg-web` 0.7.11 sources. Everything marked *fixed* is implemented in this change set; the remaining items are listed under [Not implemented](#not-implemented-and-why).

## How the changes were verified

A headless-browser harness (Microsoft Edge driven over the DevTools protocol) loads the demo drawing, exercises every tab and result filter, triggers the PDF and Excel export and records normalised hashes of the room, area and issue data. The same harness ran before and after the refactoring. Results for `assets/test-files/CAD.V01-CAFM-Plan-DE.dwg`:

| Measure | Before | After | Why it changed |
|---|---|---|---|
| Model-space entities | 3504 | 3502 | The two paper-space viewport entities are no longer mixed into the model |
| Render primitives | 3557 | 3518 | Hatch boundary loops are one primitive per hatch; 4 SOLID and 6 POINT entities that previously vanished are now drawn |
| Rooms / floor areas | 30 / 1 | 30 / 1 | unchanged |
| NGF | 517.1 m² | 517.1 m² | unchanged (the two deduction polygons are now subtracted; the difference is below 0.1 m²) |
| Issues | 5 warnings in 3 rules | 3 warnings in 2 rules | `DIM_002` (always fired, see below) was removed; `LAYOUT_001` no longer fires for the empty default layout |
| Score | 37/40 (93 %) | 38/40 (95 %) | follows from the issues |
| DWG version in the reports | "-" | AC1032 (AutoCAD Release 2018) | the parser exposes it, the old code read a field that never existed |

Room and area geometry hashes are identical before and after. PDF and Excel export, all six tabs, the three result filters, the language switch, the API reference view and the mobile menu were exercised without console errors.

## Findings and what was done

### Parser (`js/dwg-processing.js`)

The converter output of libredwg-web was never checked against the field names the code read, and chained `||` fallbacks hid every mismatch. Fixed:

- POINT (`position`), SOLID/TRACE/3DFACE (`corner1..4`, bow-tie order), RAY/XLINE (`firstPoint`/`unitDirection`) and MLINE (`vertex`) never rendered.
- `isVisible === 1` was never true (the field is a boolean), so invisible entities were drawn and validated.
- LWPOLYLINE used bit 1 as "closed"; in libredwg bit 1 means "extrusion present" and bit 512 is "closed". Open polylines with an extrusion vector became rooms.
- `db.entities` contains model and paper space; only the model-space block record is used now. Paper-space content is counted separately for `LAYOUT_001`, ignoring the default viewport every layout owns.
- STYLE font names (`font`/`bigFont`), LAYOUT names (`objects.LAYOUT[].layoutName`), hatch solid fill (`solidFill`), MTEXT rotation (`direction` vector) and attachment point were read from non-existent fields, which made `TEXT_002` and `LAYOUT_001` dead and rotated multi-line MTEXT wrong.
- DIMENSION associativity was derived from a field that holds the dimension type, so every dimension was reported as non-associative. The parser cannot expose associativity; rule `DIM_002` was removed and the rule documentation updated.
- Nested block references composed scale and rotation as scalars, which is wrong for non-uniform scale; block transforms are now 2×3 affine matrices. Arcs and circles under non-uniform scale are sampled to polylines; mirrored arcs swap direction correctly. OCS extrusion (normal 0,0,−1) is handled for every entity type, not only INSERT.
- Colours: true colour (`color`) wins over the index, ByBlock (index 0) takes the reference's colour, layer "0" content inside blocks inherits the reference's layer. The ACI palette is generated for all 256 indices instead of 55 hard-coded entries.
- TEXT justification (`halign`/`valign`) and MTEXT attachment now drive canvas alignment; `%%d`, `%%c`, `%%p` and `\U+XXXX` codes are decoded; DWG text height is treated as cap height (canvas font size ×1.4).
- MINSERT arrays, constant ATTDEFs, SPLINE evaluation (de Boor), elliptic arcs, block recursion guard, WASM heap release on conversion failure, and de-duplicated Z/dimension bookkeeping.
- DXF: the WebAssembly build contains no DXF reader (`dxf_read_file` is absent), so `.dxf` was accepted but always failed. The upload now accepts `.dwg` only; README and user guide were adjusted.

### Validation (`js/validation.js`, `js/rules.js`)

- Sort comparators used `||` with rank 0, so "errors first" sorting never worked in the errors, rooms and areas lists. Fixed with `??`.
- `AOID_006` used a message key that does not exist (`msg.aoidBaseOutside`) and could only fire on duplicate text content. Texts are now assigned by insertion point first and by text centre second; the second case is what `AOID_006` reports.
- `GEOM_001` could never fire because a phantom `ABORT_002` aborted the run first, contradicting the rule documentation ("no abort criteria"). The abort path is gone; non-millimetre drawings are scaled with `$INSUNITS` and reported by `GEOM_001`.
- `HATCH_001` was dead (the parser only emitted solid hatches). Hatches are now one primitive with a `solid` flag.
- Room and floor polygons are extracted from LWPOLYLINE/POLYLINE2D only; hatch boundary loops, 3DFACE and splines no longer become rooms.
- `TEXT_001` no longer flags dimension text and block content.
- Frame detection (`LAYOUT_002`, `GEOM_005`) falls back to the extent of the `V_PLANLAYOUT` layer, and `GEOM_005` tests entity bounds instead of one reference point.
- `GEOM_003` counts forbidden entity types from the entity summary, so OLE frames (which are never rendered) are detected.
- Nested rooms: a text is assigned to the smallest containing polygon. Points within 0.5 mm of an edge count as inside.
- `R_RAUMPOLYGON-ABZUG` deduction polygons reduce the area of the room they lie in. Duplicate room polygons (orientation- and start-independent hash) count once towards NGF and are excluded from `AOID_002`.
- Layer names that differ only in case get a dedicated hint instead of "missing" plus "unknown".
- Polygon issues (`POLY_*`, `GPOLY_*`) now set the status of the room or area they belong to.
- `POLY_008` (no room polygon found) mirrors `GPOLY_004`. The catalogue stays at 40 rules.
- Severity and category live in one table (`rules.js`); `createIssue()` looks them up, so they cannot drift from the call sites.
- Language switch re-renders the open tab instead of jumping back to the rules tab; tab and filter changes clear the selection and popup.

### Viewer (`js/renderer.js`, `js/camera.js`, `js/selection.js`, `js/app.js`)

- Arc hit test accepted the whole circle for arcs crossing 0°; fixed with a sweep test.
- Pinch zoom read the world point after changing the zoom and therefore zoomed about the view centre; it now anchors the pinch midpoint. Wheel events with `deltaY === 0` (horizontal trackpad scroll) no longer zoom in.
- Every pointer is captured and ghost pointers are cleared on cancel, so a lifted second finger cannot freeze panning. Right-click no longer starts a pan.
- The report capture ran with the viewer hidden on the KPI tab (0×0 canvas, zoom 0); it now shows the split temporarily, clears hidden rooms and highlights, and downscales images to 1600 px.
- Concurrent uploads: a load token makes a superseded upload abandon its work; the WebAssembly module is loaded through one shared promise; the file input is cleared so the same file can be re-selected.
- Per-file state is reset in one place (`resetFileState()`), including the metrics card, camera and filter.
- Performance: render items carry bounds and are culled against the view; layout reads (`getBoundingClientRect`) left the render loop and the pointer handlers; colours are cached per frame; `ResizeObserver` replaces the window resize and fullscreen timers; large highlight sets skip the glow shadow; `esc()` no longer allocates DOM nodes.
- Interior hits score just below the tolerance so an outline within tolerance wins over an enclosing polygon.

### Reports (`js/export.js`, `js/report-model.js`, `js/kpi.js`)

- KPI rows, DIN 277 sums, rule split, layer status, links and formatting were computed three times (UI, PDF, Excel) with slightly different semantics; they now come from one report model.
- PDF colours claimed to mirror the design tokens but were stale; they are read from `tokens.css` at runtime. Tables that overflow a page repeat the running header; long file names are ellipsised; the "(...)" continuation title is gone.
- Script loading is memoised per URL and a second click during generation is ignored; export failures show in the status bar, not only in the collapsed console.
- Unused GeoJSON and BCF exports (no caller, ~130 lines) were removed together with their locale keys.

### Markup, styles, locales, docs

- Collapsible panel headers, tabs and the demo link are real buttons with `aria-expanded`/`aria-selected`/`aria-pressed`; the status bar and console have live regions; icon buttons have accessible names; the focus order matches the visual order; SVG icons are hidden from assistive technology.
- `styles.css`: dead rules (`.footer__sep`, `.rules-row__count`, `.val-metrics`, `.kpi-sep`), duplicated blocks and no-op responsive overrides removed; list rows share one group; the banner got a mobile rule; tokens are used where literals bypassed them. 1126 → 959 lines. `tokens.css` lost 13 unused tokens and its changelog comments.
- Locales: a broken key, 26 dead keys and the hard-coded rule count were removed; new keys for the new behaviour were added in all four languages; English strings that were still German (organisation name, `BYLAYER`) and inconsistent German terms (Prüfregel, Bemassung, Quellcode, Statusfilter) were aligned. All four files carry the same 346 keys.
- Console log lines that bypassed i18n are translated. Comments were rewritten to describe intent, stale "Enhancement N" markers and merge-history notes were dropped, and German identifiers (`kzRow`, `mkErr`) were renamed.
- `docs/pruefregeln-de.md`: `POLY_008` added, `DIM_002` removed, the stale feasibility analysis removed. `THIRD_PARTY.md` lists every bundled and CDN-loaded component with its license.

### Module layout after the refactoring

| Module | Responsibility |
|---|---|
| `state.js` | constants, mutable state, `resetFileState()`, DOM references |
| `geometry.js` | pure geometry: areas with bulges, point-in-polygon, bounds, affine transforms, arc and spline sampling, label placement |
| `dwg-processing.js` | LibreDWG loading, parsing, entity → render primitive conversion |
| `camera.js` | world/screen mapping, zoom operations, cached view size |
| `renderer.js` | drawing, overlays, hit testing, feature popup |
| `selection.js` | one path for selecting polygons, items and issue highlights |
| `rules.js` | rule catalogue, `createIssue()`, score and outcome helpers |
| `validation.js` | extraction, rules, the six tabs |
| `kpi.js`, `report-model.js` | SIA 416 / DIN 277 figures and the rows shared by UI, PDF and Excel |
| `export.js` | PDF and Excel generation |
| `header.js`, `router.js`, `app.js`, `api-docs.js` | header controls, view routing, checker wiring, API reference |

## Not implemented, and why

- **SIA category per room.** Every room is still `HNF` because the drawings carry no category source; the KPI dashboard therefore shows HNF = NGF. Needs a data source (room stamp or SAP import) and is a product decision.
- **Overlap and containment checks** (rooms overlapping each other, rooms outside every floor polygon, negative KF). Cheap to add with the new bounds index, but they are new rules and need a decision in the rule catalogue.
- **CDN libraries for the reports.** jsPDF 2.5.2 has twelve published advisories (mostly in Node and AcroForm paths the app does not use); jsPDF 4.2.1 and jspdf-autotable 5.0.8 are drop-in and SheetJS recommends vendoring. Same approach as for LibreDWG; not done here because the request covered LibreDWG only.
- **Web Worker parsing.** Large files still parse on the main thread. The render list is plain data, so moving `processDwgFile` and `prepareDrawingData` into a worker is straightforward.
- **API reference language.** The view stays English, like the OpenAPI specification it renders; only the header and footer are translated.
- **Font**: text is drawn with Arial regardless of the DWG style; the style name is only used by `TEXT_002`.
