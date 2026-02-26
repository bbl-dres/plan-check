// =============================================
// Room Extraction, Validation Rules & Tab UI
// =============================================

import { state, dom } from './state.js';
import { fmtNum, esc, computePolygonArea, pointInPoly, log } from './utils.js';
import { render, resizeCanvas, zoomToPolygon, showPopupForItem } from './renderer.js';
import { downloadPdfReport, downloadExcelReport } from './export.js';

// =============================================
// Room Extraction & Validation
// =============================================

function extractRooms(renderList) {
    // Collect text items for label matching
    const textItems = renderList.filter(item => item.t === 'text');

    // Find room polygons: closed polylines on the room layer
    const roomPolys = renderList.filter(item =>
        item.t === 'poly' && item.closed && item.l === state.roomLayerName
    );

    // Find area polygons: closed polylines on layers containing 'BGF' or 'EBF'
    const areaPolys = renderList.filter(item =>
        item.t === 'poly' && item.closed &&
        item.l !== state.roomLayerName &&
        (/BGF|EBF|GF/i.test(item.l))
    );

    const rooms = roomPolys.map((poly, idx) => {
        const area = computePolygonArea(poly.verts);
        // Centroid
        let cx = 0, cy = 0;
        for (const v of poly.verts) { cx += v.x; cy += v.y; }
        cx /= poly.verts.length;
        cy /= poly.verts.length;

        // Find text label inside polygon
        let label = '';
        for (const t of textItems) {
            if (pointInPoly(t.x, t.y, poly.verts)) {
                // Prefer shorter texts (likely room ID, not long descriptions)
                if (!label || t.text.length < label.length) {
                    label = t.text.trim();
                }
            }
        }

        return {
            id: idx + 1,
            aoid: label || `R${idx + 1}`,
            area: Math.round(area * 100) / 100,
            centroid: { x: cx, y: cy },
            vertices: poly.verts,
            layer: poly.l,
            handle: poly.handle,
            label: label,
            status: 'ok', // will be updated by validation
            siaCategory: 'HNF', // default, no SIA info in DWG
        };
    });

    const areas = areaPolys.map((poly, idx) => {
        const area = computePolygonArea(poly.verts);
        let cx = 0, cy = 0;
        for (const v of poly.verts) { cx += v.x; cy += v.y; }
        cx /= poly.verts.length;
        cy /= poly.verts.length;

        let label = '';
        for (const t of textItems) {
            if (pointInPoly(t.x, t.y, poly.verts)) {
                if (!label || t.text.length < label.length) label = t.text.trim();
            }
        }

        return {
            id: 1000 + idx,
            aoid: label || poly.l,
            area: Math.round(area * 100) / 100,
            centroid: { x: cx, y: cy },
            vertices: poly.verts,
            layer: poly.l,
            handle: poly.handle,
        };
    });

    return { rooms, areas };
}

function runValidation(rooms) {
    const errors = [];
    let errorId = 1;

    for (const room of rooms) {
        // Check: room has a text label
        if (!room.label) {
            errors.push({
                id: errorId++, roomId: room.id, severity: 'warning',
                ruleCode: 'LABEL_001',
                message: `Raum ${room.aoid} hat keine Textbezeichnung`
            });
            if (room.status === 'ok') room.status = 'warning';
        }

        // Check: polygon area is reasonable (> 1 m²)
        if (room.area < 1) {
            errors.push({
                id: errorId++, roomId: room.id, severity: 'warning',
                ruleCode: 'GEOM_001',
                message: `Raum ${room.aoid}: Fl\u00e4che sehr klein (${room.area} m\u00B2)`
            });
            if (room.status === 'ok') room.status = 'warning';
        }

        // Check: polygon has enough vertices
        if (room.vertices.length < 3) {
            errors.push({
                id: errorId++, roomId: room.id, severity: 'error',
                ruleCode: 'GEOM_002',
                message: `Raum ${room.aoid}: Polygon hat weniger als 3 Vertices`
            });
            room.status = 'error';
        }

        // Check: polygon closure gap
        const first = room.vertices[0];
        const last = room.vertices[room.vertices.length - 1];
        const gap = Math.hypot(first.x - last.x, first.y - last.y);
        if (gap > 0.1 && gap < 10) {
            errors.push({
                id: errorId++, roomId: room.id, severity: 'error',
                ruleCode: 'GEOM_003',
                message: `Raum ${room.aoid}: Polygon nicht vollst\u00e4ndig geschlossen (L\u00fccke: ${gap.toFixed(1)}mm)`
            });
            room.status = 'error';
        }
    }

    return errors;
}

