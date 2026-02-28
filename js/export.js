// =============================================
// PDF & Excel Report Generation
// =============================================

import { state, dom, CAFM_LAYERS } from './state.js';
import { fmtSize, fmtNum, log } from './utils.js';
import { render, zoomExtents } from './renderer.js';
import { ALL_RULES, RULE_CAT_LABELS } from './validation.js';

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
    if (!state.lastFile) { log('Keine Datei geladen.', 'warn'); return; }
    log('PDF-Bericht wird erstellt...');
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
            doc.text('Pr\u00fcfbericht', mx, 13);
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
                const bblText = 'Bundesamt f\u00fcr Bauten und Logistik BBL';
                doc.textWithLink(bblText, mx, ph - 10, { url: 'https://www.bbl.admin.ch/' });
                const bblW = doc.getTextWidth(bblText);
                doc.text(' \u2022 ', mx + bblW, ph - 10);
                const sepW = doc.getTextWidth(' \u2022 ');
                doc.textWithLink('Pr\u00fcfplattform Fl\u00e4chenmanagement', mx + bblW + sepW, ph - 10, { url: 'https://bbl-dres.github.io/plan-check/' });
                doc.text(`Seite ${i} / ${n}`, mxr, ph - 10, { align: 'right' });
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
            doc.text(`Tab. ${tableNum} \u2014 ${text}`, mx, y);
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
        doc.text('Pr\u00fcfbericht', mx, 22);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...muted);
        doc.text(state.lastFile.name, mx, 30);
        doc.text('Erstellt: ' + new Date().toLocaleString('de-CH'), mx, 36);
        doc.setDrawColor(...blue);
        doc.setLineWidth(0.5);
        doc.line(mx, 40, mx + 30, 40);

        // Dateiinformationen
        doc.autoTable({
            ...tableBase,
            startY: 47,
            head: [['Eigenschaft', 'Wert']],
            body: [
                ['Dateiname', state.lastFile.name],
                ['Dateigr\u00f6sse', fmtSize(state.lastFile.size)],
                ['DWG-Version', state.lastDbInfo?.version || '-'],
                ['Layer', String(state.lastDbInfo?.layerCount ?? '-')],
                ['Objekte', String(state.lastDbInfo?.entityCount ?? '-')],
                ['Hochgeladen', state.lastUploadTime ? state.lastUploadTime.toLocaleString('de-CH') : '-'],
                ['Verarbeitungszeit', state.lastElapsed ? state.lastElapsed + ' s' : '-'],
                ['Raum-Layer', state.roomLayerName],
            ],
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48 } },
        });

        // Zusammenfassung — KPI cards
        let y = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(11);
        doc.setTextColor(...dark);
        doc.setFont(undefined, 'bold');
        doc.text('Zusammenfassung', mx, y);
        doc.setFont(undefined, 'normal');
        y += 2;
        doc.setDrawColor(...border);
        doc.setLineWidth(0.2);
        doc.line(mx, y, mxr, y);
        y += 5;

        const kpiCards = [
            { label: `Score (${passedRules}/${totalRules})`, value: scorePercent + '%', color: scoreColor },
            { label: 'R\u00e4ume', value: String(state.roomData.length), color: blue },
            { label: 'Fl\u00e4chen', value: String(state.areaData.length), color: blue },
            { label: 'Layer', value: String(state.layerInfo.length), color: blue },
        ];
        const kpiCards2 = [
            { label: 'NGF', value: hasRooms ? fmtNum(ngf, 1) + ' m\u00B2' : '\u2014', color: blue },
            { label: 'Fehler', value: String(errCount), color: errCount > 0 ? red : green },
            { label: 'Warnungen', value: String(warnCount), color: warnCount > 0 ? orange : green },
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
        doc.text('Links', mx, y);
        doc.setFont(undefined, 'normal');
        y += 2;
        doc.setDrawColor(...border);
        doc.setLineWidth(0.2);
        doc.line(mx, y, mxr, y);
        y += 5;

        // Full-width links (long URLs)
        const fullLinks = [
            ['Pr\u00fcfplattform', 'https://bbl-dres.github.io/plan-check/'],
            ['Anleitung und FAQ', 'https://github.com/bbl-dres/plan-check/blob/main/docs/anleitung-de.md'],
            ['Quellencode und Dokumentation', 'https://github.com/bbl-dres/plan-check'],
        ];
        for (const [label, url] of fullLinks) {
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
        // 3-column row (short URLs)
        y += 2;
        const shortLinks = [
            ['Downloads BBL Bauten', 'https://www.bbl.admin.ch/de/downloads-bauten'],
            ['Kontakt', 'https://www.bbl.admin.ch/de/kontakt'],
            ['Rechtliches', 'https://www.admin.ch/gov/de/start/rechtliches.html'],
        ];
        const linkColW = (contentW - 6) / 3;
        shortLinks.forEach(([label, url], i) => {
            const lx = mx + i * (linkColW + 3);
            doc.setFontSize(7.5);
            doc.setTextColor(...dark);
            doc.setFont(undefined, 'bold');
            doc.text(label, lx, y);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(...muted);
            doc.setFontSize(6.5);
            doc.text(url, lx, y + 3.5);
        });

        // ════════════════════════════════════════════
        // PAGE 2 — Inhaltsverzeichnis
        // ════════════════════════════════════════════
        doc.addPage();
        pageHeader('Inhaltsverzeichnis');

        const tocEntries = [
            { num: '1', label: 'Pr\u00fcfregeln', desc: ALL_RULES.length + ' Regeln gepr\u00fcft', page: 3 },
            { num: '2', label: 'Fehlermeldungen', desc: state.validationErrors.length + ' Pr\u00fcfergebnisse', page: 4 },
            { num: '3', label: 'Layer', desc: state.layerInfo.length + ' Layer erkannt', page: 5 },
            { num: '4', label: 'R\u00e4ume', desc: state.roomData.length + ' R\u00e4ume mit Fl\u00e4chen', page: 6 },
            { num: '5', label: 'Fl\u00e4chen', desc: state.areaData.length + ' Fl\u00e4chenpolygone', page: 7 },
            { num: '6', label: 'Kennzahlen', desc: 'SIA 416 / DIN 277', page: 8 },
        ];
        let ty = 34;
        tocEntries.forEach((entry) => {
            // Chapter number
            doc.setFontSize(11);
            doc.setTextColor(...blue);
            doc.setFont(undefined, 'bold');
            doc.text(entry.num, mx + 2, ty);
            // Chapter title
            doc.textWithLink(entry.label, mx + 12, ty, { pageNumber: entry.page });
            doc.setFont(undefined, 'normal');
            // Description on next line
            doc.setFontSize(8);
            doc.setTextColor(...muted);
            doc.text(entry.desc, mx + 12, ty + 5);
            // Dot leader + page number on title line
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
            // Separator line
            doc.setDrawColor(...zebra);
            doc.line(mx, ty + 8, mxr, ty + 8);
            ty += 14;
        });

        // ════════════════════════════════════════════
        // PAGE 3 — Prüfregeln
        // ════════════════════════════════════════════
        doc.addPage();

        // Compute violation counts per rule code
        const violationCounts = {};
        for (const err of state.validationErrors) {
            violationCounts[err.ruleCode] = (violationCounts[err.ruleCode] || 0) + 1;
        }

        // Split into failed and passed (matches frontend grouping)
        const pdfFailed = [];
        const pdfPassed = [];
        for (const rule of ALL_RULES) {
            const count = violationCounts[rule.code] || 0;
            if (count > 0) {
                const statusLabel = rule.sev === 'error' ? 'Fehler' : 'Warnung';
                pdfFailed.push([statusLabel, rule.code, rule.desc]);
            } else {
                pdfPassed.push(['OK', rule.code, rule.desc]);
            }
        }
        // Sort failed: errors first, then warnings
        pdfFailed.sort((a, b) => {
            const aErr = a[0].includes('Fehler') ? 0 : 1;
            const bErr = b[0].includes('Fehler') ? 0 : 1;
            return aErr !== bErr ? aErr - bErr : a[1].localeCompare(b[1]);
        });

        const passCount = pdfPassed.length;
        pageHeader('Pr\u00fcfregeln (' + passCount + '/' + ALL_RULES.length + ')');

        const rulesColStyles = { 0: { cellWidth: 20 }, 1: { fontStyle: 'bold', cellWidth: 28 } };
        const rulesDidParse = (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                const text = data.cell.raw;
                if (text.includes('OK')) data.cell.styles.textColor = green;
                else if (text.includes('Fehler')) data.cell.styles.textColor = red;
                else if (text.includes('Warnung')) data.cell.styles.textColor = orange;
            }
        };

        let pY = 28;

        // Nicht bestanden
        if (pdfFailed.length > 0) {
            pY = sectionSubtitle(`Nicht bestanden (${pdfFailed.length})`, pY);
            doc.autoTable({
                ...tableBase,
                startY: pY,
                head: [['Status', 'Regel', 'Beschreibung']],
                body: pdfFailed,
                columnStyles: rulesColStyles,
                didParseCell: rulesDidParse,
            });
            pY = doc.lastAutoTable.finalY + 8;
        }

        // Bestanden
        if (pY > ph - 30) { doc.addPage(); pageHeader('Pr\u00fcfregeln (Forts.)'); pY = 28; }
        pY = sectionSubtitle(`Bestanden (${pdfPassed.length})`, pY);
        doc.autoTable({
            ...tableBase,
            startY: pY,
            head: [['Status', 'Regel', 'Beschreibung']],
            body: pdfPassed,
            columnStyles: rulesColStyles,
            didParseCell: rulesDidParse,
        });
        tableCaption('Pr\u00fcfregeln \u2014 automatisierte Pr\u00fcfung gegen CAFM-Richtlinien');

        // ════════════════════════════════════════════
        // PAGE 4 — Fehlermeldungen
        // ════════════════════════════════════════════
        doc.addPage();
        pageHeader('Fehlermeldungen (' + state.validationErrors.length + ')');

        if (state.validationErrors.length === 0) {
            let ey = 32;
            doc.setFillColor(...successLight);
            doc.roundedRect(mx, ey, contentW, 12, 2, 2, 'F');
            doc.setFontSize(10);
            doc.setTextColor(...green);
            doc.setFont(undefined, 'bold');
            doc.text('Keine Fehlermeldungen \u2014 alle Pr\u00fcfungen bestanden.', mx + 4, ey + 7.5);
            doc.setFont(undefined, 'normal');
        } else {
            doc.autoTable({
                ...tableBase,
                startY: 28,
                head: [['#', 'Status', 'Regel', 'Meldung']],
                body: state.validationErrors.map((e, i) => {
                    return [String(i + 1), e.severity === 'error' ? 'Fehler' : 'Warnung', e.ruleCode, e.message];
                }),
                columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 20 }, 2: { cellWidth: 28 } },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        const sev = data.cell.raw;
                        if (sev === 'Fehler') data.cell.styles.textColor = red;
                        else if (sev === 'Warnung') data.cell.styles.textColor = orange;
                    }
                },
            });
            tableCaption('Fehlermeldungen \u2014 erkannte Verst\u00f6sse und Warnungen');
        }

        // ════════════════════════════════════════════
        // PAGE 5 — Layer: floor plan + layer table
        // ════════════════════════════════════════════
        doc.addPage();
        pageHeader('Layer (' + state.layerInfo.length + ')');

        const overviewImg = captureCanvasForMode('overview');
        let uy = addImage(overviewImg, 28, 110);

        uy += 8;
        uy = sectionSubtitle('Layer-\u00dcbersicht (' + state.layerInfo.length + ' Layer)', uy);
        const cafmSet = new Set(CAFM_LAYERS.all);
        const defaultLayers = new Set(['0', 'Defpoints']);
        function layerStatus(name) {
            if (cafmSet.has(name)) return 'OK';
            if (defaultLayers.has(name)) return 'OK';
            return 'Unbekannt';
        }
        doc.autoTable({
            ...tableBase,
            startY: uy,
            head: [['#', 'Status', 'Layer', 'Objekte', 'Farbe']],
            body: state.layerInfo.map((l, i) => [String(i + 1), layerStatus(l.name), l.name, String(l.count), l.colorHex]),
            columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 20 }, 3: { cellWidth: 22, halign: 'right' }, 4: { cellWidth: 20 } },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 1) {
                    data.cell.styles.textColor = data.cell.raw === 'OK' ? green : orange;
                }
            },
        });
        tableCaption('Layer \u2014 erkannte CAD-Layer mit Objektanzahl und CAFM-Status');

        // ════════════════════════════════════════════
        // PAGE 6 — Räume
        // ════════════════════════════════════════════
        doc.addPage();
        pageHeader('R\u00e4ume (' + state.roomData.length + ')');

        const roomsImg = captureCanvasForMode('rooms');
        let ry = addImage(roomsImg, 28, 95);
        ry += 8;

        if (state.roomData.length === 0) {
            doc.setFontSize(9);
            doc.setTextColor(...muted);
            doc.text('Keine R\u00e4ume erkannt.', mx, ry + 4);
        } else {
            ry = sectionSubtitle('Raumliste (' + state.roomData.length + ')', ry);
            doc.autoTable({
                ...tableBase,
                startY: ry,
                head: [['#', 'Status', 'ID', 'Bezeichnung', 'Fl\u00e4che (m\u00B2)', 'Layer']],
                body: state.roomData.map((r, i) => {
                    const st = { error: 'Fehler', warning: 'Warnung', ok: 'OK' };
                    return [String(i + 1), st[r.status] || r.status, String(r.id), r.aoid, fmtNum(r.area, 2), r.layer];
                }),
                columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 20 }, 2: { cellWidth: 14 }, 4: { cellWidth: 24, halign: 'right' } },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        const st = data.cell.raw;
                        if (st === 'Fehler') data.cell.styles.textColor = red;
                        else if (st === 'Warnung') data.cell.styles.textColor = orange;
                        else if (st === 'OK') data.cell.styles.textColor = green;
                    }
                },
            });
            tableCaption('R\u00e4ume \u2014 Raumpolygone mit Fl\u00e4chenangaben (R_RAUMPOLYGON)');
        }

        // ════════════════════════════════════════════
        // PAGE 7 — Flächen
        // ════════════════════════════════════════════
        doc.addPage();
        pageHeader('Fl\u00e4chen (' + state.areaData.length + ')');

        const areasImg = captureCanvasForMode('areas');
        let ay = addImage(areasImg, 28, 95);
        ay += 8;

        if (state.areaData.length === 0) {
            doc.setFontSize(9);
            doc.setTextColor(...muted);
            doc.text('Keine Fl\u00e4chenpolygone erkannt.', mx, ay + 4);
        } else {
            ay = sectionSubtitle('Fl\u00e4chenliste (' + state.areaData.length + ')', ay);
            const ast = { error: 'Fehler', warning: 'Warnung', ok: 'OK' };
            doc.autoTable({
                ...tableBase,
                startY: ay,
                head: [['#', 'Status', 'ID', 'Bezeichnung', 'Fl\u00e4che (m\u00B2)', 'Layer']],
                body: state.areaData.map((a, i) => [String(i + 1), ast[a.status] || a.status, String(a.id), a.aoid, fmtNum(a.area, 2), a.layer]),
                columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 20 }, 2: { cellWidth: 14 }, 4: { cellWidth: 24, halign: 'right' } },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        const st = data.cell.raw;
                        if (st === 'Fehler') data.cell.styles.textColor = red;
                        else if (st === 'Warnung') data.cell.styles.textColor = orange;
                        else if (st === 'OK') data.cell.styles.textColor = green;
                    }
                },
            });
            tableCaption('Fl\u00e4chen \u2014 Geschossfl\u00e4chenpolygone (R_GESCHOSSPOLYGON)');
        }

        // ════════════════════════════════════════════
        // PAGE 8 — Kennzahlen
        // ════════════════════════════════════════════
        doc.addPage();
        pageHeader('Kennzahlen');

        const pct = (v, total) => {
            if (v === null || v === undefined || total === null || total === undefined || total <= 0) return DASH;
            return Math.round((v / total) * 100) + '%';
        };

        // Gebäudeflächen
        let kzY = sectionSubtitle('Geb\u00e4udefl\u00e4chen', 30);
        doc.autoTable({
            ...tableBase,
            startY: kzY,
            head: [['K\u00fcrzel', 'Bezeichnung', 'Fl\u00e4che', 'Anteil']],
            body: [
                ['GF', 'Geschossfl\u00e4che', fmtA(gf), pct(gf, gf)],
                ['KF', 'Konstruktionsfl\u00e4che', fmtA(kf), pct(kf, gf)],
                ['NGF', 'Nettogeschossfl\u00e4che', hasRooms ? fmtA(ngf) : DASH, pct(hasRooms ? ngf : null, gf)],
                ['NF', 'Nutzfl\u00e4che', hasRooms ? fmtA(nf) : DASH, pct(hasRooms ? nf : null, gf)],
                ['HNF', 'Hauptnutzfl\u00e4che', hasRooms ? fmtA(hnf) : DASH, pct(hasRooms ? hnf : null, gf)],
                ['NNF', 'Nebennutzfl\u00e4che', hasRooms ? fmtA(nnf) : DASH, pct(hasRooms ? nnf : null, gf)],
                ['VF', 'Verkehrsfl\u00e4che', hasRooms ? fmtA(vf) : DASH, pct(hasRooms ? vf : null, gf)],
                ['FF', 'Funktionsfl\u00e4che', hasRooms ? fmtA(ff) : DASH, pct(hasRooms ? ff : null, gf)],
            ],
            columnStyles: kzColStyles,
        });
        tableCaption('Geb\u00e4udefl\u00e4chen nach SIA 416');

        // Gebäudevolumen
        kzY = doc.lastAutoTable.finalY + 10;
        kzY = sectionSubtitle('Geb\u00e4udevolumen', kzY);
        doc.autoTable({
            ...tableBase,
            startY: kzY,
            head: [['K\u00fcrzel', 'Bezeichnung', 'Volumen', 'Anteil']],
            body: [
                ['GV', 'Geb\u00e4udevolumen', DASH, DASH],
            ],
            columnStyles: kzColStyles,
        });
        tableCaption('Geb\u00e4udevolumen nach SIA 416');

        // Flächen DIN 277 — sub-category sums (matches frontend)
        const din277Sum = {};
        for (const r of state.roomData) {
            const sub = r.din277 || null;
            if (sub) din277Sum[sub] = (din277Sum[sub] || 0) + r.area;
        }
        kzY = doc.lastAutoTable.finalY + 10;
        kzY = sectionSubtitle('Fl\u00e4chen DIN 277', kzY);
        doc.autoTable({
            ...tableBase,
            startY: kzY,
            head: [['K\u00fcrzel', 'Bezeichnung', 'Fl\u00e4che', 'Anteil']],
            body: [
                ['HNF 1', 'Wohnen und Aufenthalt', fmtA(din277Sum['1'] || null), pct(din277Sum['1'] || null, gf)],
                ['HNF 2', 'B\u00fcroarbeit', fmtA(din277Sum['2'] || null), pct(din277Sum['2'] || null, gf)],
                ['HNF 3', 'Produktion', fmtA(din277Sum['3'] || null), pct(din277Sum['3'] || null, gf)],
                ['HNF 4', 'Lagern, Verteilen, Verkaufen', fmtA(din277Sum['4'] || null), pct(din277Sum['4'] || null, gf)],
                ['HNF 5', 'Bildung, Unterricht, Kultur', fmtA(din277Sum['5'] || null), pct(din277Sum['5'] || null, gf)],
                ['HNF 6', 'Heilen, Pflegen', fmtA(din277Sum['6'] || null), pct(din277Sum['6'] || null, gf)],
                ['NNF 7', 'Sonstige Nutzungen', fmtA(din277Sum['7'] || null), pct(din277Sum['7'] || null, gf)],
                ['FF 8', 'Betriebstechnische Anlagen', fmtA(din277Sum['8'] || null), pct(din277Sum['8'] || null, gf)],
                ['VF 9', 'Verkehrserschliessung und -sicherung', fmtA(din277Sum['9'] || null), pct(din277Sum['9'] || null, gf)],
                ['BUF 10', 'Verschiedene Nutzungen', fmtA(din277Sum['10'] || null), pct(din277Sum['10'] || null, gf)],
            ],
            columnStyles: kzColStyles,
        });
        tableCaption('Fl\u00e4chen nach DIN 277 Nutzungsgruppen');

        // Wirtschaftlichkeit
        kzY = doc.lastAutoTable.finalY + 10;
        kzY = sectionSubtitle('Wirtschaftlichkeitskennzahlen', kzY);
        doc.autoTable({
            ...tableBase,
            startY: kzY,
            head: [['Kennzahl', 'Bezeichnung', 'Wert']],
            body: [
                ['NGF / GF', 'Nettogeschossfl\u00e4che / Geschossfl\u00e4che', (gf && hasRooms) ? (ngf / gf).toFixed(2) : DASH],
                ['KF / GF', 'Konstruktionsfl\u00e4che / Geschossfl\u00e4che', (gf && kf !== null) ? (kf / gf).toFixed(2) : DASH],
                ['NF / NGF', 'Nutzfl\u00e4che / Nettogeschossfl\u00e4che', (hasRooms && ngf > 0) ? (nf / ngf).toFixed(2) : DASH],
                ['HNF / NGF', 'Hauptnutzfl\u00e4che / Nettogeschossfl\u00e4che', (hasRooms && ngf > 0) ? (hnf / ngf).toFixed(2) : DASH],
            ],
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 22 }, 2: { halign: 'right', cellWidth: 22 } },
        });
        tableCaption('Wirtschaftlichkeitskennzahlen');

        // Objektübersicht
        if (state.entitySummary.length > 0) {
            kzY = doc.lastAutoTable.finalY + 10;
            kzY = sectionSubtitle('Objekt\u00fcbersicht', kzY);
            doc.autoTable({
                ...tableBase,
                startY: kzY,
                head: [['Typ', 'Anzahl', 'Top-Layer']],
                body: state.entitySummary.map(e => {
                    const ls = e.layers.slice(0, 3).join(', ');
                    const more = e.layers.length > 3 ? ' ...' : '';
                    return [e.type, String(e.count), ls + more];
                }),
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 1: { cellWidth: 16, halign: 'right' } },
            });
            tableCaption('Objekt\u00fcbersicht \u2014 CAD-Entit\u00e4ten nach Typ');
        }

        // ── Footers ──
        pageFooter();

        // ── Download ──
        const baseName = state.lastFile.name.replace(/\.[^.]+$/, '');
        doc.save(`${baseName}_Bericht.pdf`);
        log('PDF-Bericht exportiert.', 'success');
    } catch (err) {
        log('PDF-Export fehlgeschlagen: ' + err.message, 'error');
        console.error(err);
    }
}

