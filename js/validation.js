// =============================================
// Room/area extraction, the rule engine and the validation tabs
// =============================================

import {
    state, dom, ROOM_LAYER, AOID_LAYER, AREA_LAYER, DEDUCTION_LAYER, FRAME_LAYER, HATCH_LAYER, DIMENSION_LAYER,
    CAFM_LAYER_SET, SYSTEM_LAYERS, TEXT_LAYERS, INSUNITS_MM, SIA_COLORS, matchesResultFilter,
} from './state.js';
import { fmtNum, fmtArea, esc, log } from './utils.js';
import { t, has } from './i18n.js';
import {
    polygonAreaM2, pointInPolygonTolerant, hasSelfIntersection, canonicalPolygonHash, visualCenter,
    boundsOfPoints, boundsContain, createBounds, mergeBounds, isFiniteBounds,
} from './geometry.js';
import { render, resizeCanvas } from './renderer.js';
import { selectPolygon, selectItem, highlightItems, clearSelection } from './selection.js';
import { RULES, createIssue, summarizeValidation, splitRulesByOutcome } from './rules.js';
import { buildKpiSections, buildEntityRows, formatArea, formatShare, formatRatio, DASH } from './kpi.js';
import { layerStatus } from './report-model.js';
import { downloadPdfReport, downloadExcelReport } from './export.js';

const MIN_ROOM_AREA_M2 = 0.25;
const BULGE_EPSILON = 1e-6;
const FRAME_TOLERANCE_MM = 100;
const BOUNDARY_TOLERANCE_MM = 0.5;   // AOID base points snapped onto a room edge still count as inside
const SAMPLE_SIZE = 3;               // how many examples an aggregated message lists
const AOID_PATTERN = /^\d{4}\.[A-Za-z0-9]{1,4}\.\d{2}\.\d{3}$/;   // WWWW.GG.EE.RRR
const PARKING_AOID_PATTERN = /^\d{4}\.\d+\.\d{3}$/;
const POLYLINE_TYPES = new Set(['LWPOLYLINE', 'POLYLINE2D']);
const FORBIDDEN_ENTITY_TYPES = new Set(['MLINE', 'ELLIPSE', 'SPLINE', 'OLE2FRAME', 'OLEFRAME']);
const STATUS_RANK = { error: 0, warning: 1, ok: 2 };
const STATUS_ICON = { ok: '✓', warning: '⚠', error: '✖' };
const TEXT_WIDTH_PER_CHAR = 0.6;

const POLYGON_RULE_SPECS = {
    room: { layer: ROOM_LAYER, messagePrefix: 'poly', none: 'POLY_008', wrongType: 'POLY_006', notClosed: 'POLY_001', arcs: 'POLY_002', tooFewVertices: 'POLY_003', tooSmall: 'POLY_004', selfIntersect: 'POLY_007', duplicate: 'POLY_005' },
    area: { layer: AREA_LAYER, messagePrefix: 'gpoly', none: 'GPOLY_004', wrongType: 'GPOLY_003', notClosed: 'GPOLY_001', arcs: 'GPOLY_002', duplicate: 'GPOLY_005' },
};

// =============================================
// Extraction
// =============================================

/** Groups render items by layer and kind so the rules do not rescan the whole list. */
function indexRenderList(renderList) {
    const byLayer = new Map();
    const byKind = new Map();
    for (const item of renderList) {
        (byLayer.get(item.layer) || byLayer.set(item.layer, []).get(item.layer)).push(item);
        (byKind.get(item.kind) || byKind.set(item.kind, []).get(item.kind)).push(item);
    }
    return {
        byLayer, byKind,
        onLayer: layer => byLayer.get(layer) || [],
        ofKind: kind => byKind.get(kind) || [],
    };
}

function closedPolylinesOn(index, layer) {
    return index.onLayer(layer).filter(i => i.kind === 'poly' && POLYLINE_TYPES.has(i.entityType) && i.closed);
}

const round2 = v => Math.round(v * 100) / 100;

function polygonEntry(item, id) {
    const rawArea = polygonAreaM2(item.verts, state.unitScale);
    return {
        id, handle: item.handle, layer: item.layer, entityType: item.entityType,
        vertices: item.verts, bounds: boundsOfPoints(item.verts), labelPoint: visualCenter(item.verts),
        rawArea, area: round2(rawArea), status: 'ok',
    };
}

/** Smallest polygon entry containing the point (handles nested rooms). */
function smallestContaining(entries, x, y, eps) {
    let best = null;
    for (const entry of entries) {
        if ((!best || entry.rawArea < best.rawArea) && pointInPolygonTolerant(x, y, entry.vertices, entry.bounds, eps)) best = entry;
    }
    return best;
}

/** Approximate centre of a text item from its anchor, alignment and rotation. */
function textCenter(item) {
    const width = item.text.length * item.height * TEXT_WIDTH_PER_CHAR * (item.widthFactor || 1);
    const along = item.halign === 'center' ? 0 : item.halign === 'right' ? -width / 2 : width / 2;
    const rot = item.rotation || 0;
    return { x: item.x + Math.cos(rot) * along, y: item.y + Math.sin(rot) * along };
}

