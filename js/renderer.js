// =============================================
// Canvas Rendering, Overlays, Camera & Hit-Testing
// =============================================

import { state, dom, BG_LIGHT, SIA_COLORS } from './state.js';
import { esc, computePolygonArea, fmtNum, pointInPoly, distPointToSegment } from './utils.js';

// Canvas overlay colors — mirrors tokens.css (Canvas2D can't read CSS vars)
const OV = {
    highlight:     '#0099CC',
    highlightGlow: 'rgba(0, 153, 204, 0.6)',
    selectedFill:  'rgba(0, 102, 153, 0.35)',  selectedStroke:  '#006699',
    errorFill:     'rgba(183, 28, 28, 0.30)',   errorStroke:     '#B71C1C',
    warningFill:   'rgba(191, 54, 12, 0.30)',   warningStroke:   '#BF360C',
    successFill:   'rgba(27, 94, 32, 0.25)',    successStroke:   '#1B5E20',
    neutralFill:   'rgba(180, 180, 180, 0.15)', neutralStroke:   'rgba(150, 150, 150, 0.5)',
    mutedFill:     'rgba(200, 200, 200, 0.10)', mutedStroke:     'rgba(180, 180, 180, 0.3)',
    labelBg:       'rgba(255, 255, 255, 0.88)',
    labelText:     '#333333',
    labelSecondary:'#757575',
};

export function resizeCanvas() {
    const rect = dom.canvasWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    dom.canvas.width = rect.width * dpr;
    dom.canvas.height = rect.height * dpr;
    dom.canvas.style.width = rect.width + 'px';
    dom.canvas.style.height = rect.height + 'px';
    dom.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function worldToScreen(wx, wy) {
    const rect = dom.canvasWrap.getBoundingClientRect();
    const sx = (wx - state.cam.x) * state.cam.zoom + rect.width / 2;
    const sy = -(wy - state.cam.y) * state.cam.zoom + rect.height / 2;
    return [sx, sy];
}

export function screenToWorld(sx, sy) {
    const rect = dom.canvasWrap.getBoundingClientRect();
    const wx = (sx - rect.width / 2) / state.cam.zoom + state.cam.x;
    const wy = -(sy - rect.height / 2) / state.cam.zoom + state.cam.y;
    return [wx, wy];
}

// Draw arc between two points with a bulge factor
function drawBulgeArc(ctx, x1, y1, x2, y2, bulge) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const d = Math.hypot(dx, dy);
    if (d < 1e-10) { ctx.lineTo(x2, y2); return; }

    const sagitta = Math.abs(bulge) * d / 2;
    const radius = ((d / 2) * (d / 2) + sagitta * sagitta) / (2 * sagitta);

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const nx = -dy / d;
    const ny = dx / d;

    const sign = bulge > 0 ? 1 : -1;
    const offset = sign * (radius - sagitta);
    const cx = mx + nx * offset;
    const cy = my + ny * offset;

    const sa = Math.atan2(y1 - cy, x1 - cx);
    const ea = Math.atan2(y2 - cy, x2 - cx);

    ctx.arc(cx, cy, Math.abs(radius), sa, ea, bulge < 0);
}

// Throttled render — coalesces rapid calls (pan, zoom) into a single rAF
let _renderPending = false;
export function scheduleRender() {
    if (_renderPending) return;
    _renderPending = true;
    requestAnimationFrame(() => {
        _renderPending = false;
        render();
    });
}

