# Cloud CAD API Options for plan-check

## Executive Summary

Instead of building LibreDWG infrastructure from scratch, several cloud APIs can handle DWG parsing. Here's the landscape:

| Solution | DWG Support | Data Extraction | API | Pricing | Best For |
|----------|-------------|-----------------|-----|---------|----------|
| **Speckle** | ✅ Upload & convert | ✅ Full object model | ✅ REST + Python SDK | Free tier + paid | ⭐ Best overall |
| **Autodesk APS** | ✅ Native | ✅ Full (via Model Derivative) | ✅ REST | Token-based (~$1/file) | Enterprise |
| **Graebert ARES Kudo** | ✅ Full CAD | ⚠️ Viewer, no API extraction | ❌ Viewer only | $200/yr | Viewing only |
| **ConvertAPI** | ✅ DWG→DXF/PDF | ❌ Conversion only | ✅ REST | Pay-per-use | Format conversion |
| **Civils.ai** | ⚠️ PDF only | ✅ AI-based | ✅ REST | $250+ | PDF drawings |
| **CloudConvert** | ✅ DWG→DXF | ❌ Conversion only | ✅ REST | Pay-per-use | Simple conversion |

---

## Detailed Analysis

### 1. Speckle ⭐ RECOMMENDED

**What it is:** Open-source AEC data platform with file upload capabilities

**Key capabilities:**
- Upload DWG/DXF files directly (drag & drop)
- Automatic conversion to Speckle object model
- Full Python SDK for data extraction
- Built-in 3D/2D web viewer
- REST + GraphQL API
- Self-hostable (open source)

**DWG support:**
```
Supported formats: IFC, 3DM, 3MF, 3DS, SKP, AMF, DWG, DXF, 
                   E57, IGS, DGN, FBX, OBJ, PLY, STP, STL
```

**Data extraction via Python SDK:**
```python
from specklepy.api.client import SpeckleClient
from specklepy.api import operations
from specklepy.transports.server import ServerTransport

# Connect to Speckle
client = SpeckleClient(host="app.speckle.systems")
client.authenticate_with_token(token)

# Get model data
transport = ServerTransport(stream_id=project_id, client=client)
model = operations.receive(object_id, transport)

# Access layers, entities, properties
for obj in model.elements:
    print(f"Layer: {obj.layer}, Type: {obj.speckle_type}")
    print(f"Properties: {obj.properties}")
```

**Pricing:**
- Free: 1 workspace, 10 projects, 1GB storage
- Pro: $30/user/month - unlimited projects, 50GB
- Business: $50/user/month - SSO, audit logs

**Pros:**
- Open source (can self-host for ISG compliance)
- Excellent Python SDK
- Built-in viewer
- Active development, strong community
- Supports Swiss companies (Bjarke Ingels Group, HOK use it)

**Cons:**
- DWG import is relatively new (2024)
- Layer/entity extraction from DWG may need verification
- Viewer-focused rather than validation-focused

**Verdict:** Best option for quick prototyping. Test with real BBL DWG files first.

---

### 2. Autodesk Platform Services (APS/Forge)

**What it is:** Autodesk's official cloud API platform

**Key capabilities:**
- Model Derivative API: Convert DWG to extractable format
- Design Automation API: Run AutoCAD scripts in cloud
- Viewer API: Web-based DWG viewing
- Full metadata extraction

**DWG data extraction workflow:**
```
1. Upload DWG to Object Storage Service
2. Call Model Derivative API to translate to SVF
3. Extract metadata (layers, entities, properties)
4. (Optional) View in Autodesk Viewer
```

**API example:**
```bash
# Translate DWG
curl -X POST \
  'https://developer.api.autodesk.com/modelderivative/v2/designdata/job' \
  -H 'Authorization: Bearer {token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "input": {"urn": "{base64_encoded_urn}"},
    "output": {
      "formats": [
        {"type": "svf", "views": ["2d", "3d"]}
      ]
    }
  }'

# Get metadata
curl -X GET \
  'https://developer.api.autodesk.com/modelderivative/v2/designdata/{urn}/metadata' \
  -H 'Authorization: Bearer {token}'
```

**Pricing:**
- Trial: Free for 3 months
- Flex tokens: $1 per token (1 DWG translation = 0.5 tokens)
- Subscription plans for heavy users
- **~$0.50-1.50 per DWG file processed**

**Pros:**
- Official Autodesk = best DWG compatibility
- Battle-tested, enterprise-grade
- Comprehensive API documentation
- Can run actual AutoCAD scripts (Design Automation)

**Cons:**
- Complex authentication (OAuth 2.0)
- Vendor lock-in to Autodesk
- Can get expensive at scale
- Not open source

**Verdict:** Best compatibility guarantee, but overkill for simple validation and creates Autodesk dependency.

---

### 3. Graebert ARES Kudo

**What it is:** Browser-based DWG CAD editor (competitor to AutoCAD Web)

**Key capabilities:**
- Full DWG editing in browser
- Cloud storage integration
- View-only shareable links
- JavaScript/Wt API for customization

**Limitations for plan-check:**
- ❌ No REST API for data extraction
- ❌ Designed for interactive use, not batch processing
- ❌ Cannot programmatically access layer/entity data

**Pricing:**
- Free: View-only
- Professional: $200/year
- Trinity (Desktop+Cloud+Mobile): $400/year

**Verdict:** Not suitable for automated validation — it's a CAD editor, not a data extraction API.

---

### 4. ConvertAPI / CloudConvert / api2convert

**What they do:** File format conversion services

