// =============================================
// Pure Utility Functions
// =============================================

import { ACI, dom } from './state.js';

// Logger
export function log(msg, type = 'info') {
    const ts = new Date().toLocaleTimeString('de-CH');
    const line = document.createElement('div');
    line.className = `log-${type}`;
    line.textContent = `[${ts}] ${msg}`;
    dom.consoleLog.appendChild(line);
    dom.consoleLog.scrollTop = dom.consoleLog.scrollHeight;
}

export function showStatus(msg, type = 'loading') {
    dom.statusEl.className = `status status--${type}`;
    dom.statusEl.style.display = 'flex';
    dom.statusEl.innerHTML = type === 'loading'
        ? `<div class="spinner"></div><span>${msg}</span>`
        : msg;
}

// Format file size
export function fmtSize(bytes) {
    if (bytes <= 0) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + u[i];
}

// HTML escape
export function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// Swiss number formatting: 1234.5 → "1'234.5"
export function fmtNum(v, decimals = 0) {
    const fixed = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString();
    const [intPart, decPart] = fixed.split('.');
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "\u2019");
    return decPart !== undefined ? formatted + '.' + decPart : formatted;
}

// ACI color index to hex
export function aciToHex(i) { return ACI[i] || `hsl(${(i * 137) % 360}, 60%, 50%)`; }

// Shoelace formula for polygon area
export function computePolygonArea(verts) {
    let area = 0;
    const n = verts.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += verts[i].x * verts[j].y;
        area -= verts[j].x * verts[i].y;
    }
    return Math.abs(area) / 2;
}

// Ray-casting point-in-polygon test
export function pointInPoly(px, py, verts) {
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i].x, yi = verts[i].y;
        const xj = verts[j].x, yj = verts[j].y;
        if (((yi > py) !== (yj > py)) &&
            (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

// Point-to-segment distance
export function distPointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-12) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