// =============================================
// Validation UI – Split-View with Side Panel
// =============================================

export function renderValidation() {
    const { renderList } = state.drawingData;
    const extracted = extractRooms(renderList);
    state.roomData = extracted.rooms;
    state.areaData = extracted.areas;
    state.validationErrors = runValidation(state.roomData);

    // Update tab counts
    const errorCountEl = document.getElementById('vtab-error-count');
    const roomCountEl = document.getElementById('vtab-room-count');
    const areaCountEl = document.getElementById('vtab-area-count');
    if (errorCountEl) errorCountEl.textContent = state.validationErrors.length;
    if (roomCountEl) roomCountEl.textContent = state.roomData.length;
    if (areaCountEl) areaCountEl.textContent = state.areaData.length;

    // Show metrics panel
    const totalArea = state.roomData.reduce((s, r) => s + r.area, 0);
    const okCount2 = state.roomData.filter(r => r.status === 'ok').length;
    const score2 = state.roomData.length > 0 ? Math.round((okCount2 / state.roomData.length) * 100) : 100;
    const scoreClass2 = score2 >= 90 ? 'success' : score2 >= 60 ? 'warning' : 'error';
    const dlIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    dom.metricsGrid.innerHTML =
        `<div class="info-grid__item"><div class="info-grid__label">R\u00e4ume</div><div class="info-grid__value">${state.roomData.length}</div></div>` +
        `<div class="info-grid__item"><div class="info-grid__label">NGF</div><div class="info-grid__value">${fmtNum(totalArea)} m\u00B2</div></div>` +
        `<div class="info-grid__item"><div class="info-grid__label">Fehler</div><div class="info-grid__value">${state.validationErrors.length}</div></div>` +
        `<div class="info-grid__item"><div class="info-grid__label">Score</div><div class="info-grid__value" style="color: var(--color-${scoreClass2})">${score2}%</div></div>` +
        `<div class="info-grid__download"><div class="info-grid__download-label">Bericht</div><div class="info-grid__download-links">` +
        `<button class="info-grid__dl-btn" data-dl="pdf">${dlIcon} PDF</button>` +
        `<button class="info-grid__dl-btn" data-dl="excel">${dlIcon} Excel</button>` +
        `</div></div>`;
    // Wire download buttons in metrics card
    dom.metricsGrid.querySelectorAll('.info-grid__dl-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.dl === 'pdf') downloadPdfReport();
            else if (btn.dataset.dl === 'excel') downloadExcelReport();
        });
    });
    dom.metricsPanel.classList.add('visible');

    // Show panel
    dom.validationPanel.classList.add('visible');

    // Wire up tab clicks
    const tabs = dom.validationPanel.querySelectorAll('[data-vtab]');
    tabs.forEach(tab => {
        tab.onclick = (e) => {
            e.preventDefault();
            switchValidationTab(tab.getAttribute('data-vtab'));
        };
    });

    // Render initial tab
    switchValidationTab('overview');

    log(`Validierung: ${state.roomData.length} R\u00e4ume extrahiert, ${state.validationErrors.length} Befunde`, state.validationErrors.length > 0 ? 'warn' : 'success');
}