export function render() {
    if (!state.drawingData) return;
    const ctx = dom.ctx;
    const cam = state.cam;
    const rect = dom.canvasWrap.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Clear
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, w, h);

    const { renderList } = state.drawingData;

    // Set up coordinate transform: world -> screen
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(cam.zoom, -cam.zoom); // flip Y
    ctx.translate(-cam.x, -cam.y);

    // Lines are always 1px regardless of zoom
    ctx.lineWidth = 1 / cam.zoom;

    // In light mode, remap white/near-white colors to black so they remain visible
    const isLightBg = state.bgColor === BG_LIGHT;
    function displayColor(c) {
        if (!isLightBg || !c) return c;
        const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
        if (!m) return c;
        const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
        if (r > 200 && g > 200 && b > 200) return '#1a1a1a';
        return c;
    }

    // Skip base DWG drawing when in rooms/areas mode — show only validation geometry
    const drawBase = state.validationMode !== 'rooms' && state.validationMode !== 'areas';

    if (drawBase)
    for (const item of renderList) {
        if (state.tabFilterLayers ? !state.tabFilterLayers.has(item.l) : state.hiddenLayers.has(item.l)) continue;
        const dc = displayColor(item.c);
        ctx.strokeStyle = dc;
        ctx.fillStyle = dc;

        switch (item.t) {
            case 'line':
                ctx.beginPath();
                ctx.moveTo(item.x1, item.y1);
                ctx.lineTo(item.x2, item.y2);
                ctx.stroke();
                break;

            case 'poly':
                ctx.beginPath();
                ctx.moveTo(item.verts[0].x, item.verts[0].y);
                for (let i = 1; i < item.verts.length; i++) {
                    const v = item.verts[i];
                    const prev = item.verts[i - 1];
                    // Handle bulge (arc segments)
                    if (prev.bulge && prev.bulge !== 0) {
                        drawBulgeArc(ctx, prev.x, prev.y, v.x, v.y, prev.bulge);
                    } else {
                        ctx.lineTo(v.x, v.y);
                    }
                }
                if (item.closed && item.verts.length > 1) {
                    const last = item.verts[item.verts.length - 1];
                    const first = item.verts[0];
                    if (last.bulge && last.bulge !== 0) {
                        drawBulgeArc(ctx, last.x, last.y, first.x, first.y, last.bulge);
                    } else {
                        ctx.lineTo(first.x, first.y);
                    }
                }
                ctx.stroke();
                break;

            case 'circle':
                ctx.beginPath();
                ctx.arc(item.cx, item.cy, item.r, 0, Math.PI * 2);
                ctx.stroke();
                break;

            case 'arc':
                ctx.beginPath();
                // Canvas arc goes clockwise by default; DWG arcs are CCW
                ctx.arc(item.cx, item.cy, item.r, item.sa, item.ea, false);
                ctx.stroke();
                break;

            case 'ellipse':
                ctx.beginPath();
                ctx.ellipse(item.cx, item.cy, item.rx, item.ry, item.rot, 0, Math.PI * 2);
                ctx.stroke();
                break;

            case 'text': {
                const fontSize = item.h;
                if (fontSize * cam.zoom < 1.5) break; // skip text too small to render on screen
                ctx.save();
                ctx.translate(item.x, item.y);
                ctx.scale(1, -1); // flip text back
                if (item.rot) ctx.rotate(-item.rot);
                ctx.font = `${fontSize}px Arial, sans-serif`;
                ctx.fillText(item.text, 0, 0);
                ctx.restore();
                break;
            }

            case 'point': {
                const sz = 3 / cam.zoom;
                ctx.fillRect(item.x - sz/2, item.y - sz/2, sz, sz);
                break;
            }

            case 'hatchfill': {
                // Render solid-fill hatch as semi-transparent filled polygon
                ctx.save();
                ctx.globalAlpha = 0.25;
                ctx.beginPath();
                for (const path of item.paths) {
                    if (path.length < 2) continue;
                    ctx.moveTo(path[0].x, path[0].y);
                    for (let i = 1; i < path.length; i++) {
                        const v = path[i];
                        const prev = path[i - 1];
                        if (prev.bulge && prev.bulge !== 0) {
                            drawBulgeArc(ctx, prev.x, prev.y, v.x, v.y, prev.bulge);
                        } else {
                            ctx.lineTo(v.x, v.y);
                        }
                    }
                    // Close back to first vertex
                    const last = path[path.length - 1];
                    const first = path[0];
                    if (last.bulge && last.bulge !== 0) {
                        drawBulgeArc(ctx, last.x, last.y, first.x, first.y, last.bulge);
                    } else {
                        ctx.lineTo(first.x, first.y);
                    }
                    ctx.closePath();
                }
                ctx.fill();
                ctx.restore();
                break;
            }

            case 'solid': {
                ctx.beginPath();
                ctx.moveTo(item.pts[0].x, item.pts[0].y);
                for (let i = 1; i < item.pts.length; i++) {
                    ctx.lineTo(item.pts[i].x, item.pts[i].y);
                }
                ctx.closePath();
                ctx.fill();
                break;
            }
        }
    }

    // === Highlight selected/highlighted elements ===
    const itemsToHighlight = state.highlightedItems && state.highlightedItems.length > 0
        ? state.highlightedItems
        : (state.selectedItem ? [state.selectedItem] : []);

    for (const hi of itemsToHighlight) {
        if (state.hiddenLayers.has(hi.l)) continue;
        ctx.save();
        ctx.strokeStyle = OV.highlight;
        ctx.fillStyle = OV.highlight;
        ctx.lineWidth = 3 / cam.zoom;
        ctx.shadowColor = OV.highlightGlow;
        ctx.shadowBlur = 10;

        switch (hi.t) {
            case 'line':
                ctx.beginPath();
                ctx.moveTo(hi.x1, hi.y1);
                ctx.lineTo(hi.x2, hi.y2);
                ctx.stroke();
                break;

            case 'poly':
                ctx.beginPath();
                ctx.moveTo(hi.verts[0].x, hi.verts[0].y);
                for (let i = 1; i < hi.verts.length; i++) {
                    const v = hi.verts[i];
                    const prev = hi.verts[i - 1];
                    if (prev.bulge && prev.bulge !== 0) {
                        drawBulgeArc(ctx, prev.x, prev.y, v.x, v.y, prev.bulge);
                    } else {
                        ctx.lineTo(v.x, v.y);
                    }
                }
                if (hi.closed && hi.verts.length > 1) {
                    const last = hi.verts[hi.verts.length - 1];
                    const first = hi.verts[0];
                    if (last.bulge && last.bulge !== 0) {
                        drawBulgeArc(ctx, last.x, last.y, first.x, first.y, last.bulge);
                    } else {
                        ctx.lineTo(first.x, first.y);
                    }
                }
                ctx.stroke();
                break;

            case 'circle':
                ctx.beginPath();
                ctx.arc(hi.cx, hi.cy, hi.r, 0, Math.PI * 2);
                ctx.stroke();
                break;

            case 'arc':
                ctx.beginPath();
                ctx.arc(hi.cx, hi.cy, hi.r, hi.sa, hi.ea, false);
                ctx.stroke();
                break;

            case 'ellipse':
                ctx.beginPath();
                ctx.ellipse(hi.cx, hi.cy, hi.rx, hi.ry, hi.rot, 0, Math.PI * 2);
                ctx.stroke();
                break;

            case 'text': {
                const fontSize = hi.h;
                ctx.save();
                ctx.translate(hi.x, hi.y);
                ctx.scale(1, -1);
                if (hi.rot) ctx.rotate(-hi.rot);
                ctx.font = `${fontSize}px Arial, sans-serif`;
                ctx.fillText(hi.text, 0, 0);
                ctx.restore();
                break;
            }

            case 'point': {
                const sz = 6 / cam.zoom;
                ctx.fillRect(hi.x - sz/2, hi.y - sz/2, sz, sz);
                break;
            }

            case 'solid': {
                ctx.beginPath();
                ctx.moveTo(hi.pts[0].x, hi.pts[0].y);
                for (let i = 1; i < hi.pts.length; i++) {
                    ctx.lineTo(hi.pts[i].x, hi.pts[i].y);
                }
                ctx.closePath();
                ctx.globalAlpha = 0.5;
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.stroke();
                break;
            }

            case 'hatchfill': {
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                for (const path of hi.paths) {
                    if (path.length < 2) continue;
                    ctx.moveTo(path[0].x, path[0].y);
                    for (let i = 1; i < path.length; i++) {
                        const v = path[i];
                        const prev = path[i - 1];
                        if (prev.bulge && prev.bulge !== 0) {
                            drawBulgeArc(ctx, prev.x, prev.y, v.x, v.y, prev.bulge);
                        } else {
                            ctx.lineTo(v.x, v.y);
                        }
                    }
                    ctx.closePath();
                }
                ctx.fill();
                ctx.globalAlpha = 1;
                break;
            }
        }
        ctx.restore();
    }

    // === Room validation overlays ===
    renderRoomOverlays();

    ctx.restore();
}

