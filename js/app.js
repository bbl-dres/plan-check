// =============================================
// Entry Point — File Handling & Event Wiring
// =============================================

import { state, dom, initDom, MAX_FILE_SIZE, BG_DARK, BG_LIGHT } from './state.js';
import { log, showStatus, pointInPoly } from './utils.js';
import { processDwgFile, prepareDrawingData, buildLayerInfo, displayEntities } from './dwg-processing.js';
import { resizeCanvas, render, scheduleRender, zoomExtents, screenToWorld, hitTest, showFeaturePopup, hideFeaturePopup, showPopupForItem, syncSideSelection } from './renderer.js';
import { renderValidation, switchValidationTab } from './validation.js';

// =============================================
// Constants
// =============================================
const TAP_THRESHOLD_PX = 8;           // Max movement (px) to still count as a tap
const ZOOM_IN_FACTOR = 1.4;
const ZOOM_OUT_FACTOR = 1 / 1.4;
const WHEEL_ZOOM_IN = 1.18;
const WHEEL_ZOOM_OUT = 0.85;

// =============================================
// Initialize DOM references
// =============================================
initDom();

// Collapsible panel toggles
document.querySelectorAll('.panel__header--toggle').forEach(header => {
    header.addEventListener('click', () => {
        header.closest('.panel').classList.toggle('open');
    });
});

// =============================================
// File Handling
// =============================================
dom.selectBtn.addEventListener('click', (e) => { e.stopPropagation(); dom.fileInput.click(); });
dom.uploadZone.addEventListener('click', (e) => { if (e.target.closest('#load-demo')) return; dom.fileInput.click(); });
dom.fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });

// Demo file loader
document.getElementById('load-demo').addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const DEMO_PATH = 'assets/test-files/CAD.V01-CAFM-Plan-DE.dwg';
    try {
        log('Demo-Datei wird geladen...');
        showStatus('Demo-Datei wird geladen...');
        const resp = await fetch(DEMO_PATH);
        if (!resp.ok) throw new Error(`Demo-Datei nicht gefunden (${resp.status})`);
        const blob = await resp.blob();
        const file = new File([blob], 'CAD.V01-CAFM-Plan-DE.dwg', { type: 'application/octet-stream' });
        handleFile(file);
    } catch (err) {
        showStatus(err.message, 'error');
        log(err.message, 'error');
    }
});

dom.uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); dom.uploadZone.classList.add('dragover'); });
dom.uploadZone.addEventListener('dragleave', () => dom.uploadZone.classList.remove('dragover'));
dom.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault(); dom.uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

async function handleFile(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['dwg', 'dxf'].includes(ext)) { showStatus('Nur .dwg / .dxf Dateien.', 'error'); return; }
    if (file.size > MAX_FILE_SIZE) { showStatus('Datei zu gross (max. 50 MB).', 'error'); return; }

    // Reset — release previous file data for GC
    state.drawingData = null;
    dom.entitiesPanel.classList.remove('visible');
    dom.validationPanel.classList.remove('visible');
    state.roomData = [];
    state.areaData = [];
    state.validationErrors = [];
    state.validationMode = null;
    state.selectedRoom = null;
    state.selectedItem = null;
    state.highlightedItems = null;
    state.nonZeroZEntities = [];
    state.xrefBlocks = [];
    state.dimensionInfo = [];
    state.hiddenLayers.clear();
    state.hiddenRoomIds.clear();
    state.hiddenAreaIds.clear();
    state.hiddenErrorIds.clear();

    try {
        const { db, entities, layers, elapsed } = await processDwgFile(file);

        // Store metadata for export
        state.lastFile = { name: file.name, size: file.size };
        state.lastDbInfo = { version: db.header?.version || '-', layerCount: layers.length, entityCount: entities.length };
        state.lastElapsed = elapsed;
        state.lastUploadTime = new Date();

        showStatus('Zeichnung wird gerendert...');
        log('Zeichnungsdaten werden aufbereitet...');
        state.drawingData = prepareDrawingData(entities, layers, db);
        log(`${state.drawingData.renderList.length} Objekte f\u00fcr Darstellung vorbereitet`, 'success');

        // Build layer info for Übersicht side panel
        buildLayerInfo(entities, layers);
        log(`${state.layerInfo.length} Layer erkannt`);

        // Panel must be visible before measuring canvas dimensions
        dom.validationPanel.classList.add('visible');
        // Wait one frame for layout to complete
        await new Promise(r => requestAnimationFrame(r));
        resizeCanvas();
        zoomExtents();

        displayEntities(entities);

        // Run validation (extract rooms, check rules, render tabs)
        log('Validierung wird gestartet...');
        renderValidation();

        showStatus(`${file.name} erfolgreich verarbeitet in ${elapsed}s`, 'success');

    } catch (err) {
        showStatus(err.message, 'error');
        log(err.message, 'error');
        console.error(err);
    }
}

