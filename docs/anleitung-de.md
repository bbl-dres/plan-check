# Anleitung und FAQ — Prüfplattform Flächenmanagement

## Inhaltsverzeichnis

1. [Überblick](#überblick)
2. [Erste Schritte](#erste-schritte)
3. [Datei hochladen](#datei-hochladen)
4. [Ergebnisübersicht](#ergebnisübersicht)
5. [Validierung](#validierung)
   - [Übersicht-Tab](#übersicht-tab)
   - [Fehlermeldungen-Tab](#fehlermeldungen-tab)
   - [Räume-Tab](#räume-tab)
   - [Flächen-Tab](#flächen-tab)
   - [Kennzahlen-Tab](#kennzahlen-tab)
6. [Grundrissplan-Viewer](#grundrissplan-viewer)
7. [Filter und Suche](#filter-und-suche)
8. [Berichte und Exporte](#berichte-und-exporte)
9. [Datei-Anforderungen](#datei-anforderungen)
10. [Validierungsregeln](#validierungsregeln)
11. [API-Zugang](#api-zugang)
12. [FAQ](#faq)

> **Hinweis:** Die vollständige Beschreibung aller Prüfregeln inkl. Referenz zur CAD-Richtlinie BBL V1.0 finden Sie unter [Prüfregeln (pruefregeln-de.md)](pruefregeln-de.md).

---

## Überblick

Die **Prüfplattform Flächenmanagement** des Bundesamts für Bauten und Logistik (BBL) ermöglicht die automatische Validierung von DWG- und DXF-Grundrissplänen. Die Plattform prüft Raumpolygone, Flächenangaben und Planstruktur gemäss den Richtlinien des BBL-Flächenmanagements.

**Wichtigste Funktionen:**

- Upload und Verarbeitung von DWG/DXF-Dateien direkt im Browser
- Automatische Erkennung von Räumen und Flächen
- Validierung nach definierten Prüfregeln
- Interaktiver Grundrissplan-Viewer mit Zoom und Selektion
- Export als PDF-Bericht, Excel-Tabelle, GeoJSON oder BCF

---

## Erste Schritte

1. Öffnen Sie die Prüfplattform in Ihrem Browser.
2. Laden Sie eine DWG- oder DXF-Datei hoch (Drag & Drop oder Datei-Auswahl).
3. Warten Sie, bis die Verarbeitung abgeschlossen ist.
4. Navigieren Sie durch die Ergebnisse über die Validierungs-Tabs.
5. Exportieren Sie bei Bedarf einen Bericht.

> **Tipp:** Wenn Sie keine Datei zur Hand haben, klicken Sie auf **«Demo-Projekt laden»**, um die Plattform mit einem Beispiel-Grundriss kennenzulernen.

---

## Datei hochladen

### Unterstützte Formate

| Format | Dateierweiterung | Beschreibung |
|--------|-----------------|--------------|
| AutoCAD Drawing | `.dwg` | Natives AutoCAD-Format (empfohlen) |
| Drawing Exchange Format | `.dxf` | Austauschformat für CAD-Daten |

### Einschränkungen

- **Maximale Dateigrösse:** 50 MB
- **Unterstützte Versionen:** AutoCAD R13 bis R2024
- Die Verarbeitung erfolgt vollständig im Browser — Ihre Dateien werden nicht auf einen Server hochgeladen.

### So laden Sie eine Datei hoch

- **Drag & Drop:** Ziehen Sie die Datei direkt auf die Upload-Fläche.
- **Datei-Auswahl:** Klicken Sie auf «Datei auswählen» und wählen Sie eine Datei aus Ihrem Dateisystem.

---

## Ergebnisübersicht

Nach der Verarbeitung erscheint die **Ergebnis-Karte** mit den wichtigsten Kennzahlen:

| Kennzahl | Beschreibung |
|----------|-------------|
| **Räume** | Anzahl der erkannten Raum-Polygone |
| **Fehler** | Anzahl der Validierungsbefunde (Fehler und Warnungen) |
| **Score** | Prozentualer Anteil der fehlerfreien Räume |
| **Bericht** | Schnellzugriff auf PDF- und Excel-Export |

Der Score wird farbig dargestellt:
- **Grün (≥ 90%):** Gute Planqualität
- **Orange (60–89%):** Verbesserungsbedarf
- **Rot (< 60%):** Erhebliche Mängel

---

## Validierung

Die Validierung ist in fünf Tabs organisiert:

### Übersicht-Tab

Zeigt eine Zusammenfassung mit:
- Anzahl Fehler, Warnungen und bestandene Prüfungen
- Aufschlüsselung nach Prüfregeln
- Gesamtbewertung

### Fehlermeldungen-Tab

Listet alle Validierungsbefunde auf:
- **Fehler** (✖) — Müssen behoben werden
- **Warnungen** (⚠) — Sollten überprüft werden

Jeder Eintrag zeigt den Regel-Code, die Beschreibung und den betroffenen Raum. Klicken Sie auf einen Eintrag, um den betroffenen Raum im Grundrissplan hervorzuheben.

### Räume-Tab

Zeigt alle erkannten Räume mit:
- Raum-ID (aus dem CAD-Plan)
- Textbezeichnung (falls vorhanden)
- Fläche in m²
- Status (OK, Warnung, Fehler)

Klicken Sie auf einen Raum, um ihn im Grundrissplan-Viewer zu markieren und hinzuzoomen.

### Flächen-Tab

Zeigt erkannte Flächenpolygone auf Layern wie BGF, EBF und GF mit:
- Layer-Name
- Fläche in m²
- Polygon-Eigenschaften

### Kennzahlen-Tab

Zeigt die berechneten Flächenkennzahlen gemäss SIA-Normen:
- **HNF** — Hauptnutzfläche
- **NNF** — Nebennutzfläche
- **VF** — Verkehrsfläche
- **FF** — Funktionsfläche
- **KF** — Konstruktionsfläche
- **BGF** — Bruttogeschossfläche

Ergänzt durch Donut-Diagramme zur Flächenverteilung und Wirtschaftlichkeitskennzahlen.

---

## Grundrissplan-Viewer

Der integrierte Viewer zeigt den Grundrissplan mit farblich hervorgehobenen Räumen und Fehlern.

### Navigation

| Aktion | Maus | Touch |
|--------|------|-------|
| **Verschieben** | Klicken und ziehen | Ein Finger ziehen |
| **Zoomen** | Mausrad | Zwei-Finger-Pinch |
| **Element auswählen** | Klicken | Antippen |

### Werkzeugleiste

| Symbol | Funktion |
|--------|----------|
| ☀ | Hintergrund umschalten (hell/dunkel) |
| 🔍+ | Hineinzoomen |
| 🔍− | Herauszoomen |
| ⛶ | Zoom auf Gesamtansicht |
| ⛶ | Vollbildmodus |
| ⋮ | Export-Menü (PDF, Excel, GeoJSON, BCF) |

### Raumauswahl

- Im **Räume-** oder **Flächen-Tab**: Klicken Sie im Viewer auf einen Raum, um ihn auszuwählen. Der entsprechende Eintrag in der Seitenliste wird markiert.
- Klicken Sie auf einen Eintrag in der Seitenliste, um den Raum im Viewer hervorzuheben und hinzuzoomen.

---

## Filter und Suche

### Suchfeld

Geben Sie im Suchfeld über der Seitenliste Text ein, um Einträge nach Name, Raum-ID oder Regel-Code zu filtern.

### «Nur Fehler»-Filter

Klicken Sie auf den Button **«Nur Fehler»** in der Tab-Leiste, um ausschliesslich fehlerhafte Einträge anzuzeigen (keine Warnungen, keine bestandenen Prüfungen). Die Zähler in den Tab-Bezeichnungen werden entsprechend aktualisiert.

### Sichtbarkeit

Über die Checkboxen in der Seitenliste können Sie einzelne Räume oder Fehler ein-/ausblenden. Die Checkbox «Alle» oben links steuert die Gesamtsichtbarkeit.

---

## Berichte und Exporte

Über das Kebab-Menü (⋮) oder die Ergebnis-Karte stehen folgende Exporte zur Verfügung:

| Format | Beschreibung | Verwendung |
|--------|-------------|------------|
| **PDF-Bericht** | Vollständiger Prüfbericht mit Deckblatt, Kennzahlen, Raumliste und Fehlertabelle | Dokumentation, Abnahme |
| **Excel-Bericht** | Raumliste und Fehlertabelle als XLSX | Weiterverarbeitung, Datenanalyse |
| **GeoJSON** | Raum-Geometrien als GeoJSON-Feature-Collection | GIS-Integration, Kartierung |
| **BCF** | BIM Collaboration Format mit Fehler-Topics | BIM-Koordination, Issue-Tracking |

---

## Datei-Anforderungen

### Layerstruktur gemäss CAD-Richtlinie BBL V1.0

Die Plattform prüft CAFM-Pläne anhand der in der **CAD-Richtlinie BBL V1.0** (Kap. 5.2) definierten Layerstruktur. Der Plan darf ausschliesslich die nachfolgenden Layer enthalten:

| Layer | Beschreibung | Inhalt |
|-------|-------------|--------|
| `R_RAUMPOLYGON` | Raumpolygone (NGF) | Geschlossene LWPOLYLINE pro Raum |
| `R_RAUMPOLYGON-ABZUG` | Abzugsflächenpolygone | Stützen, Kernzonen etc. innerhalb eines NGF-Polygons |
| `R_GESCHOSSPOLYGON` | Geschosspolygone (GF) | Geschlossene LWPOLYLINE pro Geschoss |
| `R_AOID` | AOID-Textfelder | TEXT mit eindeutiger Raum-ID innerhalb des Polygons |
| `A_ARCHITEKTUR` | Architekturobjekte | Wände, Türen, Fenster, Treppen, Einbauten |
| `A_SCHRAFFUR` | Schraffuren | SOLID-Schraffuren für massive Wände |
| `A_ELEKTRO` | Elektroinstallationen | Schaltschränke, Apparate |
| `A_HEIZUNG-KUEHLUNG` | Heizung/Kühlung | Radiatoren, Apparate |
| `A_LUEFTUNG` | Lüftung | Drallauslässe, Apparate |
| `A_SANITAER` | Sanitäranlagen | WC, Lavabo, Duschen |
| `V_ACHSEN` | Gebäudeachsen | Achsenlinien und -texte |
| `V_BEMASSUNG` | Hauptmasse | Massobjekte gem. SIA400 |
| `V_PLANLAYOUT` | Plankopf/Planrahmen | Planrahmen und Plankopf im Modellbereich |
| `V_REFERENZPUNKT` | Referenzpunkte | Referenzpunkt-Symbol |
| `V_TEXT` | Informationstexte | Ergänzende Planbeschriftung |

> Detaillierte Farbzuordnungen und RGB-Werte siehe [Prüfregeln — Layerreferenz](pruefregeln-de.md#layerstruktur-cafm-plan--referenz).

### Empfohlene Planstruktur

| Element | Layer | Typ |
|---------|-------|-----|
| Raumpolygone | `R_RAUMPOLYGON` | Geschlossene LWPOLYLINE (ohne Bogensegmente) |
| Abzugsflächen | `R_RAUMPOLYGON-ABZUG` | Geschlossene LWPOLYLINE |
| Geschosspolygon | `R_GESCHOSSPOLYGON` | Geschlossene LWPOLYLINE |
| Raumstempel (AOID) | `R_AOID` | TEXT innerhalb des Polygons |
| Architektur | `A_ARCHITEKTUR` | Linien, Kreise, Texte (keine MULTILINE, ELLIPSE, SPLINE, OLE) |
| Schraffuren | `A_SCHRAFFUR` | SOLID-Schraffuren |
| Bemassungen | `V_BEMASSUNG` | Assoziative Massobjekte |
| Planrahmen/Plankopf | `V_PLANLAYOUT` | Im Modellbereich (keine Layouts erlaubt) |

### Musterdatei

Zum Kennenlernen der Plattform und der korrekten Planstruktur steht der offizielle BBL-Musterplan zur Verfügung:

- **`CAD.V01-CAFM-Plan-DE.dwg`** — CAFM-Musterplan mit korrekter Layerstruktur, Beispielräumen und AOID-Nummern (Anhang CAD.V01 der CAD-Richtlinie).

Laden Sie die Datei über **«Demo-Projekt laden»** oder verwenden Sie die Datei direkt aus dem Verzeichnis `assets/test-files/`.

### Häufige Planfehler

- **Nicht geschlossene Polygone:** Raumpolygone müssen geschlossen sein (Start- und Endpunkt identisch).
- **Bogensegmente:** In Raum- und Geschosspolygonen sind Bogensegmente (bulge) nicht zulässig.
- **Fehlende AOID:** Jeder Raum muss ein TEXT-Element mit der AOID auf Layer `R_AOID` innerhalb des Polygons enthalten.
- **Falscher Layer:** Raumpolygone müssen auf `R_RAUMPOLYGON` liegen, Geschosspolygone auf `R_GESCHOSSPOLYGON`.
- **Sehr kleine Flächen:** Räume unter 0.25 m² werden als Warnung gemeldet.
- **Unzulässige Entitätstypen:** MULTILINE, ELLIPSE, SPLINE und OLE sind nicht erlaubt.
- **Layouts:** Paper-Space-Layouts sind nicht erlaubt; Planrahmen und Plankopf im Modellbereich platzieren.
- **Farbe nicht VONLAYER:** Alle Elementfarben müssen auf VONLAYER (ByLayer) stehen.
- **Doppelte Polygone:** Identische Raumpolygone müssen gelöscht werden.

---

## Validierungsregeln

Die Prüfregeln basieren auf der **CAD-Richtlinie BBL V1.0** (Stand 01.01.2026). Die vollständige Regelbeschreibung mit Referenzen zur Richtlinie finden Sie unter **[Prüfregeln (pruefregeln-de.md)](pruefregeln-de.md)**.

### Übersicht Prüfkategorien

| Präfix | Kategorie | Anzahl Regeln |
|--------|-----------|---------------|
| `LAYER` | Layerstruktur | 8 |
| `POLY` | Raumpolygone | 7 |
| `GPOLY` | Geschosspolygone | 5 |
| `AOID` | Raumstempel / AOID | 6 |
| `GEOM` | Geometrie allgemein | 5 |
| `TEXT` | Textelemente | 2 |
| `STYLE` | Linientypen und Farben | 2 |
| `LAYOUT` | Planlayout | 2 |
| `DIM` | Masselemente | 2 |
| `HATCH` | Schraffurelemente | 1 |

### Wichtigste Regeln (Auszug)

| Code | Schweregrad | Beschreibung |
|------|------------|--------------|
| `LAYER_001` | Fehler | Pflicht-Layer `R_RAUMPOLYGON` fehlt |
| `LAYER_002` | Fehler | Pflicht-Layer `R_AOID` fehlt |
| `LAYER_003` | Fehler | Pflicht-Layer `R_GESCHOSSPOLYGON` fehlt |
| `POLY_001` | Fehler | Raumpolygon ist nicht geschlossen |
| `POLY_002` | Fehler | Raumpolygon enthält Bogensegmente |
| `POLY_004` | Warnung | Raumfläche < 0.25 m² |
| `AOID_001` | Fehler | Raumpolygon hat keine AOID |
| `AOID_002` | Fehler | AOID ist nicht eindeutig |
| `GEOM_003` | Fehler | Unzulässiger Entitätstyp (MULTILINE, ELLIPSE, SPLINE, OLE) |

---

## API-Zugang

Für die automatisierte Batch-Verarbeitung steht eine REST-API zur Verfügung. Die API-Dokumentation finden Sie über den Link **«API»** in der Fusszeile der Plattform.

**Funktionen der API:**
- Einzeldatei- und Batch-Validierung
- Asynchrone Verarbeitung mit Job-Status-Abfrage
- Export-Erstellung (PDF, Excel, GeoJSON, BCF)
- Abruf des Regelkatalogs

Die API erfordert einen API-Schlüssel (`X-API-Key`), der über das BBL-Portal beantragt werden kann.

---

## FAQ

### Werden meine Dateien auf einen Server hochgeladen?

Nein. Die gesamte Verarbeitung findet lokal in Ihrem Browser statt. Ihre DWG/DXF-Dateien verlassen Ihr Gerät nicht.

### Welche AutoCAD-Versionen werden unterstützt?

DWG-Dateien von AutoCAD R13 bis R2024 werden unterstützt. Ältere Versionen können möglicherweise nicht korrekt gelesen werden.

### Warum werden keine Räume erkannt?

- Stellen Sie sicher, dass die Raumpolygone auf dem Layer **`R_RAUMPOLYGON`** liegen (gemäss CAD-Richtlinie BBL V1.0).
- Prüfen Sie, ob die Polylinien **geschlossen** sind (Closed-Flag gesetzt).
- Überprüfen Sie, ob die Polylinien vom Typ **LWPOLYLINE** sind.
- Stellen Sie sicher, dass die Polylinien **keine Bogensegmente** (bulge) enthalten.

### Warum fehlen AOID-Nummern?

Die Plattform sucht nach TEXT-Entitäten auf dem Layer **`R_AOID`**, deren Basispunkt geometrisch **innerhalb** des Raumpolygons liegt. Prüfen Sie:
- Liegt der Text auf dem korrekten Layer `R_AOID`?
- Liegt der Einfügepunkt des Textes innerhalb des Polygons?
- Entspricht die AOID dem Format `WWWW.GG.EE.RRR` (z.B. `2011.DM.04.045`)?

### Kann ich eigene Validierungsregeln definieren?

In der aktuellen Version ist der Regelsatz gemäss CAD-Richtlinie BBL V1.0 vordefiniert (40 Prüfregeln in 10 Kategorien). Über die API können zukünftig Regeln selektiv aktiviert oder deaktiviert werden. Die vollständige Regelbeschreibung finden Sie unter [Prüfregeln](pruefregeln-de.md).

### Gibt es eine Musterdatei zum Testen?

Ja. Der offizielle BBL-Musterplan **`CAD.V01-CAFM-Plan-DE.dwg`** steht über «Demo-Projekt laden» zur Verfügung. Diese Datei enthält die korrekte Layerstruktur und Beispielräume mit AOID-Nummern gemäss CAD-Richtlinie BBL V1.0.

### Wie wird der Score berechnet?

Der Score entspricht dem Anteil der Räume ohne Fehler oder Warnungen an der Gesamtzahl der erkannten Räume: `Score = (Räume mit Status «OK» / Gesamtanzahl Räume) × 100%`.

### Welchen Browser soll ich verwenden?

Die Plattform funktioniert in allen modernen Browsern: Chrome, Firefox, Edge und Safari. Für die beste Leistung empfehlen wir Chrome oder Edge.

### An wen kann ich mich bei Fragen wenden?

Kontaktieren Sie das BBL über die [Kontaktseite](https://www.bbl.admin.ch/de/kontakt) oder nutzen Sie den Link «Kontakt» in der Kopfzeile der Plattform.
