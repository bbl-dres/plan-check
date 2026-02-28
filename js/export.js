// =============================================
// PDF & Excel Report Generation
// =============================================

import { state, dom, CAFM_LAYERS } from './state.js';
import { fmtSize, fmtNum, log } from './utils.js';
import { render, zoomExtents } from './renderer.js';
import { ALL_RULES, getRuleCatLabel } from './validation.js';
import { t, getLocale } from './i18n.js';

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Script load failed: ' + src));
        document.head.appendChild(s);
    });
}

async function loadJsPDF() {
    await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js');
    return window.jspdf.jsPDF;
}

function captureCanvasForMode(mode) {
    const prevMode = state.validationMode;
    const prevSelectedRoom = state.selectedRoom;
    const prevSelectedItem = state.selectedItem;
    const prevCam = { ...state.cam };

    try {
        state.validationMode = mode;
        state.selectedRoom = null;
        state.selectedItem = null;
        zoomExtents();

        return dom.canvas.toDataURL('image/png');
    } finally {
        state.validationMode = prevMode;
        state.selectedRoom = prevSelectedRoom;
        state.selectedItem = prevSelectedItem;
        state.cam.x = prevCam.x;
        state.cam.y = prevCam.y;
        state.cam.zoom = prevCam.zoom;
        render();
    }
}

