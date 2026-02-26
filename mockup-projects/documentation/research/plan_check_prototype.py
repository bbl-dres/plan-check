#!/usr/bin/env python3
"""
plan-check: BBL Floor Plan Validation Engine
Prototype implementation for LibreDWG + Python path

This demonstrates how the validation logic would work.
In production, LibreDWG CLI outputs JSON which this code processes.
"""

import json
import re
import subprocess
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional
import tempfile

# Optional imports - would be installed in production
try:
    from shapely.geometry import Polygon, Point
    from shapely.validation import explain_validity
    SHAPELY_AVAILABLE = True
except ImportError:
    SHAPELY_AVAILABLE = False
    print("Warning: shapely not installed, geometry validation disabled")

try:
    import openpyxl
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False
    print("Warning: openpyxl not installed, Excel parsing disabled")


# =============================================================================
# Data Models
# =============================================================================

class Severity(Enum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


@dataclass
class Location:
    x: float
    y: float
    z: float = 0.0


@dataclass
class ValidationError:
    code: str
    message: str
    severity: Severity = Severity.ERROR
    location: Optional[Location] = None
    entity_handle: Optional[str] = None
    layer: Optional[str] = None


@dataclass
class ValidationResult:
    file_path: str
    valid: bool
    errors: list[ValidationError] = field(default_factory=list)
    warnings: list[ValidationError] = field(default_factory=list)
    stats: dict = field(default_factory=dict)


# =============================================================================
# BBL CAD-Richtlinie Configuration
# =============================================================================

BBL_REQUIRED_LAYERS = {
    "A_ARCHITEKTUR":        {"color": 253, "allowed_entities": {"LWPOLYLINE", "LINE", "ARC", "CIRCLE", "INSERT", "HATCH"}},
    "A_ELEKTRO":            {"color": 253, "allowed_entities": {"LWPOLYLINE", "LINE", "ARC", "CIRCLE", "INSERT"}},
    "A_HEIZUNG-KUEHLUNG":   {"color": 253, "allowed_entities": {"LWPOLYLINE", "LINE", "ARC", "CIRCLE", "INSERT"}},
    "A_LUEFTUNG":           {"color": 253, "allowed_entities": {"LWPOLYLINE", "LINE", "ARC", "CIRCLE", "INSERT"}},
    "A_SANITAER":           {"color": 253, "allowed_entities": {"LWPOLYLINE", "LINE", "ARC", "CIRCLE", "INSERT"}},
    "A_SCHRAFFUR":          {"color": 253, "allowed_entities": {"HATCH"}},
    "V_ACHSEN":             {"color": 8,   "allowed_entities": {"LINE", "TEXT", "DIMENSION"}},
    "V_BEMASSUNG":          {"color": 40,  "allowed_entities": {"DIMENSION", "TEXT"}},
    "V_PLANLAYOUT":         {"color": 7,   "allowed_entities": {"LINE", "LWPOLYLINE", "TEXT", "MTEXT"}},
    "V_REFERENZPUNKT":      {"color": 1,   "allowed_entities": {"POINT", "INSERT"}},
    "V_TEXT":               {"color": 7,   "allowed_entities": {"TEXT", "MTEXT"}},
    "R_AOID":               {"color": 30,  "allowed_entities": {"TEXT", "MTEXT"}},
    "R_RAUMPOLYGON":        {"color": 3,   "allowed_entities": {"LWPOLYLINE"}},
    "R_RAUMPOLYGON-ABZUG":  {"color": 1,   "allowed_entities": {"LWPOLYLINE"}},
    "R_GESCHOSSPOLYGON":    {"color": 4,   "allowed_entities": {"LWPOLYLINE"}},
}

# System layers that are allowed but not required
SYSTEM_LAYERS = {"0", "Defpoints"}

# Forbidden entity types
FORBIDDEN_ENTITY_TYPES = {"SPLINE", "ELLIPSE", "MULTILINE", "OLE2FRAME", "OLEFRAME"}

# AOID format pattern: e.g., 2011.DM.04.045
AOID_PATTERN = re.compile(r"^\d{4}\.[A-Z]{2}\.\d{2}\.\d{3}$")

# Layers allowed to contain text entities
TEXT_ALLOWED_LAYERS = {"V_PLANLAYOUT", "V_ACHSEN", "V_TEXT", "R_AOID"}

# Minimum room area in m²
MIN_ROOM_AREA_M2 = 0.25


# =============================================================================
# LibreDWG Parser Wrapper
# =============================================================================

class LibreDWGParser:
    """Wrapper around LibreDWG CLI tools."""
    
    def __init__(self, dwgread_path: str = "dwgread"):
        self.dwgread_path = dwgread_path
    
    def parse_dwg_to_json(self, dwg_path: Path) -> dict:
        """
        Convert DWG to JSON using LibreDWG's dwgread command.
        
        In production, runs:
            dwgread -O JSON input.dwg -o output.json
        """
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            json_path = f.name
        
        try:
            result = subprocess.run(
                [self.dwgread_path, "-O", "JSON", str(dwg_path), "-o", json_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode != 0:
                raise RuntimeError(f"dwgread failed: {result.stderr}")
            
            with open(json_path) as f:
                return json.load(f)
        finally:
            Path(json_path).unlink(missing_ok=True)
    
    def get_layers(self, dwg_path: Path) -> list[str]:
        """
        Get layer list using dwglayers command.
        
        In production, runs:
            dwglayers input.dwg
        """
        result = subprocess.run(
            ["dwglayers", str(dwg_path)],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"dwglayers failed: {result.stderr}")
        
        return result.stdout.strip().split("\n")


# =============================================================================
# Mock Parser (for testing without LibreDWG installed)
# =============================================================================

class MockDWGParser:
    """
    Mock parser that simulates LibreDWG JSON output.
    Used for development/testing when LibreDWG is not installed.
    """
    
    def parse_dwg_to_json(self, dwg_path: Path) -> dict:
        """Return a sample DWG structure for testing."""
        return {
            "header": {
                "version": "AC1027",
                "codepage": 30
            },
            "tables": {
                "LAYER": [
                    {"type": "LAYER", "name": "0", "color": 7, "flag": 0},
                    {"type": "LAYER", "name": "R_RAUMPOLYGON", "color": 3, "flag": 0},
                    {"type": "LAYER", "name": "R_AOID", "color": 30, "flag": 0},
                    {"type": "LAYER", "name": "A_ARCHITEKTUR", "color": 253, "flag": 0},
                    # Intentionally missing some required layers for testing
                ],
                "STYLE": [
                    {"name": "Standard", "font_file": "arial.ttf"},
                    {"name": "BadFont", "font_file": "times.ttf"},
                ]
            },
            "blocks": {
                "*Model_Space": {
                    "entities": [
                        # Valid room polygon
                        {
                            "type": "LWPOLYLINE",
                            "handle": "1A3",
                            "layer": "R_RAUMPOLYGON",
                            "color": 256,  # BYLAYER
                            "flag": 1,  # Closed
                            "const_width": 0.0,
                            "points": [
                                {"x": 0.0, "y": 0.0, "z": 0.0},
                                {"x": 5000.0, "y": 0.0, "z": 0.0},
                                {"x": 5000.0, "y": 4000.0, "z": 0.0},
                                {"x": 0.0, "y": 4000.0, "z": 0.0},
                                {"x": 0.0, "y": 0.0, "z": 0.0},
                            ]
                        },
                        # Room polygon with wrong Z
                        {
                            "type": "LWPOLYLINE",
                            "handle": "1A4",
                            "layer": "R_RAUMPOLYGON",
                            "color": 256,
                            "flag": 1,
                            "const_width": 0.0,
                            "points": [
                                {"x": 6000.0, "y": 0.0, "z": 100.0},  # Wrong Z!
                                {"x": 10000.0, "y": 0.0, "z": 0.0},
                                {"x": 10000.0, "y": 3000.0, "z": 0.0},
                                {"x": 6000.0, "y": 3000.0, "z": 0.0},
                                {"x": 6000.0, "y": 0.0, "z": 100.0},
                            ]
                        },
                        # Valid AOID text
                        {
                            "type": "TEXT",
                            "handle": "1A5",
                            "layer": "R_AOID",
                            "color": 256,
                            "insertion_point": {"x": 2500.0, "y": 2000.0, "z": 0.0},
                            "height": 100.0,
                            "text_value": "2011.DM.04.045",
                            "style": "Standard"
                        },
                        # Invalid AOID format
                        {
                            "type": "TEXT",
                            "handle": "1A6",
                            "layer": "R_AOID",
                            "color": 256,
                            "insertion_point": {"x": 8000.0, "y": 1500.0, "z": 0.0},
                            "height": 100.0,
                            "text_value": "INVALID-AOID",
                            "style": "Standard"
                        },
                        # Forbidden entity type
                        {
                            "type": "SPLINE",
                            "handle": "1A7",
                            "layer": "A_ARCHITEKTUR",
                            "color": 256
                        },
                        # Text with wrong font
                        {
                            "type": "TEXT",
                            "handle": "1A8",
                            "layer": "V_TEXT",
                            "color": 256,
                            "insertion_point": {"x": 1000.0, "y": 5000.0, "z": 0.0},
                            "height": 100.0,
                            "text_value": "Some label",
                            "style": "BadFont"
                        },
                    ]
                }
            },
            "objects": []
        }


# =============================================================================
# Validators
# =============================================================================

def validate_layers(dwg_json: dict) -> list[ValidationError]:
    """Validate layer structure according to BBL CAD-Richtlinie."""
    errors = []
    
    # Build layer lookup
    layers = {}
    for layer in dwg_json.get("tables", {}).get("LAYER", []):
        layers[layer["name"]] = layer
    
    # Check required layers exist with correct colors
    for layer_name, spec in BBL_REQUIRED_LAYERS.items():
        if layer_name not in layers:
            errors.append(ValidationError(
                code="LAYER_MISSING",
                message=f"Erforderlicher Layer '{layer_name}' fehlt",
                severity=Severity.ERROR,
                layer=layer_name
            ))
        else:
            actual_color = layers[layer_name].get("color", -1)
            expected_color = spec["color"]
            if actual_color != expected_color:
                errors.append(ValidationError(
                    code="LAYER_COLOR_WRONG",
                    message=f"Layer '{layer_name}' hat Farbe {actual_color}, erwartet {expected_color}",
                    severity=Severity.ERROR,
                    layer=layer_name
                ))
    
    # Check for unauthorized layers
    allowed_layers = set(BBL_REQUIRED_LAYERS.keys()) | SYSTEM_LAYERS
    for layer_name in layers:
        if layer_name not in allowed_layers:
            errors.append(ValidationError(
                code="LAYER_UNAUTHORIZED",
                message=f"Nicht autorisierter Layer '{layer_name}' gefunden",
                severity=Severity.WARNING,
                layer=layer_name
            ))
    
    return errors


def validate_entity_types(dwg_json: dict) -> list[ValidationError]:
    """Check for forbidden entity types."""
    errors = []
    
    model_space = dwg_json.get("blocks", {}).get("*Model_Space", {})
    for entity in model_space.get("entities", []):
        etype = entity.get("type", "UNKNOWN")
        
        if etype in FORBIDDEN_ENTITY_TYPES:
            loc = None
            if "insertion_point" in entity:
                pt = entity["insertion_point"]
                loc = Location(x=pt["x"], y=pt["y"], z=pt.get("z", 0))
            elif "points" in entity and entity["points"]:
                pt = entity["points"][0]
                loc = Location(x=pt["x"], y=pt["y"], z=pt.get("z", 0))
            
            errors.append(ValidationError(
                code="FORBIDDEN_ENTITY_TYPE",
                message=f"Verbotener Entitätstyp '{etype}' gefunden",
                severity=Severity.ERROR,
                entity_handle=entity.get("handle"),
                layer=entity.get("layer"),
                location=loc
            ))
    
    return errors


def validate_geometry(dwg_json: dict) -> list[ValidationError]:
    """Validate geometry: closed polylines, Z=0, no overlaps, minimum area."""
    errors = []
    room_polygons = []
    
    model_space = dwg_json.get("blocks", {}).get("*Model_Space", {})
    
    for entity in model_space.get("entities", []):
        if entity.get("type") != "LWPOLYLINE":
            continue
        
        handle = entity.get("handle", "?")
        layer = entity.get("layer", "?")
        points = entity.get("points", [])
        
        if not points:
            continue
        
        first_point = points[0]
        loc = Location(x=first_point["x"], y=first_point["y"], z=first_point.get("z", 0))
        
        # Check closure (for room polygons)
        if layer in ("R_RAUMPOLYGON", "R_RAUMPOLYGON-ABZUG", "R_GESCHOSSPOLYGON"):
            is_closed = entity.get("flag", 0) & 1
            if not is_closed:
                errors.append(ValidationError(
                    code="POLYLINE_NOT_CLOSED",
                    message=f"Raumpolygon ist nicht geschlossen",
                    severity=Severity.ERROR,
                    entity_handle=handle,
                    layer=layer,
                    location=loc
                ))
        
        # Check Z-coordinates
        for pt in points:
            if pt.get("z", 0) != 0:
                errors.append(ValidationError(
                    code="Z_NOT_ZERO",
                    message=f"Z-Koordinate ist nicht 0 (gefunden: {pt['z']})",
                    severity=Severity.ERROR,
                    entity_handle=handle,
                    layer=layer,
                    location=Location(x=pt["x"], y=pt["y"], z=pt["z"])
                ))
                break  # Only report once per polyline
        
        # Check polyline width
        width = entity.get("const_width", 0)
        if width != 0:
            errors.append(ValidationError(
                code="POLYLINE_WIDTH_NOT_ZERO",
                message=f"Polylinienbreite ist {width}, erwartet 0",
                severity=Severity.ERROR,
                entity_handle=handle,
                layer=layer,
                location=loc
            ))
        
        # Build Shapely polygons for room checks
        if SHAPELY_AVAILABLE and layer == "R_RAUMPOLYGON":
            coords = [(p["x"], p["y"]) for p in points]
            if len(coords) >= 3:
                poly = Polygon(coords)
                
                # Check minimum area
                area_m2 = poly.area / 1_000_000  # mm² to m²
                if area_m2 < MIN_ROOM_AREA_M2:
                    errors.append(ValidationError(
                        code="ROOM_TOO_SMALL",
                        message=f"Raumfläche {area_m2:.3f} m² < {MIN_ROOM_AREA_M2} m²",
                        severity=Severity.ERROR,
                        entity_handle=handle,
                        layer=layer,
                        location=loc
                    ))
                
                # Check polygon validity
                if not poly.is_valid:
                    errors.append(ValidationError(
                        code="POLYGON_INVALID",
                        message=f"Ungültiges Polygon: {explain_validity(poly)}",
                        severity=Severity.ERROR,
                        entity_handle=handle,
                        layer=layer,
                        location=loc
                    ))
                
                room_polygons.append((handle, poly, loc))
    
    # Check for overlapping rooms
    if SHAPELY_AVAILABLE:
        for i, (h1, p1, loc1) in enumerate(room_polygons):
            for h2, p2, loc2 in room_polygons[i+1:]:
                if p1.overlaps(p2):
                    errors.append(ValidationError(
                        code="ROOMS_OVERLAP",
                        message=f"Raumpolygone {h1} und {h2} überlappen sich",
                        severity=Severity.ERROR,
                        entity_handle=h1,
                        layer="R_RAUMPOLYGON",
                        location=loc1
                    ))
    
    return errors


def validate_aoids(dwg_json: dict, excel_rooms: Optional[dict] = None) -> list[ValidationError]:
    """Validate AOID text entities and cross-check with Excel."""
    errors = []
    
    model_space = dwg_json.get("blocks", {}).get("*Model_Space", {})
    
    # Collect room polygons and AOID texts
    room_polygons = []
    aoid_texts = []
    
    for entity in model_space.get("entities", []):
        etype = entity.get("type")
        layer = entity.get("layer")
        
        if etype == "LWPOLYLINE" and layer == "R_RAUMPOLYGON":
            points = entity.get("points", [])
            if SHAPELY_AVAILABLE and len(points) >= 3:
                coords = [(p["x"], p["y"]) for p in points]
                room_polygons.append(Polygon(coords))
        
        elif etype in ("TEXT", "MTEXT") and layer == "R_AOID":
            pt = entity.get("insertion_point", {})
            aoid_texts.append({
                "handle": entity.get("handle"),
                "value": entity.get("text_value", "").strip(),
                "point": Point(pt.get("x", 0), pt.get("y", 0)) if SHAPELY_AVAILABLE else None,
                "location": Location(x=pt.get("x", 0), y=pt.get("y", 0))
            })
    
    found_aoids = set()
    
    for text in aoid_texts:
        aoid = text["value"]
        
        # Check format
        if not AOID_PATTERN.match(aoid):
            errors.append(ValidationError(
                code="AOID_FORMAT_INVALID",
                message=f"AOID '{aoid}' entspricht nicht dem Format (z.B. 2011.DM.04.045)",
                severity=Severity.ERROR,
                entity_handle=text["handle"],
                layer="R_AOID",
                location=text["location"]
            ))
            continue
        
        # Check uniqueness
        if aoid in found_aoids:
            errors.append(ValidationError(
                code="AOID_DUPLICATE",
                message=f"AOID '{aoid}' kommt mehrfach vor",
                severity=Severity.ERROR,
                entity_handle=text["handle"],
                layer="R_AOID",
                location=text["location"]
            ))
        found_aoids.add(aoid)
        
        # Check if AOID is inside a room polygon
        if SHAPELY_AVAILABLE and text["point"] and room_polygons:
            inside_any = any(poly.contains(text["point"]) for poly in room_polygons)
            if not inside_any:
                errors.append(ValidationError(
                    code="AOID_OUTSIDE_ROOM",
                    message=f"AOID '{aoid}' liegt nicht innerhalb eines Raumpolygons",
                    severity=Severity.ERROR,
                    entity_handle=text["handle"],
                    layer="R_AOID",
                    location=text["location"]
                ))
    
    # Cross-check with Excel
    if excel_rooms:
        excel_aoids = set(excel_rooms.keys())
        
        for aoid in found_aoids - excel_aoids:
            errors.append(ValidationError(
                code="AOID_NOT_IN_EXCEL",
                message=f"AOID '{aoid}' in DWG, aber nicht in Raumtabelle",
                severity=Severity.ERROR
            ))
        
        for aoid in excel_aoids - found_aoids:
            errors.append(ValidationError(
                code="AOID_MISSING_IN_DWG",
                message=f"AOID '{aoid}' in Raumtabelle, aber nicht in DWG",
                severity=Severity.ERROR
            ))
    
    return errors


def validate_text_entities(dwg_json: dict) -> list[ValidationError]:
    """Validate text entities: correct layer, font, color."""
    errors = []
    
    # Get text styles
    styles = {}
    for style in dwg_json.get("tables", {}).get("STYLE", []):
        styles[style["name"]] = style
    
    model_space = dwg_json.get("blocks", {}).get("*Model_Space", {})
    
    for entity in model_space.get("entities", []):
        if entity.get("type") not in ("TEXT", "MTEXT"):
            continue
        
        handle = entity.get("handle")
        layer = entity.get("layer", "?")
        pt = entity.get("insertion_point", {})
        loc = Location(x=pt.get("x", 0), y=pt.get("y", 0))
        
        # Check layer
        if layer not in TEXT_ALLOWED_LAYERS:
            errors.append(ValidationError(
                code="TEXT_WRONG_LAYER",
                message=f"Text auf Layer '{layer}' - nur erlaubt auf {TEXT_ALLOWED_LAYERS}",
                severity=Severity.ERROR,
                entity_handle=handle,
                layer=layer,
                location=loc
            ))
        
        # Check font
        style_name = entity.get("style", "Standard")
        if style_name in styles:
            font = styles[style_name].get("font_file", "").lower()
            if font and "arial" not in font:
                errors.append(ValidationError(
                    code="TEXT_WRONG_FONT",
                    message=f"Text verwendet Schriftart '{font}', nur Arial erlaubt",
                    severity=Severity.ERROR,
                    entity_handle=handle,
                    layer=layer,
                    location=loc
                ))
        
        # Check color is BYLAYER
        color = entity.get("color", 256)
        if color != 256:
            errors.append(ValidationError(
                code="COLOR_NOT_BYLAYER",
                message=f"Text hat explizite Farbe {color}, sollte BYLAYER sein",
                severity=Severity.WARNING,
                entity_handle=handle,
                layer=layer,
                location=loc
            ))
    
    return errors


# =============================================================================
# Main Validation Engine
# =============================================================================

class PlanCheckValidator:
    """Main validation engine combining all validators."""
    
    def __init__(self, use_mock_parser: bool = False):
        if use_mock_parser:
            self.parser = MockDWGParser()
        else:
            self.parser = LibreDWGParser()
    
    def validate(self, dwg_path: Path, excel_path: Optional[Path] = None) -> ValidationResult:
        """Run full validation on a DWG file."""
        
        # Parse DWG
        try:
            dwg_json = self.parser.parse_dwg_to_json(dwg_path)
        except Exception as e:
            return ValidationResult(
                file_path=str(dwg_path),
                valid=False,
                errors=[ValidationError(
                    code="PARSE_ERROR",
                    message=f"DWG konnte nicht gelesen werden: {e}",
                    severity=Severity.ERROR
                )]
            )
        
        # Parse Excel room table if provided
        excel_rooms = None
        if excel_path and OPENPYXL_AVAILABLE:
            try:
                excel_rooms = self._parse_excel_rooms(excel_path)
            except Exception as e:
                return ValidationResult(
                    file_path=str(dwg_path),
                    valid=False,
                    errors=[ValidationError(
                        code="EXCEL_PARSE_ERROR",
                        message=f"Raumtabelle konnte nicht gelesen werden: {e}",
                        severity=Severity.ERROR
                    )]
                )
        
        # Run all validators
        all_errors = []
        all_errors.extend(validate_layers(dwg_json))
        all_errors.extend(validate_entity_types(dwg_json))
        all_errors.extend(validate_geometry(dwg_json))
        all_errors.extend(validate_aoids(dwg_json, excel_rooms))
        all_errors.extend(validate_text_entities(dwg_json))
        
        # Separate errors and warnings
        errors = [e for e in all_errors if e.severity == Severity.ERROR]
        warnings = [e for e in all_errors if e.severity == Severity.WARNING]
        
        # Collect stats
        model_space = dwg_json.get("blocks", {}).get("*Model_Space", {})
        entities = model_space.get("entities", [])
        
        stats = {
            "total_entities": len(entities),
            "layers_found": len(dwg_json.get("tables", {}).get("LAYER", [])),
            "room_polygons": sum(1 for e in entities if e.get("layer") == "R_RAUMPOLYGON"),
            "aoid_texts": sum(1 for e in entities if e.get("layer") == "R_AOID"),
            "error_count": len(errors),
            "warning_count": len(warnings)
        }
        
        return ValidationResult(
            file_path=str(dwg_path),
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            stats=stats
        )
    
    def _parse_excel_rooms(self, excel_path: Path) -> dict:
        """Parse BBL room table Excel file."""
        wb = openpyxl.load_workbook(excel_path, read_only=True)
        ws = wb.active
        
        rooms = {}
        for row in ws.iter_rows(min_row=2, values_only=True):  # Skip header
            if row[0]:  # AOID column
                aoid = str(row[0]).strip()
                rooms[aoid] = {
                    "aoid": aoid,
                    "name": row[1] if len(row) > 1 else None,
                    "area": row[2] if len(row) > 2 else None,
                }
        
        return rooms


# =============================================================================
# CLI Entry Point
# =============================================================================

def main():
    """Run validation on mock data for demonstration."""
    print("=" * 60)
    print("plan-check: BBL Floor Plan Validation Engine (Prototype)")
    print("=" * 60)
    print()
    
    # Use mock parser for demo
    validator = PlanCheckValidator(use_mock_parser=True)
    
    # Validate mock data
    result = validator.validate(Path("mock_file.dwg"))
    
    # Print results
    print(f"File: {result.file_path}")
    print(f"Valid: {'✅ Ja' if result.valid else '❌ Nein'}")
    print()
    
    print("Statistics:")
    for key, value in result.stats.items():
        print(f"  {key}: {value}")
    print()
    
    if result.errors:
        print(f"Errors ({len(result.errors)}):")
        for i, err in enumerate(result.errors, 1):
            loc_str = ""
            if err.location:
                loc_str = f" @ ({err.location.x:.0f}, {err.location.y:.0f})"
            print(f"  {i}. [{err.code}] {err.message}{loc_str}")
    print()
    
    if result.warnings:
        print(f"Warnings ({len(result.warnings)}):")
        for i, warn in enumerate(result.warnings, 1):
            print(f"  {i}. [{warn.code}] {warn.message}")
    print()
    
    # Generate JSON report
    report = {
        "file": result.file_path,
        "valid": result.valid,
        "stats": result.stats,
        "errors": [
            {
                "code": e.code,
                "message": e.message,
                "severity": e.severity.value,
                "handle": e.entity_handle,
                "layer": e.layer,
                "location": {"x": e.location.x, "y": e.location.y} if e.location else None
            }
            for e in result.errors
        ],
        "warnings": [
            {
                "code": w.code,
                "message": w.message,
                "severity": w.severity.value
            }
            for w in result.warnings
        ]
    }
    
    print("JSON Report Preview:")
    print(json.dumps(report, indent=2, ensure_ascii=False)[:1000] + "...")


if __name__ == "__main__":
    main()
