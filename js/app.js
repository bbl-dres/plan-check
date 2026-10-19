// =============================================
// Entry point of the checker view: file handling, viewer input and header controls
// =============================================

import { state, dom, initDom, resetFileState, MAX_FILE_SIZE, BG_DARK, BG_LIGHT } from './state.js';
import { log, showStatus } from './utils.js';
import { t } from './i18n.js';
import { initHeader } from './header.js';
import { processDwgFile, prepareDrawingData, buildLayerInfo, summarizeEntities } from './dwg-processing.js';
import { resizeCanvas, render, scheduleRender, hitTest, visibleOverlayEntries } from './renderer.js';
import { screenToWorld, zoomAt, zoomBy, zoomExtents, clampZoom, anchorWorldPoint } from './camera.js';
import { selectPolygon, selectItem, clearSelection } from './selection.js';
import { renderValidation, switchValidationTab, initValidationUi } from './validation.js';
import { pointInPolygonTolerant } from './geometry.js';
import { initHowItWorks, updateFilmLanguage, pauseFilm } from './how-it-works.js';

const DEMO_FILE = 'assets/test-files/CAD.V01-CAFM-Plan-DE.dwg';
const TAP_THRESHOLD_PX = 8;      // pointer travel that still counts as a tap
const HIT_TOLERANCE_PX = 8;      // click distance to an outline
const ZOOM_STEP = 1.4;           // zoom buttons
const WHEEL_ZOOM_IN = 1.18;
const WHEEL_ZOOM_OUT = 0.85;

initDom();
initValidationUi();
initHowItWorks();
initHeader({ onLocaleChange: () => { updateFilmLanguage(); if (state.drawingData) renderValidation({ keepTab: true }); } });

// =============================================
// Panels
// =============================================
const howPanel = document.getElementById('how-panel');

function setPanelOpen(panel, open) {
    panel.classList.toggle('open', open);
    panel.querySelector('.panel__toggle').setAttribute('aria-expanded', String(open));
    if (panel === howPanel && !open) pauseFilm();
}

for (const btn of document.querySelectorAll('.panel__toggle')) {
    btn.addEventListener('click', () => {
        const panel = btn.closest('.panel');
        setPanelOpen(panel, !panel.classList.contains('open'));
    });
}

// =============================================
// File handling
// =============================================
let loadToken = 0;

async function handleFile(file) {
    if (!/\.dwg$/i.test(file.name)) { showStatus(t('file.onlyDwg'), 'error'); return; }
    if (file.size > MAX_FILE_SIZE) { showStatus(t('file.tooLarge'), 'error'); return; }

    // A newer upload supersedes an in-flight one; every await below re-checks the token
    const token = ++loadToken;
    state.isProcessing = true;
    resetFileState();
    clearSelection({ rerender: false });
    dom.validationPanel.classList.remove('visible');
    dom.metricsPanel.classList.remove('visible');
    setPanelOpen(howPanel, false);    // the results take the film's place; it stays one click away

    try {
        const { db, entities, layers, elapsed, version } = await processDwgFile(file);
        if (token !== loadToken) return;

        state.lastFile = { name: file.name, size: file.size };
        state.lastDbInfo = { version, layerCount: layers.length, entityCount: entities.length };
        state.lastElapsed = elapsed;
        state.lastUploadTime = new Date();

        showStatus(t('log.rendering'));
        log(t('log.preparing'));
        state.drawingData = prepareDrawingData(entities, layers, db);
        log(t('log.objectsPrepared', { count: state.drawingData.renderList.length }), 'success');
        buildLayerInfo(entities, layers);
        log(t('log.layersDetected', { count: state.layerInfo.length }));
        summarizeEntities(entities);

        // The canvas can only be measured once the panel is laid out
        dom.validationPanel.classList.add('visible');
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (token !== loadToken) return;
        resizeCanvas();
        zoomExtents();

        log(t('log.validationStarting'));
        renderValidation();
        showStatus(t('log.successfullyProcessed', { name: file.name, elapsed }), 'success');
    } catch (err) {
        if (token !== loadToken) return;
        showStatus(err.message, 'error');
        log(err.message, 'error');
        console.error(err);
    } finally {
        if (token === loadToken) state.isProcessing = false;
    }
}