export async function downloadPdfReport() {
    if (!state.lastFile) { log(t('file.noFile'), 'warn'); return; }
    log(t('log.pdfCreating'));
    try {
        const jsPDF = await loadJsPDF();
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pw = 210, ph = 297, mx = 14, mxr = 196, contentW = mxr - mx;
        const DASH = '\u2014';
        const fmtA = (v) => (v === null || v === undefined) ? DASH : fmtNum(v, v >= 100 ? 0 : 1) + ' m\u00B2';
        // Colors matched to design tokens (tokens.css)
        const blue = [0, 102, 153];         // --color-primary: #006699
        const blueBg = [242, 247, 249];     // --color-primary-light: #F2F7F9
        const dark = [51, 51, 51];          // --color-text-primary: #333333
        const muted = [117, 117, 117];      // --color-text-secondary: #757575
        const border = [204, 204, 204];     // --color-border: #CCCCCC
        const red = [198, 40, 40];          // --color-error: #C62828
        const orange = [245, 124, 0];       // --color-warning: #F57C00
        const green = [46, 125, 50];        // --color-success: #2E7D32
        const zebra = [244, 246, 249];      // --color-zebra: #F4F6F9
        const successLight = [232, 245, 233]; // --color-success-light: #E8F5E9


        // Derived KPI data — SIA 416 category breakdown (matches frontend)
        const hasRooms = state.roomData.length > 0;
        const hasAreaPolys = state.areaData.length > 0;
        const catSum = { HNF: 0, NNF: 0, VF: 0, FF: 0 };
        for (const r of state.roomData) {
            const cat = r.siaCategory || 'HNF';
            if (cat in catSum) catSum[cat] += r.area;
            else catSum.HNF += r.area;
        }
        const hnf = catSum.HNF, nnf = catSum.NNF, vf = catSum.VF, ff = catSum.FF;
        const nf = hnf + nnf;
        const ngf = nf + vf + ff;
        const gf = hasAreaPolys ? state.areaData.reduce((s, a) => s + a.area, 0) : null;
        const kf = (gf !== null && hasRooms) ? gf - ngf : null;

        // Canvas dimensions for images
        const cw = dom.canvas.width, ch = dom.canvas.height;
        const imgAspect = ch / cw;

        // ── Shared table styles ──
        const tableBase = {
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, lineColor: border, lineWidth: 0.2, textColor: dark },
            headStyles: { fillColor: blueBg, textColor: blue, fontStyle: 'bold', lineWidth: 0.2, lineColor: border },
            alternateRowStyles: { fillColor: zebra },
            margin: { left: mx, right: mx },
        };
        const kzColStyles = { 0: { fontStyle: 'bold', cellWidth: 18 }, 2: { halign: 'right', cellWidth: 30 }, 3: { halign: 'right', cellWidth: 16 } };

        // ── Reusable layout helpers ──
        function pageHeader(title) {
            // Thin blue accent line at top
            doc.setFillColor(...blue);
            doc.rect(mx, 8, contentW, 0.6, 'F');
            // Running header text
            doc.setFontSize(7.5);
            doc.setTextColor(...muted);
            doc.text(t('export.reportTitle'), mx, 13);
            doc.text(state.lastFile.name, mxr, 13, { align: 'right' });
            // Section title
            if (title) {
                doc.setFontSize(13);
                doc.setTextColor(...dark);
                doc.setFont(undefined, 'bold');
                doc.text(title, mx, 22);
                doc.setFont(undefined, 'normal');
                // Subtle underline below title
                doc.setDrawColor(...border);
                doc.setLineWidth(0.3);
                doc.line(mx, 24, mxr, 24);
            }
        }

        function pageFooter() {
            const n = doc.internal.getNumberOfPages();
            for (let i = 1; i <= n; i++) {
                doc.setPage(i);
                doc.setDrawColor(...border);
                doc.setLineWidth(0.2);
                doc.line(mx, ph - 14, mxr, ph - 14);
                doc.setFontSize(7.5);
                doc.setTextColor(...muted);
                const bblText = t('export.footerOrg');
                doc.textWithLink(bblText, mx, ph - 10, { url: 'https://www.bbl.admin.ch/' });
                const bblW = doc.getTextWidth(bblText);
                doc.text(' \u2022 ', mx + bblW, ph - 10);
                const sepW = doc.getTextWidth(' \u2022 ');
                doc.textWithLink(t('export.footerPlatform'), mx + bblW + sepW, ph - 10, { url: 'https://bbl-dres.github.io/plan-check/' });
                doc.text(t('export.pageNumber', { current: i, total: n }), mxr, ph - 10, { align: 'right' });
            }
        }

        function sectionSubtitle(label, y) {
            doc.setFillColor(...blueBg);
            doc.roundedRect(mx, y - 4, contentW, 7, 1, 1, 'F');
            doc.setFontSize(9);
            doc.setTextColor(...blue);
            doc.setFont(undefined, 'bold');
            doc.text(label, mx + 3, y);
            doc.setFont(undefined, 'normal');
            return y + 6;
        }

        let tableNum = 0;
        function tableCaption(text) {
            tableNum++;
            const y = doc.lastAutoTable.finalY + 3;
            doc.setFontSize(7);
            doc.setTextColor(...muted);
            doc.text(t('export.tableTab', { num: tableNum, text }), mx, y);
            return y + 4;
        }

        function addImage(imgData, y, maxH) {
            let imgW = contentW;
            let imgH = contentW * imgAspect;
            // If taller than maxH, scale both dimensions to preserve aspect ratio
            if (maxH && imgH > maxH) {
                imgW = maxH / imgAspect;
                imgH = maxH;
            }
            // Center horizontally if width was reduced
            const offsetX = (contentW - imgW) / 2;
            // Light border around image
            doc.setDrawColor(...border);
            doc.setLineWidth(0.3);
            doc.rect(mx + offsetX, y, imgW, imgH);
            doc.addImage(imgData, 'PNG', mx + offsetX + 0.3, y + 0.3, imgW - 0.6, imgH - 0.6);
            return y + imgH;
        }

        // ════════════════════════════════════════════
        // PAGE 1 — Cover: Title + Info + KPIs + Links
        // ════════════════════════════════════════════

        // Score computation (same as frontend)
        const totalRules = ALL_RULES.length;
        const failedRuleCodes = new Set(state.validationErrors.map(e => e.ruleCode));
        const passedRules = totalRules - failedRuleCodes.size;
        const scorePercent = Math.round((passedRules / totalRules) * 100);
        const scoreColor = scorePercent >= 90 ? green : scorePercent >= 60 ? orange : red;
        const errCount = state.validationErrors.filter(e => e.severity === 'error').length;
        const warnCount = state.validationErrors.filter(e => e.severity === 'warning').length;

        // Title block
        doc.setFontSize(22);
        doc.setTextColor(...dark);
        doc.setFont(undefined, 'bold');
        doc.text(t('export.reportTitle'), mx, 22);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...muted);
        doc.text(state.lastFile.name, mx, 30);
        doc.text(t('export.created', { date: new Date().toLocaleString(getLocale() + '-CH') }), mx, 36);
        doc.setDrawColor(...blue);
        doc.setLineWidth(0.5);
        doc.line(mx, 40, mx + 30, 40);

        // Dateiinformationen
        doc.autoTable({
            ...tableBase,
            startY: 47,
            head: [[t('export.property'), t('export.value')]],
            body: [
                [t('export.fileName'), state.lastFile.name],
                [t('export.fileSize'), fmtSize(state.lastFile.size)],
                [t('export.dwgVersion'), state.lastDbInfo?.version || '-'],
                [t('export.layerCount'), String(state.lastDbInfo?.layerCount ?? '-')],
                [t('export.entityCount'), String(state.lastDbInfo?.entityCount ?? '-')],
                [t('export.uploaded'), state.lastUploadTime ? state.lastUploadTime.toLocaleString(getLocale() + '-CH') : '-'],
                [t('export.processingTime'), state.lastElapsed ? state.lastElapsed + ' s' : '-'],
                [t('export.roomLayer'), state.roomLayerName],
                [t('export.areaLayer'), 'R_GESCHOSSPOLYGON'],
            ],
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48 } },
        });

        // Zusammenfassung — KPI cards
        let y = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(11);
        doc.setTextColor(...dark);
        doc.setFont(undefined, 'bold');
        doc.text(t('export.summary'), mx, y);
        doc.setFont(undefined, 'normal');
        y += 2;
        doc.setDrawColor(...border);
        doc.setLineWidth(0.2);
        doc.line(mx, y, mxr, y);
        y += 5;

        const kpiCards = [
            { label: t('metric.score', { passed: passedRules, total: totalRules }), value: scorePercent + '%', color: scoreColor },
            { label: t('metric.rooms'), value: String(state.roomData.length), color: blue },
            { label: t('metric.areas'), value: String(state.areaData.length), color: blue },
            { label: t('metric.layers'), value: String(state.layerInfo.length), color: blue },
        ];
        const kpiCards2 = [
            { label: t('metric.gf'), value: gf !== null ? fmtNum(gf, 1) + ' m\u00B2' : '\u2014', color: blue },
            { label: t('metric.ngf'), value: hasRooms ? fmtNum(ngf, 1) + ' m\u00B2' : '\u2014', color: blue },
            { label: t('metric.errors'), value: String(errCount), color: errCount > 0 ? red : green },
            { label: t('metric.warnings'), value: String(warnCount), color: warnCount > 0 ? orange : green },
        ];

        function drawKpiRow(cards, startY) {
            const gap = 3;
            const cW = (contentW - gap * (cards.length - 1)) / cards.length;
            cards.forEach((m, i) => {
                const cx = mx + i * (cW + gap);
                doc.setDrawColor(...border);
                doc.setLineWidth(0.2);
                doc.roundedRect(cx, startY, cW, 16, 1.5, 1.5);
                doc.setFontSize(14);
                doc.setTextColor(...m.color);
                doc.setFont(undefined, 'bold');
                doc.text(m.value, cx + cW / 2, startY + 8.5, { align: 'center' });
                doc.setFontSize(7);
                doc.setTextColor(...muted);
                doc.setFont(undefined, 'normal');
                doc.text(m.label, cx + cW / 2, startY + 13, { align: 'center' });
            });
            return startY + 16;
        }

        y = drawKpiRow(kpiCards, y);
        y += 3;
        y = drawKpiRow(kpiCards2, y);

        // Links
        y += 10;
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...dark);
        doc.text(t('export.links'), mx, y);
        doc.setFont(undefined, 'normal');
        y += 2;
        doc.setDrawColor(...border);
        doc.setLineWidth(0.2);
        doc.line(mx, y, mxr, y);
        y += 5;

        const links = [
            [t('export.linkPlatform'), 'https://bbl-dres.github.io/plan-check/'],
            [t('export.linkGuide'), 'https://github.com/bbl-dres/plan-check/blob/main/docs/anleitung-de.md'],
            [t('export.linkSource'), 'https://github.com/bbl-dres/plan-check'],
            [t('export.linkDownloads'), 'https://www.bbl.admin.ch/de/downloads-bauten'],
            [t('export.linkContact'), 'https://www.bbl.admin.ch/de/kontakt'],
            [t('export.linkLegal'), 'https://www.admin.ch/gov/de/start/rechtliches.html'],
        ];
        for (const [label, url] of links) {
            doc.setFontSize(7.5);
            doc.setTextColor(...dark);
            doc.setFont(undefined, 'bold');
            doc.text(label, mx, y);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(...muted);
            doc.setFontSize(6.5);
            doc.text(url, mx, y + 3.5);
            y += 9;
        }

        // ════════════════════════════════════════════
        // PAGE 2 — Inhaltsverzeichnis (placeholder — filled in after all pages)
        // ════════════════════════════════════════════
        doc.addPage();
        const tocPageNum = doc.internal.getNumberOfPages();
        const chapterPages = {}; // filled as chapters are created

        // ════════════════════════════════════════════
        // Prüfregeln
        // ════════════════════════════════════════════
        doc.addPage();
        chapterPages['rules'] = doc.internal.getNumberOfPages();

        // Compute violation counts per rule code
        const violationCounts = {};
        for (const err of state.validationErrors) {
            violationCounts[err.ruleCode] = (violationCounts[err.ruleCode] || 0) + 1;
        }

        // Status label helpers
        const stOk = t('status.ok');
        const stErr = t('status.error');
        const stWarn = t('status.warning');
        const stPassed = t('status.passed');

        // Split into failed and passed (matches frontend grouping)
        const pdfFailed = [];
        const pdfPassed = [];
        for (const rule of ALL_RULES) {
            const count = violationCounts[rule.code] || 0;
            if (count > 0) {
                const sl = rule.sev === 'error' ? stErr : stWarn;
                pdfFailed.push([sl, rule.code, t('rule.' + rule.code)]);
            } else {
                pdfPassed.push([stOk, rule.code, t('rule.' + rule.code)]);
            }
        }
        // Sort failed: errors first, then warnings
        pdfFailed.sort((a, b) => {
            const aErr = a[0] === stErr ? 0 : 1;
            const bErr = b[0] === stErr ? 0 : 1;
            return aErr !== bErr ? aErr - bErr : a[1].localeCompare(b[1]);
        });

        const passCount = pdfPassed.length;
        pageHeader(t('tab.rules') + ' (' + passCount + '/' + ALL_RULES.length + ')');

        const rulesColStyles = { 0: { cellWidth: 20 }, 1: { fontStyle: 'bold', cellWidth: 28 } };
        const rulesDidParse = (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                const text = data.cell.raw;
                if (text === stOk) data.cell.styles.textColor = green;
                else if (text === stErr) data.cell.styles.textColor = red;
                else if (text === stWarn) data.cell.styles.textColor = orange;
            }
        };

        let pY = 28;

        // Nicht bestanden
        if (pdfFailed.length > 0) {
            pY = sectionSubtitle(`${t('tab.notPassed')} (${pdfFailed.length})`, pY);
            doc.autoTable({
                ...tableBase,
                startY: pY,
                head: [[t('export.colStatus'), t('export.colRule'), t('export.colDescription')]],
                body: pdfFailed,
                columnStyles: rulesColStyles,
                didParseCell: rulesDidParse,
            });
            pY = doc.lastAutoTable.finalY + 8;
        }

        // Bestanden
        if (pY > ph - 30) { doc.addPage(); pageHeader(t('tab.rules') + ' (...)'); pY = 28; }
        pY = sectionSubtitle(`${t('tab.passed')} (${pdfPassed.length})`, pY);
        doc.autoTable({
            ...tableBase,
            startY: pY,
            head: [[t('export.colStatus'), t('export.colRule'), t('export.colDescription')]],
            body: pdfPassed,
            columnStyles: rulesColStyles,
            didParseCell: rulesDidParse,
        });
        tableCaption(t('export.rulesCaption'));

        // ════════════════════════════════════════════
        // Fehlermeldungen
        // ════════════════════════════════════════════
        doc.addPage();
        chapterPages['errors'] = doc.internal.getNumberOfPages();
        pageHeader(t('tab.errors') + ' (' + state.validationErrors.length + ')');

        if (state.validationErrors.length === 0) {
            let ey = 32;
            doc.setFillColor(...successLight);
            doc.roundedRect(mx, ey, contentW, 12, 2, 2, 'F');
            doc.setFontSize(10);
            doc.setTextColor(...green);
            doc.setFont(undefined, 'bold');
            doc.text(t('export.noErrors'), mx + 4, ey + 7.5);
            doc.setFont(undefined, 'normal');
        } else {
            doc.autoTable({
                ...tableBase,
                startY: 28,
                head: [[t('export.colNumber'), t('export.colStatus'), t('export.colRule'), t('export.colMessage')]],
                body: state.validationErrors.map((e, i) => {
                    return [String(i + 1), e.severity === 'error' ? stErr : stWarn, e.ruleCode, e.message];
                }),
                columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 20 }, 2: { cellWidth: 28 } },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        const sev = data.cell.raw;
                        if (sev === stErr) data.cell.styles.textColor = red;
                        else if (sev === stWarn) data.cell.styles.textColor = orange;
                    }
                },
            });
            tableCaption(t('export.errorsCaption'));
        }

        // ════════════════════════════════════════════
        // Layer
        // ════════════════════════════════════════════
        doc.addPage();
        chapterPages['layers'] = doc.internal.getNumberOfPages();
        pageHeader(t('tab.layers') + ' (' + state.layerInfo.length + ')');

        const overviewImg = captureCanvasForMode('overview');
        let uy = addImage(overviewImg, 28, 110);

        uy += 8;
        uy = sectionSubtitle(t('export.layerOverview', { count: state.layerInfo.length }), uy);
        const cafmSet = new Set(CAFM_LAYERS.all);
        const defaultLayers = new Set(['0', 'Defpoints']);
        function layerStatus(name) {
            if (cafmSet.has(name)) return stOk;
            if (defaultLayers.has(name)) return stOk;
            return t('status.unknown');
        }
        doc.autoTable({
            ...tableBase,
            startY: uy,
            head: [[t('export.colNumber'), t('export.colStatus'), t('export.colLayer'), t('export.colObjects'), t('export.colColor')]],
            body: state.layerInfo.map((l, i) => [String(i + 1), layerStatus(l.name), l.name, String(l.count), l.colorHex]),
            columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 20 }, 3: { cellWidth: 22, halign: 'right' }, 4: { cellWidth: 20 } },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 1) {
                    data.cell.styles.textColor = data.cell.raw === stOk ? green : orange;
                }
            },
        });
        tableCaption(t('export.layersCaption'));

        // ════════════════════════════════════════════
        // Räume
        // ════════════════════════════════════════════
        doc.addPage();
        chapterPages['rooms'] = doc.internal.getNumberOfPages();
        pageHeader(t('tab.rooms') + ' (' + state.roomData.length + ')');

        const roomsImg = captureCanvasForMode('rooms');
        let ry = addImage(roomsImg, 28, 95);
        ry += 8;

        if (state.roomData.length === 0) {
            doc.setFontSize(9);
            doc.setTextColor(...muted);
            doc.text(t('export.noRooms'), mx, ry + 4);
        } else {
            ry = sectionSubtitle(t('export.roomList', { count: state.roomData.length }), ry);
            const stMap = { error: stErr, warning: stWarn, ok: stOk };
            doc.autoTable({
                ...tableBase,
                startY: ry,
                head: [[t('export.colNumber'), t('export.colStatus'), t('export.colId'), t('export.colDesignation'), t('export.colArea'), t('export.colLayer')]],
                body: state.roomData.map((r, i) => {
                    return [String(i + 1), stMap[r.status] || r.status, String(r.id), r.aoid, fmtNum(r.area, 2), r.layer];
                }),
                columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 20 }, 2: { cellWidth: 14 }, 4: { cellWidth: 24, halign: 'right' } },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        const st = data.cell.raw;
                        if (st === stErr) data.cell.styles.textColor = red;
                        else if (st === stWarn) data.cell.styles.textColor = orange;
                        else if (st === stOk) data.cell.styles.textColor = green;
                    }
                },
            });
            tableCaption(t('export.roomsCaption'));
        }

        // ════════════════════════════════════════════
        // Flächen
        // ════════════════════════════════════════════
        doc.addPage();
        chapterPages['areas'] = doc.internal.getNumberOfPages();
        pageHeader(t('tab.areas') + ' (' + state.areaData.length + ')');

        const areasImg = captureCanvasForMode('areas');
        let ay = addImage(areasImg, 28, 95);
        ay += 8;

        if (state.areaData.length === 0) {
            doc.setFontSize(9);
            doc.setTextColor(...muted);
            doc.text(t('export.noAreas'), mx, ay + 4);
        } else {
            ay = sectionSubtitle(t('export.areaList', { count: state.areaData.length }), ay);
            const aStMap = { error: stErr, warning: stWarn, ok: stOk };
            doc.autoTable({
                ...tableBase,
                startY: ay,
                head: [[t('export.colNumber'), t('export.colStatus'), t('export.colId'), t('export.colDesignation'), t('export.colArea'), t('export.colLayer')]],
                body: state.areaData.map((a, i) => [String(i + 1), aStMap[a.status] || a.status, String(a.id), a.aoid, fmtNum(a.area, 2), a.layer]),
                columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 20 }, 2: { cellWidth: 14 }, 4: { cellWidth: 24, halign: 'right' } },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        const st = data.cell.raw;
                        if (st === stErr) data.cell.styles.textColor = red;
                        else if (st === stWarn) data.cell.styles.textColor = orange;
                        else if (st === stOk) data.cell.styles.textColor = green;
                    }
                },
            });
            tableCaption(t('export.areasCaption'));
        }

        // ════════════════════════════════════════════
        // Kennzahlen
        // ════════════════════════════════════════════
        doc.addPage();
        chapterPages['kz'] = doc.internal.getNumberOfPages();
        pageHeader(t('tab.kpi'));

        const pct = (v, total) => {
            if (v === null || v === undefined || total === null || total === undefined || total <= 0) return DASH;
            return Math.round((v / total) * 100) + '%';
        };

        // Gebäudeflächen
        let kzY = sectionSubtitle(t('kpiSection.areas'), 30);
        doc.autoTable({
            ...tableBase,
            startY: kzY,
            head: [[t('export.colAbbreviation'), t('export.colDesignation'), t('export.colArea'), t('export.colProportion')]],
            body: [
                ['GF', t('kpi.GF'), fmtA(gf), pct(gf, gf)],
                ['KF', t('kpi.KF'), fmtA(kf), pct(kf, gf)],
                ['NGF', t('kpi.NGF'), hasRooms ? fmtA(ngf) : DASH, pct(hasRooms ? ngf : null, gf)],
                ['NF', t('kpi.NF'), hasRooms ? fmtA(nf) : DASH, pct(hasRooms ? nf : null, gf)],
                ['HNF', t('kpi.HNF'), hasRooms ? fmtA(hnf) : DASH, pct(hasRooms ? hnf : null, gf)],
                ['NNF', t('kpi.NNF'), hasRooms ? fmtA(nnf) : DASH, pct(hasRooms ? nnf : null, gf)],
                ['VF', t('kpi.VF'), hasRooms ? fmtA(vf) : DASH, pct(hasRooms ? vf : null, gf)],
                ['FF', t('kpi.FF'), hasRooms ? fmtA(ff) : DASH, pct(hasRooms ? ff : null, gf)],
            ],
            columnStyles: kzColStyles,
        });
        tableCaption(t('export.buildingAreasCaption'));

        // Helper: page break if not enough room (need ~40mm for subtitle+table+caption)
        function kzBreak(needed) {
            kzY = doc.lastAutoTable.finalY + 10;
            if (kzY + needed > ph - 18) { doc.addPage(); pageHeader(t('kpiSection.continued')); kzY = 30; }
        }

        // Gebäudevolumen
        kzBreak(25);
        kzY = sectionSubtitle(t('kpiSection.volume'), kzY);
        doc.autoTable({
            ...tableBase,
            startY: kzY,
            head: [[t('export.colAbbreviation'), t('export.colDesignation'), t('export.colVolume'), t('export.colProportion')]],
            body: [
                ['GV', t('kpi.GV'), DASH, DASH],
            ],
            columnStyles: kzColStyles,
        });
        tableCaption(t('export.volumeCaption'));

        // Flächen DIN 277 — sub-category sums (matches frontend)
        const din277Sum = {};
        for (const r of state.roomData) {
            const sub = r.din277 || null;
            if (sub) din277Sum[sub] = (din277Sum[sub] || 0) + r.area;
        }
        kzBreak(80);
        kzY = sectionSubtitle(t('kpiSection.din277'), kzY);
        doc.autoTable({
            ...tableBase,
            startY: kzY,
            head: [[t('export.colAbbreviation'), t('export.colDesignation'), t('export.colArea'), t('export.colProportion')]],
            body: [
                ['HNF 1', t('din277.1'), fmtA(din277Sum['1'] || null), pct(din277Sum['1'] || null, gf)],
                ['HNF 2', t('din277.2'), fmtA(din277Sum['2'] || null), pct(din277Sum['2'] || null, gf)],
                ['HNF 3', t('din277.3'), fmtA(din277Sum['3'] || null), pct(din277Sum['3'] || null, gf)],
                ['HNF 4', t('din277.4'), fmtA(din277Sum['4'] || null), pct(din277Sum['4'] || null, gf)],
                ['HNF 5', t('din277.5'), fmtA(din277Sum['5'] || null), pct(din277Sum['5'] || null, gf)],
                ['HNF 6', t('din277.6'), fmtA(din277Sum['6'] || null), pct(din277Sum['6'] || null, gf)],
                ['NNF 7', t('din277.7'), fmtA(din277Sum['7'] || null), pct(din277Sum['7'] || null, gf)],
                ['FF 8', t('din277.8'), fmtA(din277Sum['8'] || null), pct(din277Sum['8'] || null, gf)],
                ['VF 9', t('din277.9'), fmtA(din277Sum['9'] || null), pct(din277Sum['9'] || null, gf)],
                ['BUF 10', t('din277.10'), fmtA(din277Sum['10'] || null), pct(din277Sum['10'] || null, gf)],
            ],
            columnStyles: kzColStyles,
        });
        tableCaption(t('export.din277Caption'));

        // Wirtschaftlichkeit
        kzBreak(45);
        kzY = sectionSubtitle(t('kpiSection.economy'), kzY);
        doc.autoTable({
            ...tableBase,
            startY: kzY,
            head: [[t('export.colKpiName'), t('export.colDesignation'), t('export.value')]],
            body: [
                ['NGF / GF', t('kpi.NGF_GF'), (gf && hasRooms) ? (ngf / gf).toFixed(2) : DASH],
                ['KF / GF', t('kpi.KF_GF'), (gf && kf !== null) ? (kf / gf).toFixed(2) : DASH],
                ['NF / NGF', t('kpi.NF_NGF'), (hasRooms && ngf > 0) ? (nf / ngf).toFixed(2) : DASH],
                ['HNF / NGF', t('kpi.HNF_NGF'), (hasRooms && ngf > 0) ? (hnf / ngf).toFixed(2) : DASH],
            ],
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 22 }, 2: { halign: 'right', cellWidth: 22 } },
        });
        tableCaption(t('export.economyCaption'));

        // Objektübersicht
        if (state.entitySummary.length > 0) {
            kzBreak(50);
            kzY = sectionSubtitle(t('kpiSection.entitySummary'), kzY);
            doc.autoTable({
                ...tableBase,
                startY: kzY,
                head: [[t('export.colType'), t('export.colCount'), t('export.colTopLayer')]],
                body: state.entitySummary.map(e => {
                    const ls = e.layers.slice(0, 3).join(', ');
                    const more = e.layers.length > 3 ? ' ...' : '';
                    return [e.type, String(e.count), ls + more];
                }),
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 1: { cellWidth: 16, halign: 'right' } },
            });
            tableCaption(t('export.entityCaption'));
        }

        // ── Render TOC on page 2 (now that we know actual page numbers) ──
        doc.setPage(tocPageNum);
        pageHeader(t('tab.toc'));

        const tocEntries = [
            { num: '1', label: t('tab.rules'), desc: t('export.rulesChecked', { count: ALL_RULES.length }), page: chapterPages['rules'] },
            { num: '2', label: t('tab.errors'), desc: t('export.resultsCount', { count: state.validationErrors.length }), page: chapterPages['errors'] },
            { num: '3', label: t('tab.layers'), desc: t('export.layersFound', { count: state.layerInfo.length }), page: chapterPages['layers'] },
            { num: '4', label: t('tab.rooms'), desc: t('export.roomsWithAreas', { count: state.roomData.length }), page: chapterPages['rooms'] },
            { num: '5', label: t('tab.areas'), desc: t('export.areaPolygons', { count: state.areaData.length }), page: chapterPages['areas'] },
            { num: '6', label: t('tab.kpi'), desc: t('export.tocKpiDesc'), page: chapterPages['kz'] },
        ];
        // "Seite" column header
        doc.setFontSize(8);
        doc.setTextColor(...muted);
        doc.text(t('export.tocPage'), mxr - 2, 29, { align: 'right' });

        let ty = 34;
        tocEntries.forEach((entry) => {
            doc.setFontSize(11);
            doc.setTextColor(...blue);
            doc.setFont(undefined, 'bold');
            doc.text(entry.num, mx + 2, ty);
            doc.textWithLink(entry.label, mx + 12, ty, { pageNumber: entry.page });
            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...muted);
            doc.text(entry.desc, mx + 12, ty + 5);
            doc.setTextColor(...border);
            doc.setFontSize(8);
            const dots = '\u00B7'.repeat(40);
            const dotsW = doc.getTextWidth(dots);
            doc.text(dots, mxr - 10 - dotsW, ty);
            doc.setTextColor(...dark);
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text(String(entry.page), mxr - 2, ty, { align: 'right' });
            doc.setFont(undefined, 'normal');
            doc.setDrawColor(...zebra);
            doc.line(mx, ty + 8, mxr, ty + 8);
            ty += 14;
        });

        // ── Footers ──
        pageFooter();

        // ── Download ──
        const baseName = state.lastFile.name.replace(/\.[^.]+$/, '');
        doc.save(`${baseName}${t('export.reportSuffix')}.pdf`);
        log(t('log.pdfExported'), 'success');
    } catch (err) {
        log(t('log.pdfFailed', { error: err.message }), 'error');
        console.error(err);
    }
}

