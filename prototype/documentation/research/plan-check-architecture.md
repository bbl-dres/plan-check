# plan-check Technical Architecture

## LibreDWG + Python Implementation Path

### Executive Summary

This document outlines a practical implementation strategy for the BBL floor plan validation tool using **LibreDWG** (true open source, GPL v3) combined with a Python validation engine. This approach enables:

- Full DWG read support (99% coverage, r1.2-r2018)
- No licensing costs
- Shareable with other Bundesorgane (Variant G potential)
- Modern Python ecosystem for validation logic
- Static SVG output for error visualization

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         plan-check System                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │  Web UI  │───▶│   FastAPI    │───▶│    Validation Engine     │  │
│  │ (Upload) │    │   Backend    │    │        (Python)          │  │
│  └──────────┘    └──────────────┘    └──────────────────────────┘  │
│                         │                        │                  │
│                         ▼                        ▼                  │
│                  ┌─────────────┐         ┌─────────────────┐       │
│                  │   LibreDWG  │         │  Excel Parser   │       │
│                  │   (CLI)     │         │  (openpyxl)     │       │
│                  └─────────────┘         └─────────────────┘       │
│                         │                        │                  │
│                         ▼                        ▼                  │
│                  ┌─────────────┐         ┌─────────────────┐       │
│                  │    JSON     │         │   Room Table    │       │
│                  │   Output    │         │     Data        │       │
│                  └─────────────┘         └─────────────────┘       │
│                         │                        │                  │
│                         └────────────┬───────────┘                  │
│                                      ▼                              │
│                           ┌──────────────────┐                      │
│                           │   Rule Engine    │                      │
│                           │   (14 Layers,    │                      │
│                           │   Geometry, etc) │                      │
│                           └──────────────────┘                      │
│                                      │                              │
│                         ┌────────────┼────────────┐                 │
│                         ▼            ▼            ▼                 │
│                  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│                  │   JSON   │ │   PDF    │ │   SVG    │            │
│                  │  Report  │ │  Report  │ │  Visual  │            │
│                  └──────────┘ └──────────┘ └──────────┘            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. LibreDWG CLI Layer

LibreDWG provides command-line tools that output structured data:

```bash
# Convert DWG to JSON (full structure)
dwgread -O JSON input.dwg -o output.json

# List layers only
dwglayers input.dwg

# Convert to SVG (basic visualization)
dwg2SVG input.dwg > output.svg

# Search for text patterns
dwggrep "pattern" input.dwg
```

**Key advantage:** The JSON output contains ALL entity data in a structured format that Python can easily parse.

### 2. LibreDWG JSON Output Structure

Based on LibreDWG documentation, the JSON output follows this structure:

```json
{
  "header": {
    "version": "AC1027",
    "codepage": 30,
    "entities_start": 1234,
    "entities_end": 5678
    // ... header variables
  },
  "classes": [...],
  "tables": {
    "LAYER": [
      {
        "type": "LAYER",
        "name": "R_RAUMPOLYGON",
        "color": 3,
        "flag": 0,
        "plotflag": true,
        "lineweight": 0,
        "plotstyle_name": "ByLayer"
      }
    ],
    "LTYPE": [...],
    "STYLE": [...],
    "DIMSTYLE": [...],
    "VPORT": [...]
  },
  "blocks": {
    "*Model_Space": {
      "entities": [
        {
          "type": "LWPOLYLINE",
          "handle": "1A3",
          "layer": "R_RAUMPOLYGON",
          "color": 256,  // BYLAYER
          "ltype": "ByLayer",
          "num_points": 5,
          "flag": 1,  // closed
          "points": [
            {"x": 0.0, "y": 0.0, "z": 0.0},
            {"x": 1000.0, "y": 0.0, "z": 0.0},
            {"x": 1000.0, "y": 1000.0, "z": 0.0},
            {"x": 0.0, "y": 1000.0, "z": 0.0},
            {"x": 0.0, "y": 0.0, "z": 0.0}
          ],
          "const_width": 0.0
        },
        {
          "type": "TEXT",
          "handle": "1A4",
          "layer": "R_AOID",
          "insertion_point": {"x": 500.0, "y": 500.0, "z": 0.0},
          "height": 100.0,
          "text_value": "2011.DM.04.045",
          "style": "Arial",
          "rotation": 0.0
        }
      ]
    }
  },
  "objects": [...]
}
```

---

## BBL Validation Rules → Implementation Mapping