function pickAoidLabel(matches) {
    const valid = matches.filter(m => AOID_PATTERN.test(m.text) || PARKING_AOID_PATTERN.test(m.text));
    const pool = valid.length ? valid : matches;
    return pool.reduce((best, m) => (!best || m.text.length < best.length ? m.text : best), '');
}

/** Rooms, floor areas and deductions from the polyline layers, with AOID texts assigned to rooms. */
function extractPolygons(index) {
    const eps = BOUNDARY_TOLERANCE_MM / state.unitScale;
    const rooms = closedPolylinesOn(index, ROOM_LAYER).map((item, i) =>
        ({ ...polygonEntry(item, i + 1), aoid: '', aoidText: '', aoidMatches: [], siaCategory: 'HNF', deductionArea: 0, isDuplicate: false }));
    const areas = closedPolylinesOn(index, AREA_LAYER).map((item, i) => ({ ...polygonEntry(item, i + 1), aoid: '' }));
    const deductions = closedPolylinesOn(index, DEDUCTION_LAYER).map((item, i) => polygonEntry(item, i + 1));

    // Identical room polygons count once towards the areas
    const seen = new Map();
    for (const room of rooms) {
        const hash = canonicalPolygonHash(room.vertices);
        if (seen.has(hash)) { room.isDuplicate = true; room.duplicateOf = seen.get(hash).handle; }
        else seen.set(hash, room);
    }

    // Deduction polygons reduce the area of the room they lie in
    let appliedDeductions = 0;
    for (const deduction of deductions) {
        const host = smallestContaining(rooms, deduction.labelPoint.x, deduction.labelPoint.y, eps);
        if (!host) continue;
        host.deductionArea += deduction.rawArea;
        host.area = round2(host.rawArea - host.deductionArea);
        appliedDeductions++;
    }

    // AOID texts: first by insertion point, then by text centre for texts whose base point sits outside
    const texts = index.onLayer(AOID_LAYER).filter(i => i.kind === 'text');
    const outsideTexts = [];
    const unmatched = [];
    for (const txt of texts) {
        const room = smallestContaining(rooms, txt.baseX, txt.baseY, eps);
        if (room) room.aoidMatches.push({ handle: txt.handle, text: txt.text.trim(), basePointInside: true });
        else unmatched.push(txt);
    }
    for (const txt of unmatched) {
        const c = textCenter(txt);
        const room = smallestContaining(rooms, c.x, c.y, eps);
        if (room) room.aoidMatches.push({ handle: txt.handle, text: txt.text.trim(), basePointInside: false });
        else outsideTexts.push(txt);
    }
    for (const room of rooms) {
        room.aoidText = pickAoidLabel(room.aoidMatches);
        room.aoid = room.aoidText || `R${room.id}`;
    }

    // Floor polygons are labelled with the shortest text of any layer inside them
    const allTexts = index.ofKind('text');
    for (const area of areas) {
        let label = '';
        for (const txt of allTexts) {
            if (pointInPolygonTolerant(txt.baseX, txt.baseY, area.vertices, area.bounds, eps) && (!label || txt.text.length < label.length)) label = txt.text.trim();
        }
        area.aoid = label || area.layer;
    }

    return { rooms, areas, deductions, appliedDeductions, outsideTexts };
}

// =============================================
// Rules
// =============================================

function runLayerRules() {
    const issues = [];
    const names = new Set(state.layerInfo.map(l => l.name));
    const byLower = new Map(state.layerInfo.map(l => [l.name.toLowerCase(), l.name]));
    const requiredNames = new Set(RULES.filter(r => r.layer).map(r => r.layer));

    for (const rule of RULES) {
        if (!rule.layer || names.has(rule.layer)) continue;
        const similar = byLower.get(rule.layer.toLowerCase());
        issues.push(similar
            ? createIssue(rule.code, t('msg.layerCaseMismatch', { name: rule.layer, found: similar }), { layer: similar })
            : createIssue(rule.code, t('msg.layerMissing', { name: rule.layer }), { layer: rule.layer }));
    }

    const cafmByLower = new Map([...CAFM_LAYER_SET].map(n => [n.toLowerCase(), n]));
    for (const l of state.layerInfo) {
        if (CAFM_LAYER_SET.has(l.name) || SYSTEM_LAYERS.has(l.name)) continue;
        const canonical = cafmByLower.get(l.name.toLowerCase());
        if (canonical && requiredNames.has(canonical)) continue; // already reported by the LAYER_00x rule
        issues.push(canonical
            ? createIssue('LAYER_008', t('msg.layerCaseMismatch', { name: canonical, found: l.name }), { layer: l.name })
            : createIssue('LAYER_008', t('msg.layerUnknown', { name: l.name }), { layer: l.name }));
    }
    return issues;
}

