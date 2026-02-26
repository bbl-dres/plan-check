# plan-check Hosting Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GitHub Pages (Free)                          │
│                     Static Frontend (HTML/JS)                       │
│                   https://username.github.io/plan-check             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ HTTPS POST /validate
                                   │ (multipart/form-data: DWG + Excel)
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Cloud API (Docker Container)                     │
│              LibreDWG + FastAPI + Python Validators                 │
│                                                                     │
│  Options:                                                           │
│  • Google Cloud Run (Best free tier: 50 CPU hours/month)           │
│  • Render.com (Free tier: 750 hours/month, sleeps after 15min)     │
│  • Railway.app ($5/month credit)                                    │
│  • Fly.io (Pay-as-you-go, ~$2-5/month for light usage)             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ Returns JSON validation report
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend displays:                           │
│                   • Validation errors/warnings                      │
│                   • Statistics                                      │
│                   • Download PDF/SVG report                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Hosting Options Comparison

| Provider | Free Tier | Cold Start | Docker | EU Region | Best For |
|----------|-----------|------------|--------|-----------|----------|
| **Google Cloud Run** | 50 CPU hrs/mo, 2M requests | ~2-5s | ✅ | ✅ | Demo + Production |
| **Render.com** | 750 hrs/mo (sleeps) | ~30s wake | ✅ | ❌ (US only free) | Quick demo |
| **Railway.app** | $5/mo credit | Fast | ✅ | ✅ | Simple deploy |
| **Fly.io** | None (pay-as-you-go) | Fast | ✅ | ✅ | Production |
| **Azure Container Apps** | 180k vCPU-s/mo | ~5s | ✅ | ✅ | Enterprise |

### Recommendation for Demo: **Google Cloud Run**

- Generous free tier (50 CPU hours = ~180,000 seconds)
- No sleep/wake delays for active use
- EU regions available (important for Swiss federal data considerations)
- Easy GitHub Actions deployment
- Scales to zero when not in use

---

## Implementation

### 1. Backend API (FastAPI + LibreDWG)

#### Dockerfile

