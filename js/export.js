// =============================================
// PDF and Excel reports (jsPDF, jspdf-autotable and SheetJS are loaded from CDNs on first use)
// =============================================

import { state, dom } from './state.js';
import { log, showStatus, fmtNum, hexToRgb, themeToken } from './utils.js';
import { render, resizeCanvas, drawScaleBarOnCanvas } from './renderer.js';
import { zoomExtents } from './camera.js';
import { t } from './i18n.js';
import { buildReportModel, reportBaseName, formatDateTime } from './report-model.js';
import { formatArea, formatShare, formatRatio, DASH } from './kpi.js';

const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
const AUTOTABLE_URL = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js';
const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';

const PAGE = { width: 210, height: 297, marginX: 14, contentTop: 28, bottomMargin: 18 };
const IMAGE_MAX_PX = 1600;          // report images are downscaled to keep the PDF small
const EXCEL_SHEET_NAME_MAX = 31;

// ── Loading ──

const scriptPromises = new Map();

/** Loads a UMD script once; a failed load can be retried. */
function loadScript(src) {
    if (!scriptPromises.has(src)) {
        scriptPromises.set(src, new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => { scriptPromises.delete(src); reject(new Error(t('export.scriptLoadFailed', { url: src }))); };
            document.head.appendChild(script);
        }));
    }
    return scriptPromises.get(src);
}

async function loadJsPdf() {
    await loadScript(JSPDF_URL);
    await loadScript(AUTOTABLE_URL);
    return window.jspdf.jsPDF;
}

let exportBusy = false;

/** Shared guard, logging and error surface for both report types. */
async function runExport(keys, build) {
    if (exportBusy) return;
    if (!state.lastFile) { log(t('file.noFile'), 'warn'); return; }
    exportBusy = true;
    log(t(keys.start));
    try {
        await build(buildReportModel());
        log(t(keys.done), 'success');
    } catch (err) {
        log(t(keys.failed, { error: err.message }), 'error');
        showStatus(t(keys.failed, { error: err.message }), 'error');
        console.error(err);
    } finally {
        exportBusy = false;
    }
}

// ── Canvas capture ──

/** Renders one tab's view at full extent into a PNG data URL, then restores the current view. */
function captureViewImage(tab) {
    const previous = {
        tab: state.activeTab, selectedItem: state.selectedItem, selectedPolygon: state.selectedPolygon,
        highlightedItems: state.highlightedItems, cam: { ...state.cam },
        hiddenRooms: new Set(state.hiddenRoomIds), hiddenAreas: new Set(state.hiddenAreaIds),
        splitDisplay: dom.validationSplit.style.display,
    };
    try {
        dom.validationSplit.style.display = ''; // the KPI tab hides the viewer, and a hidden canvas has no size
        resizeCanvas();
        state.activeTab = tab;
        state.selectedItem = null;
        state.selectedPolygon = null;
        state.highlightedItems = null;
        state.hiddenRoomIds.clear();
        state.hiddenAreaIds.clear();
        zoomExtents();
        render();
        drawScaleBarOnCanvas();
        return downscaleCanvas(dom.canvas);
    } finally {
        state.activeTab = previous.tab;
        state.selectedItem = previous.selectedItem;
        state.selectedPolygon = previous.selectedPolygon;
        state.highlightedItems = previous.highlightedItems;
        state.cam = previous.cam;
        for (const id of previous.hiddenRooms) state.hiddenRoomIds.add(id);
        for (const id of previous.hiddenAreas) state.hiddenAreaIds.add(id);
        dom.validationSplit.style.display = previous.splitDisplay;
        resizeCanvas();
        render();
    }
}

function downscaleCanvas(canvas) {
    const scale = Math.min(1, IMAGE_MAX_PX / canvas.width);
    let source = canvas;
    if (scale < 1) {
        source = document.createElement('canvas');
        source.width = Math.round(canvas.width * scale);
        source.height = Math.round(canvas.height * scale);
        source.getContext('2d').drawImage(canvas, 0, 0, source.width, source.height);
    }
    return { data: source.toDataURL('image/png'), aspect: source.height / source.width };
}

