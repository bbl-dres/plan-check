// =============================================
// DWG parsing (LibreDWG WebAssembly) and conversion into render primitives
// Entity field names follow @mlightcad/libredwg-web 0.7.11 (Dwg* interfaces in lib/database).
// =============================================

import { state, INSUNITS_TO_MM } from './state.js';
import { log, showStatus, fmtSize, aciToHex, rgbIntToHex } from './utils.js';
import { t } from './i18n.js';
import {
    affineApply, affineMultiply, affineFromInsert, affineInfo,
    createBounds, expandBounds, mergeBounds, boundsOfPoints, isFiniteBounds,
    sampleArc, sampleEllipse, sampleSpline,
} from './geometry.js';

/**
 * @typedef {object} RenderItem
 * Common fields: kind, layer, entityType, handle, color (CSS hex), byLayer (colour inherited from the layer),
 * inBlock (expanded from a block reference or dimension block), bounds {minX, minY, maxX, maxY}.
 *   kind 'line'    x1, y1, x2, y2
 *   kind 'poly'    verts [{x, y, bulge}], closed, implicitlyClosed, width
 *   kind 'circle'  cx, cy, r
 *   kind 'arc'     cx, cy, r, startAngle, endAngle (counter-clockwise, radians)
 *   kind 'text'    x, y (anchor), baseX, baseY (insertion point), text, lines, height, rotation,
 *                  halign 'left'|'center'|'right', valign 'alphabetic'|'bottom'|'middle'|'top', widthFactor, fontName
 *   kind 'point'   x, y
 *   kind 'solid'   verts (filled polygon)
 *   kind 'hatch'   paths [[{x, y, bulge}]], solid, patternName
 */

const DEFAULT_TEXT_HEIGHT = 2.5;
const RAY_LENGTH = 1e6;
const MAX_BLOCK_DEPTH = 16;
const CLOSE_TOLERANCE_MM = 1;          // open polylines whose ends coincide within this distance count as closed
const Z_EPSILON = 1e-6;
const TEXT_WIDTH_PER_CHAR = 0.6;       // rough glyph width as a fraction of the text height
const MODEL_SPACE = '*MODEL_SPACE';
const PAPER_SPACE_PREFIX = '*PAPER_SPACE';
const BLOCK_FLAG_XREF = 4;
const ATTDEF_FLAG_INVISIBLE = 1;
const ATTDEF_FLAG_CONSTANT = 2;
const LWPOLYLINE_FLAG_CLOSED = 512;    // raw libredwg flag; bit 1 means "extrusion present"
const POLYLINE_FLAG_CLOSED = 1;        // DXF group 70 for POLYLINE2D/3D and SPLINE

// LibreDWG DWG_ERR_* bits with their message keys
const DWG_ERROR_FLAGS = [
    [1, 'dwg.crcError'], [2, 'dwg.unsupportedFeatures'], [4, 'dwg.unknownClasses'], [8, 'dwg.invalidType'],
    [16, 'dwg.invalidHandle'], [32, 'dwg.invalidEED'], [64, 'dwg.outOfRange'], [128, 'dwg.classesNotFound'],
    [256, 'dwg.sectionNotFound'], [512, 'dwg.pageNotFound'], [1024, 'dwg.internalError'], [2048, 'dwg.invalidFile'],
    [4096, 'dwg.ioError'], [8192, 'dwg.memoryError'],
];

// ── LibreDWG loading ──

let libraryPromise = null;

/** Loads the WebAssembly module once; concurrent callers share the same promise. */
function loadLibreDwg() {
    if (!libraryPromise) {
        log(t('log.wasmLoading'));
        showStatus(t('log.wasmLoadingStatus'));
        libraryPromise = import('./vendor/libredwg-web/dist/libredwg-web.js')
            .then(mod => mod.LibreDwg.create())
            .then(lib => { state.libredwg = lib; log(t('log.wasmLoaded'), 'success'); return lib; })
            .catch(err => { libraryPromise = null; log(t('log.wasmFailed', { error: err.message }), 'error'); throw err; });
    }
    return libraryPromise;
}

/**
 * Reads a DWG into the WASM heap. LibreDWG reports parse problems only through
 * console output ("Open dwg file with error code: N"), so the console is captured meanwhile.
 */
