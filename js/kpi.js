// =============================================
// SIA 416 / DIN 277 key figures — shared by the KPI tab, PDF and Excel export
// =============================================

import { t } from './i18n.js';
import { fmtNum } from './utils.js';

export const DASH = '—';

const DIN277_GROUPS = [
    ['HNF 1', '1'], ['HNF 2', '2'], ['HNF 3', '3'], ['HNF 4', '4'], ['HNF 5', '5'],
    ['HNF 6', '6'], ['NNF 7', '7'], ['FF 8', '8'], ['VF 9', '9'], ['BUF 10', '10'],
];

/** SIA 416 totals in m². gf/kf are null without floor polygons; hasRooms guards the room-based figures. */
function computeKpis(roomData, areaData) {
    const hasRooms = roomData.length > 0;
    const hasAreaPolys = areaData.length > 0;
    const catSum = { HNF: 0, NNF: 0, VF: 0, FF: 0 };
    for (const r of roomData) {
        const cat = r.siaCategory in catSum ? r.siaCategory : 'HNF';
        catSum[cat] += r.area;
    }
    const { HNF: hnf, NNF: nnf, VF: vf, FF: ff } = catSum;
    const nf = hnf + nnf;
    const ngf = nf + vf + ff;
    const gf = hasAreaPolys ? areaData.reduce((s, a) => s + a.area, 0) : null;
    const kf = (gf !== null && hasRooms) ? gf - ngf : null;
    return { hnf, nnf, vf, ff, nf, ngf, gf, kf, hasRooms, hasAreaPolys, catSum };
}

/** Area sums per DIN 277 usage group, keyed by group number string. */
function computeDin277Sums(roomData) {
    const sums = {};
    for (const r of roomData) {
        if (r.din277) sums[r.din277] = (sums[r.din277] || 0) + r.area;
    }
    return sums;
}

/**
 * KPI tables as plain rows. Area rows: { abbr, label, value, total } in m² (null = not available).
 * Economy rows: { abbr, label, ratio } (null = not available). Consumers do the formatting.
 */
export function buildKpiSections(roomData, areaData) {
    const k = computeKpis(roomData, areaData);
    const din = computeDin277Sums(roomData);
    const ifRooms = v => (k.hasRooms ? v : null);
    const areaRow = (abbr, value) => ({ abbr, label: t('kpi.' + abbr), value, total: k.gf });
    return {
        kpis: k,
        areas: [
            areaRow('GF', k.gf),
            areaRow('KF', k.kf),
            areaRow('NGF', ifRooms(k.ngf)),
            areaRow('NF', ifRooms(k.nf)),
            areaRow('HNF', ifRooms(k.hnf)),
            areaRow('NNF', ifRooms(k.nnf)),
            areaRow('VF', ifRooms(k.vf)),
            areaRow('FF', ifRooms(k.ff)),
        ],
        volume: [{ abbr: 'GV', label: t('kpi.GV'), value: null, total: null }],
        din277: DIN277_GROUPS.map(([abbr, key]) => ({ abbr, label: t('din277.' + key), value: din[key] || null, total: k.gf })),
        economy: [
            { abbr: 'NGF / GF', label: t('kpi.NGF_GF'), ratio: (k.gf && k.hasRooms) ? k.ngf / k.gf : null },
            { abbr: 'KF / GF', label: t('kpi.KF_GF'), ratio: (k.gf && k.kf !== null) ? k.kf / k.gf : null },
            { abbr: 'NF / NGF', label: t('kpi.NF_NGF'), ratio: (k.hasRooms && k.ngf > 0) ? k.nf / k.ngf : null },
            { abbr: 'HNF / NGF', label: t('kpi.HNF_NGF'), ratio: (k.hasRooms && k.ngf > 0) ? k.hnf / k.ngf : null },
        ],
    };
}

/** Entity overview rows: { type, count, layers } with at most three layer names. */
export function buildEntityRows(entitySummary) {
    return entitySummary.map(e => ({
        type: e.type,
        count: e.count,
        layers: e.layers.slice(0, 3).join(', ') + (e.layers.length > 3 ? ' ...' : ''),
    }));
}

/** "517.1 m²" or the dash placeholder for null/zero. */
export function formatArea(v) {
    if (v == null || v === 0) return DASH;
    return fmtNum(v, Math.abs(v) >= 100 ? 0 : 1) + ' m²';
}

/** "42%" or the dash placeholder. */
export function formatShare(value, total) {
    if (value == null || value === 0 || total == null || total <= 0) return DASH;
    return Math.round((value / total) * 100) + '%';
}

export function formatRatio(ratio) {
    return ratio == null ? DASH : ratio.toFixed(2);
}
