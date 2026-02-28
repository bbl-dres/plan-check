// =============================================
// DWG Parsing & Data Preparation
// =============================================

import { state, dom } from './state.js';
import { log, showStatus, fmtSize, fmtNum, aciToHex, esc, computePolygonArea } from './utils.js';

// ── LibreDWG Init ──
async function initLibreDwg() {
    if (state.libredwg) return state.libredwg;
    log('LibreDWG WebAssembly wird geladen (~15 MB)...');
    showStatus('LibreDWG WebAssembly wird geladen...');
    try {
        const mod = await import('https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.6.6/dist/libredwg-web.js');
        state.libredwg = await mod.LibreDwg.create();
        log('LibreDWG WebAssembly geladen', 'success');
        return state.libredwg;
    } catch (err) {
        log(`LibreDWG laden fehlgeschlagen: ${err.message}`, 'error');
        throw err;
    }
}

// ── DWG File Processing ──
export async function processDwgFile(file) {
    const t0 = performance.now();
    log(`Datei: ${file.name} (${fmtSize(file.size)})`);

    showStatus('Datei wird gelesen...');
    const buffer = await file.arrayBuffer();

    const dwgLib = await initLibreDwg();
    const fileType = file.name.toLowerCase().endsWith('.dxf') ? 1 : 0;

    showStatus('DWG wird geparst...');
    log('DWG wird geparst...');

    // Intercept console output from LibreDWG WASM to capture error codes
    const wasmErrors = [];
    const origWarn = console.warn;
    const origError = console.error;
    const origLog = console.log;
    const capture = (orig, ...args) => {
        const msg = args.map(a => String(a)).join(' ');
        if (/error code/i.test(msg)) wasmErrors.push(msg);
        orig.apply(console, args);
    };
    console.warn = (...a) => capture(origWarn, ...a);
    console.error = (...a) => capture(origError, ...a);
    console.log = (...a) => capture(origLog, ...a);

    let dwgPtr;
    try {
        dwgPtr = dwgLib.dwg_read_data(buffer, fileType);
    } finally {
        console.warn = origWarn;
        console.error = origError;
        console.log = origLog;
    }

    if (dwgPtr == null) {
        const codeMatch = wasmErrors.length > 0 && wasmErrors[0].match(/error code:\s*(\d+)/i);
        const code = codeMatch ? parseInt(codeMatch[1]) : 0;
        let detail = '';
        if (code > 0) {
            const flags = [];
            if (code & 1) flags.push('CRC-Fehler');
            if (code & 2) flags.push('nicht unterstützte Features');
            if (code & 4) flags.push('unbekannte Objektklassen');
            if (code & 8) flags.push('ungültiger Typ');
            if (code & 16) flags.push('ungültiger Handle');
            if (code & 32) flags.push('ungültige EED');
            if (code & 64) flags.push('Werte ausserhalb des gültigen Bereichs');
            if (code & 128) flags.push('Klassen nicht gefunden');
            if (code & 256) flags.push('Sektion nicht gefunden');
            if (code & 512) flags.push('Seite nicht gefunden');
            if (code & 1024) flags.push('interner Fehler');
            if (code & 2048) flags.push('ungültige DWG-Datei');
            if (code & 4096) flags.push('IO-Fehler');
            if (code & 8192) flags.push('Speicherfehler');
            detail = ` (Code ${code}: ${flags.join(', ')}). Die Datei enthält möglicherweise proprietäre AutoCAD-Erweiterungen (ARX). Versuchen Sie, die Datei in einem anderen CAD-Programm neu zu speichern.`;
        }
        throw new Error(`DWG konnte nicht gelesen werden${detail}`);
    }

    if (wasmErrors.length > 0) {
        const codeMatch = wasmErrors[0].match(/error code:\s*(\d+)/i);
        const code = codeMatch ? parseInt(codeMatch[1]) : 0;
        if (code > 0) {
            log(`LibreDWG Warnung (Code ${code}): Datei wurde geladen, aber einige Elemente sind möglicherweise unvollständig. Die Datei enthält evtl. proprietäre AutoCAD-Erweiterungen.`, 'warn');
        }
    }
    log('DWG geparst', 'success');

    showStatus('Daten werden konvertiert...');
    const { database: db, stats } = dwgLib.convertEx(dwgPtr);
    if (stats.unknownEntityCount > 0) log(`${stats.unknownEntityCount} unbekannte Entity-Typen`, 'warn');

    const entities = db.entities || [];
    const layers = db.tables?.LAYER?.entries || [];
    log(`${entities.length} Entities, ${layers.length} Layers`, 'success');

    try { dwgLib.dwg_free(dwgPtr); } catch (e) { /* ok */ }

    const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
    log(`Verarbeitung: ${elapsed}s`, 'success');

    return { db, entities, layers, elapsed };
}

