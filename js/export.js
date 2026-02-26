// =============================================
// PDF & Excel Report Generation
// =============================================

import { state, dom } from './state.js';
import { fmtSize, fmtNum, log } from './utils.js';
import { render, zoomExtents } from './renderer.js';

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

    state.validationMode = mode;
    state.selectedRoom = null;
    state.selectedItem = null;
    zoomExtents();

    const imgData = dom.canvas.toDataURL('image/png');

    state.validationMode = prevMode;
    state.selectedRoom = prevSelectedRoom;
    state.selectedItem = prevSelectedItem;
    state.cam.x = prevCam.x;
    state.cam.y = prevCam.y;
    state.cam.zoom = prevCam.zoom;
    render();
    return imgData;
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
        const swissRed = [220, 0, 24];      // --color-swiss-red: #DC0018

        // Derived KPI data
        const ngf = state.roomData.reduce((s, r) => s + r.area, 0);
        const hasRooms = state.roomData.length > 0;
        const hasAreaPolys = state.areaData.length > 0;
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
                doc.text('Pr\u00fcfplattform Fl\u00e4chenmanagement \u2022 BBL', mx, ph - 10);
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
        // PAGE 1 — Cover: Title + Info + Summary
        // ════════════════════════════════════════════
        // Swiss red accent strip (federal identity)
        doc.setFillColor(...swissRed);
        doc.rect(0, 0, pw, 3, 'F');

        doc.setFontSize(22);
        doc.setTextColor(...dark);
        doc.setFont(undefined, 'bold');
        doc.text('Pr\u00fcfbericht', mx, 22);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...muted);
        doc.text(state.lastFile.name, mx, 30);
        doc.text('Erstellt: ' + new Date().toLocaleString('de-CH'), mx, 36);

        // Divider
        doc.setDrawColor(...blue);
        doc.setLineWidth(0.5);
        doc.line(mx, 40, mx + 30, 40);

        // Datei-Informationen
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

        // Summary metric cards (inline row)
        let y = doc.lastAutoTable.finalY + 8;
        const metrics = [
            { label: 'R\u00e4ume', value: String(state.roomData.length), color: blue },
            { label: 'Fl\u00e4chen', value: String(state.areaData.length), color: blue },
            { label: 'Fehler', value: String(state.validationErrors.length), color: state.validationErrors.length > 0 ? red : green },
        ];
        const cardW = (contentW - 6) / metrics.length;
        metrics.forEach((m, i) => {
            const cx = mx + i * (cardW + 2);
            doc.setDrawColor(...border);
            doc.setLineWidth(0.2);
            doc.roundedRect(cx, y, cardW, 16, 1.5, 1.5);
            // Accent top line on card
            doc.setFillColor(...m.color);
            doc.rect(cx + 2, y + 0.5, cardW - 4, 0.5, 'F');
            doc.setFontSize(14);
            doc.setTextColor(...m.color);
            doc.setFont(undefined, 'bold');
            doc.text(m.value, cx + cardW / 2, y + 8.5, { align: 'center' });
            doc.setFontSize(7);
            doc.setTextColor(...muted);
            doc.setFont(undefined, 'normal');
            doc.text(m.label, cx + cardW / 2, y + 13, { align: 'center' });
        });

        // Table of contents
        y += 24;
        doc.setFontSize(11);
        doc.setTextColor(...dark);
        doc.setFont(undefined, 'bold');
        doc.text('Inhalt', mx, y);
        doc.setFont(undefined, 'normal');
        y += 2;
        doc.setDrawColor(...border);
        doc.setLineWidth(0.2);
        doc.line(mx, y, mxr, y);
        y += 5;

        const tocEntries = [
            { label: '\u00dcbersicht', desc: 'Grundriss & Layer-\u00dcbersicht', page: 2 },
            { label: 'Fehlermeldungen', desc: state.validationErrors.length + ' Pr\u00fcfergebnisse', page: 3 },
            { label: 'R\u00e4ume', desc: state.roomData.length + ' R\u00e4ume mit Fl\u00e4chen', page: 4 },
            { label: 'Fl\u00e4chen', desc: state.areaData.length + ' Fl\u00e4chenpolygone', page: 5 },
            { label: 'Kennzahlen', desc: 'SIA 416 / DIN 277', page: 6 },
        ];
        tocEntries.forEach((entry) => {
            doc.setFontSize(9);
            doc.setTextColor(...blue);
            doc.setFont(undefined, 'bold');
            doc.textWithLink(entry.label, mx + 2, y, { pageNumber: entry.page });
            doc.setFont(undefined, 'normal');
            doc.setTextColor(...muted);
            doc.setFontSize(8);
            doc.text(entry.desc, mx + 48, y);
            // Dot leader
            doc.setTextColor(...border);
            const dots = '\u00B7'.repeat(40);
            const dotsW = doc.getTextWidth(dots);
            doc.text(dots, mxr - 10 - dotsW, y);
            // Page number
            doc.setTextColor(...dark);
            doc.setFontSize(9);
            doc.text(String(entry.page), mxr - 2, y, { align: 'right' });
            // Underline
            doc.setDrawColor(...zebra);
            doc.line(mx, y + 2, mxr, y + 2);
            y += 7;
        });

        // ════════════════════════════════════════════
        // PAGE 2 — Übersicht: floor plan + layers
        // ════════════════════════════════════════════
        doc.addPage();
        pageHeader('\u00dcbersicht');

        // Full floor plan screenshot (overview mode — no overlay coloring)
        const overviewImg = captureCanvasForMode('overview');
        let uy = addImage(overviewImg, 28, 110);

        uy += 6;
        uy = sectionSubtitle('Layer-\u00dcbersicht (' + state.layerInfo.length + ' Layer)', uy);
        doc.autoTable({
            ...tableBase,
            startY: uy,
            head: [['Layer', 'Objekte', 'Farbe']],
            body: state.layerInfo.map(l => [l.name, String(l.count), l.colorHex]),
            columnStyles: { 1: { cellWidth: 22, halign: 'right' }, 2: { cellWidth: 20 } },
        });

        // ════════════════════════════════════════════
        // PAGE 3 — Fehlermeldungen
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
                head: [['#', 'Schweregrad', 'Regel', 'Meldung', 'Raum']],
                body: state.validationErrors.map(e => {
                    const room = state.roomData.find(r => r.id === e.roomId);
                    return [String(e.id), e.severity === 'error' ? 'Fehler' : 'Warnung', e.ruleCode, e.message, room ? room.aoid : '-'];
                }),
                columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 22 }, 2: { cellWidth: 18 } },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        const sev = data.cell.raw;
                        if (sev === 'Fehler') data.cell.styles.textColor = red;
                        else if (sev === 'Warnung') data.cell.styles.textColor = orange;
                    }
                },
            });
        }

        // ════════════════════════════════════════════
        // PAGE 4 — Räume: image + table
        // ════════════════════════════════════════════
        doc.addPage();
        pageHeader('R\u00e4ume (' + state.roomData.length + ')');

        const roomsImg = captureCanvasForMode('rooms');
        let ry = addImage(roomsImg, 28, 95);
        ry += 5;

        if (state.roomData.length === 0) {
            doc.setFontSize(9);
            doc.setTextColor(...muted);
            doc.text('Keine R\u00e4ume erkannt.', mx, ry + 4);
        } else {
            ry = sectionSubtitle('Raumliste (' + state.roomData.length + ')', ry);
            doc.autoTable({
                ...tableBase,
                startY: ry,
                head: [['#', 'Bezeichnung', 'Fl\u00e4che (m\u00B2)', 'Layer', 'Status']],
                body: state.roomData.map(r => {
                    const st = { error: 'Fehler', warning: 'Warnung', ok: 'OK' };
                    return [String(r.id), r.aoid, fmtNum(r.area, 2), r.layer, st[r.status] || r.status];
                }),
                columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 24, halign: 'right' }, 4: { cellWidth: 16 } },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 4) {
                        const st = data.cell.raw;
                        if (st === 'Fehler') data.cell.styles.textColor = red;
                        else if (st === 'Warnung') data.cell.styles.textColor = orange;
                        else if (st === 'OK') data.cell.styles.textColor = green;
                    }
                },
            });
        }

        // ════════════════════════════════════════════
        // PAGE 5 — Flächen: image + table
        // ════════════════════════════════════════════
        doc.addPage();
        pageHeader('Fl\u00e4chen (' + state.areaData.length + ')');

        const areasImg = captureCanvasForMode('areas');
        let ay = addImage(areasImg, 28, 95);
        ay += 5;

        if (state.areaData.length === 0) {
            doc.setFontSize(9);
            doc.setTextColor(...muted);
            doc.text('Keine Fl\u00e4chenpolygone erkannt.', mx, ay + 4);
        } else {
            ay = sectionSubtitle('Fl\u00e4chenliste (' + state.areaData.length + ')', ay);
            doc.autoTable({
                ...tableBase,
                startY: ay,
                head: [['#', 'Bezeichnung', 'Fl\u00e4che (m\u00B2)', 'Layer']],
                body: state.areaData.map(a => [String(a.id), a.aoid, fmtNum(a.area, 2), a.layer]),
                columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 24, halign: 'right' } },
            });
        }

        // ════════════════════════════════════════════
        // PAGE 6 — Kennzahlen
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
                ['NF', 'Nutzfl\u00e4che', hasRooms ? fmtA(ngf) : DASH, pct(hasRooms ? ngf : null, gf)],
                ['HNF', 'Hauptnutzfl\u00e4che', DASH, DASH],
                ['NNF', 'Nebennutzfl\u00e4che', DASH, DASH],
                ['VF', 'Verkehrsfl\u00e4che', DASH, DASH],
                ['FF', 'Funktionsfl\u00e4che', DASH, DASH],
            ],
            columnStyles: kzColStyles,
        });

        // Gebäudevolumen
        kzY = doc.lastAutoTable.finalY + 6;
        kzY = sectionSubtitle('Geb\u00e4udevolumen', kzY);
        doc.autoTable({
            ...tableBase,
            startY: kzY,
            head: [['K\u00fcrzel', 'Bezeichnung', 'Volumen', 'Anteil']],
            body: [
                ['GV', 'Geb\u00e4udevolumen', DASH, DASH],
                ['GV OG', 'Geb\u00e4udevolumen Obergeschosse', DASH, DASH],
                ['GV UG', 'Geb\u00e4udevolumen Untergeschosse', DASH, DASH],
            ],
            columnStyles: kzColStyles,
        });

        // Flächen DIN 277
        kzY = doc.lastAutoTable.finalY + 6;
        kzY = sectionSubtitle('Fl\u00e4chen DIN 277', kzY);
        doc.autoTable({
            ...tableBase,
            startY: kzY,
            head: [['K\u00fcrzel', 'Bezeichnung', 'Fl\u00e4che', 'Anteil']],
            body: [
                ['HNF 1', 'Wohnen und Aufenthalt', DASH, DASH],
                ['HNF 2', 'B\u00fcroarbeit', DASH, DASH],
                ['HNF 3', 'Produktion', DASH, DASH],
                ['HNF 4', 'Lagern, Verteilen, Verkaufen', DASH, DASH],
                ['HNF 5', 'Bildung, Unterricht, Kultur', DASH, DASH],
                ['HNF 6', 'Heilen, Pflegen', DASH, DASH],
                ['NNF 7', 'Nebennutzfl\u00e4che', DASH, DASH],
                ['FF 8', 'Betriebstechnische Anlagen', DASH, DASH],
                ['VF 9', 'Verkehrserschliessung und -sicherung', DASH, DASH],
                ['BUF 10', 'Verschiedene Nutzungen', DASH, DASH],
            ],
            columnStyles: kzColStyles,
        });

        // Wirtschaftlichkeit
        kzY = doc.lastAutoTable.finalY + 6;
        kzY = sectionSubtitle('Wirtschaftlichkeitskennzahlen', kzY);
        doc.autoTable({
            ...tableBase,
            startY: kzY,
            head: [['Kennzahl', 'Bezeichnung', 'Wert']],
            body: [
                ['NGF / GF', 'Nettogeschossfl\u00e4che / Geschossfl\u00e4che', (gf && hasRooms) ? (ngf / gf).toFixed(2) : DASH],
                ['KF / GF', 'Konstruktionsfl\u00e4che / Geschossfl\u00e4che', (gf && kf !== null) ? (kf / gf).toFixed(2) : DASH],
            ],
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 22 }, 2: { halign: 'right', cellWidth: 22 } },
        });

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
        const wsInfo = XLSX.utils.aoa_to_sheet([['Eigenschaft', 'Wert'], ...infoRows]);
        wsInfo['!cols'] = [{ wch: 22 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, wsInfo, 'Info');

        // ── Sheet 2: Übersicht (layers) ──
        const layerRows = state.layerInfo.map(l => [l.name, l.count, l.colorHex]);
        const wsLayers = XLSX.utils.aoa_to_sheet([
            ['Layer', 'Anzahl Objekte', 'Farbe'],
            ...layerRows
        ]);
        wsLayers['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsLayers, '\u00dcbersicht');

        // ── Sheet 3: Fehlermeldungen ──
        const errorRows = state.validationErrors.map(e => {
            const room = state.roomData.find(r => r.id === e.roomId);
            return [e.id, e.severity === 'error' ? 'Fehler' : 'Warnung', e.ruleCode, e.message, room ? room.aoid : '-'];
        });
        const wsErrors = XLSX.utils.aoa_to_sheet([
            ['#', 'Schweregrad', 'Regel', 'Meldung', 'Raum'],
            ...errorRows
        ]);
        wsErrors['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 50 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, wsErrors, 'Fehlermeldungen');

        // ── Sheet 4: Räume ──
        const statusMap = { error: 'Fehler', warning: 'Warnung', ok: 'OK' };
        const roomRows = state.roomData.map(r => [
            r.id, r.aoid, r.area, r.layer, statusMap[r.status] || r.status,
            r.vertices.length, r.handle || '-'
        ]);
        const wsRooms = XLSX.utils.aoa_to_sheet([
            ['#', 'Bezeichnung', 'Fl\u00e4che (m\u00B2)', 'Layer', 'Status', 'Eckpunkte', 'Handle'],
            ...roomRows
        ]);
        wsRooms['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsRooms, 'R\u00e4ume');

        // ── Sheet 5: Flächen ──
        const areaRows = state.areaData.map(a => [
            a.id, a.aoid, a.area, a.layer, a.handle || '-'
        ]);
        const wsAreas = XLSX.utils.aoa_to_sheet([
            ['#', 'Bezeichnung', 'Fl\u00e4che (m\u00B2)', 'Layer', 'Handle'],
            ...areaRows
        ]);
        wsAreas['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsAreas, 'Fl\u00e4chen');

        // ── Sheet 6: Kennzahlen ──
        const ngf = state.roomData.reduce((s, r) => s + r.area, 0);
        const hasRooms = state.roomData.length > 0;
        const hasAreaPolys = state.areaData.length > 0;
        const gf = hasAreaPolys ? state.areaData.reduce((s, a) => s + a.area, 0) : null;
        const kf = (gf !== null && hasRooms) ? gf - ngf : null;

        const kzRows = [
            ['', '', '', ''],
            ['Geb\u00e4udefl\u00e4chen', '', 'Fl\u00e4che (m\u00B2)', 'Anteil'],
            ['GF', 'Geschossfl\u00e4che', fmtA(gf), gf ? '100%' : DASH],
            ['KF', 'Konstruktionsfl\u00e4che', fmtA(kf), (gf && kf !== null) ? Math.round((kf / gf) * 100) + '%' : DASH],
            ['NGF', 'Nettogeschossfl\u00e4che', hasRooms ? fmtA(ngf) : DASH, (gf && hasRooms) ? Math.round((ngf / gf) * 100) + '%' : DASH],
            ['NF', 'Nutzfl\u00e4che', hasRooms ? fmtA(ngf) : DASH, (gf && hasRooms) ? Math.round((ngf / gf) * 100) + '%' : DASH],
            ['HNF', 'Hauptnutzfl\u00e4che', DASH, DASH],
            ['NNF', 'Nebennutzfl\u00e4che', DASH, DASH],
            ['VF', 'Verkehrsfl\u00e4che', DASH, DASH],
            ['FF', 'Funktionsfl\u00e4che', DASH, DASH],
            ['', '', '', ''],
            ['Geb\u00e4udevolumen', '', 'Volumen (m\u00B3)', 'Anteil'],
            ['GV', 'Geb\u00e4udevolumen', DASH, DASH],
            ['GV OG', 'Geb\u00e4udevolumen Obergeschosse', DASH, DASH],
            ['GV UG', 'Geb\u00e4udevolumen Untergeschosse', DASH, DASH],
            ['', '', '', ''],
            ['Wirtschaftlichkeit', '', 'Wert', ''],
            ['NGF / GF', 'Nettogeschossfl\u00e4che / Geschossfl\u00e4che', (gf && hasRooms) ? (ngf / gf).toFixed(2) : DASH, ''],
            ['KF / GF', 'Konstruktionsfl\u00e4che / Geschossfl\u00e4che', (gf && kf !== null) ? (kf / gf).toFixed(2) : DASH, ''],
        ];
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
