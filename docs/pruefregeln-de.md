# Prüfregeln — CAD-Richtlinie BBL V1.0

> Referenzdokument: *CAD-Richtlinie BBL-DE, Version 1.0, Stand 01.01.2026*

## Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Prüfkategorien](#prüfkategorien)
3. [Regeln — Layerstruktur (LAYER)](#regeln--layerstruktur-layer)
4. [Regeln — Raumpolygone (POLY)](#regeln--raumpolygone-poly)
5. [Regeln — Geschosspolygone (GPOLY)](#regeln--geschosspolygone-gpoly)
6. [Regeln — AOID / Raumstempel (AOID)](#regeln--aoid--raumstempel-aoid)
7. [Regeln — Geometrie allgemein (GEOM)](#regeln--geometrie-allgemein-geom)
8. [Regeln — Textelemente (TEXT)](#regeln--textelemente-text)
9. [Regeln — Linientypen und Farben (STYLE)](#regeln--linientypen-und-farben-style)
10. [Regeln — Planlayout (LAYOUT)](#regeln--planlayout-layout)
11. [Regeln — Masselemente (DIM)](#regeln--masselemente-dim)
12. [Regeln — Schraffurelemente (HATCH)](#regeln--schraffurelemente-hatch)
13. [Score-Berechnung](#score-berechnung)
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
- **Bemassungen** — Massobjekte auf `V_BEMASSUNG` vorhanden
- **Schraffurelemente** — SOLID-Schraffuren auf korrektem Layer

Alle Regeln werden immer vollständig ausgeführt. Es gibt keine Abbruchkriterien — auch bei fehlender Layerstruktur wird der Viewer angezeigt und die Befunde werden aufgelistet.

---

## Prüfkategorien

| Präfix | Kategorie | Anzahl | Beschreibung |
|--------|-----------|--------|--------------|
| `LAYER` | Layerstruktur | 8 | Prüfung der zulässigen Layer und Elementzuordnung |
| `POLY` | Raumpolygone | 8 | Prüfung der NGF-Raumpolygone |
| `GPOLY` | Geschosspolygone | 5 | Prüfung der Geschossflächenpolygone |
| `AOID` | Raumstempel | 6 | Prüfung der AOID-Textelemente |
| `GEOM` | Geometrie | 5 | Allgemeine geometrische Prüfungen |
| `TEXT` | Textelemente | 2 | Prüfung von Texten und Schriftarten |
| `STYLE` | Linientypen/Farben | 2 | Prüfung der grafischen Eigenschaften |
| `LAYOUT` | Planlayout | 2 | Prüfung Modellbereich und Layout-Tabs |
| `DIM` | Bemassungen | 1 | Prüfung der Bemassungsobjekte |
| `HATCH` | Schraffurelemente | 1 | Prüfung der Schraffuren |
| | **Total** | **40** | |

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
| `POLY_008` | Warnung | Kein Raumpolygon auf `R_RAUMPOLYGON` vorhanden | Kap. 5.8 |

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
| `DIM_001` | Warnung | Keine Bemassungen auf `V_BEMASSUNG` vorhanden | Kap. 5.6 |

Die Assoziativität von Bemassungen (ehemals `DIM_002`) wird vom Browser-Parser nicht ausgelesen und daher nicht geprüft.

---

## Regeln — Schraffurelemente (HATCH)

Referenz: Richtlinie Kap. 5.7

| Code | Schweregrad | Beschreibung | Referenz |
|------|------------|--------------|----------|
| `HATCH_001` | Warnung | Schraffur auf `A_SCHRAFFUR` ist nicht vom Typ SOLID | Kap. 5.7 |

---

## Score-Berechnung

Der aktuelle Score basiert auf der Anzahl bestandener Regelcodes:

```
Score = (bestandene Regeln / 40) × 100%
```

Eine Regel gilt als «bestanden», wenn kein Befund mit diesem Regelcode erzeugt wurde. Jede Regel zählt gleich (1/40).

### Bekannte Einschränkungen

Die aktuelle Methode hat folgende Schwächen, die in einer zukünftigen Version adressiert werden:

1. **Gleiche Gewichtung** — Strukturelle Regeln (fehlende Pflicht-Layer, keine Räume) zählen gleich viel wie kosmetische Regeln (Schriftart, Polylinienbreite). Ein Plan ohne jegliche CAFM-Layer kann trotzdem 80% erreichen.

2. **Keine Mengenberücksichtigung** — Ob AOID_001 für 1 oder 30 Räume auslöst, es zählt als 1 fehlgeschlagene Regel. Die Schwere des Problems wird nicht abgebildet.

3. **Keine Severity-Gewichtung** — Fehler und Warnungen haben den gleichen Einfluss auf den Score.

### Mögliche Verbesserungen (zur Diskussion)

**Option A — Gewichtete Kategorien:**
Strukturelle Regeln (LAYER, POLY, AOID) erhalten mehr Gewicht als kosmetische (TEXT, STYLE, DIM).

**Option B — Instanzbasiert:**
Score pro Raum berechnen (z.B. 25/30 Räume fehlerfrei = 83%). Kombiniert mit einem strukturellen Checklisten-Score.

**Option C — Severity-gewichtet:**
Fehler zählen doppelt oder dreifach gegenüber Warnungen.

**Option D — Gate + Score:**
Bestimmte Regeln (LAYER_001–003) fungieren als «Gate»: wenn alle drei Pflicht-Layer fehlen, wird der Score auf max. 25% begrenzt, unabhängig davon, wie viele andere Regeln bestanden werden. Der restliche Score wird normal berechnet.

---

## Schweregrade

| Schweregrad | Symbol | Beschreibung |
|-------------|--------|--------------|
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