export async function downloadExcelReport() {
    if (!state.lastFile) { log(t('file.noFile'), 'warn'); return; }
    log(t('log.excelCreating'));
    try {
        const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
        const wb = XLSX.utils.book_new();
        const DASH = '\u2014';
        const fmtA = (v) => (v === null || v === undefined) ? DASH : +v.toFixed(2);

        // ── Sheet 1: Info ──
        const infoRows = [
            [t('export.fileName'), state.lastFile.name],
            [t('export.fileSize'), fmtSize(state.lastFile.size)],
            [t('export.dwgVersion'), state.lastDbInfo?.version || '-'],
            [t('export.layerCount'), state.lastDbInfo?.layerCount ?? '-'],
            [t('export.entityCount'), state.lastDbInfo?.entityCount ?? '-'],
            [t('export.uploaded'), state.lastUploadTime ? state.lastUploadTime.toLocaleString(getLocale() + '-CH') : '-'],
            [t('export.processingTime'), state.lastElapsed ? state.lastElapsed + ' s' : '-'],
            [t('export.roomLayer'), state.roomLayerName],
            [t('export.areaLayer'), 'R_GESCHOSSPOLYGON'],
            [t('export.roomsDetected'), state.roomData.length],
            [t('export.areasDetected'), state.areaData.length],
            [t('export.errorsDetected'), state.validationErrors.length],
        ];
        // Add URLs
        infoRows.push(['', '']);
        infoRows.push([t('export.linkPlatform'), 'https://bbl-dres.github.io/plan-check/']);
        infoRows.push([t('export.linkGuide'), 'https://github.com/bbl-dres/plan-check/blob/main/docs/anleitung-de.md']);
        infoRows.push([t('export.linkSource'), 'https://github.com/bbl-dres/plan-check']);
        infoRows.push([t('export.linkDownloads'), 'https://www.bbl.admin.ch/de/downloads-bauten']);
        infoRows.push([t('export.linkContact'), 'https://www.bbl.admin.ch/de/kontakt']);
        infoRows.push([t('export.linkLegal'), 'https://www.admin.ch/gov/de/start/rechtliches.html']);

        const wsInfo = XLSX.utils.aoa_to_sheet([[t('export.property'), t('export.value')], ...infoRows]);
        wsInfo['!cols'] = [{ wch: 30 }, { wch: 65 }];
        XLSX.utils.book_append_sheet(wb, wsInfo, 'Info');

        // ── Sheet 2: Prüfregeln ──
        const xlViolationCounts = {};
        for (const err of state.validationErrors) {
            xlViolationCounts[err.ruleCode] = (xlViolationCounts[err.ruleCode] || 0) + 1;
        }
        // Sort: failed first (errors, then warnings), then passed — matches frontend/PDF
        const xlStErr = t('status.error');
        const xlStWarn = t('status.warning');
        const xlStPassed = t('status.passed');
        const xlFailed = [];
        const xlPassed = [];
        for (const rule of ALL_RULES) {
            const count = xlViolationCounts[rule.code] || 0;
            const status = count === 0 ? xlStPassed : (rule.sev === 'error' ? xlStErr : xlStWarn);
            const row = [status, rule.code, t('rule.' + rule.code), count];
            if (count > 0) xlFailed.push(row);
            else xlPassed.push(row);
        }
        xlFailed.sort((a, b) => {
            if (a[0] !== b[0]) return a[0] === xlStErr ? -1 : 1;
            return a[1].localeCompare(b[1]);
        });
        const rulesRows = [...xlFailed, ...xlPassed];
        const wsRules = XLSX.utils.aoa_to_sheet([
            [t('export.colStatus'), t('export.colRule'), t('export.colDescription'), t('export.colViolations')],
            ...rulesRows
        ]);
        wsRules['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 50 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsRules, t('tab.rules'));

        // ── Sheet 3: Fehlermeldungen ──
        const errorRows = state.validationErrors.map((e, i) => {
            return [i + 1, e.severity === 'error' ? xlStErr : xlStWarn, e.ruleCode, e.message];
        });
        const wsErrors = XLSX.utils.aoa_to_sheet([
            [t('export.colNumber'), t('export.colStatus'), t('export.colRule'), t('export.colMessage')],
            ...errorRows
        ]);
        wsErrors['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 50 }];
        XLSX.utils.book_append_sheet(wb, wsErrors, t('tab.errors'));

        // ── Sheet 4: Layer ──
        const xlCafmSet = new Set(CAFM_LAYERS.all);
        const xlDefaultLayers = new Set(['0', 'Defpoints']);
        const xlStOk = t('status.ok');
        const xlStUnknown = t('status.unknown');
        const layerRows = state.layerInfo.map((l, i) => {
            const st = xlCafmSet.has(l.name) || xlDefaultLayers.has(l.name) ? xlStOk : xlStUnknown;
            return [i + 1, st, l.name, l.count, l.colorHex];
        });
        const wsLayers = XLSX.utils.aoa_to_sheet([
            [t('export.colNumber'), t('export.colStatus'), t('export.colLayer'), t('export.colObjects'), t('export.colColor')],
            ...layerRows
        ]);
        wsLayers['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 30 }, { wch: 18 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsLayers, t('tab.layers'));

        // ── Sheet 5: Räume ──
        const statusMap = { error: t('status.error'), warning: t('status.warning'), ok: t('status.ok') };
        const roomRows = state.roomData.map((r, i) => [
            i + 1, statusMap[r.status] || r.status, r.id, r.aoid, r.area, r.layer,
            r.vertices.length, r.handle || '-'
        ]);
        const wsRooms = XLSX.utils.aoa_to_sheet([
            [t('export.colNumber'), t('export.colStatus'), t('export.colId'), t('export.colDesignation'), t('export.colArea'), t('export.colLayer'), t('export.colVertices'), t('export.colHandle')],
            ...roomRows
        ]);
        wsRooms['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsRooms, t('tab.rooms'));

        // ── Sheet 6: Flächen ──
        const xlAreaSt = { error: t('status.error'), warning: t('status.warning'), ok: t('status.ok') };
        const areaRows = state.areaData.map((a, i) => [
            i + 1, xlAreaSt[a.status] || a.status, a.id, a.aoid, a.area, a.layer, a.handle || '-'
        ]);
        const wsAreas = XLSX.utils.aoa_to_sheet([
            [t('export.colNumber'), t('export.colStatus'), t('export.colId'), t('export.colDesignation'), t('export.colArea'), t('export.colLayer'), t('export.colHandle')],
            ...areaRows
        ]);
        wsAreas['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsAreas, t('tab.areas'));

        // ── Sheet 7: Kennzahlen ──
        // SIA 416 category breakdown (matches frontend)
        const xlHasRooms = state.roomData.length > 0;
        const xlHasAreaPolys = state.areaData.length > 0;
        const xlCatSum = { HNF: 0, NNF: 0, VF: 0, FF: 0 };
        for (const r of state.roomData) {
            const cat = r.siaCategory || 'HNF';
            if (cat in xlCatSum) xlCatSum[cat] += r.area;
            else xlCatSum.HNF += r.area;
        }
        const xlHnf = xlCatSum.HNF, xlNnf = xlCatSum.NNF, xlVf = xlCatSum.VF, xlFf = xlCatSum.FF;
        const xlNf = xlHnf + xlNnf;
        const xlNgf = xlNf + xlVf + xlFf;
        const xlGf = xlHasAreaPolys ? state.areaData.reduce((s, a) => s + a.area, 0) : null;
        const xlKf = (xlGf !== null && xlHasRooms) ? xlGf - xlNgf : null;
        const xlPct = (v, total) => (v === null || v === undefined || total === null || total === undefined || total <= 0) ? DASH : Math.round((v / total) * 100) + '%';

        // DIN 277 sub-category sums
        const xlDin = {};
        for (const r of state.roomData) {
            const sub = r.din277 || null;
            if (sub) xlDin[sub] = (xlDin[sub] || 0) + r.area;
        }

        const kzRows = [
            ['', '', '', ''],
            [t('kpiSection.areas'), '', t('export.colArea'), t('export.colProportion')],
            ['GF', t('kpi.GF'), fmtA(xlGf), xlPct(xlGf, xlGf)],
            ['KF', t('kpi.KF'), fmtA(xlKf), xlPct(xlKf, xlGf)],
            ['NGF', t('kpi.NGF'), xlHasRooms ? fmtA(xlNgf) : DASH, xlPct(xlHasRooms ? xlNgf : null, xlGf)],
            ['NF', t('kpi.NF'), xlHasRooms ? fmtA(xlNf) : DASH, xlPct(xlHasRooms ? xlNf : null, xlGf)],
            ['HNF', t('kpi.HNF'), xlHasRooms ? fmtA(xlHnf) : DASH, xlPct(xlHasRooms ? xlHnf : null, xlGf)],
            ['NNF', t('kpi.NNF'), xlHasRooms ? fmtA(xlNnf) : DASH, xlPct(xlHasRooms ? xlNnf : null, xlGf)],
            ['VF', t('kpi.VF'), xlHasRooms ? fmtA(xlVf) : DASH, xlPct(xlHasRooms ? xlVf : null, xlGf)],
            ['FF', t('kpi.FF'), xlHasRooms ? fmtA(xlFf) : DASH, xlPct(xlHasRooms ? xlFf : null, xlGf)],
            ['', '', '', ''],
            [t('kpiSection.volume'), '', t('export.colVolume'), t('export.colProportion')],
            ['GV', t('kpi.GV'), DASH, DASH],
            ['', '', '', ''],
            [t('kpiSection.din277'), '', t('export.colArea'), t('export.colProportion')],
            ['HNF 1', t('din277.1'), fmtA(xlDin['1'] || null), xlPct(xlDin['1'] || null, xlGf)],
            ['HNF 2', t('din277.2'), fmtA(xlDin['2'] || null), xlPct(xlDin['2'] || null, xlGf)],
            ['HNF 3', t('din277.3'), fmtA(xlDin['3'] || null), xlPct(xlDin['3'] || null, xlGf)],
            ['HNF 4', t('din277.4'), fmtA(xlDin['4'] || null), xlPct(xlDin['4'] || null, xlGf)],
            ['HNF 5', t('din277.5'), fmtA(xlDin['5'] || null), xlPct(xlDin['5'] || null, xlGf)],
            ['HNF 6', t('din277.6'), fmtA(xlDin['6'] || null), xlPct(xlDin['6'] || null, xlGf)],
            ['NNF 7', t('din277.7'), fmtA(xlDin['7'] || null), xlPct(xlDin['7'] || null, xlGf)],
            ['FF 8', t('din277.8'), fmtA(xlDin['8'] || null), xlPct(xlDin['8'] || null, xlGf)],
            ['VF 9', t('din277.9'), fmtA(xlDin['9'] || null), xlPct(xlDin['9'] || null, xlGf)],
            ['BUF 10', t('din277.10'), fmtA(xlDin['10'] || null), xlPct(xlDin['10'] || null, xlGf)],
            ['', '', '', ''],
            [t('kpiSection.economy'), '', t('export.value'), ''],
            ['NGF / GF', t('kpi.NGF_GF'), (xlGf && xlHasRooms) ? (xlNgf / xlGf).toFixed(2) : DASH, ''],
            ['KF / GF', t('kpi.KF_GF'), (xlGf && xlKf !== null) ? (xlKf / xlGf).toFixed(2) : DASH, ''],
            ['NF / NGF', t('kpi.NF_NGF'), (xlHasRooms && xlNgf > 0) ? (xlNf / xlNgf).toFixed(2) : DASH, ''],
            ['HNF / NGF', t('kpi.HNF_NGF'), (xlHasRooms && xlNgf > 0) ? (xlHnf / xlNgf).toFixed(2) : DASH, ''],
        ];

        // Objektübersicht rows
        if (state.entitySummary.length > 0) {
            kzRows.push(['', '', '', '']);
            kzRows.push([t('kpiSection.entitySummary'), '', t('export.colCount'), t('export.colTopLayer')]);
            for (const e of state.entitySummary) {
                const ls = e.layers.slice(0, 3).join(', ');
                const more = e.layers.length > 3 ? ' ...' : '';
                kzRows.push([e.type, '', e.count, ls + more]);
            }
        }

        const wsKz = XLSX.utils.aoa_to_sheet([
            [t('export.colAbbreviation'), t('export.colDesignation'), t('export.value'), t('export.colProportion')],
            ...kzRows
        ]);
        wsKz['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 16 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsKz, t('tab.kpi'));

        // ── Download ──
        const baseName = state.lastFile.name.replace(/\.[^.]+$/, '');
        XLSX.writeFile(wb, `${baseName}${t('export.reportSuffix')}.xlsx`);
        log(t('log.excelExported'), 'success');
    } catch (err) {
        log(t('log.excelFailed', { error: err.message }), 'error');
        console.error(err);
    }
}

export function downloadGeoJson() {
    if (!state.lastFile) { log(t('file.noFile'), 'warn'); return; }
    if (state.roomData.length === 0 && state.areaData.length === 0) {
        log(t('export.noGeoJsonData'), 'warn');
        return;
    }
    log(t('log.geoJsonCreating'));

    try {
        const features = [];

        for (const room of state.roomData) {
            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [linearizeRing(room.vertices)],
                },
                properties: {
                    featureType: 'room',
                    id: room.id,
                    name: room.aoid,
                    area_m2: room.area,
                    layer: room.layer,
                    handle: room.handle,
                    label: room.label,
                    status: room.status,
                    siaCategory: room.siaCategory,
                },
            });
        }

        for (const area of state.areaData) {
            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [linearizeRing(area.vertices)],
                },
                properties: {
                    featureType: 'area',
                    id: area.id,
                    name: area.aoid,
                    area_m2: area.area,
                    layer: area.layer,
                    handle: area.handle,
                },
            });
        }

        const geojson = { type: 'FeatureCollection', features };
        const json = JSON.stringify(geojson, null, 2);
        const blob = new Blob([json], { type: 'application/geo+json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const baseName = state.lastFile.name.replace(/\.[^.]+$/, '');
        a.download = `${baseName}_Raeume.geojson`;
        a.click();
        URL.revokeObjectURL(url);

        log(t('log.geoJsonExported', { rooms: state.roomData.length, areas: state.areaData.length }), 'success');
    } catch (err) {
        log(t('log.geoJsonFailed', { error: err.message }), 'error');
        console.error(err);
    }
}

// Convert vertices (with optional bulge arcs) to a closed GeoJSON coordinate ring
function linearizeRing(verts) {
    const coords = [];
    for (let i = 0; i < verts.length; i++) {
        const v = verts[i];
        coords.push([v.x, v.y]);
        // If this vertex has a bulge, interpolate arc to the next vertex
        if (v.bulge && v.bulge !== 0) {
            const next = verts[(i + 1) % verts.length];
            const arcPts = bulgeToPoints(v.x, v.y, next.x, next.y, v.bulge);
            // Skip first point (already added) and last (will be added as next vertex)
            for (let j = 1; j < arcPts.length - 1; j++) {
                coords.push(arcPts[j]);
            }
        }
    }
    // Close ring: first point == last point
    if (coords.length > 0) {
        coords.push([coords[0][0], coords[0][1]]);
    }
    return coords;
}

// Interpolate a bulge arc between two points into a series of [x, y] coordinates
function bulgeToPoints(x1, y1, x2, y2, bulge) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const d = Math.hypot(dx, dy);
    if (d < 1e-10) return [[x1, y1], [x2, y2]];

    const sagitta = Math.abs(bulge) * d / 2;
    const radius = ((d / 2) * (d / 2) + sagitta * sagitta) / (2 * sagitta);

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const nx = -dy / d;
    const ny = dx / d;

    const sign = bulge > 0 ? 1 : -1;
    const offset = sign * (radius - sagitta);
    const cx = mx + nx * offset;
    const cy = my + ny * offset;

    const sa = Math.atan2(y1 - cy, x1 - cx);
    const ea = Math.atan2(y2 - cy, x2 - cx);

    // Determine sweep
    let sweep = ea - sa;
    if (bulge > 0 && sweep < 0) sweep += 2 * Math.PI;
    if (bulge < 0 && sweep > 0) sweep -= 2 * Math.PI;

    const steps = Math.max(8, Math.round(Math.abs(sweep) / (Math.PI / 16)));
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const t = sa + (sweep * i) / steps;
        pts.push([cx + Math.abs(radius) * Math.cos(t), cy + Math.abs(radius) * Math.sin(t)]);
    }
    return pts;
}

export function downloadBcf() {
    log(t('export.bcfNotImplemented'), 'warn');
}