### Layer Validation (14 Prescribed Layers)

| Layer Name | Required Color (Index) | RGB Equivalent | Check |
|------------|------------------------|----------------|-------|
| A_ARCHITEKTUR | 253 | 137,137,137 | ✅ Easy |
| A_ELEKTRO | 253 | 137,137,137 | ✅ Easy |
| A_HEIZUNG-KUEHLUNG | 253 | 137,137,137 | ✅ Easy |
| A_LUEFTUNG | 253 | 137,137,137 | ✅ Easy |
| A_SANITAER | 253 | 137,137,137 | ✅ Easy |
| A_SCHRAFFUR | 253 | 137,137,137 | ✅ Easy |
| V_ACHSEN | 8 | 128,128,128 | ✅ Easy |
| V_BEMASSUNG | 40 | 255,127,0 | ✅ Easy |
| V_PLANLAYOUT | 7 | 255,255,255 | ✅ Easy |
| V_REFERENZPUNKT | 1 | 255,0,0 | ✅ Easy |
| V_TEXT | 7 | 255,255,255 | ✅ Easy |
| R_AOID | 30 | 255,127,0 | ✅ Easy |
| R_RAUMPOLYGON | 3 | 0,255,0 | ✅ Easy |
| R_RAUMPOLYGON-ABZUG | 1 | 255,0,0 | ✅ Easy |
| R_GESCHOSSPOLYGON | 4 | 0,255,255 | ✅ Easy |

```python
# Layer validation implementation
REQUIRED_LAYERS = {
    "A_ARCHITEKTUR": {"color": 253},
    "A_ELEKTRO": {"color": 253},
    "A_HEIZUNG-KUEHLUNG": {"color": 253},
    "A_LUEFTUNG": {"color": 253},
    "A_SANITAER": {"color": 253},
    "A_SCHRAFFUR": {"color": 253},
    "V_ACHSEN": {"color": 8},
    "V_BEMASSUNG": {"color": 40},
    "V_PLANLAYOUT": {"color": 7},
    "V_REFERENZPUNKT": {"color": 1},
    "V_TEXT": {"color": 7},
    "R_AOID": {"color": 30},
    "R_RAUMPOLYGON": {"color": 3},
    "R_RAUMPOLYGON-ABZUG": {"color": 1},
    "R_GESCHOSSPOLYGON": {"color": 4},
}

def validate_layers(dwg_json: dict) -> list[ValidationError]:
    errors = []
    layers = {l["name"]: l for l in dwg_json["tables"]["LAYER"]}
    
    # Check all required layers exist
    for name, spec in REQUIRED_LAYERS.items():
        if name not in layers:
            errors.append(ValidationError(
                code="LAYER_MISSING",
                message=f"Required layer '{name}' not found",
                severity="ERROR"
            ))
        elif layers[name]["color"] != spec["color"]:
            errors.append(ValidationError(
                code="LAYER_COLOR_WRONG",
                message=f"Layer '{name}' has color {layers[name]['color']}, expected {spec['color']}",
                severity="ERROR"
            ))
    
    # Check for extra layers
    allowed = set(REQUIRED_LAYERS.keys()) | {"0", "Defpoints"}  # System layers
    for name in layers:
        if name not in allowed:
            errors.append(ValidationError(
                code="LAYER_EXTRA",
                message=f"Unexpected layer '{name}' found",
                severity="WARNING"
            ))
    
    return errors
```

### Geometry Validation

