// =============================================
// Shared State, Constants & DOM References
// =============================================

export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const BG_DARK = '#1a1a2e';
export const BG_LIGHT = '#ffffff';

// CAD-Richtlinie BBL V1.0 — CAFM Layer definitions
export const CAFM_LAYERS = {
    required: ['R_RAUMPOLYGON', 'R_AOID', 'R_GESCHOSSPOLYGON', 'A_ARCHITEKTUR', 'A_SCHRAFFUR', 'V_BEMASSUNG', 'V_PLANLAYOUT'],
    optional: ['R_RAUMPOLYGON-ABZUG', 'A_ELEKTRO', 'A_HEIZUNG-KUEHLUNG', 'A_LUEFTUNG', 'A_SANITAER', 'V_ACHSEN', 'V_REFERENZPUNKT', 'V_TEXT'],
    get all() { return [...this.required, ...this.optional]; },
    requiredR: ['R_RAUMPOLYGON', 'R_AOID', 'R_GESCHOSSPOLYGON'],
};

export const AOID_TEXT_LAYERS = ['V_PLANLAYOUT', 'V_ACHSEN', 'V_TEXT', 'R_AOID'];

export const SIA_COLORS = {
    HNF: { fill: 'rgba(229,115,115,0.35)', stroke: '#E57373', hex: '#E57373', label: 'Hauptnutzfläche' },
    NNF: { fill: 'rgba(255,183,77,0.35)',  stroke: '#FFB74D', hex: '#FFB74D', label: 'Nebennutzfläche' },
    VF:  { fill: 'rgba(255,241,118,0.35)', stroke: '#FFF176', hex: '#FFF176', label: 'Verkehrsfläche' },
    FF:  { fill: 'rgba(100,181,246,0.35)', stroke: '#64B5F6', hex: '#64B5F6', label: 'Funktionsfläche' },
    KF:  { fill: 'rgba(204,204,204,0.35)', stroke: '#CCCCCC', hex: '#CCCCCC', label: 'Konstruktionsfläche' },
};

export const ACI = {
    0:'#000000', 1:'#FF0000', 2:'#FFFF00', 3:'#00FF00', 4:'#00FFFF',
    5:'#0000FF', 6:'#FF00FF', 7:'#FFFFFF', 8:'#808080', 9:'#C0C0C0',
    10:'#FF0000', 11:'#FF7F7F', 12:'#CC0000', 20:'#FF3F00', 21:'#FF9F7F',
    30:'#FF7F00', 31:'#FFBF7F', 40:'#FFBF00', 41:'#FFDF7F', 50:'#FFFF00',
    51:'#FFFF7F', 60:'#BFFF00', 70:'#7FFF00', 80:'#3FFF00', 90:'#00FF00',
    100:'#00FF3F', 110:'#00FF7F', 120:'#00FFBF', 130:'#00FFFF',
    140:'#00BFFF', 150:'#007FFF', 160:'#003FFF', 170:'#0000FF',
    180:'#3F00FF', 190:'#7F00FF', 200:'#BF00FF', 210:'#FF00FF',
    220:'#FF007F', 230:'#FF003F', 240:'#FF0000', 250:'#4C4C4C',
    251:'#808080', 252:'#A0A0A0', 253:'#C0C0C0', 254:'#E0E0E0',
    255:'#FFFFFF', 256:'#CCCCCC'
};

// Mutable shared state
export const state = {
    libredwg: null,
    drawingData: null,
    cam: { x: 0, y: 0, zoom: 1 },
    isPanning: false,
    panStart: { x: 0, y: 0 },
    pinchStart: null,
    bgColor: BG_LIGHT,
    selectedItem: null,
    highlightedItems: null,

    // Validation
    roomData: [],
    areaData: [],
    validationErrors: [],
    validationMode: null,
    selectedRoom: null,
    roomLayerName: 'R_RAUMPOLYGON',
    tabFilterLayers: null,
    layerInfo: [],
    resultFilter: 'all',
    validationAborted: false,
    abortReason: null,

    // Parser-enriched data (populated by dwg-processing.js)
    insunits: null,
    nonZeroZEntities: [],
    xrefBlocks: [],
    paperSpaceLayouts: [],
    styleFontMap: {},
    dimensionInfo: [],

    // Hidden sets
    hiddenLayers: new Set(),
    hiddenRoomIds: new Set(),
    hiddenAreaIds: new Set(),
    hiddenErrorIds: new Set(),

    // Entity summary (for Kennzahlen tab)
    entitySummary: [],

    // File metadata (for export)
    lastFile: null,
    lastDbInfo: null,
    lastElapsed: null,
    lastUploadTime: null,
};

// DOM element references (initialized once by app.js)
export const dom = {
    uploadZone: null,
    fileInput: null,
    selectBtn: null,
    statusEl: null,
    canvasWrap: null,
    canvas: null,
    ctx: null,
    coordsDisplay: null,
    consoleLog: null,
    featurePopup: null,
    metricsPanel: null,
    metricsGrid: null,
    validationPanel: null,
    validationSplit: null,
    validationDashboard: null,
    vsideList: null,
    vsideSummary: null,
    vsideSearch: null,
    vsideToggleAll: null,
    // Tab count badge elements
    vtabRulesCount: null,
    vtabRulesTotal: null,
    vtabLayerCount: null,
    vtabErrorCount: null,
    vtabRoomCount: null,
    vtabAreaCount: null,
};

export function initDom() {
    dom.uploadZone = document.getElementById('upload-zone');
    dom.fileInput = document.getElementById('file-input');
    dom.selectBtn = document.getElementById('select-btn');
    dom.statusEl = document.getElementById('status');
    dom.canvasWrap = document.getElementById('canvas-wrap');
    dom.canvas = document.getElementById('dwg-canvas');
    dom.ctx = dom.canvas.getContext('2d');
    dom.coordsDisplay = document.getElementById('coords-display');
    dom.consoleLog = document.getElementById('console-log');
    dom.featurePopup = document.getElementById('feature-popup');
    dom.metricsPanel = document.getElementById('metrics-panel');
    dom.metricsGrid = document.getElementById('metrics-grid');
    dom.validationPanel = document.getElementById('validation-panel');
    dom.validationSplit = document.getElementById('validation-split');
    dom.validationDashboard = document.getElementById('validation-dashboard');
    dom.vsideList = document.getElementById('validation-side-list');
    dom.vsideSummary = document.getElementById('validation-side-summary');
    dom.vsideSearch = document.getElementById('vside-search');
    dom.vsideToggleAll = document.getElementById('vside-toggle-all');
    dom.vtabRulesCount = document.getElementById('vtab-rules-count');
    dom.vtabRulesTotal = document.getElementById('vtab-rules-total');
    dom.vtabLayerCount = document.getElementById('vtab-layer-count');
    dom.vtabErrorCount = document.getElementById('vtab-error-count');
    dom.vtabRoomCount = document.getElementById('vtab-room-count');
    dom.vtabAreaCount = document.getElementById('vtab-area-count');
}
