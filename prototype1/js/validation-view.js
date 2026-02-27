/**
 * ValidationView — Tab/panel orchestration for the validation results view.
 * Coordinates between the side panel content and FloorPlanViewer canvas.
 * Depends on: FloorPlanViewer (viewer.js), renderStatusIcon & mock data (script.js).
 */
/* eslint-disable no-var */
/* global FloorPlanViewer, mockGeometry, mockCheckingResults, mockRuleSets, currentProject, renderStatusIcon, lucide */
var ValidationView = (function () {
    'use strict';

    let currentTab = 'overview';
    let docRooms = [];
    let docAreas = [];
    let docErrors = [];
    let selectedSiaCategory = null;
    let initialized = false;
    let abortController = null;
    let statusFilter = new Set(['all']); // 'all' | 'warning' | 'error'

    function matchesStatusFilter(status) {
        if (statusFilter.has('all')) return true;
        return statusFilter.has(status);
    }

    function matchesSeverityFilter(severity) {
        if (statusFilter.has('all')) return true;
        return statusFilter.has(severity);
    }

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

        // Wire up search inputs, toggle-all checkboxes, and status filter
        setupSearchInputs();
        setupToggleAll();
        setupStatusFilter();

        // Render initial tab and fit viewer
        switchTab('rules');
        requestAnimationFrame(function () {
            FloorPlanViewer.zoomExtents();
        });

        initialized = true;
    }

    function updateMetrics() {
        var roomCountEl = document.getElementById('step1-room-count');
        var ngfEl = document.getElementById('step1-ngf');
        var scoreEl = document.getElementById('step1-score-value');
        var scoreCard = document.getElementById('step1-score-card');

        if (roomCountEl) roomCountEl.textContent = docRooms.length;

        // NGF = sum of all room areas
        var ngf = docRooms.reduce(function (sum, r) { return sum + r.area; }, 0);
        if (ngfEl) ngfEl.textContent = ngf.toFixed(2) + ' m\u00B2';

        // Score based on checking rules (passed / total)
        var rules = getProjectRules();
        var totalRules = rules.length;
        var failedCodes = {};
        for (var i = 0; i < docErrors.length; i++) {
            failedCodes[docErrors[i].ruleCode] = true;
        }
        var passedRules = rules.filter(function (r) { return !failedCodes[r.code]; }).length;
        var score = totalRules > 0 ? Math.round((passedRules / totalRules) * 100) : 0;
        if (scoreEl) scoreEl.textContent = score + '%';
        var scoreDetail = document.getElementById('step1-score-detail');
        if (scoreDetail) scoreDetail.textContent = passedRules + '/' + totalRules;
        if (scoreCard) {
            scoreCard.classList.remove('metric-card--success', 'metric-card--warning', 'metric-card--error');
            if (score >= 90) scoreCard.classList.add('metric-card--success');
            else if (score >= 60) scoreCard.classList.add('metric-card--warning');
            else scoreCard.classList.add('metric-card--error');
        }
    }

    function updateTabCounts() {
        var layersCount = document.getElementById('val-tab-layers-count');
        var roomsCount = document.getElementById('val-tab-rooms-count');
        var areasCount = document.getElementById('val-tab-areas-count');
        var errorsCount = document.getElementById('val-tab-errors-count');
        var rulesCount = document.getElementById('val-tab-rules-count');

        // Layers: always total (no status)
        if (layersCount) layersCount.textContent = MOCK_LAYERS.length;

        // Rooms: filtered count
        if (roomsCount) {
            var filteredRooms = docRooms.filter(function (r) { return matchesStatusFilter(r.status); });
            roomsCount.textContent = filteredRooms.length;
        }

        // Areas: filtered count
        if (areasCount) {
            var filteredAreas = docAreas.filter(function (a) { return matchesStatusFilter(a.status); });
            areasCount.textContent = filteredAreas.length;
        }

        // Errors: filtered count
        if (errorsCount) {
            var filteredErrors = docErrors.filter(function (e) { return matchesSeverityFilter(e.severity); });
            errorsCount.textContent = filteredErrors.length;
        }

        // Rules: filtered count
        if (rulesCount) {
            var rules = getProjectRules();
            var failedRules = {};
            for (var e = 0; e < docErrors.length; e++) {
                var code = docErrors[e].ruleCode;
                if (!failedRules[code] || docErrors[e].severity === 'error') {
                    failedRules[code] = docErrors[e].severity;
                }
            }
            var filteredRules = rules.filter(function (r) {
                var severity = failedRules[r.code] || 'ok';
                return matchesStatusFilter(severity);
            });
            rulesCount.textContent = filteredRules.length;
        }
    }

    function getProjectRules() {
        var ruleSetId = (typeof currentProject !== 'undefined' && currentProject) ? currentProject.ruleSetId : 1;
        var ruleSets = (typeof mockRuleSets !== 'undefined') ? mockRuleSets : [];
        var ruleSet = ruleSets.find(function (rs) { return rs.id === ruleSetId; });
        return ruleSet ? ruleSet.rules : [];
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

    function setupSearchInputs() {
        var signal = abortController ? abortController.signal : undefined;
        var opts = signal ? { signal: signal } : {};

        // Layer search
        setupListSearch('layer-search', '#layer-list .panel-list__item', function (item, query) {
            var name = (item.getAttribute('data-name') || '').toLowerCase();
            return name.indexOf(query) !== -1;
        }, opts);

        // Room search
        setupListSearch('room-search', '#room-list .panel-list__item', function (item, query) {
            var aoid = (item.getAttribute('data-aoid') || '').toLowerCase();
            var func = (item.getAttribute('data-func') || '').toLowerCase();
            return aoid.indexOf(query) !== -1 || func.indexOf(query) !== -1;
        }, opts);

        // Area search
        setupListSearch('area-search', '#area-list .panel-list__item', function (item, query) {
            var aoid = (item.getAttribute('data-aoid') || '').toLowerCase();
            var detail = (item.getAttribute('data-detail') || '').toLowerCase();
            return aoid.indexOf(query) !== -1 || detail.indexOf(query) !== -1;
        }, opts);

        // Error search
        setupListSearch('error-search', '.error-list__item', function (item, query) {
            var code = (item.getAttribute('data-code') || '').toLowerCase();
            var msg = (item.getAttribute('data-msg') || '').toLowerCase();
            return code.indexOf(query) !== -1 || msg.indexOf(query) !== -1;
        }, opts);

        // Rule search
        setupListSearch('val-rule-search', '.rule-list__item', function (item, query) {
            var code = (item.getAttribute('data-code') || '').toLowerCase();
            var name = (item.getAttribute('data-name') || '').toLowerCase();
            return code.indexOf(query) !== -1 || name.indexOf(query) !== -1;
        }, opts);
    }

    function setupListSearch(inputId, itemSelector, matchFn, opts) {
        var input = document.getElementById(inputId);
        if (!input) return;
        input.addEventListener('input', function () {
            var query = input.value.toLowerCase().trim();
            var items = document.querySelectorAll(itemSelector);
            items.forEach(function (item) {
                var searchMatch = !query || matchFn(item, query);
                var filterStatus = item.getAttribute('data-status') || item.getAttribute('data-severity');
                var statusMatch = !filterStatus || matchesStatusFilter(filterStatus);
                item.style.display = (searchMatch && statusMatch) ? '' : 'none';
            });
        }, opts);
    }

    function setupToggleAll() {
        var signal = abortController ? abortController.signal : undefined;
        var opts = signal ? { signal: signal } : {};

        var toggles = [
            { id: 'layer-toggle-all', list: '#layer-list' },
            { id: 'room-toggle-all', list: '#room-list' },
            { id: 'area-toggle-all', list: '#area-list' },
        ];

        toggles.forEach(function (cfg) {
            var toggle = document.getElementById(cfg.id);
            if (!toggle) return;
            toggle.addEventListener('change', function () {
                var checked = toggle.checked;
                var checkboxes = document.querySelectorAll(cfg.list + ' .panel-list__item input[type="checkbox"]');
                checkboxes.forEach(function (cb) { cb.checked = checked; });
            }, opts);
        });
    }

    // --- Status filter ---

    function setupStatusFilter() {
        var signal = abortController ? abortController.signal : undefined;
        var opts = signal ? { signal: signal } : {};
        var filterContainer = document.getElementById('status-filter');
        if (!filterContainer) return;

        var buttons = filterContainer.querySelectorAll('.status-filter__btn');
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var filterValue = btn.getAttribute('data-filter');

                if (filterValue === 'all') {
                    statusFilter = new Set(['all']);
                } else {
                    statusFilter.delete('all');
                    if (statusFilter.has(filterValue)) {
                        statusFilter.delete(filterValue);
                    } else {
                        statusFilter.add(filterValue);
                    }
                    if (statusFilter.size === 0) {
                        statusFilter = new Set(['all']);
                    }
                }

                buttons.forEach(function (b) {
                    var val = b.getAttribute('data-filter');
                    b.classList.toggle('status-filter__btn--active', statusFilter.has(val));
                });

                applyStatusFilter();
            }, opts);
        });
    }

    function applyStatusFilter() {
        // Re-render current panel (renderers respect the filter)
        switch (currentTab) {
            case 'overview': renderOverviewPanel(); break;
            case 'rooms': renderRoomsPanel(); break;
            case 'areas': renderAreasPanel(); break;
            case 'errors': renderErrorsPanel(); break;
            case 'rules': renderRulesPanel(); break;
        }

        updateTabCounts();
        applyViewerFilter();

        if (typeof lucide !== 'undefined') {
            requestAnimationFrame(function () { lucide.createIcons(); });
        }
    }

    function applyViewerFilter() {
        if (statusFilter.has('all')) {
            FloorPlanViewer.setStatusFilter(null);
        } else {
            FloorPlanViewer.setStatusFilter(Array.from(statusFilter));
        }
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
            case 'rules': renderRulesPanel(); break;
        }

        // Update viewer mode
        FloorPlanViewer.setMode(tabName);
        applyViewerFilter();

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
        if (!layerList) return;

        var html = '';
        for (var i = 0; i < MOCK_LAYERS.length; i++) {
            var l = MOCK_LAYERS[i];
            html += '<label class="panel-list__item" data-name="' + escapeHtml(l.name) + '">' +
                '<input type="checkbox" checked> ' +
                '<i data-lucide="check-circle-2" class="icon icon-sm panel-list__icon panel-list__icon--ok"></i>' +
                '<span class="panel-list__color" style="background:' + l.color + '"></span>' +
                '<span class="panel-list__name">' + escapeHtml(l.name) + '</span>' +
                '<span class="panel-list__value">' + l.count + ' Objekte</span>' +
                '</label>';
        }
        layerList.innerHTML = html;
    }

    function renderRoomsPanel() {
        var roomListEl = document.getElementById('room-list');
        if (!roomListEl) return;

        var html = '';
        for (var i = 0; i < docRooms.length; i++) {
            var room = docRooms[i];
            var icon = room.status === 'error'
                ? '<i data-lucide="x-circle" class="icon icon-sm panel-list__icon panel-list__icon--error"></i>'
                : room.status === 'warning'
                ? '<i data-lucide="alert-triangle" class="icon icon-sm panel-list__icon panel-list__icon--warning"></i>'
                : '<i data-lucide="check-circle-2" class="icon icon-sm panel-list__icon panel-list__icon--ok"></i>';

            var visible = matchesStatusFilter(room.status);
            html += '<div class="panel-list__item" data-room-id="' + room.id + '" ' +
                'data-aoid="' + escapeHtml(room.aoid) + '" data-func="' + escapeHtml(room.aofunction) + '" ' +
                'data-status="' + room.status + '"' +
                (visible ? '' : ' style="display:none"') + '>' +
                '<input type="checkbox" checked> ' +
                icon +
                '<span class="panel-list__name">' + escapeHtml(room.aoid) + '</span>' +
                '<span class="panel-list__value">' + room.area + ' m\u00B2</span>' +
                '</div>';
        }

        roomListEl.innerHTML = html;

        // Click handlers
        var items = roomListEl.querySelectorAll('.panel-list__item');
        items.forEach(function (item) {
            item.addEventListener('click', function () {
                var roomId = parseInt(item.getAttribute('data-room-id'), 10);
                selectRoomInList(roomId);
                FloorPlanViewer.selectRoom(roomId);
                FloorPlanViewer.zoomToRoom(roomId);
            });
        });
    }

    function renderAreasPanel() {
        var areaListEl = document.getElementById('area-list');
        if (!areaListEl) return;

        var html = '';

        if (docAreas.length === 0) {
            html = '<div class="panel-list__empty">Keine Flächenpolygone vorhanden.</div>';
        } else {
            for (var i = 0; i < docAreas.length; i++) {
                var area = docAreas[i];
                var icon = area.status === 'error'
                    ? '<i data-lucide="x-circle" class="icon icon-sm panel-list__icon panel-list__icon--error"></i>'
                    : area.status === 'warning'
                    ? '<i data-lucide="alert-triangle" class="icon icon-sm panel-list__icon panel-list__icon--warning"></i>'
                    : '<i data-lucide="check-circle-2" class="icon icon-sm panel-list__icon panel-list__icon--ok"></i>';

                var visible = matchesStatusFilter(area.status);
                html += '<div class="panel-list__item" data-area-id="' + area.id + '" ' +
                    'data-aoid="' + escapeHtml(area.aoid) + '" data-detail="' + escapeHtml(area.aofunction) + '" ' +
                    'data-status="' + area.status + '"' +
                    (visible ? '' : ' style="display:none"') + '>' +
                    '<input type="checkbox" checked> ' +
                    icon +
                    '<span class="panel-list__name">' + escapeHtml(area.aoid) + '</span>' +
                    '<span class="panel-list__value">' + area.area.toFixed(1) + ' m\u00B2</span>' +
                    '</div>';
            }
        }

        areaListEl.innerHTML = html;

        // Click handlers to highlight area in viewer
        var items = areaListEl.querySelectorAll('.panel-list__item');
        items.forEach(function (item) {
            item.addEventListener('click', function () {
                var areaId = parseInt(item.getAttribute('data-area-id'), 10);
                items.forEach(function (el) { el.classList.remove('panel-list__item--selected'); });
                item.classList.add('panel-list__item--selected');
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

        var html = '';

        if (docErrors.length === 0) {
            html = '<div class="error-list__empty">Keine Fehler oder Warnungen gefunden.</div>';
        } else {
            for (var i = 0; i < docErrors.length; i++) {
                var err = docErrors[i];
                var icon = err.severity === 'error'
                    ? '<i data-lucide="x-circle" class="icon icon-sm error-list__icon error-list__icon--error"></i>'
                    : '<i data-lucide="alert-triangle" class="icon icon-sm error-list__icon error-list__icon--warning"></i>';

                // Try to find which room this error references
                var roomId = '';
                var aoidMatch = err.message.match(/([A-Z0-9]+\.[0-9]+)/i);
                if (aoidMatch) {
                    var room = docRooms.find(function (r) { return r.aoid === aoidMatch[1]; });
                    if (room) roomId = room.id;
                }

                var errVisible = matchesSeverityFilter(err.severity);
                html += '<div class="error-list__item" data-code="' + escapeHtml(err.ruleCode) + '" data-msg="' + escapeHtml(err.message) + '" ' +
                    'data-severity="' + err.severity + '"' +
                    (roomId ? ' data-room-id="' + roomId + '"' : '') +
                    (errVisible ? '' : ' style="display:none"') + '>' +
                    icon +
                    '<span class="error-list__code">' + escapeHtml(err.ruleCode) + '</span>' +
                    '<span class="error-list__message">' + escapeHtml(err.message) + '</span>' +
                    '</div>';
            }
        }

        groupsEl.innerHTML = html;

        // Click error items to highlight and zoom to affected room
        var items = groupsEl.querySelectorAll('.error-list__item[data-room-id]');
        items.forEach(function (item) {
            item.style.cursor = 'pointer';
            item.addEventListener('click', function () {
                var id = parseInt(item.getAttribute('data-room-id'), 10);
                FloorPlanViewer.selectRoom(id);
                FloorPlanViewer.zoomToRoom(id);
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

    function renderRulesPanel() {
        var listEl = document.getElementById('val-rule-list');
        if (!listEl) return;

        var rules = getProjectRules();
        var html = '';

        // Build a set of rule codes that have errors/warnings for this document
        var failedRules = {};
        for (var e = 0; e < docErrors.length; e++) {
            var code = docErrors[e].ruleCode;
            if (!failedRules[code] || docErrors[e].severity === 'error') {
                failedRules[code] = docErrors[e].severity;
            }
        }

        if (rules.length === 0) {
            html = '<div class="rule-list__empty">Keine Prüfregeln vorhanden.</div>';
        } else {
            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];
                var severity = failedRules[rule.code] || 'ok';
                var icon = severity === 'error'
                    ? '<i data-lucide="x-circle" class="icon icon-sm rule-list__icon rule-list__icon--error"></i>'
                    : severity === 'warning'
                    ? '<i data-lucide="alert-triangle" class="icon icon-sm rule-list__icon rule-list__icon--warning"></i>'
                    : '<i data-lucide="check-circle-2" class="icon icon-sm rule-list__icon rule-list__icon--ok"></i>';

                var ruleVisible = matchesStatusFilter(severity);
                html += '<div class="rule-list__item" data-code="' + escapeHtml(rule.code) + '" data-name="' + escapeHtml(rule.name) + '" ' +
                    'data-status="' + severity + '"' +
                    (ruleVisible ? '' : ' style="display:none"') + '>' +
                    '<span class="rule-list__code">' + escapeHtml(rule.code) + '</span>' +
                    icon +
                    '<span class="rule-list__name">' + escapeHtml(rule.name) + '</span>' +
                    '</div>';
            }
        }

        listEl.innerHTML = html;
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
        var items = document.querySelectorAll('#room-list .panel-list__item');
        items.forEach(function (item) {
            item.classList.remove('panel-list__item--selected');
        });

        // Add selection
        if (roomId) {
            var target = document.querySelector('#room-list .panel-list__item[data-room-id="' + roomId + '"]');
            if (target) {
                target.classList.add('panel-list__item--selected');
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
            statusFilter = new Set(['all']);
        }
    };
})();