/** Shared checks for the room and floor polygon layers. */
function runPolygonLayerRules(index, spec) {
    const issues = [];
    const items = index.onLayer(spec.layer);
    const polys = items.filter(i => i.kind === 'poly');
    const msg = suffix => 'msg.' + spec.messagePrefix + suffix;

    if (polys.length === 0) {
        issues.push(createIssue(spec.none, t(msg('None'))));
        return issues;
    }
    for (const item of items) {
        if (item.entityType !== 'LWPOLYLINE') {
            issues.push(createIssue(spec.wrongType, t(msg('NotLwpolyline'), { layer: spec.layer, type: item.entityType }), { handle: item.handle }));
        }
    }
    for (const poly of polys) {
        const ref = { handle: poly.handle };
        if (!poly.closed) issues.push(createIssue(spec.notClosed, t(msg('NotClosed')), ref));
        else if (poly.implicitlyClosed) issues.push(createIssue(spec.notClosed, t(msg('NotClosedFlag')), ref));
        if (poly.verts.some(v => Math.abs(v.bulge || 0) > BULGE_EPSILON)) issues.push(createIssue(spec.arcs, t(msg('HasArcs')), ref));
        if (spec.tooFewVertices && poly.verts.length < 3) issues.push(createIssue(spec.tooFewVertices, t(msg('TooFewVerts')), ref));
        if (spec.tooSmall && poly.closed && poly.verts.length >= 3) {
            const area = polygonAreaM2(poly.verts, state.unitScale);
            if (area < MIN_ROOM_AREA_M2) issues.push(createIssue(spec.tooSmall, t(msg('TooSmall'), { area: area.toFixed(2) }), ref));
        }
        if (spec.selfIntersect && poly.closed && poly.verts.length >= 4 && hasSelfIntersection(poly.verts)) {
            issues.push(createIssue(spec.selfIntersect, t(msg('SelfIntersect')), ref));
        }
    }
    const seen = new Set();
    for (const poly of polys) {
        const hash = canonicalPolygonHash(poly.verts);
        if (seen.has(hash)) issues.push(createIssue(spec.duplicate, t(msg('Duplicate')), { handle: poly.handle }));
        else seen.add(hash);
    }
    return issues;
}

function runAoidRules(rooms, outsideTexts) {
    const issues = [];
    const roomRef = room => ({ roomId: room.id, handle: room.handle });

    for (const room of rooms) {
        if (room.aoidMatches.length === 0) issues.push(createIssue('AOID_001', t('msg.aoidMissing', { aoid: room.aoid }), roomRef(room)));
        if (room.aoidMatches.length > 1) issues.push(createIssue('AOID_004', t('msg.aoidMultiple', { aoid: room.aoid, count: room.aoidMatches.length }), roomRef(room)));
        if (room.aoidText && !AOID_PATTERN.test(room.aoidText) && !PARKING_AOID_PATTERN.test(room.aoidText)) {
            issues.push(createIssue('AOID_003', t('msg.aoidFormatInvalid', { label: room.aoidText }), roomRef(room)));
        }
        for (const match of room.aoidMatches) {
            if (!match.basePointInside) issues.push(createIssue('AOID_006', t('msg.aoidBasepointOutside', { aoid: match.text }), roomRef(room)));
        }
    }

    // Duplicate AOIDs across distinct rooms (a duplicated polygon is reported by POLY_005 instead)
    const roomsByAoid = new Map();
    for (const room of rooms) {
        if (room.aoidText && !room.isDuplicate) (roomsByAoid.get(room.aoidText) || roomsByAoid.set(room.aoidText, []).get(room.aoidText)).push(room);
    }
    for (const [aoid, list] of roomsByAoid) {
        if (list.length < 2) continue;
        for (const room of list) issues.push(createIssue('AOID_002', t('msg.aoidNotUnique', { aoid, count: list.length }), roomRef(room)));
    }

    for (const txt of outsideTexts) {
        issues.push(createIssue('AOID_005', t('msg.aoidOutside', { text: txt.text.trim() }), { handle: txt.handle }));
    }
    return issues;
}

/** The plan frame: the largest closed polyline on V_PLANLAYOUT, else the extent of everything on that layer. */
function planFrame(index) {
    const items = index.onLayer(FRAME_LAYER);
    let frame = null, maxArea = 0;
    for (const item of items) {
        if (item.kind !== 'poly' || !item.closed || item.verts.length < 4) continue;
        const area = polygonAreaM2(item.verts, state.unitScale);
        if (area > maxArea) { maxArea = area; frame = item.bounds; }
    }
    if (frame) return frame;
    if (items.length === 0) return null;
    const extent = createBounds();
    for (const item of items) mergeBounds(extent, item.bounds);
    return isFiniteBounds(extent) ? extent : null;
}

function unitName(code) {
    return has('unit.' + code) ? t('unit.' + code) : String(code);
}

function runGeomRules(index) {
    const issues = [];
    if (state.insunits !== null && state.insunits !== INSUNITS_MM) {
        issues.push(createIssue('GEOM_001', t('msg.geomNotMm', { unit: unitName(state.insunits) })));
    }
    if (state.nonZeroZEntities.length > 0) {
        const sample = state.nonZeroZEntities.slice(0, SAMPLE_SIZE).map(e => `${e.type}@${e.layer}`).join(', ');
        issues.push(createIssue('GEOM_002', t('msg.geomNonZeroZ', { count: state.nonZeroZEntities.length, sample })));
    }
    for (const entry of state.entitySummary) {
        if (FORBIDDEN_ENTITY_TYPES.has(entry.type)) issues.push(createIssue('GEOM_003', t('msg.geomForbiddenType', { type: entry.type, count: entry.count })));
    }
    for (const xref of state.xrefBlocks) {
        issues.push(createIssue('GEOM_004', t('msg.geomXref', { name: xref.name })));
    }
    const frame = planFrame(index);
    if (frame) {
        const tolerance = FRAME_TOLERANCE_MM / state.unitScale;
        let outside = 0;
        for (const [layer, items] of index.byLayer) {
            if (!CAFM_LAYER_SET.has(layer) || layer === FRAME_LAYER) continue;
            for (const item of items) if (!boundsContain(frame, item.bounds, tolerance)) outside++;
        }
        if (outside > 0) issues.push(createIssue('GEOM_005', t('msg.geomOutsideFrame', { count: outside })));
    }
    return issues;
}

