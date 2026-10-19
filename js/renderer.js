// =============================================
// Canvas rendering: base drawing, highlights, room/area overlays, hit testing and the feature popup
// =============================================

import { state, dom, BG_LIGHT, MOBILE_BREAKPOINT_PX, matchesResultFilter } from './state.js';
import { esc, fmtArea, themeToken, hexToRgb } from './utils.js';
import { t } from './i18n.js';
import { polygonAreaM2, pointInPolygon, distancePointToSegment, distancePointToPolyline, bulgeArc, angleOnArc, boundsIntersect } from './geometry.js';
import { worldToScreen, getViewSize, updateViewSize, viewBounds } from './camera.js';

// Scale bar steps in millimetres (1-2-5 progression)
const SCALE_STEPS = [
    { mm: 1, label: '1 mm' }, { mm: 2, label: '2 mm' }, { mm: 5, label: '5 mm' },
    { mm: 10, label: '1 cm' }, { mm: 20, label: '2 cm' }, { mm: 50, label: '5 cm' },
    { mm: 100, label: '10 cm' }, { mm: 200, label: '20 cm' }, { mm: 500, label: '50 cm' },
    { mm: 1000, label: '1 m' }, { mm: 2000, label: '2 m' }, { mm: 5000, label: '5 m' },
    { mm: 10000, label: '10 m' }, { mm: 20000, label: '20 m' }, { mm: 50000, label: '50 m' },
    { mm: 100000, label: '100 m' }, { mm: 200000, label: '200 m' }, { mm: 500000, label: '500 m' },
];
const SCALE_BAR_MAX_PX = 150;

const TEXT_FONT_SCALE = 1.4;         // DWG text height is the cap height, canvas font size the em size
const TEXT_LINE_HEIGHT = 1.67;       // MTEXT line spacing factor 1 in multiples of the text height
const TEXT_WIDTH_PER_CHAR = 0.6;     // rough glyph width for hit testing
const MIN_TEXT_PX = 1.5;             // text smaller than this on screen is skipped
const NEAR_WHITE = 200;              // channel threshold for remapping white lines on a light background
const LIGHT_BG_LINE_COLOR = '#1a1a1a';
const HIGHLIGHT_GLOW_MAX_ITEMS = 50; // shadow blur is expensive; skip it for large highlight sets
const INTERIOR_HIT_FACTOR = 0.99;    // an interior hit loses against an outline within tolerance

const LABEL_FONT_PX = 11;
const LABEL_CHAR_WIDTH = 0.6;
const LABEL_HEIGHT_FACTOR = 2.4;

const BASE_STYLE = { pointPx: 3, hatchAlpha: 0.25, solidAlpha: 1, minTextPx: MIN_TEXT_PX };
const HIGHLIGHT_STYLE = { pointPx: 6, hatchAlpha: 0.4, solidAlpha: 0.5, minTextPx: 0 };

