# Design & UX Review: Prufplattform Flachenmanagement

**Date:** 2026-02-27
**Reviewer:** Senior Design & UX Expert
**Scope:** Full application — HTML, CSS, JavaScript, interaction design, information architecture, accessibility, responsive behavior, and export experience.

---

## Executive Summary

The BBL Prufplattform Flachenmanagement is a well-architected browser-based floor plan validation tool with a solid foundation: a well-structured design token system aligned with the Swiss Federal Design System, thoughtful accessibility defaults, and a modular code structure. The application demonstrates strong engineering discipline — semantic HTML, WCAG-compliant color contrasts, responsive breakpoints, and a clear separation between data, rendering, and UI logic.

That said, the review surfaces 28 findings across 7 categories, ranging from quick wins to more substantive UX improvements. The most impactful issues center on: (1) progressive disclosure of information density, (2) user orientation during multi-step workflows, (3) missing feedback loops for destructive/irreversible actions, and (4) several opportunities to reduce cognitive load in the validation results experience.

**Overall Rating: Strong** — The foundation is excellent. The recommendations below would elevate it from "functional professional tool" to "best-in-class domain application."

---

## 1. Information Architecture & User Flow

### 1.1 Linear page layout hides spatial relationships (Medium)
**Location:** `index.html:39-141`

The main application uses a vertically stacked layout: Upload -> Status -> Metrics -> Validation -> Info -> Entities -> Console. After file processing, the user faces a very long scrollable page where the most important content (the validation split-view with the interactive floor plan) can be pushed below the fold by the metrics and info panels above it.

**Recommendation:** After successful file processing, auto-scroll to the validation panel or collapse the upload zone into a compact file-info bar. The upload zone consumes significant vertical space that becomes dead weight after a file is loaded.

### 1.2 No breadcrumb or workflow indicator (Low)
**Location:** `index.html`

Users go through a clear 3-phase workflow: Upload -> Process -> Review. There is no visual indicator showing where they are in this flow. First-time users may not understand that validation results will appear below.

**Recommendation:** Add a simple step indicator (e.g., "1. Upload -> 2. Processing -> 3. Results") that updates state as the user progresses. This is especially valuable because the WASM processing step takes time and the user needs reassurance.

### 1.3 Console panel is always visible but rarely needed (Low)
**Location:** `index.html:136-139`, `css/styles.css:483`

The console panel (`#console-panel`) has `display: block` by default, making it the only panel visible on page load before any file is uploaded. A debug log is not the first thing a user should see. It adds cognitive noise for non-technical users.

**Recommendation:** Collapse the console by default and make it expandable via a toggle. Only auto-expand when errors occur during processing.

---

## 2. Interaction Design

### 2.1 No confirmation or undo for file replacement (High)
**Location:** `js/app.js:49-106`

When a user uploads a second file, the entire application state is silently reset (`state.roomData = []`, `state.areaData = []`, `state.validationErrors = []`, etc.) without any confirmation dialog. If a user accidentally drops a file while reviewing results, all current work is lost.

**Recommendation:** Add a confirmation dialog: "Replace current analysis? All current results will be lost." This is especially important because the WASM processing is not instantaneous and re-processing the original file would require the user to re-upload it.

### 2.2 Drag-and-drop zone has ambiguous click target (Medium)
**Location:** `index.html:41-50`, `js/app.js:20`

The entire upload zone is clickable (`dom.uploadZone.addEventListener('click', ...)`), but there is also a separate "Datei auswahlen" button inside it. Both trigger the file input. This creates confusion about where to click and what the button does that clicking the zone does not.

**Recommendation:** Differentiate the two interactions. The zone should respond to drag-and-drop visually (current implementation is fine), while the button should be the primary click affordance. Consider making only the button trigger the file input, using the surrounding zone text as instructional context rather than a click target.

### 2.3 Language selector logs a warning but provides no feedback (Medium)
**Location:** `js/app.js:325-331`