function groupHandles(items, keyOf) {
    const groups = new Map();
    for (const item of items) {
        const key = keyOf(item);
        if (key == null) continue;
        (groups.get(key) || groups.set(key, []).get(key)).push(item.handle);
    }
    return groups;
}

function runTextRules(index) {
    const issues = [];
    // Dimension text and block content are not drafted text elements
    const texts = index.ofKind('text').filter(i => i.entityType !== 'DIMENSION' && !i.inBlock);
    for (const [layer, handles] of groupHandles(texts, i => (TEXT_LAYERS.has(i.layer) ? null : i.layer))) {
        issues.push(createIssue('TEXT_001', t('msg.textWrongLayer', { count: handles.length, layer }), { layer, handles }));
    }
    const wrongFont = texts.filter(i => i.layer !== FRAME_LAYER && i.fontName && !/arial/i.test(i.fontName));
    for (const [font, handles] of groupHandles(wrongFont, i => i.fontName)) {
        issues.push(createIssue('TEXT_002', t('msg.textWrongFont', { count: handles.length, font }), { handles }));
    }
    return issues;
}

function runStyleRules(index) {
    const issues = [];
    const widthPolys = index.ofKind('poly').filter(i => i.width > 0);
    if (widthPolys.length > 0) {
        const layers = [...new Set(widthPolys.map(p => p.layer))].slice(0, SAMPLE_SIZE).join(', ');
        issues.push(createIssue('STYLE_001', t('msg.stylePolyWidth', { count: widthPolys.length, layers }), { handles: widthPolys.map(p => p.handle) }));
    }
    const notByLayer = [];
    for (const [layer, items] of index.byLayer) {
        if (CAFM_LAYER_SET.has(layer)) for (const item of items) if (!item.byLayer) notByLayer.push(item);
    }
    if (notByLayer.length > 0) {
        const layers = [...new Set(notByLayer.map(p => p.layer))].slice(0, SAMPLE_SIZE).join(', ');
        issues.push(createIssue('STYLE_002', t('msg.styleNotByLayer', { count: notByLayer.length, layers }), { handles: notByLayer.map(p => p.handle) }));
    }
    return issues;
}

function runLayoutRules(index) {
    const issues = [];
    if (state.paperSpaceEntityCount > 0) {
        issues.push(createIssue('LAYOUT_001', t('msg.layoutPaperSpace', { count: state.paperSpaceEntityCount, names: state.paperSpaceLayouts.join(', ') || '-' })));
    }
    if (!planFrame(index)) issues.push(createIssue('LAYOUT_002', t('msg.layoutNoPlanFrame')));
    return issues;
}

function runDimensionRules() {
    return state.dimensionInfo.some(d => d.layer === DIMENSION_LAYER) ? [] : [createIssue('DIM_001', t('msg.dimNone'))];
}

function runHatchRules(index) {
    const nonSolid = index.onLayer(HATCH_LAYER).filter(i => i.kind === 'hatch' && !i.solid);
    if (nonSolid.length === 0) return [];
    const patterns = [...new Set(nonSolid.map(h => h.patternName || '?'))].join(', ');
    return [createIssue('HATCH_001', t('msg.hatchNotSolid', { count: nonSolid.length, patterns }), { handles: nonSolid.map(h => h.handle) })];
}

function runAllRules(index, rooms, outsideTexts) {
    return [
        ...runLayerRules(),
        ...runPolygonLayerRules(index, POLYGON_RULE_SPECS.room),
        ...runPolygonLayerRules(index, POLYGON_RULE_SPECS.area),
        ...runAoidRules(rooms, outsideTexts),
        ...runGeomRules(index),
        ...runTextRules(index),
        ...runStyleRules(index),
        ...runLayoutRules(index),
        ...runDimensionRules(),
        ...runHatchRules(index),
    ];
}

/** Sets room/area status from the issues that reference them (by room id or entity handle). */
function applyStatuses(issues, rooms, areas) {
    const roomsById = new Map(rooms.map(r => [r.id, r]));
    const byHandle = new Map([...rooms, ...areas].map(e => [e.handle, e]));
    const worsen = (entry, severity) => {
        if (!entry) return;
        if (severity === 'error') entry.status = 'error';
        else if (entry.status === 'ok') entry.status = 'warning';
    };
    for (const issue of issues) {
        if (issue.roomId) worsen(roomsById.get(issue.roomId), issue.severity);
        else if (issue.handle && (issue.category === 'POLY' || issue.category === 'GPOLY')) worsen(byHandle.get(issue.handle), issue.severity);
    }
}

// =============================================
// Orchestration
// =============================================

let uiWired = false;