```dockerfile
FROM python:3.12-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    autoconf \
    automake \
    libtool \
    git \
    && rm -rf /var/lib/apt/lists/*

# Build LibreDWG from source
RUN git clone --depth 1 --branch 0.13.3 https://github.com/LibreDWG/libredwg.git /tmp/libredwg \
    && cd /tmp/libredwg \
    && sh autogen.sh \
    && ./configure --disable-bindings --prefix=/usr/local \
    && make -j$(nproc) \
    && make install

# Production image
FROM python:3.12-slim

# Copy LibreDWG binaries
COPY --from=builder /usr/local/bin/dwgread /usr/local/bin/
COPY --from=builder /usr/local/bin/dwglayers /usr/local/bin/
COPY --from=builder /usr/local/bin/dwg2SVG /usr/local/bin/
COPY --from=builder /usr/local/lib/libredwg* /usr/local/lib/
RUN ldconfig

# Install Python dependencies
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY config/ ./config/

# Cloud Run uses PORT env variable
ENV PORT=8080
EXPOSE 8080

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

#### requirements.txt

```
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
python-multipart>=0.0.6
shapely>=2.0.0
openpyxl>=3.1.0
pyyaml>=6.0
svgwrite>=1.4.0
reportlab>=4.0.0
pydantic>=2.5.0
```

#### src/main.py (FastAPI API)

```python
"""
plan-check API
LibreDWG-based DWG validation service
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

from .validators import run_all_validators
from .reporters import generate_svg_report, generate_pdf_report

app = FastAPI(
    title="plan-check API",
    description="BBL Floor Plan Validation Service",
    version="0.1.0"
)

# CORS for GitHub Pages frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-username.github.io",  # Your GitHub Pages
        "http://localhost:3000",             # Local development
        "http://127.0.0.1:5500",             # VS Code Live Server
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ValidationResponse(BaseModel):
    valid: bool
    error_count: int
    warning_count: int
    errors: list
    warnings: list
    stats: dict


@app.get("/")
async def root():
    return {"service": "plan-check", "status": "ok"}


@app.get("/health")
async def health():
    """Health check for Cloud Run"""
    # Verify LibreDWG is available
    try:
        result = subprocess.run(
            ["dwgread", "--version"],
            capture_output=True,
            timeout=5
        )
        libredwg_ok = result.returncode == 0
    except Exception:
        libredwg_ok = False
    
    return {
        "status": "healthy" if libredwg_ok else "degraded",
        "libredwg": libredwg_ok
    }


@app.post("/validate", response_model=ValidationResponse)
async def validate_dwg(
    dwg_file: UploadFile = File(...),
    excel_file: Optional[UploadFile] = File(None)
):
    """
    Validate a DWG floor plan against BBL CAD-Richtlinie.
    
    - **dwg_file**: The DWG file to validate
    - **excel_file**: Optional room table Excel file for AOID cross-check
    """
    
    # Validate file extension
    if not dwg_file.filename.lower().endswith(('.dwg', '.dxf')):
        raise HTTPException(400, "File must be .dwg or .dxf")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        
        # Save uploaded DWG
        dwg_path = tmpdir / dwg_file.filename
        with open(dwg_path, "wb") as f:
            content = await dwg_file.read()
            f.write(content)
        
        # Save optional Excel
        excel_path = None
        if excel_file:
            excel_path = tmpdir / excel_file.filename
            with open(excel_path, "wb") as f:
                content = await excel_file.read()
                f.write(content)
        
        # Convert DWG to JSON using LibreDWG
        json_path = tmpdir / "output.json"
        try:
            result = subprocess.run(
                ["dwgread", "-O", "JSON", str(dwg_path), "-o", str(json_path)],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode != 0:
                raise HTTPException(
                    500, 
                    f"LibreDWG failed to parse file: {result.stderr}"
                )
            
            with open(json_path) as f:
                dwg_json = json.load(f)
        
        except subprocess.TimeoutExpired:
            raise HTTPException(500, "DWG parsing timed out")
        except json.JSONDecodeError:
            raise HTTPException(500, "LibreDWG produced invalid JSON")
        
        # Run validation
        validation_result = run_all_validators(dwg_json, excel_path)
        
        return ValidationResponse(
            valid=validation_result.valid,
            error_count=len(validation_result.errors),
            warning_count=len(validation_result.warnings),
            errors=[e.dict() for e in validation_result.errors],
            warnings=[w.dict() for w in validation_result.warnings],
            stats=validation_result.stats
        )


@app.post("/validate/svg")
async def validate_and_get_svg(
    dwg_file: UploadFile = File(...),
    excel_file: Optional[UploadFile] = File(None)
):
    """
    Validate DWG and return annotated SVG with error markers.
    """
    # Similar to /validate but returns SVG file
    # Implementation would call generate_svg_report()
    pass


@app.post("/validate/pdf")
async def validate_and_get_pdf(
    dwg_file: UploadFile = File(...),
    excel_file: Optional[UploadFile] = File(None)
):
    """
    Validate DWG and return PDF report.
    """
    # Implementation would call generate_pdf_report()
    pass
```

---

### 2. Deploy to Google Cloud Run

#### Option A: Deploy from local machine

```bash
# Install gcloud CLI
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Build and deploy (from project directory)
gcloud run deploy plan-check \
    --source . \
    --region europe-west6 \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --timeout 60s \
    --max-instances 3

# Get the service URL
gcloud run services describe plan-check --region europe-west6 --format='value(status.url)'
```

#### Option B: GitHub Actions CI/CD

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  SERVICE: plan-check
  REGION: europe-west6

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    permissions:
      contents: read
      id-token: write
    
    steps:
      - uses: actions/checkout@v4
      
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}
      
      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
      
      - name: Build and Deploy
        run: |
          gcloud run deploy $SERVICE \
            --source . \
            --region $REGION \
            --allow-unauthenticated \
            --memory 512Mi \
            --cpu 1
```

---

### 3. GitHub Pages Frontend

Create a simple static frontend in a separate repo or `/docs` folder:

#### index.html

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>plan-check - BBL Planvalidierung</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>🏗️ plan-check</h1>
            <p>Validierung von CAD-Grundrissplänen nach BBL CAD-Richtlinie</p>
        </header>

        <main>
            <section class="upload-section">
                <form id="upload-form">
                    <div class="file-input">
                        <label for="dwg-file">DWG/DXF Datei *</label>
                        <input type="file" id="dwg-file" accept=".dwg,.dxf" required>
                    </div>
                    
                    <div class="file-input">
                        <label for="excel-file">Raumtabelle (Excel, optional)</label>
                        <input type="file" id="excel-file" accept=".xlsx,.xls">
                    </div>
                    
                    <button type="submit" id="validate-btn">
                        <span class="btn-text">Validieren</span>
                        <span class="btn-loading" hidden>⏳ Wird geprüft...</span>
                    </button>
                </form>
            </section>

            <section id="results" class="results-section" hidden>
                <h2>Validierungsergebnis</h2>
                
                <div id="status-badge" class="status-badge"></div>
                
                <div class="stats-grid" id="stats"></div>
                
                <div class="errors-section" id="errors-container"></div>
                
                <div class="warnings-section" id="warnings-container"></div>
            </section>
        </main>

        <footer>
            <p>
                <a href="https://github.com/YOUR_USERNAME/plan-check" target="_blank">GitHub</a> |
                BBL CAD-Richtlinie v1.0
            </p>
        </footer>
    </div>

    <script src="app.js"></script>
</body>
</html>
```

#### style.css

```css
:root {
    --primary: #0066cc;
    --success: #28a745;
    --error: #dc3545;
    --warning: #ffc107;
    --bg: #f5f7fa;
    --card-bg: #ffffff;
    --text: #333333;
    --text-muted: #6c757d;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
}

header {
    text-align: center;
    margin-bottom: 2rem;
}

header h1 {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
}

header p {
    color: var(--text-muted);
}

.upload-section {
    background: var(--card-bg);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.file-input {
    margin-bottom: 1.5rem;
}

.file-input label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
}

.file-input input[type="file"] {
    width: 100%;
    padding: 0.75rem;
    border: 2px dashed #ddd;
    border-radius: 8px;
    cursor: pointer;
}

.file-input input[type="file"]:hover {
    border-color: var(--primary);
}

button[type="submit"] {
    width: 100%;
    padding: 1rem 2rem;
    font-size: 1.1rem;
    font-weight: 600;
    color: white;
    background: var(--primary);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
}

button[type="submit"]:hover {
    background: #0055aa;
}

button[type="submit"]:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.results-section {
    margin-top: 2rem;
    background: var(--card-bg);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.status-badge {
    display: inline-block;
    padding: 0.5rem 1.5rem;
    border-radius: 20px;
    font-weight: 600;
    font-size: 1.1rem;
    margin-bottom: 1.5rem;
}

.status-badge.valid {
    background: #d4edda;
    color: #155724;
}

.status-badge.invalid {
    background: #f8d7da;
    color: #721c24;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.stat-card {
    background: var(--bg);
    padding: 1rem;
    border-radius: 8px;
    text-align: center;
}

.stat-card .value {
    font-size: 1.5rem;
    font-weight: 700;
}

.stat-card .label {
    font-size: 0.85rem;
    color: var(--text-muted);
}

.errors-section h3 {
    color: var(--error);
    margin-bottom: 1rem;
}

.warnings-section h3 {
    color: #856404;
    margin-bottom: 1rem;
}

.error-item, .warning-item {
    background: var(--bg);
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 0.75rem;
    border-left: 4px solid;
}

.error-item {
    border-left-color: var(--error);
}

.warning-item {
    border-left-color: var(--warning);
}

.error-item code, .warning-item code {
    background: #e9ecef;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-size: 0.85rem;
}

footer {
    text-align: center;
    margin-top: 2rem;
    color: var(--text-muted);
}

footer a {
    color: var(--primary);
}
```

#### app.js

```javascript
// Configuration - UPDATE THIS with your Cloud Run URL
const API_URL = 'https://plan-check-xxxxx-xx.a.run.app';

const form = document.getElementById('upload-form');
const dwgInput = document.getElementById('dwg-file');
const excelInput = document.getElementById('excel-file');
const validateBtn = document.getElementById('validate-btn');
const resultsSection = document.getElementById('results');
const statusBadge = document.getElementById('status-badge');
const statsContainer = document.getElementById('stats');
const errorsContainer = document.getElementById('errors-container');
const warningsContainer = document.getElementById('warnings-container');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const dwgFile = dwgInput.files[0];
    if (!dwgFile) {
        alert('Bitte wählen Sie eine DWG/DXF Datei aus.');
        return;
    }
    
    // Show loading state
    validateBtn.disabled = true;
    validateBtn.querySelector('.btn-text').hidden = true;
    validateBtn.querySelector('.btn-loading').hidden = false;
    resultsSection.hidden = true;
    
    try {
        const formData = new FormData();
        formData.append('dwg_file', dwgFile);
        
        const excelFile = excelInput.files[0];
        if (excelFile) {
            formData.append('excel_file', excelFile);
        }
        
        const response = await fetch(`${API_URL}/validate`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Validierung fehlgeschlagen');
        }
        
        const result = await response.json();
        displayResults(result);
        
    } catch (error) {
        alert(`Fehler: ${error.message}`);
        console.error(error);
    } finally {
        validateBtn.disabled = false;
        validateBtn.querySelector('.btn-text').hidden = false;
        validateBtn.querySelector('.btn-loading').hidden = true;
    }
});

function displayResults(result) {
    resultsSection.hidden = false;
    
    // Status badge
    statusBadge.textContent = result.valid ? '✅ Gültig' : '❌ Ungültig';
    statusBadge.className = `status-badge ${result.valid ? 'valid' : 'invalid'}`;
    
    // Stats
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="value">${result.stats.total_entities || 0}</div>
            <div class="label">Entitäten</div>
        </div>
        <div class="stat-card">
            <div class="value">${result.stats.layers_found || 0}</div>
            <div class="label">Layer</div>
        </div>
        <div class="stat-card">
            <div class="value">${result.stats.room_polygons || 0}</div>
            <div class="label">Räume</div>
        </div>
        <div class="stat-card">
            <div class="value" style="color: ${result.error_count > 0 ? 'var(--error)' : 'var(--success)'}">${result.error_count}</div>
            <div class="label">Fehler</div>
        </div>
        <div class="stat-card">
            <div class="value" style="color: ${result.warning_count > 0 ? '#856404' : 'var(--success)'}">${result.warning_count}</div>
            <div class="label">Warnungen</div>
        </div>
    `;
    
    // Errors
    if (result.errors.length > 0) {
        errorsContainer.innerHTML = `
            <h3>❌ Fehler (${result.errors.length})</h3>
            ${result.errors.map(err => `
                <div class="error-item">
                    <code>${err.code}</code>
                    <p>${err.message}</p>
                    ${err.layer ? `<small>Layer: ${err.layer}</small>` : ''}
                    ${err.location ? `<small>Position: (${err.location.x?.toFixed(0)}, ${err.location.y?.toFixed(0)})</small>` : ''}
                </div>
            `).join('')}
        `;
        errorsContainer.hidden = false;
    } else {
        errorsContainer.innerHTML = '';
        errorsContainer.hidden = true;
    }
    
    // Warnings
    if (result.warnings.length > 0) {
        warningsContainer.innerHTML = `
            <h3>⚠️ Warnungen (${result.warnings.length})</h3>
            ${result.warnings.map(warn => `
                <div class="warning-item">
                    <code>${warn.code}</code>
                    <p>${warn.message}</p>
                </div>
            `).join('')}
        `;
        warningsContainer.hidden = false;
    } else {
        warningsContainer.innerHTML = '';
        warningsContainer.hidden = true;
    }
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}
```

---

### 4. Deploy Frontend to GitHub Pages

```bash
# Create a new repo for the frontend
# e.g., https://github.com/YOUR_USERNAME/plan-check-demo

# Push the HTML/CSS/JS files

# Enable GitHub Pages:
# Settings → Pages → Source: Deploy from a branch → main → /root

# Your site will be available at:
# https://YOUR_USERNAME.github.io/plan-check-demo/
```

---

## Cost Estimate

### Google Cloud Run (Demo usage: ~100 validations/month)

| Resource | Usage | Cost |
|----------|-------|------|
| CPU | ~5 min total | Free (within 50 hrs) |
| Memory | 512 MB | Free |
| Requests | 100 | Free (within 2M) |
| Egress | ~50 MB | Free (within 1 GB) |
| **Total** | | **$0/month** |

### Fly.io (Same usage)

| Resource | Usage | Cost |
|----------|-------|------|
| Compute | ~5 min | ~$0.01 |
| Memory | 256 MB | ~$0.50 |
| Egress | 50 MB | Free |
| **Total** | | **~$2-3/month** |

---

## Swiss Federal Considerations

For production deployment at BBL, consider:

1. **Data residency**: Google Cloud Run supports `europe-west6` (Zürich) region
2. **ISG compliance**: For sensitive floor plans, prefer on-premises deployment
3. **Federal cloud**: Check if Bundescloud or Swiss Government Cloud is available
4. **Contractor option**: Have Bedag or another federal IT partner host the container

For the **demo**, public cloud is fine since you're not processing real building data.

---

## Quick Start

```bash
# 1. Clone the backend repo
git clone https://github.com/YOUR_ORG/plan-check-api
cd plan-check-api

# 2. Build locally (optional, for testing)
docker build -t plan-check .
docker run -p 8080:8080 plan-check

# 3. Deploy to Cloud Run
gcloud run deploy plan-check --source . --region europe-west6 --allow-unauthenticated

# 4. Update frontend with API URL
# Edit app.js: const API_URL = 'https://plan-check-xxxxx.a.run.app';

# 5. Deploy frontend to GitHub Pages
# Push to repo with Pages enabled
```