export function switchValidationTab(tabName) {
    state.validationMode = tabName;
    state.selectedRoom = null;

    // Update active tab styling
    const tabs = dom.validationPanel.querySelectorAll('[data-vtab]');
    tabs.forEach(t => {
        t.classList.toggle('validation-tabs__tab--active', t.getAttribute('data-vtab') === tabName);
    });

    // Ensure canvas is back in split view (may have been moved to kz-viewer)
    const splitViewer = document.querySelector('.validation-viewer');
    if (splitViewer && dom.canvasWrap.parentElement !== splitViewer) {
        splitViewer.appendChild(dom.canvasWrap);
    }

    // Toggle split-view vs dashboard
    const isDashboard = tabName === 'kennzahlen';
    dom.validationSplit.style.display = isDashboard ? 'none' : '';
    dom.validationDashboard.style.display = isDashboard ? 'block' : 'none';

    // Set layer filter per tab
    state.tabFilterLayers = null;

    // Render tab content
    switch (tabName) {
        case 'overview': renderOverviewTab(); break;
        case 'errors': renderErrorsTab(); break;
        case 'rooms': renderRoomsTab(); break;
        case 'areas': renderAreasTab(); break;
        case 'kennzahlen': renderKennzahlenTab(); break;
    }

    // Re-render canvas with overlay (resize in case split just appeared)
    if (!isDashboard) {
        resizeCanvas();
        render();
    }
}

// ── Helper: wire master toggle-all checkbox ──
function wireToggleAll(hiddenSet, allIds) {
    dom.vsideToggleAll.checked = hiddenSet.size === 0;
    dom.vsideToggleAll.onchange = () => {
        if (dom.vsideToggleAll.checked) {
            hiddenSet.clear();
        } else {
            for (const id of allIds) hiddenSet.add(id);
        }
        // Update individual checkboxes
        for (const item of dom.vsideList.querySelectorAll('.vside-item__toggle')) {
            item.checked = dom.vsideToggleAll.checked;
            item.closest('.vside-item').classList.toggle('hidden', !dom.vsideToggleAll.checked);
        }
        render();
    };
}

// ── Helper: wire search input ──
function wireSearch(searchAttr) {
    dom.vsideSearch.value = '';
    dom.vsideSearch.oninput = () => {
        const q = dom.vsideSearch.value.toLowerCase();
        for (const item of dom.vsideList.children) {
            const text = (item.getAttribute(searchAttr) || '').toLowerCase();
            item.style.display = text.includes(q) ? '' : 'none';
        }
    };
}

function updateToggleAll(hiddenSet, allIds) {
    dom.vsideToggleAll.checked = hiddenSet.size === 0;
    dom.vsideToggleAll.indeterminate = hiddenSet.size > 0 && hiddenSet.size < allIds.length;
}

// ─────────────────────────────────────────────
// Tab 1: Übersicht (Layers)
// ─────────────────────────────────────────────
function renderOverviewTab() {
    dom.vsideSearch.placeholder = 'Layer suchen...';
    dom.vsideList.innerHTML = '';
    dom.vsideSummary.innerHTML = '';

    // Render layer list with checkboxes
    for (const l of state.layerInfo) {
        const div = document.createElement('div');
        div.className = 'vside-item' + (state.hiddenLayers.has(l.name) ? ' hidden' : '');
        div.setAttribute('data-search', l.name);

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !state.hiddenLayers.has(l.name);
        cb.className = 'vside-item__toggle';

        cb.addEventListener('change', () => {
            if (cb.checked) { state.hiddenLayers.delete(l.name); div.classList.remove('hidden'); }
            else { state.hiddenLayers.add(l.name); div.classList.add('hidden'); }
            updateToggleAll(state.hiddenLayers, state.layerInfo.map(x => x.name));
            render();
        });

        const icon = document.createElement('div');
        icon.className = 'vside-item__icon';
        icon.style.background = l.colorHex;

        const name = document.createElement('span');
        name.className = 'vside-item__name';
        name.textContent = l.name;

        const value = document.createElement('span');
        value.className = 'vside-item__value';
        value.textContent = l.count + ' entities';

        div.appendChild(cb);
        div.appendChild(icon);
        div.appendChild(name);
        div.appendChild(value);

        div.addEventListener('click', (e) => {
            if (e.target === cb) return;
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
        });

        dom.vsideList.appendChild(div);
    }

    // Master toggle
    dom.vsideToggleAll.checked = state.hiddenLayers.size === 0;
    dom.vsideToggleAll.onchange = () => {
        const showAll = dom.vsideToggleAll.checked;
        state.hiddenLayers.clear();
        for (const item of dom.vsideList.children) {
            const cb = item.querySelector('.vside-item__toggle');
            if (showAll) {
                cb.checked = true;
                item.classList.remove('hidden');
            } else {
                const name = item.querySelector('.vside-item__name').textContent;
                state.hiddenLayers.add(name);
                cb.checked = false;
                item.classList.add('hidden');
            }
        }
        render();
    };

    wireSearch('data-search');
    dom.vsideSummary.innerHTML = '';
}