// Overlay colours come from tokens.css (read once; canvas cannot use CSS variables)
let overlay = null;
function overlayColors() {
    if (overlay) return overlay;
    const token = (name, fallback) => themeToken(name) || fallback;
    const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(', ')}, ${a})`;
    const primary = token('--accent', '#007daa');
    const error = token('--danger', '#d0433b');
    const warning = token('--warning', '#d99a1e');
    const success = token('--success', '#2e9e5b');
    overlay = {
        highlight: '#0099CC', highlightGlow: 'rgba(0, 153, 204, 0.6)',
        selected: { fill: rgba(primary, 0.35), stroke: primary },
        error: { fill: rgba(error, 0.3), stroke: error },
        warning: { fill: rgba(warning, 0.3), stroke: warning },
        ok: { fill: rgba(success, 0.25), stroke: success },
        labelBg: token('--surface-translucent', 'rgba(255, 255, 255, 0.9)'),
        labelText: token('--text', '#1a1d21'),
        font: token('--font', 'system-ui, sans-serif'),
        fontMono: token('--font-mono', 'monospace'),
        labelSecondary: token('--muted', '#646b74'),
    };
    return overlay;
}

// ── Canvas size ──

export function resizeCanvas() {
    const rect = updateViewSize();
    const dpr = window.devicePixelRatio || 1;
    dom.canvas.width = Math.round(rect.width * dpr);
    dom.canvas.height = Math.round(rect.height * dpr);
    dom.canvas.style.width = rect.width + 'px';
    dom.canvas.style.height = rect.height + 'px';
    dom.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ── Scale bar ──

function pickScaleStep() {
    const pxPerMm = state.cam.zoom / state.unitScale;
    let best = SCALE_STEPS[0];
    for (const step of SCALE_STEPS) {
        if (step.mm * pxPerMm <= SCALE_BAR_MAX_PX) best = step;
    }
    return { ...best, px: Math.round(best.mm * pxPerMm) };
}

function updateScaleBar() {
    const step = pickScaleStep();
    dom.scaleBar.hidden = false;
    dom.scaleBarLine.style.width = step.px + 'px';
    dom.scaleBarLabel.textContent = step.label;
}

/** Draws the scale bar into the canvas itself (for the report images). */
export function drawScaleBarOnCanvas() {
    const ctx = dom.ctx;
    const { height } = getViewSize();
    const step = pickScaleStep();
    const padX = 12, padY = 10, tickH = 6, fontSize = 11, gap = 4;

    ctx.save();
    ctx.resetTransform();
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);

    const x = padX, y = height - padY;
    ctx.font = `${fontSize}px ${overlayColors().fontMono}`;
    const labelW = ctx.measureText(step.label).width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x - 4, y - (tickH + fontSize + 6) - 2, step.px + gap + labelW + 12, tickH + fontSize + 10, 3);
    ctx.fill();

    ctx.strokeStyle = overlayColors().labelSecondary;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - tickH);
    ctx.lineTo(x, y);
    ctx.lineTo(x + step.px, y);
    ctx.lineTo(x + step.px, y - tickH);
    ctx.stroke();

    ctx.fillStyle = overlayColors().labelSecondary;
    ctx.textBaseline = 'bottom';
    ctx.fillText(step.label, x + step.px + gap, y);
    ctx.restore();
}

// ── Primitive drawing ──

/** Traces a polyline with bulge arcs into the current path. */
function tracePolyline(ctx, verts, closed) {
    const n = verts.length;
    if (n === 0) return;
    ctx.moveTo(verts[0].x, verts[0].y);
    const segments = closed ? n : n - 1;
    for (let i = 1; i <= segments; i++) {
        const prev = verts[i - 1];
        const v = verts[i % n];
        const arc = prev.bulge ? bulgeArc(prev.x, prev.y, v.x, v.y, prev.bulge) : null;
        if (arc) ctx.arc(arc.cx, arc.cy, arc.radius, arc.startAngle, arc.endAngle, arc.clockwise);
        else ctx.lineTo(v.x, v.y);
    }
}

function drawText(ctx, item, cam, style) {
    if (item.height * cam.zoom < style.minTextPx) return;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.scale(1, -1); // undo the world Y flip for glyphs
    if (item.rotation) ctx.rotate(-item.rotation);
    ctx.font = `${item.height * TEXT_FONT_SCALE}px Arial, sans-serif`;
    ctx.textAlign = item.halign;
    ctx.textBaseline = item.valign;
    if (item.widthFactor && item.widthFactor !== 1) ctx.scale(item.widthFactor, 1);
    const lines = item.lines || [item.text];
    const lineHeight = item.height * TEXT_LINE_HEIGHT * (item.lineSpacing || 1);
    let y0 = 0;
    if (lines.length > 1) {
        if (item.valign === 'middle') y0 = -(lines.length - 1) / 2 * lineHeight;
        else if (item.valign !== 'top') y0 = -(lines.length - 1) * lineHeight;
    }
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], 0, y0 + i * lineHeight);
    ctx.restore();
}

/** Draws one render item with the current stroke/fill colour. */
function drawItem(ctx, item, cam, style) {
    switch (item.kind) {
        case 'line':
            ctx.beginPath();
            ctx.moveTo(item.x1, item.y1);
            ctx.lineTo(item.x2, item.y2);
            ctx.stroke();
            break;
        case 'poly':
            ctx.beginPath();
            tracePolyline(ctx, item.verts, item.closed);
            ctx.stroke();
            break;
        case 'circle':
            ctx.beginPath();
            ctx.arc(item.cx, item.cy, item.r, 0, Math.PI * 2);
            ctx.stroke();
            break;
        case 'arc':
            // Canvas draws "clockwise" in its Y-down space; the world Y flip turns that into a CCW DWG arc
            ctx.beginPath();
            ctx.arc(item.cx, item.cy, item.r, item.startAngle, item.endAngle, false);
            ctx.stroke();
            break;
        case 'text':
            drawText(ctx, item, cam, style);
            break;
        case 'point': {
            const size = style.pointPx / cam.zoom;
            ctx.fillRect(item.x - size / 2, item.y - size / 2, size, size);
            break;
        }
        case 'solid':
            ctx.beginPath();
            tracePolyline(ctx, item.verts, true);
            ctx.closePath();
            if (style.solidAlpha < 1) { ctx.save(); ctx.globalAlpha = style.solidAlpha; ctx.fill(); ctx.restore(); ctx.stroke(); }
            else ctx.fill();
            break;
        case 'hatch':
            ctx.beginPath();
            for (const path of item.paths) {
                tracePolyline(ctx, path, true);
                ctx.closePath();
            }
            ctx.stroke();
            if (item.solid) {
                ctx.save();
                ctx.globalAlpha = style.hatchAlpha;
                ctx.fill('evenodd'); // inner loops are islands
                ctx.restore();
            }
            break;
    }
}

/** White and near-white DWG colours are unreadable on the light background. */
function displayColor(color, cache) {
    let mapped = cache.get(color);
    if (mapped === undefined) {
        const [r, g, b] = hexToRgb(color);
        mapped = (/^#/.test(color) && r > NEAR_WHITE && g > NEAR_WHITE && b > NEAR_WHITE) ? LIGHT_BG_LINE_COLOR : color;
        cache.set(color, mapped);
    }
    return mapped;
}

// ── Render loop ──

let renderPending = false;

/** Coalesces rapid render requests (pan, zoom) into one animation frame. */
export function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => { renderPending = false; render(); });
}

export function render() {
    if (!state.drawingData) return;
    const ctx = dom.ctx;
    const cam = state.cam;
    const { width, height } = getViewSize();

    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(cam.zoom, -cam.zoom); // world Y up
    ctx.translate(-cam.x, -cam.y);
    ctx.lineWidth = 1 / cam.zoom;   // hairlines regardless of zoom

    const view = viewBounds();
    const showBase = state.activeTab !== 'rooms' && state.activeTab !== 'areas';
    if (showBase) {
        const colorCache = new Map();
        const lightBg = state.bgColor === BG_LIGHT;
        let currentColor = null;
        for (const item of state.drawingData.renderList) {
            if (state.hiddenLayers.has(item.layer) || !boundsIntersect(item.bounds, view)) continue;
            const color = lightBg ? displayColor(item.color, colorCache) : item.color;
            if (color !== currentColor) { ctx.strokeStyle = color; ctx.fillStyle = color; currentColor = color; }
            drawItem(ctx, item, cam, BASE_STYLE);
        }
    }

    const highlighted = state.highlightedItems?.length ? state.highlightedItems : (state.selectedItem ? [state.selectedItem] : []);
    if (highlighted.length > 0) {
        const ov = overlayColors();
        ctx.save();
        ctx.strokeStyle = ov.highlight;
        ctx.fillStyle = ov.highlight;
        ctx.lineWidth = 3 / cam.zoom;
        if (highlighted.length <= HIGHLIGHT_GLOW_MAX_ITEMS) { ctx.shadowColor = ov.highlightGlow; ctx.shadowBlur = 10; }
        for (const item of highlighted) {
            if (state.hiddenLayers.has(item.layer)) continue;
            drawItem(ctx, item, cam, HIGHLIGHT_STYLE);
        }
        ctx.restore();
    }

    drawPolygonOverlays(ctx, cam);
    ctx.restore();
    updateScaleBar();
}

// ── Room / area overlays ──

function overlayEntries() {
    if (state.activeTab === 'rooms') return { entries: state.roomData, hidden: state.hiddenRoomIds };
    if (state.activeTab === 'areas') return { entries: state.areaData, hidden: state.hiddenAreaIds };
    return null;
}

/** Visible entries of the active overlay tab (hidden toggles, layer visibility and the result filter applied). */
export function visibleOverlayEntries() {
    const source = overlayEntries();
    if (!source) return [];
    return source.entries.filter(e => !source.hidden.has(e.id) && !state.hiddenLayers.has(e.layer) && matchesResultFilter(e.status));
}

function drawPolygonOverlays(ctx, cam) {
    const entries = visibleOverlayEntries();
    if (entries.length === 0) return;
    const ov = overlayColors();
    const isSelected = e => state.selectedPolygon && state.selectedPolygon.handle === e.handle;

    for (const entry of entries) {
        const colors = isSelected(entry) ? ov.selected : (ov[entry.status] || ov.ok);
        ctx.beginPath();
        tracePolyline(ctx, entry.vertices, true);
        ctx.closePath();
        ctx.fillStyle = colors.fill;
        ctx.fill();
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = (isSelected(entry) ? 2.5 : 1.5) / cam.zoom;
        ctx.stroke();
    }

    // Labels: largest entries first, skipping labels that would overlap an earlier one on screen
    const placed = [];
    const worldFont = LABEL_FONT_PX / cam.zoom;
    for (const entry of [...entries].sort((a, b) => b.area - a.area)) {
        const [sx, sy] = worldToScreen(entry.labelPoint.x, entry.labelPoint.y);
        const labelW = entry.aoid.length * LABEL_FONT_PX * LABEL_CHAR_WIDTH + 12;
        const labelH = LABEL_FONT_PX * LABEL_HEIGHT_FACTOR;
        const box = { x: sx - labelW / 2, y: sy - labelH / 2, w: labelW, h: labelH };
        if (placed.some(p => box.x < p.x + p.w && box.x + box.w > p.x && box.y < p.y + p.h && box.y + box.h > p.y)) continue;
        placed.push(box);

        ctx.save();
        ctx.translate(entry.labelPoint.x, entry.labelPoint.y);
        ctx.scale(1, -1);
        ctx.fillStyle = ov.labelBg;
        ctx.beginPath();
        ctx.roundRect(-labelW / 2 / cam.zoom, -labelH / 2 / cam.zoom, labelW / cam.zoom, labelH / cam.zoom, 2 / cam.zoom);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${worldFont}px ${ov.font}`;
        ctx.fillStyle = ov.labelText;
        ctx.fillText(entry.aoid, 0, -worldFont * 0.2);
        ctx.font = `${worldFont * 0.7}px ${ov.font}`;
        ctx.fillStyle = ov.labelSecondary;
        ctx.fillText(fmtArea(entry.area, 1), 0, worldFont * 0.55);
        ctx.restore();
    }
}

