// =============================================
// Report model: the rows the PDF and Excel exports share, built from the app state
// =============================================

import { state, CAFM_LAYER_SET, SYSTEM_LAYERS, ROOM_LAYER, AREA_LAYER } from './state.js';
import { summarizeValidation, splitRulesByOutcome } from './rules.js';
import { buildKpiSections, buildEntityRows } from './kpi.js';
import { t, getLocale } from './i18n.js';
import { fmtSize } from './utils.js';

const REPORT_LINKS = [
    ['export.linkPlatform', 'https://bbl-dres.github.io/plan-check/'],
    ['export.linkGuide', 'https://github.com/bbl-dres/plan-check/blob/main/docs/anleitung-de.md'],
    ['export.linkSource', 'https://github.com/bbl-dres/plan-check'],
    ['export.linkDownloads', 'https://www.bbl.admin.ch/de/downloads-bauten'],
    ['export.linkContact', 'https://www.bbl.admin.ch/de/kontakt'],
    ['export.linkLegal', 'https://www.admin.ch/gov/de/start/rechtliches.html'],
];

/** 'ok' for CAFM and system layers, 'unknown' for everything else. */
export function layerStatus(name) {
    return CAFM_LAYER_SET.has(name) || SYSTEM_LAYERS.has(name) ? 'ok' : 'unknown';
}

/** Locale-aware date/time for the reports (Swiss regional formats). */
export function formatDateTime(date) {
    return date.toLocaleString(getLocale() + '-CH');
}

/** File name without extension, for the report downloads. */
export function reportBaseName() {
    return (state.lastFile?.name || 'report').replace(/\.[^.]+$/, '');
}

export function buildReportModel() {
    const issues = state.validationErrors;
    return {
        fileName: state.lastFile?.name || '',
        info: [
            [t('export.fileName'), state.lastFile?.name || '-'],
            [t('export.fileSize'), state.lastFile ? fmtSize(state.lastFile.size) : '-'],
            [t('export.dwgVersion'), state.lastDbInfo?.version || '-'],
            [t('export.layerCount'), state.lastDbInfo?.layerCount ?? '-'],
            [t('export.entityCount'), state.lastDbInfo?.entityCount ?? '-'],
            [t('export.uploaded'), state.lastUploadTime ? formatDateTime(state.lastUploadTime) : '-'],
            [t('export.processingTime'), state.lastElapsed ? state.lastElapsed + ' s' : '-'],
            [t('export.roomLayer'), ROOM_LAYER],
            [t('export.areaLayer'), AREA_LAYER],
        ],
        summary: summarizeValidation(issues),
        rules: splitRulesByOutcome(issues),
        issues,
        layers: state.layerInfo.map(l => ({ ...l, status: layerStatus(l.name) })),
        rooms: state.roomData,
        areas: state.areaData,
        kpi: buildKpiSections(state.roomData, state.areaData),
        entities: buildEntityRows(state.entitySummary),
        links: REPORT_LINKS.map(([key, url]) => [t(key), url]),
    };
}