Clicking FR, IT, or EN logs `"Sprache: FR (noch nicht implementiert)"` to the console panel, which the user may not even see. The button changes its active state (suggesting the language changed) but nothing actually happens.

**Recommendation:** Either disable the non-functional language buttons (with a tooltip explaining "Coming soon") or remove them entirely. Showing interactive controls that do nothing violates the principle of least surprise. If kept, at minimum show a toast notification rather than a console log.

### 2.4 No loading/progress indicator for WASM download (High)
**Location:** `js/dwg-processing.js`

The LibreDWG WASM module is ~15MB and loaded on-demand from a CDN. During first load, the user sees only a generic "Datei wird verarbeitet..." status message. There is no indication that a large binary is being downloaded or progress toward completion.

**Recommendation:** Show a determinate progress bar (or at minimum, distinct phases: "Downloading parser...", "Parsing DWG file...", "Extracting rooms..."). The WASM download is the longest wait and users may think the app is frozen.

### 2.5 Zoom controls lack keyboard shortcuts (Medium)
**Location:** `js/app.js:292-299`, `index.html:97-105`

The canvas viewer has zoom in/out/fit buttons and wheel zoom, but no keyboard shortcuts. Professional CAD users expect keyboard shortcuts for navigation (e.g., `+`/`-` for zoom, `F` for fit, `Esc` to deselect).

**Recommendation:** Add keyboard event listeners for common navigation shortcuts. This also benefits accessibility for users who cannot use a mouse wheel.

### 2.6 Feature popup is pointer-events: none (Low)
**Location:** `css/styles.css:435`

The feature popup that appears on entity click has `pointer-events: none`, which means users cannot select text from it or interact with its contents. For a tool where users may need to copy entity handles, coordinates, or layer names, this is a limitation.

**Recommendation:** Allow pointer events on the popup (except on mobile where it already enables them). Add a small close button so users can dismiss it manually. Consider allowing text selection within the popup.

---

## 3. Visual Design & Layout

### 3.1 Design token system is well-structured but has a redundancy (Low)
**Location:** `css/tokens.css:72-73`

`--font-size-2xs` and `--font-size-xs` are both defined as `0.8125rem` (13px), making them functionally identical. This creates a token that exists but provides no distinct value.

**Recommendation:** Either differentiate them (e.g., `--font-size-2xs: 0.6875rem` / 11px) or remove `--font-size-2xs` to reduce cognitive overhead for developers using the system.

### 3.2 Split-view proportions may be suboptimal (Medium)
**Location:** `css/styles.css:525-533`

The validation split is `35% / 65%` (side panel / viewer). Given that the side panel contains searchable lists with multiple data columns (status icon, checkbox, name, area value), 35% can feel cramped on smaller desktop screens (1280px). Meanwhile, the viewer benefits most from available space.

**Recommendation:** Consider making the split resizable with a drag handle, or at minimum offering a collapse/expand toggle for the side panel so users can maximize the viewer when needed. The current `min-width: 280px` is appropriate, but the `max-width: 420px` may be too restrictive on wide screens.

### 3.3 Validation tabs can overflow horizontally without indication (Medium)
**Location:** `css/styles.css:508-521`, `index.html:65-83`

The 6 tabs (Prufregeln, Fehlermeldungen, Layer, Raume, Flachen, Kennzahlen) plus the status filter buttons occupy significant horizontal space. The tab container has `overflow-x: auto` but no scroll indicators or fade edges. Users on medium-width screens may not realize more tabs exist to the right.

**Recommendation:** Add scroll fade indicators (gradient overlays at the edges) or arrow buttons to hint at hidden content. On mobile, the tabs wrap (good), but on tablet-width screens (768-1024px) they may overflow without wrapping.

### 3.4 Metrics panel download buttons have no visual grouping (Low)
**Location:** `js/validation.js:697-704`

The PDF and Excel download buttons are rendered inside the metrics info-grid as part of an `info-grid__download` cell. This works but feels disconnected from the validation results they export. Users may not discover them because they are positioned above the validation panel rather than within it.

