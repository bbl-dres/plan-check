// =============================================
// Shared constants, mutable app state and DOM references
// =============================================

export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const BG_DARK = '#1a1a2e';
export const BG_LIGHT = '#ffffff';
export const MOBILE_BREAKPOINT_PX = 768; // keep in sync with the media query in styles.css

// Layer names from CAD-Richtlinie BBL V1.0 (domain identifiers, German by definition)
export const ROOM_LAYER = 'R_RAUMPOLYGON';
export const DEDUCTION_LAYER = 'R_RAUMPOLYGON-ABZUG';
export const AOID_LAYER = 'R_AOID';
export const AREA_LAYER = 'R_GESCHOSSPOLYGON';
export const FRAME_LAYER = 'V_PLANLAYOUT';
export const HATCH_LAYER = 'A_SCHRAFFUR';
export const DIMENSION_LAYER = 'V_BEMASSUNG';

const CAFM_LAYERS = {
    required: [ROOM_LAYER, AOID_LAYER, AREA_LAYER, 'A_ARCHITEKTUR', HATCH_LAYER, DIMENSION_LAYER, FRAME_LAYER],
    optional: [DEDUCTION_LAYER, 'A_ELEKTRO', 'A_HEIZUNG-KUEHLUNG', 'A_LUEFTUNG', 'A_SANITAER', 'V_ACHSEN', 'V_REFERENZPUNKT', 'V_TEXT'],
};
export const CAFM_LAYER_SET = new Set([...CAFM_LAYERS.required, ...CAFM_LAYERS.optional]);

/** AutoCAD defaults plus the layer the checking authority adds itself (R_RAUMSTEMPEL). */
export const SYSTEM_LAYERS = new Set(['0', 'Defpoints', 'R_RAUMSTEMPEL']);

/** Layers on which text entities are allowed. */
export const TEXT_LAYERS = new Set([FRAME_LAYER, 'V_ACHSEN', 'V_TEXT', AOID_LAYER]);

/** DWG $INSUNITS code → millimetres per drawing unit (unknown codes fall back to mm). */
export const INSUNITS_TO_MM = { 1: 25.4, 2: 304.8, 3: 1609344, 4: 1, 5: 10, 6: 1000, 7: 1e6, 10: 914.4, 14: 100, 15: 10000, 16: 100000 };
export const INSUNITS_MM = 4;

/** Score thresholds in percent of passed rules. */
export const SCORE_GOOD = 90;
export const SCORE_FAIR = 60;

export const SIA_COLORS = {
    HNF: { fill: 'rgba(229,115,115,0.35)', stroke: '#E57373' },
    NNF: { fill: 'rgba(255,183,77,0.35)',  stroke: '#FFB74D' },
    VF:  { fill: 'rgba(255,241,118,0.35)', stroke: '#FFF176' },
    FF:  { fill: 'rgba(100,181,246,0.35)', stroke: '#64B5F6' },
    KF:  { fill: 'rgba(204,204,204,0.35)', stroke: '#CCCCCC' },
};

export const state = {
    libredwg: null,

    // Viewer
    drawingData: null,        // { renderList, bounds, byHandle } from prepareDrawingData()
    cam: { x: 0, y: 0, zoom: 1 },
    isPanning: false,
    panStart: null,
    pinchStart: null,
    bgColor: BG_LIGHT,
    selectedItem: null,       // render item under the last click
    highlightedItems: null,   // render items of an aggregate issue
    isProcessing: false,

    // Validation results
    roomData: [],
    areaData: [],
    validationErrors: [],     // issues of both severities (errors and warnings)
    activeTab: null,          // 'rules' | 'errors' | 'overview' | 'rooms' | 'areas' | 'kpi'
    selectedPolygon: null,    // selected room or area entry
    layerInfo: [],
    resultFilter: 'all',      // 'all' | 'errors' | 'warnings'

    // Drawing facts collected while parsing (see prepareDrawingData)
    insunits: null,
    unitScale: 1,             // millimetres per drawing unit
    nonZeroZEntities: [],
    xrefBlocks: [],
    paperSpaceLayouts: [],
    paperSpaceEntityCount: 0,
    styleFontMap: {},
    dimensionInfo: [],
    entitySummary: [],

    // Visibility toggles from the side panel
    hiddenLayers: new Set(),
    hiddenRoomIds: new Set(),
    hiddenAreaIds: new Set(),

    // File metadata for the reports
    lastFile: null,
    lastDbInfo: null,
    lastElapsed: null,
    lastUploadTime: null,
};

/** Clears everything that belongs to the previously loaded drawing. */
export function resetFileState() {
    state.drawingData = null;
    state.cam = { x: 0, y: 0, zoom: 1 };
    state.selectedItem = null;
    state.highlightedItems = null;
    state.roomData = [];
    state.areaData = [];
    state.validationErrors = [];
    state.activeTab = null;
    state.selectedPolygon = null;
    state.layerInfo = [];
    state.resultFilter = 'all';
    state.insunits = null;
    state.unitScale = 1;
    state.nonZeroZEntities = [];
    state.xrefBlocks = [];
    state.paperSpaceLayouts = [];
    state.paperSpaceEntityCount = 0;
    state.styleFontMap = {};
    state.dimensionInfo = [];
    state.entitySummary = [];
    state.hiddenLayers.clear();
    state.hiddenRoomIds.clear();
    state.hiddenAreaIds.clear();
    state.lastFile = null;
    state.lastDbInfo = null;
    state.lastElapsed = null;
    state.lastUploadTime = null;
}

// DOM element references, filled once by initDom()
export const dom = {};

const DOM_IDS = {
    uploadZone: 'upload-zone',
    fileInput: 'file-input',
    selectBtn: 'select-btn',
    loadDemoBtn: 'load-demo',
    statusEl: 'status',
    canvasWrap: 'canvas-wrap',
    canvas: 'dwg-canvas',
    coordsDisplay: 'coords-display',
    scaleBar: 'scale-bar',
    scaleBarLine: 'scale-bar-line',
    scaleBarLabel: 'scale-bar-label',
    consoleLog: 'console-log',
    featurePopup: 'feature-popup',
    metricsPanel: 'metrics-panel',
    metricsGrid: 'metrics-grid',
    validationPanel: 'validation-panel',
    validationSplit: 'validation-split',
    validationDashboard: 'validation-dashboard',
    sideList: 'validation-side-list',
    sideSummary: 'validation-side-summary',
    sideSearch: 'vside-search',
    sideToggleAll: 'vside-toggle-all',
    statusFilter: 'status-filter',
    fullscreenBtn: 'fullscreen-btn',
    tabRulesCount: 'vtab-rules-count',
    tabRulesTotal: 'vtab-rules-total',
    tabLayerCount: 'vtab-layer-count',
    tabErrorCount: 'vtab-error-count',
    tabRoomCount: 'vtab-room-count',
    tabAreaCount: 'vtab-area-count',
};

/** Looks up every element once; a missing id fails at startup instead of on first use. */
export function initDom() {
    for (const [key, id] of Object.entries(DOM_IDS)) {
        const el = document.getElementById(id);
        if (!el) throw new Error(`Missing DOM element #${id}`);
        dom[key] = el;
    }
    dom.ctx = dom.canvas.getContext('2d');
}

/** True when a status ('ok' | 'warning' | 'error') passes the active result filter. */
export function matchesResultFilter(status) {
    const f = state.resultFilter;
    return f === 'all' || (f === 'errors' ? status === 'error' : status === 'warning');
}