**Typical workflow:**
```
DWG → DXF (via conversion API) → ezdxf (Python) → validation
```

**ConvertAPI example:**
```bash
curl -X POST "https://v2.convertapi.com/convert/dwg/to/dxf" \
  -H "Authorization: Bearer {secret}" \
  -F "File=@drawing.dwg"
```

**Pricing:**
- ConvertAPI: $15 for 1,500 conversions
- CloudConvert: $8 for 500 conversion minutes
- api2convert: Similar

**Pros:**
- Simple REST API
- Cheap for occasional use
- DWG→DXF preserves most data

**Cons:**
- Only converts format, doesn't extract data
- Still need ezdxf or similar for validation
- DWG→DXF conversion may lose some properties
- No viewer

**Verdict:** Useful as a fallback for DWG→DXF conversion, then use ezdxf.

---

### 5. Civils.ai

**What it is:** AI-powered construction document extraction

**Key capabilities:**
- Extract data from CAD PDFs (not DWG directly)
- Natural language queries
- AI-based table/annotation extraction
- Export to Excel, AGS, DXF

**Limitations for plan-check:**
- ❌ Works with PDF exports, not native DWG
- ❌ AI-based = non-deterministic results
- ❌ Focused on quantity takeoffs, not CAD validation

**Pricing:**
- Pro: $250+ one-time
- Enterprise: Custom

**Verdict:** Wrong tool for the job — designed for PDF extraction and quantity surveying.

---

## Recommended Architecture

### Option A: Speckle-Based (Simplest)

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  GitHub Pages   │      │   Speckle.xyz   │      │  Cloud Function │
│   (Frontend)    │─────▶│   (File Host)   │─────▶│  (Validation)   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                               │                         │
                               │ Upload DWG              │ specklepy
                               ▼                         ▼
                         ┌─────────────┐          ┌─────────────┐
                         │  Speckle    │          │  Python     │
                         │  Viewer     │          │  Validators │
                         └─────────────┘          └─────────────┘
```

**Workflow:**
1. User uploads DWG to Speckle (or via your app)
2. Speckle converts to object model
3. Your validation function fetches data via specklepy
4. Run BBL validation rules
5. Return results + link to Speckle viewer

**Effort:** 2-3 weeks for PoC

---

### Option B: Conversion API + ezdxf (Most Control)

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  GitHub Pages   │      │   Cloud Run     │      │   ConvertAPI    │
│   (Frontend)    │─────▶│   (Backend)     │─────▶│   DWG→DXF       │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                │                        │
                                │                        │ DXF file
                                ▼                        ▼
                         ┌─────────────┐          ┌─────────────┐
                         │   ezdxf     │◀─────────│   Storage   │
                         │   Parser    │          │   (temp)    │
                         └─────────────┘          └─────────────┘
                                │
                                ▼
                         ┌─────────────┐
                         │  Validation │
                         │   Rules     │
                         └─────────────┘
```

**Workflow:**
1. User uploads DWG
2. Backend sends to ConvertAPI for DWG→DXF
3. Parse DXF with ezdxf (well-documented Python library)
4. Run validation rules
5. Return JSON report

**Effort:** 3-4 weeks for PoC

---

### Option C: Autodesk APS (Enterprise)

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  GitHub Pages   │      │   Cloud Run     │      │  Autodesk APS   │
│   (Frontend)    │─────▶│   (Backend)     │─────▶│  Model Deriv.   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                │                        │
                                │                        │ Metadata JSON
                                ▼                        ▼
                         ┌─────────────┐          ┌─────────────┐
                         │  Validation │◀─────────│   APS API   │
                         │   Rules     │          │   Response  │
                         └─────────────┘          └─────────────┘
                                │
                                ▼
                         ┌─────────────┐
                         │  Autodesk   │
                         │   Viewer    │
                         └─────────────┘
```

**Effort:** 4-6 weeks (OAuth complexity)

---

## Quick Comparison Matrix

| Criterion | Speckle | APS | ConvertAPI+ezdxf | LibreDWG |
|-----------|---------|-----|------------------|----------|
| **Setup complexity** | Low | High | Medium | High |
| **DWG compatibility** | Good | Excellent | Good | Very Good |
| **Data extraction** | Good | Excellent | Excellent | Excellent |
| **Built-in viewer** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Self-hostable** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Cost (100 files/mo)** | Free | ~$75 | ~$10 | Free |
| **Open source** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Swiss data residency** | ⚠️ EU | ⚠️ US | ⚠️ Various | ✅ Yes |

---

## Recommended Path Forward

### For Demo/PoC (2-3 weeks):
**Use Speckle**
1. Create free Speckle account
2. Upload test DWG files
3. Verify layer/entity extraction works via Python SDK
4. Build simple validation script
5. Host frontend on GitHub Pages

### For Production (if Speckle works):
**Self-host Speckle + validation service**
1. Deploy Speckle Server on Swiss infrastructure
2. Add validation microservice
3. ISG-compliant, open source

### If Speckle DWG extraction is insufficient:
**Fall back to ConvertAPI + ezdxf**
1. DWG→DXF conversion via ConvertAPI
2. Parse with ezdxf (excellent Python library)
3. Full control over validation logic

---

## Next Steps

1. **This week:** Create Speckle account, upload 3-5 BBL test DWGs
2. **Verify:** Can specklepy extract layers, colors, entity types, coordinates?
3. **Decision:** If yes → Speckle path; If no → ConvertAPI + ezdxf
4. **PoC:** Build minimal validation for 3 rules (layer names, colors, closed polylines)
5. **Demo:** GitHub Pages frontend calling your validation API