// ─────────────────────────────────────────────
// Tab 2: Fehlermeldungen (flat error list)
// ─────────────────────────────────────────────
function renderErrorsTab() {
    dom.vsideSearch.placeholder = 'Fehler suchen...';
    dom.vsideList.innerHTML = '';
    dom.vsideSummary.innerHTML = '';

    if (state.validationErrors.length === 0) {
        dom.vsideList.innerHTML = '<div class="val-empty">Keine Fehler oder Warnungen.</div>';
        return;
    }

    // Sort: errors first, then warnings
    const sorted = state.validationErrors.slice().sort((a, b) => {
        const order = { error: 0, warning: 1 };
        return (order[a.severity] || 1) - (order[b.severity] || 1);
    });

    for (const err of sorted) {
        const room = state.roomData.find(r => r.id === err.roomId);
        const div = document.createElement('div');
        div.className = 'vside-item vside-item--' + err.severity;
        div.setAttribute('data-search', err.ruleCode + ' ' + err.message);
        if (room) div.setAttribute('data-handle', room.handle);

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !state.hiddenErrorIds.has(err.id);
        cb.className = 'vside-item__toggle';
        cb.addEventListener('change', (ev) => {
            ev.stopPropagation();
            if (cb.checked) { state.hiddenErrorIds.delete(err.id); div.classList.remove('hidden'); }
            else { state.hiddenErrorIds.add(err.id); div.classList.add('hidden'); }
            updateToggleAll(state.hiddenErrorIds, sorted.map(e => e.id));
            render();
        });

        const status = document.createElement('span');
        status.className = 'vside-item__status';
        status.textContent = err.severity === 'error' ? '\u2716' : '\u26A0';

        const name = document.createElement('span');
        name.className = 'vside-item__name';
        name.textContent = err.ruleCode;

        const value = document.createElement('span');
        value.className = 'vside-item__value';
        value.textContent = err.message.length > 30 ? err.message.slice(0, 30) + '...' : err.message;
        value.title = err.message;

        div.appendChild(cb);
        div.appendChild(status);
        div.appendChild(name);
        div.appendChild(value);

        div.addEventListener('click', (e) => {
            if (e.target === cb) return;
            if (room) {
                dom.vsideList.querySelectorAll('.vside-item').forEach(el => el.classList.remove('vside-item--selected'));
                div.classList.add('vside-item--selected');
                state.selectedRoom = room;
                zoomToPolygon(room.vertices);
                showPopupForItem(room.handle, room.centroid);
            }
        });

        dom.vsideList.appendChild(div);
    }

    wireToggleAll(state.hiddenErrorIds, sorted.map(e => e.id));
    wireSearch('data-search');
}