function readDwg(lib, buffer) {
    const messages = [];
    const original = { log: console.log, warn: console.warn, error: console.error };
    const capture = fn => (...args) => { messages.push(args.map(String).join(' ')); fn.apply(console, args); };
    console.log = capture(original.log);
    console.warn = capture(original.warn);
    console.error = capture(original.error);
    let pointer;
    try {
        pointer = lib.dwg_read_data(buffer, 0);
    } finally {
        Object.assign(console, original);
    }
    const match = messages.map(m => /error code:\s*(\d+)/i.exec(m)).find(Boolean);
    return { pointer, errorCode: match ? parseInt(match[1], 10) : 0 };
}

function describeReadFailure(code) {
    if (!code) return t('dwg.readFailed');
    const flags = DWG_ERROR_FLAGS.filter(([bit]) => code & bit).map(([, key]) => t(key)).join(', ');
    return `${t('dwg.readFailed')} ${t('dwg.readFailedDetail', { code, flags })} ${t('dwg.arxHint')}`;
}

function isPaperSpaceName(name) {
    return !!name && name.toUpperCase().startsWith(PAPER_SPACE_PREFIX);
}

/** Model-space entities only; db.entities also contains every paper-space layout. */
function modelSpaceEntities(db) {
    const records = db.tables?.BLOCK_RECORD?.entries || [];
    const model = records.find(r => (r.name || '').toUpperCase() === MODEL_SPACE);
    return model?.entities || db.entities || [];
}

/** Parses a DWG file and returns the converted database plus model-space entities and layers. */
export async function processDwgFile(file) {
    const t0 = performance.now();
    log(t('log.fileInfo', { name: file.name, size: fmtSize(file.size) }));

    showStatus(t('log.fileReading'));
    const buffer = await file.arrayBuffer();
    const lib = await loadLibreDwg();

    showStatus(t('log.parsing'));
    log(t('log.parsing'));
    const { pointer, errorCode } = readDwg(lib, buffer);
    if (pointer == null) throw new Error(describeReadFailure(errorCode));
    if (errorCode > 0) log(t('dwg.wasmWarning', { code: errorCode }), 'warn');
    log(t('log.parsed'), 'success');

    showStatus(t('log.converting'));
    let db, stats, version;
    try {
        version = lib.dwg_get_version_type(pointer);
        ({ database: db, stats } = lib.convertEx(pointer));
    } finally {
        lib.dwg_free(pointer);
    }
    if (stats.unknownEntityCount > 0) log(t('log.unknownTypes', { count: stats.unknownEntityCount }), 'warn');

    const entities = modelSpaceEntities(db);
    const layers = db.tables?.LAYER?.entries || [];
    log(t('log.entitiesLayers', { entities: entities.length, layers: layers.length }), 'success');

    const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
    log(t('log.processingTime', { elapsed }), 'success');

    const versionLabel = version ? `${version.hdr} (${version.description})` : '-';
    return { db, entities, layers, elapsed, version: versionLabel };
}

// ── Text helpers ──

/** Strips MTEXT formatting codes and decodes the classic %% and \U+ escapes. */
function decodeCadText(s) {
    return String(s)
        .replace(/\\P/g, '\n')
        .replace(/\\~/g, ' ')
        .replace(/\\[fFHWACcTQpq][^;]*;/g, '')
        .replace(/\\S([^^;]*)\^([^;]*);/g, '$1/$2')
        .replace(/\\[LlOoKk]/g, '')
        .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/[{}]/g, '')
        .replace(/\\\\/g, '\\')
        .replace(/%%[dD]/g, '°')
        .replace(/%%[cC]/g, 'Ø')
        .replace(/%%[pP]/g, '±')
        .replace(/%%[uUoO]/g, '');
}

/** DXF TEXT justification → anchor point and canvas alignment. */
function textAlignment(base, insertion, alignment) {
    const halign = base.halign || 0, valign = base.valign || 0;
    if (halign === 0 && valign === 0) return { anchor: insertion, halign: 'left', valign: 'alphabetic' };
    const anchor = alignment || insertion;
    const h = { 0: 'left', 1: 'center', 2: 'right', 3: 'left', 4: 'center', 5: 'left' }[halign] || 'left';
    let v = { 0: 'alphabetic', 1: 'bottom', 2: 'middle', 3: 'top' }[valign] || 'alphabetic';
    if (halign === 4) v = 'middle';
    return { anchor: (halign === 3 || halign === 5) ? insertion : anchor, halign: h, valign: v };
}