// ── PDF ──

function pdfTheme() {
    const rgb = (name, fallback) => hexToRgb(themeToken(name) || fallback);
    return {
        primary: rgb('--color-primary', '#006699'),
        primaryLight: rgb('--color-primary-light', '#F2F7F9'),
        text: rgb('--color-text-primary', '#333333'),
        muted: rgb('--color-text-secondary', '#6B6B6B'),
        border: rgb('--color-border', '#CCCCCC'),
        zebra: rgb('--color-bg-secondary', '#F5F5F5'),
        error: rgb('--color-error', '#B71C1C'),
        warning: rgb('--color-warning', '#BF360C'),
        success: rgb('--color-success', '#1B5E20'),
        successLight: rgb('--color-success-light', '#E8F5E9'),
    };
}

async function buildPdf(model) {
    const jsPDF = await loadJsPdf();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const theme = pdfTheme();
    const { marginX, height, contentTop, bottomMargin } = PAGE;
    const right = PAGE.width - marginX;
    const contentWidth = right - marginX;
    const labels = { ok: t('status.ok'), error: t('status.error'), warning: t('status.warning'), unknown: t('status.unknown') };
    const labelColor = { [labels.ok]: theme.success, [labels.error]: theme.error, [labels.warning]: theme.warning, [labels.unknown]: theme.warning };
    const chapterPages = {};
    let tableNumber = 0;

    const setFont = (size, color, style = 'normal') => { doc.setFontSize(size); doc.setTextColor(...color); doc.setFont(undefined, style); };
    const fitText = (text, maxWidth) => {
        if (doc.getTextWidth(text) <= maxWidth) return text;
        let s = text;
        while (s.length > 1 && doc.getTextWidth(s + '…') > maxWidth) s = s.slice(0, -1);
        return s + '…';
    };

    function pageHeader(title) {
        doc.setFillColor(...theme.primary);
        doc.rect(marginX, 8, contentWidth, 0.6, 'F');
        setFont(7.5, theme.muted);
        doc.text(t('export.reportTitle'), marginX, 13);
        doc.text(fitText(model.fileName, contentWidth / 2), right, 13, { align: 'right' });
        if (title) {
            setFont(13, theme.text, 'bold');
            doc.text(title, marginX, 22);
            doc.setDrawColor(...theme.border);
            doc.setLineWidth(0.3);
            doc.line(marginX, 24, right, 24);
        }
    }

    function pageFooter() {
        const total = doc.internal.getNumberOfPages();
        for (let page = 1; page <= total; page++) {
            doc.setPage(page);
            doc.setDrawColor(...theme.border);
            doc.setLineWidth(0.2);
            doc.line(marginX, height - 14, right, height - 14);
            setFont(7.5, theme.muted);
            const org = t('export.footerOrg');
            doc.textWithLink(org, marginX, height - 10, { url: 'https://www.bbl.admin.ch/' });
            const sep = ' • ';
            doc.text(sep, marginX + doc.getTextWidth(org), height - 10);
            doc.textWithLink(t('export.footerPlatform'), marginX + doc.getTextWidth(org) + doc.getTextWidth(sep), height - 10, { url: 'https://bbl-dres.github.io/plan-check/' });
            doc.text(t('export.pageNumber', { current: page, total }), right, height - 10, { align: 'right' });
        }
    }

    function sectionSubtitle(label, y) {
        doc.setFillColor(...theme.primaryLight);
        doc.roundedRect(marginX, y - 4, contentWidth, 7, 1, 1, 'F');
        setFont(9, theme.primary, 'bold');
        doc.text(label, marginX + 3, y);
        return y + 6;
    }

    function tableCaption(text) {
        const y = doc.lastAutoTable.finalY + 3;
        setFont(7, theme.muted);
        doc.text(t('export.tableTab', { num: ++tableNumber, text }), marginX, y);
        return y + 4;
    }

    function addImage(image, y, maxHeight) {
        let w = contentWidth, h = contentWidth * image.aspect;
        if (h > maxHeight) { w = maxHeight / image.aspect; h = maxHeight; }
        const x = marginX + (contentWidth - w) / 2;
        doc.setDrawColor(...theme.border);
        doc.setLineWidth(0.3);
        doc.rect(x, y, w, h);
        doc.addImage(image.data, 'PNG', x + 0.3, y + 0.3, w - 0.6, h - 0.6);
        return y + h;
    }

    /** Starts a new page when fewer than `needed` mm remain; returns the y to continue at. */
    function ensureSpace(y, needed, title) {
        if (y + needed <= height - bottomMargin) return y;
        doc.addPage();
        pageHeader(title);
        return contentTop;
    }

    /** Table with a status column coloured by label; continuation pages get the running header. */
    function table({ title, statusColumn, ...options }) {
        let pages = 0;
        doc.autoTable({
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, lineColor: theme.border, lineWidth: 0.2, textColor: theme.text },
            headStyles: { fillColor: theme.primaryLight, textColor: theme.primary, fontStyle: 'bold', lineWidth: 0.2, lineColor: theme.border },
            alternateRowStyles: { fillColor: theme.zebra },
            margin: { left: marginX, right: marginX, top: contentTop },
            didDrawPage: () => { if (++pages > 1) pageHeader(title); },
            didParseCell: data => {
                if (statusColumn != null && data.section === 'body' && data.column.index === statusColumn) {
                    const color = labelColor[data.cell.raw];
                    if (color) data.cell.styles.textColor = color;
                }
            },
            ...options,
        });
    }

    function chapter(key, title, draw) {
        doc.addPage();
        chapterPages[key] = doc.internal.getNumberOfPages();
        pageHeader(title);
        draw(title);
    }

    const statusLabel = status => labels[status] || status;
    const polygonRows = entries => entries.map((e, i) => [String(i + 1), statusLabel(e.status), String(e.id), e.aoid, fmtNum(e.area, 2), e.layer]);
    const polygonHead = [[t('export.colNumber'), t('export.colStatus'), t('export.colId'), t('export.colDesignation'), t('export.colArea'), t('export.colLayer')]];
    const polygonColumns = { 0: { cellWidth: 10 }, 1: { cellWidth: 20 }, 2: { cellWidth: 14 }, 4: { cellWidth: 24, halign: 'right' } };
    const kpiHead = [[t('export.colAbbreviation'), t('export.colDesignation'), t('export.colArea'), t('export.colProportion')]];
    const kpiColumns = { 0: { fontStyle: 'bold', cellWidth: 18 }, 2: { halign: 'right', cellWidth: 30 }, 3: { halign: 'right', cellWidth: 16 } };
    const areaRow = r => [r.abbr, r.label, formatArea(r.value), formatShare(r.value, r.total)];

    // ── Cover ──
    const { summary } = model;
    const scoreColor = summary.scoreClass === 'success' ? theme.success : summary.scoreClass === 'warning' ? theme.warning : theme.error;
    setFont(22, theme.text, 'bold');
    doc.text(t('export.reportTitle'), marginX, 22);
    setFont(10, theme.muted);
    doc.text(fitText(model.fileName, contentWidth), marginX, 30);
    doc.text(t('export.created', { date: formatDateTime(new Date()) }), marginX, 36);
    doc.setDrawColor(...theme.primary);
    doc.setLineWidth(0.5);
    doc.line(marginX, 40, marginX + 30, 40);

    table({ title: t('export.reportTitle'), startY: 47, head: [[t('export.property'), t('export.value')]], body: model.info.map(([k, v]) => [k, String(v)]), columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48 } } });

    const heading = (label, y) => {
        setFont(11, theme.text, 'bold');
        doc.text(label, marginX, y);
        doc.setDrawColor(...theme.border);
        doc.setLineWidth(0.2);
        doc.line(marginX, y + 2, right, y + 2);
        return y + 7;
    };

    let y = heading(t('export.summary'), doc.lastAutoTable.finalY + 10);
    const drawCards = (cards, startY) => {
        const gap = 3, cardW = (contentWidth - gap * (cards.length - 1)) / cards.length, cardH = 16;
        cards.forEach((card, i) => {
            const x = marginX + i * (cardW + gap);
            doc.setDrawColor(...theme.border);
            doc.setLineWidth(0.2);
            doc.roundedRect(x, startY, cardW, cardH, 1.5, 1.5);
            setFont(14, card.color, 'bold');
            doc.text(card.value, x + cardW / 2, startY + 8.5, { align: 'center' });
            setFont(7, theme.muted);
            doc.text(card.label, x + cardW / 2, startY + 13, { align: 'center' });
        });
        return startY + cardH;
    };
    const k = model.kpi.kpis;
    y = drawCards([
        { label: t('metric.score', { passed: summary.passedRules, total: summary.totalRules }), value: summary.score + '%', color: scoreColor },
        { label: t('metric.rooms'), value: String(model.rooms.length), color: theme.primary },
        { label: t('metric.areas'), value: String(model.areas.length), color: theme.primary },
        { label: t('metric.layers'), value: String(model.layers.length), color: theme.primary },
    ], y) + 3;
    y = drawCards([
        { label: t('metric.gf'), value: formatArea(k.gf), color: theme.primary },
        { label: t('metric.ngf'), value: k.hasRooms ? formatArea(k.ngf) : DASH, color: theme.primary },
        { label: t('metric.errors'), value: String(summary.errorCount), color: summary.errorCount > 0 ? theme.error : theme.success },
        { label: t('metric.warnings'), value: String(summary.warningCount), color: summary.warningCount > 0 ? theme.warning : theme.success },
    ], y);

    y = heading(t('export.links'), y + 10);
    for (const [label, url] of model.links) {
        setFont(7.5, theme.text, 'bold');
        doc.text(label, marginX, y);
        setFont(6.5, theme.muted);
        doc.text(url, marginX, y + 3.5);
        y += 9;
    }

    // ── Table of contents placeholder (filled once page numbers are known) ──
    doc.addPage();
    const tocPage = doc.internal.getNumberOfPages();

    // ── Rules ──
    chapter('rules', `${t('tab.rules')} (${model.rules.passed.length}/${summary.totalRules})`, title => {
        const ruleRows = list => list.map(({ rule }) => [rule.severity === 'error' ? labels.error : labels.warning, rule.code, t('rule.' + rule.code)]);
        const head = [[t('export.colStatus'), t('export.colRule'), t('export.colDescription')]];
        const columnStyles = { 0: { cellWidth: 20 }, 1: { fontStyle: 'bold', cellWidth: 28 } };
        let py = contentTop;
        if (model.rules.failed.length > 0) {
            py = sectionSubtitle(`${t('tab.notPassed')} (${model.rules.failed.length})`, py);
            table({ title, statusColumn: 0, startY: py, head, body: ruleRows(model.rules.failed), columnStyles });
            py = doc.lastAutoTable.finalY + 8;
        }
        py = sectionSubtitle(`${t('tab.passed')} (${model.rules.passed.length})`, ensureSpace(py, 30, title));
        table({ title, statusColumn: 0, startY: py, head, body: model.rules.passed.map(({ rule }) => [labels.ok, rule.code, t('rule.' + rule.code)]), columnStyles });
        tableCaption(t('export.rulesCaption'));
    });

    // ── Issues ──
    chapter('errors', `${t('tab.errors')} (${model.issues.length})`, title => {
        if (model.issues.length === 0) {
            doc.setFillColor(...theme.successLight);
            doc.roundedRect(marginX, 32, contentWidth, 12, 2, 2, 'F');
            setFont(10, theme.success, 'bold');
            doc.text(t('export.noErrors'), marginX + 4, 39.5);
            return;
        }
        table({
            title, statusColumn: 1, startY: contentTop,
            head: [[t('export.colNumber'), t('export.colStatus'), t('export.colRule'), t('export.colMessage')]],
            body: model.issues.map((issue, i) => [String(i + 1), statusLabel(issue.severity), issue.code, issue.message]),
            columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 20 }, 2: { cellWidth: 28 } },
        });
        tableCaption(t('export.errorsCaption'));
    });

    // ── Layers ──
    chapter('layers', `${t('tab.layers')} (${model.layers.length})`, title => {
        let ly = addImage(captureViewImage('overview'), contentTop, 110) + 8;
        ly = sectionSubtitle(t('export.layerOverview', { count: model.layers.length }), ly);
        table({
            title, statusColumn: 1, startY: ly,
            head: [[t('export.colNumber'), t('export.colStatus'), t('export.colLayer'), t('export.colObjects'), t('export.colColor')]],
            body: model.layers.map((l, i) => [String(i + 1), statusLabel(l.status), l.name, String(l.count), l.colorHex]),
            columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 20 }, 3: { cellWidth: 22, halign: 'right' }, 4: { cellWidth: 20 } },
        });
        tableCaption(t('export.layersCaption'));
    });

    // ── Rooms and floor areas ──
    const polygonChapter = (key, tabKey, entries, viewTab, emptyKey, listKey, captionKey) => {
        chapter(key, `${t(tabKey)} (${entries.length})`, title => {
            let py = addImage(captureViewImage(viewTab), contentTop, 95) + 8;
            if (entries.length === 0) {
                setFont(9, theme.muted);
                doc.text(t(emptyKey), marginX, py + 4);
                return;
            }
            py = sectionSubtitle(t(listKey, { count: entries.length }), py);
            table({ title, statusColumn: 1, startY: py, head: polygonHead, body: polygonRows(entries), columnStyles: polygonColumns });
            tableCaption(t(captionKey));
        });
    };
    polygonChapter('rooms', 'tab.rooms', model.rooms, 'rooms', 'export.noRooms', 'export.roomList', 'export.roomsCaption');
    polygonChapter('areas', 'tab.areas', model.areas, 'areas', 'export.noAreas', 'export.areaList', 'export.areasCaption');

    // ── Key figures ──
    chapter('kpi', t('tab.kpi'), title => {
        const continuation = t('kpiSection.continued');
        let ky = sectionSubtitle(t('kpiSection.areas'), contentTop + 2);
        table({ title: continuation, startY: ky, head: kpiHead, body: model.kpi.areas.map(areaRow), columnStyles: kpiColumns });
        tableCaption(t('export.buildingAreasCaption'));

        ky = ensureSpace(doc.lastAutoTable.finalY + 10, 25, continuation);
        ky = sectionSubtitle(t('kpiSection.volume'), ky);
        table({ title: continuation, startY: ky, head: [[t('export.colAbbreviation'), t('export.colDesignation'), t('export.colVolume'), t('export.colProportion')]], body: model.kpi.volume.map(r => [r.abbr, r.label, DASH, DASH]), columnStyles: kpiColumns });
        tableCaption(t('export.volumeCaption'));

        ky = ensureSpace(doc.lastAutoTable.finalY + 10, 80, continuation);
        ky = sectionSubtitle(t('kpiSection.din277'), ky);
        table({ title: continuation, startY: ky, head: kpiHead, body: model.kpi.din277.map(areaRow), columnStyles: kpiColumns });
        tableCaption(t('export.din277Caption'));

        ky = ensureSpace(doc.lastAutoTable.finalY + 10, 45, continuation);
        ky = sectionSubtitle(t('kpiSection.economy'), ky);
        table({ title: continuation, startY: ky, head: [[t('export.colKpiName'), t('export.colDesignation'), t('export.value')]], body: model.kpi.economy.map(r => [r.abbr, r.label, formatRatio(r.ratio)]), columnStyles: { 0: { fontStyle: 'bold', cellWidth: 22 }, 2: { halign: 'right', cellWidth: 22 } } });
        tableCaption(t('export.economyCaption'));

        if (model.entities.length > 0) {
            ky = ensureSpace(doc.lastAutoTable.finalY + 10, 50, continuation);
            ky = sectionSubtitle(t('kpiSection.entitySummary'), ky);
            table({ title: continuation, startY: ky, head: [[t('export.colType'), t('export.colCount'), t('export.colTopLayer')]], body: model.entities.map(e => [e.type, String(e.count), e.layers]), columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 1: { cellWidth: 16, halign: 'right' } } });
            tableCaption(t('export.entityCaption'));
        }
    });

    // ── Table of contents ──
    doc.setPage(tocPage);
    pageHeader(t('tab.toc'));
    const toc = [
        ['1', t('tab.rules'), t('export.rulesChecked', { count: summary.totalRules }), chapterPages.rules],
        ['2', t('tab.errors'), t('export.resultsCount', { count: model.issues.length }), chapterPages.errors],
        ['3', t('tab.layers'), t('export.layersFound', { count: model.layers.length }), chapterPages.layers],
        ['4', t('tab.rooms'), t('export.roomsWithAreas', { count: model.rooms.length }), chapterPages.rooms],
        ['5', t('tab.areas'), t('export.areaPolygons', { count: model.areas.length }), chapterPages.areas],
        ['6', t('tab.kpi'), t('export.tocKpiDesc'), chapterPages.kpi],
    ];
    setFont(8, theme.muted);
    doc.text(t('export.tocPage'), right - 2, 29, { align: 'right' });
    let ty = 34;
    for (const [num, label, desc, page] of toc) {
        setFont(11, theme.primary, 'bold');
        doc.text(num, marginX + 2, ty);
        doc.textWithLink(label, marginX + 12, ty, { pageNumber: page });
        setFont(8, theme.muted);
        doc.text(desc, marginX + 12, ty + 5);
        const dots = '·'.repeat(40);
        doc.setTextColor(...theme.border);
        doc.text(dots, right - 10 - doc.getTextWidth(dots), ty);
        setFont(11, theme.text, 'bold');
        doc.text(String(page), right - 2, ty, { align: 'right' });
        doc.setDrawColor(...theme.zebra);
        doc.line(marginX, ty + 8, right, ty + 8);
        ty += 14;
    }

    pageFooter();
    doc.save(`${reportBaseName()}${t('export.reportSuffix')}.pdf`);
}

