# Prüfregeln — CAD-Richtlinie BBL V1.0

> Referenzdokument: *CAD-Richtlinie BBL-DE, Version 1.0, Stand 01.01.2026*

## Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Prüfkategorien](#prüfkategorien)
3. [Abbruchkriterien](#abbruchkriterien)
4. [Regeln — Layerstruktur (LAYER)](#regeln--layerstruktur-layer)
5. [Regeln — Raumpolygone (POLY)](#regeln--raumpolygone-poly)
6. [Regeln — Geschosspolygone (GPOLY)](#regeln--geschosspolygone-gpoly)
7. [Regeln — AOID / Raumstempel (AOID)](#regeln--aoid--raumstempel-aoid)
8. [Regeln — Geometrie allgemein (GEOM)](#regeln--geometrie-allgemein-geom)
9. [Regeln — Textelemente (TEXT)](#regeln--textelemente-text)
10. [Regeln — Linientypen und Farben (STYLE)](#regeln--linientypen-und-farben-style)
11. [Regeln — Planlayout (LAYOUT)](#regeln--planlayout-layout)
12. [Regeln — Masselemente (DIM)](#regeln--masselemente-dim)
13. [Regeln — Schraffurelemente (HATCH)](#regeln--schraffurelemente-hatch)
14. [Schweregrade](#schweregrade)
15. [Layerstruktur CAFM-Plan — Referenz](#layerstruktur-cafm-plan--referenz)
16. [AOID-Format — Referenz](#aoid-format--referenz)
17. [Testdatei](#testdatei)

---

## Übersicht

Dieses Dokument beschreibt die automatisierten Prüfregeln der Prüfplattform Flächenmanagement. Die Regeln leiten sich aus der **CAD-Richtlinie BBL V1.0** (Kap. 4 und 5) ab und prüfen CAFM-Pläne auf Konformität mit den Vorgaben des BBL.

Die Prüfung deckt folgende Bereiche ab:

- **Layerstruktur** — Nur zulässige Layer, korrekte Zuordnung der Elemente
- **Raumpolygone** — Geschlossene Polylinien, Mindestfläche, keine Bogensegmente
- **Geschosspolygone** — Geschlossene Polylinien auf korrektem Layer
- **AOID / Raumstempel** — Eindeutige Raumkennzeichnung innerhalb des Polygons
- **Geometrie** — Zeichnungseinheit mm, Z-Koordinate 0, keine unzulässigen Entitäten
- **Textelemente** — Nur auf zulässigen Layern, Schriftart ARIAL
- **Linientypen/Farben** — Polylinienbreite 0, Farbe VONLAYER
- **Planlayout** — Kein Layout-Tab, Planrahmen/Plankopf im Modellbereich
- **Masselemente** — Assoziative Massobjekte vorhanden
- **Schraffurelemente** — SOLID-Schraffuren auf korrektem Layer

---

## Prüfkategorien

| Präfix | Kategorie | Beschreibung |
|--------|-----------|--------------|
| `LAYER` | Layerstruktur | Prüfung der zulässigen Layer und Elementzuordnung |
| `POLY` | Raumpolygone | Prüfung der NGF-Raumpolygone |
| `GPOLY` | Geschosspolygone | Prüfung der Geschossflächenpolygone |
| `AOID` | Raumstempel | Prüfung der AOID-Textelemente |
| `GEOM` | Geometrie | Allgemeine geometrische Prüfungen |
| `TEXT` | Textelemente | Prüfung von Texten und Schriftarten |
| `STYLE` | Linientypen/Farben | Prüfung der grafischen Eigenschaften |
| `LAYOUT` | Planlayout | Prüfung Modellbereich und Layout-Tabs |
| `DIM` | Masselemente | Prüfung der Bemassungsobjekte |
| `HATCH` | Schraffurelemente | Prüfung der Schraffuren |

---

## Abbruchkriterien

Die Planprüfung wird **ohne weitere Prüfung abgebrochen**, wenn eines der folgenden Kriterien zutrifft (Richtlinie Kap. 3.1):

| Code | Beschreibung | Referenz |
|------|-------------|----------|
| `ABORT_001` | Die Layerstruktur wird nicht eingehalten (keiner der Pflicht-Layer vorhanden) | Kap. 3.1 |
| `ABORT_002` | Die Zeichnungseinheit ist nicht Millimeter (1:1) | Kap. 4.2 |

Bei Abbruch werden keine weiteren Regeln geprüft. Der Plan muss zuerst die Grundvoraussetzungen erfüllen.

---

## Regeln — Layerstruktur (LAYER)

Referenz: Richtlinie Kap. 5.2, Tabelle 4

### Zulässige Layer CAFM-Plan

| Layername | Farbe (ACI) | RGB | Pflicht | Beschreibung |
|-----------|-------------|-----|---------|--------------|
| `A_ARCHITEKTUR` | 253 | 137,137,137 | Ja | Architektonische Objekte (Wände, Türen, Fenster, Treppen etc.) |
| `A_ELEKTRO` | 150 | 0,127,255 | Nein | Schaltschränke, Apparate |
| `A_HEIZUNG-KUEHLUNG` | 1 | 255,0,0 | Nein | Radiatoren, Apparate |
| `A_LUEFTUNG` | 4 | 0,255,255 | Nein | Drallauslässe, Apparate |
| `A_SANITAER` | 92 | 0,165,0 | Nein | WC, Lavabo, Duschen |
| `A_SCHRAFFUR` | 8 | 128,128,128 | Ja | Massive Wände (Solid-Schraffuren) |
| `V_ACHSEN` | 251 | 45,45,45 | Nein | Gebäudeachsen |
| `V_BEMASSUNG` | 251 | 45,45,45 | Ja | Hauptmasse gem. SIA400 |
| `V_PLANLAYOUT` | 252 | 91,91,91 | Ja | Plankopf und Planrahmen |
| `V_REFERENZPUNKT` | 30 | 255,127,0 | Nein | Referenzpunkt-Symbol |
| `V_TEXT` | 253 | 137,137,137 | Nein | Informationstexte |
| `R_AOID` | 7 | 0,0,0 | Ja | AOID-Textfelder |
| `R_RAUMPOLYGON` | 210 | 255,0,255 | Ja | Raumpolygone (NGF) |
| `R_RAUMPOLYGON-ABZUG` | 230 | 255,0,127 | Nein | Abzugsflächenpolygone |
| `R_GESCHOSSPOLYGON` | 214 | 127,0,127 | Ja | Geschosspolygone (GF) |

### Prüfregeln

| Code | Schweregrad | Beschreibung | Referenz |
|------|------------|--------------|----------|
| `LAYER_001` | Fehler | Pflicht-Layer fehlt: `R_RAUMPOLYGON` nicht vorhanden | Kap. 5.2 |
| `LAYER_002` | Fehler | Pflicht-Layer fehlt: `R_AOID` nicht vorhanden | Kap. 5.2 |
| `LAYER_003` | Fehler | Pflicht-Layer fehlt: `R_GESCHOSSPOLYGON` nicht vorhanden | Kap. 5.2 |
| `LAYER_004` | Warnung | Pflicht-Layer fehlt: `A_ARCHITEKTUR` nicht vorhanden | Kap. 5.2 |
| `LAYER_005` | Warnung | Pflicht-Layer fehlt: `V_PLANLAYOUT` nicht vorhanden | Kap. 5.2 |
| `LAYER_006` | Warnung | Pflicht-Layer fehlt: `V_BEMASSUNG` nicht vorhanden | Kap. 5.2 |
| `LAYER_007` | Warnung | Pflicht-Layer fehlt: `A_SCHRAFFUR` nicht vorhanden | Kap. 5.2 |
| `LAYER_008` | Warnung | Unbekannter Layer vorhanden: `{name}` ist nicht in der zulässigen Layerliste | Kap. 5.2 |

---

## Regeln — Raumpolygone (POLY)

Referenz: Richtlinie Kap. 5.8

Raumpolygone liegen auf dem Layer `R_RAUMPOLYGON`. Sie müssen geschlossene Polylinien (LWPOLYLINE) ohne Bogensegmente sein. Jeder Raum ab 0.25 m² benötigt ein Polygon.

| Code | Schweregrad | Beschreibung | Referenz |
|------|------------|--------------|----------|
| `POLY_001` | Fehler | Raumpolygon ist nicht geschlossen (Start ≠ Ende) | Kap. 5.8 |
| `POLY_002` | Fehler | Raumpolygon enthält Bogensegmente (bulge ≠ 0) | Kap. 5.8 |
| `POLY_003` | Fehler | Polygon hat weniger als 3 Eckpunkte | Kap. 5.8 |
| `POLY_004` | Warnung | Raumfläche sehr klein (< 0.25 m²) | Kap. 5.8 |
| `POLY_005` | Warnung | Mögliches doppeltes Polygon (identische Geometrie) | Kap. 5.8 |
| `POLY_006` | Fehler | Element auf `R_RAUMPOLYGON` ist keine LWPOLYLINE | Kap. 5.8 |
| `POLY_007` | Warnung | Raumpolygon hat Selbstüberschneidung | Kap. 5.8 |

---

## Regeln — Geschosspolygone (GPOLY)

Referenz: Richtlinie Kap. 5.9

Geschosspolygone liegen auf dem Layer `R_GESCHOSSPOLYGON`. Abzugsflächen (Treppenaugen > 5 m², Lufträume) werden mit einem durchgängigen Polygonzug ausgegrenzt.

| Code | Schweregrad | Beschreibung | Referenz |
|------|------------|--------------|----------|
| `GPOLY_001` | Fehler | Geschosspolygon ist nicht geschlossen | Kap. 5.9 |
| `GPOLY_002` | Fehler | Geschosspolygon enthält Bogensegmente (bulge ≠ 0) | Kap. 5.9 |
| `GPOLY_003` | Fehler | Element auf `R_GESCHOSSPOLYGON` ist keine LWPOLYLINE | Kap. 5.9 |
| `GPOLY_004` | Warnung | Kein Geschosspolygon vorhanden | Kap. 5.9 |
| `GPOLY_005` | Warnung | Mögliches doppeltes Geschosspolygon | Kap. 5.9 |

---

## Regeln — AOID / Raumstempel (AOID)

Referenz: Richtlinie Kap. 2.5, 5.10

Pro Raum ist ein Textelement mit der AOID auf dem Layer `R_AOID` innerhalb des Raumpolygons zu platzieren. Der Basispunkt des Textes muss innerhalb des Polygons liegen. Die AOID muss eindeutig sein.

### AOID-Prüfregeln

| Code | Schweregrad | Beschreibung | Referenz |
|------|------------|--------------|----------|
| `AOID_001` | Fehler | Raumpolygon hat keine AOID (kein Text auf `R_AOID` innerhalb des Polygons) | Kap. 5.10 |
| `AOID_002` | Fehler | AOID ist nicht eindeutig (gleiche AOID in mehreren Polygonen) | Kap. 5.10 |
| `AOID_003` | Warnung | AOID-Format ungültig (erwartet: `WWWW.GG.EE.RRR`) | Kap. 2.5 |
| `AOID_004` | Warnung | Mehrere Texte auf `R_AOID` innerhalb desselben Polygons | Kap. 5.10 |
| `AOID_005` | Warnung | AOID-Text liegt auf `R_AOID`, aber ausserhalb aller Raumpolygone | Kap. 5.10 |
| `AOID_006` | Warnung | Basispunkt des AOID-Textes liegt ausserhalb des zugeordneten Polygons | Kap. 5.10 |

---

## Regeln — Geometrie allgemein (GEOM)

Referenz: Richtlinie Kap. 4.1, 4.2, 5.1

| Code | Schweregrad | Beschreibung | Referenz |
|------|------------|--------------|----------|
| `GEOM_001` | Fehler | Zeichnungseinheit ist nicht Millimeter (1:1) | Kap. 4.2 |
| `GEOM_002` | Warnung | Element hat Z-Koordinate ≠ 0 | Kap. 5.1 |
| `GEOM_003` | Fehler | Unzulässiger Entitätstyp vorhanden: MULTILINE, ELLIPSE, SPLINE oder OLE | Kap. 5.1 |
| `GEOM_004` | Warnung | Externe Referenz (XREF) vorhanden | Kap. 4.7 |
| `GEOM_005` | Warnung | Element liegt ausserhalb des Schnittrahmens | Kap. 4.10 |

---

## Regeln — Textelemente (TEXT)

Referenz: Richtlinie Kap. 5.5

Textelemente dürfen nur auf den Layern `V_PLANLAYOUT`, `V_ACHSEN`, `V_TEXT` und `R_AOID` vorkommen. Für alle Texte (ausser `V_PLANLAYOUT`) muss die Schriftart ARIAL verwendet werden.

| Code | Schweregrad | Beschreibung | Referenz |
|------|------------|--------------|----------|
| `TEXT_001` | Warnung | Textelement auf unzulässigem Layer (nicht V_PLANLAYOUT, V_ACHSEN, V_TEXT, R_AOID) | Kap. 5.5 |
| `TEXT_002` | Warnung | Schriftart ist nicht ARIAL | Kap. 5.5 |

---

## Regeln — Linientypen und Farben (STYLE)

Referenz: Richtlinie Kap. 5.4

| Code | Schweregrad | Beschreibung | Referenz |
|------|------------|--------------|----------|
| `STYLE_001` | Warnung | Polylinienbreite ist nicht 0 mm | Kap. 5.4 |
| `STYLE_002` | Warnung | Farbe ist nicht VONLAYER (ByLayer) | Kap. 5.4 |

---

## Regeln — Planlayout (LAYOUT)

Referenz: Richtlinie Kap. 5.3

Layouts (Paper Space Tabs) sind nicht erlaubt. Planrahmen und Plankopf sind im Modellbereich zu platzieren.

| Code | Schweregrad | Beschreibung | Referenz |
|------|------------|--------------|----------|
| `LAYOUT_001` | Warnung | Layout-Tab (Paper Space) vorhanden | Kap. 5.3 |
| `LAYOUT_002` | Warnung | Kein Planrahmen auf `V_PLANLAYOUT` erkannt | Kap. 5.3 |

---

## Regeln — Masselemente (DIM)

Referenz: Richtlinie Kap. 5.6

| Code | Schweregrad | Beschreibung | Referenz |
|------|------------|--------------|----------|
| `DIM_001` | Warnung | Keine Masselemente auf `V_BEMASSUNG` vorhanden | Kap. 5.6 |
| `DIM_002` | Warnung | Masselement ist nicht assoziativ | Kap. 5.6 |

---

## Regeln — Schraffurelemente (HATCH)

Referenz: Richtlinie Kap. 5.7

| Code | Schweregrad | Beschreibung | Referenz |
|------|------------|--------------|----------|
| `HATCH_001` | Warnung | Schraffur auf `A_SCHRAFFUR` ist nicht vom Typ SOLID | Kap. 5.7 |

---

## Schweregrade

| Schweregrad | Symbol | Beschreibung |
|-------------|--------|--------------|
| **Abbruch** | ⛔ | Prüfung wird vollständig abgebrochen. Plan nicht prüfbar. |
| **Fehler** | ✖ | Muss behoben werden. Plan wird nicht freigegeben. |
| **Warnung** | ⚠ | Sollte überprüft werden. Plan kann mit Warnungen freigegeben werden. |

---

## Layerstruktur CAFM-Plan — Referenz

Vollständige Layerübersicht gemäss Richtlinie Kap. 5.2, Tabelle 4:

```
Layer                    Farbe(ACI)  RGB              Beschreibung
─────────────────────────────────────────────────────────────────────────────────
A_ARCHITEKTUR            253         137,137,137      Architekturelemente (Wände, Türen, Fenster...)
A_ELEKTRO                150         0,127,255        Elektroinstallationen
A_HEIZUNG-KUEHLUNG       1           255,0,0          Heizung/Kühlung
A_LUEFTUNG               4           0,255,255        Lüftungsanlagen
A_SANITAER               92          0,165,0          Sanitäranlagen
A_SCHRAFFUR              8           128,128,128      Solid-Schraffuren (massive Wände)
V_ACHSEN                 251         45,45,45         Gebäudeachsen
V_BEMASSUNG              251         45,45,45         Hauptmasse
V_PLANLAYOUT             252         91,91,91         Plankopf und Planrahmen
V_REFERENZPUNKT          30          255,127,0        Referenzpunkte
V_TEXT                   253         137,137,137      Informationstexte
R_AOID                   7           0,0,0            AOID-Textfelder
R_RAUMPOLYGON            210         255,0,255        Raumpolygone (NGF)
R_RAUMPOLYGON-ABZUG      230         255,0,127        Abzugsflächenpolygone
R_GESCHOSSPOLYGON        214         127,0,127        Geschosspolygone (GF)
```

Systemlayer (werden von Prüfstelle erstellt, nicht vom Beauftragten):

```
R_RAUMSTEMPEL            252                          Raumstempel für Import in SAP
```

---

## AOID-Format — Referenz

### Aufbau AOID im Gebäude

```
WWWW.GG.EE.RRR
│    │  │  └── Raumidentifikation (3-stellig, fortlaufend)
│    │  └───── Ebene (2-stellig)
│    └──────── Gebäudenummer
└───────────── Wirtschaftseinheit
```

Beispiel: `2011.DM.04.045`

### Aufbau AOID Aussenparkplätze

```
WWWW.G.RRR
│    │ └── Raumidentifikation (3-stellig, fortlaufend)
│    └──── Grundstücknummer
└───────── Wirtschaftseinheit
```

Beispiel: `2011.1.001`

---

## Testdatei

Zum Testen der Prüfregeln steht die offizielle BBL-Musterdatei zur Verfügung:

| Datei | Beschreibung |
|-------|-------------|
| `assets/test-files/CAD.V01-CAFM-Plan-DE.dwg` | CAFM-Musterplan BBL (DE), enthält die korrekte Layerstruktur und Beispielräume mit AOID |

Diese Datei entspricht dem Anhang **CAD.V01 — CAFM-Plan** der CAD-Richtlinie und dient als Referenzimplementation für die korrekte Planerstellung.

<!--
================================================================================
IMPLEMENTATION FEASIBILITY ANALYSIS
Browser-only (JS/TS, no Python backend) — based on current dwg-processing.js
================================================================================

Data available in renderList per item:
  t        — render type (line | poly | circle | arc | ellipse | text | point | solid | hatchfill)
  et       — original DWG entity type (LWPOLYLINE, TEXT, MTEXT, HATCH, DIMENSION, INSERT, MLINE, ...)
  l        — layer name
  handle   — unique entity handle
  c        — resolved hex color
  closed   — boolean (polylines)
  verts[]  — vertices with {x, y, bulge} (polylines)
  x, y     — position (text, point)
  text     — string content (text)
  h        — text height
  rot      — rotation

Additional data accessible during parsing (dwg-processing.js):
  e.colorIndex     — ACI color (256 = ByLayer, 0 = ByBlock)
  db.tables.LAYER  — layer definitions with colorIndex
  db.tables.BLOCK_RECORD — block definitions
  HATCH entities   — patternName, isSolidFill, style
  DIMENSION        — measurement, definitionPoints, block reference

NOT currently extracted (would require parser enhancements):
  $INSUNITS        — drawing unit header variable
  Z-coordinates    — available in raw DWG, but dropped to 2D in processing
  Paper Space flag — entities don't carry model/paper space distinction
  Text style/font  — style table (STYLE entries) not read; MTEXT font codes stripped
  Polyline width   — constantWidth / per-vertex width not extracted
  XREF flag        — INSERT entities don't distinguish XREF from block
  DIM associativity — DIMENSION association flags not extracted


RULE-BY-RULE ASSESSMENT
═══════════════════════

✅ = implementable now with current parser
🔧 = implementable with minor parser enhancement (add 1-2 properties)
🔨 = implementable with moderate parser enhancement (new table/logic)
❌ = not feasible in browser

─── ABORT CRITERIA (2) ────────────────────────────────────────────────────────

✅ ABORT_001  Layer structure not met
             → Check state.layerInfo for required R_* layers. Trivial.

🔧 ABORT_002  Drawing unit not mm
             → Need to read $INSUNITS from db.header. Minor: add one line
               to extract header variable during parsing. Can also heuristic-
               check coordinate magnitude (mm plans have values in thousands).

─── LAYER (8 rules) ───────────────────────────────────────────────────────────

✅ LAYER_001  R_RAUMPOLYGON missing      → layerInfo.find(l => l.name === ...)
✅ LAYER_002  R_AOID missing             → same
✅ LAYER_003  R_GESCHOSSPOLYGON missing   → same
✅ LAYER_004  A_ARCHITEKTUR missing       → same
✅ LAYER_005  V_PLANLAYOUT missing        → same
✅ LAYER_006  V_BEMASSUNG missing         → same
✅ LAYER_007  A_SCHRAFFUR missing         → same
✅ LAYER_008  Unknown layer present       → compare layerInfo names vs allowed set

   ALL 8 IMPLEMENTABLE NOW

─── POLY (7 rules) ────────────────────────────────────────────────────────────

✅ POLY_001  Not closed
            → renderList items on R_RAUMPOLYGON: check .closed flag
              and first/last vertex distance

✅ POLY_002  Arc segments (bulge ≠ 0)
            → verts[].bulge is available; check any bulge !== 0

✅ POLY_003  < 3 vertices
            → verts.length < 3

✅ POLY_004  Area < 0.25 m²
            → computePolygonArea(verts) already exists in utils.js
              Note: area in mm² from DWG, divide by 1e6 for m²

✅ POLY_005  Duplicate polygon
            → Compare vertex arrays (hash vertices, group by hash)

✅ POLY_006  Entity type not LWPOLYLINE
            → Check .et property for all items on R_RAUMPOLYGON layer

✅ POLY_007  Self-intersection
            → Segment-segment intersection test on polygon edges.
              O(n²) per polygon but room polygons are typically small.
              Bentley-Ottmann sweep possible for optimization.

   ALL 7 IMPLEMENTABLE NOW

─── GPOLY (5 rules) ───────────────────────────────────────────────────────────

✅ GPOLY_001  Not closed          → same logic as POLY_001, layer R_GESCHOSSPOLYGON
✅ GPOLY_002  Arc segments        → same as POLY_002
✅ GPOLY_003  Not LWPOLYLINE      → same as POLY_006
✅ GPOLY_004  No floor polygon    → check if any item on R_GESCHOSSPOLYGON
✅ GPOLY_005  Duplicate polygon   → same as POLY_005

   ALL 5 IMPLEMENTABLE NOW

─── AOID (6 rules) ────────────────────────────────────────────────────────────

✅ AOID_001  No AOID in polygon
            → Filter text items on R_AOID layer, pointInPoly() already
              exists in utils.js. Check each R_RAUMPOLYGON polygon has
              at least one R_AOID text inside.

✅ AOID_002  AOID not unique
            → Collect all AOID text strings, check for duplicates via Set/Map.

✅ AOID_003  AOID format invalid
            → Regex: /^\d{4}\.\w{1,4}\.\d{2}\.\d{3}$/ for building AOID
              Also accept parking format: /^\d{4}\.\d+\.\d{3}$/

✅ AOID_004  Multiple AOIDs in one polygon
            → Count R_AOID texts per polygon during point-in-poly scan.

✅ AOID_005  AOID text outside all polygons
            → Inverse check: for each R_AOID text, verify it falls inside
              at least one R_RAUMPOLYGON polygon.

✅ AOID_006  AOID basepoint outside polygon
            → Same as AOID_001 essentially — the insertion point (x,y) of
              the text is what pointInPoly checks.

   ALL 6 IMPLEMENTABLE NOW

─── GEOM (5 rules) ────────────────────────────────────────────────────────────

🔧 GEOM_001  Drawing unit not mm
            → Same as ABORT_002. Need $INSUNITS from DWG header.
              Parser enhancement: extract db.header.$INSUNITS (1 line).
              Fallback heuristic: check if coordinate extents suggest mm
              (bounds width/height in thousands = mm, in single digits = m).

🔧 GEOM_002  Z-coordinate ≠ 0
            → Raw DWG vertices have Z but it's dropped in dwg-processing.js
              (only x,y passed to renderList). Enhancement: during entity
              processing, check original vertex Z values and flag non-zero.
              Could add a z-check pass before the 2D projection.

✅ GEOM_003  Forbidden entity types (MULTILINE, ELLIPSE, SPLINE, OLE)
            → .et property available. MLINE → "MLINE", ELLIPSE → "ELLIPSE",
              SPLINE → "SPLINE". OLE not parsed (would appear as unknown
              entity type in stats.unknownEntityCount — could flag that).

🔧 GEOM_004  External reference (XREF)
            → INSERT entities are expanded from blockMap. XREFs are a special
              case of INSERT. Enhancement: check if block definition has
              XREF path/flag in db.tables.BLOCK_RECORD entries.
              Minor: add xrefPath property during block map creation.

🔨 GEOM_005  Element outside plan frame (Schnittrahmen)
            → Need to: 1) identify the plan frame polygon on V_PLANLAYOUT
              (heuristic: largest closed polyline on that layer), then
              2) check all entities are within its bounds.
              Moderate complexity but feasible.

   1 NOW, 3 MINOR, 1 MODERATE

─── TEXT (2 rules) ────────────────────────────────────────────────────────────

✅ TEXT_001  Text on wrong layer
            → Filter renderList for t==='text', check .l against allowed
              set: {V_PLANLAYOUT, V_ACHSEN, V_TEXT, R_AOID}.
              Note: texts inside blocks (A_ARCHITEKTUR etc.) are expanded
              onto their block's layer — may need to exclude block content
              or limit check to top-level text entities.

🔨 TEXT_002  Font not ARIAL
            → Text style/font name is NOT in renderList. The DWG STYLE
              table (db.tables.STYLE) contains font definitions, and TEXT
              entities reference a style name. Enhancement: 1) read STYLE
              table entries, 2) map style → font, 3) carry font name into
              renderList or check during parsing pass.

   1 NOW, 1 MODERATE

─── STYLE (2 rules) ───────────────────────────────────────────────────────────

🔧 STYLE_001  Polyline width ≠ 0
             → LWPOLYLINE has constantWidth and per-vertex startWidth/
               endWidth. Currently not extracted. Enhancement: read
               e.constantWidth (or e.width) during LWPOLYLINE processing
               and add to renderList item.

🔧 STYLE_002  Color not ByLayer
             → During getColor(), colorIndex is checked but only the
               resolved hex is stored. Enhancement: add a flag like
               `byLayer: true/false` to each renderList item based on
               whether colorIndex === 256 or 0.

   0 NOW, 2 MINOR

─── LAYOUT (2 rules) ──────────────────────────────────────────────────────────

🔧 LAYOUT_001  Paper Space layout present
              → DWG has LAYOUT table entries and entities carry a
                paperSpace flag (or ownerHandle pointing to *Paper_Space).
                Enhancement: check db.tables.LAYOUT or the raw entity's
                space flag during parsing. Alternatively check if any
                LAYOUT table entry besides "Model" exists.

🔨 LAYOUT_002  No plan frame on V_PLANLAYOUT
              → Need to detect a rectangular frame on V_PLANLAYOUT.
                Heuristic: look for closed polyline or 4 lines forming
                a rectangle on that layer. Same approach as GEOM_005.

   0 NOW, 1 MINOR, 1 MODERATE

─── DIM (2 rules) ─────────────────────────────────────────────────────────────

✅ DIM_001  No dimensions on V_BEMASSUNG
           → Check if any renderList items with et==='DIMENSION' exist
             on layer V_BEMASSUNG. Already tracked.

🔨 DIM_002  Dimension not associative
           → DIMENSION entities have an associativity flag / reactor
             handles. Not currently extracted. Enhancement: read
             e.associative or check for reactors during DIMENSION
             processing.

   1 NOW, 1 MODERATE

─── HATCH (1 rule) ────────────────────────────────────────────────────────────

✅ HATCH_001  Hatch not SOLID on A_SCHRAFFUR
             → HATCH entities have patternName and isSolidFill.
               Currently accessible: renderList items with t==='hatchfill'
               on A_SCHRAFFUR. Enhancement needed: carry patternName into
               renderList. OR: check during parsing and emit error.
               Actually the current parser already knows isSolidFill
               (used to decide rendering style). Minor enhancement to
               flag non-SOLID hatches.

   1 NOW (with minor tweak to carry patternName)


════════════════════════════════════════════════════════════════════════════════
SUMMARY
════════════════════════════════════════════════════════════════════════════════

                        Total   ✅ Now   🔧 Minor   🔨 Moderate   ❌ None
  ──────────────────────────────────────────────────────────────────────────
  ABORT criteria          2       1        1           0             0
  LAYER rules             8       8        0           0             0
  POLY rules              7       7        0           0             0
  GPOLY rules             5       5        0           0             0
  AOID rules              6       6        0           0             0
  GEOM rules              5       1        3           1             0
  TEXT rules              2       1        0           1             0
  STYLE rules             2       0        2           0             0
  LAYOUT rules            2       0        1           1             0
  DIM rules               2       1        0           1             0
  HATCH rules             1       1        0           0             0
  ──────────────────────────────────────────────────────────────────────────
  TOTAL                  42      31        7           4             0

  ✅ 31 rules (74%) — implementable RIGHT NOW with current parser
  🔧  7 rules (17%) — need minor parser enhancements (1-3 lines each):
       ABORT_002, GEOM_001, GEOM_002, GEOM_004, STYLE_001, STYLE_002, LAYOUT_001
  🔨  4 rules  (9%) — need moderate parser enhancements (new table reads):
       GEOM_005, TEXT_002, LAYOUT_002, DIM_002
  ❌  0 rules  (0%) — nothing is blocked by browser-only architecture

  ALL 42 RULES ARE FEASIBLE IN PURE JS/TS WITHOUT A BACKEND.

Parser enhancement roadmap (priority order):
  1. Add colorIndex/byLayer flag to renderList items         → unlocks STYLE_002
  2. Add constantWidth to polyline items                     → unlocks STYLE_001
  3. Read $INSUNITS from db.header                           → unlocks GEOM_001, ABORT_002
  4. Check Z-coordinates before 2D projection                → unlocks GEOM_002
  5. Check XREF flag on block definitions                    → unlocks GEOM_004
  6. Read LAYOUT table for paper space detection             → unlocks LAYOUT_001
  7. Read STYLE table for font names                         → unlocks TEXT_002
  8. Detect plan frame rectangle on V_PLANLAYOUT             → unlocks GEOM_005, LAYOUT_002
  9. Read DIMENSION associativity flag                       → unlocks DIM_002

================================================================================
-->
