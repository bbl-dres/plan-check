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
    if (type === 'loading') {
        dom.statusEl.innerHTML = `<div class="spinner"></div><span></span>`;
        dom.statusEl.querySelector('span').textContent = msg;
    } else if (type === 'success') {
        dom.statusEl.innerHTML = `<span></span><a href="#console-panel" class="status__console-link">Konsole &#x25BE;</a>`;
        dom.statusEl.querySelector('span').textContent = msg;
        dom.statusEl.querySelector('.status__console-link').addEventListener('click', (e) => {
            e.preventDefault();
            const consolePanelEl = document.getElementById('console-panel');
            if (consolePanelEl) consolePanelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    } else {
        dom.statusEl.textContent = msg;
    }
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
    if (v == null || !isFinite(v)) return '-';
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

// Cross product of vectors (b-a) x (c-a)
function cross(ax, ay, bx, by, cx, cy) {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

// Check if two line segments (a→b) and (c→d) properly intersect
export function segmentsIntersect(a, b, c, d) {
    const d1 = cross(c.x, c.y, d.x, d.y, a.x, a.y);
    const d2 = cross(c.x, c.y, d.x, d.y, b.x, b.y);
    const d3 = cross(a.x, a.y, b.x, b.y, c.x, c.y);
    const d4 = cross(a.x, a.y, b.x, b.y, d.x, d.y);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return true;
    }
    return false;
}

// Check if a closed polygon has self-intersections (O(n²) edge test)
export function hasSelfIntersection(verts) {
    const n = verts.length;
    if (n < 4) return false;
    for (let i = 0; i < n; i++) {
        const i2 = (i + 1) % n;
        for (let j = i + 2; j < n; j++) {
            if (i === 0 && j === n - 1) continue; // adjacent edges share vertex
            const j2 = (j + 1) % n;
            if (segmentsIntersect(verts[i], verts[i2], verts[j], verts[j2])) return true;
        }
    }
    return false;
}

// Hash vertex array for duplicate polygon detection
export function hashVertices(verts) {
    return verts.map(v => `${Math.round(v.x * 10)},${Math.round(v.y * 10)}`).join('|');
}

// Visual center of polygon (pole of inaccessibility) — finds the point
// inside the polygon that is farthest from any edge. Works correctly
// for concave, L-shaped, and other complex polygons where the simple
// centroid may fall outside the shape.
export function visualCenter(verts) {
    if (verts.length < 3) {
        let cx = 0, cy = 0;
        for (const v of verts) { cx += v.x; cy += v.y; }
        return { x: cx / (verts.length || 1), y: cy / (verts.length || 1) };
    }

    // Bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of verts) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 1e-10 && height < 1e-10) return { x: minX, y: minY };

    // Signed distance from point to polygon boundary (positive = inside)
    function pointToPoly(px, py) {
        let minDist = Infinity;
        for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
            const d = distPointToSegment(px, py, verts[i].x, verts[i].y, verts[j].x, verts[j].y);
            if (d < minDist) minDist = d;
        }
        return pointInPoly(px, py, verts) ? minDist : -minDist;
    }

    const cellSize = Math.min(width, height);
    let h = cellSize / 2;
    const precision = cellSize * 0.01;

    // Initial cells covering bounding box
    const queue = [];
    for (let x = minX; x < maxX; x += cellSize) {
        for (let y = minY; y < maxY; y += cellSize) {
            const cx = x + h, cy = y + h;
            const d = pointToPoly(cx, cy);
            queue.push({ x: cx, y: cy, h, d, max: d + h * Math.SQRT2 });
        }
    }

    // Start with centroid as initial best guess
    let cx = 0, cy = 0;
    for (const v of verts) { cx += v.x; cy += v.y; }
    cx /= verts.length; cy /= verts.length;
    let bestD = pointToPoly(cx, cy);
    let bestX = cx, bestY = cy;

    // Sort ascending by max potential (pop from end = highest potential)
    queue.sort((a, b) => a.max - b.max);

    let iters = 0;
    while (queue.length > 0 && iters++ < 5000) {
        const cell = queue.pop();

        if (cell.d > bestD) {
            bestD = cell.d;
            bestX = cell.x;
            bestY = cell.y;
        }

        // Can this cell improve on best?
        if (cell.max - bestD <= precision) continue;

        // Split into 4 children
        h = cell.h / 2;
        for (const [dx, dy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
            const nx = cell.x + dx * h;
            const ny = cell.y + dy * h;
            const d = pointToPoly(nx, ny);
            // Binary insert to maintain sort order
            const item = { x: nx, y: ny, h, d, max: d + h * Math.SQRT2 };
            let lo = 0, hi = queue.length;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (queue[mid].max < item.max) lo = mid + 1; else hi = mid;
            }
            queue.splice(lo, 0, item);
        }
    }

    return { x: bestX, y: bestY };
}
