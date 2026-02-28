// =============================================
// Room Extraction, Validation Rules & Tab UI
// =============================================

import { state, dom, CAFM_LAYERS, AOID_TEXT_LAYERS } from './state.js';
import { fmtNum, esc, computePolygonArea, pointInPoly, log, hasSelfIntersection, hashVertices, visualCenter, computeKpis } from './utils.js';
import { t } from './i18n.js';
import { render, resizeCanvas, zoomToPolygon, zoomToItems, zoomToBounds, getItemBounds, showPopupForItem } from './renderer.js';
import { downloadPdfReport, downloadExcelReport } from './export.js';

// =============================================
// Rule Definitions
// =============================================

export const ALL_RULES = [
    { cat: 'LAYER', code: 'LAYER_001', sev: 'error' },
    { cat: 'LAYER', code: 'LAYER_002', sev: 'error' },
    { cat: 'LAYER', code: 'LAYER_003', sev: 'error' },
    { cat: 'LAYER', code: 'LAYER_004', sev: 'warning' },
    { cat: 'LAYER', code: 'LAYER_005', sev: 'warning' },
    { cat: 'LAYER', code: 'LAYER_006', sev: 'warning' },
    { cat: 'LAYER', code: 'LAYER_007', sev: 'warning' },
    { cat: 'LAYER', code: 'LAYER_008', sev: 'warning' },
    { cat: 'POLY',  code: 'POLY_001',  sev: 'error' },
    { cat: 'POLY',  code: 'POLY_002',  sev: 'error' },
    { cat: 'POLY',  code: 'POLY_003',  sev: 'error' },
    { cat: 'POLY',  code: 'POLY_004',  sev: 'warning' },
    { cat: 'POLY',  code: 'POLY_005',  sev: 'warning' },
    { cat: 'POLY',  code: 'POLY_006',  sev: 'error' },
    { cat: 'POLY',  code: 'POLY_007',  sev: 'warning' },
    { cat: 'GPOLY', code: 'GPOLY_001', sev: 'error' },
    { cat: 'GPOLY', code: 'GPOLY_002', sev: 'error' },
    { cat: 'GPOLY', code: 'GPOLY_003', sev: 'error' },
    { cat: 'GPOLY', code: 'GPOLY_004', sev: 'warning' },
    { cat: 'GPOLY', code: 'GPOLY_005', sev: 'warning' },
    { cat: 'AOID',  code: 'AOID_001',  sev: 'error' },
    { cat: 'AOID',  code: 'AOID_002',  sev: 'error' },
    { cat: 'AOID',  code: 'AOID_003',  sev: 'warning' },
    { cat: 'AOID',  code: 'AOID_004',  sev: 'warning' },
    { cat: 'AOID',  code: 'AOID_005',  sev: 'warning' },
    { cat: 'AOID',  code: 'AOID_006',  sev: 'warning' },
    { cat: 'GEOM',  code: 'GEOM_001',  sev: 'error' },
    { cat: 'GEOM',  code: 'GEOM_002',  sev: 'warning' },
    { cat: 'GEOM',  code: 'GEOM_003',  sev: 'error' },
    { cat: 'GEOM',  code: 'GEOM_004',  sev: 'warning' },
    { cat: 'GEOM',  code: 'GEOM_005',  sev: 'warning' },
    { cat: 'TEXT',  code: 'TEXT_001',   sev: 'warning' },
    { cat: 'TEXT',  code: 'TEXT_002',   sev: 'warning' },
    { cat: 'STYLE', code: 'STYLE_001', sev: 'warning' },
    { cat: 'STYLE', code: 'STYLE_002', sev: 'warning' },
    { cat: 'LAYOUT',code: 'LAYOUT_001',sev: 'warning' },
    { cat: 'LAYOUT',code: 'LAYOUT_002',sev: 'warning' },
    { cat: 'DIM',   code: 'DIM_001',   sev: 'warning' },
    { cat: 'DIM',   code: 'DIM_002',   sev: 'warning' },
    { cat: 'HATCH', code: 'HATCH_001', sev: 'warning' },
];

export function getRuleCatLabel(cat) { return t('ruleCat.' + cat); }

// =============================================
// Room Extraction & Validation
// =============================================

// ── Error helper ──
let errorId = 1;
function mkErr(severity, ruleCode, message, category, extra = {}) {
    return { id: errorId++, severity, ruleCode, message, category, ...extra };
}

// ── Room & Area Extraction ──
function extractRooms(renderList) {
    // AOID texts only from R_AOID layer
    const aoidTexts = renderList.filter(item => item.t === 'text' && item.l === 'R_AOID');
    const textItems = renderList.filter(item => item.t === 'text');

    // Room polygons on R_RAUMPOLYGON
    const roomPolys = renderList.filter(item =>
        item.t === 'poly' && item.closed && item.l === state.roomLayerName
    );

    // Floor polygons on R_GESCHOSSPOLYGON
    const areaPolys = renderList.filter(item =>
        item.t === 'poly' && item.closed && item.l === 'R_GESCHOSSPOLYGON'
    );

    const rooms = roomPolys.map((poly, idx) => {
        const areaM2 = computePolygonArea(poly.verts) / 1e6; // mm² → m²
        const center = visualCenter(poly.verts);

        // Find AOID text(s) inside polygon
        let label = '';
        const aoidMatches = [];
        for (const txt of aoidTexts) {
            if (pointInPoly(txt.x, txt.y, poly.verts)) {
                aoidMatches.push(txt.text.trim());
                if (!label || txt.text.length < label.length) {
                    label = txt.text.trim();
                }
            }
        }

        return {
            id: idx + 1,
            aoid: label || `R${idx + 1}`,
            area: Math.round(areaM2 * 100) / 100,
            centroid: center,
            vertices: poly.verts,
            layer: poly.l,
            handle: poly.handle,
            label,
            aoidMatches,
            et: poly.et,
            status: 'ok',
            siaCategory: 'HNF',
        };
    });

    const areas = areaPolys.map((poly, idx) => {
        const areaM2 = computePolygonArea(poly.verts) / 1e6;
        const center = visualCenter(poly.verts);

        let label = '';
        for (const txt of textItems) {
            if (pointInPoly(txt.x, txt.y, poly.verts)) {
                if (!label || txt.text.length < label.length) label = txt.text.trim();
            }
        }

        return {
            id: 1000 + idx,
            aoid: label || poly.l,
            area: Math.round(areaM2 * 100) / 100,
            centroid: center,
            vertices: poly.verts,
            layer: poly.l,
            handle: poly.handle,
            et: poly.et,
            status: 'ok',
        };
    });

    return { rooms, areas };
}

// =============================================
// 42-Rule Validation Engine
// =============================================

function runAbortChecks() {
    const errors = [];

    // ABORT_002: $INSUNITS not mm (4)
    if (state.insunits !== null && state.insunits !== 4) {
        const unitName = t('unit.' + state.insunits) || state.insunits;
        errors.push(mkErr('abort', 'ABORT_002',
            t('msg.abortNotMm', { unit: unitName }), 'ABORT'));
    }

    return errors;
}