/** One-time wiring of tab clicks, report buttons and keyboard access for list rows. */
export function initValidationUi() {
    if (uiWired) return;
    uiWired = true;
    for (const tab of dom.validationPanel.querySelectorAll('[data-vtab]')) {
        tab.addEventListener('click', e => { e.preventDefault(); switchValidationTab(tab.getAttribute('data-vtab')); });
    }
    dom.metricsGrid.addEventListener('click', e => {
        const btn = e.target.closest('[data-download]');
        if (!btn) return;
        if (btn.dataset.download === 'pdf') downloadPdfReport();
        else if (btn.dataset.download === 'excel') downloadExcelReport();
    });
    dom.sideList.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const row = e.target.closest('.vside-item, .rules-row, .rules-cat-sep');
        if (row) { e.preventDefault(); row.click(); }
    });
}

/** Runs extraction and all rules, then renders the results. keepTab re-renders the tab that was open. */
export function renderValidation({ keepTab = false } = {}) {
    const previousTab = state.activeTab;
    const index = indexRenderList(state.drawingData.renderList);

    log(t('log.extracting'));
    const { rooms, areas, deductions, appliedDeductions, outsideTexts } = extractPolygons(index);
    state.roomData = rooms;
    state.areaData = areas;
    log(t('log.extractResult', { rooms: rooms.length, layer: ROOM_LAYER, areas: areas.length }), 'success');
    if (deductions.length > 0) log(t('log.deductions', { count: appliedDeductions, total: deductions.length }));

    log(t('log.runningRules', { count: RULES.length }));
    state.validationErrors = runAllRules(index, rooms, outsideTexts);
    applyStatuses(state.validationErrors, rooms, areas);

    const summary = summarizeValidation(state.validationErrors);
    if (summary.errorCount === 0 && summary.warningCount === 0) log(t('log.validationOk'), 'success');
    else log(t('log.validationResult', { errors: summary.errorCount, warnings: summary.warningCount, rules: summary.firedCodes.size }), summary.errorCount > 0 ? 'error' : 'warn');

    renderMetricsCard(summary);
    dom.validationPanel.classList.add('visible');
    switchValidationTab(keepTab && previousTab ? previousTab : 'rules');

    const ngf = rooms.filter(r => !r.isDuplicate).reduce((s, r) => s + r.area, 0);
    log(t('log.score', { passed: summary.passedRules, total: summary.totalRules, score: summary.score, ngf: fmtNum(ngf, 1) }), summary.scoreClass === 'warning' ? 'warn' : summary.scoreClass);
    log(t('log.validationSummary', { rooms: rooms.length, areas: areas.length, rulesFired: summary.firedCodes.size, errors: summary.errorCount, warnings: summary.warningCount, score: summary.score }),
        summary.errorCount > 0 ? 'error' : summary.warningCount > 0 ? 'warn' : 'success');
}

function renderMetricsCard(summary) {
    const ngf = state.roomData.filter(r => !r.isDuplicate).reduce((s, r) => s + r.area, 0);
    const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    const item = (label, value, cls = '') =>
        `<div class="info-grid__item"><div class="info-grid__label">${esc(label)}</div><div class="info-grid__value ${cls}">${value}</div></div>`;
    dom.metricsGrid.innerHTML =
        item(t('metric.rooms'), fmtNum(state.roomData.length)) +
        item(t('metric.ngf'), fmtArea(ngf, 1)) +
        item(t('metric.score', { passed: summary.passedRules, total: summary.totalRules }), `${summary.score}%`, `info-grid__value--${summary.scoreClass}`) +
        `<div class="info-grid__download"><div class="info-grid__download-label">${esc(t('metric.report'))}</div><div class="info-grid__download-links">` +
        `<button type="button" class="info-grid__dl-btn" data-download="pdf">${icon} PDF</button>` +
        `<button type="button" class="info-grid__dl-btn" data-download="excel">${icon} Excel</button>` +
        '</div></div>';
    dom.metricsPanel.classList.add('visible');
}

function updateTabCounts() {
    const filter = state.resultFilter;
    const bySeverity = sev => state.validationErrors.filter(e => e.severity === sev).length;
    const byStatus = (list, status) => list.filter(e => e.status === status).length;
    const rulesOf = sev => RULES.filter(r => r.severity === sev);
    const firedOf = sev => new Set(state.validationErrors.filter(e => e.severity === sev).map(e => e.code)).size;

    if (filter === 'errors') {
        dom.tabLayerCount.textContent = 0;
        dom.tabErrorCount.textContent = bySeverity('error');
        dom.tabRoomCount.textContent = byStatus(state.roomData, 'error');
        dom.tabAreaCount.textContent = byStatus(state.areaData, 'error');
        dom.tabRulesCount.textContent = rulesOf('error').length - firedOf('error');
        dom.tabRulesTotal.textContent = rulesOf('error').length;
    } else if (filter === 'warnings') {
        dom.tabLayerCount.textContent = state.layerInfo.filter(l => layerStatus(l.name) !== 'ok').length;
        dom.tabErrorCount.textContent = bySeverity('warning');
        dom.tabRoomCount.textContent = byStatus(state.roomData, 'warning');
        dom.tabAreaCount.textContent = byStatus(state.areaData, 'warning');
        dom.tabRulesCount.textContent = rulesOf('warning').length - firedOf('warning');
        dom.tabRulesTotal.textContent = rulesOf('warning').length;
    } else {
        dom.tabLayerCount.textContent = state.layerInfo.length;
        dom.tabErrorCount.textContent = state.validationErrors.length;
        dom.tabRoomCount.textContent = state.roomData.length;
        dom.tabAreaCount.textContent = state.areaData.length;
        dom.tabRulesCount.textContent = RULES.length - new Set(state.validationErrors.map(e => e.code)).size;
        dom.tabRulesTotal.textContent = RULES.length;
    }
}