**Recommendation:** Add download actions to the validation panel itself (e.g., in the panel header or as a floating action button within the split view). Keep the metrics panel buttons as a secondary access point.

### 3.5 Inline styles in JavaScript-rendered HTML (Medium)
**Location:** `js/validation.js:737-753`, `js/validation.js:700`

Several places use inline `style=""` attributes in dynamically generated HTML (e.g., the abort UI, the score color). This bypasses the design token system and creates maintenance risk.

**Recommendation:** Use CSS classes for all styling, even in dynamically rendered content. For example, `style="color: var(--color-${scoreClass})"` should be a class like `val-metric--${scoreClass}`.

---

## 4. Accessibility

### 4.1 Focus management after file load (High)
**Location:** `js/app.js:49-106`

After processing a file, the page content changes dramatically (panels appear, canvas renders, tabs populate) but focus remains wherever it was (likely the upload zone or file input). Screen reader users have no indication that new content has appeared below.

**Recommendation:** After processing completes, move focus to the validation panel header or the status message. Add an `aria-live="polite"` region for the status element so screen readers announce processing results.

### 4.2 Canvas viewer is not keyboard-accessible (High)
**Location:** `js/app.js:108-287`, `index.html:96`

The canvas element cannot receive keyboard focus and has no ARIA role. The entire interactive floor plan viewer is completely inaccessible to keyboard-only users. While canvas-based viewers have inherent accessibility limitations, there are mitigations.

**Recommendation:**
- Add `tabindex="0"` and `role="img"` to the canvas with an `aria-label` describing the current view.
- Add keyboard handlers for arrow keys (pan), `+`/`-` (zoom), `Escape` (deselect).
- Consider adding an `aria-live` region that announces the selected entity details when clicking on the canvas.

### 4.3 Checkbox inputs lack visible labels (Medium)
**Location:** `index.html:88`, `js/validation.js:889-892`

The toggle-all checkbox (`#vside-toggle-all`) and individual layer/room toggle checkboxes have no associated `<label>` elements. They rely on `title` attributes which are not reliably announced by screen readers.

**Recommendation:** Add visually-hidden `<label>` elements associated via `for`/`id` attributes, or use `aria-label` on each checkbox.

### 4.4 Tab navigation uses `<a href="#">` instead of proper tabs pattern (Medium)
**Location:** `index.html:66-71`

The validation tabs use `<a href="#">` links styled as tabs, but do not implement the WAI-ARIA tabs pattern (`role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`). This means screen readers announce them as links rather than tabs, and keyboard navigation (arrow keys between tabs) does not work.

**Recommendation:** Implement the ARIA tabs pattern: `role="tablist"` on the container, `role="tab"` with `aria-selected` on each tab, and `role="tabpanel"` on the content areas. Use `<button>` elements instead of `<a>` tags since these do not navigate to URLs.

### 4.5 Status filter buttons lack ARIA state (Low)
**Location:** `index.html:72-82`

The "Alle / Warnungen / Fehler" segmented control has `role="group"` (good) but individual buttons do not communicate their pressed/selected state via `aria-pressed` or `aria-selected`.

**Recommendation:** Add `aria-pressed="true"` to the active button and `aria-pressed="false"` to inactive ones. Update these attributes in the click handler (`js/app.js:334-341`).

### 4.6 SVG icons lack accessible names (Low)
**Location:** `index.html:42-43, 75-76, 79-80, 98-104`

Multiple inline SVG icons are decorative but not marked as such (`aria-hidden="true"`), or are informational but lack text alternatives. For example, the warning triangle and error X icons in the status filter buttons carry meaning but have no accessible text.

**Recommendation:** Add `aria-hidden="true"` to purely decorative SVGs. For meaningful icons (warning, error, zoom controls), ensure the parent `<button>` has a descriptive `aria-label` or the SVG has a `<title>` element.

---

## 5. Responsive Design & Mobile UX

### 5.1 Mobile validation is functional but data-dense (Medium)
**Location:** `css/styles.css:713-884`