// ── Hit testing ──

/** Nearest visible render item within `tolerance` world units of (wx, wy), or null. */
export function hitTest(wx, wy, tolerance) {
    if (!state.drawingData) return null;
    let best = null;
    let bestDist = tolerance;
    const probe = { minX: wx - tolerance, maxX: wx + tolerance, minY: wy - tolerance, maxY: wy + tolerance };

    for (const item of state.drawingData.renderList) {
        if (state.hiddenLayers.has(item.layer) || !boundsIntersect(item.bounds, probe)) continue;
        let d = Infinity;
        switch (item.kind) {
            case 'line':
                d = distancePointToSegment(wx, wy, item.x1, item.y1, item.x2, item.y2);
                break;
            case 'poly':
                d = distancePointToPolyline(wx, wy, item.verts, item.closed);
                if (item.closed && item.verts.length > 2 && pointInPolygon(wx, wy, item.verts)) d = Math.min(d, tolerance * INTERIOR_HIT_FACTOR);
                break;
            case 'circle':
                d = Math.abs(Math.hypot(wx - item.cx, wy - item.cy) - item.r);
                break;
            case 'arc': {
                const angle = Math.atan2(wy - item.cy, wx - item.cx);
                if (angleOnArc(angle, item.startAngle, item.endAngle)) {
                    d = Math.abs(Math.hypot(wx - item.cx, wy - item.cy) - item.r);
                } else {
                    d = Math.min(
                        Math.hypot(wx - (item.cx + item.r * Math.cos(item.startAngle)), wy - (item.cy + item.r * Math.sin(item.startAngle))),
                        Math.hypot(wx - (item.cx + item.r * Math.cos(item.endAngle)), wy - (item.cy + item.r * Math.sin(item.endAngle))));
                }
                break;
            }
            case 'text': {
                const w = item.text.length * item.height * TEXT_WIDTH_PER_CHAR * (item.widthFactor || 1);
                const left = item.halign === 'center' ? item.x - w / 2 : item.halign === 'right' ? item.x - w : item.x;
                const bottom = item.valign === 'top' ? item.y - item.height : item.valign === 'middle' ? item.y - item.height / 2 : item.y;
                if (wx >= left && wx <= left + w && wy >= bottom && wy <= bottom + item.height) d = 0;
                break;
            }
            case 'point':
                d = Math.hypot(wx - item.x, wy - item.y);
                break;
            case 'solid':
                d = distancePointToPolyline(wx, wy, item.verts, true);
                break;
            case 'hatch':
                for (const path of item.paths) {
                    d = Math.min(d, distancePointToPolyline(wx, wy, path, true));
                    if (path.length > 2 && pointInPolygon(wx, wy, path)) d = Math.min(d, tolerance * INTERIOR_HIT_FACTOR);
                }
                break;
        }
        if (d < bestDist) { bestDist = d; best = item; }
    }
    return best;
}