function runLayerRules() {
    const errors = [];
    const layerNames = state.layerInfo.map(l => l.name);

    const checks = [
        { code: 'LAYER_001', name: 'R_RAUMPOLYGON', severity: 'error' },
        { code: 'LAYER_002', name: 'R_AOID', severity: 'error' },
        { code: 'LAYER_003', name: 'R_GESCHOSSPOLYGON', severity: 'error' },
        { code: 'LAYER_004', name: 'A_ARCHITEKTUR', severity: 'warning' },
        { code: 'LAYER_005', name: 'V_PLANLAYOUT', severity: 'warning' },
        { code: 'LAYER_006', name: 'V_BEMASSUNG', severity: 'warning' },
        { code: 'LAYER_007', name: 'A_SCHRAFFUR', severity: 'warning' },
    ];

    for (const chk of checks) {
        if (!layerNames.includes(chk.name)) {
            errors.push(mkErr(chk.severity, chk.code,
                t('msg.layerMissing', { name: chk.name }), 'LAYER', { layer: chk.name }));
        }
    }

    // LAYER_008: Unknown layers
    const allowed = new Set(CAFM_LAYERS.all);
    for (const l of state.layerInfo) {
        if (l.name === '0' || l.name === 'Defpoints') continue;
        if (!allowed.has(l.name)) {
            errors.push(mkErr('warning', 'LAYER_008',
                t('msg.layerUnknown', { name: l.name }), 'LAYER', { layer: l.name }));
        }
    }

    return errors;
}

function runPolyRules(renderList) {
    const errors = [];
    const layerName = 'R_RAUMPOLYGON';
    const items = renderList.filter(item => item.l === layerName);
    const polys = items.filter(item => item.t === 'poly');

    // POLY_006: Entity type must be LWPOLYLINE
    for (const item of items) {
        if (item.t === 'poly' && item.et !== 'LWPOLYLINE') {
            errors.push(mkErr('error', 'POLY_006',
                t('msg.polyNotLwpolyline', { layer: layerName, type: item.et }), 'POLY', { handle: item.handle }));
        }
    }

    for (const poly of polys) {
        // POLY_001: Closed check
        if (!poly.closed) {
            errors.push(mkErr('error', 'POLY_001',
                t('msg.polyNotClosed'), 'POLY', { handle: poly.handle }));
        }

        // POLY_002: Arc segments
        const hasBulge = poly.verts.some(v => v.bulge && Math.abs(v.bulge) > 1e-6);
        if (hasBulge) {
            errors.push(mkErr('error', 'POLY_002',
                t('msg.polyHasArcs'), 'POLY', { handle: poly.handle }));
        }

        // POLY_003: Vertex count
        if (poly.verts.length < 3) {
            errors.push(mkErr('error', 'POLY_003',
                t('msg.polyTooFewVerts'), 'POLY', { handle: poly.handle }));
        }

        // POLY_004: Area too small
        if (poly.closed && poly.verts.length >= 3) {
            const areaM2 = computePolygonArea(poly.verts) / 1e6;
            if (areaM2 < 0.25) {
                errors.push(mkErr('warning', 'POLY_004',
                    t('msg.polyTooSmall', { area: areaM2.toFixed(2) }), 'POLY', { handle: poly.handle }));
            }
        }

        // POLY_007: Self-intersection
        if (poly.closed && poly.verts.length >= 4 && hasSelfIntersection(poly.verts)) {
            errors.push(mkErr('warning', 'POLY_007',
                t('msg.polySelfIntersect'), 'POLY', { handle: poly.handle }));
        }
    }

    // POLY_005: Duplicate polygons
    const hashes = new Map();
    for (const poly of polys) {
        const h = hashVertices(poly.verts);
        if (hashes.has(h)) {
            errors.push(mkErr('warning', 'POLY_005',
                t('msg.polyDuplicate'), 'POLY', { handle: poly.handle }));
        } else {
            hashes.set(h, poly);
        }
    }

    return errors;
}

function runGPolyRules(renderList) {
    const errors = [];
    const layerName = 'R_GESCHOSSPOLYGON';
    const items = renderList.filter(item => item.l === layerName);
    const polys = items.filter(item => item.t === 'poly');

    // GPOLY_004: No floor polygon at all
    if (polys.length === 0) {
        errors.push(mkErr('warning', 'GPOLY_004',
            t('msg.gpolyNone'), 'GPOLY'));
        return errors;
    }

    // GPOLY_003: Entity type must be LWPOLYLINE
    for (const item of items) {
        if (item.t === 'poly' && item.et !== 'LWPOLYLINE') {
            errors.push(mkErr('error', 'GPOLY_003',
                t('msg.gpolyNotLwpolyline', { layer: layerName, type: item.et }), 'GPOLY', { handle: item.handle }));
        }
    }

    for (const poly of polys) {
        // GPOLY_001: Closed check
        if (!poly.closed) {
            errors.push(mkErr('error', 'GPOLY_001',
                t('msg.gpolyNotClosed'), 'GPOLY', { handle: poly.handle }));
        }

        // GPOLY_002: Arc segments
        if (poly.verts.some(v => v.bulge && Math.abs(v.bulge) > 1e-6)) {
            errors.push(mkErr('error', 'GPOLY_002',
                t('msg.gpolyHasArcs'), 'GPOLY', { handle: poly.handle }));
        }
    }

    // GPOLY_005: Duplicate polygons
    const hashes = new Map();
    for (const poly of polys) {
        const h = hashVertices(poly.verts);
        if (hashes.has(h)) {
            errors.push(mkErr('warning', 'GPOLY_005',
                t('msg.gpolyDuplicate'), 'GPOLY', { handle: poly.handle }));
        } else {
            hashes.set(h, poly);
        }
    }

    return errors;
}