```python
from shapely.geometry import Polygon, Point
from shapely.validation import explain_validity

def validate_geometry(dwg_json: dict) -> list[ValidationError]:
    errors = []
    room_polygons = []
    
    for entity in dwg_json["blocks"]["*Model_Space"]["entities"]:
        if entity["type"] == "LWPOLYLINE":
            # Check closure
            if entity.get("flag", 0) & 1 == 0:  # Not closed
                errors.append(ValidationError(
                    code="POLYLINE_NOT_CLOSED",
                    message=f"Polyline {entity['handle']} on layer {entity['layer']} is not closed",
                    severity="ERROR",
                    location=entity["points"][0]
                ))
            
            # Check Z-coordinates
            for pt in entity["points"]:
                if pt.get("z", 0) != 0:
                    errors.append(ValidationError(
                        code="Z_NOT_ZERO",
                        message=f"Polyline {entity['handle']} has non-zero Z coordinate",
                        severity="ERROR",
                        location=pt
                    ))
            
            # Check polyline width
            if entity.get("const_width", 0) != 0:
                errors.append(ValidationError(
                    code="POLYLINE_WIDTH_NOT_ZERO",
                    message=f"Polyline {entity['handle']} has width {entity['const_width']}, expected 0",
                    severity="ERROR"
                ))
            
            # Build Shapely polygon for further checks
            if entity["layer"] == "R_RAUMPOLYGON":
                coords = [(p["x"], p["y"]) for p in entity["points"]]
                poly = Polygon(coords)
                
                # Check minimum area (0.25 m²)
                area_m2 = poly.area / 1_000_000  # mm² to m²
                if area_m2 < 0.25:
                    errors.append(ValidationError(
                        code="ROOM_TOO_SMALL",
                        message=f"Room polygon {entity['handle']} area is {area_m2:.3f} m², minimum is 0.25 m²",
                        severity="ERROR"
                    ))
                
                # Check validity
                if not poly.is_valid:
                    errors.append(ValidationError(
                        code="POLYGON_INVALID",
                        message=f"Room polygon {entity['handle']} is invalid: {explain_validity(poly)}",
                        severity="ERROR"
                    ))
                
                room_polygons.append((entity["handle"], poly))
    
    # Check for overlapping room polygons
    for i, (h1, p1) in enumerate(room_polygons):
        for h2, p2 in room_polygons[i+1:]:
            if p1.overlaps(p2):
                errors.append(ValidationError(
                    code="ROOMS_OVERLAP",
                    message=f"Room polygons {h1} and {h2} overlap",
                    severity="ERROR"
                ))
    
    return errors
```

### AOID Validation

```python
import re

AOID_PATTERN = re.compile(r"^\d{4}\.[A-Z]{2}\.\d{2}\.\d{3}$")  # e.g., 2011.DM.04.045

def validate_aoids(dwg_json: dict, excel_rooms: dict) -> list[ValidationError]:
    errors = []
    text_entities = []
    room_polygons = []
    
    # Collect TEXT/MTEXT on R_AOID layer
    for entity in dwg_json["blocks"]["*Model_Space"]["entities"]:
        if entity["type"] in ("TEXT", "MTEXT") and entity["layer"] == "R_AOID":
            text_entities.append({
                "handle": entity["handle"],
                "value": entity.get("text_value", ""),
                "point": Point(entity["insertion_point"]["x"], entity["insertion_point"]["y"])
            })
        elif entity["type"] == "LWPOLYLINE" and entity["layer"] == "R_RAUMPOLYGON":
            coords = [(p["x"], p["y"]) for p in entity["points"]]
            room_polygons.append({
                "handle": entity["handle"],
                "polygon": Polygon(coords)
            })
    
    # Validate AOID format
    found_aoids = set()
    for text in text_entities:
        aoid = text["value"].strip()
        
        if not AOID_PATTERN.match(aoid):
            errors.append(ValidationError(
                code="AOID_FORMAT_INVALID",
                message=f"AOID '{aoid}' does not match expected format (e.g., 2011.DM.04.045)",
                severity="ERROR",
                location={"x": text["point"].x, "y": text["point"].y}
            ))
            continue
        
        # Check uniqueness
        if aoid in found_aoids:
            errors.append(ValidationError(
                code="AOID_DUPLICATE",
                message=f"AOID '{aoid}' appears multiple times",
                severity="ERROR"
            ))
        found_aoids.add(aoid)
        
        # Check AOID text is inside a room polygon
        inside_any = False
        for room in room_polygons:
            if room["polygon"].contains(text["point"]):
                inside_any = True
                break
        
        if not inside_any:
            errors.append(ValidationError(
                code="AOID_OUTSIDE_ROOM",
                message=f"AOID '{aoid}' is not inside any room polygon",
                severity="ERROR",
                location={"x": text["point"].x, "y": text["point"].y}
            ))
    
    # Cross-check with Excel room table
    excel_aoids = set(excel_rooms.keys())
    
    for aoid in found_aoids - excel_aoids:
        errors.append(ValidationError(
            code="AOID_NOT_IN_EXCEL",
            message=f"AOID '{aoid}' found in DWG but not in room table Excel",
            severity="ERROR"
        ))
    
    for aoid in excel_aoids - found_aoids:
        errors.append(ValidationError(
            code="AOID_MISSING_IN_DWG",
            message=f"AOID '{aoid}' found in Excel but not in DWG",
            severity="ERROR"
        ))
    
    return errors
```

### Forbidden Entity Types