export function switchValidationTab(tabName) {
    state.activeTab = tabName;
    clearSelection({ rerender: false });

    for (const tab of dom.validationPanel.querySelectorAll('[data-vtab]')) {
        const active = tab.getAttribute('data-vtab') === tabName;
        tab.classList.toggle('validation-tabs__tab--active', active);
        tab.setAttribute('aria-selected', String(active));
    }

    const isDashboard = tabName === 'kpi';
    dom.validationSplit.style.display = isDashboard ? 'none' : '';
    dom.validationDashboard.style.display = isDashboard ? 'block' : 'none';
    dom.sideToggleAll.style.display = (tabName === 'rules' || tabName === 'errors') ? 'none' : '';

    updateTabCounts();
    switch (tabName) {
        case 'overview': renderLayersTab(); break;
        case 'errors': renderErrorsTab(); break;
        case 'rooms': renderPolygonTab({ entries: state.roomData, hidden: state.hiddenRoomIds, placeholder: 'search.rooms', empty: 'empty.noRooms', emptyFiltered: { errors: 'empty.noRoomErrors', warnings: 'empty.noRoomWarnings' }, subtitle: r => r.aoidText || r.aoid }); break;
        case 'areas': renderPolygonTab({ entries: state.areaData, hidden: state.hiddenAreaIds, placeholder: 'search.areas', empty: 'empty.noAreas', emptyHint: 'empty.noAreasHint', subtitle: a => a.layer }); break;
        case 'kpi': renderKpiTab(); break;
        case 'rules': renderRulesTab(); break;
    }

    if (!isDashboard) {
        resizeCanvas();
        render();
    }
}

// =============================================
// Side panel helpers
// =============================================

function resetSidePanel(placeholderKey) {
    dom.sideSearch.placeholder = t(placeholderKey);
    dom.sideSearch.value = '';
    dom.sideList.innerHTML = '';
    dom.sideSummary.innerHTML = '';
}

function renderEmpty(key, hintKey) {
    dom.sideList.innerHTML = `<div class="val-empty">${esc(t(key))}${hintKey ? `<br><small>${esc(t(hintKey))}</small>` : ''}</div>`;
}

function statusIcon(status) {
    return STATUS_ICON[status] || STATUS_ICON.ok;
}

function sortByStatus(list) {
    return list.slice().sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9));
}

function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
}

/** Filters rows by the search input; matches against the data-search attribute. */
function wireSearch() {
    dom.sideSearch.oninput = () => {
        const q = dom.sideSearch.value.toLowerCase();
        for (const row of dom.sideList.children) {
            row.style.display = (row.getAttribute('data-search') || '').toLowerCase().includes(q) ? '' : 'none';
        }
    };
}

/** Master checkbox that shows or hides all currently listed entries. */
function wireToggleAll(hiddenSet, visibleIds) {
    const sync = () => {
        const hiddenCount = visibleIds.filter(id => hiddenSet.has(id)).length;
        dom.sideToggleAll.checked = hiddenCount === 0;
        dom.sideToggleAll.indeterminate = hiddenCount > 0 && hiddenCount < visibleIds.length;
    };
    sync();
    dom.sideToggleAll.onchange = () => {
        const show = dom.sideToggleAll.checked;
        for (const id of visibleIds) { if (show) hiddenSet.delete(id); else hiddenSet.add(id); }
        for (const row of dom.sideList.querySelectorAll('.vside-item')) {
            const cb = row.querySelector('.vside-item__toggle');
            if (cb) { cb.checked = show; row.classList.toggle('hidden', !show); }
        }
        sync();
        render();
    };
    return sync;
}

/** A list row with an optional visibility checkbox; clicking the row (not the box) runs onSelect. */
function listRow({ id, hiddenSet, syncToggleAll, search, handle, status, columns, onSelect }) {
    const row = element('div', 'vside-item' + (status ? ' vside-item--' + status : '') + (hiddenSet?.has(id) ? ' hidden' : ''));
    row.setAttribute('data-search', search);
    row.tabIndex = 0;
    if (handle) row.setAttribute('data-handle', handle);

    let checkbox = null;
    if (hiddenSet) {
        checkbox = element('input', 'vside-item__toggle');
        checkbox.type = 'checkbox';
        checkbox.checked = !hiddenSet.has(id);
        checkbox.setAttribute('aria-label', t('viewer.toggleVisibility'));
        checkbox.addEventListener('change', ev => {
            ev.stopPropagation();
            if (checkbox.checked) hiddenSet.delete(id); else hiddenSet.add(id);
            row.classList.toggle('hidden', !checkbox.checked);
            syncToggleAll?.();
            render();
        });
        row.appendChild(checkbox);
    }
    for (const col of columns) row.appendChild(col);
    row.addEventListener('click', e => {
        if (e.target === checkbox) return;
        if (onSelect) onSelect(row);
        else if (checkbox) { checkbox.checked = !checkbox.checked; checkbox.dispatchEvent(new Event('change')); }
    });
    dom.sideList.appendChild(row);
    return row;
}