On mobile, the validation split stacks vertically (side list + viewer). The side list gets `max-height: 30vh` and the viewer gets `height: 50vh`. This leaves only 20vh for the tab bar, toolbar, and summary — which may not be enough on short viewports (landscape phones).

**Recommendation:** On mobile landscape, consider hiding the tab bar behind a dropdown/select menu to reclaim vertical space. Also consider a swipe gesture to toggle between the list and viewer rather than showing both simultaneously in a cramped layout.

### 5.2 Feature popup positioning on mobile needs refinement (Low)
**Location:** `css/styles.css:846-856`, `js/renderer.js:529-553`

On mobile, the feature popup becomes a bottom card (`bottom: var(--space-3); left: var(--space-3); right: var(--space-3)`). This is a good pattern, but the popup can overlap the viewer controls (positioned at top-right) when the canvas is short. There is no dismiss gesture — the popup only closes when the user pans, which is not intuitive.

**Recommendation:** Add a close button to the mobile popup card. Consider a swipe-down gesture to dismiss.

### 5.3 Touch target sizes on small phones (Low)
**Location:** `css/styles.css:892-924`

The 480px breakpoint reduces `lang-selector__item` targets to `36px`, which is below the recommended 44px minimum for touch targets (Apple HIG) and the 48dp minimum (Material Design). The `--min-target-size` token is `36px` (2.25rem) which already borders the minimum.

**Recommendation:** Consider increasing `--min-target-size` to `2.75rem` (44px) for touch-enabled devices using `@media (pointer: coarse)` rather than width-based breakpoints.

---

## 6. Data Display & Validation UX

### 6.1 Rules tab could benefit from progressive disclosure (High)
**Location:** `js/validation.js` (renderRulesTab)

All 42 validation rules are shown in a flat list, with passed and failed rules interleaved. Users must scan the entire list to find failures. While the category separators (`rules-cat-sep`) provide some grouping, the cognitive load is high.

**Recommendation:** Show failed rules first, prominently, with a clear summary count. Group passed rules into a collapsed "X rules passed" section. Add a "Show only failures" toggle that is ON by default. The current status filter (Alle/Warnungen/Fehler) partially addresses this but applies globally across all tabs rather than being specific to the rules view.

### 6.2 Error messages lack actionable guidance (Medium)
**Location:** `js/validation.js:14-40`

Error descriptions are declarative ("Pflicht-Layer fehlt: R_RAUMPOLYGON") but do not tell the user what to do. For a validation tool, remediation guidance is as important as error detection.

**Recommendation:** Add a `fix` or `help` field to each rule definition. For example: "Pflicht-Layer fehlt: R_RAUMPOLYGON" -> Help: "Create a layer named R_RAUMPOLYGON containing closed polylines for each room boundary." This could be shown on click/expand in the errors tab.

### 6.3 Score percentage can be misleading (Medium)
**Location:** `js/validation.js:690-692`

The score is calculated as `passedRules / totalRules * 100`. This treats all rules as equally important, but a plan with 1 critical error and 41 passes would score 97%, which may give users false confidence. Some rules (like missing required layers) are showstoppers while others are cosmetic.

**Recommendation:** Consider a weighted scoring model that reflects severity, or at minimum show separate counts: "X critical issues, Y warnings". The current score is useful as a quick indicator but should be supplemented with severity context.

### 6.4 Empty states could be more helpful (Low)
**Location:** `js/validation.js:968, 1093, 1179`

Empty states show basic messages like "Keine Fehler oder Warnungen" or "Keine Raume erkannt." These miss an opportunity to guide users.

**Recommendation:** For "Keine Raume erkannt," add guidance: "Expected: closed polylines on layer R_RAUMPOLYGON. Verify your DWG file contains this layer." (The areas tab already does a version of this, which is good.)

---

## 7. Export Experience

### 7.1 PDF export lacks user feedback during generation (Medium)
**Location:** `js/export.js:49-477`

PDF generation captures multiple canvas states and builds a 6-page report. During this process, the canvas flickers (as modes are switched for screenshots) and no progress indication is shown beyond the initial console log.