```python
FORBIDDEN_TYPES = {"SPLINE", "ELLIPSE", "MULTILINE", "OLE2FRAME", "OLEFRAME"}
ALLOWED_TYPES = {"LINE", "LWPOLYLINE", "POLYLINE", "CIRCLE", "ARC", "TEXT", "MTEXT", 
                 "DIMENSION", "HATCH", "INSERT", "POINT", "SOLID"}

def validate_entity_types(dwg_json: dict) -> list[ValidationError]:
    errors = []
    
    for entity in dwg_json["blocks"]["*Model_Space"]["entities"]:
        etype = entity["type"]
        
        if etype in FORBIDDEN_TYPES:
            errors.append(ValidationError(
                code="FORBIDDEN_ENTITY_TYPE",
                message=f"Entity type '{etype}' is not allowed (handle: {entity['handle']})",
                severity="ERROR",
                location=entity.get("insertion_point") or entity.get("points", [{}])[0]
            ))
    
    return errors
```

### Text/Font Validation

```python
def validate_text_entities(dwg_json: dict) -> list[ValidationError]:
    errors = []
    
    # Get text styles
    styles = {s["name"]: s for s in dwg_json["tables"].get("STYLE", [])}
    
    # Layers allowed to have text
    text_allowed_layers = {"V_PLANLAYOUT", "V_ACHSEN", "V_TEXT", "R_AOID"}
    
    for entity in dwg_json["blocks"]["*Model_Space"]["entities"]:
        if entity["type"] in ("TEXT", "MTEXT"):
            # Check layer
            if entity["layer"] not in text_allowed_layers:
                errors.append(ValidationError(
                    code="TEXT_WRONG_LAYER",
                    message=f"Text on layer '{entity['layer']}' - only allowed on {text_allowed_layers}",
                    severity="ERROR"
                ))
            
            # Check font (should be Arial)
            style_name = entity.get("style", "Standard")
            if style_name in styles:
                font = styles[style_name].get("font_file", "").lower()
                if "arial" not in font:
                    errors.append(ValidationError(
                        code="TEXT_WRONG_FONT",
                        message=f"Text uses font '{font}', only Arial is allowed",
                        severity="ERROR"
                    ))
            
            # Check color is BYLAYER (256)
            if entity.get("color", 256) != 256:
                errors.append(ValidationError(
                    code="COLOR_NOT_BYLAYER",
                    message=f"Text entity has explicit color {entity['color']}, should be BYLAYER",
                    severity="WARNING"
                ))
    
    return errors
```

---

## SVG Error Visualization

LibreDWG's `dwg2SVG` produces basic SVG. We enhance it with error annotations:

```python
import svgwrite
from svgwrite import cm, mm

def generate_error_svg(dwg_json: dict, errors: list[ValidationError], output_path: str):
    """Generate SVG with floor plan and error markers."""
    
    # Calculate bounds from all geometry
    all_points = []
    for entity in dwg_json["blocks"]["*Model_Space"]["entities"]:
        if "points" in entity:
            all_points.extend((p["x"], p["y"]) for p in entity["points"])
        elif "insertion_point" in entity:
            p = entity["insertion_point"]
            all_points.append((p["x"], p["y"]))
    
    if not all_points:
        return
    
    min_x = min(p[0] for p in all_points)
    max_x = max(p[0] for p in all_points)
    min_y = min(p[1] for p in all_points)
    max_y = max(p[1] for p in all_points)
    
    # Add padding
    padding = (max_x - min_x) * 0.05
    width = max_x - min_x + 2 * padding
    height = max_y - min_y + 2 * padding
    
    # Create SVG with viewBox
    dwg = svgwrite.Drawing(
        output_path,
        size=(f"{width/1000}cm", f"{height/1000}cm"),
        viewBox=f"{min_x - padding} {-(max_y + padding)} {width} {height}"
    )
    
    # Flip Y-axis (CAD uses bottom-left origin, SVG uses top-left)
    main_group = dwg.g(transform="scale(1,-1)")
    
    # Layer colors
    layer_colors = {
        "R_RAUMPOLYGON": "#00FF00",
        "R_RAUMPOLYGON-ABZUG": "#FF0000",
        "R_GESCHOSSPOLYGON": "#00FFFF",
        "A_ARCHITEKTUR": "#888888",
        "R_AOID": "#FF7F00",
    }
    
    # Draw entities by layer
    for entity in dwg_json["blocks"]["*Model_Space"]["entities"]:
        layer = entity.get("layer", "0")
        color = layer_colors.get(layer, "#CCCCCC")
        
        if entity["type"] == "LWPOLYLINE" and "points" in entity:
            points = [(p["x"], p["y"]) for p in entity["points"]]
            
            if entity.get("flag", 0) & 1:  # Closed
                main_group.add(dwg.polygon(
                    points,
                    fill="none" if layer != "R_RAUMPOLYGON" else f"{color}33",
                    stroke=color,
                    stroke_width=50
                ))
            else:
                main_group.add(dwg.polyline(
                    points,
                    fill="none",
                    stroke=color,
                    stroke_width=50
                ))
        
        elif entity["type"] in ("TEXT", "MTEXT"):
            pt = entity["insertion_point"]
            main_group.add(dwg.text(
                entity.get("text_value", ""),
                insert=(pt["x"], pt["y"]),
                font_size=entity.get("height", 100),
                fill=color
            ))
    
    # Add error markers
    error_group = dwg.g(id="errors")
    for i, error in enumerate(errors):
        if error.location:
            x, y = error.location.get("x", 0), error.location.get("y", 0)
            
            # Red circle marker
            error_group.add(dwg.circle(
                center=(x, y),
                r=200,
                fill="none",
                stroke="#FF0000",
                stroke_width=30,
                id=f"error-{i}"
            ))
            
            # Error number label
            error_group.add(dwg.text(
                str(i + 1),
                insert=(x + 250, y),
                font_size=150,
                fill="#FF0000",
                font_weight="bold"
            ))
    
    main_group.add(error_group)
    dwg.add(main_group)
    dwg.save()
```