dom.selectBtn.addEventListener('click', e => { e.stopPropagation(); dom.fileInput.click(); });
dom.uploadZone.addEventListener('click', e => { if (!e.target.closest('button')) dom.fileInput.click(); });
dom.fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file after fixing it in CAD
    if (file) handleFile(file);
});

dom.loadDemoBtn.addEventListener('click', async e => {
    e.stopPropagation();
    try {
        log(t('file.demoLoading'));
        showStatus(t('file.demoLoading'));
        const resp = await fetch(DEMO_FILE);
        if (!resp.ok) throw new Error(t('file.demoNotFound'));
        const blob = await resp.blob();
        handleFile(new File([blob], DEMO_FILE.split('/').pop(), { type: 'application/octet-stream' }));
    } catch (err) {
        showStatus(err.message, 'error');
        log(err.message, 'error');
    }
});

dom.uploadZone.addEventListener('dragover', e => { e.preventDefault(); dom.uploadZone.classList.add('dragover'); });
dom.uploadZone.addEventListener('dragleave', () => dom.uploadZone.classList.remove('dragover'));
dom.uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    dom.uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
// A file dropped outside the zone must not navigate the tab away from the session
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => e.preventDefault());

// =============================================
// Viewer input: pan, zoom, tap
// =============================================
const activePointers = new Map();
let wrapRect = null;

function localPoint(e) {
    return [e.clientX - wrapRect.left, e.clientY - wrapRect.top];
}

function handleCanvasTap(sx, sy) {
    const [wx, wy] = screenToWorld(sx, sy);
    if (state.activeTab === 'rooms' || state.activeTab === 'areas') {
        const entry = visibleOverlayEntries().find(e => pointInPolygonTolerant(wx, wy, e.vertices, e.bounds));
        if (entry) selectPolygon(entry, { zoom: false }); else clearSelection();
        return;
    }
    const item = hitTest(wx, wy, HIT_TOLERANCE_PX / state.cam.zoom);
    if (item) selectItem(item, sx, sy); else clearSelection();
}

dom.canvasWrap.addEventListener('wheel', e => {
    if (e.target.closest('.viewer__controls') || e.deltaY === 0) return;
    e.preventDefault();
    wrapRect = dom.canvasWrap.getBoundingClientRect();
    const [mx, my] = localPoint(e);
    clearSelection({ rerender: false });
    zoomAt(mx, my, e.deltaY > 0 ? WHEEL_ZOOM_OUT : WHEEL_ZOOM_IN);
    scheduleRender();
}, { passive: false });

dom.canvasWrap.addEventListener('pointerdown', e => {
    if (e.target.closest('.viewer__controls') || e.button !== 0) return;
    dom.canvasWrap.setPointerCapture(e.pointerId);
    wrapRect = dom.canvasWrap.getBoundingClientRect();
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY, camX: state.cam.x, camY: state.cam.y };
    } else if (activePointers.size === 2) {
        state.isPanning = false;
        const [a, b] = [...activePointers.values()];
        const [midX, midY] = localPoint({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
        const [wx, wy] = screenToWorld(midX, midY);
        state.pinchStart = { dist: Math.hypot(b.x - a.x, b.y - a.y), zoom: state.cam.zoom, worldX: wx, worldY: wy };
    }
});

