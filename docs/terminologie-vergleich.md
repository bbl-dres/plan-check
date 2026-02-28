# Terminologie-Vergleich: CAD-Richtlinie BBL vs. Codebase

Vergleich der offiziellen Terminologie aus der **CAD-Richtlinie BBL-DE V1.0** mit den im Codebase verwendeten deutschen Begriffen.

---

## 1. Flächenarten SIA 416

| Kürzel | Offizielles Dokument | Codebase | Status |
|---|---|---|---|
| GF | Geschossfläche | Geschossfläche | OK |
| NGF | Nettogeschossfläche | Nettogeschossfläche | OK |
| KF | Konstruktionsfläche | Konstruktionsfläche | OK |
| HNF | Hauptnutzfläche | Hauptnutzfläche | OK |
| NNF | Nebennutzfläche | Nebennutzfläche | OK |
| VF | Verkehrsfläche | Verkehrsfläche | OK |
| FF | Funktionsfläche | Funktionsfläche | OK |
| NF | Nutzfläche | Nutzfläche | OK |

Alle SIA-416-Flächenbezeichnungen stimmen mit dem offiziellen Dokument überein.

---

## 2. DIN-277-Kategorien

| Code | Offizielles Dokument | Codebase | Abweichung |
|---|---|---|---|
| HNF 1 | Wohnen und Aufenthalt | Wohnen und Aufenthalt | -- |
| HNF 2 | Büroarbeit | Büroarbeit | -- |
| HNF 3 | Produktion, Hand- und Maschinenarbeit, Experimente | Produktion | Gekürzt für UI |
| HNF 4 | Lagern, Verteilen **und** Verkaufen | Lagern, Verteilen**,** Verkaufen | Komma statt "und" |
| HNF 5 | Bildung, Unterricht **und** Kultur | Bildung, Unterricht**,** Kultur | Komma statt "und" |
| HNF 6 | Heilen **und** Pflegen | Heilen**,** Pflegen | Komma statt "und" |
| NNF 7 | Sonstige Nutzungen | Sonstige Nutzungen | -- |
| FF 8 | Betriebstechnische Anlagen | Betriebstechnische Anlagen | -- |
| VF 9 | Verkehrserschliessung und -sicherung | Verkehrserschliessung und -sicherung | -- |
| BUF 10 | Verschiedene Nutzungen | Verschiedene Nutzungen | -- |

HNF 4, 5, 6 verwenden Kommas statt "und" -- bewusste Kürzung für die Benutzeroberfläche.

---

## 3. CAFM-Layernamen

| Layer | Offizielle Beschreibung | Im Codebase | Status |
|---|---|---|---|
| R_RAUMPOLYGON | Raumpolygon pro Raum gem. Flächendefinition BBL | Ja | OK |
| R_AOID | Textfeld mit der eindeutigen AOID | Ja | OK |
| R_GESCHOSSPOLYGON | Geschosspolygon pro Geschoss | Ja | OK |
| A_ARCHITEKTUR | Alle architektonischen Objekte des Grundrissplanes | Ja | OK |
| A_SCHRAFFUR | Massive Wände (Solid-Schraffuren) | Ja | OK |
| V_BEMASSUNG | Hauptmasse gem. SIA 400 | Ja | OK |
| V_PLANLAYOUT | Plankopf und Planrahmen | Ja | OK |
| R_RAUMPOLYGON-ABZUG | Polygone aller relevanten Abzugsflächen | Ja | OK |
| A_ELEKTRO | Schaltschränke, Apparate | Ja | OK |
| A_HEIZUNG-KUEHLUNG | Radiatoren, Apparate | Ja | OK |
| A_LUEFTUNG | Drall-Auslässe, Apparate | Ja | OK |
| A_SANITAER | WC, Lavabo, Duschen | Ja | OK |
| V_ACHSEN | Alle relevanten Gebäudeachsen | Ja | OK |
| V_REFERENZPUNKT | Eingesetztes Referenzpunkt-Symbol | Ja | OK |
| V_TEXT | Informationen zu besserer Lesbarkeit | Ja | OK |
| R_RAUMSTEMPEL | Raumstempel für Import in SAP | Ja | OK |

Alle Layernamen stimmen exakt überein.

---

## 4. Prüfregel-Beschreibungen

| Regel | Codebase-Beschreibung | Offizielle Grundlage | Status |
|---|---|---|---|
| LAYER_001-007 | Pflicht-Layer fehlt: X | Tabelle 4: CAFM-Pflichtlayer | OK |
| LAYER_008 | Unbekannter Layer vorhanden | Kap. 5.2: Nur gelistete Layer erlaubt | OK |
| POLY_001 | Raumpolygon ist nicht geschlossen | Kap. 5.8: "geschlossene Polylinien" | OK |
| POLY_002 | Raumpolygon enthält Bogensegmente | Kap. 5.8: "keine Bogensegmente" | OK |
| POLY_006 | Element auf R_RAUMPOLYGON ist keine LWPOLYLINE | Kap. 5.8: LWPOLYLINE erforderlich | OK |
| POLY_007 | Raumpolygon hat Selbstüberschneidung | Implizit in Polygon-Anforderungen | OK |
| GPOLY_001-003 | Geschosspolygon-Prüfungen | Kap. 5.9 Anforderungen | OK |
| AOID_001-006 | AOID-Format/Vorhandensein | Kap. 5.10 / 2.5: AOID-Regeln | OK |
| AOID_003 | AOID-Format ungültig (erwartet: WWWW.GG.EE.RRR) | Kap. 2.5: WE.GE.Ebene.Raumidentifikation | OK (vereinfacht) |
| GEOM_001 | Zeichnungseinheit ist nicht Millimeter | Kap. 4.1: "Zeichnungseinheit" | OK |
| GEOM_002 | Element hat Z-Koordinate != 0 | Allgemeine 2D-Anforderung | OK |
| TEXT_002 | Schriftart ist nicht ARIAL | Kap. 5.5: "Schriftart ARIAL" | OK |
| STYLE_001 | Polylinienbreite ist nicht 0 mm | Kap. 5.4: "Polylinienbreite = 0" | OK |
| STYLE_002 | Farbe ist nicht VONLAYER | Kap. 5.4: "VONLAYER" | OK |
| LAYOUT_001 | Layout-Tab (Paper Space) vorhanden | Kap. 5.3: Nur "Modellbereich" | OK |
| DIM_001-002 | Masselemente-Prüfungen | Kap. 5.6: "Masselemente" | OK |
| HATCH_001 | Schraffur auf A_SCHRAFFUR ist nicht SOLID | Kap. 5.7: "Vollflächenfüllung (SOLID)" | OK |

