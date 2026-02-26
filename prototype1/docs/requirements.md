# plan-check Requirements Specification

## Project Overview

**Project Name:** plan-check (BBL Prüfplattform Flächenmanagement)

**Purpose:** Replace/modernize the existing BBL floor plan validation platform with an open-source solution that validates DWG/DXF files against BBL CAD-Richtlinie standards and SIA 416 area calculation specifications before CAFM import.

**Target Users:**
- BBL internal staff (Flächenmanagement team)
- External planners/architects submitting floor plans
- Project managers reviewing submissions

**Current Status:** Frontend prototype complete (production-ready UI), backend planned for Phase 1

---

## Implementation Status Legend

| Symbol | Status |
|--------|--------|
| ✅ | Implemented in frontend prototype |
| 🔄 | Partially implemented (mock/demo) |
| ⏳ | Planned for backend implementation |
| ❌ | Not started |

---

## Functional Requirements

### FR-1: Authentication & Access Control

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-1.1 | User login with username/email and password | Must | ✅ | Demo login view implemented |
| FR-1.2 | Role-based access: Admin, Editor, Viewer | Must | ✅ | Role-based UI implemented with 11 mock users |
| FR-1.3 | "Zugang anfordern" (Request access) workflow | Should | 🔄 | UI placeholder only |
| FR-1.4 | Password reset functionality | Must | 🔄 | UI placeholder only |
| FR-1.5 | Session management with timeout | Must | ⏳ | Requires backend |
| FR-1.6 | Swiss federal identity integration (eIAM) | Must | ⏳ | Production requirement |

### FR-2: Project Management (Aufträge)

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-2.1 | Create new project (Auftrag) with metadata | Must | 🔄 | UI ready, needs backend |
| FR-2.2 | Project dashboard with card view | Must | ✅ | Grid/list view toggle, building photos |
| FR-2.3 | Project search by name, ID, Auftrag number | Must | ✅ | Debounced search with Ctrl+K shortcut |
| FR-2.4 | Filter projects by status (active, completed, archived) | Should | 🔄 | Visual indicators only |
| FR-2.5 | Project completion percentage calculation | Must | ✅ | Donut chart visualization |
| FR-2.6 | Auto-archive completed projects after 30 days | Should | ✅ | "Wird in 30 Tagen gelöscht" overlay |
| FR-2.7 | Project metadata: SIA Phase (31-53), creation date | Must | ✅ | Full SIA 112 phase support |
| FR-2.8 | Project detail view with tabs | Must | ✅ | Stammdaten, Abgabe Dokumente, Flächenkennzahlen |
| FR-2.9 | Breadcrumb navigation | Must | ✅ | Full navigation hierarchy |

### FR-3: Document Management

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-3.1 | Upload DWG files | Must | ✅ | Drag & drop, 50MB limit, type validation |
| FR-3.2 | Upload DXF files | Should | ✅ | Supported alongside DWG |
| FR-3.3 | Upload Excel room list (Raumliste) | Must | ✅ | 10MB limit, XLSX validation |
| FR-3.4 | Document versioning | Should | ⏳ | Requires backend |
| FR-3.5 | Document list view with status | Must | ✅ | Name, creator, last change, validation % |
| FR-3.6 | Download original uploaded files | Must | 🔄 | UI ready, needs backend |
| FR-3.7 | Batch upload multiple files | Should | ⏳ | Planned |
| FR-3.8 | Document selection & bulk actions | Should | ✅ | Multi-select with checkbox |
| FR-3.9 | File size validation | Must | ✅ | Enforced on upload |

### FR-4: Validation Workflow (4-Step Wizard)

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-4.1 | Step 1: DWG hochladen (Upload DWG) | Must | ✅ | File upload with drag & drop |
| FR-4.2 | Step 2: Raumliste hochladen (Upload room list) | Must | ✅ | Excel file upload |
| FR-4.3 | Step 3: Ergebnisse bestätigen (Confirm results) | Must | ✅ | Review validation results |
| FR-4.4 | Step 4: Auftrag abschliessen (Complete order) | Must | ✅ | Final submission |
| FR-4.5 | Progress indicator showing current step | Must | ✅ | Visual stepper component |
| FR-4.6 | Navigation between steps (back/next) | Must | ✅ | Full navigation with state |
| FR-4.7 | Save progress and resume later | Should | ⏳ | Requires backend persistence |
| FR-4.8 | Step content dynamic rendering | Must | ✅ | Content updates per step |

