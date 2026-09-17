// =============================================
// Camera: world ↔ screen mapping and zoom operations (the renderer draws, app.js wires input)
// =============================================

import { state, dom } from './state.js';
import { isFiniteBounds } from './geometry.js';

const MIN_ZOOM = 0.001;
const MAX_ZOOM = 10000;
const FIT_FRACTION = 0.92;    // share of the view used by "zoom extents"
const FOCUS_FRACTION = 0.5;   // share of the view used when zooming to a single element

let viewWidth = 1;
let viewHeight = 1;

/** Re-reads the canvas wrapper size; called by resizeCanvas() so per-frame code never touches layout. */
export function updateViewSize() {
    const rect = dom.canvasWrap.getBoundingClientRect();
    viewWidth = Math.max(1, rect.width);
    viewHeight = Math.max(1, rect.height);
    return rect;
}

export function getViewSize() {
    return { width: viewWidth, height: viewHeight };
}

export function clampZoom(zoom) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

export function worldToScreen(wx, wy) {
    const { x, y, zoom } = state.cam;
    return [(wx - x) * zoom + viewWidth / 2, -(wy - y) * zoom + viewHeight / 2];
}

export function screenToWorld(sx, sy) {
    const { x, y, zoom } = state.cam;
    return [(sx - viewWidth / 2) / zoom + x, -(sy - viewHeight / 2) / zoom + y];
}

/** World rectangle currently visible, for culling. */
export function viewBounds() {
    const [x0, y0] = screenToWorld(0, 0);
    const [x1, y1] = screenToWorld(viewWidth, viewHeight);
    return { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minY: Math.min(y0, y1), maxY: Math.max(y0, y1) };
}

/** Moves the camera so that world point (wx, wy) appears at screen point (sx, sy). */
export function anchorWorldPoint(wx, wy, sx, sy) {
    state.cam.x = wx - (sx - viewWidth / 2) / state.cam.zoom;
    state.cam.y = wy + (sy - viewHeight / 2) / state.cam.zoom;
}

/** Sets an absolute zoom while keeping the world point under (sx, sy) in place. */
function setZoomAt(sx, sy, zoom) {
    const [wx, wy] = screenToWorld(sx, sy);
    state.cam.zoom = clampZoom(zoom);
    anchorWorldPoint(wx, wy, sx, sy);
}

/** Multiplies the zoom while keeping the world point under (sx, sy) in place. */
export function zoomAt(sx, sy, factor) {
    setZoomAt(sx, sy, state.cam.zoom * factor);
}

/** Zooms about the view centre. */
export function zoomBy(factor) {
    setZoomAt(viewWidth / 2, viewHeight / 2, state.cam.zoom * factor);
}

/** Centres the camera on a bounds rectangle so it fills the given share of the view. */
export function zoomToBounds(bounds, fraction = FOCUS_FRACTION) {
    if (!isFiniteBounds(bounds)) return;
    const w = (bounds.maxX - bounds.minX) || 1;
    const h = (bounds.maxY - bounds.minY) || 1;
    state.cam.x = (bounds.minX + bounds.maxX) / 2;
    state.cam.y = (bounds.minY + bounds.maxY) / 2;
    state.cam.zoom = clampZoom(Math.min(viewWidth / w, viewHeight / h) * fraction);
}

export function zoomExtents() {
    if (state.drawingData) zoomToBounds(state.drawingData.bounds, FIT_FRACTION);
}