// =============================================
// Hit Testing & Feature Popup
// =============================================

export function hitTest(wx, wy, tolerance) {
    if (!state.drawingData) return null;
    let best = null;
    let bestDist = tolerance;

    for (const item of state.drawingData.renderList) {
        if (state.tabFilterLayers ? !state.tabFilterLayers.has(item.l) : state.hiddenLayers.has(item.l)) continue;
        let d = Infinity;

        switch (item.t) {
            case 'line':
                d = distPointToSegment(wx, wy, item.x1, item.y1, item.x2, item.y2);
                break;

            case 'poly': {
                const v = item.verts;
                // For closed polygons, check if point is inside
                if (item.closed && v.length > 2 && pointInPoly(wx, wy, v)) {
                    d = 0;
                } else {
                    for (let i = 1; i < v.length; i++) {
                        d = Math.min(d, distPointToSegment(wx, wy, v[i-1].x, v[i-1].y, v[i].x, v[i].y));
                    }
                    if (item.closed && v.length > 1) {
                        d = Math.min(d, distPointToSegment(wx, wy, v[v.length-1].x, v[v.length-1].y, v[0].x, v[0].y));
                    }
                }
                break;
            }

            case 'circle':
                d = Math.abs(Math.hypot(wx - item.cx, wy - item.cy) - item.r);
                break;

            case 'arc': {
                const dist = Math.hypot(wx - item.cx, wy - item.cy);
                const angle = Math.atan2(wy - item.cy, wx - item.cx);
                // Normalize angles
                let sa = item.sa, ea = item.ea;
                let a = angle;
                while (a < sa) a += Math.PI * 2;
                const inArc = a <= ea || (ea < sa && (a >= sa || a <= ea));
                d = inArc ? Math.abs(dist - item.r) : Math.min(
                    Math.hypot(wx - (item.cx + item.r * Math.cos(sa)), wy - (item.cy + item.r * Math.sin(sa))),
                    Math.hypot(wx - (item.cx + item.r * Math.cos(ea)), wy - (item.cy + item.r * Math.sin(ea)))
                );
                break;
            }

            case 'ellipse':
                // Approximate: transform to circle space
                d = Math.abs(Math.hypot(wx - item.cx, wy - item.cy) - (item.rx + item.ry) / 2);
                break;

            case 'text': {
                // Simple bounding box approximation
                const tw = item.text.length * item.h * 0.6;
                const th = item.h;
                if (wx >= item.x && wx <= item.x + tw && wy >= item.y - th && wy <= item.y + th) {
                    d = 0;
                }
                break;
            }

            case 'point':
                d = Math.hypot(wx - item.x, wy - item.y);
                break;

            case 'solid': {
                for (let i = 0; i < item.pts.length; i++) {
                    const j = (i + 1) % item.pts.length;
                    d = Math.min(d, distPointToSegment(wx, wy, item.pts[i].x, item.pts[i].y, item.pts[j].x, item.pts[j].y));
                }
                break;
            }

            case 'hatchfill': {
                // Test point-in-polygon for each boundary path
                for (const path of item.paths) {
                    if (path.length < 3) continue;
                    if (pointInPoly(wx, wy, path)) { d = 0; break; }
                }
                // Also test edges if not inside
                if (d > 0) {
                    for (const path of item.paths) {
                        for (let i = 0; i < path.length; i++) {
                            const j = (i + 1) % path.length;
                            d = Math.min(d, distPointToSegment(wx, wy, path[i].x, path[i].y, path[j].x, path[j].y));
                        }
                    }
                }
                break;
            }
        }

        if (d < bestDist) {
            bestDist = d;
            best = item;
        }
    }
    return best;
}