// =============================================
// Pan, Zoom & Tap (Pointer Events + Wheel)
// =============================================

// Track active pointers for pinch detection
const activePointers = new Map();

function handleCanvasTap(sx, sy) {
    const [wx, wy] = screenToWorld(sx, sy);
    const tolerance = 8 / state.cam.zoom;

    // In rooms/areas mode, prioritize room point-in-polygon so users
    // interact with rooms, not arbitrary DWG entities (walls, etc.)
    if (state.validationMode === 'rooms' || state.validationMode === 'areas') {
        const data = state.validationMode === 'rooms' ? state.roomData : state.areaData;
        const hiddenSet = state.validationMode === 'rooms' ? state.hiddenRoomIds : state.hiddenAreaIds;
        const room = data.find(r => {
            if (hiddenSet.has(r.id)) return false;
            if (state.resultFilter === 'errors' && r.status !== 'error') return false;
            if (state.resultFilter === 'warnings' && r.status !== 'warning') return false;
            return pointInPoly(wx, wy, r.vertices);
        });
        if (room) {
            state.selectedRoom = room;
            state.selectedItem = null;
            state.highlightedItems = null;
            showPopupForItem(room.handle, room.centroid);
            dom.vsideList.querySelectorAll('.vside-item').forEach(el => el.classList.remove('vside-item--selected'));
            const match = dom.vsideList.querySelector(`[data-handle="${room.handle}"]`);
            if (match) {
                match.classList.add('vside-item--selected');
                match.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
            render();
            return;
        }
        // Click outside any visible room — deselect
        state.selectedRoom = null;
        state.selectedItem = null;
        state.highlightedItems = null;
        hideFeaturePopup();
        dom.vsideList.querySelectorAll('.vside-item').forEach(el => el.classList.remove('vside-item--selected'));
        render();
        return;
    }

    // Default mode: general entity hit testing
    const hit = hitTest(wx, wy, tolerance);
    if (hit) {
        state.selectedItem = hit;
        state.highlightedItems = null;
        showFeaturePopup(hit, sx, sy);
        syncSideSelection(hit.handle);
    } else {
        state.selectedItem = null;
        state.selectedRoom = null;
        state.highlightedItems = null;
        hideFeaturePopup();
        dom.vsideList.querySelectorAll('.vside-item').forEach(el => el.classList.remove('vside-item--selected'));
    }

    render();
}

// Wheel zoom (desktop)
dom.canvasWrap.addEventListener('wheel', (e) => {
    if (e.target.closest('.viewer__controls')) return;
    e.preventDefault();
    hideFeaturePopup();
    const rect = dom.canvasWrap.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const [wx, wy] = screenToWorld(mx, my);

    const factor = e.deltaY > 0 ? WHEEL_ZOOM_OUT : WHEEL_ZOOM_IN;
    state.cam.zoom *= factor;

    state.cam.x = wx - (mx - rect.width / 2) / state.cam.zoom;
    state.cam.y = wy + (my - rect.height / 2) / state.cam.zoom;

    scheduleRender();
}, { passive: false });

// Pointer down — start pan or pinch
dom.canvasWrap.addEventListener('pointerdown', (e) => {
    // Don't capture pointer when clicking overlay controls
    if (e.target.closest('.viewer__controls')) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY, camX: state.cam.x, camY: state.cam.y };
        hideFeaturePopup();
        dom.canvasWrap.setPointerCapture(e.pointerId);
    } else if (activePointers.size === 2) {
        state.isPanning = false;
        const pts = [...activePointers.values()];
        state.pinchStart = {
            dist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
            zoom: state.cam.zoom,
            camX: state.cam.x,
            camY: state.cam.y,
        };
    }
});

