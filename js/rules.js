// =============================================
// Rule catalogue and validation summary helpers (shared by the UI and the reports)
// =============================================

import { SCORE_GOOD, SCORE_FAIR } from './state.js';

/**
 * Every rule with its severity; `layer` marks the required-layer rules.
 * Descriptions live in the locales as rule.<code>.
 */
export const RULES = [
    { code: 'LAYER_001', severity: 'error', layer: 'R_RAUMPOLYGON' },
    { code: 'LAYER_002', severity: 'error', layer: 'R_AOID' },
    { code: 'LAYER_003', severity: 'error', layer: 'R_GESCHOSSPOLYGON' },
    { code: 'LAYER_004', severity: 'warning', layer: 'A_ARCHITEKTUR' },
    { code: 'LAYER_005', severity: 'warning', layer: 'V_PLANLAYOUT' },
    { code: 'LAYER_006', severity: 'warning', layer: 'V_BEMASSUNG' },
    { code: 'LAYER_007', severity: 'warning', layer: 'A_SCHRAFFUR' },
    { code: 'LAYER_008', severity: 'warning' },
    { code: 'POLY_001', severity: 'error' },
    { code: 'POLY_002', severity: 'error' },
    { code: 'POLY_003', severity: 'error' },
    { code: 'POLY_004', severity: 'warning' },
    { code: 'POLY_005', severity: 'warning' },
    { code: 'POLY_006', severity: 'error' },
    { code: 'POLY_007', severity: 'warning' },
    { code: 'POLY_008', severity: 'warning' },
    { code: 'GPOLY_001', severity: 'error' },
    { code: 'GPOLY_002', severity: 'error' },
    { code: 'GPOLY_003', severity: 'error' },
    { code: 'GPOLY_004', severity: 'warning' },
    { code: 'GPOLY_005', severity: 'warning' },
    { code: 'AOID_001', severity: 'error' },
    { code: 'AOID_002', severity: 'error' },
    { code: 'AOID_003', severity: 'warning' },
    { code: 'AOID_004', severity: 'warning' },
    { code: 'AOID_005', severity: 'warning' },
    { code: 'AOID_006', severity: 'warning' },
    { code: 'GEOM_001', severity: 'error' },
    { code: 'GEOM_002', severity: 'warning' },
    { code: 'GEOM_003', severity: 'error' },
    { code: 'GEOM_004', severity: 'warning' },
    { code: 'GEOM_005', severity: 'warning' },
    { code: 'TEXT_001', severity: 'warning' },
    { code: 'TEXT_002', severity: 'warning' },
    { code: 'STYLE_001', severity: 'warning' },
    { code: 'STYLE_002', severity: 'warning' },
    { code: 'LAYOUT_001', severity: 'warning' },
    { code: 'LAYOUT_002', severity: 'warning' },
    { code: 'DIM_001', severity: 'warning' },
    { code: 'HATCH_001', severity: 'warning' },
];

const RULES_BY_CODE = new Map(RULES.map(r => [r.code, r]));

/** Builds an issue; severity and category come from the catalogue so they cannot drift. */
export function createIssue(code, message, extra = {}) {
    const rule = RULES_BY_CODE.get(code);
    if (!rule) throw new Error(`Unknown rule ${code}`);
    return { code, severity: rule.severity, category: code.split('_')[0], message, ...extra };
}

/** Counts, fired rules and the score for a list of issues. */
export function summarizeValidation(issues) {
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.length - errorCount;
    const firedCodes = new Set(issues.map(i => i.code));
    const totalRules = RULES.length;
    const passedRules = totalRules - firedCodes.size;
    const score = Math.round((passedRules / totalRules) * 100);
    const scoreClass = score >= SCORE_GOOD ? 'success' : score >= SCORE_FAIR ? 'warning' : 'error';
    return { errorCount, warningCount, firedCodes, totalRules, passedRules, score, scoreClass };
}

/** Rules split into failed (errors first, then warnings, then by code) and passed, each with its issue count. */
export function splitRulesByOutcome(issues) {
    const counts = {};
    for (const issue of issues) counts[issue.code] = (counts[issue.code] || 0) + 1;
    const failed = [], passed = [];
    for (const rule of RULES) {
        const count = counts[rule.code] || 0;
        (count > 0 ? failed : passed).push({ rule, count });
    }
    failed.sort((a, b) => (a.rule.severity !== b.rule.severity)
        ? (a.rule.severity === 'error' ? -1 : 1)
        : a.rule.code.localeCompare(b.rule.code));
    return { failed, passed };
}