export function downloadPdfReport() {
    return runExport({ start: 'log.pdfCreating', done: 'log.pdfExported', failed: 'log.pdfFailed' }, buildPdf);
}

// ── Excel ──

/** Excel forbids [ ] : * ? / \ in sheet names and limits them to 31 characters. */
function sheetName(name) {
    return name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, EXCEL_SHEET_NAME_MAX) || 'Sheet';
}

async function buildExcel(model) {
    const XLSX = await import(SHEETJS_URL);
    const wb = XLSX.utils.book_new();
    const addSheet = (name, rows, widths) => {
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = widths.map(wch => ({ wch }));
        XLSX.utils.book_append_sheet(wb, ws, sheetName(name));
    };
    const statusLabel = status => ({ ok: t('status.ok'), error: t('status.error'), warning: t('status.warning'), unknown: t('status.unknown') })[status] || status;
    const cellArea = v => (v == null ? DASH : Math.round(v * 100) / 100);

    addSheet('Info', [
        [t('export.property'), t('export.value')],
        ...model.info,
        [t('export.roomsDetected'), model.rooms.length],
        [t('export.areasDetected'), model.areas.length],
        [t('export.errorsDetected'), model.issues.length],
        ['', ''],
        ...model.links,
    ], [30, 65]);

    const ruleRow = ({ rule, count }) => [count === 0 ? t('status.passed') : statusLabel(rule.severity), rule.code, t('rule.' + rule.code), count];
    addSheet(t('tab.rules'), [
        [t('export.colStatus'), t('export.colRule'), t('export.colDescription'), t('export.colViolations')],
        ...model.rules.failed.map(ruleRow), ...model.rules.passed.map(ruleRow),
    ], [12, 14, 50, 10]);

    addSheet(t('tab.errors'), [
        [t('export.colNumber'), t('export.colStatus'), t('export.colRule'), t('export.colMessage')],
        ...model.issues.map((issue, i) => [i + 1, statusLabel(issue.severity), issue.code, issue.message]),
    ], [5, 12, 12, 50]);

    addSheet(t('tab.layers'), [
        [t('export.colNumber'), t('export.colStatus'), t('export.colLayer'), t('export.colObjects'), t('export.colColor')],
        ...model.layers.map((l, i) => [i + 1, statusLabel(l.status), l.name, l.count, l.colorHex]),
    ], [5, 12, 30, 18, 10]);

    addSheet(t('tab.rooms'), [
        [t('export.colNumber'), t('export.colStatus'), t('export.colId'), t('export.colDesignation'), t('export.colArea'), t('export.colLayer'), t('export.colVertices'), t('export.colHandle')],
        ...model.rooms.map((r, i) => [i + 1, statusLabel(r.status), r.id, r.aoid, r.area, r.layer, r.vertices.length, r.handle || '-']),
    ], [5, 10, 10, 20, 14, 22, 10, 10]);

    addSheet(t('tab.areas'), [
        [t('export.colNumber'), t('export.colStatus'), t('export.colId'), t('export.colDesignation'), t('export.colArea'), t('export.colLayer'), t('export.colHandle')],
        ...model.areas.map((a, i) => [i + 1, statusLabel(a.status), a.id, a.aoid, a.area, a.layer, a.handle || '-']),
    ], [5, 10, 10, 20, 14, 22, 10]);

    const areaRow = r => [r.abbr, r.label, cellArea(r.value), formatShare(r.value, r.total)];
    const kpiRows = [
        [t('export.colAbbreviation'), t('export.colDesignation'), t('export.value'), t('export.colProportion')],
        ['', '', '', ''],
        [t('kpiSection.areas'), '', t('export.colArea'), t('export.colProportion')],
        ...model.kpi.areas.map(areaRow),
        ['', '', '', ''],
        [t('kpiSection.volume'), '', t('export.colVolume'), t('export.colProportion')],
        ...model.kpi.volume.map(r => [r.abbr, r.label, DASH, DASH]),
        ['', '', '', ''],
        [t('kpiSection.din277'), '', t('export.colArea'), t('export.colProportion')],
        ...model.kpi.din277.map(areaRow),
        ['', '', '', ''],
        [t('kpiSection.economy'), '', t('export.value'), ''],
        ...model.kpi.economy.map(r => [r.abbr, r.label, formatRatio(r.ratio), '']),
    ];
    if (model.entities.length > 0) {
        kpiRows.push(['', '', '', ''], [t('kpiSection.entitySummary'), '', t('export.colCount'), t('export.colTopLayer')]);
        for (const e of model.entities) kpiRows.push([e.type, '', e.count, e.layers]);
    }
    addSheet(t('tab.kpi'), kpiRows, [18, 40, 16, 10]);

    XLSX.writeFile(wb, `${reportBaseName()}${t('export.reportSuffix')}.xlsx`);
}

export function downloadExcelReport() {
    return runExport({ start: 'log.excelCreating', done: 'log.excelExported', failed: 'log.excelFailed' }, buildExcel);
}