export function showFeaturePopup(item, screenX, screenY) {
    let html = `<div class="feature-popup__title">
        <span class="feature-popup__badge">${esc(item.et)}</span>
    </div>`;

    const row = (label, value) =>
        `<div class="feature-popup__row"><span class="feature-popup__label">${label}</span><span class="feature-popup__value">${value}</span></div>`;

    html += row('Layer', esc(item.l));
    const safeColor = /^#[0-9a-fA-F]{3,8}$|^hsl\(\d{1,3},\s?\d{1,3}%,\s?\d{1,3}%\)$|^rgba?\(\d/.test(item.c) ? item.c : '#CCCCCC';
    html += row('Farbe', `<span class="feature-popup__color-swatch" style="background:${safeColor}"></span> ${esc(item.c)}`);
    if (item.handle) html += row('Handle', esc(item.handle));

    // Type-specific details
    switch (item.t) {
        case 'line':
            html += row('Start', `${item.x1.toFixed(2)}, ${item.y1.toFixed(2)}`);
            html += row('Ende', `${item.x2.toFixed(2)}, ${item.y2.toFixed(2)}`);
            html += row('L\u00e4nge', Math.hypot(item.x2 - item.x1, item.y2 - item.y1).toFixed(2));
            break;
        case 'poly':
            html += row('Eckpunkte', item.verts.length);
            html += row('Geschlossen', item.closed ? 'Ja' : 'Nein');
            break;
        case 'circle':
            html += row('Zentrum', `${item.cx.toFixed(2)}, ${item.cy.toFixed(2)}`);
            html += row('Radius', item.r.toFixed(2));
            break;
        case 'arc':
            html += row('Zentrum', `${item.cx.toFixed(2)}, ${item.cy.toFixed(2)}`);
            html += row('Radius', item.r.toFixed(2));
            html += row('Winkel', `${(item.sa * 180 / Math.PI).toFixed(1)}\u00b0 - ${(item.ea * 180 / Math.PI).toFixed(1)}\u00b0`);
            break;
        case 'ellipse':
            html += row('Zentrum', `${item.cx.toFixed(2)}, ${item.cy.toFixed(2)}`);
            html += row('Radien', `${item.rx.toFixed(2)} / ${item.ry.toFixed(2)}`);
            break;
        case 'text':
            html += row('Text', esc(item.text.length > 30 ? item.text.slice(0, 30) + '...' : item.text));
            html += row('H\u00f6he', item.h.toFixed(2));
            break;
        case 'point':
            html += row('Position', `${item.x.toFixed(2)}, ${item.y.toFixed(2)}`);
            break;
        case 'solid':
            html += row('Ecken', item.pts.length);
            break;
        case 'hatchfill': {
            html += row('Grenzen', item.paths.length);
            let totalVerts = 0;
            let totalArea = 0;
            for (const path of item.paths) {
                totalVerts += path.length;
                totalArea += Math.abs(computePolygonArea(path));
            }
            html += row('Eckpunkte', totalVerts);
            if (totalArea > 0) html += row('Fl\u00e4che', fmtNum(totalArea, 1) + ' m\u00B2');
            break;
        }
    }

    dom.featurePopup.innerHTML = html;

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // Bottom card positioning — CSS handles left/right/bottom via media query
        dom.featurePopup.style.left = '';
        dom.featurePopup.style.right = '';
        dom.featurePopup.style.bottom = '';
        dom.featurePopup.style.top = '';
        dom.featurePopup.classList.add('visible');
    } else {
        // Position popup near click, clamped within canvas-wrap
        const wrapRect = dom.canvasWrap.getBoundingClientRect();
        let px = screenX + 12;
        let py = screenY - 12;
        dom.featurePopup.style.left = '0px';
        dom.featurePopup.style.top = '0px';
        dom.featurePopup.classList.add('visible');
        const popRect = dom.featurePopup.getBoundingClientRect();
        if (px + popRect.width > wrapRect.width - 8) px = screenX - popRect.width - 12;
        if (py + popRect.height > wrapRect.height - 8) py = wrapRect.height - popRect.height - 8;
        if (px < 8) px = 8;
        if (py < 8) py = 8;
        dom.featurePopup.style.left = px + 'px';
        dom.featurePopup.style.top = py + 'px';
    }
}