### FR-5: DWG Validation Engine

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| **Layer Validation** |||||
| FR-5.1 | Validate presence of required BBL layers | Must | 🔄 | 14 rules defined in rules.json |
| FR-5.2 | Validate layer colors match specification | Must | 🔄 | Rule defined, needs engine |
| FR-5.3 | Warn on unexpected/extra layers | Should | 🔄 | Rule defined |
| FR-5.4 | System layers allowed: "0", "Defpoints" | Must | 🔄 | Rule defined |
| **Geometry Validation** |||||
| FR-5.5 | Validate polylines are closed | Must | 🔄 | Rule defined |
| FR-5.6 | Validate Z-coordinates = 0 | Must | 🔄 | Rule defined |
| FR-5.7 | Validate polyline width = 0 | Should | 🔄 | Rule defined |
| FR-5.8 | Validate minimum room area (0.25 m²) | Should | 🔄 | Rule defined |
| FR-5.9 | Detect self-intersecting polygons | Should | ⏳ | Planned |
| FR-5.10 | Detect overlapping room polygons | Should | ⏳ | Planned |
| **Entity Validation** |||||
| FR-5.11 | Check for forbidden entities (SPLINE, ELLIPSE, OLE) | Must | 🔄 | Rule defined |
| FR-5.12 | Validate entities on correct layers | Must | 🔄 | Rule defined |
| **Text/Font Validation** |||||
| FR-5.13 | Validate font is Arial | Must | 🔄 | Rule defined |
| FR-5.14 | Validate text on allowed layers only | Should | 🔄 | Rule defined |
| FR-5.15 | Validate text color is BYLAYER | Should | ⏳ | Planned |
| **AOID Validation** |||||
| FR-5.16 | Validate AOID format (regex) | Must | 🔄 | Rule: `^\d{4}\.[A-Z]{2}\.\d{2}\.\d{3}$` |
| FR-5.17 | Validate AOID uniqueness | Must | 🔄 | Rule defined |
| FR-5.18 | Validate AOID position inside room polygon | Should | 🔄 | Rule defined |
| FR-5.19 | Cross-check AOID with Excel room list | Must | ⏳ | Requires backend |
| **Structure Validation** |||||
| FR-5.20 | Validate drawing scale | Should | ⏳ | Planned |
| FR-5.21 | Check for external references (XREFs) | Should | ⏳ | Planned |
| FR-5.22 | Check for embedded images | Should | ⏳ | Planned |

### FR-6: Room Data Extraction & Display

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-6.1 | Extract room count from DWG | Must | ✅ | Displayed in summary cards |
| FR-6.2 | Extract room polygons with areas | Must | ✅ | geometry.json with area data |
| FR-6.3 | Display room table with columns | Must | ✅ | XAO, AREA, AREA_GRO, AREA_RED, AOFUNCTI, AOUSCOM |
| FR-6.4 | Sort rooms by area (descending) | Should | ✅ | Implemented |
| FR-6.5 | Link room table rows to floor plan viewer | Should | ✅ | Click to highlight |
| FR-6.6 | Room type classification | Should | ✅ | From AOFUNCTI code |
| FR-6.7 | Room status indicators | Should | ✅ | Green/Yellow/Red status pills |

### FR-7: Floor Plan Viewer (SVG-based)

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-7.1 | Display 2D room/area polygons as SVG | Must | 🔄 | Extracted from DWG via backend |
| FR-7.2 | Pan and zoom controls | Must | ⏳ | SVG viewBox manipulation |
| FR-7.3 | Layer visibility toggle | Should | ⏳ | SVG group show/hide |
| FR-7.4 | Highlight validation errors on plan | Must | ✅ | Visual markers implemented |
| FR-7.5 | Click on room to see details | Should | ✅ | Interactive room selection |
| FR-7.6 | Color-code rooms by validation status | Should | ✅ | Green=OK, Yellow=Warning, Red=Error |
| FR-7.7 | "DWG Hochladen" button in viewer | Must | ✅ | Quick re-upload available |
| FR-7.8 | Room polygon rendering | Must | 🔄 | SVG polygons from geometry data |
| FR-7.9 | Lightweight polygon extraction | Must | ⏳ | Backend extracts 2D polygons from DWG |