// ─────────────────────────────────────────────
// Tab 3: Räume (flat room list)
// ─────────────────────────────────────────────
function renderRoomsTab() {
    dom.vsideSearch.placeholder = 'Raum suchen...';
    dom.vsideList.innerHTML = '';
    dom.vsideSummary.innerHTML = '';

    if (state.roomData.length === 0) {
        dom.vsideList.innerHTML = '<div class="val-empty">Keine R\u00e4ume erkannt.</div>';
        return;
    }

    // Sort: errors first, then warnings, then ok
    let sorted = state.roomData.slice().sort((a, b) => {
        const order = { error: 0, warning: 1, ok: 2 };
        return (order[a.status] || 2) - (order[b.status] || 2);
    });

    // Apply result filter
    if (state.resultFilter === 'errors') {
        sorted = sorted.filter(r => r.status !== 'ok');
        if (sorted.length === 0) {
            dom.vsideList.innerHTML = '<div class="val-empty">Keine Fehler in R\u00e4umen.</div>';
            return;
        }
    }

    for (const room of sorted) {
        const div = document.createElement('div');
        div.className = 'vside-item';
        div.setAttribute('data-search', room.aoid + ' ' + room.label);
        div.setAttribute('data-handle', room.handle);

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !state.hiddenRoomIds.has(room.id);
        cb.className = 'vside-item__toggle';
        cb.addEventListener('change', (ev) => {
            ev.stopPropagation();
            if (cb.checked) { state.hiddenRoomIds.delete(room.id); div.classList.remove('hidden'); }
            else { state.hiddenRoomIds.add(room.id); div.classList.add('hidden'); }
            updateToggleAll(state.hiddenRoomIds, sorted.map(r => r.id));
            render();
        });

        const status = document.createElement('span');
        status.className = 'vside-item__status';
        status.textContent = room.status === 'ok' ? '\u2713' : room.status === 'warning' ? '\u26A0' : '\u2716';

        const name = document.createElement('span');
        name.className = 'vside-item__name';
        name.textContent = room.aoid;
        name.title = room.label || room.aoid;

        const value = document.createElement('span');
        value.className = 'vside-item__value';
        value.textContent = fmtNum(room.area, 1) + ' m\u00B2';

        div.appendChild(cb);
        div.appendChild(status);
        div.appendChild(name);
        div.appendChild(value);

        div.addEventListener('click', (e) => {
            if (e.target === cb) return;
            dom.vsideList.querySelectorAll('.vside-item').forEach(el => el.classList.remove('vside-item--selected'));
            div.classList.add('vside-item--selected');
            state.selectedRoom = room;
            zoomToPolygon(room.vertices);
            showPopupForItem(room.handle, room.centroid);
        });

        dom.vsideList.appendChild(div);
    }

    wireToggleAll(state.hiddenRoomIds, sorted.map(r => r.id));
    wireSearch('data-search');
}

// ─────────────────────────────────────────────
// Tab 4: Flächen (flat area list)
// ─────────────────────────────────────────────
function renderAreasTab() {
    dom.vsideSearch.placeholder = 'Fl\u00e4che suchen...';
    dom.vsideList.innerHTML = '';
    dom.vsideSummary.innerHTML = '';

    if (state.areaData.length === 0) {
        dom.vsideList.innerHTML = '<div class="val-empty">Keine Fl\u00e4chenpolygone gefunden.<br><small>Erwartet: geschlossene Polylinien auf Layern mit BGF/EBF/GF.</small></div>';
        return;
    }

    for (const area of state.areaData) {
        const div = document.createElement('div');
        div.className = 'vside-item';
        div.setAttribute('data-search', area.aoid + ' ' + area.layer);
        div.setAttribute('data-handle', area.handle);

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !state.hiddenAreaIds.has(area.id);
        cb.className = 'vside-item__toggle';
        cb.addEventListener('change', (ev) => {
            ev.stopPropagation();
            if (cb.checked) { state.hiddenAreaIds.delete(area.id); div.classList.remove('hidden'); }
            else { state.hiddenAreaIds.add(area.id); div.classList.add('hidden'); }
            updateToggleAll(state.hiddenAreaIds, state.areaData.map(a => a.id));
            render();
        });

        const icon = document.createElement('div');
        icon.className = 'vside-item__icon';
        icon.style.background = '#0072b1';

        const name = document.createElement('span');
        name.className = 'vside-item__name';
        name.textContent = area.aoid;
        name.title = area.layer;

        const value = document.createElement('span');
        value.className = 'vside-item__value';
        value.textContent = fmtNum(area.area, 1) + ' m\u00B2';

        div.appendChild(cb);
        div.appendChild(icon);
        div.appendChild(name);
        div.appendChild(value);

        div.addEventListener('click', (e) => {
            if (e.target === cb) return;
            dom.vsideList.querySelectorAll('.vside-item').forEach(el => el.classList.remove('vside-item--selected'));
            div.classList.add('vside-item--selected');
            state.selectedRoom = area;
            zoomToPolygon(area.vertices);
            showPopupForItem(area.handle, area.centroid);
        });

        dom.vsideList.appendChild(div);
    }

    wireToggleAll(state.hiddenAreaIds, state.areaData.map(a => a.id));
    wireSearch('data-search');
}