Alle Prüfregel-Beschreibungen sind korrekt an die offiziellen Anforderungen angelehnt.

---

## 5. Regelkategorie-Labels

| Kategorie | Codebase-Label | Offizielle Kapitelüberschrift | Abweichung |
|---|---|---|---|
| LAYER | Layerstruktur | Kap. 5.2 "Layerstruktur CAFM-Plan" | -- |
| POLY | Raumpolygone | Kap. 5.8 "Raumpolygone NGF" | -- |
| GPOLY | Geschosspolygone | Kap. 5.9 "Geschosspolygone GF" | -- |
| AOID | Raumstempel | Kap. 5.10 "Raumstempel" | -- |
| GEOM | Geometrie | Allgemeiner Begriff | -- |
| TEXT | Textelemente | Kap. 5.5 "Textelemente" | -- |
| STYLE | Linientypen/Farben | Kap. 5.4 "Linientypen und Farben" | Schrägstrich statt "und" |
| LAYOUT | Planlayout | Kap. 5.3 "Planlayout" | -- |
| DIM | Masselemente | Kap. 5.6 "Masselemente" | -- |
| HATCH | Schraffuren | Kap. 5.7 "Schraffurelemente" | Gekürzt |

---

## 6. Organisationsbezeichnungen

| Begriff | Offizielles Dokument | Codebase | Status |
|---|---|---|---|
| BBL | Bundesamt für Bauten und Logistik (BBL) | Bundesamt für Bauten und Logistik BBL | OK |
| Eidgenossenschaft | Schweizerische Eidgenossenschaft | Schweizerische Eidgenossenschaft | OK |
| DRES | Digital Real Estate und Support (DRES) | Nicht verwendet | Nicht nötig in App |

---

## 7. Technische Fachbegriffe

| Offizieller Begriff | Verwendung im Dokument | Codebase-Verwendung | Status |
|---|---|---|---|
| Planprüfung | Kap. 3 | "Prüfplattform" (App-Name) | Angemessen |
| Abzugsfläche | Abzugsflächen innerhalb NGF-Polygone | Nicht in UI exponiert | OK |
| Raumtabelle | Tabelle der Raumdaten | Nicht verwendet | OK |
| CAFM-Plan | Offizieller Plantyp | In Footer/Docs verwendet | OK |
| QualityGate | Offizielles Prüftool (Fa. Cadmec) | Nicht verwendet | Andere Software |

---

## 8. Offizielle Begriffe nicht im Codebase (potenziell relevant)

| Offizieller Begriff | Kapitel | Mögliche Verwendung |
|---|---|---|
| VNF (Vermietbare Nutzfläche) | Kostenmodell-Kategorien | Kennzahl |
| ZF (Zuschlagsfläche) | Kostenmodell-Kategorien | Kennzahl |
| RF (Restfläche) | Kostenmodell-Kategorien | Kennzahl |
| EBF (Energiebezugsfläche) | Energie-Referenzfläche | Kennzahl |
| Bodenbelastung | Kap. 2.6 | Validierung |
| Türschildbeschriftung | CAD.A01 Raumtabelle | Raumdaten-Extraktion |
| Bodenbelag | CAD.A01 Raumtabelle | Raumdaten-Extraktion |
| Fenster-/Glasflächen | Kap. 7.1 | Raumdaten-Extraktion |

---

## Zusammenfassung

| Bereich | Ergebnis |
|---|---|
| SIA-416-Flächenarten | Alle korrekt |
| DIN-277-Kategorien | 3 minimale Abweichungen (Komma statt "und") |
| CAFM-Layernamen | Alle korrekt |
| Prüfregel-Beschreibungen | Alle korrekt an Richtlinie angelehnt |
| Regelkategorie-Labels | 1 minimale Abweichung ("Schraffuren" vs "Schraffurelemente") |
| Organisationsbezeichnungen | Korrekt |
| Technisches Vokabular | Konsistent mit offiziellem Dokument |

**Gesamtbewertung**: Die Terminologie im Codebase ist sehr gut an die offizielle CAD-Richtlinie BBL-DE angelehnt. Die wenigen Abweichungen sind bewusste Kürzungen für die Benutzeroberfläche und keine inhaltlichen Fehler.

---

*Erstellt: 2026-02-28 -- Vergleich basierend auf CAD-Richtlinie BBL-DE V1.0 (211.4-1-38-4-3)*