---

## Project Structure

```
plan-check/
├── README.md
├── pyproject.toml
├── docker-compose.yml
├── Dockerfile
│
├── src/
│   └── plan_check/
│       ├── __init__.py
│       ├── main.py              # FastAPI app
│       ├── config.py            # Settings (BBL rules as YAML)
│       │
│       ├── parsers/
│       │   ├── __init__.py
│       │   ├── dwg_parser.py    # LibreDWG wrapper
│       │   ├── dxf_parser.py    # ezdxf fallback
│       │   └── excel_parser.py  # Room table parser
│       │
│       ├── validators/
│       │   ├── __init__.py
│       │   ├── layer_validator.py
│       │   ├── geometry_validator.py
│       │   ├── aoid_validator.py
│       │   ├── text_validator.py
│       │   └── structure_validator.py
│       │
│       ├── reporters/
│       │   ├── __init__.py
│       │   ├── json_reporter.py
│       │   ├── pdf_reporter.py
│       │   └── svg_reporter.py
│       │
│       └── models/
│           ├── __init__.py
│           ├── validation_error.py
│           └── floor_plan.py
│
├── config/
│   └── bbl_rules.yaml           # Configurable validation rules
│
├── tests/
│   ├── fixtures/                # Sample DWG files
│   ├── test_validators.py
│   └── test_parsers.py
│
└── frontend/                    # Optional Vue.js/React UI
    └── ...
```

---

## Configuration-Driven Rules (bbl_rules.yaml)