export function hideFeaturePopup() {
    dom.featurePopup.classList.remove('visible');
}

// =============================================
// Zoom
// =============================================

export function zoomExtents() {
    if (!state.drawingData) return;
    const { bounds } = state.drawingData;
    const rect = dom.canvasWrap.getBoundingClientRect();

    state.cam.x = bounds.minX + bounds.width / 2;
    state.cam.y = bounds.minY + bounds.height / 2;

    const zx = rect.width / bounds.width;
    const zy = rect.height / bounds.height;
    state.cam.zoom = Math.min(zx, zy) * 0.92;

    render();
}

export function zoomToPolygon(verts) {
    if (!verts || verts.length < 2) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of verts) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
    }
    const rect = dom.canvasWrap.getBoundingClientRect();
    state.cam.x = (minX + maxX) / 2;
    state.cam.y = (minY + maxY) / 2;
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    state.cam.zoom = Math.min(rect.width / w, rect.height / h) * 0.5;
    render();
}

export function getItemBounds(item) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function expand(x, y) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    switch (item.t) {
        case 'line':
            expand(item.x1, item.y1);
            expand(item.x2, item.y2);
            break;
        case 'poly':
            for (const v of item.verts) expand(v.x, v.y);
            break;
        case 'circle':
            expand(item.cx - item.r, item.cy - item.r);
            expand(item.cx + item.r, item.cy + item.r);
            break;
        case 'arc':
            expand(item.cx - item.r, item.cy - item.r);
            expand(item.cx + item.r, item.cy + item.r);
            break;
        case 'ellipse':
            expand(item.cx - item.rx, item.cy - item.ry);
            expand(item.cx + item.rx, item.cy + item.ry);
            break;
        case 'text':
            expand(item.x, item.y);
            expand(item.x + (item.h || 10) * (item.text || '').length * 0.6, item.y + (item.h || 10));
            break;
        case 'point':
            expand(item.x, item.y);
            break;
        case 'hatchfill':
            for (const path of item.paths) {
                for (const v of path) expand(v.x, v.y);
            }
            break;
        case 'solid':
            for (const p of item.pts) expand(p.x, p.y);
            break;
    }
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
}