// ── Prepare Drawing Data for Canvas Rendering ──
export function prepareDrawingData(entities, layers, db) {
    const layerColorMap = {};
    for (const l of layers) {
        layerColorMap[l.name] = aciToHex(l.colorIndex);
    }

    function getColor(e) {
        if (e.colorIndex && e.colorIndex !== 256 && e.colorIndex !== 0) return aciToHex(e.colorIndex);
        return layerColorMap[e.layer] || '#CCCCCC';
    }

    // Enhancement 3: $INSUNITS from header
    state.insunits = db.header?.$INSUNITS ?? db.header?.INSUNITS ?? null;

    // Enhancement 8: STYLE table → styleFontMap
    state.styleFontMap = {};
    const styleEntries = db.tables?.STYLE?.entries || [];
    for (const s of styleEntries) {
        if (s.name) {
            state.styleFontMap[s.name] = s.fontName || s.bigFontName || s.fileName || '';
        }
    }

    // Enhancement 6: LAYOUT table → paperSpaceLayouts
    state.paperSpaceLayouts = [];
    const layoutEntries = db.tables?.LAYOUT?.entries || [];
    for (const lay of layoutEntries) {
        const name = lay.name || lay.layoutName || '';
        if (name && name.toUpperCase() !== 'MODEL') {
            state.paperSpaceLayouts.push(name);
        }
    }

    // Helper: check if entity uses ByLayer color
    function isByLayer(e) {
        return !e.colorIndex || e.colorIndex === 256 || e.colorIndex === 0;
    }

    const blockMap = {};
    let blockCount = 0;
    const blockRecords = db.tables?.BLOCK_RECORD?.entries || [];
    // Enhancement 5: XREF detection
    state.xrefBlocks = [];
    for (const br of blockRecords) {
        if (br.name && br.entities && br.entities.length > 0) {
            blockMap[br.name] = br;
            blockCount++;
        }
        if (br.xrefPath || (br.flags && (br.flags & 4))) {
            state.xrefBlocks.push({ name: br.name || '', xrefPath: br.xrefPath || '' });
        }
    }
    if (blockCount > 0) log(`${blockCount} Block-Definitionen geladen`);
    if (state.xrefBlocks.length > 0) log(`${state.xrefBlocks.length} XREF-Blöcke erkannt`);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function expand(x, y) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
    }

    const renderList = [];
    let insertCount = 0;

    function transformPoint(px, py, ins) {
        const sx = (ins.xScale || 1);
        const sy = (ins.yScale || 1);
        // libredwg-web returns rotation in radians (not degrees)
        const rot = (ins.rotation || 0);
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const bx = ins.baseX || 0;
        const by = ins.baseY || 0;
        const rx = (px - bx) * sx;
        const ry = (py - by) * sy;
        return {
            x: rx * cos - ry * sin + ins.insertionPoint.x,
            y: rx * sin + ry * cos + ins.insertionPoint.y
        };
    }

    // Enhancement 4: collect non-zero Z entities
    state.nonZeroZEntities = [];
    // Enhancement 9: collect DIMENSION info
    state.dimensionInfo = [];

    function addEntity(e, tf, parentLayer) {
        if (e.isVisible === 1) return;

        const color = getColor(e);
        const l = e.layer || parentLayer || '0';
        const et = e.type || 'UNKNOWN';
        const handle = e.handle || '';
        const byLayer = isByLayer(e);

        // Enhancement 4: Z-coordinate check
        function checkZ(pt) {
            if (pt && pt.z && Math.abs(pt.z) > 1e-6) {
                state.nonZeroZEntities.push({ handle, layer: l, type: et, z: pt.z });
            }
        }
        if (e.startPoint) checkZ(e.startPoint);
        if (e.endPoint) checkZ(e.endPoint);
        if (e.insertionPoint) checkZ(e.insertionPoint);
        if (e.center) checkZ(e.center);
        if (e.vertices && e.vertices.length > 0) checkZ(e.vertices[0]);

        function tp(px, py) {
            if (!tf) return { x: px, y: py };
            return transformPoint(px, py, tf);
        }

        // Detect mirroring: negative determinant of scale means reflection
        const tfMirrored = tf && ((tf.xScale || 1) * (tf.yScale || 1)) < 0;
        const tfSxNeg = tf && (tf.xScale || 1) < 0;

        switch (e.type) {
            case 'LINE':
                if (e.startPoint && e.endPoint) {
                    const p1 = tp(e.startPoint.x, e.startPoint.y);
                    const p2 = tp(e.endPoint.x, e.endPoint.y);
                    expand(p1.x, p1.y); expand(p2.x, p2.y);
                    renderList.push({ t: 'line', l, et, handle, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, c: color, byLayer });
                }
                break;

            case 'LWPOLYLINE':
                if (e.vertices && e.vertices.length > 1) {
                    const verts = tf
                        ? e.vertices.map(v => { const p = tp(v.x, v.y); return { x: p.x, y: p.y, bulge: tfMirrored ? -(v.bulge || 0) : v.bulge }; })
                        : e.vertices;
                    for (const v of verts) expand(v.x, v.y);
                    let closed = !!(e.flag & 512) || !!(e.flag & 1);
                    if (!closed && verts.length > 2) {
                        const f = verts[0], la = verts[verts.length - 1];
                        if (Math.abs(f.x - la.x) < 1e-6 && Math.abs(f.y - la.y) < 1e-6) closed = true;
                    }
                    const width = e.constantWidth || e.width || 0;
                    renderList.push({ t: 'poly', l, et, handle, verts, closed, c: color, byLayer, width });
                }
                break;

            case 'POLYLINE2D': {
                if (e.vertices && e.vertices.length > 1) {
                    const verts = e.vertices.map(v => {
                        const p = tp(v.x, v.y);
                        return { x: p.x, y: p.y, bulge: tfMirrored ? -(v.bulge || 0) : (v.bulge || 0) };
                    });
                    for (const v of verts) expand(v.x, v.y);
                    const closed = !!(e.flag & 512) || !!(e.flag & 1);
                    const width = e.constantWidth || e.width || 0;
                    renderList.push({ t: 'poly', l, et, handle, verts, closed, c: color, byLayer, width });
                }
                break;
            }

            case 'POLYLINE3D': {
                if (e.vertices && e.vertices.length > 1) {
                    const verts = e.vertices.map(v => {
                        const p = tp(v.x, v.y);
                        return { x: p.x, y: p.y, bulge: 0 };
                    });
                    for (const v of verts) expand(v.x, v.y);
                    const closed = !!(e.flag & 512) || !!(e.flag & 1);
                    renderList.push({ t: 'poly', l, et, handle, verts, closed, c: color, byLayer });
                }
                break;
            }

            case 'CIRCLE':
                if (e.center && e.radius) {
                    const c = tp(e.center.x, e.center.y);
                    const r = e.radius * Math.abs(tf ? (tf.xScale || 1) : 1);
                    expand(c.x - r, c.y - r); expand(c.x + r, c.y + r);
                    renderList.push({ t: 'circle', l, et, handle, cx: c.x, cy: c.y, r, c: color, byLayer });
                }
                break;

            case 'ARC':
                if (e.center && e.radius != null && e.startAngle != null && e.endAngle != null) {
                    const c = tp(e.center.x, e.center.y);
                    const r = e.radius * Math.abs(tf ? (tf.xScale || 1) : 1);
                    const rotOff = tf ? (tf.rotation || 0) : 0;
                    let sa, ea;
                    if (tfMirrored) {
                        // Mirror reflects angles and reverses arc direction (swap start/end)
                        if (tfSxNeg) {
                            sa = Math.PI - e.endAngle + rotOff;
                            ea = Math.PI - e.startAngle + rotOff;
                        } else {
                            sa = -e.endAngle + rotOff;
                            ea = -e.startAngle + rotOff;
                        }
                    } else {
                        sa = e.startAngle + rotOff;
                        ea = e.endAngle + rotOff;
                    }
                    expand(c.x - r, c.y - r); expand(c.x + r, c.y + r);
                    renderList.push({ t: 'arc', l, et, handle, cx: c.x, cy: c.y, r, sa, ea, c: color, byLayer });
                }
                break;

            case 'ELLIPSE':
                if (e.center && e.majorAxisEndPoint) {
                    const c = tp(e.center.x, e.center.y);
                    // Transform the major axis vector through scale (then rotation is added)
                    const sx = tf ? (tf.xScale || 1) : 1;
                    const sy = tf ? (tf.yScale || 1) : 1;
                    const mx = e.majorAxisEndPoint.x * sx;
                    const my = e.majorAxisEndPoint.y * sy;
                    const rx = Math.hypot(mx, my);
                    const ry = rx * (e.axisRatio || e.minorToMajorRatio || 0.5);
                    const rot = Math.atan2(my, mx) + (tf ? (tf.rotation || 0) : 0);
                    expand(c.x - rx, c.y - rx); expand(c.x + rx, c.y + rx);
                    renderList.push({ t: 'ellipse', l, et, handle, cx: c.x, cy: c.y, rx, ry, rot, c: color, byLayer });
                }
                break;

            case 'SPLINE': {
                let pts = null;
                if (e.fitPoints && e.fitPoints.length > 1) {
                    pts = e.fitPoints;
                } else if (e.controlPoints && e.controlPoints.length > 1) {
                    pts = e.controlPoints;
                }
                if (pts) {
                    const verts = pts.map(p => {
                        const tp2 = tp(p.x, p.y);
                        return { x: tp2.x, y: tp2.y, bulge: 0 };
                    });
                    for (const v of verts) expand(v.x, v.y);
                    const closed = !!(e.flag & 512) || !!(e.flag & 1);
                    renderList.push({ t: 'poly', l, et, handle, verts, closed, c: color, byLayer });
                }
                break;
            }

            case 'TEXT': {
                if (!e.text) break;
                const useEnd = ((e.halign || 0) > 0 || (e.valign || 0) > 0);
                const pt = useEnd ? (e.endPoint || e.startPoint) : (e.startPoint || e.insertionPoint);
                if (!pt) break;
                const p = tp(pt.x, pt.y);
                const scale = Math.abs(tf ? (tf.xScale || 1) : 1);
                const rotRad = (e.rotation || 0) + (tf ? (tf.rotation || 0) : 0);
                expand(p.x, p.y);
                const fontName = state.styleFontMap[e.styleName || e.style || ''] || '';
                renderList.push({ t: 'text', l, et, handle, x: p.x, y: p.y, text: e.text, h: (e.textHeight || 2.5) * scale, rot: rotRad, c: color, byLayer, fontName });
                break;
            }

            case 'MTEXT': {
                const pt = e.insertionPoint;
                if (pt && e.text) {
                    const p = tp(pt.x, pt.y);
                    const scale = Math.abs(tf ? (tf.xScale || 1) : 1);
                    const rotRad = (e.rotation || 0) + (tf ? (tf.rotation || 0) : 0);
                    expand(p.x, p.y);
                    const clean = e.text
                        .replace(/\\P/g, '\n')
                        .replace(/\\~/g, ' ')
                        .replace(/\\[fFHWACcTQpq][^;]*;/g, '')
                        .replace(/\\S([^^;]*)\^([^;]*);/g, '$1/$2')
                        .replace(/\\[LlOoKk]/g, '')
                        .replace(/[{}]/g, '')
                        .replace(/\\\\/g, '\\');
                    const fontName = state.styleFontMap[e.styleName || e.style || ''] || '';
                    renderList.push({ t: 'text', l, et: 'MTEXT', handle, x: p.x, y: p.y, text: clean, h: (e.textHeight || 2.5) * scale, rot: rotRad, c: color, byLayer, fontName });
                }
                break;
            }

            case 'ATTRIB': {
                if (e.flags && (e.flags & 1)) break;
                // libredwg-web: e.text is a DwgTextBase object with .text, .startPoint, .endPoint, .textHeight, etc.
                const tb = (typeof e.text === 'object' && e.text !== null) ? e.text : null;
                const textStr = tb ? tb.text : (typeof e.text === 'string' ? e.text : null);
                if (!textStr) break;
                const halign = tb ? (tb.halign || 0) : (e.halign || 0);
                const valign = tb ? (tb.valign || 0) : (e.valign || 0);
                const useEnd = (halign > 0 || valign > 0);
                const pt = useEnd
                    ? (e.alignmentPoint || (tb && tb.endPoint) || e.endPoint || (tb && tb.startPoint) || e.insertionPoint)
                    : ((tb && tb.startPoint) || e.insertionPoint || (tb && tb.endPoint) || e.startPoint);
                if (!pt) break;
                const p = tp(pt.x, pt.y);
                const scale = Math.abs(tf ? (tf.xScale || 1) : 1);
                const rotation = (tb && tb.rotation) || e.rotation || 0;
                const rotRad = rotation + (tf ? (tf.rotation || 0) : 0);
                expand(p.x, p.y);
                const sName = (tb && tb.styleName) || e.styleName || e.style || '';
                const fontName = state.styleFontMap[sName] || '';
                const tHeight = (tb && tb.textHeight) || e.textHeight || 2.5;
                renderList.push({ t: 'text', l, et: 'ATTRIB', handle, x: p.x, y: p.y, text: textStr, h: tHeight * scale, rot: rotRad, c: color, byLayer, fontName });
                break;
            }

            case 'POINT': {
                const pt = e.location || e.point || e;
                if (pt && pt.x != null) {
                    const p = tp(pt.x, pt.y);
                    expand(p.x, p.y);
                    renderList.push({ t: 'point', l, et, handle, x: p.x, y: p.y, c: color, byLayer });
                }
                break;
            }

            case 'SOLID':
            case '3DSOLID':
            case 'TRACE': {
                const pts = [e.firstCorner || e.point1, e.secondCorner || e.point2,
                             e.thirdCorner || e.point3, e.fourthCorner || e.point4].filter(Boolean);
                if (pts.length >= 3) {
                    const tpts = pts.map(p => tp(p.x, p.y));
                    for (const p of tpts) expand(p.x, p.y);
                    renderList.push({ t: 'solid', l, et, handle, pts: tpts, c: color, byLayer });
                }
                break;
            }

            case 'HATCH': {
                const boundaries = e.boundaryPaths || [];
                const isSolidFill = e.isSolidFill || (e.patternName === 'SOLID') || (e.style === 1);
                const paths = [];
                for (const bp of boundaries) {
                    if (bp.edges && bp.edges.length > 0) {
                        const verts = [];
                        for (const edge of bp.edges) {
                            const etype = edge.type ?? edge.edgeType ?? -1;
                            if (etype === 1) {
                                const sp = tp(edge.startPoint?.x ?? edge.start?.x, edge.startPoint?.y ?? edge.start?.y);
                                const ep = tp(edge.endPoint?.x ?? edge.end?.x, edge.endPoint?.y ?? edge.end?.y);
                                if (verts.length === 0) verts.push(sp);
                                verts.push(ep);
                            } else if (etype === 2) {
                                const cx = edge.center?.x ?? 0, cy = edge.center?.y ?? 0;
                                const r = edge.radius ?? 0;
                                const sa = edge.startAngle ?? 0;
                                const ea = edge.endAngle ?? Math.PI * 2;
                                const ccw = tfMirrored ? (edge.isCCW === false) : (edge.isCCW !== false);
                                let sweep = ccw ? (ea - sa) : (sa - ea);
                                if (sweep <= 0) sweep += Math.PI * 2;
                                const steps = Math.max(12, Math.ceil(Math.abs(sweep) / (Math.PI / 16)));
                                for (let si = 0; si <= steps; si++) {
                                    const frac = si / steps;
                                    const angle = ccw ? (sa + sweep * frac) : (sa - sweep * frac);
                                    const pt = tp(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
                                    if (si === 0 && verts.length > 0) {
                                        const last = verts[verts.length - 1];
                                        if (Math.abs(last.x - pt.x) < 1e-4 && Math.abs(last.y - pt.y) < 1e-4) continue;
                                    }
                                    verts.push(pt);
                                }
                            } else if (etype === 3) {
                                const cx = edge.center?.x ?? 0, cy = edge.center?.y ?? 0;
                                const majorEnd = edge.majorAxisEndPoint || edge.endMajorAxis || { x: 1, y: 0 };
                                const majorLen = Math.hypot(majorEnd.x, majorEnd.y);
                                const minorLen = (edge.lengthOfMinorAxis || 0.5) * (majorLen || 1);
                                const rot = Math.atan2(majorEnd.y, majorEnd.x);
                                const sa = edge.startAngle || 0;
                                const ea = edge.endAngle || Math.PI * 2;
                                const ccw = edge.isCCW !== false;
                                let sweep = ccw ? (ea - sa) : (sa - ea);
                                if (sweep <= 0) sweep += Math.PI * 2;
                                const steps = Math.max(12, Math.ceil(Math.abs(sweep) / (Math.PI / 16)));
                                for (let si = 0; si <= steps; si++) {
                                    const frac = si / steps;
                                    const angle = ccw ? (sa + sweep * frac) : (sa - sweep * frac);
                                    const lx = majorLen * Math.cos(angle);
                                    const ly = minorLen * Math.sin(angle);
                                    const px = cx + lx * Math.cos(rot) - ly * Math.sin(rot);
                                    const py = cy + lx * Math.sin(rot) + ly * Math.cos(rot);
                                    const pt = tp(px, py);
                                    if (si === 0 && verts.length > 0) {
                                        const last = verts[verts.length - 1];
                                        if (Math.abs(last.x - pt.x) < 1e-4 && Math.abs(last.y - pt.y) < 1e-4) continue;
                                    }
                                    verts.push(pt);
                                }
                            } else if (etype === 4) {
                                const pts = edge.fitDatum || edge.controlPoints || [];
                                for (let si = 0; si < pts.length; si++) {
                                    const sp = pts[si];
                                    const pt = tp(sp.x, sp.y);
                                    if (si === 0 && verts.length > 0) {
                                        const last = verts[verts.length - 1];
                                        if (Math.abs(last.x - pt.x) < 1e-4 && Math.abs(last.y - pt.y) < 1e-4) continue;
                                    }
                                    verts.push(pt);
                                }
                            }
                        }
                        if (verts.length > 1) {
                            for (const v of verts) expand(v.x, v.y);
                            const polyVerts = verts.map(v => ({ x: v.x, y: v.y, bulge: 0 }));
                            renderList.push({ t: 'poly', l, et, handle, verts: polyVerts, closed: true, c: color, byLayer });
                            if (isSolidFill) paths.push(polyVerts);
                        }
                    }
                    if (bp.vertices && bp.vertices.length > 1) {
                        const verts = tf
                            ? bp.vertices.map(v => { const p = tp(v.x, v.y); return { x: p.x, y: p.y, bulge: v.bulge || 0 }; })
                            : bp.vertices.map(v => ({ x: v.x, y: v.y, bulge: v.bulge || 0 }));
                        for (const v of verts) expand(v.x, v.y);
                        const closed = bp.isClosed !== false;
                        renderList.push({ t: 'poly', l, et, handle, verts, closed, c: color, byLayer });
                        if (isSolidFill) paths.push(verts);
                    }
                }
                if (isSolidFill && paths.length > 0) {
                    const pn = e.patternName || '';
                    renderList.push({ t: 'hatchfill', l, et, handle, paths, c: color, byLayer, patternName: pn });
                }
                break;
            }

            case 'DIMENSION': {
                // Enhancement 9: collect dimension info
                state.dimensionInfo.push({
                    handle,
                    layer: l,
                    associative: !!(e.flag && (e.flag & 1)),
                });
                if (e.name && blockMap[e.name]) {
                    const block = blockMap[e.name];
                    const ins = {
                        insertionPoint: tf ? transformPoint(0, 0, tf) : { x: 0, y: 0 },
                        xScale: tf ? (tf.xScale || 1) : 1,
                        yScale: tf ? (tf.yScale || 1) : 1,
                        rotation: tf ? (tf.rotation || 0) : 0
                    };
                    for (const be of block.entities) {
                        addEntity(be, ins, l);
                    }
                } else {
                    const pts = [];
                    if (e.definitionPoint) pts.push(e.definitionPoint);
                    if (e.subDefinitionPoint1) pts.push(e.subDefinitionPoint1);
                    if (e.subDefinitionPoint2) pts.push(e.subDefinitionPoint2);
                    for (let i = 0; i + 1 < pts.length; i++) {
                        const p1 = tp(pts[i].x, pts[i].y);
                        const p2 = tp(pts[i + 1].x, pts[i + 1].y);
                        expand(p1.x, p1.y); expand(p2.x, p2.y);
                        renderList.push({ t: 'line', l, et, handle, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, c: color, byLayer });
                    }
                    if (e.textPoint && e.measurement != null) {
                        const p = tp(e.textPoint.x, e.textPoint.y);
                        expand(p.x, p.y);
                        const txt = e.text || e.measurement.toFixed(0);
                        renderList.push({ t: 'text', l, et, handle, x: p.x, y: p.y, text: txt, h: 2.5, rot: 0, c: color, byLayer });
                    }
                }
                break;
            }

            case 'LEADER': {
                if (e.vertices && e.vertices.length > 1) {
                    const verts = e.vertices.map(v => {
                        const p = tp(v.x, v.y);
                        return { x: p.x, y: p.y, bulge: 0 };
                    });
                    for (const v of verts) expand(v.x, v.y);
                    renderList.push({ t: 'poly', l, et, handle, verts, closed: false, c: color, byLayer });
                }
                break;
            }

            case 'MLINE': {
                if (e.vertices && e.vertices.length > 1) {
                    const verts = e.vertices.map(v => {
                        const pt = v.point || v;
                        const p = tp(pt.x, pt.y);
                        return { x: p.x, y: p.y, bulge: 0 };
                    });
                    for (const v of verts) expand(v.x, v.y);
                    renderList.push({ t: 'poly', l, et, handle, verts, closed: false, c: color, byLayer });
                }
                break;
            }

            case '3DFACE': {
                const pts = [e.firstCorner, e.secondCorner, e.thirdCorner, e.fourthCorner].filter(Boolean);
                if (pts.length >= 3) {
                    const tpts = pts.map(p => tp(p.x, p.y));
                    for (const p of tpts) expand(p.x, p.y);
                    const verts = tpts.map(p => ({ x: p.x, y: p.y, bulge: 0 }));
                    renderList.push({ t: 'poly', l, et, handle, verts, closed: true, c: color, byLayer });
                }
                break;
            }

            case 'RAY': {
                if (e.basePoint && e.direction) {
                    const p1 = tp(e.basePoint.x, e.basePoint.y);
                    const len = 1e6;
                    const p2 = tp(e.basePoint.x + e.direction.x * len, e.basePoint.y + e.direction.y * len);
                    expand(p1.x, p1.y);
                    renderList.push({ t: 'line', l, et, handle, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, c: color, byLayer });
                }
                break;
            }

            case 'XLINE': {
                if (e.basePoint && e.direction) {
                    const len = 1e6;
                    const p1 = tp(e.basePoint.x - e.direction.x * len, e.basePoint.y - e.direction.y * len);
                    const p2 = tp(e.basePoint.x + e.direction.x * len, e.basePoint.y + e.direction.y * len);
                    renderList.push({ t: 'line', l, et, handle, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, c: color, byLayer });
                }
                break;
            }

            case 'INSERT': {
                if (!e.insertionPoint || !e.name) break;
                const block = blockMap[e.name];
                insertCount++;
                if (!block || !block.entities) break;

                // Handle OCS extrusion: when normal is (0,0,-1), the X-axis is negated
                // Normalize into equivalent scale/rotation so downstream mirroring logic works
                let ipx = e.insertionPoint.x;
                let ipy = e.insertionPoint.y;
                let eXScale = e.xScale ?? 1;
                let eYScale = e.yScale ?? 1;
                let eRotation = e.rotation || 0;
                const ez = e.extrusionDirection?.z;
                if (ez != null && ez < 0) {
                    ipx = -ipx;
                    eYScale = -eYScale;
                    eRotation = Math.PI - eRotation;
                }

                const origin = block.origin || block.basePoint;
                const ins = {
                    insertionPoint: tf ? transformPoint(ipx, ipy, tf) : { x: ipx, y: ipy },
                    xScale: eXScale * (tf ? (tf.xScale || 1) : 1),
                    yScale: eYScale * (tf ? (tf.yScale || 1) : 1),
                    rotation: eRotation + (tf ? (tf.rotation || 0) : 0),
                    baseX: origin?.x || 0,
                    baseY: origin?.y || 0
                };

                const hasAttribs = e.attribs && e.attribs.length > 0;

                for (const be of block.entities) {
                    if (be.type === 'ATTDEF' || be.type === 'ATTRIB') continue;
                    addEntity(be, ins, l);
                }

                if (hasAttribs) {
                    for (const attr of e.attribs) {
                        addEntity(attr, tf, l);
                    }
                }
                break;
            }
        }
    }

    for (const e of entities) {
        if (e.type === 'ATTRIB' || e.type === 'ATTDEF') continue;
        addEntity(e, null, null);
    }

    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 1000; maxY = 1000; }

    if (insertCount > 0) log(`${insertCount} INSERT-Referenzen aufgelöst`);
    log(`Render-Liste: ${renderList.length} Primitiven, Bounds: (${minX.toFixed(0)}, ${minY.toFixed(0)}) - (${maxX.toFixed(0)}, ${maxY.toFixed(0)})`);

    return {
        renderList,
        bounds: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
    };
}

// ── Display Helpers ──
export function buildLayerInfo(entities, layers) {
    state.hiddenLayers.clear();
    const counts = {};
    for (const e of entities) counts[e.layer || '0'] = (counts[e.layer || '0'] || 0) + 1;
    state.layerInfo = layers.map(l => ({
        name: l.name,
        colorHex: aciToHex(l.colorIndex),
        count: counts[l.name] || 0,
    }));
}

export function displayEntities(entities) {
    dom.entitiesTbody.innerHTML = '';
    const typeCounts = {};
    const typeLayers = {};
    for (const e of entities) {
        const t = e.type || 'UNKNOWN';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
        if (!typeLayers[t]) typeLayers[t] = new Set();
        if (e.layer) typeLayers[t].add(e.layer);
    }
    const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sorted) {
        const ls = typeLayers[type] ? Array.from(typeLayers[type]).slice(0, 3).join(', ') : '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="entity-type-badge">${esc(type)}</span></td>
            <td>${count}</td>
            <td style="font-size:12px; color: var(--color-text-secondary)">${esc(ls)}${typeLayers[type]?.size > 3 ? ' ...' : ''}</td>
        `;
        dom.entitiesTbody.appendChild(tr);
    }
    dom.entitiesPanel.classList.add('visible');
}