### FR-8: SIA 416 Area Calculations

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-8.1 | Calculate Geschossfläche (GF) | Must | ✅ | Total floor area displayed |
| FR-8.2 | Calculate Nettogeschossfläche (NGF) | Must | ✅ | Net floor area displayed |
| FR-8.3 | Calculate Hauptnutzfläche (HNF) | Must | ✅ | Main usable area |
| FR-8.4 | Calculate Nebennutzfläche (NNF) | Should | ✅ | Secondary usable area |
| FR-8.5 | Calculate Verkehrsfläche (VF) | Should | ✅ | Circulation area |
| FR-8.6 | Calculate Funktionsfläche (FF) | Should | ✅ | Functional area |
| FR-8.7 | Calculate Konstruktionsfläche (KF) | Should | ⏳ | Planned |
| FR-8.8 | Display area breakdown by DIN 277 categories | Should | ✅ | HNF 1-7, FF 8, VF 9, BUF 10 |
| FR-8.9 | Calculate efficiency ratios (HNF/GF, VMF/GF) | Should | ⏳ | Kennzahlen Wirtschaftlichkeit |
| FR-8.10 | Pie chart visualization of area distribution | Should | ✅ | Implemented |

### FR-9: Validation Results & Reporting

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-9.1 | Display error count with severity | Must | ✅ | Errors vs Warnings tabs |
| FR-9.2 | List all validation errors with details | Must | ✅ | Code, message, severity |
| FR-9.3 | "Fehlermeldungen" tab in detail view | Must | ✅ | Tabbed interface |
| FR-9.4 | Link errors to floor plan location | Should | 🔄 | UI ready, needs backend coords |
| FR-9.5 | Export validation report as PDF | Should | ⏳ | Planned |
| FR-9.6 | Export validation report as JSON | Should | ⏳ | Planned |
| FR-9.7 | "Zusammenfassung Ergebnis" summary page | Must | ✅ | Final results overview |
| FR-9.8 | Validation tab badge counts | Must | ✅ | Dynamic error/warning counts |

### FR-10: Downloads & Documentation

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-10.1 | Provide BBL CAD Weisung.pdf download | Must | 🔄 | UI placeholder |
| FR-10.2 | Provide BBL CAD Prüfungskatalog.pdf download | Must | 🔄 | UI placeholder |
| FR-10.3 | Provide BBL CAD BPMN Prozess.pdf download | Should | 🔄 | UI placeholder |
| FR-10.4 | Provide BBL CAD Vorlage Raumliste.xlsx template | Must | 🔄 | UI placeholder |
| FR-10.5 | Provide BBL CAD Beispiel Dateien.zip samples | Should | 🔄 | UI placeholder |
| FR-10.6 | Embed explainer video (Erklärvideo) | Should | 🔄 | UI placeholder |

### FR-11: User Interface Components (Implemented)

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-11.1 | Toast notifications | Must | ✅ | Error, info, success variants |
| FR-11.2 | Modal dialogs | Must | ✅ | Focus trap, escape to close |
| FR-11.3 | Tab system | Must | ✅ | Multiple tab groups |
| FR-11.4 | Status pills with icons | Must | ✅ | Color-coded status indicators |
| FR-11.5 | Responsive cards | Must | ✅ | Grid layout with breakpoints |
| FR-11.6 | Form inputs with validation | Must | ✅ | Required fields, file types |
| FR-11.7 | Data tables with selection | Must | ✅ | Checkbox multi-select |
| FR-11.8 | User dropdown menu | Must | ✅ | Profile, logout actions |

---

## Non-Functional Requirements

### NFR-1: Performance

| ID | Requirement | Target | Status | Notes |
|----|-------------|--------|--------|-------|
| NFR-1.1 | DWG upload response time | < 5 seconds | ✅ | Client-side validation immediate |
| NFR-1.2 | Validation processing time | < 30 seconds | ⏳ | Backend requirement |
| NFR-1.3 | Floor plan viewer load time | < 3 seconds | ⏳ | SVG rendering from polygon data |
| NFR-1.4 | Dashboard load time | < 2 seconds | ✅ | JSON data loads < 500ms |
| NFR-1.5 | Support concurrent users | 50+ | ⏳ | Backend requirement |