function runAoidRules(renderList, rooms) {
    const errors = [];
    const aoidTexts = renderList.filter(item => item.t === 'text' && item.l === 'R_AOID');
    const roomPolys = renderList.filter(item =>
        item.t === 'poly' && item.closed && item.l === state.roomLayerName
    );

    // AOID_001: Room without AOID
    for (const room of rooms) {
        if (room.aoidMatches.length === 0) {
            errors.push(mkErr('error', 'AOID_001',
                t('msg.aoidMissing', { aoid: room.aoid }), 'AOID',
                { roomId: room.id, handle: room.handle }));
        }
    }

    // AOID_004: Multiple AOIDs in same polygon
    for (const room of rooms) {
        if (room.aoidMatches.length > 1) {
            errors.push(mkErr('warning', 'AOID_004',
                t('msg.aoidMultiple', { aoid: room.aoid, count: room.aoidMatches.length }), 'AOID',
                { roomId: room.id, handle: room.handle }));
        }
    }

    // AOID_002: Duplicate AOIDs
    const aoidCounts = {};
    for (const room of rooms) {
        if (room.label) {
            aoidCounts[room.label] = (aoidCounts[room.label] || 0) + 1;
        }
    }
    for (const [aoid, count] of Object.entries(aoidCounts)) {
        if (count > 1) {
            const dupeRooms = rooms.filter(r => r.label === aoid);
            for (const room of dupeRooms) {
                errors.push(mkErr('error', 'AOID_002',
                    t('msg.aoidNotUnique', { aoid, count }), 'AOID',
                    { roomId: room.id, handle: room.handle }));
            }
        }
    }

    // AOID_003: Format check — WWWW.GG.EE.RRR or WWWW.G.RRR
    const aoidRegex = /^\d{4}\.[A-Za-z0-9]{1,4}\.\d{2}\.\d{3}$/;
    const parkingRegex = /^\d{4}\.\d+\.\d{3}$/;
    for (const room of rooms) {
        if (room.label && !aoidRegex.test(room.label) && !parkingRegex.test(room.label)) {
            errors.push(mkErr('warning', 'AOID_003',
                t('msg.aoidFormatInvalid', { label: room.label }), 'AOID',
                { roomId: room.id, handle: room.handle }));
        }
    }

    // AOID_005: AOID text outside all room polygons
    for (const txt of aoidTexts) {
        let insideAny = false;
        for (const poly of roomPolys) {
            if (pointInPoly(txt.x, txt.y, poly.verts)) {
                insideAny = true;
                break;
            }
        }
        if (!insideAny) {
            errors.push(mkErr('warning', 'AOID_005',
                t('msg.aoidOutside', { text: txt.text.trim() }), 'AOID',
                { handle: txt.handle }));
        }
    }

    // AOID_006: AOID base point outside its matched polygon
    for (const room of rooms) {
        if (room.aoidMatches.length === 0) continue;
        const matchedTexts = aoidTexts.filter(txt =>
            room.aoidMatches.includes(txt.text.trim())
        );
        for (const txt of matchedTexts) {
            if (!pointInPoly(txt.x, txt.y, room.vertices)) {
                errors.push(mkErr('warning', 'AOID_006',
                    t('msg.aoidBaseOutside', { aoid: txt.text.trim() }), 'AOID',
                    { roomId: room.id, handle: room.handle }));
            }
        }
    }

    return errors;
}

function runGeomRules(renderList) {
    const errors = [];

    // GEOM_001: Drawing unit not mm
    if (state.insunits !== null && state.insunits !== 4) {
        const unitName = t('unit.' + state.insunits) || state.insunits;
        errors.push(mkErr('error', 'GEOM_001',
            t('msg.geomNotMm', { unit: unitName }), 'GEOM'));
    }

    // GEOM_002: Non-zero Z coordinates
    if (state.nonZeroZEntities.length > 0) {
        const count = state.nonZeroZEntities.length;
        const sample = state.nonZeroZEntities.slice(0, 3).map(e => `${e.type}@${e.layer}`).join(', ');
        errors.push(mkErr('warning', 'GEOM_002',
            t('msg.geomNonZeroZ', { count, sample }), 'GEOM'));
    }

    // GEOM_003: Forbidden entity types
    const forbidden = new Set(['MLINE', 'ELLIPSE', 'SPLINE']);
    const foundForbidden = {};
    for (const item of renderList) {
        if (forbidden.has(item.et)) {
            foundForbidden[item.et] = (foundForbidden[item.et] || 0) + 1;
        }
    }
    for (const [type, count] of Object.entries(foundForbidden)) {
        errors.push(mkErr('error', 'GEOM_003',
            t('msg.geomForbiddenType', { type, count }), 'GEOM'));
    }

    // GEOM_004: XREF blocks
    if (state.xrefBlocks.length > 0) {
        for (const xref of state.xrefBlocks) {
            const pathStr = xref.xrefPath ? t('msg.geomXrefPath', { xrefPath: xref.xrefPath }) : '';
            errors.push(mkErr('warning', 'GEOM_004',
                t('msg.geomXref', { name: xref.name, path: pathStr }), 'GEOM'));
        }
    }

    // GEOM_005: Elements outside plan frame
    const framePolys = renderList.filter(item =>
        item.t === 'poly' && item.closed && item.l === 'V_PLANLAYOUT' && item.verts.length >= 4
    );
    if (framePolys.length > 0) {
        // Use largest closed poly on V_PLANLAYOUT as plan frame
        let framePoly = framePolys[0];
        let maxArea = 0;
        for (const fp of framePolys) {
            const a = computePolygonArea(fp.verts);
            if (a > maxArea) { maxArea = a; framePoly = fp; }
        }
        // Get frame bounding box
        let fMinX = Infinity, fMinY = Infinity, fMaxX = -Infinity, fMaxY = -Infinity;
        for (const v of framePoly.verts) {
            if (v.x < fMinX) fMinX = v.x; if (v.x > fMaxX) fMaxX = v.x;
            if (v.y < fMinY) fMinY = v.y; if (v.y > fMaxY) fMaxY = v.y;
        }
        // Check CAFM-relevant layers for items outside frame bounds (with tolerance)
        const tol = 100; // 100mm tolerance
        const cafmLayers = new Set(CAFM_LAYERS.all);
        let outsideCount = 0;
        for (const item of renderList) {
            if (!cafmLayers.has(item.l)) continue;
            if (item.l === 'V_PLANLAYOUT') continue;
            let x, y;
            if (item.t === 'text' || item.t === 'point') { x = item.x; y = item.y; }
            else if (item.t === 'poly' && item.verts.length > 0) { x = item.verts[0].x; y = item.verts[0].y; }
            else if (item.t === 'line') { x = item.x1; y = item.y1; }
            else if (item.t === 'circle' || item.t === 'arc' || item.t === 'ellipse') { x = item.cx; y = item.cy; }
            else continue;
            if (x < fMinX - tol || x > fMaxX + tol || y < fMinY - tol || y > fMaxY + tol) {
                outsideCount++;
            }
        }
        if (outsideCount > 0) {
            errors.push(mkErr('warning', 'GEOM_005',
                t('msg.geomOutsideFrame', { count: outsideCount }), 'GEOM'));
        }
    }

    return errors;
}

function runTextRules(renderList) {
    const errors = [];
    const texts = renderList.filter(item => item.t === 'text');
    const allowedLayers = new Set(AOID_TEXT_LAYERS);

    // TEXT_001: Text on wrong layer
    const wrongLayerMap = {};
    for (const txt of texts) {
        if (!allowedLayers.has(txt.l)) {
            if (!wrongLayerMap[txt.l]) wrongLayerMap[txt.l] = [];
            wrongLayerMap[txt.l].push(txt.handle);
        }
    }
    for (const [layer, handles] of Object.entries(wrongLayerMap)) {
        errors.push(mkErr('warning', 'TEXT_001',
            t('msg.textWrongLayer', { count: handles.length, layer }), 'TEXT', { layer, handles }));
    }

    // TEXT_002: Font not ARIAL
    const wrongFontMap = {};
    for (const txt of texts) {
        if (txt.l === 'V_PLANLAYOUT') continue; // exempt per spec
        if (txt.fontName && !/arial/i.test(txt.fontName)) {
            if (!wrongFontMap[txt.fontName]) wrongFontMap[txt.fontName] = [];
            wrongFontMap[txt.fontName].push(txt.handle);
        }
    }
    for (const [font, handles] of Object.entries(wrongFontMap)) {
        errors.push(mkErr('warning', 'TEXT_002',
            t('msg.textWrongFont', { count: handles.length, font }), 'TEXT', { handles }));
    }

    return errors;
}