/** MTEXT attachment point (1–9, top-left to bottom-right) → canvas alignment. */
function mtextAlignment(attachmentPoint) {
    const ap = Math.min(9, Math.max(1, attachmentPoint || 1)) - 1;
    return {
        halign: ['left', 'center', 'right'][ap % 3],
        valign: ['top', 'middle', 'bottom'][Math.floor(ap / 3)],
    };
}

// ── Drawing preparation ──

/**
 * Converts model-space entities into flat render primitives (block references expanded),
 * collects drawing facts for the validation rules and returns { renderList, bounds, byHandle }.
 */
export function prepareDrawingData(entities, layers, db) {
    const header = db.header || {};
    state.insunits = header.INSUNITS ?? header.$INSUNITS ?? null;
    state.unitScale = INSUNITS_TO_MM[state.insunits] ?? 1;
    const closeTolerance = CLOSE_TOLERANCE_MM / state.unitScale;

    const layerColor = {};
    for (const l of layers) layerColor[l.name] = l.color != null ? rgbIntToHex(l.color) : aciToHex(l.colorIndex);

    state.styleFontMap = {};
    for (const s of db.tables?.STYLE?.entries || []) {
        if (s.name) state.styleFontMap[s.name] = s.font || s.bigFont || '';
    }

    state.paperSpaceLayouts = (db.objects?.LAYOUT || [])
        .map(l => l.layoutName || '')
        .filter(name => name && name.toUpperCase() !== 'MODEL');

    const blocks = new Map();
    state.xrefBlocks = [];
    state.paperSpaceEntityCount = 0;
    for (const record of db.tables?.BLOCK_RECORD?.entries || []) {
        const name = record.name || '';
        if (isPaperSpaceName(name)) {
            // Every layout owns one VIEWPORT entity by default; only other entities mean the layout is in use
            state.paperSpaceEntityCount += (record.entities || []).filter(e => e.type !== 'VIEWPORT').length;
            continue;
        }
        if (record.flags & BLOCK_FLAG_XREF) state.xrefBlocks.push({ name });
        if (record.entities?.length && name.toUpperCase() !== MODEL_SPACE) blocks.set(name, record);
    }
    if (blocks.size > 0) log(t('log.blockDefs', { count: blocks.size }));
    if (state.xrefBlocks.length > 0) log(t('log.xrefBlocks', { count: state.xrefBlocks.length }));

    const renderList = [];
    const byHandle = new Map();
    const bounds = createBounds();
    const seenZ = new Set();
    const seenDimensions = new Set();
    state.nonZeroZEntities = [];
    state.dimensionInfo = [];
    let insertCount = 0;

    function push(item) {
        if (!isFiniteBounds(item.bounds)) return;
        renderList.push(item);
        mergeBounds(bounds, item.bounds);
        if (item.handle) {
            const list = byHandle.get(item.handle);
            if (list) list.push(item); else byHandle.set(item.handle, [item]);
        }
    }

    /** ByBlock takes the reference's colour, ByLayer the (effective) layer's, true colour wins over both. */
    function resolveColor(e, layer, ctx) {
        if (e.color != null) return { color: rgbIntToHex(e.color), byLayer: false };
        const index = e.colorIndex;
        if (index === 0) return { color: ctx.color || layerColor[layer] || '#CCCCCC', byLayer: false };
        if (index == null || index === 256) return { color: layerColor[layer] || '#CCCCCC', byLayer: true };
        return { color: aciToHex(index), byLayer: false };
    }

    function recordZ(e, base) {
        for (const pt of [e.startPoint, e.endPoint, e.insertionPoint, e.center, e.position, e.vertices?.[0]]) {
            if (pt && Math.abs(pt.z || 0) > Z_EPSILON && !seenZ.has(base.handle)) {
                seenZ.add(base.handle);
                state.nonZeroZEntities.push({ handle: base.handle, layer: base.layer, type: base.entityType, z: pt.z });
                return;
            }
        }
    }

    function polyItem(base, verts, closed, extra = {}) {
        push({ kind: 'poly', ...base, verts, closed, bounds: boundsOfPoints(verts), ...extra });
    }

    /**
     * ctx: { m: affine matrix or null, layer: reference layer, color: reference colour,
     *        depth: block nesting depth, chain: Set of block names being expanded }
     */
    function addEntity(e, ctx) {
        if (!e || e.isVisible === false) return;
        const flip = !!(e.extrusionDirection && e.extrusionDirection.z < 0); // OCS with normal (0,0,-1): mirror X
        const layer = (e.layer === '0' && ctx.layer) ? ctx.layer : (e.layer || '0');
        const { color, byLayer } = resolveColor(e, layer, ctx);
        const base = { layer, entityType: e.type || 'UNKNOWN', handle: e.handle || '', color, byLayer, inBlock: ctx.depth > 0 };
        const m = ctx.m;
        const info = m ? affineInfo(m) : { mirrored: false, scale: 1, uniform: true };
        const mirrored = flip !== info.mirrored;
        const tp = (x, y) => (m ? affineApply(m, flip ? -x : x, y) : { x: flip ? -x : x, y });
        const toVerts = (points, keepBulge) => points.map(v => {
            const p = tp(v.x, v.y);
            return { x: p.x, y: p.y, bulge: keepBulge && v.bulge ? (mirrored ? -v.bulge : v.bulge) : 0 };
        });
        const localRotation = r => (flip ? Math.PI - r : r) + (m ? Math.atan2(m[1], m[0]) : 0);
        recordZ(e, base);

        switch (e.type) {
            case 'LINE': {
                if (!e.startPoint || !e.endPoint) break;
                const p1 = tp(e.startPoint.x, e.startPoint.y), p2 = tp(e.endPoint.x, e.endPoint.y);
                push({ kind: 'line', ...base, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, bounds: boundsOfPoints([p1, p2]) });
                break;
            }
            case 'RAY':
            case 'XLINE': {
                if (!e.firstPoint || !e.unitDirection) break;
                const d = e.unitDirection, f = e.firstPoint;
                const from = e.type === 'RAY' ? f : { x: f.x - d.x * RAY_LENGTH, y: f.y - d.y * RAY_LENGTH };
                const p1 = tp(from.x, from.y), p2 = tp(f.x + d.x * RAY_LENGTH, f.y + d.y * RAY_LENGTH);
                // Construction lines must not blow up the drawing extents
                const anchor = tp(f.x, f.y);
                push({ kind: 'line', ...base, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, bounds: boundsOfPoints([anchor]) });
                break;
            }
            case 'LWPOLYLINE':
            case 'POLYLINE2D':
            case 'POLYLINE3D': {
                if (!e.vertices || e.vertices.length < 2) break;
                const verts = toVerts(e.vertices, e.type !== 'POLYLINE3D');
                const flagClosed = e.type === 'LWPOLYLINE' ? !!(e.flag & LWPOLYLINE_FLAG_CLOSED) : !!(e.flag & POLYLINE_FLAG_CLOSED);
                let implicitlyClosed = false;
                if (!flagClosed && verts.length > 2) {
                    const f = verts[0], l = verts[verts.length - 1];
                    implicitlyClosed = Math.hypot(f.x - l.x, f.y - l.y) <= closeTolerance;
                }
                let width = e.constantWidth || 0;
                for (const v of e.vertices) width = Math.max(width, v.startWidth || 0, v.endWidth || 0);
                width = Math.max(width, e.startWidth || 0, e.endWidth || 0);
                polyItem(base, verts, flagClosed || implicitlyClosed, { implicitlyClosed, width });
                break;
            }
            case 'CIRCLE': {
                if (!e.center || !(e.radius > 0)) break;
                const c = tp(e.center.x, e.center.y);
                if (info.uniform) {
                    const r = e.radius * info.scale;
                    push({ kind: 'circle', ...base, cx: c.x, cy: c.y, r, bounds: { minX: c.x - r, minY: c.y - r, maxX: c.x + r, maxY: c.y + r } });
                } else {
                    polyItem(base, toVerts(sampleArc(e.center.x, e.center.y, e.radius, 0, Math.PI * 2, true, 32), false), true);
                }
                break;
            }
            case 'ARC': {
                if (!e.center || !(e.radius > 0) || e.startAngle == null || e.endAngle == null) break;
                if (!info.uniform) {
                    polyItem(base, toVerts(sampleArc(e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle, true), false), false);
                    break;
                }
                const c = tp(e.center.x, e.center.y);
                const r = e.radius * info.scale;
                let ps = tp(e.center.x + e.radius * Math.cos(e.startAngle), e.center.y + e.radius * Math.sin(e.startAngle));
                let pe = tp(e.center.x + e.radius * Math.cos(e.endAngle), e.center.y + e.radius * Math.sin(e.endAngle));
                if (mirrored) [ps, pe] = [pe, ps]; // a mirrored arc runs the other way round
                push({
                    kind: 'arc', ...base, cx: c.x, cy: c.y, r,
                    startAngle: Math.atan2(ps.y - c.y, ps.x - c.x), endAngle: Math.atan2(pe.y - c.y, pe.x - c.x),
                    bounds: { minX: c.x - r, minY: c.y - r, maxX: c.x + r, maxY: c.y + r },
                });
                break;
            }
            case 'ELLIPSE': {
                if (!e.center || !e.majorAxisEndPoint) break;
                const full = e.startAngle == null || e.endAngle == null || Math.abs((e.endAngle - e.startAngle) % (Math.PI * 2)) < 1e-9;
                const pts = sampleEllipse(e.center.x, e.center.y, e.majorAxisEndPoint.x, e.majorAxisEndPoint.y,
                    e.axisRatio || 1, e.startAngle || 0, full ? Math.PI * 2 : e.endAngle, true);
                polyItem(base, toVerts(pts, false), full);
                break;
            }
            case 'SPLINE': {
                let pts = null;
                if (e.controlPoints && e.controlPoints.length > 1) pts = sampleSpline(e.degree, e.knots, e.controlPoints, e.weights);
                else if (e.fitPoints && e.fitPoints.length > 1) pts = e.fitPoints;
                if (!pts || pts.length < 2) break;
                polyItem(base, toVerts(pts, false), !!(e.flag & POLYLINE_FLAG_CLOSED));
                break;
            }
            case 'LEADER': {
                if (e.vertices && e.vertices.length > 1) polyItem(base, toVerts(e.vertices, false), false);
                break;
            }
            case 'MLINE': {
                const pts = (e.vertices || []).map(v => v.vertex).filter(p => p && Number.isFinite(p.x));
                if (pts.length > 1) polyItem(base, toVerts(pts, false), false);
                break;
            }
            case 'POINT': {
                if (!e.position) break;
                const p = tp(e.position.x, e.position.y);
                push({ kind: 'point', ...base, x: p.x, y: p.y, bounds: boundsOfPoints([p]) });
                break;
            }
            case 'SOLID':
            case 'TRACE':
            case '3DFACE': {
                // SOLID/TRACE corners are stored in bow-tie order (1-2-4-3); 3DFACE in ring order
                const order = e.type === '3DFACE' ? [e.corner1, e.corner2, e.corner3, e.corner4] : [e.corner1, e.corner2, e.corner4, e.corner3];
                const pts = order.filter(Boolean);
                if (pts.length < 3) break;
                const verts = toVerts(pts, false);
                push({ kind: 'solid', ...base, verts, bounds: boundsOfPoints(verts) });
                break;
            }
            case 'TEXT': {
                addText(base, ctx, e, e.startPoint, e.endPoint);
                break;
            }
            case 'ATTRIB':
            case 'ATTDEF': {
                if (e.flags & ATTDEF_FLAG_INVISIBLE) break;
                const tb = (e.text && typeof e.text === 'object') ? e.text : null;
                if (!tb) break;
                addText(base, ctx, tb, tb.startPoint, e.alignmentPoint || tb.endPoint);
                break;
            }
            case 'MTEXT': {
                if (!e.insertionPoint || !e.text) break;
                const p = tp(e.insertionPoint.x, e.insertionPoint.y);
                const rotation = e.direction ? Math.atan2(e.direction.y, e.direction.x) : (e.rotation || 0);
                const { halign, valign } = mtextAlignment(e.attachmentPoint);
                pushText(base, {
                    x: p.x, y: p.y, baseX: p.x, baseY: p.y,
                    text: decodeCadText(e.text), height: (e.textHeight || DEFAULT_TEXT_HEIGHT) * info.scale,
                    rotation: localRotation(rotation), halign, valign, widthFactor: 1, lineSpacing: e.lineSpacing || 1,
                    fontName: state.styleFontMap[e.styleName || ''] || '',
                });
                break;
            }
            case 'HATCH': {
                addHatch(base, e, tp, mirrored);
                break;
            }
            case 'DIMENSION': {
                if (!seenDimensions.has(base.handle)) {
                    seenDimensions.add(base.handle);
                    state.dimensionInfo.push({ handle: base.handle, layer });
                }
                const block = e.name ? blocks.get(e.name) : null;
                if (block) {
                    expandBlock(block, { ...ctx, layer, color, depth: ctx.depth + 1 });
                } else {
                    const pts = [e.definitionPoint, e.subDefinitionPoint1, e.subDefinitionPoint2].filter(Boolean);
                    for (let i = 0; i + 1 < pts.length; i++) {
                        const p1 = tp(pts[i].x, pts[i].y), p2 = tp(pts[i + 1].x, pts[i + 1].y);
                        push({ kind: 'line', ...base, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, bounds: boundsOfPoints([p1, p2]) });
                    }
                    if (e.textPoint && e.measurement != null) {
                        const p = tp(e.textPoint.x, e.textPoint.y);
                        pushText(base, {
                            x: p.x, y: p.y, baseX: p.x, baseY: p.y, text: e.text || e.measurement.toFixed(0),
                            height: DEFAULT_TEXT_HEIGHT * info.scale, rotation: localRotation(e.textRotation || 0),
                            halign: 'center', valign: 'middle', widthFactor: 1, lineSpacing: 1, fontName: '',
                        });
                    }
                }
                break;
            }
            case 'INSERT': {
                if (!e.insertionPoint || !e.name) break;
                insertCount++;
                const block = blocks.get(e.name);
                if (!block || ctx.depth >= MAX_BLOCK_DEPTH || ctx.chain.has(e.name)) break;

                const ip = e.insertionPoint;
                let sx = e.xScale ?? 1, sy = e.yScale ?? 1, rot = e.rotation || 0, ix = ip.x;
                if (flip) { ix = -ix; sy = -sy; rot = Math.PI - rot; } // OCS flip expressed as scale/rotation
                const basePt = block.basePoint || { x: 0, y: 0 };
                const local = affineFromInsert(ix, ip.y, sx, sy, rot, basePt.x, basePt.y);
                const matrix = m ? affineMultiply(m, local) : local;
                const chain = new Set(ctx.chain).add(e.name);
                const cols = Math.max(1, e.columnCount || 1), rows = Math.max(1, e.rowCount || 1);
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        // MINSERT cells are offset in block space before scaling and rotation
                        const cell = (r === 0 && c === 0) ? matrix
                            : affineMultiply(matrix, [1, 0, 0, 1, c * (e.columnSpacing || 0), r * (e.rowSpacing || 0)]);
                        expandBlock(block, { m: cell, layer, color, depth: ctx.depth + 1, chain });
                    }
                }
                // Attribute values are stored in world coordinates on the reference itself
                for (const attr of e.attribs || []) addEntity(attr, ctx);
                break;
            }
            default:
                break;
        }
    }

    function expandBlock(block, ctx) {
        for (const be of block.entities) {
            if (be.type === 'ATTRIB') continue;
            if (be.type === 'ATTDEF' && !(be.flags & ATTDEF_FLAG_CONSTANT)) continue;
            addEntity(be, ctx);
        }
    }

    /** TEXT and ATTRIB share the DwgTextBase shape: text, startPoint (insertion), endPoint (alignment), height, rotation, justification. */
    function addText(base, ctx, tb, insertion, alignment) {
        if (!tb.text || !insertion) return;
        const { anchor, halign, valign } = textAlignment(tb, insertion, alignment);
        const info = ctx.m ? affineInfo(ctx.m) : { scale: 1 };
        const flip = !!(tb.extrusionDirection && tb.extrusionDirection.z < 0);
        const tp = (x, y) => (ctx.m ? affineApply(ctx.m, flip ? -x : x, y) : { x: flip ? -x : x, y });
        const a = tp(anchor.x, anchor.y), b = tp(insertion.x, insertion.y);
        const rotation = (flip ? Math.PI - (tb.rotation || 0) : (tb.rotation || 0)) + (ctx.m ? Math.atan2(ctx.m[1], ctx.m[0]) : 0);
        pushText(base, {
            x: a.x, y: a.y, baseX: b.x, baseY: b.y, text: decodeCadText(tb.text),
            height: (tb.textHeight || DEFAULT_TEXT_HEIGHT) * info.scale, rotation, halign, valign,
            widthFactor: tb.xScale || 1, lineSpacing: 1, fontName: state.styleFontMap[tb.styleName || ''] || '',
        });
    }

    function pushText(base, spec) {
        const lines = spec.text.split('\n');
        const longest = Math.max(...lines.map(l => l.length), 1);
        const width = longest * spec.height * TEXT_WIDTH_PER_CHAR * spec.widthFactor;
        const heightAll = spec.height * (1 + (lines.length - 1) * 1.67 * spec.lineSpacing);
        const reach = Math.max(width, heightAll); // rotation-independent envelope
        push({
            kind: 'text', ...base, ...spec, lines,
            bounds: { minX: spec.x - reach, minY: spec.y - reach, maxX: spec.x + reach, maxY: spec.y + reach },
        });
    }

    function addHatch(base, e, tp, mirrored) {
        const paths = [];
        const b = createBounds();
        for (const bp of e.boundaryPaths || []) {
            let verts = [];
            if (bp.vertices && bp.vertices.length > 1) {
                verts = bp.vertices.map(v => { const p = tp(v.x, v.y); return { x: p.x, y: p.y, bulge: v.bulge ? (mirrored ? -v.bulge : v.bulge) : 0 }; });
            } else if (bp.edges && bp.edges.length > 0) {
                const pushUnique = pt => {
                    const last = verts[verts.length - 1];
                    if (!last || Math.abs(last.x - pt.x) > 1e-6 || Math.abs(last.y - pt.y) > 1e-6) verts.push({ x: pt.x, y: pt.y, bulge: 0 });
                };
                for (const edge of bp.edges) {
                    let localPts = [];
                    if (edge.type === 1 && edge.start && edge.end) {
                        localPts = [edge.start, edge.end];
                    } else if (edge.type === 2 && edge.center) {
                        localPts = sampleArc(edge.center.x, edge.center.y, edge.radius || 0, edge.startAngle || 0, edge.endAngle ?? Math.PI * 2, edge.isCCW !== false);
                    } else if (edge.type === 3 && edge.center && edge.end) {
                        localPts = sampleEllipse(edge.center.x, edge.center.y, edge.end.x, edge.end.y, edge.lengthOfMinorAxis || 1, edge.startAngle || 0, edge.endAngle ?? Math.PI * 2, edge.isCCW !== false);
                    } else if (edge.type === 4) {
                        localPts = (edge.fitDatum && edge.fitDatum.length > 1) ? edge.fitDatum : (edge.controlPoints || []);
                    }
                    for (const lp of localPts) pushUnique(tp(lp.x, lp.y));
                }
            }
            if (verts.length > 1) {
                paths.push(verts);
                for (const v of verts) expandBounds(b, v.x, v.y);
            }
        }
        if (paths.length === 0) return;
        push({ kind: 'hatch', ...base, paths, solid: e.solidFill === 1 || e.patternName === 'SOLID', patternName: e.patternName || '', bounds: b });
    }

    const rootCtx = { m: null, layer: null, color: null, depth: 0, chain: new Set() };
    for (const e of entities) {
        if (e.type === 'ATTRIB' || e.type === 'ATTDEF') continue; // rendered through their INSERT
        addEntity(e, rootCtx);
    }

    if (!isFiniteBounds(bounds)) { bounds.minX = 0; bounds.minY = 0; bounds.maxX = 1000; bounds.maxY = 1000; }
    if (insertCount > 0) log(t('log.insertRefs', { count: insertCount }));

    return {
        renderList,
        byHandle,
        bounds: { ...bounds, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY },
    };
}

/** Layer list for the side panel with entity counts; layers that are off or frozen start hidden. */
export function buildLayerInfo(entities, layers) {
    state.hiddenLayers.clear();
    const counts = {};
    for (const e of entities) counts[e.layer || '0'] = (counts[e.layer || '0'] || 0) + 1;
    state.layerInfo = layers.map(l => {
        const hidden = !!(l.off || l.frozen);
        if (hidden) state.hiddenLayers.add(l.name);
        return {
            name: l.name,
            colorHex: l.color != null ? rgbIntToHex(l.color) : aciToHex(l.colorIndex),
            count: counts[l.name] || 0,
            off: !!l.off,
            frozen: !!l.frozen,
        };
    });
}

/** Entity type histogram (with the layers each type occurs on) for the KPI tab and the reports. */
export function summarizeEntities(entities) {
    const counts = {};
    const layersByType = {};
    for (const e of entities) {
        const type = e.type || 'UNKNOWN';
        counts[type] = (counts[type] || 0) + 1;
        (layersByType[type] ??= new Set()).add(e.layer || '0');
    }
    state.entitySummary = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count, layers: [...layersByType[type]] }));
}