// ── Feature popup ──

export function showFeaturePopup(item, screenX, screenY) {
    const row = (label, value) =>
        `<div class="feature-popup__row"><span class="feature-popup__label">${label}</span><span class="feature-popup__value">${value}</span></div>`;
    const point = (x, y) => `${x.toFixed(2)}, ${y.toFixed(2)}`;
    const safeColor = /^#[0-9a-fA-F]{6}$/.test(item.color) ? item.color : '#CCCCCC';

    let html = `<div class="feature-popup__title"><span class="feature-popup__badge">${esc(item.entityType)}</span></div>`;
    html += row(t('popup.layer'), esc(item.layer));
    html += row(t('popup.color'), `<span class="feature-popup__color-swatch" style="background:${safeColor}"></span> ${esc(item.color)}`);
    if (item.handle) html += row(t('popup.handle'), esc(item.handle));

    switch (item.kind) {
        case 'line':
            html += row(t('popup.start'), point(item.x1, item.y1));
            html += row(t('popup.end'), point(item.x2, item.y2));
            html += row(t('popup.length'), Math.hypot(item.x2 - item.x1, item.y2 - item.y1).toFixed(2));
            break;
        case 'poly':
            html += row(t('popup.vertices'), item.verts.length);
            html += row(t('popup.closed'), item.closed ? t('popup.yes') : t('popup.no'));
            break;
        case 'circle':
            html += row(t('popup.center'), point(item.cx, item.cy));
            html += row(t('popup.radius'), item.r.toFixed(2));
            break;
        case 'arc':
            html += row(t('popup.center'), point(item.cx, item.cy));
            html += row(t('popup.radius'), item.r.toFixed(2));
            html += row(t('popup.angle'), `${(item.startAngle * 180 / Math.PI).toFixed(1)}° - ${(item.endAngle * 180 / Math.PI).toFixed(1)}°`);
            break;
        case 'text':
            html += row(t('popup.text'), esc(item.text.length > 30 ? item.text.slice(0, 30) + '...' : item.text));
            html += row(t('popup.height'), item.height.toFixed(2));
            break;
        case 'point':
            html += row(t('popup.position'), point(item.x, item.y));
            break;
        case 'solid':
            html += row(t('popup.corners'), item.verts.length);
            break;
        case 'hatch': {
            html += row(t('popup.boundaries'), item.paths.length);
            html += row(t('popup.vertices'), item.paths.reduce((s, p) => s + p.length, 0));
            const area = item.paths.reduce((s, p) => s + polygonAreaM2(p, state.unitScale), 0);
            if (area > 0) html += row(t('popup.area'), fmtArea(area, 1));
            break;
        }
    }

    dom.featurePopup.innerHTML = html;
    dom.featurePopup.classList.add('visible');

    if (window.innerWidth <= MOBILE_BREAKPOINT_PX) {
        // Bottom card; the media query positions it
        dom.featurePopup.style.left = '';
        dom.featurePopup.style.top = '';
        return;
    }
    const { width, height } = getViewSize();
    dom.featurePopup.style.left = '0px';
    dom.featurePopup.style.top = '0px';
    const popRect = dom.featurePopup.getBoundingClientRect();
    let px = screenX + 12;
    let py = screenY - 12;
    if (px + popRect.width > width - 8) px = screenX - popRect.width - 12;
    if (py + popRect.height > height - 8) py = height - popRect.height - 8;
    dom.featurePopup.style.left = Math.max(8, px) + 'px';
    dom.featurePopup.style.top = Math.max(8, py) + 'px';
}

export function hideFeaturePopup() {
    dom.featurePopup.classList.remove('visible');
}