// ─────────────────────────────────────────────
// Tab 5: Kennzahlen (full-width dashboard)
// ─────────────────────────────────────────────
function renderKennzahlenTab() {
    // ── Derive values only from actual floor plan data ──
    const ngf = state.roomData.reduce((s, r) => s + r.area, 0);
    const hasRooms = state.roomData.length > 0;

    const hasAreaPolys = state.areaData.length > 0;
    const gf = hasAreaPolys ? state.areaData.reduce((s, a) => s + a.area, 0) : null;

    const kf = (gf !== null && hasRooms) ? gf - ngf : null;

    // Format helpers
    const DASH = '\u2014';
    const fmtArea = (v) => {
        if (v === null || v === undefined) return DASH;
        return fmtNum(v, v >= 100 ? 0 : 1) + ' m\u00B2';
    };
    const fmtVol = (v) => {
        if (v === null || v === undefined) return DASH;
        return fmtNum(v, v >= 100 ? 0 : 1) + ' m\u00B3';
    };
    const pct = (v, total) => {
        if (v === null || v === undefined || total === null || total === undefined || total <= 0) return DASH;
        return Math.round((v / total) * 100) + '%';
    };
    const kzRow = (abbr, label, value, total, volFmt) =>
        `<tr><td class="kz-abbr">${esc(abbr)}</td><td>${esc(label)}</td><td class="kz-value">${volFmt ? fmtVol(value) : fmtArea(value)}</td><td class="kz-pct">${pct(value, total)}</td></tr>`;

    let html = '<div class="kz-dashboard-content">';
    html += '<div class="val-kennzahlen">';

    // ── Left column ──
    html += '<div>';

    // Gebäudevolumen
    html += '<div class="val-kz-section">';
    html += '<div class="val-kz-title">Geb\u00e4udevolumen</div>';
    html += '<table class="val-kz-table"><tbody>';
    html += kzRow('GV', 'Geb\u00e4udevolumen', null, null, true);
    html += kzRow('GV OG', 'Geb\u00e4udevolumen Obergeschosse', null, null, true);
    html += kzRow('GV UG', 'Geb\u00e4udevolumen Untergeschosse', null, null, true);
    html += '</tbody></table></div>';

    // Gebäudeflächen
    html += '<div class="val-kz-section">';
    html += '<div class="val-kz-title">Geb\u00e4udefl\u00e4chen</div>';
    html += '<table class="val-kz-table"><tbody>';
    html += kzRow('GF', 'Geschossfl\u00e4che', gf, gf);
    html += kzRow('KF', 'Konstruktionsfl\u00e4che', kf, gf);
    html += kzRow('NGF', 'Nettogeschossfl\u00e4che', hasRooms ? ngf : null, gf);
    html += kzRow('NF', 'Nutzfl\u00e4che', hasRooms ? ngf : null, gf);
    html += kzRow('HNF', 'Hauptnutzfl\u00e4che', null, gf);
    html += kzRow('NNF', 'Nebennutzfl\u00e4che', null, gf);
    html += kzRow('VF', 'Verkehrsfl\u00e4che', null, gf);
    html += kzRow('FF', 'Funktionsfl\u00e4che', null, gf);
    html += '</tbody></table></div>';

    // Flächen DIN 277
    html += '<div class="val-kz-section">';
    html += '<div class="val-kz-title">Fl\u00e4chen DIN 277</div>';
    html += '<table class="val-kz-table"><tbody>';
    html += kzRow('HNF 1', 'Wohnen und Aufenthalt', null, gf);
    html += kzRow('HNF 2', 'B\u00fcroarbeit', null, gf);
    html += kzRow('HNF 3', 'Produktion', null, gf);
    html += kzRow('HNF 4', 'Lagern, Verteilen, Verkaufen', null, gf);
    html += kzRow('HNF 5', 'Bildung, Unterricht, Kultur', null, gf);
    html += kzRow('HNF 6', 'Heilen, Pflegen', null, gf);
    html += kzRow('NNF 7', 'Nebennutzfl\u00e4che', null, gf);
    html += kzRow('FF 8', 'Betriebstechnische Anlagen', null, gf);
    html += kzRow('VF 9', 'Verkehrserschliessung und -sicherung', null, gf);
    html += kzRow('BUF 10', 'Verschiedene Nutzungen', null, gf);
    html += '</tbody></table></div>';

    html += '</div>';

    // ── Right column ──
    html += '<div>';

    // Kennzahlen Wirtschaftlichkeit
    html += '<div class="val-kz-section">';
    html += '<div class="val-kz-title">Kennzahlen Wirtschaftlichkeit von Grundriss</div>';
    html += '<table class="val-kz-table"><tbody>';
    html += `<tr><td class="kz-abbr">NGF / GF</td><td>Nettogeschossfl\u00e4che / Geschossfl\u00e4che</td><td class="kz-value">${(gf && hasRooms) ? (ngf / gf).toFixed(2) : DASH}</td></tr>`;
    html += `<tr><td class="kz-abbr">KF / GF</td><td>Konstruktionsfl\u00e4che / Geschossfl\u00e4che</td><td class="kz-value">${(gf && kf !== null) ? (kf / gf).toFixed(2) : DASH}</td></tr>`;
    html += '</tbody></table></div>';

    // Donut chart
    const donutSegments = {};
    if (hasRooms) donutSegments.NGF = ngf;
    if (kf !== null && kf > 0) donutSegments.KF = kf;
    const donutTotal = gf || ngf || 1;
    html += buildValidationDonut(donutSegments, 0, donutTotal);

    html += '</div>';

    html += '</div>'; // val-kennzahlen
    html += '</div>'; // kz-dashboard-content

    dom.validationDashboard.innerHTML = html;
}