function runStyleRules(renderList) {
    const errors = [];

    // STYLE_001: Polyline width ≠ 0
    const widthPolys = renderList.filter(item =>
        item.t === 'poly' && item.width && item.width > 0
    );
    if (widthPolys.length > 0) {
        const layers = [...new Set(widthPolys.map(p => p.l))].slice(0, 3).join(', ');
        errors.push(mkErr('warning', 'STYLE_001',
            t('msg.stylePolyWidth', { count: widthPolys.length, layers }), 'STYLE',
            { handles: widthPolys.map(p => p.handle) }));
    }

    // STYLE_002: Color not ByLayer
    const cafmLayers = new Set(CAFM_LAYERS.all);
    const notByLayer = renderList.filter(item => cafmLayers.has(item.l) && item.byLayer === false);
    if (notByLayer.length > 0) {
        const layers = [...new Set(notByLayer.map(p => p.l))].slice(0, 3).join(', ');
        errors.push(mkErr('warning', 'STYLE_002',
            t('msg.styleNotByLayer', { count: notByLayer.length, layers }), 'STYLE',
            { handles: notByLayer.map(p => p.handle) }));
    }

    return errors;
}

function runLayoutRules() {
    const errors = [];

    // LAYOUT_001: Paper Space layouts present
    if (state.paperSpaceLayouts.length > 0) {
        errors.push(mkErr('warning', 'LAYOUT_001',
            t('msg.layoutPaperSpace', { count: state.paperSpaceLayouts.length, names: state.paperSpaceLayouts.join(', ') }), 'LAYOUT'));
    }

    // LAYOUT_002: No plan frame on V_PLANLAYOUT
    const { renderList } = state.drawingData;
    const framePolys = renderList.filter(item =>
        item.t === 'poly' && item.closed && item.l === 'V_PLANLAYOUT' && item.verts.length >= 4
    );
    if (framePolys.length === 0) {
        errors.push(mkErr('warning', 'LAYOUT_002',
            t('msg.layoutNoPlanFrame'), 'LAYOUT'));
    }

    return errors;
}

function runDimRules() {
    const errors = [];

    // DIM_001: No dimensions on V_BEMASSUNG
    const dimsOnLayer = state.dimensionInfo.filter(d => d.layer === 'V_BEMASSUNG');
    if (dimsOnLayer.length === 0) {
        errors.push(mkErr('warning', 'DIM_001',
            t('msg.dimNone'), 'DIM'));
    }

    // DIM_002: Non-associative dimensions
    const nonAssoc = state.dimensionInfo.filter(d => !d.associative);
    if (nonAssoc.length > 0) {
        errors.push(mkErr('warning', 'DIM_002',
            t('msg.dimNotAssociative', { count: nonAssoc.length }), 'DIM',
            { handles: nonAssoc.map(d => d.handle) }));
    }

    return errors;
}

function runHatchRules(renderList) {
    const errors = [];

    // HATCH_001: Hatch on A_SCHRAFFUR not SOLID
    const hatches = renderList.filter(item => item.t === 'hatchfill' && item.l === 'A_SCHRAFFUR');
    const nonSolid = hatches.filter(h => h.patternName && h.patternName.toUpperCase() !== 'SOLID');
    if (nonSolid.length > 0) {
        const patterns = [...new Set(nonSolid.map(h => h.patternName))].join(', ');
        errors.push(mkErr('warning', 'HATCH_001',
            t('msg.hatchNotSolid', { count: nonSolid.length, patterns }), 'HATCH',
            { handles: nonSolid.map(h => h.handle) }));
    }

    return errors;
}

function runAllRules(renderList, rooms) {
    let errors = [];
    errors = errors.concat(runLayerRules());
    errors = errors.concat(runPolyRules(renderList));
    errors = errors.concat(runGPolyRules(renderList));
    errors = errors.concat(runAoidRules(renderList, rooms));
    errors = errors.concat(runGeomRules(renderList));
    errors = errors.concat(runTextRules(renderList));
    errors = errors.concat(runStyleRules(renderList));
    errors = errors.concat(runLayoutRules());
    errors = errors.concat(runDimRules());
    errors = errors.concat(runHatchRules(renderList));

    // Update room statuses based on errors
    for (const err of errors) {
        if (err.roomId) {
            const room = rooms.find(r => r.id === err.roomId);
            if (room) {
                if (err.severity === 'error') room.status = 'error';
                else if (err.severity === 'warning' && room.status === 'ok') room.status = 'warning';
            }
        }
    }

    // Update area statuses based on GPOLY errors (matched by handle)
    for (const err of errors) {
        if (err.category === 'GPOLY' && err.handle) {
            const area = state.areaData.find(a => a.handle === err.handle);
            if (area) {
                if (err.severity === 'error') area.status = 'error';
                else if (err.severity === 'warning' && area.status === 'ok') area.status = 'warning';
            }
        }
    }

    return errors;
}

// =============================================
// Validation UI – Split-View with Side Panel
// =============================================

export function renderValidation() {
    const { renderList } = state.drawingData;

    // Reset error counter
    errorId = 1;
    state.validationAborted = false;
    state.abortReason = null;

    // Run abort checks first
    const abortErrors = runAbortChecks();
    if (abortErrors.length > 0) {
        state.validationAborted = true;
        state.abortReason = abortErrors.map(e => e.message).join('; ');
        state.validationErrors = abortErrors;
        state.roomData = [];
        state.areaData = [];
        renderAbortUI(abortErrors);
        log(t('log.aborted', { reason: state.abortReason }), 'error');
        return;
    }

    // Extract rooms and areas
    log(t('log.extracting'));
    const extracted = extractRooms(renderList);
    state.roomData = extracted.rooms;
    state.areaData = extracted.areas;
    log(t('log.extractResult', { rooms: state.roomData.length, layer: state.roomLayerName, areas: state.areaData.length }), 'success');

    // Run all 40 rules
    log(t('log.runningRules'));
    state.validationErrors = runAllRules(renderList, state.roomData);

    // Log validation summary
    const _errCount = state.validationErrors.filter(e => e.severity === 'error').length;
    const _warnCount = state.validationErrors.filter(e => e.severity === 'warning').length;
    const _rulesCodes = new Set(state.validationErrors.map(e => e.ruleCode));
    if (_errCount === 0 && _warnCount === 0) {
        log(t('log.validationOk'), 'success');
    } else {
        log(t('log.validationResult', { errors: _errCount, warnings: _warnCount, rules: _rulesCodes.size }),
            _errCount > 0 ? 'error' : 'warn');
    }

    // Update tab counts (using cached DOM refs)
    updateTabCounts();

    // Show metrics panel
    const errCount = state.validationErrors.filter(e => e.severity === 'error').length;
    const warnCount = state.validationErrors.filter(e => e.severity === 'warning').length;
    const totalRules = ALL_RULES.length;
    const passedRules = totalRules - new Set(state.validationErrors.map(e => e.ruleCode)).size;
    const score = Math.round((passedRules / totalRules) * 100);
    const scoreClass = score >= 90 ? 'success' : score >= 60 ? 'warning' : 'error';
    const ngf = state.roomData.reduce((s, r) => s + r.area, 0);
    log(t('log.score', { passed: passedRules, total: totalRules, score, ngf: fmtNum(ngf, 1) }),
        scoreClass === 'warning' ? 'warn' : scoreClass);
    const dlIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    dom.metricsGrid.innerHTML =
        `<div class="info-grid__item"><div class="info-grid__label">${esc(t('metric.rooms'))}</div><div class="info-grid__value">${fmtNum(state.roomData.length)}</div></div>` +
        `<div class="info-grid__item"><div class="info-grid__label">${esc(t('metric.ngf'))}</div><div class="info-grid__value">${fmtNum(ngf, 1)} m\u00B2</div></div>` +
        `<div class="info-grid__item"><div class="info-grid__label">${esc(t('metric.score', { passed: passedRules, total: totalRules }))}</div><div class="info-grid__value" style="color: var(--color-${scoreClass})">${score}%</div></div>` +
        `<div class="info-grid__download"><div class="info-grid__download-label">${esc(t('metric.report'))}</div><div class="info-grid__download-links">` +
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
    switchValidationTab('rules');

    const rulesFired = new Set(state.validationErrors.map(e => e.ruleCode)).size;
    log(t('log.validationSummary', { rooms: state.roomData.length, areas: state.areaData.length, rulesFired, errors: errCount, warnings: warnCount, score }),
        errCount > 0 ? 'error' : warnCount > 0 ? 'warn' : 'success');
}