export async function downloadExcelReport() {
    if (!state.lastFile) { log('Keine Datei geladen.', 'warn'); return; }
    log('Excel-Bericht wird erstellt...');
    try {
        const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
        const wb = XLSX.utils.book_new();
        const DASH = '\u2014';
        const fmtA = (v) => (v === null || v === undefined) ? DASH : +v.toFixed(2);

        // ── Sheet 1: Info ──
        const infoRows = [
            ['Dateiname', state.lastFile.name],
            ['Dateigr\u00f6sse', fmtSize(state.lastFile.size)],
            ['DWG-Version', state.lastDbInfo?.version || '-'],
            ['Layer', state.lastDbInfo?.layerCount ?? '-'],
            ['Objekte', state.lastDbInfo?.entityCount ?? '-'],
            ['Hochgeladen', state.lastUploadTime ? state.lastUploadTime.toLocaleString('de-CH') : '-'],
            ['Verarbeitungszeit', state.lastElapsed ? state.lastElapsed + ' s' : '-'],
            ['Raum-Layer', state.roomLayerName],
            ['R\u00e4ume erkannt', state.roomData.length],
            ['Fl\u00e4chen erkannt', state.areaData.length],
            ['Fehlermeldungen', state.validationErrors.length],
        ];
        // Add URLs
        infoRows.push(['', '']);
        infoRows.push(['Pr\u00fcfplattform', 'https://bbl-dres.github.io/plan-check/']);
        infoRows.push(['Anleitung und FAQ', 'https://github.com/bbl-dres/plan-check/blob/main/docs/anleitung-de.md']);
        infoRows.push(['Quellencode und Dokumentation', 'https://github.com/bbl-dres/plan-check']);
        infoRows.push(['Downloads BBL Bauten', 'https://www.bbl.admin.ch/de/downloads-bauten']);
        infoRows.push(['Kontakt', 'https://www.bbl.admin.ch/de/kontakt']);
        infoRows.push(['Rechtliches', 'https://www.admin.ch/gov/de/start/rechtliches.html']);

        const wsInfo = XLSX.utils.aoa_to_sheet([['Eigenschaft', 'Wert'], ...infoRows]);
        wsInfo['!cols'] = [{ wch: 30 }, { wch: 65 }];
        XLSX.utils.book_append_sheet(wb, wsInfo, 'Info');

        // ── Sheet 2: Prüfregeln ──
        const xlViolationCounts = {};
        for (const err of state.validationErrors) {
            xlViolationCounts[err.ruleCode] = (xlViolationCounts[err.ruleCode] || 0) + 1;
        }
        // Sort: failed first (errors, then warnings), then passed — matches frontend/PDF
        const xlFailed = [];
        const xlPassed = [];
        for (const rule of ALL_RULES) {
            const count = xlViolationCounts[rule.code] || 0;
            const status = count === 0 ? 'Bestanden' : (rule.sev === 'error' ? 'Fehler' : 'Warnung');
            const row = [status, rule.code, rule.desc, count];
            if (count > 0) xlFailed.push(row);
            else xlPassed.push(row);
        }
        xlFailed.sort((a, b) => {
            if (a[0] !== b[0]) return a[0] === 'Fehler' ? -1 : 1;
            return a[1].localeCompare(b[1]);
        });
        const rulesRows = [...xlFailed, ...xlPassed];
        const wsRules = XLSX.utils.aoa_to_sheet([
            ['Status', 'Regel', 'Beschreibung', 'Verst\u00f6sse'],
            ...rulesRows
        ]);
        wsRules['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 50 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsRules, 'Pr\u00fcfregeln');

        // ── Sheet 3: Fehlermeldungen ──
        const errorRows = state.validationErrors.map((e, i) => {
            return [i + 1, e.severity === 'error' ? 'Fehler' : 'Warnung', e.ruleCode, e.message];
        });
        const wsErrors = XLSX.utils.aoa_to_sheet([
            ['#', 'Status', 'Regel', 'Meldung'],
            ...errorRows
        ]);
        wsErrors['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 50 }];
        XLSX.utils.book_append_sheet(wb, wsErrors, 'Fehlermeldungen');

        // ── Sheet 4: Layer ──
        const xlCafmSet = new Set(CAFM_LAYERS.all);
        const xlDefaultLayers = new Set(['0', 'Defpoints']);
        const layerRows = state.layerInfo.map((l, i) => {
            const st = xlCafmSet.has(l.name) || xlDefaultLayers.has(l.name) ? 'OK' : 'Unbekannt';
            return [i + 1, st, l.name, l.count, l.colorHex];
        });
        const wsLayers = XLSX.utils.aoa_to_sheet([
            ['#', 'Status', 'Layer', 'Anzahl Objekte', 'Farbe'],
            ...layerRows
        ]);
        wsLayers['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 30 }, { wch: 18 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsLayers, 'Layer');

        // ── Sheet 5: Räume ──
        const statusMap = { error: 'Fehler', warning: 'Warnung', ok: 'OK' };
        const roomRows = state.roomData.map((r, i) => [
            i + 1, statusMap[r.status] || r.status, r.id, r.aoid, r.area, r.layer,
            r.vertices.length, r.handle || '-'
        ]);
        const wsRooms = XLSX.utils.aoa_to_sheet([
            ['#', 'Status', 'ID', 'Bezeichnung', 'Fl\u00e4che (m\u00B2)', 'Layer', 'Eckpunkte', 'Handle'],
            ...roomRows
        ]);
        wsRooms['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsRooms, 'R\u00e4ume');

        // ── Sheet 6: Flächen ──
        const xlAreaSt = { error: 'Fehler', warning: 'Warnung', ok: 'OK' };
        const areaRows = state.areaData.map((a, i) => [
            i + 1, xlAreaSt[a.status] || a.status, a.id, a.aoid, a.area, a.layer, a.handle || '-'
        ]);
        const wsAreas = XLSX.utils.aoa_to_sheet([
            ['#', 'Status', 'ID', 'Bezeichnung', 'Fl\u00e4che (m\u00B2)', 'Layer', 'Handle'],
            ...areaRows
        ]);
        wsAreas['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsAreas, 'Fl\u00e4chen');

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
            ['Geb\u00e4udefl\u00e4chen', '', 'Fl\u00e4che (m\u00B2)', 'Anteil'],
            ['GF', 'Geschossfl\u00e4che', fmtA(xlGf), xlPct(xlGf, xlGf)],
            ['KF', 'Konstruktionsfl\u00e4che', fmtA(xlKf), xlPct(xlKf, xlGf)],
            ['NGF', 'Nettogeschossfl\u00e4che', xlHasRooms ? fmtA(xlNgf) : DASH, xlPct(xlHasRooms ? xlNgf : null, xlGf)],
            ['NF', 'Nutzfl\u00e4che', xlHasRooms ? fmtA(xlNf) : DASH, xlPct(xlHasRooms ? xlNf : null, xlGf)],
            ['HNF', 'Hauptnutzfl\u00e4che', xlHasRooms ? fmtA(xlHnf) : DASH, xlPct(xlHasRooms ? xlHnf : null, xlGf)],
            ['NNF', 'Nebennutzfl\u00e4che', xlHasRooms ? fmtA(xlNnf) : DASH, xlPct(xlHasRooms ? xlNnf : null, xlGf)],
            ['VF', 'Verkehrsfl\u00e4che', xlHasRooms ? fmtA(xlVf) : DASH, xlPct(xlHasRooms ? xlVf : null, xlGf)],
            ['FF', 'Funktionsfl\u00e4che', xlHasRooms ? fmtA(xlFf) : DASH, xlPct(xlHasRooms ? xlFf : null, xlGf)],
            ['', '', '', ''],
            ['Geb\u00e4udevolumen', '', 'Volumen (m\u00B3)', 'Anteil'],
            ['GV', 'Geb\u00e4udevolumen', DASH, DASH],
            ['', '', '', ''],
            ['Fl\u00e4chen DIN 277', '', 'Fl\u00e4che (m\u00B2)', 'Anteil'],
            ['HNF 1', 'Wohnen und Aufenthalt', fmtA(xlDin['1'] || null), xlPct(xlDin['1'] || null, xlGf)],
            ['HNF 2', 'B\u00fcroarbeit', fmtA(xlDin['2'] || null), xlPct(xlDin['2'] || null, xlGf)],
            ['HNF 3', 'Produktion', fmtA(xlDin['3'] || null), xlPct(xlDin['3'] || null, xlGf)],
            ['HNF 4', 'Lagern, Verteilen, Verkaufen', fmtA(xlDin['4'] || null), xlPct(xlDin['4'] || null, xlGf)],
            ['HNF 5', 'Bildung, Unterricht, Kultur', fmtA(xlDin['5'] || null), xlPct(xlDin['5'] || null, xlGf)],
            ['HNF 6', 'Heilen, Pflegen', fmtA(xlDin['6'] || null), xlPct(xlDin['6'] || null, xlGf)],
            ['NNF 7', 'Sonstige Nutzungen', fmtA(xlDin['7'] || null), xlPct(xlDin['7'] || null, xlGf)],
            ['FF 8', 'Betriebstechnische Anlagen', fmtA(xlDin['8'] || null), xlPct(xlDin['8'] || null, xlGf)],
            ['VF 9', 'Verkehrserschliessung und -sicherung', fmtA(xlDin['9'] || null), xlPct(xlDin['9'] || null, xlGf)],
            ['BUF 10', 'Verschiedene Nutzungen', fmtA(xlDin['10'] || null), xlPct(xlDin['10'] || null, xlGf)],
            ['', '', '', ''],
            ['Wirtschaftlichkeit', '', 'Wert', ''],
            ['NGF / GF', 'Nettogeschossfl\u00e4che / Geschossfl\u00e4che', (xlGf && xlHasRooms) ? (xlNgf / xlGf).toFixed(2) : DASH, ''],
            ['KF / GF', 'Konstruktionsfl\u00e4che / Geschossfl\u00e4che', (xlGf && xlKf !== null) ? (xlKf / xlGf).toFixed(2) : DASH, ''],
            ['NF / NGF', 'Nutzfl\u00e4che / Nettogeschossfl\u00e4che', (xlHasRooms && xlNgf > 0) ? (xlNf / xlNgf).toFixed(2) : DASH, ''],
            ['HNF / NGF', 'Hauptnutzfl\u00e4che / Nettogeschossfl\u00e4che', (xlHasRooms && xlNgf > 0) ? (xlHnf / xlNgf).toFixed(2) : DASH, ''],
        ];

        // Objektübersicht rows
        if (state.entitySummary.length > 0) {
            kzRows.push(['', '', '', '']);
            kzRows.push(['Objekt\u00fcbersicht', '', 'Anzahl', 'Top-Layer']);
            for (const e of state.entitySummary) {
                const ls = e.layers.slice(0, 3).join(', ');
                const more = e.layers.length > 3 ? ' ...' : '';
                kzRows.push([e.type, '', e.count, ls + more]);
            }
        }

        const wsKz = XLSX.utils.aoa_to_sheet([
            ['K\u00fcrzel', 'Bezeichnung', 'Wert', 'Anteil'],
            ...kzRows
        ]);
        wsKz['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 16 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsKz, 'Kennzahlen');

        // ── Download ──
        const baseName = state.lastFile.name.replace(/\.[^.]+$/, '');
        XLSX.writeFile(wb, `${baseName}_Bericht.xlsx`);
        log('Excel-Bericht exportiert.', 'success');
    } catch (err) {
        log('Excel-Export fehlgeschlagen: ' + err.message, 'error');
        console.error(err);
    }
}

export function downloadGeoJson() {
    if (!state.lastFile) { log('Keine Datei geladen.', 'warn'); return; }
    if (state.roomData.length === 0 && state.areaData.length === 0) {
        log('Keine R\u00e4ume oder Fl\u00e4chen f\u00fcr GeoJSON-Export vorhanden.', 'warn');
        return;
    }
    log('GeoJSON wird erstellt...');

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

        log(`GeoJSON exportiert: ${state.roomData.length} R\u00e4ume, ${state.areaData.length} Fl\u00e4chen.`, 'success');
    } catch (err) {
        log('GeoJSON-Export fehlgeschlagen: ' + err.message, 'error');
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
    log('BCF Export (noch nicht implementiert)', 'warn');
}
