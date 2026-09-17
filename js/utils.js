// =============================================
// Small DOM, formatting and colour helpers
// =============================================

import { dom } from './state.js';
import { getLocale } from './i18n.js';

/** Appends a timestamped line to the console panel. type: info | success | warn | error */
export function log(msg, type = 'info') {
    const ts = new Date().toLocaleTimeString(getLocale() + '-CH');
    const line = document.createElement('div');
    line.className = `log-${type}`;
    line.textContent = `[${ts}] ${msg}`;
    dom.consoleLog.appendChild(line);
    dom.consoleLog.scrollTop = dom.consoleLog.scrollHeight;
}

/** Shows the status bar. type: loading | success | error */
export function showStatus(msg, type = 'loading') {
    dom.statusEl.className = `status status--${type}`;
    dom.statusEl.style.display = 'flex';
    if (type === 'loading') {
        dom.statusEl.innerHTML = '<div class="spinner"></div><span></span>';
        dom.statusEl.querySelector('span').textContent = msg;
    } else {
        dom.statusEl.textContent = msg;
    }
}

export function fmtSize(bytes) {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

/** Swiss number format: 1234.5 → "1’234.5"; non-finite values become "-". */
export function fmtNum(v, decimals = 0) {
    if (v == null || !isFinite(v)) return '-';
    const fixed = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString();
    const [intPart, decPart] = fixed.split('.');
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '’');
    return decPart !== undefined ? grouped + '.' + decPart : grouped;
}

/** "517.1 m²" */
export function fmtArea(v, decimals = 1) {
    return fmtNum(v, decimals) + ' m²';
}

// ── Colours ──

const ACI_FIXED = {
    1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF', 5: '#0000FF', 6: '#FF00FF',
    7: '#FFFFFF', 8: '#414141', 9: '#808080',
    250: '#333333', 251: '#5B5B5B', 252: '#848484', 253: '#ADADAD', 254: '#D6D6D6', 255: '#FFFFFF',
};
const ACI_VALUES = [1, 0.8, 0.6, 0.5, 0.3];
const aciCache = new Map();

function hsvToHex(h, s, v) {
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
    return '#' + [r, g, b].map(ch => Math.round((ch + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * AutoCAD Color Index → hex. Indices 10–249 follow the standard palette
 * (24 hues × 5 brightness levels, odd indices at half saturation). 0 and 256 are ByBlock/ByLayer
 * and are resolved by the caller; they fall back to grey here.
 */
export function aciToHex(index) {
    const i = Math.abs(Number(index) || 0);
    if (ACI_FIXED[i]) return ACI_FIXED[i];
    if (i < 10 || i > 249) return '#CCCCCC';
    let hex = aciCache.get(i);
    if (!hex) {
        const hue = Math.floor((i - 10) / 10) * 15;
        const value = ACI_VALUES[Math.floor((i % 10) / 2)];
        hex = hsvToHex(hue, i % 2 === 0 ? 1 : 0.5, value);
        aciCache.set(i, hex);
    }
    return hex;
}

/** 24-bit integer 0xRRGGBB → "#RRGGBB" */
export function rgbIntToHex(rgb) {
    return '#' + (rgb & 0xFFFFFF).toString(16).padStart(6, '0').toUpperCase();
}

/** "#RRGGBB" → [r, g, b] */
export function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return [0, 0, 0];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Value of a CSS custom property from tokens.css, e.g. themeToken('--color-error') → "#B71C1C". */
export function themeToken(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ── Side panel selection ──

/** Removes the selection highlight from every side-panel row. */
export function clearSideSelection() {
    dom.sideList.querySelectorAll('.vside-item--selected').forEach(el => el.classList.remove('vside-item--selected'));
}

/** Highlights the side-panel row for a handle (if present) and scrolls it into view. */
export function selectSideRow(handle) {
    clearSideSelection();
    if (!handle) return;
    const row = dom.sideList.querySelector(`[data-handle="${CSS.escape(String(handle))}"]`);
    if (row) {
        row.classList.add('vside-item--selected');
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}