### NFR-2: Security

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| NFR-2.1 | HTTPS/TLS encryption | ⏳ | Production deployment |
| NFR-2.2 | Authentication required for all operations | ✅ | Login view gates access |
| NFR-2.3 | Input validation and sanitization | ✅ | XSS prevention via escapeHtml() |
| NFR-2.4 | File type validation | ✅ | DWG, DXF, XLSX only |
| NFR-2.5 | Rate limiting on uploads | ⏳ | Backend requirement |
| NFR-2.6 | Audit logging | ⏳ | Backend requirement |
| NFR-2.7 | ISG-compliant data handling | ⏳ | Production requirement |
| NFR-2.8 | Filename sanitization | ✅ | Path traversal prevention |
| NFR-2.9 | Content Security Policy headers | ✅ | Implemented |
| NFR-2.10 | Safe DOM queries | ✅ | Error handling wrappers |

### NFR-3: Usability

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| NFR-3.1 | Responsive design (desktop, tablet) | ✅ | Breakpoints: 576px, 768px, 992px, 1200px |
| NFR-3.2 | German language UI | ✅ | Primary language implemented |
| NFR-3.3 | French language UI | ⏳ | Production requirement |
| NFR-3.4 | Italian language UI | ⏳ | Production requirement |
| NFR-3.5 | Accessible (WCAG 2.1 AA) | ✅ | Skip links, ARIA, keyboard nav |
| NFR-3.6 | Swiss Federal CI/CD compliance | ✅ | Full design system implementation |
| NFR-3.7 | Keyboard shortcuts | ✅ | Ctrl+K search, Escape to close |
| NFR-3.8 | Focus management | ✅ | Modal focus trapping |

### NFR-4: Reliability & Availability

| ID | Requirement | Target | Status | Notes |
|----|-------------|--------|--------|-------|
| NFR-4.1 | Uptime | 99.5% | ⏳ | Production requirement |
| NFR-4.2 | Data backup frequency | Daily | ⏳ | Production requirement |
| NFR-4.3 | Recovery time objective (RTO) | < 4 hours | ⏳ | Production requirement |
| NFR-4.4 | Recovery point objective (RPO) | < 24 hours | ⏳ | Production requirement |

### NFR-5: Scalability & Maintainability

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| NFR-5.1 | Containerized deployment (Docker) | ⏳ | Planned |
| NFR-5.2 | Configuration-driven validation rules | ✅ | rules.json with 14 rules |
| NFR-5.3 | API-first architecture | ⏳ | API spec drafted |
| NFR-5.4 | Comprehensive logging | ⏳ | Backend requirement |
| NFR-5.5 | Automated testing (unit, integration) | ✅ | 75+ test cases in script.test.js |

---

## API Specification (Draft)

### Authentication
```
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/request-access
POST /api/auth/reset-password
```

### Projects
```
GET    /api/projects                    # List projects
POST   /api/projects                    # Create project
GET    /api/projects/{id}               # Get project details
PUT    /api/projects/{id}               # Update project
DELETE /api/projects/{id}               # Archive project
GET    /api/projects/{id}/documents     # List project documents
```

### Documents
```
POST   /api/documents/upload            # Upload file
GET    /api/documents/{id}              # Get document details
GET    /api/documents/{id}/download     # Download original file
DELETE /api/documents/{id}              # Delete document
POST   /api/documents/{id}/validate     # Trigger validation
GET    /api/documents/{id}/results      # Get validation results
GET    /api/documents/{id}/rooms        # Get extracted rooms
GET    /api/documents/{id}/areas        # Get area summary
GET    /api/documents/{id}/viewer       # Get viewer data (SVG/JSON)
```

### Reports
```
GET    /api/documents/{id}/report/json  # JSON validation report
GET    /api/documents/{id}/report/pdf   # PDF validation report
```

---

## Technology Stack

### Frontend (Implemented)

| Technology | Purpose | Details |
|------------|---------|---------|
| HTML5 | Semantic markup | Accessible forms, ARIA labels, skip-to-content |
| CSS3 | Styling | CSS variables, Grid, Flexbox, responsive |
| Vanilla JavaScript | Application logic | ~2,366 lines, no build tools required |
| Lucide Icons | Icon library | MIT-licensed SVG icons (CDN) |
| SVG | Floor plan viewer | 2D polygon rendering for rooms/areas |

### CSS Architecture

| Aspect | Implementation |
|--------|----------------|
| Design System | Swiss Federal Corporate Design |
| Methodology | BEM naming convention |
| Design Tokens | 30+ colors, 8 font sizes, 8 spacing units |
| Grid System | 12-column responsive layout |
| Breakpoints | 576px, 768px, 992px, 1200px |

### Backend (Planned)

