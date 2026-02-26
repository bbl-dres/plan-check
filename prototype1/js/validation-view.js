/**
 * ValidationView — Tab/panel orchestration for the validation results view.
 * Coordinates between the side panel content and FloorPlanViewer canvas.
 * Depends on: FloorPlanViewer (viewer.js), renderStatusIcon & mock data (script.js).
 */
/* eslint-disable no-var */
/* global FloorPlanViewer, mockGeometry, mockCheckingResults, renderStatusIcon, lucide */
var ValidationView = (function () {
    'use strict';

    let currentTab = 'overview';
    let docRooms = [];
    let docAreas = [];
    let docErrors = [];
    let selectedSiaCategory = null;
    let initialized = false;
    let abortController = null;

    // Mock layer data for the Overview tab
    var MOCK_LAYERS = [
        { name: 'A1Z21---E-', color: '#FF0000', count: 0, description: 'Raumpolygone' },
        { name: 'A-WALL', color: '#FFFFFF', count: 42, description: 'Wände' },
        { name: 'A-DOOR', color: '#00FF00', count: 12, description: 'Türen' },
        { name: 'A-WINDOW', color: '#00FFFF', count: 8, description: 'Fenster' },
        { name: 'A-DIM', color: '#FFFF00', count: 35, description: 'Bemaßung' },
        { name: 'A-TEXT', color: '#CCCCCC', count: 22, description: 'Text' },
        { name: 'A-HATCH', color: '#808080', count: 18, description: 'Schraffur' },
        { name: 'A-STAIR', color: '#FF00FF', count: 3, description: 'Treppen' },
        { name: 'A-FURNITURE', color: '#FFB74D', count: 28, description: 'Möbel' },
    ];

    var SIA_COLORS = {
        HNF: '#E57373',
        NNF: '#FFB74D',
        VF:  '#FFF176',
        FF:  '#64B5F6',
        KF:  '#CCCCCC',
    };

    var SIA_LABELS = {
        HNF: 'Hauptnutzfläche',
        NNF: 'Nebennutzfläche',
        VF:  'Verkehrsfläche',
        FF:  'Funktionsfläche',
        KF:  'Konstruktionsfläche',
    };

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // --- Initialization ---

    function init(documentId) {
        // Cleanup previous instance
        if (abortController) abortController.abort();
        abortController = new AbortController();

        docRooms = (typeof mockGeometry !== 'undefined' ? mockGeometry : [])
            .filter(function (g) { return g.type === 'room' && g.documentId === documentId; });
        docAreas = (typeof mockGeometry !== 'undefined' ? mockGeometry : [])
            .filter(function (g) { return g.type === 'area' && g.documentId === documentId; });
        docErrors = (typeof mockCheckingResults !== 'undefined' ? mockCheckingResults : [])
            .filter(function (r) { return r.documentId === documentId; });

        // Update room layer count
        MOCK_LAYERS[0].count = docRooms.length;

        // Init canvas viewer
        var canvasWrap = document.getElementById('validation-canvas-wrap');
        if (canvasWrap) {
            FloorPlanViewer.init(canvasWrap);
            FloorPlanViewer.setRooms(docRooms);
            FloorPlanViewer.setAreas(docAreas);
            FloorPlanViewer.setErrors(docErrors);
            FloorPlanViewer.onRoomClick(handleRoomClick);
        }

        // Update KPI cards
        updateMetrics();

        // Update tab counts
        updateTabCounts();

        // Wire up tab switching
        setupTabCallbacks();

        // Wire up room search
        setupRoomSearch();

        // Render initial tab and fit viewer
        switchTab('overview');
        requestAnimationFrame(function () {
            FloorPlanViewer.zoomExtents();
        });

        initialized = true;
    }

    function updateMetrics() {
        var roomCountEl = document.getElementById('step1-room-count');
        var ngfEl = document.getElementById('step1-ngf');
        var gfEl = document.getElementById('step1-gf');
        var scoreEl = document.getElementById('step1-score-value');
        var scoreCard = document.getElementById('step1-score-card');

        if (roomCountEl) roomCountEl.textContent = docRooms.length;

        // NGF = sum of all room areas
        var ngf = docRooms.reduce(function (sum, r) { return sum + r.area; }, 0);
        if (ngfEl) ngfEl.textContent = ngf.toFixed(2) + ' m\u00B2';

        // GF = Geschossfläche area from docAreas if available
        var bgf = docAreas.find(function (a) { return a.aoid && a.aoid.indexOf('GF') !== -1; });
        if (gfEl) gfEl.textContent = (bgf ? bgf.area : 0) + ' m\u00B2';

        // Score based on room statuses
        var okCount = docRooms.filter(function (r) { return r.status === 'ok'; }).length;
        var score = docRooms.length > 0 ? Math.round((okCount / docRooms.length) * 100) : 0;
        if (scoreEl) scoreEl.textContent = score + '%';
        if (scoreCard) {
            scoreCard.classList.remove('metric-card--success', 'metric-card--warning', 'metric-card--error');
            if (score >= 90) scoreCard.classList.add('metric-card--success');
            else if (score >= 60) scoreCard.classList.add('metric-card--warning');
            else scoreCard.classList.add('metric-card--error');
        }
    }

    function updateTabCounts() {
        var roomsCount = document.getElementById('val-tab-rooms-count');
        var errorsCount = document.getElementById('val-tab-errors-count');
        var areasCount = document.getElementById('val-tab-areas-count');
        if (roomsCount) roomsCount.textContent = docRooms.length;
        if (errorsCount) errorsCount.textContent = docErrors.length;
        if (areasCount) areasCount.textContent = docAreas.length;
    }

    function setupTabCallbacks() {
        var signal = abortController ? abortController.signal : undefined;
        var opts = signal ? { signal: signal } : {};
        var tabs = document.querySelectorAll('[data-val-tab]');
        tabs.forEach(function (tab) {
            tab.addEventListener('click', function (e) {
                e.preventDefault();
                var tabName = tab.getAttribute('data-val-tab');
                switchTab(tabName);
            }, opts);
        });
    }

    function setupRoomSearch() {
        var signal = abortController ? abortController.signal : undefined;
        var opts = signal ? { signal: signal } : {};
        var searchInput = document.getElementById('room-search');
        if (!searchInput) return;
        searchInput.addEventListener('input', function () {
            var query = searchInput.value.toLowerCase().trim();
            var items = document.querySelectorAll('.room-list__item');
            items.forEach(function (item) {
                var aoid = (item.getAttribute('data-aoid') || '').toLowerCase();
                var func = (item.getAttribute('data-func') || '').toLowerCase();
                item.style.display = (!query || aoid.indexOf(query) !== -1 || func.indexOf(query) !== -1) ? '' : 'none';
            });
        }, opts);
    }

    // --- Tab switching ---

    function switchTab(tabName) {
        currentTab = tabName;
        selectedSiaCategory = null;

        // Render panel content
        switch (tabName) {
            case 'overview': renderOverviewPanel(); break;
            case 'rooms': renderRoomsPanel(); break;
            case 'areas': renderAreasPanel(); break;
            case 'kennzahlen': renderKennzahlenPanel(); break;
            case 'errors': renderErrorsPanel(); break;
        }

        // Update viewer mode
        FloorPlanViewer.setMode(tabName);

        // Set up mode-specific highlights
        if (tabName === 'errors') {
            applyErrorHighlights();
        }

        // Re-initialize Lucide icons in the panel
        if (typeof lucide !== 'undefined') {
            requestAnimationFrame(function () {
                lucide.createIcons();
            });
        }
    }

    // --- Panel renderers ---

    function renderOverviewPanel() {
        var layerList = document.getElementById('layer-list');

        if (layerList) {
            var html = '';
            for (var i = 0; i < MOCK_LAYERS.length; i++) {
                var l = MOCK_LAYERS[i];
                html += '<label class="layer-list__item">' +
                    '<input type="checkbox" checked> ' +
                    '<span class="layer-list__color" style="background:' + l.color + '"></span>' +
                    '<span class="layer-list__name">' + escapeHtml(l.name) + '</span>' +
                    '<span class="layer-list__count">' + l.count + '</span>' +
                    '</label>';
            }
            layerList.innerHTML = html;
        }
    }

    function renderRoomsPanel() {
        var roomListEl = document.getElementById('room-list');
        if (!roomListEl) return;

        // Sort: errors first, then warnings, then ok
        var sorted = docRooms.slice().sort(function (a, b) {
            var order = { error: 0, warning: 1, ok: 2 };
            return (order[a.status] || 2) - (order[b.status] || 2);
        });

        var html = '';
        for (var i = 0; i < sorted.length; i++) {
            var room = sorted[i];

            var itemClass = 'room-list__item';
            if (room.status === 'error') itemClass += ' room-list__item--error';
            else if (room.status === 'warning') itemClass += ' room-list__item--warning';

            html += '<div class="' + itemClass + '" data-room-id="' + room.id + '" ' +
                'data-aoid="' + escapeHtml(room.aoid) + '" data-func="' + escapeHtml(room.aofunction) + '">' +
                '<span class="room-list__aoid">' + escapeHtml(room.aoid) + '</span>' +
                '<span class="room-list__area">' + room.area + ' m\u00B2</span>' +
                '<span class="room-list__func">' + escapeHtml(room.aofunction) + '</span>' +
                '<span class="room-list__status">' + renderStatusIcon(room.status) + '</span>' +
                '</div>';
        }

        roomListEl.innerHTML = html;

        // Click handlers
        var items = roomListEl.querySelectorAll('.room-list__item');
        items.forEach(function (item) {
            item.addEventListener('click', function () {
                var roomId = parseInt(item.getAttribute('data-room-id'), 10);
                selectRoomInList(roomId);
                FloorPlanViewer.selectRoom(roomId);
                FloorPlanViewer.zoomToRoom(roomId);
            });
        });

        // Re-init lucide icons for status pills
        if (typeof lucide !== 'undefined') {
            requestAnimationFrame(function () { lucide.createIcons(); });
        }
    }

    function renderAreasPanel() {
        var areaListEl = document.getElementById('area-list');
        if (!areaListEl) return;

        var html = '';

        // Show GF/EBF area entries from docAreas
        if (docAreas.length === 0) {
            html = '<div class="area-list__empty">Keine Flächenpolygone vorhanden.</div>';
        } else {
            for (var i = 0; i < docAreas.length; i++) {
                var area = docAreas[i];
                var statusClass = area.status === 'error' ? ' area-list__item--error' :
                    area.status === 'warning' ? ' area-list__item--warning' : '';
                html += '<div class="area-list__item' + statusClass + '" data-area-id="' + area.id + '">' +
                    '<div class="area-list__header">' +
                    '<span class="area-list__aoid">' + escapeHtml(area.aoid) + '</span>' +
                    '<span class="area-list__value">' + area.area.toFixed(1) + ' m\u00B2</span>' +
                    '</div>' +
                    '<div class="area-list__detail">' + escapeHtml(area.aofunction || 'Flächenpolygon') + '</div>' +
                    '</div>';
            }
        }

        areaListEl.innerHTML = html;

        // Click handlers to highlight area in viewer
        var items = areaListEl.querySelectorAll('.area-list__item');
        items.forEach(function (item) {
            item.addEventListener('click', function () {
                var areaId = parseInt(item.getAttribute('data-area-id'), 10);
                // Remove previous selection
                items.forEach(function (el) { el.classList.remove('area-list__item--selected'); });
                item.classList.add('area-list__item--selected');
                FloorPlanViewer.selectRoom(areaId);
                FloorPlanViewer.zoomToRoom(areaId);
            });
        });
    }

    function renderKennzahlenPanel() {
        var contentEl = document.getElementById('kennzahlen-content');
        if (!contentEl) return;

        // Compute SIA 416 breakdown from room categories
        var totals = { HNF: 0, NNF: 0, VF: 0, FF: 0 };
        for (var i = 0; i < docRooms.length; i++) {
            var cat = docRooms[i].siaCategory || 'HNF';
            if (totals[cat] !== undefined) {
                totals[cat] += docRooms[i].area;
            }
        }
        var ngf = totals.HNF + totals.NNF + totals.VF + totals.FF;
        var bgfEntry = docAreas.find(function (a) { return a.aoid && a.aoid.indexOf('GF') !== -1; });
        var gf = bgfEntry ? bgfEntry.area : ngf * 1.3;
        var kf = gf - ngf;
        var nf = totals.HNF + totals.NNF;

        // Compute GV (mock: GF * 3.2m floor height)
        var gv = gf * 3.2;
        var gvOg = gv * 0.75;
        var gvUg = gv * 0.25;

        // Wirtschaftlichkeit ratios
        var hnfGf = gf > 0 ? (totals.HNF / gf).toFixed(2) : '0.00';
        var vmfGf = gf > 0 ? ((totals.HNF + totals.NNF) / gf).toFixed(2) : '0.00';

        var html = '<div class="results__layout">';

        // Left Column: Tables
        html += '<div class="results__tables">';

        // Gebäudevolumen
        html += '<div class="results__section">' +
            '<h3 class="results__section-title">Gebäudevolumen</h3>' +
            '<table class="table table--compact table--no-borders"><tbody>' +
            kennzahlenRow('GV', 'Gebäudevolumen', gv, gv, gf) +
            kennzahlenRow('GV OG', 'Gebäudevolumen Obergeschosse', gvOg, gv, gf) +
            kennzahlenRow('GV UG', 'Gebäudevolumen Untergeschosse', gvUg, gv, gf) +
            '</tbody></table></div>';

        // Gebäudeflächen
        html += '<div class="results__section">' +
            '<h3 class="results__section-title">Gebäudeflächen</h3>' +
            '<table class="table table--compact table--no-borders"><tbody>' +
            kennzahlenRow('GF', 'Geschossfläche', gf, gf, gf) +
            kennzahlenRow('KF', 'Konstruktionsfläche', kf, gf, gf) +
            kennzahlenRow('NGF', 'Nettogeschossfläche', ngf, gf, gf) +
            kennzahlenRow('NF', 'Nutzfläche', nf, gf, gf) +
            kennzahlenRow('HNF', SIA_LABELS.HNF, totals.HNF, gf, gf) +
            kennzahlenRow('NNF', SIA_LABELS.NNF, totals.NNF, gf, gf) +
            kennzahlenRow('VF', SIA_LABELS.VF, totals.VF, gf, gf) +
            kennzahlenRow('FF', SIA_LABELS.FF, totals.FF, gf, gf) +
            '</tbody></table></div>';

        // Flächen DIN 277 (mock data, simplified)
        html += '<div class="results__section">' +
            '<h3 class="results__section-title">Flächen DIN 277</h3>' +
            '<table class="table table--compact table--no-borders"><tbody>' +
            kennzahlenRow('HNF 1', 'Wohnen und Aufenthalt', totals.HNF * 0.1, gf, gf) +
            kennzahlenRow('HNF 2', 'Büroarbeit', totals.HNF * 0.6, gf, gf) +
            kennzahlenRow('HNF 3', 'Produktion', 0, gf, gf) +
            kennzahlenRow('HNF 4', 'Lagern, Verteilen', totals.HNF * 0.1, gf, gf) +
            kennzahlenRow('HNF 5', 'Bildung, Unterricht, Kultur', totals.HNF * 0.15, gf, gf) +
            kennzahlenRow('HNF 6', 'Heilen, Pflegen', totals.HNF * 0.05, gf, gf) +
            kennzahlenRow('NNF 7', 'Nebennutzfläche', totals.NNF, gf, gf) +
            kennzahlenRow('FF 8', 'Betriebstechnische Anlagen', totals.FF, gf, gf) +
            kennzahlenRow('VF 9', 'Verkehrserschliessung', totals.VF, gf, gf) +
            '</tbody></table></div>';

        html += '</div>'; // end tables

        // Right Column: Wirtschaftlichkeit + Donut
        html += '<div class="results__sidebar">';

        // Wirtschaftlichkeit
        html += '<div class="results__section">' +
            '<h3 class="results__section-title">Kennzahlen Wirtschaftlichkeit</h3>' +
            '<table class="table table--compact table--no-borders"><tbody>' +
            '<tr><td class="table__abbr">HNF / GF</td><td>Hauptnutzfläche / Geschossfläche</td><td class="text-right">' + hnfGf + '</td></tr>' +
            '<tr><td class="table__abbr">VMF / GF</td><td>Vermietbare Fläche / Geschossfläche</td><td class="text-right">' + vmfGf + '</td></tr>' +
            '</tbody></table></div>';

        // Donut chart
        html += '<div class="results__donut">';
        html += buildDonutChart(totals, kf, gf);
        html += '</div>';

        html += '</div>'; // end sidebar
        html += '</div>'; // end results__layout

        contentEl.innerHTML = html;
    }

    function kennzahlenRow(abbr, label, value, total, gf) {
        var fmtValue = value >= 1000 ?
            Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'") :
            value.toFixed(1);
        var unit = abbr.indexOf('GV') === 0 ? 'm\u00B3' : 'm\u00B2';
        var pct = total > 0 ? ((value / total) * 100).toFixed(0) : '0';
        return '<tr>' +
            '<td class="table__abbr">' + escapeHtml(abbr) + '</td>' +
            '<td>' + escapeHtml(label) + '</td>' +
            '<td class="text-right table__value">' + fmtValue + ' ' + unit + '</td>' +
            '<td class="text-right table__percent">' + pct + '%</td>' +
            '</tr>';
    }

    function buildDonutChart(totals, kf, gf) {
        var segments = [
            { label: 'HNF', value: totals.HNF, color: SIA_COLORS.HNF },
            { label: 'NNF', value: totals.NNF, color: SIA_COLORS.NNF },
            { label: 'VF',  value: totals.VF,  color: SIA_COLORS.VF  },
            { label: 'FF',  value: totals.FF,  color: SIA_COLORS.FF  },
            { label: 'KF',  value: kf,         color: SIA_COLORS.KF  },
        ];

        var total = gf || 1;
        var r = 70, sw = 30;
        var circumference = 2 * Math.PI * r;
        var offset = 0;

        var svg = '<svg viewBox="0 0 200 200" class="donut-multi">';
        svg += '<circle cx="100" cy="100" r="' + r + '" fill="none" stroke="#E5E5E5" stroke-width="' + sw + '"/>';

        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            var pct = seg.value / total;
            var dash = pct * circumference;
            var gap = circumference - dash;
            svg += '<circle cx="100" cy="100" r="' + r + '" fill="none" ' +
                'stroke="' + seg.color + '" stroke-width="' + sw + '" ' +
                'stroke-dasharray="' + dash.toFixed(2) + ' ' + gap.toFixed(2) + '" ' +
                'stroke-dashoffset="' + (-offset + circumference * 0.25).toFixed(2) + '" ' +
                'class="donut-segment">' +
                '<title>' + seg.label + ': ' + seg.value.toFixed(1) + ' m\u00B2 (' + (pct * 100).toFixed(1) + '%)</title>' +
                '</circle>';
            offset += dash;
        }

        svg += '</svg>';

        // Legend
        svg += '<div class="donut-legend">';
        for (var j = 0; j < segments.length; j++) {
            var s = segments[j];
            svg += '<div class="donut-legend__item">' +
                '<span class="donut-legend__color" style="background:' + s.color + '"></span>' +
                '<span class="donut-legend__label">' + s.label + '</span>' +
                '<span class="donut-legend__value">' + (s.value / total * 100).toFixed(1) + '%</span>' +
                '</div>';
        }
        svg += '</div>';

        return svg;
    }

    function renderErrorsPanel() {
        var groupsEl = document.getElementById('error-groups');
        if (!groupsEl) return;

        var errorItems = docErrors.filter(function (e) { return e.severity === 'error'; });
        var warningItems = docErrors.filter(function (e) { return e.severity === 'warning'; });

        var html = '';

        if (errorItems.length > 0) {
            html += '<div class="error-group">' +
                '<div class="error-group__header error-group__header--error" data-toggle-group>' +
                '<i data-lucide="chevron-down" class="icon icon-sm error-group__chevron"></i>' +
                '<i data-lucide="x-circle" class="icon icon-sm"></i>' +
                'Fehler <span class="error-group__count">(' + errorItems.length + ')</span>' +
                '</div>' +
                '<div class="error-group__body">';
            for (var i = 0; i < errorItems.length; i++) {
                html += renderErrorGroupItem(errorItems[i]);
            }
            html += '</div></div>';
        }

        if (warningItems.length > 0) {
            html += '<div class="error-group">' +
                '<div class="error-group__header error-group__header--warning" data-toggle-group>' +
                '<i data-lucide="chevron-down" class="icon icon-sm error-group__chevron"></i>' +
                '<i data-lucide="alert-triangle" class="icon icon-sm"></i>' +
                'Warnungen <span class="error-group__count">(' + warningItems.length + ')</span>' +
                '</div>' +
                '<div class="error-group__body">';
            for (var j = 0; j < warningItems.length; j++) {
                html += renderErrorGroupItem(warningItems[j]);
            }
            html += '</div></div>';
        }

        if (docErrors.length === 0) {
            html = '<div class="error-item" style="border-left-color:var(--color-success);background:var(--color-success-light)">' +
                '<div class="error-item__message">Keine Fehler oder Warnungen gefunden.</div></div>';
        }

        groupsEl.innerHTML = html;

        // Toggle collapse
        var headers = groupsEl.querySelectorAll('[data-toggle-group]');
        headers.forEach(function (header) {
            header.addEventListener('click', function () {
                header.parentElement.classList.toggle('error-group--collapsed');
            });
        });

        // Click error items to zoom to affected room
        var items = groupsEl.querySelectorAll('.error-group__item');
        items.forEach(function (item) {
            item.addEventListener('click', function () {
                var roomId = item.getAttribute('data-room-id');
                if (roomId) {
                    var id = parseInt(roomId, 10);
                    FloorPlanViewer.selectRoom(id);
                    FloorPlanViewer.zoomToRoom(id);
                }
            });
        });
    }

    function renderErrorGroupItem(err) {
        var sevClass = err.severity === 'error' ? 'error' : 'warning';

        // Try to find which room this error references
        var roomId = null;
        var roomAoid = '';
        var aoidMatch = err.message.match(/([A-Z0-9]+\.[0-9]+)/i);
        if (aoidMatch) {
            var room = docRooms.find(function (r) { return r.aoid === aoidMatch[1]; });
            if (room) {
                roomId = room.id;
                roomAoid = room.aoid + ' \u00B7 ' + room.aofunction;
            }
        }

        return '<div class="error-group__item error-group__item--' + sevClass + '"' +
            (roomId ? ' data-room-id="' + roomId + '"' : '') + '>' +
            '<div class="error-group__item-header">' +
            '<span class="error-group__item-code">' + escapeHtml(err.ruleCode) + '</span>' +
            (roomAoid ? '<span class="error-group__item-room">' + escapeHtml(roomAoid) + '</span>' : '') +
            '</div>' +
            '<div class="error-group__item-message">' + escapeHtml(err.message) + '</div>' +
            '</div>';
    }

    // --- Helpers ---

    function applyErrorHighlights() {
        var map = {};
        for (var i = 0; i < docErrors.length; i++) {
            var e = docErrors[i];
            var aoidMatch = e.message.match(/([A-Z0-9]+\.[0-9]+)/i);
            if (aoidMatch) {
                var room = docRooms.find(function (r) { return r.aoid === aoidMatch[1]; });
                if (room) {
                    var color = e.severity === 'error' ? '#C62828' : '#F57C00';
                    map[room.id] = { fill: hexToRgba(color, 0.35), stroke: color };
                }
            }
        }
        FloorPlanViewer.highlightRooms(map);
    }

    function hexToRgba(hex, alpha) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function handleRoomClick(roomId) {
        if (currentTab === 'rooms' && roomId) {
            selectRoomInList(roomId);
        }
    }

    function selectRoomInList(roomId) {
        // Remove previous selection
        var items = document.querySelectorAll('.room-list__item');
        items.forEach(function (item) {
            item.classList.remove('room-list__item--selected');
        });

        // Add selection
        if (roomId) {
            var target = document.querySelector('.room-list__item[data-room-id="' + roomId + '"]');
            if (target) {
                target.classList.add('room-list__item--selected');
                target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    // --- Public API ---

    return {
        init: init,
        switchTab: switchTab,
        isInitialized: function () { return initialized; },
        destroy: function () {
            if (abortController) abortController.abort();
            abortController = null;
            FloorPlanViewer.destroy();
            initialized = false;
            docRooms = [];
            docAreas = [];
            docErrors = [];
        }
    };
})();