function renderAbortUI(abortErrors) {
    // Show metrics with abort state
    dom.metricsGrid.innerHTML =
        `<div class="info-grid__item" style="grid-column: 1/-1"><div class="info-grid__label">${esc(t('abort.title'))}</div>` +
        `<div class="info-grid__value" style="color: var(--color-error)">\u26D4 ${abortErrors.map(e => e.ruleCode).join(', ')}</div></div>`;
    dom.metricsPanel.classList.add('visible');

    // Show validation panel with abort message
    dom.validationPanel.classList.add('visible');
    dom.validationSplit.style.display = 'none';
    dom.validationDashboard.style.display = 'block';
    dom.validationDashboard.innerHTML =
        `<div class="kpi-dashboard-content" style="padding: 2rem; text-align: center;">` +
        `<h2 style="color: var(--color-error); margin-bottom: 1rem;">\u26D4 ${esc(t('abort.title'))}</h2>` +
        abortErrors.map(e =>
            `<div style="margin: 0.5rem 0; padding: 1rem; background: rgba(255,0,0,0.08); border-radius: 8px; border-left: 4px solid var(--color-error);">` +
            `<strong>${e.ruleCode}</strong>: ${esc(e.message)}</div>`
        ).join('') +
        `<p style="margin-top: 1.5rem; color: var(--color-text-secondary);">${esc(t('abort.description'))}<br>` +
        `${esc(t('abort.instruction'))}</p></div>`;
}

function updateTabCounts() {
    if (dom.vtabLayerCount) {
        if (state.resultFilter === 'warnings') {
            const allowedSet = new Set(CAFM_LAYERS.all);
            const defaultLayers = new Set(['0', 'Defpoints']);
            dom.vtabLayerCount.textContent = state.layerInfo.filter(l =>
                !allowedSet.has(l.name) && !defaultLayers.has(l.name)).length;
        } else if (state.resultFilter === 'errors') {
            dom.vtabLayerCount.textContent = 0;
        } else {
            dom.vtabLayerCount.textContent = state.layerInfo.length;
        }
    }
    if (state.resultFilter === 'errors') {
        if (dom.vtabErrorCount) dom.vtabErrorCount.textContent = state.validationErrors.filter(e => e.severity === 'error').length;
        if (dom.vtabRoomCount) dom.vtabRoomCount.textContent = state.roomData.filter(r => r.status === 'error').length;
    } else if (state.resultFilter === 'warnings') {
        if (dom.vtabErrorCount) dom.vtabErrorCount.textContent = state.validationErrors.filter(e => e.severity === 'warning').length;
        if (dom.vtabRoomCount) dom.vtabRoomCount.textContent = state.roomData.filter(r => r.status === 'warning').length;
    } else {
        if (dom.vtabErrorCount) dom.vtabErrorCount.textContent = state.validationErrors.length;
        if (dom.vtabRoomCount) dom.vtabRoomCount.textContent = state.roomData.length;
    }
    if (dom.vtabAreaCount) {
        if (state.resultFilter === 'errors') {
            dom.vtabAreaCount.textContent = state.areaData.filter(a => a.status === 'error').length;
        } else if (state.resultFilter === 'warnings') {
            dom.vtabAreaCount.textContent = state.areaData.filter(a => a.status === 'warning').length;
        } else {
            dom.vtabAreaCount.textContent = state.areaData.length;
        }
    }
    if (dom.vtabRulesCount) {
        const firedCodes = new Set(state.validationErrors.map(e => e.ruleCode));
        if (state.resultFilter === 'errors') {
            const errorCodes = new Set(state.validationErrors.filter(e => e.severity === 'error').map(e => e.ruleCode));
            const errorRules = ALL_RULES.filter(r => r.sev === 'error');
            dom.vtabRulesCount.textContent = errorRules.length - errorCodes.size;
            if (dom.vtabRulesTotal) dom.vtabRulesTotal.textContent = errorRules.length;
        } else if (state.resultFilter === 'warnings') {
            const warnCodes = new Set(state.validationErrors.filter(e => e.severity === 'warning').map(e => e.ruleCode));
            const warnRules = ALL_RULES.filter(r => r.sev === 'warning');
            dom.vtabRulesCount.textContent = warnRules.length - warnCodes.size;
            if (dom.vtabRulesTotal) dom.vtabRulesTotal.textContent = warnRules.length;
        } else {
            dom.vtabRulesCount.textContent = ALL_RULES.length - firedCodes.size;
            if (dom.vtabRulesTotal) dom.vtabRulesTotal.textContent = ALL_RULES.length;
        }
    }
}