// Pointer move — pan or pinch-zoom
dom.canvasWrap.addEventListener('pointermove', (e) => {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2 && state.pinchStart) {
        const pts = [...activePointers.values()];
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const scale = dist / state.pinchStart.dist;
        state.cam.zoom = state.pinchStart.zoom * scale;

        // Keep midpoint stable
        const rect = dom.canvasWrap.getBoundingClientRect();
        const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
        const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
        const [wx, wy] = screenToWorld(midX, midY);
        state.cam.x = wx - (midX - rect.width / 2) / state.cam.zoom;
        state.cam.y = wy + (midY - rect.height / 2) / state.cam.zoom;

        scheduleRender();
    } else if (state.isPanning && activePointers.size === 1) {
        const dx = e.clientX - state.panStart.x;
        const dy = e.clientY - state.panStart.y;
        state.cam.x = state.panStart.camX - dx / state.cam.zoom;
        state.cam.y = state.panStart.camY + dy / state.cam.zoom;
        scheduleRender();
    }

    // Coords display
    if (state.drawingData && activePointers.size <= 1) {
        const rect = dom.canvasWrap.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        if (mx >= 0 && my >= 0 && mx <= rect.width && my <= rect.height) {
            const [wx, wy] = screenToWorld(mx, my);
            dom.coordsDisplay.textContent = `X: ${wx.toFixed(2)}  Y: ${wy.toFixed(2)}  Zoom: ${state.cam.zoom.toFixed(2)}x`;
        }
    }
});

// Pointer up / cancel — end pan, detect tap
const handlePointerUp = (e) => {
    const wasPointer = activePointers.get(e.pointerId);
    activePointers.delete(e.pointerId);

    if (state.isPanning && wasPointer && state.panStart) {
        const dx = e.clientX - state.panStart.x;
        const dy = e.clientY - state.panStart.y;
        const moved = Math.hypot(dx, dy);

        // Tap detection
        if (moved < TAP_THRESHOLD_PX && state.drawingData) {
            const rect = dom.canvasWrap.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            if (sx >= 0 && sy >= 0 && sx <= rect.width && sy <= rect.height) {
                handleCanvasTap(sx, sy);
            }
        }
    }

    state.isPanning = false;
    state.pinchStart = null;

    // If one finger remains after lifting second, restart pan
    if (activePointers.size === 1) {
        const remaining = [...activePointers.values()][0];
        state.isPanning = true;
        state.panStart = { x: remaining.x, y: remaining.y, camX: state.cam.x, camY: state.cam.y };
    }
};

dom.canvasWrap.addEventListener('pointerup', handlePointerUp);
dom.canvasWrap.addEventListener('pointercancel', handlePointerUp);

// =============================================
// Buttons
// =============================================
document.getElementById('toggle-bg').addEventListener('click', () => {
    state.bgColor = state.bgColor === BG_DARK ? BG_LIGHT : BG_DARK;
    dom.canvasWrap.style.background = state.bgColor;
    render();
});
document.getElementById('zoom-in').addEventListener('click', () => { state.cam.zoom *= ZOOM_IN_FACTOR; render(); });
document.getElementById('zoom-out').addEventListener('click', () => { state.cam.zoom *= ZOOM_OUT_FACTOR; render(); });
document.getElementById('zoom-fit').addEventListener('click', zoomExtents);

// Fullscreen toggle
const fullscreenBtn = document.getElementById('fullscreen-btn');
fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        dom.validationPanel.requestFullscreen().catch(err => {
            log(`Vollbild fehlgeschlagen: ${err.message}`, 'error');
        });
    } else {
        document.exitFullscreen();
    }
});
document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        fullscreenBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
        fullscreenBtn.title = 'Vollbild beenden';
    } else {
        fullscreenBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
        fullscreenBtn.title = 'Vollbild';
    }
    // Re-measure and re-render after layout change
    setTimeout(() => { resizeCanvas(); render(); }, 100);
});

// Language selector (placeholder)
document.querySelectorAll('.lang-selector__item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.lang-selector__item').forEach(b => b.classList.remove('lang-selector__item--active'));
        btn.classList.add('lang-selector__item--active');
        log(`Sprache: ${btn.dataset.lang.toUpperCase()} (noch nicht implementiert)`, 'warn');
    });
});

// Status filter segmented buttons
document.getElementById('status-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.resultFilter = btn.getAttribute('data-filter');
    document.querySelectorAll('#status-filter .status-filter__btn').forEach(b =>
        b.classList.toggle('status-filter__btn--active', b === btn));
    if (state.validationMode) switchValidationTab(state.validationMode);
});

// =============================================
// Resize handler
// =============================================
window.addEventListener('resize', () => {
    if (!state.drawingData) return;
    resizeCanvas();
    scheduleRender();
});

// =============================================
// Mobile: hamburger menu
// =============================================
const menuBtn = document.getElementById('header-menu-btn');
if (menuBtn) {
    menuBtn.addEventListener('click', () => {
        const nav = document.querySelector('.header__nav');
        const isOpen = nav.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', isOpen);
    });
}

// =============================================
// Ready
// =============================================
log('Pr\u00fcfplattform bereit. Bitte eine DWG- oder DXF-Datei hochladen.');