// ── Layers tab ──

function renderLayersTab() {
    resetSidePanel('search.layers');
    const layers = state.layerInfo.filter(l => matchesResultFilter(layerStatus(l.name) === 'ok' ? 'ok' : 'warning'));
    const ids = layers.map(l => l.name);
    const syncToggleAll = wireToggleAll(state.hiddenLayers, ids);

    for (const l of layers) {
        const ok = layerStatus(l.name) === 'ok';
        const status = element('span', 'vside-item__status', ok ? STATUS_ICON.ok : STATUS_ICON.warning);
        status.title = ok ? (CAFM_LAYER_SET.has(l.name) ? t('layer.cafmAllowed') : t('layer.default')) : t('layer.unknown');
        const swatch = element('div', 'vside-item__icon');
        swatch.style.background = l.colorHex;
        const name = element('span', 'vside-item__name', l.name);
        if (l.off || l.frozen) name.title = t(l.frozen ? 'layer.frozen' : 'layer.off');
        const value = element('span', 'vside-item__value', `${l.count} ${t('status.objects')}`);
        listRow({ id: l.name, hiddenSet: state.hiddenLayers, syncToggleAll, search: l.name, status: ok ? 'ok' : 'warning', columns: [status, swatch, name, value] });
    }
    wireSearch();
}

// ── Errors tab ──

function renderErrorsTab() {
    resetSidePanel('search.errors');
    const roomsById = new Map(state.roomData.map(r => [r.id, r]));
    const issues = state.validationErrors.filter(i => matchesResultFilter(i.severity)).sort((a, b) => STATUS_RANK[a.severity] - STATUS_RANK[b.severity]);

    if (issues.length === 0) {
        renderEmpty(state.validationErrors.length === 0 ? 'empty.noErrors' : state.resultFilter === 'errors' ? 'empty.noErrorsOnly' : 'empty.noWarnings');
        return;
    }

    for (const issue of issues) {
        const room = roomsById.get(issue.roomId);
        const items = state.drawingData.byHandle;
        const target = room ? null : (issue.handles || (issue.handle ? [issue.handle] : [])).flatMap(h => items.get(h) || []);
        const locatable = !!room || (target && target.length > 0);

        const status = element('span', 'vside-item__status', issue.severity === 'error' ? STATUS_ICON.error : STATUS_ICON.warning);
        const code = element('span', 'vside-item__rule-id', issue.code);
        const ref = element('span', 'vside-item__elem-ref',
            room ? room.aoid : issue.layer ? issue.layer : (issue.handles?.[0] || issue.handle) ? 'H:' + (issue.handles?.[0] || issue.handle) : '–');
        const desc = element('span', 'vside-item__desc', issue.message);
        desc.title = issue.message;

        const row = listRow({
            search: issue.code + ' ' + issue.message, handle: room ? room.handle : (issue.handle || issue.handles?.[0]),
            status: issue.severity, columns: [status, code, ref, desc],
            onSelect: () => {
                if (room) selectPolygon(room);
                else if (target.length > 1) highlightItems(target);
                else if (target.length === 1) selectItem(target[0], null, null, { zoom: true });
            },
        });
        row.classList.add('vside-item--errors');
        if (locatable) row.classList.add('vside-item--locatable');
    }
    wireSearch();
}

// ── Rooms / areas tabs ──

function renderPolygonTab({ entries, hidden, placeholder, empty, emptyHint, emptyFiltered, subtitle }) {
    resetSidePanel(placeholder);
    if (entries.length === 0) { renderEmpty(empty, emptyHint); return; }

    const listed = sortByStatus(entries).filter(e => matchesResultFilter(e.status));
    if (listed.length === 0) {
        renderEmpty(emptyFiltered?.[state.resultFilter] || empty);
        return;
    }
    const syncToggleAll = wireToggleAll(hidden, listed.map(e => e.id));

    for (const entry of listed) {
        const status = element('span', 'vside-item__status', statusIcon(entry.status));
        const name = element('span', 'vside-item__name', entry.aoid);
        name.title = subtitle(entry);
        const value = element('span', 'vside-item__value', fmtArea(entry.area, 1));
        listRow({
            id: entry.id, hiddenSet: hidden, syncToggleAll, search: entry.aoid + ' ' + subtitle(entry), handle: entry.handle,
            columns: [status, name, value],
            onSelect: () => selectPolygon(entry),
        });
    }
    wireSearch();
}

// ── KPI tab ──