| Technology | Purpose |
|------------|---------|
| Python 3.12+ | Runtime |
| FastAPI | Web framework |
| Speckle Python API | DWG polygon extraction (preferred) |
| ezdxf | DXF processing / alternative to Speckle |
| LibreDWG | DWG processing alternative |
| Shapely | Geometry operations |
| openpyxl | Excel parsing |
| PostgreSQL + PostGIS | Production database |
| Swiss eIAM | Authentication (production) |

**DWG Processing Options (under evaluation):**
- **Speckle Python API** - Cloud-based, extracts geometry as JSON, promising for 2D polygon extraction (requires license)
- **ezdxf** - Pure Python, MIT license, DXF only (requires DWG→DXF conversion)
- **LibreDWG** - Open source (GPL), native DWG support, self-hosted

### Infrastructure (Planned)

| Environment | Stack |
|-------------|-------|
| Demo | GitHub Pages (frontend) + Google Cloud Run (API) |
| Production | Swiss federal infrastructure / Bundescloud |
| CI/CD | GitHub Actions |

---

## Prototype Scope

### Phase 1: Core Validation

**Completed (Frontend):**
- [x] Login view with username/password
- [x] Project dashboard with search and filtering
- [x] DWG/DXF upload with drag & drop
- [x] 14 validation rules defined (layer, geometry, entity, text, AOID)
- [x] Validation results display with error/warning tabs
- [x] Floor plan viewer UI (SVG-based, pending backend integration)
- [x] 4-step validation wizard
- [x] Swiss Federal design system implementation
- [x] Accessibility (WCAG 2.1 AA)
- [x] Security (XSS prevention, input sanitization)
- [x] Unit tests (75+ test cases)

**Pending (Backend):**
- [ ] DWG polygon extraction (Speckle API / ezdxf / LibreDWG)
- [ ] SVG generation from extracted polygons
- [ ] Validation rule execution engine
- [ ] Database persistence
- [ ] User authentication with sessions
- [ ] File storage

### Phase 2: Extended Features

**Completed (Frontend):**
- [x] Excel room list upload UI
- [x] Room table extraction and display
- [x] Error highlighting on floor plan
- [x] Project list with grid/list views
- [x] SIA 416 area summary with pie chart
- [x] Multi-document selection

**Pending (Backend):**
- [ ] Excel parsing and cross-validation
- [ ] AOID validation against room list
- [ ] Real validation score calculation
- [ ] Document versioning

### Phase 3: Production Ready

**Completed:**
- [x] Full project management UI (CRUD)
- [x] 4-step wizard workflow
- [x] SIA 416 calculations display
- [x] Swiss Federal CI/CD styling
- [x] German language UI

**Pending:**
- [ ] PDF report generation
- [ ] JSON export
- [ ] French + Italian UI
- [ ] eIAM integration
- [ ] Performance optimization (backend)
- [ ] Security hardening (backend)
- [ ] Deployment to Bundescloud

---

## Code Statistics

| Metric | Value |
|--------|-------|
| JavaScript | 2,366 lines |
| CSS | 2,106 lines |
| Test cases | 75+ |
| Functions | 50+ |
| JSON data files | 6 |
| Mock projects | 5 |
| Mock documents | 32 |
| Validation rules | 14 |
| Mock users | 11 |

---

## Open Questions

1. **Authentication:** Will prototype use simple auth or mock eIAM integration?
2. **DWG Processing:** Which approach for polygon extraction?
   - Speckle Python API (cloud-based, promising)
   - ezdxf (DXF only, needs conversion)
   - LibreDWG (self-hosted, native DWG)
3. **Data Persistence:** How long to retain uploaded files and results?
4. **Integration:** Any existing systems to integrate with (SAP RE-FX, SUPERB)?
5. **Validation Rules:** Are the 14 layers in CAD-Richtlinie complete, or are there additional rules?
6. **SIA 416 Logic:** How are area types (HNF, NNF, VF, FF) determined from room codes?
7. **Multi-tenancy:** Should external planners see only their own projects?

---

## References

- BBL CAD-Richtlinie (CAD-Richtlinie_BBL-DE.docx)
- BBL CAD Prüfungskatalog
- SIA 416 - Flächen und Volumen von Gebäuden
- DIN 277 - Grundflächen und Rauminhalte
- Swiss Federal Design System: https://design.admin.ch/
- Speckle Python SDK: https://speckle.guide/dev/py.html
- ezdxf Documentation: https://ezdxf.readthedocs.io/