dom.canvasWrap.addEventListener('pointermove', e => {
    if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2 && state.pinchStart) {
        const [a, b] = [...activePointers.values()];
        const [midX, midY] = localPoint({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
        state.cam.zoom = clampZoom(state.pinchStart.zoom * Math.hypot(b.x - a.x, b.y - a.y) / state.pinchStart.dist);
        anchorWorldPoint(state.pinchStart.worldX, state.pinchStart.worldY, midX, midY); // keeps the pinch centre under the fingers
        scheduleRender();
    } else if (state.isPanning && activePointers.size === 1 && state.panStart) {
        state.cam.x = state.panStart.camX - (e.clientX - state.panStart.x) / state.cam.zoom;
        state.cam.y = state.panStart.camY + (e.clientY - state.panStart.y) / state.cam.zoom;
        scheduleRender();
    }

    if (state.drawingData && activePointers.size <= 1) {
        if (!wrapRect) wrapRect = dom.canvasWrap.getBoundingClientRect();
        const [mx, my] = localPoint(e);
        if (mx >= 0 && my >= 0 && mx <= wrapRect.width && my <= wrapRect.height) {
            const [wx, wy] = screenToWorld(mx, my);
            dom.coordsDisplay.textContent = `X: ${wx.toFixed(2)}  Y: ${wy.toFixed(2)}  Zoom: ${state.cam.zoom.toFixed(2)}x`;
        }
    }
});

function endPointer(e) {
    const start = activePointers.get(e.pointerId);
    activePointers.delete(e.pointerId);
    if (e.type === 'pointercancel') activePointers.clear();

    if (state.isPanning && start && state.panStart && e.type === 'pointerup' && state.drawingData) {
        const moved = Math.hypot(e.clientX - state.panStart.x, e.clientY - state.panStart.y);
        const [sx, sy] = localPoint(e);
        if (moved < TAP_THRESHOLD_PX && sx >= 0 && sy >= 0 && sx <= wrapRect.width && sy <= wrapRect.height) handleCanvasTap(sx, sy);
    }

    state.isPanning = false;
    state.pinchStart = null;
    if (activePointers.size === 1) {
        // One finger left after a pinch: continue as a pan from its current position
        const remaining = [...activePointers.values()][0];
        state.isPanning = true;
        state.panStart = { x: remaining.x, y: remaining.y, camX: state.cam.x, camY: state.cam.y };
    }
}
dom.canvasWrap.addEventListener('pointerup', endPointer);
dom.canvasWrap.addEventListener('pointercancel', endPointer);
dom.canvasWrap.addEventListener('lostpointercapture', e => activePointers.delete(e.pointerId));

// =============================================
// Viewer buttons
// =============================================
document.getElementById('toggle-bg').addEventListener('click', () => {
    state.bgColor = state.bgColor === BG_DARK ? BG_LIGHT : BG_DARK;
    dom.canvasWrap.style.background = state.bgColor;
    render();
});
document.getElementById('zoom-in').addEventListener('click', () => { zoomBy(ZOOM_STEP); render(); });
document.getElementById('zoom-out').addEventListener('click', () => { zoomBy(1 / ZOOM_STEP); render(); });
document.getElementById('zoom-fit').addEventListener('click', () => { zoomExtents(); render(); });

dom.fullscreenBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else dom.validationPanel.requestFullscreen().catch(err => log(t('log.fullscreenFailed', { error: err.message }), 'error'));
});
document.addEventListener('fullscreenchange', () => {
    const active = !!document.fullscreenElement;
    dom.validationPanel.classList.toggle('is-fullscreen', active);
    dom.fullscreenBtn.title = t(active ? 'viewer.exitFullscreen' : 'viewer.fullscreen');
    dom.fullscreenBtn.setAttribute('aria-label', dom.fullscreenBtn.title);
});

// Any size change of the viewer (window, fullscreen, split layout) re-measures the canvas
new ResizeObserver(() => {
    if (!state.drawingData) return;
    resizeCanvas();
    scheduleRender();
}).observe(dom.canvasWrap);

// =============================================
// Result filter
// =============================================
dom.statusFilter.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.resultFilter = btn.getAttribute('data-filter');
    for (const b of dom.statusFilter.querySelectorAll('.status-filter__btn')) {
        const active = b === btn;
        b.classList.toggle('status-filter__btn--active', active);
        b.setAttribute('aria-pressed', String(active));
    }
    if (state.activeTab) switchValidationTab(state.activeTab);
});

log(t('app.ready'));