**Recommendation:** Show a modal overlay with a progress indicator during PDF generation (e.g., "Generating report... Page 3/6"). Prevent user interaction during generation to avoid state corruption from clicks during canvas capture.

### 7.2 Export buttons do not indicate file format or size (Low)
**Location:** `js/validation.js:701-703`

The download buttons simply say "PDF" and "Excel" with a download icon. Users do not know what they will get until they click.

**Recommendation:** On hover, show a tooltip describing the report contents: "6-page PDF report with floor plan screenshots, validation results, room inventory, and SIA 416 metrics."

### 7.3 GeoJSON and BCF exports exist in code but are not exposed in UI (Low)
**Location:** `js/export.js:596-727`

`downloadGeoJson()` and `downloadBcf()` are implemented (GeoJSON) or stubbed (BCF) but there are no UI buttons to trigger them.

**Recommendation:** Either add UI buttons for GeoJSON export (it is fully functional) or document it as an API-only feature. For BCF, either implement it or remove the stub to avoid dead code.

---

## 8. Code Quality Observations (Design-Relevant)

### 8.1 Renderer duplicates overlay color constants from tokens.css
**Location:** `js/renderer.js:9-21`

Canvas 2D cannot read CSS custom properties, so colors are duplicated as JavaScript constants. This is a known limitation, but the comment acknowledges it. If tokens.css changes, these values can drift out of sync.

**Recommendation:** Consider a build-time or runtime step that reads CSS custom properties and injects them into the renderer module, or maintain a shared JSON color definition that both CSS and JS import.

### 8.2 HTML generation via string concatenation in validation.js
**Location:** `js/validation.js:697-704`, `js/validation.js:737-753`

Dynamic HTML is built via string concatenation and `innerHTML`. While `esc()` is used in some places, the pattern is fragile and makes the UI harder to reason about.

**Recommendation:** Consider using `document.createElement()` consistently (as is done in `renderOverviewTab`, `renderRoomsTab`, etc.) or adopt a lightweight templating approach. The codebase already uses DOM APIs in most places — unifying on that pattern would improve consistency.

---

## Summary of Findings by Priority

| Priority | Count | Key Areas |
|----------|-------|-----------|
| **High** | 4 | Focus management, canvas accessibility, file replacement confirmation, WASM loading feedback |
| **Medium** | 12 | Tab ARIA pattern, split-view proportions, progressive disclosure, error guidance, score weighting, inline styles |
| **Low** | 12 | Token redundancy, console visibility, popup improvements, empty states, export tooltips |

---

## What Works Well

The following aspects deserve recognition as strong design decisions:

1. **Design token system** (`tokens.css`): Exceptionally well-organized with clear naming, WCAG contrast documentation inline, and logical grouping. This is a model for token-based design systems.

2. **Shared CSS pattern groups** (`styles.css:29-166`): The approach of documenting which components share a pattern (code-badge, filled-badge, uppercase-label, etc.) and grouping them in multi-selector rules is clean and maintainable.

3. **Responsive breakpoints** (`styles.css:713-924`): Three breakpoints (768px, 480px, safe-area-inset) cover the important device categories. Mobile touch targets are enlarged appropriately.

4. **Canvas viewer interaction model** (`app.js:108-287`): Pointer events, pinch zoom, wheel zoom, tap detection, and coordinate tracking are all well-implemented with proper edge case handling.

5. **Validation rule architecture** (`validation.js`): The category-based rule system with consistent error objects, severity levels, and room/handle linking creates a coherent data model that powers multiple UI views and export formats.

6. **PDF report design** (`export.js`): The 6-page report with Swiss Federal branding, table of contents, metric cards, and canvas screenshots is a professional deliverable that adds significant value.

7. **Hit testing** (`renderer.js:364-465`): The multi-geometry hit testing (lines, polys, circles, arcs, ellipses, text, hatches) with proper tolerance handling is thorough and well-implemented.

8. **Mobile feature popup** (`styles.css:846-856`): Converting the popup to a bottom card on mobile is the correct pattern for touch devices.