function buildValidationDonut(totals, kf, gf) {
    const colorMap = {
        NGF: '#2E7D32', HNF: '#E57373', NNF: '#FFB74D',
        VF: '#FFF176', FF: '#64B5F6', KF: '#CCCCCC',
    };
    const segments = Object.entries(totals)
        .filter(([, v]) => v > 0)
        .map(([label, value]) => ({ label, value, color: colorMap[label] || '#999' }));
    if (kf > 0) segments.push({ label: 'KF', value: kf, color: '#CCCCCC' });

    if (segments.length === 0) return '<div class="val-empty">Keine Daten f\u00fcr Diagramm.</div>';

    const total = gf || 1;
    const r = 60, sw = 24;
    const circumference = 2 * Math.PI * r;
    let offset = 0;

    let svg = '<div class="val-donut">';
    svg += `<svg viewBox="0 0 160 160">`;
    svg += `<circle cx="80" cy="80" r="${r}" fill="none" stroke="#E5E5E5" stroke-width="${sw}"/>`;

    for (const seg of segments) {
        const pctVal = seg.value / total;
        const dash = pctVal * circumference;
        const gap = circumference - dash;
        svg += `<circle cx="80" cy="80" r="${r}" fill="none" ` +
            `stroke="${seg.color}" stroke-width="${sw}" ` +
            `stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" ` +
            `stroke-dashoffset="${(-offset + circumference * 0.25).toFixed(2)}">` +
            `<title>${seg.label}: ${fmtNum(seg.value, 1)} m\u00B2 (${(pctVal * 100).toFixed(1)}%)</title></circle>`;
        offset += dash;
    }
    svg += '</svg>';

    svg += '<div class="val-donut-legend">';
    for (const seg of segments) {
        svg += `<div class="val-donut-legend__item">`;
        svg += `<span class="val-donut-legend__color" style="background:${seg.color}"></span>`;
        svg += `<span>${seg.label}</span>`;
        svg += `<span class="val-donut-legend__pct">${(seg.value / total * 100).toFixed(1)}%</span>`;
        svg += '</div>';
    }
    svg += '</div></div>';

    return svg;
}
