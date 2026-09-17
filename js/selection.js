// =============================================
// Selection: one place that keeps canvas highlight, popup and side-panel row in sync
// =============================================

import { state } from './state.js';
import { render, showFeaturePopup, hideFeaturePopup } from './renderer.js';
import { worldToScreen, zoomToBounds } from './camera.js';
import { clearSideSelection, selectSideRow } from './utils.js';
import { createBounds, mergeBounds } from './geometry.js';

/** Deselects everything and hides the popup. */
export function clearSelection({ rerender = true } = {}) {
    state.selectedItem = null;
    state.selectedPolygon = null;
    state.highlightedItems = null;
    hideFeaturePopup();
    clearSideSelection();
    if (rerender) render();
}

/** Selects a room or area entry, optionally zooming to it, and shows its popup at the label point. */
export function selectPolygon(entry, { zoom = true } = {}) {
    state.selectedPolygon = entry;
    state.highlightedItems = null;
    state.selectedItem = state.drawingData?.byHandle.get(entry.handle)?.[0] || null;
    if (zoom) zoomToBounds(entry.bounds);
    render();
    if (state.selectedItem) {
        const [sx, sy] = worldToScreen(entry.labelPoint.x, entry.labelPoint.y);
        showFeaturePopup(state.selectedItem, sx, sy);
    } else {
        hideFeaturePopup();
    }
    selectSideRow(entry.handle);
}

/** Selects a single render item (canvas click or error row) and shows its popup at a screen position. */
export function selectItem(item, screenX, screenY, { zoom = false } = {}) {
    state.selectedItem = item;
    state.selectedPolygon = null;
    state.highlightedItems = null;
    if (zoom) zoomToBounds(item.bounds);
    render();
    if (screenX == null) {
        const [sx, sy] = worldToScreen((item.bounds.minX + item.bounds.maxX) / 2, (item.bounds.minY + item.bounds.maxY) / 2);
        showFeaturePopup(item, sx, sy);
    } else {
        showFeaturePopup(item, screenX, screenY);
    }
    selectSideRow(item.handle);
}

/** Highlights the render items of an aggregate issue and zooms to fit them. */
export function highlightItems(items) {
    if (items.length === 0) return;
    state.highlightedItems = items;
    state.selectedItem = items[0];
    state.selectedPolygon = null;
    hideFeaturePopup();
    const bounds = createBounds();
    for (const item of items) mergeBounds(bounds, item.bounds);
    zoomToBounds(bounds);
    render();
}