export function zoomToBounds(minX, minY, maxX, maxY, padding) {
    const rect = dom.canvasWrap.getBoundingClientRect();
    state.cam.x = (minX + maxX) / 2;
    state.cam.y = (minY + maxY) / 2;
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    state.cam.zoom = Math.min(rect.width / w, rect.height / h) * (padding || 0.5);
    render();
}

export function zoomToItems(items) {
    if (!items || items.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const item of items) {
        const b = getItemBounds(item);
        if (!b) continue;
        if (b.minX < minX) minX = b.minX;
        if (b.minY < minY) minY = b.minY;
        if (b.maxX > maxX) maxX = b.maxX;
        if (b.maxY > maxY) maxY = b.maxY;
    }
    if (minX === Infinity) return;
    zoomToBounds(minX, minY, maxX, maxY, 0.5);
}

export function showPopupForItem(handle, centroid) {
    if (!state.drawingData || !handle) return;
    const item = state.drawingData.renderList.find(i => i.handle === handle);
    if (!item) return;
    // Select it for highlight
    state.selectedItem = item;
    render();
    // Show popup at centroid screen position
    const [sx, sy] = worldToScreen(centroid.x, centroid.y);
    showFeaturePopup(item, sx, sy);
}

// Sync viewer click selection to side panel list
export function syncSideSelection(handle) {
    if (!handle || !dom.vsideList) return;
    dom.vsideList.querySelectorAll('.vside-item').forEach(el => el.classList.remove('vside-item--selected'));
    const match = dom.vsideList.querySelector(`[data-handle="${handle}"]`);
    if (match) {
        match.classList.add('vside-item--selected');
        match.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    // Also update selectedRoom for overlay highlighting
    if (state.validationMode === 'rooms') {
        state.selectedRoom = state.roomData.find(r => r.handle === handle) || null;
    } else if (state.validationMode === 'areas') {
        state.selectedRoom = state.areaData.find(a => a.handle === handle) || null;
    } else if (state.validationMode === 'errors') {
        const room = state.roomData.find(r => r.handle === handle);
        state.selectedRoom = room || null;
    }
}

// =============================================
// Room Overlay Rendering
// =============================================

function getRoomOverlayColor(room) {
    if (state.selectedRoom && state.selectedRoom.id === room.id) {
        return { fill: OV.selectedFill, stroke: OV.selectedStroke };
    }

    switch (state.validationMode) {
        case 'overview':
            return { fill: OV.neutralFill, stroke: OV.neutralStroke };
        case 'rooms':
            if (room.status === 'error') return { fill: OV.errorFill, stroke: OV.errorStroke };
            if (room.status === 'warning') return { fill: OV.warningFill, stroke: OV.warningStroke };
            return { fill: OV.successFill, stroke: OV.successStroke };
        case 'errors': {
            const hasError = state.validationErrors.some(e => e.roomId === room.id);
            if (hasError) {
                const sev = state.validationErrors.find(e => e.roomId === room.id).severity;
                return sev === 'error'
                    ? { fill: OV.errorFill, stroke: OV.errorStroke }
                    : { fill: OV.warningFill, stroke: OV.warningStroke };
            }
            return { fill: OV.mutedFill, stroke: OV.mutedStroke };
        }
        case 'kennzahlen':
            return SIA_COLORS[room.siaCategory] || { fill: OV.neutralFill, stroke: OV.neutralStroke };
        case 'areas':
            return { fill: OV.mutedFill, stroke: OV.mutedStroke };
        default:
            return null;
    }
}

function getAreaOverlayColor(area) {
    if (state.selectedRoom && state.selectedRoom.id === area.id) {
        return { fill: OV.selectedFill, stroke: OV.selectedStroke };
    }
    if (area.status === 'error') return { fill: OV.errorFill, stroke: OV.errorStroke };
    if (area.status === 'warning') return { fill: OV.warningFill, stroke: OV.warningStroke };
    return { fill: OV.successFill, stroke: OV.successStroke };
}

function drawPolyPath(verts) {
    const ctx = dom.ctx;
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) {
        const prev = verts[i - 1];
        const v = verts[i];
        if (prev.bulge && prev.bulge !== 0) {
            drawBulgeArc(ctx, prev.x, prev.y, v.x, v.y, prev.bulge);
        } else {
            ctx.lineTo(v.x, v.y);
        }
    }
    // Close
    const last = verts[verts.length - 1];
    const first = verts[0];
    if (last.bulge && last.bulge !== 0) {
        drawBulgeArc(ctx, last.x, last.y, first.x, first.y, last.bulge);
    } else {
        ctx.lineTo(first.x, first.y);
    }
}