export function switchValidationTab(tabName) {
    state.validationMode = tabName;
    state.selectedRoom = null;

    // Update active tab styling
    const tabs = dom.validationPanel.querySelectorAll('[data-vtab]');
    tabs.forEach(tab => {
        tab.classList.toggle('validation-tabs__tab--active', tab.getAttribute('data-vtab') === tabName);
    });

    // Ensure canvas is back in split view (may have been moved to kz-viewer)
    const splitViewer = document.querySelector('.validation-viewer');
    if (splitViewer && dom.canvasWrap.parentElement !== splitViewer) {
        splitViewer.appendChild(dom.canvasWrap);
    }

    // Toggle split-view vs dashboard
    const isDashboard = tabName === 'kpi';
    dom.validationSplit.style.display = isDashboard ? 'none' : '';
    dom.validationDashboard.style.display = isDashboard ? 'block' : 'none';

    // Show/hide toggle-all checkbox (not relevant for rules or errors tab)
    dom.vsideToggleAll.style.display = (tabName === 'rules' || tabName === 'errors') ? 'none' : '';

    // Set layer filter per tab
    state.tabFilterLayers = null;

    // Update tab counts based on current filter
    updateTabCounts();

    // Render tab content
    switch (tabName) {
        case 'overview': renderOverviewTab(); break;
        case 'errors': renderErrorsTab(); break;
        case 'rooms': renderRoomsTab(); break;
        case 'areas': renderAreasTab(); break;
        case 'kpi': renderKpiTab(); break;
        case 'rules': renderRulesTab(); break;
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
// Tab 1: Overview (Layers)
// ─────────────────────────────────────────────
function renderOverviewTab() {
    dom.vsideSearch.placeholder = t('search.layers');
    dom.vsideList.innerHTML = '';
    dom.vsideSummary.innerHTML = '';

    // Determine layer status: required/optional = ok, default = ok, unknown = warning
    const allowedSet = new Set(CAFM_LAYERS.all);
    const defaultLayers = new Set(['0', 'Defpoints']);

    function getLayerStatus(layerName) {
        if (allowedSet.has(layerName)) return 'ok';
        if (defaultLayers.has(layerName)) return 'ok';
        return 'warning';
    }

    // Apply resultFilter
    const filteredLayers = state.layerInfo.filter(l => {
        if (state.resultFilter === 'all') return true;
        const s = getLayerStatus(l.name);
        if (state.resultFilter === 'errors') return false; // no layer has error status
        if (state.resultFilter === 'warnings') return s === 'warning';
        return true;
    });

    // Render layer list with checkboxes and status icons
    for (const l of filteredLayers) {
        const layerStatus = getLayerStatus(l.name);
        const div = document.createElement('div');
        div.className = 'vside-item vside-item--' + layerStatus + (state.hiddenLayers.has(l.name) ? ' hidden' : '');
        div.setAttribute('data-search', l.name);

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !state.hiddenLayers.has(l.name);
        cb.className = 'vside-item__toggle';

        cb.addEventListener('change', () => {
            if (cb.checked) { state.hiddenLayers.delete(l.name); div.classList.remove('hidden'); }
            else { state.hiddenLayers.add(l.name); div.classList.add('hidden'); }
            updateToggleAll(state.hiddenLayers, filteredLayers.map(x => x.name));
            render();
        });

        const status = document.createElement('span');
        status.className = 'vside-item__status';
        status.textContent = layerStatus === 'ok' ? '\u2713' : '\u26A0';
        status.title = layerStatus === 'ok'
            ? (allowedSet.has(l.name) ? t('layer.cafmAllowed') : t('layer.default'))
            : t('layer.unknown');

        const icon = document.createElement('div');
        icon.className = 'vside-item__icon';
        icon.style.background = l.colorHex;

        const name = document.createElement('span');
        name.className = 'vside-item__name';
        name.textContent = l.name;

        const value = document.createElement('span');
        value.className = 'vside-item__value';
        value.textContent = l.count + ' ' + t('status.objects');

        div.appendChild(cb);
        div.appendChild(status);
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
// Tab 2: Error messages (flat error list)
// ─────────────────────────────────────────────
function renderErrorsTab() {
    dom.vsideSearch.placeholder = t('search.errors');
    dom.vsideList.innerHTML = '';
    dom.vsideSummary.innerHTML = '';

    if (state.validationErrors.length === 0) {
        dom.vsideList.innerHTML = `<div class="val-empty">${esc(t('empty.noErrors'))}</div>`;
        return;
    }

    // Sort: errors first, then warnings
    let sorted = state.validationErrors.slice().sort((a, b) => {
        const order = { error: 0, warning: 1 };
        return (order[a.severity] || 1) - (order[b.severity] || 1);
    });

    // Apply result filter
    if (state.resultFilter === 'errors') {
        sorted = sorted.filter(e => e.severity === 'error');
        if (sorted.length === 0) {
            dom.vsideList.innerHTML = `<div class="val-empty">${esc(t('empty.noErrorsOnly'))}</div>`;
            return;
        }
    } else if (state.resultFilter === 'warnings') {
        sorted = sorted.filter(e => e.severity === 'warning');
        if (sorted.length === 0) {
            dom.vsideList.innerHTML = `<div class="val-empty">${esc(t('empty.noWarnings'))}</div>`;
            return;
        }
    }

    for (const err of sorted) {
        const room = state.roomData.find(r => r.id === err.roomId);
        const div = document.createElement('div');
        div.className = 'vside-item vside-item--errors vside-item--' + err.severity;
        div.setAttribute('data-search', err.ruleCode + ' ' + err.message);
        // Link to geometry: prefer room handle, then direct handle
        const errHandle = room ? room.handle : err.handle;
        if (errHandle) div.setAttribute('data-handle', errHandle);

        // Determine if this error can be located in the viewer
        const canLocate = !!(room || err.handle || (err.handles && err.handles.length > 0));
        if (canLocate) div.classList.add('vside-item--locatable');

        const status = document.createElement('span');
        status.className = 'vside-item__status';
        status.textContent = err.severity === 'error' ? '\u2716' : '\u26A0';

        // Rule ID
        const ruleId = document.createElement('span');
        ruleId.className = 'vside-item__rule-id';
        ruleId.textContent = err.ruleCode;

        // Element reference: room AOID, layer name, or handle
        const elemRef = document.createElement('span');
        elemRef.className = 'vside-item__elem-ref';
        if (room) {
            elemRef.textContent = room.aoid || room.label || ('H:' + room.handle);
        } else if (err.layer) {
            elemRef.textContent = err.layer;
        } else if (err.handles && err.handles.length > 0) {
            elemRef.textContent = 'H:' + err.handles[0];
        } else if (err.handle) {
            elemRef.textContent = 'H:' + err.handle;
        } else {
            elemRef.textContent = '\u2013';
        }

        // Description (message)
        const value = document.createElement('span');
        value.className = 'vside-item__desc';
        value.textContent = err.message;
        value.title = err.message;

        div.appendChild(status);
        div.appendChild(ruleId);
        div.appendChild(elemRef);
        div.appendChild(value);

        div.addEventListener('click', () => {
            dom.vsideList.querySelectorAll('.vside-item').forEach(el => el.classList.remove('vside-item--selected'));
            div.classList.add('vside-item--selected');

            if (room) {
                // Error linked to a room — zoom to room polygon
                state.selectedRoom = room;
                state.selectedItem = null;
                state.highlightedItems = null;
                zoomToPolygon(room.vertices);
                showPopupForItem(room.handle, room.centroid);
            } else if (err.handles && err.handles.length > 0 && state.drawingData) {
                // Aggregate error with multiple handles — highlight all, zoom to fit
                const items = err.handles
                    .map(h => state.drawingData.renderList.find(i => i.handle === h))
                    .filter(Boolean);
                if (items.length > 0) {
                    state.selectedRoom = null;
                    state.selectedItem = items[0];
                    state.highlightedItems = items;
                    zoomToItems(items);
                }
            } else if (err.handle && state.drawingData) {
                // Single handle — find and zoom to the entity
                const item = state.drawingData.renderList.find(i => i.handle === err.handle);
                if (item) {
                    state.selectedRoom = null;
                    state.highlightedItems = null;
                    state.selectedItem = item;
                    const bounds = getItemBounds(item);
                    if (bounds) {
                        zoomToBounds(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, 0.5);
                    }
                }
            }
        });

        dom.vsideList.appendChild(div);
    }

    wireSearch('data-search');
}

// ─────────────────────────────────────────────
// Tab 3: Rooms (flat room list)
// ─────────────────────────────────────────────
function renderRoomsTab() {
    dom.vsideSearch.placeholder = t('search.rooms');
    dom.vsideList.innerHTML = '';
    dom.vsideSummary.innerHTML = '';

    if (state.roomData.length === 0) {
        dom.vsideList.innerHTML = `<div class="val-empty">${esc(t('empty.noRooms'))}</div>`;
        return;
    }

    // Sort: errors first, then warnings, then ok
    let sorted = state.roomData.slice().sort((a, b) => {
        const order = { error: 0, warning: 1, ok: 2 };
        return (order[a.status] || 2) - (order[b.status] || 2);
    });

    // Apply result filter
    if (state.resultFilter === 'errors') {
        sorted = sorted.filter(r => r.status === 'error');
        if (sorted.length === 0) {
            dom.vsideList.innerHTML = `<div class="val-empty">${esc(t('empty.noRoomErrors'))}</div>`;
            return;
        }
    } else if (state.resultFilter === 'warnings') {
        sorted = sorted.filter(r => r.status === 'warning');
        if (sorted.length === 0) {
            dom.vsideList.innerHTML = `<div class="val-empty">${esc(t('empty.noRoomWarnings'))}</div>`;
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
// Tab 4: Areas (flat area list)
// ─────────────────────────────────────────────
function renderAreasTab() {
    dom.vsideSearch.placeholder = t('search.areas');
    dom.vsideList.innerHTML = '';
    dom.vsideSummary.innerHTML = '';

    if (state.areaData.length === 0) {
        dom.vsideList.innerHTML = `<div class="val-empty">${esc(t('empty.noAreas'))}<br><small>${esc(t('empty.noAreasHint'))}</small></div>`;
        return;
    }

    // Sort: errors first, then warnings, then ok (same as rooms)
    let sorted = state.areaData.slice().sort((a, b) => {
        const order = { error: 0, warning: 1, ok: 2 };
        return (order[a.status] || 2) - (order[b.status] || 2);
    });

    // Apply resultFilter
    if (state.resultFilter === 'errors') {
        sorted = sorted.filter(a => a.status === 'error');
    } else if (state.resultFilter === 'warnings') {
        sorted = sorted.filter(a => a.status === 'warning');
    }

    for (const area of sorted) {
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
            updateToggleAll(state.hiddenAreaIds, sorted.map(a => a.id));
            render();
        });

        const status = document.createElement('span');
        status.className = 'vside-item__status';
        status.textContent = area.status === 'ok' ? '\u2713' : area.status === 'warning' ? '\u26A0' : '\u2716';

        const name = document.createElement('span');
        name.className = 'vside-item__name';
        name.textContent = area.aoid;
        name.title = area.layer;

        const value = document.createElement('span');
        value.className = 'vside-item__value';
        value.textContent = fmtNum(area.area, 1) + ' m\u00B2';

        div.appendChild(cb);
        div.appendChild(status);
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

    wireToggleAll(state.hiddenAreaIds, sorted.map(a => a.id));
    wireSearch('data-search');
}

// ─────────────────────────────────────────────
// Tab 5: KPI / Metrics (full-width dashboard)
// ─────────────────────────────────────────────
function renderKpiTab() {
    const { hnf, nnf, vf, ff, nf, ngf, gf, kf, hasRooms, hasAreaPolys } = computeKpis(state.roomData, state.areaData);

    // Format helpers
    const DASH = '\u2014';
    const fmtArea = (v) => {
        if (v === null || v === undefined || v === 0) return DASH;
        return fmtNum(v, v >= 100 ? 0 : 1) + ' m\u00B2';
    };
    const fmtVol = (v) => {
        if (v === null || v === undefined) return DASH;
        return fmtNum(v, v >= 100 ? 0 : 1) + ' m\u00B3';
    };
    const pct = (v, total) => {
        if (v === null || v === undefined || v === 0 || total === null || total === undefined || total <= 0) return DASH;
        return Math.round((v / total) * 100) + '%';
    };
    const kzRow = (abbr, label, value, total, volFmt) =>
        `<tr><td class="kpi-abbr">${esc(abbr)}</td><td>${esc(label)}</td><td class="kpi-value">${volFmt ? fmtVol(value) : fmtArea(value)}</td><td class="kpi-pct">${pct(value, total)}</td></tr>`;

    let html = '<div class="kpi-dashboard-content">';
    html += '<div class="val-kpi">';

    // ── Left column ──
    html += '<div>';

    // Building volume
    html += '<div class="val-kpi-section">';
    html += `<div class="val-kpi-title">${esc(t('kpiSection.volume'))}</div>`;
    html += '<table class="val-kpi-table"><tbody>';
    html += kzRow('GV', t('kpi.GV'), null, null, true);
    html += '</tbody></table></div>';

    // Building areas — filled from room + area data
    html += '<div class="val-kpi-section">';
    html += `<div class="val-kpi-title">${esc(t('kpiSection.areas'))}</div>`;
    html += '<table class="val-kpi-table"><tbody>';
    html += kzRow('GF', t('kpi.GF'), gf, gf);
    html += kzRow('KF', t('kpi.KF'), kf, gf);
    html += kzRow('NGF', t('kpi.NGF'), hasRooms ? ngf : null, gf);
    html += kzRow('NF', t('kpi.NF'), hasRooms ? nf : null, gf);
    html += kzRow('HNF', t('kpi.HNF'), hasRooms ? hnf : null, gf);
    html += kzRow('NNF', t('kpi.NNF'), hasRooms ? nnf : null, gf);
    html += kzRow('VF', t('kpi.VF'), hasRooms ? vf : null, gf);
    html += kzRow('FF', t('kpi.FF'), hasRooms ? ff : null, gf);
    html += '</tbody></table></div>';

    // DIN 277 areas — sub-category sums
    const din277Sum = {};
    for (const r of state.roomData) {
        const sub = r.din277 || null;
        if (sub) din277Sum[sub] = (din277Sum[sub] || 0) + r.area;
    }
    html += '<div class="val-kpi-section">';
    html += `<div class="val-kpi-title">${esc(t('kpiSection.din277'))}</div>`;
    html += '<table class="val-kpi-table"><tbody>';
    html += kzRow('HNF 1', t('din277.1'), din277Sum['1'] || null, gf);
    html += kzRow('HNF 2', t('din277.2'), din277Sum['2'] || null, gf);
    html += kzRow('HNF 3', t('din277.3'), din277Sum['3'] || null, gf);
    html += kzRow('HNF 4', t('din277.4'), din277Sum['4'] || null, gf);
    html += kzRow('HNF 5', t('din277.5'), din277Sum['5'] || null, gf);
    html += kzRow('HNF 6', t('din277.6'), din277Sum['6'] || null, gf);
    html += kzRow('NNF 7', t('din277.7'), din277Sum['7'] || null, gf);
    html += kzRow('FF 8', t('din277.8'), din277Sum['8'] || null, gf);
    html += kzRow('VF 9', t('din277.9'), din277Sum['9'] || null, gf);
    html += kzRow('BUF 10', t('din277.10'), din277Sum['10'] || null, gf);
    html += '</tbody></table></div>';

    html += '</div>';

    // ── Right column ──
    html += '<div>';

    // Economic efficiency indicators
    html += '<div class="val-kpi-section">';
    html += `<div class="val-kpi-title">${esc(t('kpiSection.economy'))}</div>`;
    html += '<table class="val-kpi-table"><tbody>';
    html += `<tr><td class="kpi-abbr">NGF / GF</td><td>${esc(t('kpi.NGF_GF'))}</td><td class="kpi-value">${(gf && hasRooms) ? (ngf / gf).toFixed(2) : DASH}</td></tr>`;
    html += `<tr><td class="kpi-abbr">KF / GF</td><td>${esc(t('kpi.KF_GF'))}</td><td class="kpi-value">${(gf && kf !== null) ? (kf / gf).toFixed(2) : DASH}</td></tr>`;
    html += `<tr><td class="kpi-abbr">NF / NGF</td><td>${esc(t('kpi.NF_NGF'))}</td><td class="kpi-value">${(hasRooms && ngf > 0) ? (nf / ngf).toFixed(2) : DASH}</td></tr>`;
    html += `<tr><td class="kpi-abbr">HNF / NGF</td><td>${esc(t('kpi.HNF_NGF'))}</td><td class="kpi-value">${(hasRooms && ngf > 0) ? (hnf / ngf).toFixed(2) : DASH}</td></tr>`;
    html += '</tbody></table></div>';

    // Donut chart — SIA 416 breakdown: HNF, NNF, VF, FF, KF
    const donutSegments = {};
    if (hnf > 0) donutSegments.HNF = hnf;
    if (nnf > 0) donutSegments.NNF = nnf;
    if (vf > 0) donutSegments.VF = vf;
    if (ff > 0) donutSegments.FF = ff;
    if (kf !== null && kf > 0) donutSegments.KF = kf;
    const donutTotal = gf || ngf || 1;
    html += buildValidationDonut(donutSegments, 0, donutTotal);

    // Entity overview
    if (state.entitySummary.length > 0) {
        html += '<div class="val-kpi-section">';
        html += `<div class="val-kpi-title">${esc(t('kpiSection.entitySummary'))}</div>`;
        html += '<table class="val-kpi-table"><tbody>';
        for (const e of state.entitySummary) {
            const ls = e.layers.slice(0, 3).join(', ');
            const more = e.layers.length > 3 ? ' ...' : '';
            html += `<tr><td class="kpi-abbr">${esc(e.type)}</td><td>${e.count}</td><td class="kpi-layer-cell">${esc(ls + more)}</td></tr>`;
        }
        html += '</tbody></table></div>';
    }

    html += '</div>';

    html += '</div>'; // val-kpi
    html += '</div>'; // kpi-dashboard-content

    dom.validationDashboard.innerHTML = html;
}

// ─────────────────────────────────────────────
// Tab 6: Validation rules (flat rule table)
// ─────────────────────────────────────────────

function renderRulesTab() {
    dom.vsideSearch.placeholder = t('search.rules');
    dom.vsideList.innerHTML = '';
    dom.vsideSummary.innerHTML = '';

    // Count violations per rule code
    const violationCounts = {};
    for (const err of state.validationErrors) {
        violationCounts[err.ruleCode] = (violationCounts[err.ruleCode] || 0) + 1;
    }

    // Split rules into failed (errors first, then warnings) and passed
    const failed = [];
    const passed = [];
    for (const r of ALL_RULES) {
        const count = violationCounts[r.code] || 0;
        if (count > 0) {
            const status = r.sev === 'error' ? 'fail' : 'warn';
            failed.push({ rule: r, count, status });
        } else {
            passed.push({ rule: r, count: 0, status: 'pass' });
        }
    }
    // Sort failed: errors first, then warnings; within same severity by code
    failed.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'fail' ? -1 : 1;
        return a.rule.code.localeCompare(b.rule.code);
    });

    // Render a group (collapsible section + rule rows)
    const total = ALL_RULES.length;
    function renderGroup(label, items, collapsed) {
        const sep = document.createElement('div');
        sep.className = 'rules-cat-sep' + (collapsed ? ' rules-cat-sep--collapsed' : '');
        sep.setAttribute('data-search', label);
        sep.innerHTML =
            `<span class="rules-cat-sep__chevron"></span>` +
            `<span class="rules-cat-sep__label">${esc(label)}</span>` +
            `<span class="rules-cat-sep__stats">${items.length}/${total}</span>`;
        dom.vsideList.appendChild(sep);

        const rows = [];
        for (const { rule: r, count, status } of items) {
            const icon = status === 'pass' ? '\u2713' : status === 'fail' ? '\u2716' : '\u26A0';

            const div = document.createElement('div');
            div.className = 'rules-row';
            if (collapsed) div.style.display = 'none';
            div.setAttribute('data-code', r.code);
            div.setAttribute('data-cat', r.cat);
            const ruleDesc = t('rule.' + r.code);
            div.setAttribute('data-search', r.code + ' ' + ruleDesc + ' ' + r.cat);
            div.innerHTML =
                `<span class="rules-row__sev rules-row__sev--${status}">${icon}</span>` +
                `<span class="rules-row__code">${r.code}</span>` +
                `<span class="rules-row__desc" title="${esc(ruleDesc)}">${esc(ruleDesc)}</span>`;

            div.addEventListener('click', () => {
                if (count > 0) {
                    switchValidationTab('errors');
                    dom.vsideSearch.value = r.code;
                    dom.vsideSearch.dispatchEvent(new Event('input'));
                }
            });

            rows.push(div);
            dom.vsideList.appendChild(div);
        }

        sep.addEventListener('click', () => {
            const isCollapsed = sep.classList.toggle('rules-cat-sep--collapsed');
            for (const row of rows) {
                row.style.display = isCollapsed ? 'none' : '';
            }
        });
    }

    // Apply resultFilter to rules
    let filteredFailed = failed;
    let filteredPassed = passed;
    if (state.resultFilter === 'errors') {
        filteredFailed = failed.filter(f => f.rule.sev === 'error');
        filteredPassed = [];
    } else if (state.resultFilter === 'warnings') {
        filteredFailed = failed.filter(f => f.rule.sev === 'warning');
        filteredPassed = [];
    }

    // Failed first, then Passed — both expanded
    if (filteredFailed.length > 0) {
        renderGroup(t('tab.notPassed'), filteredFailed, false);
    }
    if (filteredPassed.length > 0) {
        renderGroup(t('tab.passed'), filteredPassed, false);
    }

    wireSearch('data-search');
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

    if (segments.length === 0) return `<div class="val-empty">${esc(t('empty.noChartData'))}</div>`;

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