function renderKpiTab() {
    const sections = buildKpiSections(state.roomData, state.areaData);
    const areaRow = r => `<tr><td class="kpi-abbr">${esc(r.abbr)}</td><td>${esc(r.label)}</td><td class="kpi-value">${formatArea(r.value)}</td><td class="kpi-pct">${formatShare(r.value, r.total)}</td></tr>`;
    const ratioRow = r => `<tr><td class="kpi-abbr">${esc(r.abbr)}</td><td>${esc(r.label)}</td><td class="kpi-value">${formatRatio(r.ratio)}</td></tr>`;
    const section = (titleKey, rows) => `<div class="val-kpi-section"><div class="val-kpi-title">${esc(t(titleKey))}</div><table class="val-kpi-table"><tbody>${rows}</tbody></table></div>`;

    // Building volume has no data source yet; the row keeps the SIA 416 structure visible
    const volume = section('kpiSection.volume', sections.volume.map(r => `<tr><td class="kpi-abbr">${esc(r.abbr)}</td><td>${esc(r.label)}</td><td class="kpi-value">${DASH}</td><td class="kpi-pct">${DASH}</td></tr>`).join(''));
    const areas = section('kpiSection.areas', sections.areas.map(areaRow).join(''));
    const din277 = section('kpiSection.din277', sections.din277.map(areaRow).join(''));
    const economy = section('kpiSection.economy', sections.economy.map(ratioRow).join(''));

    const k = sections.kpis;
    const segments = Object.entries({ HNF: k.hnf, NNF: k.nnf, VF: k.vf, FF: k.ff, KF: k.kf })
        .filter(([, v]) => v != null && v > 0)
        .map(([label, value]) => ({ label, value, color: SIA_COLORS[label].stroke }));
    const donut = buildDonut(segments, k.gf || k.ngf || 1);

    const entityRows = buildEntityRows(state.entitySummary)
        .map(e => `<tr><td class="kpi-abbr">${esc(e.type)}</td><td>${e.count}</td><td class="kpi-layer-cell">${esc(e.layers)}</td></tr>`).join('');
    const entities = entityRows ? section('kpiSection.entitySummary', entityRows) : '';

    dom.validationDashboard.innerHTML =
        `<div class="kpi-dashboard-content"><div class="val-kpi"><div>${volume}${areas}${din277}</div><div>${economy}${donut}${entities}</div></div></div>`;
}

function buildDonut(segments, total) {
    if (segments.length === 0) return `<div class="val-empty">${esc(t('empty.noChartData'))}</div>`;
    const r = 60, strokeWidth = 24;
    const circumference = 2 * Math.PI * r;
    let offset = 0;
    let svg = '<div class="val-donut"><svg viewBox="0 0 160 160" role="img">';
    svg += `<circle cx="80" cy="80" r="${r}" fill="none" stroke="#E5E5E5" stroke-width="${strokeWidth}"/>`;
    for (const seg of segments) {
        const share = seg.value / total;
        const dash = share * circumference;
        svg += `<circle cx="80" cy="80" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${strokeWidth}" ` +
            `stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}" stroke-dashoffset="${(-offset + circumference * 0.25).toFixed(2)}">` +
            `<title>${esc(t('sia.' + seg.label))}: ${fmtArea(seg.value, 1)} (${(share * 100).toFixed(1)}%)</title></circle>`;
        offset += dash;
    }
    svg += '</svg><div class="val-donut-legend">';
    for (const seg of segments) {
        svg += `<div class="val-donut-legend__item"><span class="val-donut-legend__color" style="background:${seg.color}"></span>` +
            `<span title="${esc(t('sia.' + seg.label))}">${seg.label}</span><span class="val-donut-legend__pct">${(seg.value / total * 100).toFixed(1)}%</span></div>`;
    }
    return svg + '</div></div>';
}

// ── Rules tab ──

function renderRulesTab() {
    resetSidePanel('search.rules');
    const { failed, passed } = splitRulesByOutcome(state.validationErrors);
    const filter = state.resultFilter;
    const listedFailed = filter === 'all' ? failed : failed.filter(f => f.rule.severity === (filter === 'errors' ? 'error' : 'warning'));
    const listedPassed = filter === 'all' ? passed : [];

    const renderGroup = (label, entries) => {
        const sep = element('div', 'rules-cat-sep');
        sep.tabIndex = 0;
        sep.setAttribute('data-search', label);
        sep.innerHTML = `<span class="rules-cat-sep__chevron"></span><span class="rules-cat-sep__label">${esc(label)}</span><span class="rules-cat-sep__stats">${entries.length}/${RULES.length}</span>`;
        dom.sideList.appendChild(sep);

        const rows = [];
        for (const { rule, count } of entries) {
            const status = count === 0 ? 'pass' : rule.severity === 'error' ? 'fail' : 'warn';
            const description = t('rule.' + rule.code);
            const row = element('div', 'rules-row');
            row.tabIndex = 0;
            row.setAttribute('data-search', `${rule.code} ${description} ${rule.code.split('_')[0]}`);
            row.innerHTML = `<span class="rules-row__sev rules-row__sev--${status}">${statusIcon(status === 'pass' ? 'ok' : status === 'fail' ? 'error' : 'warning')}</span>` +
                `<span class="rules-row__code">${rule.code}</span><span class="rules-row__desc" title="${esc(description)}">${esc(description)}</span>`;
            if (count > 0) {
                row.addEventListener('click', () => {
                    switchValidationTab('errors');
                    dom.sideSearch.value = rule.code;
                    dom.sideSearch.dispatchEvent(new Event('input'));
                });
            }
            rows.push(row);
            dom.sideList.appendChild(row);
        }
        sep.addEventListener('click', () => {
            const collapsed = sep.classList.toggle('rules-cat-sep--collapsed');
            for (const row of rows) row.style.display = collapsed ? 'none' : '';
        });
    };

    if (listedFailed.length > 0) renderGroup(t('tab.notPassed'), listedFailed);
    if (listedPassed.length > 0) renderGroup(t('tab.passed'), listedPassed);
    wireSearch();
}
