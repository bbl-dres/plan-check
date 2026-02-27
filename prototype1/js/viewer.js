/**
 * FloorPlanViewer — Canvas 2D rendering engine for room polygons.
 * Adapted from the DWG viewer in /index.html.
 * Exposes window.FloorPlanViewer as an IIFE module.
 */
/* eslint-disable no-var */
/* global lucide */
var FloorPlanViewer = (function () {
    'use strict';

    // --- Private state ---
    let canvas, ctx, canvasWrap, popupEl, coordsEl;
    let cam = { x: 0, y: 0, zoom: 1 };
    let rooms = [];
    let areas = [];
    let errors = [];
    let bounds = { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
    let selectedRoomId = null;
    let hoveredRoomId = null;
    let mode = 'overview'; // 'overview' | 'rooms' | 'areas' | 'kennzahlen' | 'errors'
    let highlightMap = {}; // roomId -> { fill, stroke }
    let onClickCallback = null;
    let abortController = null;
    let resizeObserver = null;
    let isPanning = false;
    let panStart = null;

    // --- Color palettes ---
    const STATUS_COLORS = {
        ok:      { fill: 'rgba(46,125,50,0.25)',  stroke: '#2E7D32' },
        warning: { fill: 'rgba(245,124,0,0.25)',  stroke: '#F57C00' },
        error:   { fill: 'rgba(198,40,40,0.25)',  stroke: '#C62828' },
    };
    const SELECTED_COLOR = { fill: 'rgba(0,102,153,0.35)', stroke: '#006699' };
    const HOVERED_COLOR  = { fill: 'rgba(0,102,153,0.15)', stroke: '#006699' };
    const DEFAULT_COLOR  = { fill: 'rgba(180,180,180,0.20)', stroke: '#999999' };
    const DIMMED_COLOR   = { fill: 'rgba(200,200,200,0.10)', stroke: '#CCCCCC' };

    const SIA_COLORS = {
        HNF: { fill: 'rgba(229,115,115,0.35)', stroke: '#E57373' },
        NNF: { fill: 'rgba(255,183,77,0.35)',  stroke: '#FFB74D' },
        VF:  { fill: 'rgba(255,241,118,0.35)', stroke: '#FFF176' },
        FF:  { fill: 'rgba(100,181,246,0.35)', stroke: '#64B5F6' },
        KF:  { fill: 'rgba(204,204,204,0.35)', stroke: '#CCCCCC' },
    };

    const BG_COLOR = '#F5F5F5';

    // --- Canvas helpers (from root index.html) ---

    function resizeCanvas() {
        if (!canvasWrap || !canvas) return;
        const rect = canvasWrap.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function worldToScreen(wx, wy) {
        const rect = canvasWrap.getBoundingClientRect();
        const sx = (wx - cam.x) * cam.zoom + rect.width / 2;
        const sy = -(wy - cam.y) * cam.zoom + rect.height / 2;
        return [sx, sy];
    }

    function screenToWorld(sx, sy) {
        const rect = canvasWrap.getBoundingClientRect();
        const wx = (sx - rect.width / 2) / cam.zoom + cam.x;
        const wy = -(sy - rect.height / 2) / cam.zoom + cam.y;
        return [wx, wy];
    }

    // --- Bounds ---

    function computeBounds() {
        var allPolygons = rooms.concat(areas);
        if (allPolygons.length === 0) {
            bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 };
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const poly of allPolygons) {
            if (!poly.vertices) continue;
            for (const v of poly.vertices) {
                if (v[0] < minX) minX = v[0];
                if (v[1] < minY) minY = v[1];
                if (v[0] > maxX) maxX = v[0];
                if (v[1] > maxY) maxY = v[1];
            }
        }
        bounds = {
            minX, minY, maxX, maxY,
            width: maxX - minX || 1,
            height: maxY - minY || 1,
        };
    }

    function zoomExtents() {
        if (!canvasWrap) return;
        const rect = canvasWrap.getBoundingClientRect();
        cam.x = bounds.minX + bounds.width / 2;
        cam.y = bounds.minY + bounds.height / 2;
        const zx = rect.width / bounds.width;
        const zy = rect.height / bounds.height;
        cam.zoom = Math.min(zx, zy) * 0.88;
        render();
    }

    function zoomToRoom(roomId) {
        var room = rooms.find(function (r) { return r.id === roomId; })
            || areas.find(function (a) { return a.id === roomId; });
        if (!room || !room.vertices) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const v of room.vertices) {
            if (v[0] < minX) minX = v[0];
            if (v[1] < minY) minY = v[1];
            if (v[0] > maxX) maxX = v[0];
            if (v[1] > maxY) maxY = v[1];
        }
        const rect = canvasWrap.getBoundingClientRect();
        cam.x = (minX + maxX) / 2;
        cam.y = (minY + maxY) / 2;
        const w = maxX - minX || 1;
        const h = maxY - minY || 1;
        const zx = rect.width / w;
        const zy = rect.height / h;
        cam.zoom = Math.min(zx, zy) * 0.5;
        render();
    }

    // --- Hit testing ---

    function pointInPolygon(px, py, verts) {
        let inside = false;
        for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
            const xi = verts[i][0], yi = verts[i][1];
            const xj = verts[j][0], yj = verts[j][1];
            if (((yi > py) !== (yj > py)) &&
                (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    function hitTestRoom(wx, wy) {
        // In areas mode, test area polygons instead of rooms
        if (mode === 'areas') {
            for (let i = areas.length - 1; i >= 0; i--) {
                const area = areas[i];
                if (!area.vertices || area.vertices.length < 3) continue;
                if (pointInPolygon(wx, wy, area.vertices)) return area;
            }
            return null;
        }
        // Test in reverse order so topmost drawn room wins
        for (let i = rooms.length - 1; i >= 0; i--) {
            const room = rooms[i];
            if (!room.vertices || room.vertices.length < 3) continue;
            if (pointInPolygon(wx, wy, room.vertices)) return room;
        }
        return null;
    }

    // --- Room color logic ---

    function getRoomColor(room) {
        if (room.id === selectedRoomId) return SELECTED_COLOR;
        if (room.id === hoveredRoomId) return HOVERED_COLOR;

        // Custom highlights (from errors tab or area tab)
        if (highlightMap[room.id]) return highlightMap[room.id];

        switch (mode) {
            case 'rooms':
                return STATUS_COLORS[room.status] || DEFAULT_COLOR;
            case 'areas':
                // Areas mode: rooms are dimmed, area polygons drawn separately
                return DIMMED_COLOR;
            case 'kennzahlen':
                // Kennzahlen mode: rooms colored by SIA category
                return SIA_COLORS[room.siaCategory] || DEFAULT_COLOR;
            default: // overview, errors, rules
                return DEFAULT_COLOR;
        }
    }

    // --- Render ---

    function render() {
        if (!canvas || !ctx || !canvasWrap) return;
        const rect = canvasWrap.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        if (w === 0 || h === 0) return;

        // Clear
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, w, h);

        // World transform
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(cam.zoom, -cam.zoom);
        ctx.translate(-cam.x, -cam.y);

        var strokeWidth = 1.5 / cam.zoom;

        // Draw area polygons (behind rooms); skip only in 'rooms' mode
        if (mode !== 'rooms') {
            for (const area of areas) {
                if (!area.vertices || area.vertices.length < 3) continue;
                var aColors = (area.id === selectedRoomId)
                    ? SELECTED_COLOR
                    : (area.id === hoveredRoomId)
                    ? HOVERED_COLOR
                    : (mode === 'areas')
                    ? (STATUS_COLORS[area.status] || DEFAULT_COLOR)
                    : DEFAULT_COLOR;
                ctx.beginPath();
                ctx.moveTo(area.vertices[0][0], area.vertices[0][1]);
                for (let i = 1; i < area.vertices.length; i++) {
                    ctx.lineTo(area.vertices[i][0], area.vertices[i][1]);
                }
                ctx.closePath();
                ctx.fillStyle = aColors.fill;
                ctx.fill();
                ctx.strokeStyle = aColors.stroke;
                ctx.lineWidth = 2 / cam.zoom;
                ctx.stroke();

                // Area label
                var acx = 0, acy = 0;
                for (const v of area.vertices) { acx += v[0]; acy += v[1]; }
                acx /= area.vertices.length;
                acy /= area.vertices.length;
                var afontSize = 14 / cam.zoom;
                if (afontSize * cam.zoom >= 6 && afontSize * cam.zoom <= 30) {
                    ctx.save();
                    ctx.translate(acx, acy);
                    ctx.scale(1, -1);
                    ctx.font = 'bold ' + afontSize + 'px system-ui, -apple-system, sans-serif';
                    ctx.fillStyle = aColors.stroke;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(area.aoid || 'GF', 0, 0);
                    ctx.font = (afontSize * 0.7) + 'px system-ui, -apple-system, sans-serif';
                    ctx.fillStyle = '#555555';
                    ctx.fillText(area.area.toFixed(1) + ' m\u00B2', 0, afontSize * 1.1);
                    ctx.restore();
                }
            }
        }

        // Draw rooms (skip in areas mode — only show GF polygons)
        if (mode !== 'areas') {
            for (const room of rooms) {
                if (!room.vertices || room.vertices.length < 3) continue;
                const colors = getRoomColor(room);

                ctx.beginPath();
                ctx.moveTo(room.vertices[0][0], room.vertices[0][1]);
                for (let i = 1; i < room.vertices.length; i++) {
                    ctx.lineTo(room.vertices[i][0], room.vertices[i][1]);
                }
                ctx.closePath();

                ctx.fillStyle = colors.fill;
                ctx.fill();
                ctx.strokeStyle = colors.stroke;
                ctx.lineWidth = (room.id === selectedRoomId || room.id === hoveredRoomId) ?
                    2.5 / cam.zoom : strokeWidth;
                ctx.stroke();

                // Draw AOID label inside room
                drawRoomLabel(room);
            }
        }

        ctx.restore();
    }

    function drawRoomLabel(room) {
        if (!room.vertices || room.vertices.length < 3) return;
        // Compute centroid
        let cx = 0, cy = 0;
        for (const v of room.vertices) {
            cx += v[0];
            cy += v[1];
        }
        cx /= room.vertices.length;
        cy /= room.vertices.length;

        // Font size relative to zoom (target ~11px on screen)
        var fontSize = 11 / cam.zoom;
        // Don't draw if too small or too big
        if (fontSize * cam.zoom < 6 || fontSize * cam.zoom > 30) return;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, -1); // Flip text right-side up
        ctx.font = (fontSize * 0.85) + 'px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(room.aoid, 0, 0);

        // Smaller area text below
        ctx.font = (fontSize * 0.65) + 'px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#757575';
        ctx.fillText(Math.round(room.area) + ' m\u00B2', 0, fontSize * 0.9);
        ctx.restore();
    }

    // --- Popup ---

    function showPopup(room, screenX, screenY) {
        if (!popupEl) return;
        var roomErrors = errors.filter(function (e) {
            return e.message && e.message.indexOf(room.aoid) !== -1;
        });

        var html = '<div class="canvas-viewer__popup-header">' +
            '<strong>' + escapeHtml(room.aoid) + '</strong>' +
            '<button class="canvas-viewer__popup-close" aria-label="Schliessen">&times;</button>' +
            '</div>' +
            '<div class="canvas-viewer__popup-body">' +
            '<span class="canvas-viewer__popup-func">' + escapeHtml(room.aofunction) + '</span>' +
            '<span class="canvas-viewer__popup-area">' + room.area + ' m\u00B2</span>';

        if (room.siaCategory) {
            html += '<span class="canvas-viewer__popup-sia">' + room.siaCategory + '</span>';
        }

        if (roomErrors.length > 0) {
            html += '<div class="canvas-viewer__popup-errors">';
            for (var i = 0; i < roomErrors.length; i++) {
                var e = roomErrors[i];
                var sevClass = e.severity === 'error' ? 'error' : 'warning';
                html += '<div class="canvas-viewer__popup-error canvas-viewer__popup-error--' + sevClass + '">' +
                    '<span class="canvas-viewer__popup-error-code">' + escapeHtml(e.ruleCode) + '</span> ' +
                    '<span>' + escapeHtml(e.message) + '</span></div>';
            }
            html += '</div>';
        }
        html += '</div>';

        popupEl.innerHTML = html;
        popupEl.classList.add('canvas-viewer__popup--visible');

        // Position popup near click, clamped to canvas bounds
        var rect = canvasWrap.getBoundingClientRect();
        var px = Math.min(screenX + 12, rect.width - popupEl.offsetWidth - 8);
        var py = Math.min(screenY - 12, rect.height - popupEl.offsetHeight - 8);
        px = Math.max(8, px);
        py = Math.max(8, py);
        popupEl.style.left = px + 'px';
        popupEl.style.top = py + 'px';

        // Close button
        var closeBtn = popupEl.querySelector('.canvas-viewer__popup-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', hidePopup);
        }
    }

    function hidePopup() {
        if (popupEl) {
            popupEl.classList.remove('canvas-viewer__popup--visible');
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // --- Events ---

    function setupEvents() {
        if (abortController) abortController.abort();
        abortController = new AbortController();
        var signal = abortController.signal;

        // Wheel zoom
        canvasWrap.addEventListener('wheel', function (e) {
            e.preventDefault();
            hidePopup();
            var rect = canvasWrap.getBoundingClientRect();
            var mx = e.clientX - rect.left;
            var my = e.clientY - rect.top;
            var wCoords = screenToWorld(mx, my);
            var factor = e.deltaY > 0 ? 0.85 : 1.18;
            cam.zoom *= factor;
            cam.x = wCoords[0] - (mx - rect.width / 2) / cam.zoom;
            cam.y = wCoords[1] + (my - rect.height / 2) / cam.zoom;
            render();
        }, { signal: signal, passive: false });

        // Mouse pan & click
        canvasWrap.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            isPanning = true;
            var rect = canvasWrap.getBoundingClientRect();
            panStart = {
                mx: e.clientX - rect.left,
                my: e.clientY - rect.top,
                cx: cam.x,
                cy: cam.y
            };
            canvasWrap.style.cursor = 'grabbing';
        }, { signal: signal });

        window.addEventListener('mousemove', function (e) {
            var rect = canvasWrap.getBoundingClientRect();
            var mx = e.clientX - rect.left;
            var my = e.clientY - rect.top;

            if (isPanning && panStart) {
                var dx = mx - panStart.mx;
                var dy = my - panStart.my;
                cam.x = panStart.cx - dx / cam.zoom;
                cam.y = panStart.cy + dy / cam.zoom;
                render();
            } else {
                // Hover detection
                if (mx >= 0 && my >= 0 && mx <= rect.width && my <= rect.height) {
                    var wc = screenToWorld(mx, my);
                    var hit = hitTestRoom(wc[0], wc[1]);
                    var newHoverId = hit ? hit.id : null;
                    if (newHoverId !== hoveredRoomId) {
                        hoveredRoomId = newHoverId;
                        canvasWrap.style.cursor = hoveredRoomId ? 'pointer' : 'grab';
                        render();
                    }
                    // Update coords display
                    if (coordsEl) {
                        coordsEl.textContent = wc[0].toFixed(2) + ', ' + wc[1].toFixed(2);
                    }
                }
            }
        }, { signal: signal });

        window.addEventListener('mouseup', function (e) {
            if (!isPanning) return;
            var rect = canvasWrap.getBoundingClientRect();
            var mx = e.clientX - rect.left;
            var my = e.clientY - rect.top;
            var moved = panStart ? Math.hypot(mx - panStart.mx, my - panStart.my) : 0;

            isPanning = false;
            panStart = null;
            canvasWrap.style.cursor = hoveredRoomId ? 'pointer' : 'grab';

            // Click detection (moved < 4px)
            if (moved < 4) {
                var wc = screenToWorld(mx, my);
                var hit = hitTestRoom(wc[0], wc[1]);
                if (hit) {
                    selectedRoomId = hit.id;
                    showPopup(hit, mx, my);
                    render();
                    if (onClickCallback) onClickCallback(hit.id);
                } else {
                    selectedRoomId = null;
                    hidePopup();
                    render();
                    if (onClickCallback) onClickCallback(null);
                }
            }
        }, { signal: signal });

        // Keyboard: Escape to deselect
        window.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                selectedRoomId = null;
                hoveredRoomId = null;
                hidePopup();
                render();
            }
        }, { signal: signal });
    }

    function setupControls() {
        var zoomInBtn = document.getElementById('viewer-zoom-in');
        var zoomOutBtn = document.getElementById('viewer-zoom-out');
        var zoomFitBtn = document.getElementById('viewer-zoom-fit');
        if (zoomInBtn) zoomInBtn.addEventListener('click', function () { cam.zoom *= 1.4; render(); });
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', function () { cam.zoom /= 1.4; render(); });
        if (zoomFitBtn) zoomFitBtn.addEventListener('click', function () { zoomExtents(); });
    }

    // --- Public API ---

    return {
        init: function (wrapEl) {
            canvasWrap = wrapEl;
            canvas = wrapEl.querySelector('canvas');
            ctx = canvas.getContext('2d');
            popupEl = wrapEl.querySelector('.canvas-viewer__popup');
            coordsEl = wrapEl.querySelector('.canvas-viewer__coords');

            resizeCanvas();
            setupEvents();
            setupControls();

            // Resize observer for responsive canvas
            if (resizeObserver) resizeObserver.disconnect();
            resizeObserver = new ResizeObserver(function () {
                resizeCanvas();
                render();
            });
            resizeObserver.observe(canvasWrap);
        },

        setRooms: function (roomsData) {
            rooms = roomsData.filter(function (r) { return r.vertices && r.vertices.length >= 3; });
            computeBounds();
        },

        setAreas: function (areasData) {
            areas = (areasData || []).filter(function (a) { return a.vertices && a.vertices.length >= 3; });
            computeBounds();
        },

        setErrors: function (errorsData) {
            errors = errorsData || [];
        },

        setMode: function (m) {
            mode = m;
            selectedRoomId = null;
            hoveredRoomId = null;
            highlightMap = {};
            hidePopup();
            render();
        },

        selectRoom: function (id) {
            selectedRoomId = id;
            hidePopup();
            render();
        },

        highlightRooms: function (map) {
            highlightMap = map || {};
            render();
        },

        zoomToRoom: function (roomId) {
            zoomToRoom(roomId);
        },

        zoomExtents: function () {
            zoomExtents();
        },

        onRoomClick: function (cb) {
            onClickCallback = cb;
        },

        getSelectedRoomId: function () {
            return selectedRoomId;
        },

        render: function () {
            render();
        },

        destroy: function () {
            if (abortController) abortController.abort();
            if (resizeObserver) resizeObserver.disconnect();
            abortController = null;
            resizeObserver = null;
            rooms = [];
            areas = [];
            errors = [];
            selectedRoomId = null;
            hoveredRoomId = null;
            highlightMap = {};
        }
    };
})();