function renderRoomOverlays() {
    const ctx = dom.ctx;
    const cam = state.cam;

    // Only draw overlays in rooms and areas tabs
    if (state.validationMode !== 'rooms' && state.validationMode !== 'areas') return;

    // Draw area polygons in areas mode (same style as rooms)
    if (state.validationMode === 'areas') {
        for (const area of state.areaData) {
            if (state.hiddenAreaIds.has(area.id)) continue;
            if (state.resultFilter === 'errors' && area.status !== 'error') continue;
            if (state.resultFilter === 'warnings' && area.status !== 'warning') continue;
            const colors = getAreaOverlayColor(area);
            if (!colors) continue;

            ctx.beginPath();
            drawPolyPath(area.vertices);
            ctx.closePath();
            ctx.fillStyle = colors.fill;
            ctx.fill();
            ctx.strokeStyle = colors.stroke;
            ctx.lineWidth = (state.selectedRoom && state.selectedRoom.id === area.id ? 2.5 : 1.5) / cam.zoom;
            ctx.stroke();
        }

        // Area labels (second pass — collision detection, same as rooms)
        const placedAreaLabels = [];
        const visibleAreas = state.areaData.filter(a => {
            if (state.hiddenAreaIds.has(a.id)) return false;
            if (state.resultFilter === 'errors' && a.status !== 'error') return false;
            if (state.resultFilter === 'warnings' && a.status !== 'warning') return false;
            return true;
        });
        visibleAreas.sort((a, b) => b.area - a.area);

        const areaFontSize = 11;
        const areaWorldFont = areaFontSize / cam.zoom;

        for (const area of visibleAreas) {
            const [sx, sy] = worldToScreen(area.centroid.x, area.centroid.y);
            const labelW = area.aoid.length * areaFontSize * 0.6 + 12;
            const labelH = areaFontSize * 2.4;
            const box = { x: sx - labelW / 2, y: sy - labelH / 2, w: labelW, h: labelH };

            const overlaps = placedAreaLabels.some(p =>
                box.x < p.x + p.w && box.x + box.w > p.x &&
                box.y < p.y + p.h && box.y + box.h > p.y
            );
            if (overlaps) continue;
            placedAreaLabels.push(box);

            ctx.save();
            ctx.translate(area.centroid.x, area.centroid.y);
            ctx.scale(1, -1);

            // Background pill
            const pillW = labelW / cam.zoom;
            const pillH = labelH / cam.zoom;
            ctx.fillStyle = OV.labelBg;
            ctx.beginPath();
            const pr = 2 / cam.zoom;
            ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pr);
            ctx.fill();

            // Area name
            ctx.font = `600 ${areaWorldFont}px system-ui, sans-serif`;
            ctx.fillStyle = OV.labelText;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(area.aoid, 0, -areaWorldFont * 0.2);

            // Area value
            ctx.font = `${areaWorldFont * 0.7}px system-ui, sans-serif`;
            ctx.fillStyle = OV.labelSecondary;
            ctx.fillText(fmtNum(area.area, 1) + ' m\u00B2', 0, areaWorldFont * 0.55);

            ctx.restore();
        }
    }

    // Draw room overlays (only in rooms tab)
    if (state.validationMode !== 'rooms') return;
    if (state.roomData.length === 0) return;

    for (const room of state.roomData) {
        if (state.hiddenLayers.has(room.layer)) continue;
        if (state.hiddenRoomIds.has(room.id)) continue;
        if (state.resultFilter === 'errors' && room.status !== 'error') continue;
        if (state.resultFilter === 'warnings' && room.status !== 'warning') continue;

        const colors = getRoomOverlayColor(room);
        if (!colors) continue;

        ctx.beginPath();
        drawPolyPath(room.vertices);
        ctx.closePath();

        ctx.fillStyle = colors.fill;
        ctx.fill();
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = (state.selectedRoom && state.selectedRoom.id === room.id ? 2.5 : 1.5) / cam.zoom;
        ctx.stroke();
    }

    // ── Room labels (second pass — collision detection) ──
    const placedLabels = [];
    const visibleRooms = state.roomData.filter(room => {
        if (state.hiddenLayers.has(room.layer)) return false;
        if (state.hiddenRoomIds.has(room.id)) return false;
        if (state.resultFilter === 'errors' && room.status !== 'error') return false;
        if (state.resultFilter === 'warnings' && room.status !== 'warning') return false;
        return true;
    });
    // Sort largest rooms first — they get label priority
    visibleRooms.sort((a, b) => b.area - a.area);

    // Fixed screen-space font size for all labels
    const screenFontSize = 11;
    const worldFontSize = screenFontSize / cam.zoom;

    for (const room of visibleRooms) {
        // Compute screen-space bounding box for collision
        const [sx, sy] = worldToScreen(room.centroid.x, room.centroid.y);
        const labelW = room.aoid.length * screenFontSize * 0.6 + 12;
        const labelH = screenFontSize * 2.4;
        const box = { x: sx - labelW / 2, y: sy - labelH / 2, w: labelW, h: labelH };

        // Check overlap with already placed labels
        const overlaps = placedLabels.some(p =>
            box.x < p.x + p.w && box.x + box.w > p.x &&
            box.y < p.y + p.h && box.y + box.h > p.y
        );
        if (overlaps) continue;
        placedLabels.push(box);

        // Draw label
        ctx.save();
        ctx.translate(room.centroid.x, room.centroid.y);
        ctx.scale(1, -1);

        // Background pill
        const pillW = labelW / cam.zoom;
        const pillH = labelH / cam.zoom;
        ctx.fillStyle = OV.labelBg;
        ctx.beginPath();
        const pr = 2 / cam.zoom;
        ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pr);
        ctx.fill();

        // Room name
        ctx.font = `600 ${worldFontSize}px system-ui, sans-serif`;
        ctx.fillStyle = OV.labelText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(room.aoid, 0, -worldFontSize * 0.2);

        // Area value
        ctx.font = `${worldFontSize * 0.7}px system-ui, sans-serif`;
        ctx.fillStyle = OV.labelSecondary;
        ctx.fillText(fmtNum(room.area) + ' m\u00B2', 0, worldFontSize * 0.55);

        ctx.restore();
    }
}