```yaml
# BBL CAD-Richtlinie v1.0 (01.01.2026)

layers:
  required:
    - name: A_ARCHITEKTUR
      color: 253
      allowed_entities: [LWPOLYLINE, LINE, ARC, CIRCLE, INSERT, HATCH]
    - name: A_ELEKTRO
      color: 253
      allowed_entities: [LWPOLYLINE, LINE, ARC, CIRCLE, INSERT]
    - name: A_HEIZUNG-KUEHLUNG
      color: 253
      allowed_entities: [LWPOLYLINE, LINE, ARC, CIRCLE, INSERT]
    - name: A_LUEFTUNG
      color: 253
      allowed_entities: [LWPOLYLINE, LINE, ARC, CIRCLE, INSERT]
    - name: A_SANITAER
      color: 253
      allowed_entities: [LWPOLYLINE, LINE, ARC, CIRCLE, INSERT]
    - name: A_SCHRAFFUR
      color: 253
      allowed_entities: [HATCH]
    - name: V_ACHSEN
      color: 8
      allowed_entities: [LINE, TEXT, DIMENSION]
    - name: V_BEMASSUNG
      color: 40
      allowed_entities: [DIMENSION, TEXT]
    - name: V_PLANLAYOUT
      color: 7
      allowed_entities: [LINE, LWPOLYLINE, TEXT, MTEXT]
    - name: V_REFERENZPUNKT
      color: 1
      allowed_entities: [POINT, INSERT]
    - name: V_TEXT
      color: 7
      allowed_entities: [TEXT, MTEXT]
    - name: R_AOID
      color: 30
      allowed_entities: [TEXT, MTEXT]
    - name: R_RAUMPOLYGON
      color: 3
      allowed_entities: [LWPOLYLINE]
    - name: R_RAUMPOLYGON-ABZUG
      color: 1
      allowed_entities: [LWPOLYLINE]
    - name: R_GESCHOSSPOLYGON
      color: 4
      allowed_entities: [LWPOLYLINE]

geometry:
  room_polygons:
    min_area_m2: 0.25
    must_be_closed: true
    z_coordinate: 0
    polyline_width: 0
    no_arcs: true  # LWPOLYLINE vertices, not bulge
  
  forbidden_entity_types:
    - SPLINE
    - ELLIPSE
    - MULTILINE
    - OLE2FRAME
    - OLEFRAME

text:
  allowed_font: Arial
  color: BYLAYER  # 256
  
aoid:
  pattern: "^\\d{4}\\.[A-Z]{2}\\.\\d{2}\\.\\d{3}$"
  must_be_inside_room: true
  must_match_excel: true

structure:
  scale: "1:1"
  units: mm
  no_xrefs: true
  no_images: true
  no_external_db: true
  no_layouts: true  # Model space only
  reference_points:
    required: 2
    one_at_origin: true
```

---

## Dockerfile

```dockerfile
FROM python:3.12-slim

# Install LibreDWG from source
RUN apt-get update && apt-get install -y \
    build-essential \
    autoconf \
    automake \
    libtool \
    git \
    && rm -rf /var/lib/apt/lists/*

# Build LibreDWG
RUN git clone --depth 1 https://github.com/LibreDWG/libredwg.git /tmp/libredwg \
    && cd /tmp/libredwg \
    && sh autogen.sh \
    && ./configure --disable-bindings \
    && make -j$(nproc) \
    && make install \
    && ldconfig \
    && rm -rf /tmp/libredwg

# Install Python dependencies
WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY src/ ./src/
COPY config/ ./config/

EXPOSE 8000
CMD ["uvicorn", "plan_check.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Effort Estimate

| Phase | Effort | Deliverable |
|-------|--------|-------------|
| **Phase 1: Core** | 6 weeks | DWG→JSON parsing, layer/geometry validators |
| **Phase 2: Reports** | 3 weeks | JSON/PDF reports, basic SVG output |
| **Phase 3: AOID** | 2 weeks | Excel parsing, cross-validation |
| **Phase 4: Web UI** | 4 weeks | Upload interface, project management |
| **Phase 5: Polish** | 3 weeks | Error visualization, edge cases, docs |
| **Total** | **18 weeks** | ~4.5 months |

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LibreDWG fails on some DWG files | Medium | High | Fallback to ODA Converter + ezdxf |
| JSON output missing entity properties | Low | Medium | Contribute patches upstream |
| GPL license concerns | Low | Low | Accept GPL for open-source project |
| SVG visualization insufficient | Medium | Medium | Consider PDF with reportlab instead |

---

## Alternative: ezdxf Path (DXF-only)

If DWG support proves problematic, mandate DXF submission:

```python
import ezdxf

def parse_dxf(filepath: str) -> dict:
    doc = ezdxf.readfile(filepath)
    msp = doc.modelspace()
    
    result = {
        "layers": {},
        "entities": []
    }
    
    for layer in doc.layers:
        result["layers"][layer.dxf.name] = {
            "color": layer.dxf.color,
            "linetype": layer.dxf.linetype
        }
    
    for entity in msp:
        result["entities"].append({
            "type": entity.dxftype(),
            "layer": entity.dxf.layer,
            "handle": entity.dxf.handle,
            # ... entity-specific attributes
        })
    
    return result
```

**Pros:** More mature Python library, excellent documentation
**Cons:** Requires DXF format, some data loss in DWG→DXF conversion

---

## Next Steps

1. **PoC Week 1-2:** Install LibreDWG, test with 5-10 real BBL DWG files
2. **Evaluate JSON output:** Verify all needed properties are present
3. **Implement core validators:** Layer + geometry checks
4. **Compare with ezdxf:** Test same files as DXF
5. **Decision gate:** LibreDWG vs. ezdxf vs. hybrid
