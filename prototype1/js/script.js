// ========================================
// BBL Plan-Check Area Management
// Main JavaScript
// ========================================

// === CONFIGURATION ===
const CONFIG = {
    TOAST_DURATION_MS: 3000,
    STEP_COUNT: 4,
    BYTES_PER_KB: 1024,
    // File size limits in bytes
    MAX_IMAGE_SIZE: 10 * 1024 * 1024,      // 10 MB for project images
    MAX_DWG_SIZE: 50 * 1024 * 1024,        // 50 MB for DWG files
    MAX_EXCEL_SIZE: 10 * 1024 * 1024,      // 10 MB for Excel files
    // UI constants
    DONUT_CHART_RADIUS: 40,
    SEARCH_DEBOUNCE_MS: 300,
    RIPPLE_ANIMATION_MS: 600,
    // Score thresholds for status colors
    SCORE_SUCCESS_THRESHOLD: 90,
    SCORE_WARNING_THRESHOLD: 60,
    // Step 2 simulated Excel errors (for mock data)
    MAX_EXCEL_ERRORS_SHOWN: 3
};

const BUILDING_TYPE_OPTIONS = [
    { value: 'Verwaltungsgebäude', label: 'Verwaltungsgebäude' },
    { value: 'Bildungsgebäude', label: 'Bildungsgebäude' },
    { value: 'Forschungsgebäude', label: 'Forschungsgebäude' },
    { value: 'Dienstleistungsgebäude', label: 'Dienstleistungsgebäude' },
    { value: 'Wohngebäude', label: 'Wohngebäude' },
    { value: 'Lagergebäude', label: 'Lagergebäude' },
    { value: 'Produktionsgebäude', label: 'Produktionsgebäude' }
];

// === SECURITY UTILITIES ===

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Sanitizes a filename for display
 * @param {string} filename - The filename to sanitize
 * @returns {string} The sanitized filename
 */
function sanitizeFilename(filename) {
    if (!filename) return '';
    // Remove path traversal sequences and dangerous characters
    return escapeHtml(
        filename
            .replace(/\.{2,}/g, '_')        // Replace .. sequences (path traversal)
            .replace(/[<>:"/\\|?*]/g, '_')  // Replace dangerous characters
    );
}

// === ERROR HANDLING UTILITIES ===

/**
 * Wraps a function with try-catch error handling
 * @param {Function} fn - The function to wrap
 * @param {string} context - Context for error logging
 * @returns {Function} The wrapped function
 */
function withErrorHandling(fn, context) {
    return function(...args) {
        try {
            return fn.apply(this, args);
        } catch (error) {
            console.error(`[${context}] Error:`, error);
            showToast(I18n.t('toast.errorOccurred', { context: context }), 'error');
        }
    };
}

/**
 * Safely queries a DOM element with error handling
 * @param {string} selector - The CSS selector
 * @param {Element} [parent=document] - Parent element to search within
 * @returns {Element|null} The found element or null
 */
function safeQuerySelector(selector, parent = document) {
    try {
        return parent.querySelector(selector);
    } catch (error) {
        console.error(`[DOM] Invalid selector: ${selector}`, error);
        return null;
    }
}

/**
 * Safely gets an element by ID with validation
 * @param {string} id - The element ID
 * @returns {Element|null} The found element or null
 */
function safeGetElementById(id) {
    if (!id || typeof id !== 'string') {
        console.warn('[DOM] Invalid element ID provided');
        return null;
    }
    return document.getElementById(id);
}

/**
 * Safely parses an integer with fallback
 * @param {string} value - The string to parse
 * @param {number} [fallback=0] - Fallback value if parsing fails
 * @returns {number} The parsed integer or fallback
 */
function safeParseInt(value, fallback = 0) {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
}

/**
 * Creates a debounced version of a function
 * @param {Function} fn - The function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} The debounced function
 */
function debounce(fn, delay) {
    let timeoutId = null;
    return function(...args) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
            timeoutId = null;
        }, delay);
    };
}

// === UI UTILITIES ===

/**
 * Initializes Lucide icons within a specific container or the entire document
 * @param {Element|null} [container=null] - Optional container to scope icon initialization
 */
function initLucideIcons(container = null) {
    if (typeof lucide === 'undefined') return;

    if (container) {
        const nodes = container.querySelectorAll('[data-lucide]');
        if (nodes.length > 0) {
            lucide.createIcons({ nodes: Array.from(nodes) });
        }
    } else {
        lucide.createIcons();
    }
}

/**
 * Gets the score status class based on score value
 * @param {number} score - The score value (0-100)
 * @returns {string} The status class ('success', 'warning', or 'error')
 */
function getScoreStatus(score) {
    if (score >= CONFIG.SCORE_SUCCESS_THRESHOLD) return 'success';
    if (score >= CONFIG.SCORE_WARNING_THRESHOLD) return 'warning';
    return 'error';
}

/**
 * Gets the score status for status icons ('ok', 'warning', 'error')
 * @param {number} score - The score value (0-100)
 * @returns {string} The status ('ok', 'warning', or 'error')
 */
function getScoreIconStatus(score) {
    if (score >= CONFIG.SCORE_SUCCESS_THRESHOLD) return 'ok';
    if (score >= CONFIG.SCORE_WARNING_THRESHOLD) return 'warning';
    return 'error';
}

/**
 * Renders a status icon pill based on status
 * @param {string} status - The status ('ok', 'warning', 'error')
 * @returns {string} HTML string for the status icon
 */
function renderStatusIcon(status) {
    const iconMap = {
        'ok': { class: 'ok', icon: 'check-circle-2' },
        'warning': { class: 'warning', icon: 'alert-triangle' },
        'error': { class: 'error', icon: 'x-circle' }
    };
    const config = iconMap[status] || iconMap['error'];
    return `<i data-lucide="${config.icon}" class="icon icon-sm status-icon status-icon--${config.class}" aria-hidden="true"></i>`;
}

/**
 * Gets a user by ID from the mockUsers array
 * @param {number} userId - The user ID
 * @returns {Object|null} The user object or null if not found
 */
function getUserById(userId) {
    return mockUsers.find(u => u.id === userId) || null;
}

/**
 * Formats an ISO 8601 date string to DD/MM/YYYY format
 * @param {string} isoString - The ISO 8601 date string (e.g., "2022-04-14" or "2022-04-14T09:30:00.000Z")
 * @returns {string} Formatted date string (DD/MM/YYYY)
 */
function formatDateDisplay(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString; // Return original if invalid
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

/**
 * Formats an ISO 8601 datetime string to DD.MM.YYYY HH:mm format (Swiss locale)
 * @param {string} isoString - The ISO 8601 datetime string (e.g., "2022-04-14T09:30:00.000Z")
 * @returns {string} Formatted datetime string (DD.MM.YYYY HH:mm)
 */
function formatDateTimeDisplay(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString; // Return original if invalid
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Formats user and timestamp for display (e.g., "peter.schmidt@bbl.admin.ch on 10/04/2022 09:30")
 * @param {number} userId - The user ID
 * @param {string} timestamp - The ISO 8601 timestamp string
 * @returns {string} Formatted string with email and timestamp
 */
function formatUserTimestamp(userId, timestamp) {
    const user = getUserById(userId);
    const formattedTime = formatDateTimeDisplay(timestamp);
    if (!user) return formattedTime;
    return `${user.email} ${I18n.t('common.on') || 'on'} ${formattedTime}`;
}

/**
 * Sets up tab functionality for a tab group
 * @param {string} tabAttribute - The data attribute name for tabs (e.g., 'data-tab')
 * @param {string} paneIdPrefix - The prefix for pane IDs (e.g., 'tab-')
 * @param {string[]} [paneIds] - Optional specific pane IDs to target
 * @param {AbortSignal} [signal] - Optional AbortSignal for cleanup
 */
function setupTabGroup(tabAttribute, paneIdPrefix, paneIds = null, signal = null) {
    const options = signal ? { signal } : {};

    document.querySelectorAll(`.tabs__tab[${tabAttribute}]`).forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            // Block tab switching if tab is disabled (e.g. during inline editing)
            if (tab.getAttribute('aria-disabled') === 'true') return;
            const tabName = tab.getAttribute(tabAttribute);

            // Update active tab within the same tab list
            const tabList = tab.closest('.tabs__list');
            const tabsContainer = tab.closest('.tabs');
            if (tabList) {
                tabList.querySelectorAll('.tabs__tab').forEach(t => {
                    t.classList.remove('tabs__tab--active');
                });
            }
            tab.classList.add('tabs__tab--active');

            // Update tab actions visibility
            if (tabsContainer) {
                tabsContainer.querySelectorAll('.tabs__actions').forEach(actions => {
                    actions.style.display = 'none';
                });
                const targetActions = tabsContainer.querySelector(`#tabs-actions-${tabName}`);
                if (targetActions) {
                    targetActions.style.display = 'flex';
                }
            }

            // Update active pane
            if (paneIds) {
                paneIds.forEach(id => {
                    const pane = safeGetElementById(id);
                    if (pane) pane.classList.remove('tab-pane--active');
                });
            } else {
                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.remove('tab-pane--active');
                });
            }

            const targetPane = safeGetElementById(`${paneIdPrefix}${tabName}`);
            if (targetPane) {
                targetPane.classList.add('tab-pane--active');
            }

            // Show/hide KPI strip and resize map for overview tab
            if (tabAttribute === 'data-tab') {
                const kpiStrip = safeGetElementById('overview-kpi-strip');
                if (kpiStrip) kpiStrip.style.display = tabName === 'overview' ? '' : 'none';
            }
            if (tabName === 'overview') {
                const mapContainer = safeGetElementById('overview-map');
                if (mapContainer && mapContainer._mapInstance) {
                    setTimeout(() => mapContainer._mapInstance.resize(), 0);
                }
            }
        }, options);
    });
}

// === MODAL UTILITIES ===

/**
 * Opens a modal by ID
 * @param {string} modalId - The modal element ID
 */
function openModal(modalId) {
    const modal = safeGetElementById(modalId);
    if (!modal) return;

    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    // Initialize Lucide icons in modal
    initLucideIcons(modal);

    // Focus first input or close button
    const firstInput = modal.querySelector('input, select, textarea');
    const closeBtn = modal.querySelector('[data-modal-close]');
    if (firstInput) {
        firstInput.focus();
    } else if (closeBtn) {
        closeBtn.focus();
    }

    // Trap focus within modal
    modal.addEventListener('keydown', trapFocus);
}

/**
 * Closes a modal by ID
 * @param {string} modalId - The modal element ID
 */
function closeModal(modalId) {
    const modal = safeGetElementById(modalId);
    if (!modal) return;

    modal.hidden = true;
    document.body.style.overflow = '';
    modal.removeEventListener('keydown', trapFocus);
}

/**
 * Shows a styled confirmation modal instead of browser confirm()
 * @param {string} title - The modal title
 * @param {string} message - The confirmation message
 * @param {string} actionLabel - The label for the confirm action button
 * @param {Function} onConfirm - Callback when user confirms
 */
function showConfirmModal(title, message, actionLabel, onConfirm) {
    const titleEl = safeGetElementById('confirm-modal-title');
    const messageEl = safeGetElementById('confirm-modal-message');
    const actionBtn = safeGetElementById('confirm-modal-action');
    if (!titleEl || !messageEl || !actionBtn) return;

    titleEl.textContent = title;
    messageEl.textContent = message;
    actionBtn.textContent = actionLabel;

    // Clone and replace to remove any previous listeners
    const newBtn = actionBtn.cloneNode(true);
    actionBtn.parentNode.replaceChild(newBtn, actionBtn);

    newBtn.addEventListener('click', () => {
        onConfirm();
        closeModal('confirm-modal');
    });

    openModal('confirm-modal');
}

/**
 * Traps focus within a modal for accessibility
 * @param {KeyboardEvent} e - The keyboard event
 */
function trapFocus(e) {
    if (e.key !== 'Tab') return;

    const modal = e.currentTarget;
    const focusable = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstEl = focusable[0];
    const lastEl = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === firstEl) {
        lastEl.focus();
        e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
        firstEl.focus();
        e.preventDefault();
    }
}

/**
 * Sets up modal event listeners
 */
function setupModals() {
    // Get AbortController for cleanup on re-initialization
    const controller = getListenerController('modals');
    const signal = controller.signal;

    // New Project button opens modal
    const newProjectBtn = safeGetElementById('new-project-btn');
    if (newProjectBtn) {
        newProjectBtn.addEventListener('click', () => {
            populateRuleSetDropdown();
            openModal('new-project-modal');
        }, { signal });
    }

    // Close modal on backdrop click or close button
    document.querySelectorAll('[data-modal-close]').forEach(el => {
        el.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        }, { signal });
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal:not([hidden])');
            if (openModal) {
                closeModal(openModal.id);
            }
        }
    }, { signal });

    // Setup New Project form
    setupNewProjectForm();
}

/**
 * Populates the rule set dropdown from mockRuleSets data
 */
function populateRuleSetDropdown() {
    const ruleSetSelect = safeGetElementById('project-ruleset');
    if (!ruleSetSelect) return;

    // Keep the placeholder option
    ruleSetSelect.innerHTML = '<option value="">' + I18n.t('modal.pleaseSelect') + '</option>';

    // Add options from mockRuleSets
    mockRuleSets.forEach(ruleSet => {
        const option = document.createElement('option');
        option.value = ruleSet.id;
        option.textContent = ruleSet.name;
        ruleSetSelect.appendChild(option);
    });
}

/**
 * Sets up the New Project form handling
 */
function setupNewProjectForm() {
    const form = safeGetElementById('new-project-form');
    const imageInput = safeGetElementById('project-image');
    const imagePreview = safeGetElementById('project-image-preview');
    const imagePreviewImg = safeGetElementById('project-image-preview-img');
    const imageRemoveBtn = safeGetElementById('project-image-remove');
    const imagePlaceholder = document.querySelector('.form__file-placeholder');
    const imageUpload = safeGetElementById('project-image-upload');

    // Store image data URL
    let selectedImageUrl = '';

    // Image preview on file select with size validation
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                // Validate file size
                if (file.size > CONFIG.MAX_IMAGE_SIZE) {
                    showToast(I18n.t('toast.imageTooLarge', { size: formatFileSize(CONFIG.MAX_IMAGE_SIZE) }), 'error');
                    e.target.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    selectedImageUrl = event.target.result;
                    if (imagePreviewImg) {
                        imagePreviewImg.src = selectedImageUrl;
                    }
                    if (imagePreview) {
                        imagePreview.hidden = false;
                    }
                    if (imagePlaceholder) {
                        imagePlaceholder.hidden = true;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Remove image
    if (imageRemoveBtn) {
        imageRemoveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectedImageUrl = '';
            if (imageInput) {
                imageInput.value = '';
            }
            if (imagePreview) {
                imagePreview.hidden = true;
            }
            if (imagePlaceholder) {
                imagePlaceholder.hidden = false;
            }
        });
    }

    // Drag and drop support
    if (imageUpload) {
        imageUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageUpload.classList.add('is-dragover');
        });

        imageUpload.addEventListener('dragleave', () => {
            imageUpload.classList.remove('is-dragover');
        });

        imageUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            imageUpload.classList.remove('is-dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                // Trigger the change event by setting files
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                if (imageInput) {
                    imageInput.files = dataTransfer.files;
                    imageInput.dispatchEvent(new Event('change'));
                }
            }
        });
    }

    // Form submission
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            const projectNumber = formData.get('projectNumber');
            const name = formData.get('name');
            const phase = formData.get('phase');
            const language = formData.get('language');

            // Generate new project ID
            const newId = mockProjects.length > 0
                ? Math.max(...mockProjects.map(p => p.id)) + 1
                : 1;

            // Create new project object
            const newProject = {
                id: newId,
                number: escapeHtml(projectNumber),
                name: escapeHtml(name),
                phase: escapeHtml(phase),
                language: escapeHtml(language),
                createdBy: 1,  // TODO: Use actual logged-in user ID
                createdDate: formatDate(new Date()),
                documentCount: 0,
                resultPercentage: 0,
                status: 'active',
                ruleSetId: 1,  // Default rule set
                imageUrls: [selectedImageUrl || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop'],
                users: [{ userId: 1, role: 'Admin' }]  // TODO: Use actual logged-in user ID
            };

            // Add to mockProjects array
            mockProjects.unshift(newProject);

            // Close modal and reset form
            closeModal('new-project-modal');
            form.reset();
            selectedImageUrl = '';
            if (imagePreview) {
                imagePreview.hidden = true;
            }
            if (imagePlaceholder) {
                imagePlaceholder.hidden = false;
            }

            // Re-render projects and show success message
            renderProjects();
            showToast(I18n.t('toast.projectCreated', { name: name }), 'success');
        });
    }
}

/**
 * Formats a date to ISO 8601 date format (YYYY-MM-DD)
 * @param {Date} date - The date to format
 * @returns {string} The formatted date string in ISO 8601 format
 */
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Formats a date to ISO 8601 datetime format
 * @param {Date} date - The date to format
 * @returns {string} The formatted datetime string in ISO 8601 format
 */
function formatDateTime(date) {
    return date.toISOString();
}

// === STATE MANAGEMENT ===
const AppState = {
    currentView: 'login',
    currentProject: null,
    currentDocument: null,
    currentStep: 1,
    isNavigatingFromHash: false,

    /**
     * Updates the current view
     * @param {string} view - The new view name
     */
    setView(view) {
        this.currentView = view;
    },

    /**
     * Updates the current project
     * @param {Object|null} project - The project object or null
     */
    setProject(project) {
        this.currentProject = project;
    },

    /**
     * Updates the current document
     * @param {Object|null} doc - The document object or null
     */
    setDocument(doc) {
        this.currentDocument = doc;
    },

    /**
     * Updates the current step
     * @param {number} step - The step number (1-4)
     */
    setStep(step) {
        if (step >= 1 && step <= CONFIG.STEP_COUNT) {
            this.currentStep = step;
        }
    },

    /**
     * Resets the state
     */
    reset() {
        this.currentView = 'login';
        this.currentProject = null;
        this.currentDocument = null;
        this.currentStep = 1;
    }
};

// Legacy compatibility - use getters/setters to sync with AppState
let _navigationTimeoutId = null; // Track pending navigation (requestAnimationFrame ID)

// Define getters/setters for legacy global compatibility
Object.defineProperty(window, 'currentView', {
    get: () => AppState.currentView,
    set: (v) => { AppState.currentView = v; }
});
Object.defineProperty(window, 'currentProject', {
    get: () => AppState.currentProject,
    set: (v) => { AppState.currentProject = v; }
});
Object.defineProperty(window, 'currentDocument', {
    get: () => AppState.currentDocument,
    set: (v) => { AppState.currentDocument = v; }
});
Object.defineProperty(window, 'currentStep', {
    get: () => AppState.currentStep,
    set: (v) => { AppState.currentStep = v; }
});
Object.defineProperty(window, 'isNavigatingFromHash', {
    get: () => AppState.isNavigatingFromHash,
    set: (v) => { AppState.isNavigatingFromHash = v; }
});

// === EVENT LISTENER MANAGEMENT ===
// Store AbortControllers for cleanup of event listener groups
const eventListenerControllers = {
    tabs: null,
    modals: null,
    documentActions: null,
    userActions: null
};

/**
 * Gets or creates an AbortController for a specific listener group
 * @param {string} group - The listener group name
 * @returns {AbortController} The AbortController for this group
 */
function getListenerController(group) {
    // Abort previous listeners in this group
    if (eventListenerControllers[group]) {
        eventListenerControllers[group].abort();
    }
    // Create new controller
    eventListenerControllers[group] = new AbortController();
    return eventListenerControllers[group];
}

// === DATA STORAGE ===
// These arrays are populated from JSON files on initialization
let mockProjects = [];
let mockDocuments = [];
let mockGeometry = [];
let mockRuleSets = [];
let mockCheckingResults = [];
let mockUsers = [];

/**
 * Loads data from JSON files with detailed error reporting
 * @returns {Promise<boolean>} True if data loaded successfully
 */
async function loadData() {
    const endpoints = [
        { name: 'projects', url: 'data/buildings.json', target: 'mockProjects' },
        { name: 'documents', url: 'data/floorplans.json', target: 'mockDocuments' },
        { name: 'geometry', url: 'data/geometry.json', target: 'mockGeometry' },
        { name: 'rules', url: 'data/rules.json', target: 'mockRuleSets' },
        { name: 'results', url: 'data/results.json', target: 'mockCheckingResults' },
        { name: 'users', url: 'data/users.json', target: 'mockUsers' }
    ];

    try {
        const results = await Promise.allSettled(
            endpoints.map(async (endpoint) => {
                const response = await fetch(endpoint.url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return { name: endpoint.name, target: endpoint.target, data: await response.json() };
            })
        );

        // Check for failures and collect error details
        const failures = [];
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                failures.push(`${endpoints[index].name}: ${result.reason.message}`);
            }
        });

        if (failures.length > 0) {
            console.error('[Data] Failed to load:', failures.join(', '));
            showToast(I18n.t('toast.loadingError', { failures: failures.join(', ') }), 'error');
            return false;
        }

        // Assign successful results to their targets
        results.forEach((result) => {
            if (result.status === 'fulfilled') {
                const { target, data } = result.value;
                switch (target) {
                    case 'mockProjects': mockProjects = data; break;
                    case 'mockDocuments': mockDocuments = data; break;
                    case 'mockGeometry': mockGeometry = data; break;
                    case 'mockRuleSets': mockRuleSets = data; break;
                    case 'mockCheckingResults': mockCheckingResults = data; break;
                    case 'mockUsers': mockUsers = data; break;
                }
            }
        });

        const roomCount = mockGeometry.filter(g => g.type === 'room').length;
        const areaCount = mockGeometry.filter(g => g.type === 'area').length;
        console.log(`[Data] Loaded ${mockProjects.length} projects, ${mockDocuments.length} documents, ${roomCount} rooms, ${areaCount} areas, ${mockRuleSets.length} rule sets, ${mockCheckingResults.length} results, ${mockUsers.length} users`);
        return true;
    } catch (error) {
        console.error('[Data] Unexpected error loading data:', error);
        showToast(I18n.t('toast.unexpectedError'), 'error');
        return false;
    }
}

// NOTE: State variables (currentView, currentProject, currentDocument, currentStep, isNavigatingFromHash)
// are managed by AppState (lines 472-522) and exposed via window properties (lines 528-547).
// Do not declare duplicate let variables here.

// === URL ROUTING ===

/**
 * Builds query string from current view type and active filters.
 * Only includes parameters that differ from defaults.
 */
function buildHashParams() {
    const params = new URLSearchParams();

    // View type (only on buildings view)
    if (currentView === 'buildings') {
        const activeBtn = document.querySelector('.view-toggle__btn.seg-btn--active');
        const viewType = activeBtn ? activeBtn.dataset.view : 'grid';
        if (viewType !== 'grid') params.set('view', viewType);
    }

    // Filters (persist across all project-level views)
    const region = (document.getElementById('filter-region') || {}).value || '';
    const status = (document.getElementById('filter-status') || {}).value || '';
    const quality = (document.getElementById('filter-quality') || {}).value || '';
    if (region) params.set('region', region);
    if (status) params.set('status', status);
    if (quality) params.set('quality', quality);

    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

function updateUrlHash() {
    if (isNavigatingFromHash) return;

    let hash = '';
    const params = buildHashParams();

    if (currentView === 'buildings') {
        hash = `#/buildings${params}`;
    } else if (currentView === 'building-detail' && currentProject) {
        hash = `#/building/${currentProject.id}${params}`;
    } else if (currentView === 'validation' && currentProject && currentDocument) {
        hash = `#/building/${currentProject.id}/floorplan/${currentDocument.id}${params}`;
    } else if (currentView === 'results' && currentProject && currentDocument) {
        hash = `#/building/${currentProject.id}/floorplan/${currentDocument.id}/results${params}`;
    } else if (currentView === 'login') {
        hash = '#/login';
    }

    if (hash && window.location.hash !== hash) {
        history.pushState(null, '', hash);
    }
}

/**
 * Parses query parameters from the hash string.
 * E.g. "#/buildings?view=map&region=Bern" → { view: "map", region: "Bern" }
 */
function parseHashParams(hash) {
    const qIndex = hash.indexOf('?');
    if (qIndex === -1) return {};
    const qs = hash.substring(qIndex + 1);
    const params = {};
    new URLSearchParams(qs).forEach((value, key) => { params[key] = value; });
    return params;
}

/**
 * Applies filter parameters from the URL to the filter dropdowns.
 */
function applyFiltersFromParams(params) {
    const regionSel = document.getElementById('filter-region');
    const statusSel = document.getElementById('filter-status');
    const qualitySel = document.getElementById('filter-quality');

    if (regionSel) regionSel.value = params.region || '';
    if (statusSel) statusSel.value = params.status || '';
    if (qualitySel) qualitySel.value = params.quality || '';

    applyFilters();
    updateFilterBadge();

    // Auto-open filter panel if any filter is active
    const hasActiveFilters = params.region || params.status || params.quality;
    if (hasActiveFilters) {
        const toggleBtn = document.getElementById('filter-toggle-btn');
        const filterPanel = document.getElementById('filter-panel');
        if (toggleBtn && filterPanel) {
            filterPanel.hidden = false;
            filterPanel.offsetHeight;
            toggleBtn.setAttribute('aria-expanded', 'true');
            filterPanel.classList.add('filter-panel--open');
        }
    }
}

/**
 * Applies the view type parameter (grid/list/map/dashboard) from the URL.
 */
function applyViewTypeFromParams(params) {
    const viewType = params.view || 'grid';
    const btn = document.querySelector(`.view-toggle__btn[data-view="${viewType}"]`);
    if (btn) {
        btn.click();
    }
}

function navigateFromHash() {
    // Cancel any pending navigation to prevent race conditions
    if (_navigationTimeoutId) {
        cancelAnimationFrame(_navigationTimeoutId);
        _navigationTimeoutId = null;
    }

    isNavigatingFromHash = true;
    const hash = window.location.hash || '';

    // Strip query params for route matching
    const hashPath = hash.split('?')[0];
    const params = parseHashParams(hash);

    // Parse the hash path
    const projectMatch = hashPath.match(/#\/building\/(\d+)/);
    const documentMatch = hashPath.match(/\/floorplan\/(\d+)/);
    const isResults = hashPath.includes('/results');

    if (hashPath === '#/buildings' || hashPath === '' || hash.startsWith('#/buildings?')) {
        switchView('buildings');
        renderProjects();
        applyFiltersFromParams(params);
        // Defer view type switch so DOM is ready
        requestAnimationFrame(() => {
            applyViewTypeFromParams(params);
            isNavigatingFromHash = false;
        });
        return;
    } else if (hashPath === '#/login') {
        switchView('login');
    } else if (projectMatch) {
        const projectId = safeParseInt(projectMatch[1]);

        // Apply filters if present
        applyFiltersFromParams(params);

        if (documentMatch) {
            const documentId = safeParseInt(documentMatch[1]);
            // First open project, then document
            openProjectDetail(projectId, true); // true = skip hash update

            // Use requestAnimationFrame for reliable timing after DOM updates
            _navigationTimeoutId = requestAnimationFrame(() => {
                _navigationTimeoutId = null;
                openValidationView(documentId, true);
                if (isResults) {
                    switchView('results');
                    renderPieChart();
                }
                isNavigatingFromHash = false;
            });
            return;
        } else {
            openProjectDetail(projectId, true);
        }
    }

    isNavigatingFromHash = false;
}

function setupRouting() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
        navigateFromHash();
    });

    // Handle initial URL on page load
    const hash = window.location.hash;
    if (hash && hash !== '#/login') {
        navigateFromHash();
    }
}

// === VIEW SWITCHING ===
function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('view--active');
    });

    // Show selected view
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.classList.add('view--active');
        currentView = viewName;

        // Brief loading transition
        showViewLoading(targetView);
        requestAnimationFrame(() => {
            hideViewLoading(targetView);
        });
    }

    // Show demo button only on login view
    const demoBtn = document.getElementById('demo-btn');
    if (demoBtn) {
        demoBtn.style.display = (viewName === 'login') ? '' : 'none';
    }

    // Update URL hash
    updateUrlHash();

    // Re-initialize Lucide icons in the visible view
    initLucideIcons(targetView);
}

/**
 * Shows a loading spinner overlay inside a view container
 * @param {HTMLElement} viewEl - The view element
 */
function showViewLoading(viewEl) {
    if (!viewEl || viewEl.querySelector('.view-loader')) return;
    const loader = document.createElement('div');
    loader.className = 'view-loader';
    loader.innerHTML = '<div class="spinner"></div>';
    loader.setAttribute('aria-label', I18n.t('action.loading') || 'Loading');
    viewEl.prepend(loader);
}

/**
 * Removes the loading spinner overlay from a view container
 * @param {HTMLElement} viewEl - The view element
 */
function hideViewLoading(viewEl) {
    if (!viewEl) return;
    const loader = viewEl.querySelector('.view-loader');
    if (loader) loader.remove();
}

// === PROJECT RENDERING ===
function renderProjects() {
    const grid = document.getElementById('project-grid');
    if (!grid) return;

    // Show empty state if no projects
    if (!mockProjects || mockProjects.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i data-lucide="folder-open" class="empty-state__icon"></i>
                <h3 class="empty-state__title" data-i18n="empty.noProjects">${I18n.t('empty.noProjects')}</h3>
                <p class="empty-state__message" data-i18n="empty.noProjectsHint">${I18n.t('empty.noProjectsHint')}</p>
            </div>
        `;
        initLucideIcons(grid);
        return;
    }

    grid.innerHTML = mockProjects.map(project => {
        // Get documents for this project
        const projectDocuments = mockDocuments.filter(d => d.projectId === project.id);

        // Calculate average score from validated DWG files
        const validatedDwgDocs = projectDocuments.filter(doc =>
            doc.name.endsWith('.dwg') && doc.status !== 'processing'
        );
        const averageScore = validatedDwgDocs.length > 0
            ? Math.round(validatedDwgDocs.reduce((sum, doc) => sum + doc.score, 0) / validatedDwgDocs.length)
            : 0;

        const scoreClass = getScoreStatus(averageScore);

        const overlayHtml = project.status === 'completed'
            ? '<div class="card__overlay">' + I18n.t('card.orderCompleted') + '<br>' + I18n.t('card.deletedIn30Days') + '</div>'
            : '';

        return `
            <article class="card" data-project-id="${safeParseInt(project.id)}">
                <div class="card__image">
                    <img src="${escapeHtml((project.imageUrls && project.imageUrls[0]) || project.imageUrl || '')}" alt="${escapeHtml(project.name)}">
                    ${overlayHtml}
                </div>
                <div class="card__content">
                    <h3 class="card__title">${escapeHtml(project.internalId)} – ${escapeHtml(project.name)}</h3>
                    <dl class="card__meta">
                        <div class="card__meta-left">
                            <dd>${escapeHtml(formatDateDisplay(project.createdDate))}</dd>
                            <dd>${projectDocuments.length} ${I18n.t('card.floorPlans')}</dd>
                        </div>
                        <div class="card__meta-right">
                            <span class="card__percentage card__percentage--${scoreClass}">${averageScore}%</span>
                        </div>
                    </dl>
                </div>
            </article>
        `;
    }).join('');

    // Add click handlers using event delegation would be better, but maintaining compatibility
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', () => {
            const projectId = safeParseInt(card.dataset.projectId);
            if (projectId > 0) {
                openProjectDetail(projectId);
            }
        });
    });
}

// === PROJECT MAP ===
let projectMap = null;

function initProjectMap() {
    const container = document.getElementById('project-map');
    if (!container || projectMap) return;

    projectMap = new maplibregl.Map({
        container: 'project-map',
        style: {
            version: 8,
            sources: {
                'carto-light': {
                    type: 'raster',
                    tiles: [
                        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
                        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
                        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'
                    ],
                    tileSize: 256,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                }
            },
            layers: [{
                id: 'carto-light-layer',
                type: 'raster',
                source: 'carto-light',
                minzoom: 0,
                maxzoom: 20
            }]
        },
        center: [7.35, 46.85],
        zoom: 8,
        attributionControl: true
    });

    projectMap.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Add markers for each project
    mockProjects.forEach(project => {
        if (!project.coordinates || project.coordinates.length !== 2) return;

        const [lng, lat] = project.coordinates;

        const markerEl = document.createElement('div');
        markerEl.className = 'project-map-marker';
        markerEl.textContent = project.id;

        const popup = new maplibregl.Popup({ offset: 20 })
            .setHTML(
                '<h4>' + escapeHtml(project.internalId) + ' – ' + escapeHtml(project.name) + '</h4>' +
                '<p>Nr. ' + escapeHtml(project.number) + '</p>' +
                '<a href="#" class="project-map-link" data-project-id="' + project.id + '">' + I18n.t('map.openProject') + ' &rarr;</a>'
            );

        new maplibregl.Marker({ element: markerEl })
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(projectMap);
    });

    // Click delegation for popup links
    container.addEventListener('click', (e) => {
        const link = e.target.closest('.project-map-link');
        if (link) {
            e.preventDefault();
            const projectId = parseInt(link.dataset.projectId, 10);
            if (projectId > 0) openProjectDetail(projectId);
        }
    });

    // Fit bounds to all markers
    const bounds = new maplibregl.LngLatBounds();
    let hasCoords = false;
    mockProjects.forEach(project => {
        if (project.coordinates && project.coordinates.length === 2) {
            bounds.extend(project.coordinates);
            hasCoords = true;
        }
    });
    if (hasCoords) {
        projectMap.fitBounds(bounds, { padding: 60, maxZoom: 12 });
    }
}

function destroyProjectMap() {
    if (projectMap) {
        projectMap.remove();
        projectMap = null;
    }
}

// === PROJECT DASHBOARD ===

function renderDashboard() {
    // --- KPI Cards ---
    const dwgDocs = mockDocuments.filter(d => d.name.endsWith('.dwg'));
    const rooms = mockGeometry.filter(g => g.type === 'room');
    const gfAreas = mockGeometry.filter(g => g.type === 'area' && g.aofunction === 'Geschossfläche');
    const totalGF = gfAreas.reduce((sum, a) => sum + (a.area || 0), 0);
    const avgQuality = mockProjects.length > 0
        ? Math.round(mockProjects.reduce((s, p) => s + p.resultPercentage, 0) / mockProjects.length)
        : 0;

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('kpi-projects', mockProjects.length);
    el('kpi-documents', dwgDocs.length);
    el('kpi-rooms', rooms.length);
    el('kpi-total-gf', totalGF.toLocaleString('de-CH', { maximumFractionDigits: 0 }));
    el('kpi-quality', avgQuality + '%');

    // --- Projektstatus bars ---
    const statusCounts = { active: 0, completed: 0 };
    mockProjects.forEach(p => { if (statusCounts[p.status] !== undefined) statusCounts[p.status]++; });
    const total = mockProjects.length || 1;

    const statusBarsEl = document.getElementById('dashboard-status-bars');
    if (statusBarsEl) {
        statusBarsEl.innerHTML =
            '<div class="status-bar">' +
                '<span class="status-bar__label">' + I18n.t('dashboard.active') + '</span>' +
                '<div class="status-bar__track"><div class="status-bar__fill status-bar__fill--active" style="width:' + (statusCounts.active / total * 100) + '%"></div></div>' +
                '<span class="status-bar__count">' + statusCounts.active + '</span>' +
            '</div>' +
            '<div class="status-bar">' +
                '<span class="status-bar__label">' + I18n.t('dashboard.completed') + '</span>' +
                '<div class="status-bar__track"><div class="status-bar__fill status-bar__fill--completed" style="width:' + (statusCounts.completed / total * 100) + '%"></div></div>' +
                '<span class="status-bar__count">' + statusCounts.completed + '</span>' +
            '</div>';
    }

    // --- Validation summary ---
    const sevCounts = { error: 0, warning: 0, info: 0 };
    mockCheckingResults.forEach(r => { if (sevCounts[r.severity] !== undefined) sevCounts[r.severity]++; });

    const validationEl = document.getElementById('dashboard-validation');
    if (validationEl) {
        validationEl.innerHTML =
            '<div class="validation-row">' +
                '<span class="validation-row__dot validation-row__dot--error"></span>' +
                '<span class="validation-row__label">' + I18n.t('dashboard.errors') + '</span>' +
                '<span class="validation-row__count">' + sevCounts.error + '</span>' +
            '</div>' +
            '<div class="validation-row">' +
                '<span class="validation-row__dot validation-row__dot--warning"></span>' +
                '<span class="validation-row__label">' + I18n.t('dashboard.warnings') + '</span>' +
                '<span class="validation-row__count">' + sevCounts.warning + '</span>' +
            '</div>' +
            '<div class="validation-row">' +
                '<span class="validation-row__dot validation-row__dot--info"></span>' +
                '<span class="validation-row__label">' + I18n.t('dashboard.info') + '</span>' +
                '<span class="validation-row__count">' + sevCounts.info + '</span>' +
            '</div>';
    }

    // --- Team summary ---
    // Collect unique users across all projects with their highest role
    const userRoleMap = {};
    mockProjects.forEach(p => {
        (p.users || []).forEach(u => {
            const rolePriority = { 'Admin': 3, 'Editor': 2, 'Viewer': 1 };
            if (!userRoleMap[u.userId] || rolePriority[u.role] > rolePriority[userRoleMap[u.userId]]) {
                userRoleMap[u.userId] = u.role;
            }
        });
    });

    const teamEl = document.getElementById('dashboard-team');
    if (teamEl) {
        const teamHtml = Object.keys(userRoleMap).slice(0, 6).map(uid => {
            const user = getUserById(parseInt(uid, 10));
            if (!user) return '';
            const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
            const role = userRoleMap[uid];
            return '<div class="team-row">' +
                '<span class="team-row__avatar">' + escapeHtml(initials) + '</span>' +
                '<span class="team-row__name">' + escapeHtml(user.name) + '</span>' +
                '<span class="team-row__role">' + escapeHtml(role) + '</span>' +
            '</div>';
        }).join('');
        teamEl.innerHTML = teamHtml;
    }

    // --- Project summary table ---
    const tableBody = document.getElementById('dashboard-project-table');
    if (tableBody) {
        const rows = mockProjects.map(p => {
            const pDocs = mockDocuments.filter(d => d.projectId === p.id && d.name.endsWith('.dwg'));
            const pDocIds = mockDocuments.filter(d => d.projectId === p.id).map(d => d.id);
            const pRooms = mockGeometry.filter(g => g.type === 'room' && pDocIds.includes(g.documentId));
            const pGF = mockGeometry.filter(g => g.type === 'area' && g.aofunction === 'Geschossfläche' && pDocIds.includes(g.documentId));
            const pGFTotal = pGF.reduce((s, a) => s + (a.area || 0), 0);
            const pErrors = mockCheckingResults.filter(r => pDocIds.includes(r.documentId) && r.severity === 'error');
            const scoreClass = p.resultPercentage >= 90 ? 'success' : p.resultPercentage >= 60 ? 'warning' : 'error';

            return '<tr data-project-id="' + p.id + '" style="cursor:pointer">' +
                '<td>' + escapeHtml(p.internalId) + ' – ' + escapeHtml(p.name) + '</td>' +
                '<td>' + escapeHtml(p.phase) + '</td>' +
                '<td>' + pDocs.length + '</td>' +
                '<td>' + pRooms.length + '</td>' +
                '<td>' + pGFTotal.toLocaleString('de-CH', { maximumFractionDigits: 0 }) + '</td>' +
                '<td>' + pErrors.length + '</td>' +
                '<td><span class="quality-badge quality-badge--' + scoreClass + '">' + p.resultPercentage + '%</span></td>' +
            '</tr>';
        }).join('');
        tableBody.innerHTML = rows;

        // Click row to navigate to project detail
        tableBody.querySelectorAll('tr[data-project-id]').forEach(row => {
            row.addEventListener('click', () => {
                openProjectDetail(safeParseInt(row.dataset.projectId));
            });
        });
    }

    // Initialize Lucide icons in dashboard
    const dashboardEl = document.getElementById('project-dashboard');
    if (dashboardEl) initLucideIcons(dashboardEl);
}

// === PROJECT FILTERS ===

function initFilters() {
    // Populate region dropdown from project names (extract city)
    const regionSelect = document.getElementById('filter-region');
    if (regionSelect) {
        const regions = [...new Set(mockProjects.map(p => p.city))].sort();
        regions.forEach(region => {
            const opt = document.createElement('option');
            opt.value = region;
            opt.textContent = region;
            regionSelect.appendChild(opt);
        });
    }

    // Wire up filter change handlers
    ['filter-region', 'filter-status', 'filter-quality'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) sel.addEventListener('change', () => {
            applyFilters();
            updateFilterBadge();
            updateUrlHash();
        });
    });

    // Filter toggle button
    const toggleBtn = document.getElementById('filter-toggle-btn');
    const filterPanel = document.getElementById('filter-panel');
    if (toggleBtn && filterPanel) {
        toggleBtn.addEventListener('click', () => {
            const isOpen = toggleBtn.getAttribute('aria-expanded') === 'true';
            if (isOpen) {
                toggleBtn.setAttribute('aria-expanded', 'false');
                filterPanel.classList.remove('filter-panel--open');
                // Wait for animation then hide
                setTimeout(() => { filterPanel.hidden = true; }, 250);
            } else {
                filterPanel.hidden = false;
                // Force reflow before adding class for animation
                filterPanel.offsetHeight;
                toggleBtn.setAttribute('aria-expanded', 'true');
                filterPanel.classList.add('filter-panel--open');
                initLucideIcons();
            }
        });
    }

    // Reset button
    const resetBtn = document.getElementById('filter-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            ['filter-region', 'filter-status', 'filter-quality'].forEach(id => {
                const sel = document.getElementById(id);
                if (sel) sel.value = '';
            });
            applyFilters();
            updateFilterBadge();
            updateUrlHash();
        });
    }
}

function updateFilterBadge() {
    const badge = document.getElementById('filter-badge');
    if (!badge) return;
    let count = 0;
    ['filter-region', 'filter-status', 'filter-quality'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel && sel.value) count++;
    });
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }
}

function applyFilters() {
    const region = (document.getElementById('filter-region') || {}).value || '';
    const status = (document.getElementById('filter-status') || {}).value || '';
    const quality = (document.getElementById('filter-quality') || {}).value || '';

    const cards = document.querySelectorAll('#project-grid .card');
    cards.forEach(card => {
        const projectId = parseInt(card.dataset.projectId, 10);
        const project = mockProjects.find(p => p.id === projectId);
        if (!project) { card.style.display = ''; return; }

        let visible = true;

        if (region && project.city !== region) visible = false;
        if (status && project.status !== status) visible = false;
        if (quality) {
            const pct = project.resultPercentage;
            if (quality === 'high' && pct < 90) visible = false;
            if (quality === 'medium' && (pct < 60 || pct >= 90)) visible = false;
            if (quality === 'low' && pct >= 60) visible = false;
        }

        card.style.display = visible ? '' : 'none';
    });
}

// === PROJECT DETAIL ===
function openProjectDetail(projectId, skipHashUpdate = false) {
    currentProject = mockProjects.find(p => p.id === projectId);
    if (!currentProject) return;

    // Reset to overview tab
    const tabList = document.querySelector('#view-building-detail .tabs__list');
    if (tabList) {
        tabList.querySelectorAll('.tabs__tab').forEach(t => t.classList.remove('tabs__tab--active'));
        const overviewTab = tabList.querySelector('[data-tab="overview"]');
        if (overviewTab) overviewTab.classList.add('tabs__tab--active');
    }
    // Reset tab panes
    ['tab-overview', 'tab-documents', 'tab-rules', 'tab-settings'].forEach(id => {
        const pane = document.getElementById(id);
        if (pane) pane.classList.remove('tab-pane--active');
    });
    const overviewPane = document.getElementById('tab-overview');
    if (overviewPane) overviewPane.classList.add('tab-pane--active');
    // Reset tab actions visibility
    const tabsContainer = document.querySelector('#view-building-detail .tabs');
    if (tabsContainer) {
        tabsContainer.querySelectorAll('.tabs__actions').forEach(a => a.style.display = 'none');
        const overviewActions = tabsContainer.querySelector('#tabs-actions-overview');
        if (overviewActions) overviewActions.style.display = 'flex';
    }

    // Reset inline edit mode if active
    if (isOverviewEditing) {
        isOverviewEditing = false;
        const editBtnEl = document.getElementById('overview-edit-btn');
        const saveBtnEl = document.getElementById('overview-save-btn');
        const cancelBtnEl = document.getElementById('overview-cancel-btn');
        if (editBtnEl) editBtnEl.style.display = '';
        if (saveBtnEl) saveBtnEl.style.display = 'none';
        if (cancelBtnEl) cancelBtnEl.style.display = 'none';
        // Re-enable tabs
        document.querySelectorAll('#view-building-detail .tabs__tab').forEach(tab => {
            tab.classList.remove('tabs__tab--disabled');
            tab.removeAttribute('aria-disabled');
        });
    }

    // Update breadcrumb with project name
    const breadcrumbEl = document.getElementById('breadcrumb-building-name');
    if (breadcrumbEl) breadcrumbEl.textContent = currentProject.internalId + ' – ' + currentProject.name;

    // Get documents for this project
    const projectDocuments = mockDocuments.filter(doc => doc.projectId === currentProject.id);

    // Calculate average score from all validated floor plans (.dwg files) for this project
    const validatedFloorPlans = projectDocuments.filter(doc =>
        doc.name.endsWith('.dwg') && doc.status !== 'processing'
    );
    const averageScore = validatedFloorPlans.length > 0
        ? Math.round(validatedFloorPlans.reduce((sum, doc) => sum + doc.score, 0) / validatedFloorPlans.length)
        : 0;

    // Update KPI strip score with color
    const scoreEl = document.getElementById('project-completion');
    if (scoreEl) {
        scoreEl.textContent = `${averageScore}%`;
        scoreEl.className = `overview-kpi__value overview-kpi__value--${getScoreStatus(averageScore)}`;
    }

    // Update KPIs
    const projectDocumentIds = projectDocuments.map(d => d.id);

    // Validation errors count for this project's documents
    const errorCount = mockCheckingResults.filter(r => projectDocumentIds.includes(r.documentId) && r.severity === 'error').length;
    const errorEl = document.getElementById('project-error-count');
    if (errorEl) {
        errorEl.textContent = errorCount;
        errorEl.className = 'overview-kpi__value' + (errorCount > 0 ? ' overview-kpi__value--error' : ' overview-kpi__value--success');
    }

    const docCountEl = document.getElementById('project-document-count');
    if (docCountEl) docCountEl.textContent = projectDocuments.length;

    // Calculate room count from geometry for this project's documents
    const roomCount = mockGeometry.filter(g => g.type === 'room' && projectDocumentIds.includes(g.documentId)).length;
    const roomCountEl = document.getElementById('project-room-count');
    if (roomCountEl) roomCountEl.textContent = roomCount;

    // Calculate total GF (Geschossfläche) from geometry for this project
    const totalGF = mockGeometry
        .filter(g => g.type === 'area' && g.aofunction === 'Geschossfläche' && projectDocumentIds.includes(g.documentId))
        .reduce((sum, g) => sum + g.area, 0);
    const formattedGF = totalGF > 0 ? `${totalGF.toLocaleString('de-CH')} m²` : '0 m²';
    const gfEl = document.getElementById('project-gf');
    if (gfEl) gfEl.textContent = formattedGF;

    // Render overview, documents, rules, and settings
    renderOverview();
    renderDocuments();
    renderUsers();
    renderRules();
    populateSettings();

    // Update tab counts
    const ruleSetId = currentProject ? currentProject.ruleSetId : 1;
    const ruleSet = mockRuleSets.find(rs => rs.id === ruleSetId);
    const rulesCount = ruleSet ? ruleSet.rules.length : 0;

    const tabDocsCountEl = document.getElementById('tab-documents-count');
    if (tabDocsCountEl) tabDocsCountEl.textContent = projectDocuments.length;
    const tabRulesCountEl = document.getElementById('tab-rules-count');
    if (tabRulesCountEl) tabRulesCountEl.textContent = rulesCount;

    if (skipHashUpdate) {
        // Directly switch view without updating hash
        document.querySelectorAll('.view').forEach(view => view.classList.remove('view--active'));
        document.getElementById('view-building-detail')?.classList.add('view--active');
        currentView = 'building-detail';
        // Re-initialize Lucide icons
        initLucideIcons(document.getElementById('view-building-detail'));
    } else {
        switchView('building-detail');
    }
}

// === OVERVIEW TAB ===

let isOverviewEditing = false;

// --- Inline edit helper functions ---

function renderEditableField(id, label, value, type) {
    return `
        <div class="overview-detail-field">
            <label class="overview-detail-field__label" for="${escapeHtml(id)}">${escapeHtml(label)}</label>
            <input type="${type || 'text'}" class="form__input--inline" id="${escapeHtml(id)}" value="${escapeHtml(String(value || ''))}">
        </div>`;
}

function renderSelectField(id, label, options, selectedValue) {
    const optionsHtml = options.map(opt =>
        `<option value="${escapeHtml(String(opt.value))}"${String(opt.value) === String(selectedValue) ? ' selected' : ''}>${escapeHtml(opt.label)}</option>`
    ).join('');
    return `
        <div class="overview-detail-field">
            <label class="overview-detail-field__label" for="${escapeHtml(id)}">${escapeHtml(label)}</label>
            <select class="form__input--inline" id="${escapeHtml(id)}">${optionsHtml}</select>
        </div>`;
}

function renderReadonlyField(label, value) {
    return `
        <div class="overview-detail-field">
            <span class="overview-detail-field__label">${escapeHtml(label)}</span>
            <span class="overview-detail-field__value">${escapeHtml(String(value || '–'))}</span>
        </div>`;
}

function renderReadonlyFieldWithId(id, label, value) {
    return `
        <div class="overview-detail-field">
            <span class="overview-detail-field__label">${escapeHtml(label)}</span>
            <span class="overview-detail-field__value" id="${escapeHtml(id)}">${escapeHtml(String(value || '–'))}</span>
        </div>`;
}

function renderAddressDisplayFields(project) {
    const address = [
        ((project.street || '') + ' ' + (project.streetNumber || '')).trim(),
        ((project.zip || '') + ' ' + (project.city || '')).trim(),
        project.canton || '',
        project.country || ''
    ].filter(s => s).join(', ');

    return `
        <div class="overview-detail-field overview-detail-field--wide">
            <span class="overview-detail-field__label">${escapeHtml(I18n.t('overview.address'))}</span>
            <span class="overview-detail-field__value" id="edit-address-display">${escapeHtml(address || '–')}</span>
        </div>`;
}

function stripHtmlTags(html) {
    if (!html) return '';
    return String(html).replace(/<[^>]*>/g, '');
}

function renderDangerZoneCard() {
    return `
        <div class="overview-card overview-card--danger">
            <h3 class="overview-card__title overview-card__title--danger">${escapeHtml(I18n.t('settings.dangerZone'))}</h3>
            <div class="settings-danger__item">
                <div class="settings-danger__text">
                    <p class="settings-danger__label">${escapeHtml(I18n.t('settings.archiveProject'))}</p>
                    <p class="settings-danger__description">${escapeHtml(I18n.t('settings.archiveDescription'))}</p>
                </div>
                <button type="button" class="btn btn--outline-danger btn--sm" id="inline-archive-btn">${escapeHtml(I18n.t('settings.archive'))}</button>
            </div>
            <hr class="settings-danger__divider">
            <div class="settings-danger__item">
                <div class="settings-danger__text">
                    <p class="settings-danger__label">${escapeHtml(I18n.t('settings.deleteProject'))}</p>
                    <p class="settings-danger__description">${escapeHtml(I18n.t('settings.deleteDescription'))}</p>
                </div>
                <button type="button" class="btn btn--danger btn--sm" id="inline-delete-btn">${escapeHtml(I18n.t('action.delete'))}</button>
            </div>
        </div>`;
}

// --- Overview edit mode toggle functions ---

let _overviewSnapshot = null;

function enterOverviewEditMode() {
    isOverviewEditing = true;

    // Snapshot address/EGID/EGRID/coordinates for cancel restore
    if (currentProject) {
        _overviewSnapshot = {
            street: currentProject.street,
            streetNumber: currentProject.streetNumber,
            zip: currentProject.zip,
            city: currentProject.city,
            canton: currentProject.canton,
            country: currentProject.country,
            egid: currentProject.egid,
            egrid: currentProject.egrid,
            coordinates: currentProject.coordinates ? [...currentProject.coordinates] : null
        };
    }

    // Toggle button visibility
    const editBtn = document.getElementById('overview-edit-btn');
    const saveBtn = document.getElementById('overview-save-btn');
    const cancelBtn = document.getElementById('overview-cancel-btn');
    if (editBtn) editBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = '';
    if (cancelBtn) cancelBtn.style.display = '';

    // Re-render overview in edit mode
    renderOverview(true);

    // Disable other tabs while editing
    document.querySelectorAll('#view-building-detail .tabs__tab').forEach(tab => {
        if (tab.getAttribute('data-tab') !== 'overview') {
            tab.classList.add('tabs__tab--disabled');
            tab.setAttribute('aria-disabled', 'true');
        }
    });
}

function exitOverviewEditMode(saved) {
    isOverviewEditing = false;

    // Toggle button visibility
    const editBtn = document.getElementById('overview-edit-btn');
    const saveBtn = document.getElementById('overview-save-btn');
    const cancelBtn = document.getElementById('overview-cancel-btn');
    if (editBtn) editBtn.style.display = '';
    if (saveBtn) saveBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';

    // Re-render overview in display mode
    renderOverview(false);

    // Re-enable other tabs
    document.querySelectorAll('#view-building-detail .tabs__tab').forEach(tab => {
        tab.classList.remove('tabs__tab--disabled');
        tab.removeAttribute('aria-disabled');
    });

    if (!saved && _overviewSnapshot && currentProject) {
        Object.assign(currentProject, _overviewSnapshot);
        showToast(I18n.t('toast.changesDiscarded'), 'info');
    }
    _overviewSnapshot = null;
}

function saveOverviewChanges() {
    if (!currentProject) return;

    const getVal = (id) => document.getElementById(id)?.value ?? '';

    // Projektdetails fields
    currentProject.phase = getVal('edit-phase');
    currentProject.status = getVal('edit-status');
    currentProject.language = getVal('edit-language');
    currentProject.ruleSetId = parseInt(getVal('edit-ruleset'), 10);

    // Gebäude Stammdaten — only building type is editable via select
    // Name, Internal ID, Address, EGID, EGRID are read-only (set by map search)
    currentProject.buildingType = getVal('edit-building-type');

    // Refresh breadcrumb and header
    const breadcrumbEl = document.getElementById('breadcrumb-building-name');
    if (breadcrumbEl) {
        breadcrumbEl.textContent = currentProject.internalId + ' – ' + currentProject.name;
    }

    showToast(I18n.t('toast.settingsSaved'), 'success');
}

/**
 * Renders the overview tab content: building data, project details, team, photo, and map
 * @param {boolean} editing - If true, renders editable form fields instead of static values
 */
function renderOverview(editing = false) {
    if (!currentProject) return;

    // Photo carousel
    const images = currentProject.imageUrls || (currentProject.imageUrl ? [currentProject.imageUrl] : []);
    initOverviewCarousel(images, currentProject.name || '');

    // Photo toolbar icons (edit mode only — top-right corner of carousel)
    const carouselEl = document.getElementById('overview-carousel');
    const existingToolbar = document.getElementById('overview-photo-toolbar');
    if (existingToolbar) existingToolbar.remove();

    if (editing && carouselEl) {
        const toolbarHtml = `
            <div class="overview-photo-toolbar" id="overview-photo-toolbar">
                <label class="overview-photo-toolbar__btn" for="overview-image-input" title="${escapeHtml(I18n.t('settings.addImage'))}">
                    <i data-lucide="plus" class="icon icon-sm" aria-hidden="true"></i>
                </label>
                <label class="overview-photo-toolbar__btn" for="overview-image-replace" title="${escapeHtml(I18n.t('settings.changeImage'))}">
                    <i data-lucide="repeat" class="icon icon-sm" aria-hidden="true"></i>
                </label>
                <button class="overview-photo-toolbar__btn" id="overview-image-remove" type="button" title="${escapeHtml(I18n.t('action.delete'))}">
                    <i data-lucide="trash-2" class="icon icon-sm" aria-hidden="true"></i>
                </button>
                <input type="file" id="overview-image-input" accept="image/*" class="sr-only">
                <input type="file" id="overview-image-replace" accept="image/*" class="sr-only">
            </div>`;
        carouselEl.insertAdjacentHTML('beforeend', toolbarHtml);
        setupInlineImageHandlers();
    }

    // Gebäude Stammdaten
    const buildingDataEl = document.getElementById('overview-building-data');
    if (buildingDataEl) {
        if (editing) {
            buildingDataEl.innerHTML =
                renderReadonlyFieldWithId('edit-name', I18n.t('overview.designation'), currentProject.name)
                + renderReadonlyFieldWithId('edit-internal-id', I18n.t('overview.internalId'), currentProject.internalId)
                + renderSelectField('edit-building-type', I18n.t('overview.buildingType'), BUILDING_TYPE_OPTIONS, currentProject.buildingType)
                + renderAddressDisplayFields(currentProject)
                + renderReadonlyFieldWithId('edit-egid', 'EGID', currentProject.egid)
                + renderReadonlyFieldWithId('edit-egrid', 'EGRID', currentProject.egrid)
                + renderReadonlyFieldWithId('edit-coordinates', I18n.t('overview.coordinates'),
                    currentProject.coordinates ? currentProject.coordinates[0].toFixed(6) + ', ' + currentProject.coordinates[1].toFixed(6) : null);
        } else {
            const address = [
                currentProject.street + ' ' + currentProject.streetNumber,
                currentProject.zip + ' ' + currentProject.city,
                currentProject.canton,
                currentProject.country
            ].filter(Boolean).join(', ');

            buildingDataEl.innerHTML = [
                { label: I18n.t('overview.designation'), value: currentProject.name },
                { label: I18n.t('overview.internalId'), value: currentProject.internalId },
                { label: I18n.t('overview.buildingType'), value: currentProject.buildingType },
                { label: I18n.t('overview.address'), value: address },
                { label: 'EGID', value: currentProject.egid },
                { label: 'EGRID', value: currentProject.egrid },
                { label: I18n.t('overview.coordinates'), value: currentProject.coordinates ? currentProject.coordinates[0].toFixed(6) + ', ' + currentProject.coordinates[1].toFixed(6) : null }
            ].map(f => `
                <div class="overview-detail-field">
                    <span class="overview-detail-field__label">${escapeHtml(f.label)}</span>
                    <span class="overview-detail-field__value">${escapeHtml(String(f.value || '–'))}</span>
                </div>
            `).join('');
        }
    }

    // Projektdetails
    const projectDetailsEl = document.getElementById('overview-project-details');
    if (projectDetailsEl) {
        const createdDate = new Date(currentProject.createdDate).toLocaleDateString('de-CH');
        const creator = getUserById(currentProject.createdBy);
        const creatorName = creator ? (creator.email || creator.name) : '–';

        if (editing) {
            const siaOptions = ['31','32','33','41','51','52','53'].map(v => ({
                value: v, label: I18n.t(`siaPhase.${v}`)
            }));
            const statusOptions = [
                { value: 'active', label: I18n.t('filter.active') },
                { value: 'completed', label: I18n.t('filter.completed') }
            ];
            const langOptions = [
                { value: 'de', label: I18n.t('projectLang.de') },
                { value: 'fr', label: I18n.t('projectLang.fr') },
                { value: 'it', label: I18n.t('projectLang.it') }
            ];
            const ruleSetOptions = mockRuleSets.map(rs => ({ value: rs.id, label: rs.name }));

            projectDetailsEl.innerHTML =
                renderSelectField('edit-phase', I18n.t('detail.siaPhase'), siaOptions, currentProject.phase)
                + renderSelectField('edit-status', I18n.t('settings.status'), statusOptions, currentProject.status)
                + renderSelectField('edit-language', I18n.t('settings.language'), langOptions, currentProject.language)
                + renderSelectField('edit-ruleset', I18n.t('settings.ruleSet'), ruleSetOptions, currentProject.ruleSetId)
                + renderReadonlyField(I18n.t('overview.created'), createdDate)
                + renderReadonlyField(I18n.t('overview.createdBy'), creatorName);
        } else {
            const siaPhaseText = I18n.t(`siaPhase.${currentProject.phase}`);
            const statusText = I18n.t(currentProject.status === 'active' ? 'filter.active' : 'filter.completed');
            const langText = I18n.t(`projectLang.${currentProject.language}`);

            const ruleSet = mockRuleSets.find(rs => rs.id === currentProject.ruleSetId);
            const ruleSetName = ruleSet ? ruleSet.name : '–';

            projectDetailsEl.innerHTML = [
                { label: I18n.t('detail.siaPhase'), value: siaPhaseText },
                { label: I18n.t('settings.status'), value: statusText },
                { label: I18n.t('settings.language'), value: langText },
                { label: I18n.t('settings.ruleSet'), value: ruleSetName },
                { label: I18n.t('overview.created'), value: createdDate },
                { label: I18n.t('overview.createdBy'), value: creatorName }
            ].map(f => `
                <div class="overview-detail-field">
                    <span class="overview-detail-field__label">${escapeHtml(f.label)}</span>
                    <span class="overview-detail-field__value">${escapeHtml(String(f.value || '–'))}</span>
                </div>
            `).join('');
        }
    }

    // Team
    const teamListEl = document.getElementById('overview-team-list');
    const teamTitleEl = document.getElementById('overview-team-title');
    if (teamListEl && currentProject.users) {
        const teamMembers = currentProject.users.map(u => {
            const user = getUserById(u.userId);
            return user ? { ...user, role: u.role, assignmentUserId: u.userId } : null;
        }).filter(Boolean);

        if (teamTitleEl) {
            teamTitleEl.textContent = `Team (${teamMembers.length})`;
        }

        if (editing) {
            teamListEl.innerHTML = teamMembers.map(member => {
                const initials = member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                const roleKey = `role.${member.role.toLowerCase()}`;
                const roleText = I18n.t(roleKey);
                return `
                    <div class="overview-team-row">
                        <span class="overview-team-row__avatar">${escapeHtml(initials)}</span>
                        <div class="overview-team-row__info">
                            <span class="overview-team-row__name">${escapeHtml(member.email || member.name)}</span>
                        </div>
                        <span class="overview-team-row__role">${escapeHtml(roleText)}</span>
                        <button type="button" class="overview-team-row__remove" data-user-id="${member.assignmentUserId}" title="${escapeHtml(I18n.t('action.delete'))}">
                            <i data-lucide="x" class="icon icon-sm" aria-hidden="true"></i>
                        </button>
                    </div>
                `;
            }).join('');

            // Wire up remove buttons
            teamListEl.querySelectorAll('.overview-team-row__remove').forEach(btn => {
                btn.addEventListener('click', () => {
                    const userId = parseInt(btn.dataset.userId, 10);
                    if (!currentProject || !currentProject.users) return;
                    const idx = currentProject.users.findIndex(u => u.userId === userId);
                    if (idx !== -1) {
                        const user = getUserById(userId);
                        currentProject.users.splice(idx, 1);
                        renderOverview(true); // re-render in edit mode
                        if (user) {
                            showToast(I18n.t('toast.usersRemoved', { count: 1 }), 'success');
                        }
                    }
                });
            });
        } else {
            teamListEl.innerHTML = teamMembers.map(member => {
                const initials = member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                const roleKey = `role.${member.role.toLowerCase()}`;
                const roleText = I18n.t(roleKey);
                return `
                    <div class="overview-team-row">
                        <span class="overview-team-row__avatar">${escapeHtml(initials)}</span>
                        <span class="overview-team-row__name">${escapeHtml(member.email || member.name)}</span>
                        <span class="overview-team-row__role">${escapeHtml(roleText)}</span>
                    </div>
                `;
            }).join('');
        }
    }

    // Danger zone (edit mode only) — appended to left column
    const leftCol = document.querySelector('#tab-overview .overview-col-left');
    const existingDanger = leftCol?.querySelector('.overview-card--danger');
    if (existingDanger) existingDanger.remove();

    if (editing && leftCol) {
        leftCol.insertAdjacentHTML('beforeend', renderDangerZoneCard());
        setupInlineDangerHandlers();
    }

    // Initialize overview map
    initOverviewMap();

    // Map search overlay (edit mode only)
    const mapCard = document.querySelector('#tab-overview .overview-card--map');
    const existingSearch = document.getElementById('map-search-overlay');
    if (existingSearch) existingSearch.remove();

    if (editing && mapCard) {
        const searchHtml = `
            <div class="map-search" id="map-search-overlay">
                <div class="map-search__wrapper">
                    <div class="map-search__results" id="map-search-results"></div>
                    <i data-lucide="search" class="icon icon-sm map-search__icon" aria-hidden="true"></i>
                    <input type="text" class="map-search__input" id="map-search-input"
                           placeholder="${escapeHtml(I18n.t('overview.searchAddress'))}" autocomplete="off">
                </div>
            </div>`;
        mapCard.insertAdjacentHTML('beforeend', searchHtml);
        initMapSearch();
    }

    // Initialize Lucide icons for new content
    initLucideIcons(document.getElementById('tab-overview'));
}

/**
 * Sets up image add/remove handlers for inline edit mode
 */
function setupInlineImageHandlers() {
    const addInput = document.getElementById('overview-image-input');
    const replaceInput = document.getElementById('overview-image-replace');
    const removeBtn = document.getElementById('overview-image-remove');

    function getActiveSlideIndex() {
        const dots = document.querySelectorAll('#carousel-dots .overview-carousel__dot');
        let activeIdx = 0;
        dots.forEach((dot, i) => {
            if (dot.classList.contains('overview-carousel__dot--active')) activeIdx = i;
        });
        return activeIdx;
    }

    // Add new image to gallery
    if (addInput) {
        addInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file || !currentProject) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (!currentProject.imageUrls) currentProject.imageUrls = [];
                currentProject.imageUrls.push(ev.target.result);
                initOverviewCarousel(currentProject.imageUrls, currentProject.name || '');
            };
            reader.readAsDataURL(file);
            addInput.value = '';
        });
    }

    // Replace current slide image
    if (replaceInput) {
        replaceInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file || !currentProject || !currentProject.imageUrls) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const idx = getActiveSlideIndex();
                currentProject.imageUrls[idx] = ev.target.result;
                initOverviewCarousel(currentProject.imageUrls, currentProject.name || '');
            };
            reader.readAsDataURL(file);
            replaceInput.value = '';
        });
    }

    // Delete current slide
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            if (!currentProject || !currentProject.imageUrls || currentProject.imageUrls.length <= 1) {
                showToast(I18n.t('toast.changesDiscarded'), 'info');
                return;
            }
            const idx = getActiveSlideIndex();
            currentProject.imageUrls.splice(idx, 1);
            initOverviewCarousel(currentProject.imageUrls, currentProject.name || '');
        });
    }
}

/**
 * Sets up archive/delete handlers for inline danger zone in edit mode
 */
function setupInlineDangerHandlers() {
    const archiveBtn = document.getElementById('inline-archive-btn');
    const deleteBtn = document.getElementById('inline-delete-btn');

    if (archiveBtn) {
        archiveBtn.addEventListener('click', () => {
            if (!currentProject) return;
            currentProject.status = 'completed';
            exitOverviewEditMode(true);
            openProjectDetail(currentProject.id, true);
            showToast(I18n.t('toast.projectArchived'), 'success');
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (!currentProject) return;
            const idx = mockProjects.findIndex(p => p.id === currentProject.id);
            if (idx !== -1) {
                mockProjects.splice(idx, 1);
                currentProject = null;
                isOverviewEditing = false;
                switchView('buildings');
                renderProjects();
                showToast(I18n.t('toast.projectDeleted'), 'success');
            }
        });
    }
}

/**
 * Initializes the image carousel on the overview tab
 */
let carouselController = null;
function initOverviewCarousel(images, altText) {
    const track = document.getElementById('overview-carousel-track');
    const dots = document.getElementById('carousel-dots');
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    if (!track) return;

    // Abort previous carousel listeners to prevent leaks
    if (carouselController) carouselController.abort();
    carouselController = new AbortController();
    const { signal } = carouselController;

    let currentIndex = 0;

    // Render slides
    track.innerHTML = images.map(url =>
        `<img class="overview-carousel__slide" src="${escapeHtml(url)}" alt="${escapeHtml(altText)}">`
    ).join('');

    // Render dots
    if (dots) {
        dots.innerHTML = images.length > 1
            ? images.map((_, i) =>
                `<button class="overview-carousel__dot${i === 0 ? ' overview-carousel__dot--active' : ''}" data-index="${i}"></button>`
            ).join('')
            : '';
    }

    function goTo(index) {
        currentIndex = Math.max(0, Math.min(index, images.length - 1));
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
        if (prevBtn) prevBtn.disabled = currentIndex === 0;
        if (nextBtn) nextBtn.disabled = currentIndex === images.length - 1;
        if (dots) {
            dots.querySelector('.overview-carousel__dot--active')?.classList.remove('overview-carousel__dot--active');
            dots.children[currentIndex]?.classList.add('overview-carousel__dot--active');
        }
    }

    if (prevBtn) prevBtn.addEventListener('click', () => goTo(currentIndex - 1), { signal });
    if (nextBtn) nextBtn.addEventListener('click', () => goTo(currentIndex + 1), { signal });
    if (dots) {
        dots.addEventListener('click', (e) => {
            const dot = e.target.closest('.overview-carousel__dot');
            if (dot) goTo(parseInt(dot.dataset.index, 10));
        }, { signal });
    }

    // Hide arrows if only one image
    if (images.length <= 1) {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    } else {
        if (prevBtn) prevBtn.style.display = '';
        if (nextBtn) nextBtn.style.display = '';
    }

    // Click slide to open lightbox
    track.addEventListener('click', (e) => {
        const slide = e.target.closest('.overview-carousel__slide');
        if (slide) openLightbox(images, currentIndex);
    }, { signal });

    goTo(0);
}

/**
 * Opens a fullscreen lightbox for image viewing
 */
let lightboxController = null;
function openLightbox(images, startIndex) {
    const lightbox = document.getElementById('image-lightbox');
    const img = document.getElementById('lightbox-img');
    const counter = document.getElementById('lightbox-counter');
    const prevBtn = lightbox?.querySelector('.lightbox__btn--prev');
    const nextBtn = lightbox?.querySelector('.lightbox__btn--next');
    const closeBtn = lightbox?.querySelector('.lightbox__close');
    const backdrop = lightbox?.querySelector('.lightbox__backdrop');
    if (!lightbox || !img) return;

    // Abort any previous lightbox listeners
    if (lightboxController) lightboxController.abort();
    lightboxController = new AbortController();
    const { signal } = lightboxController;

    let current = startIndex || 0;

    function show(index) {
        current = Math.max(0, Math.min(index, images.length - 1));
        img.src = images[current];
        if (counter) counter.textContent = `${current + 1} / ${images.length}`;
        if (prevBtn) prevBtn.disabled = current === 0;
        if (nextBtn) nextBtn.disabled = current === images.length - 1;
    }

    function close() {
        lightbox.hidden = true;
        if (lightboxController) lightboxController.abort();
        lightboxController = null;
    }

    lightbox.hidden = false;
    show(current);
    initLucideIcons(lightbox);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') show(current - 1);
        else if (e.key === 'ArrowRight') show(current + 1);
    }, { signal });

    prevBtn?.addEventListener('click', () => show(current - 1), { signal });
    nextBtn?.addEventListener('click', () => show(current + 1), { signal });
    closeBtn?.addEventListener('click', close, { signal });
    backdrop?.addEventListener('click', close, { signal });
}

/**
 * Initializes the MapLibre map on the overview tab showing the building location
 */
function initOverviewMap() {
    if (!currentProject || !currentProject.coordinates) return;

    const mapContainer = document.getElementById('overview-map');
    if (!mapContainer) return;

    // Clean up existing map instance
    if (mapContainer._mapInstance) {
        mapContainer._mapInstance.remove();
        mapContainer._mapInstance = null;
    }

    const [lng, lat] = currentProject.coordinates;

    const map = new maplibregl.Map({
        container: 'overview-map',
        style: {
            version: 8,
            sources: {
                'carto-light': {
                    type: 'raster',
                    tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'],
                    tileSize: 256,
                    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
                }
            },
            layers: [{
                id: 'carto-light-layer',
                type: 'raster',
                source: 'carto-light',
                minzoom: 0,
                maxzoom: 20
            }]
        },
        center: [lng, lat],
        zoom: 15,
        attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

    const marker = new maplibregl.Marker({ color: '#dc0018' })
        .setLngLat([lng, lat])
        .addTo(map);

    mapContainer._marker = marker;

    // Set Google Maps link
    updateGoogleMapsLink(lat, lng);

    // Resize after layout settles so the map fills its container
    map.on('load', () => map.resize());
    requestAnimationFrame(() => map.resize());

    mapContainer._mapInstance = map;
}

/**
 * Updates the Google Maps link with current coordinates
 */
function updateGoogleMapsLink(lat, lng) {
    const link = document.getElementById('map-google-link');
    if (link) {
        link.href = `https://www.google.com/maps?q=${lat},${lng}`;
    }
}

/**
 * Searches the Swisstopo geocoding API for Swiss addresses
 */
async function searchSwisstopoAddress(query) {
    if (!query || query.length < 3) return [];

    const url = `https://api3.geo.admin.ch/rest/services/ech/SearchServer?searchText=${encodeURIComponent(query)}&type=locations&origins=address&sr=4326&limit=3`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        return (data.results || []).map(r => ({
            label: stripHtmlTags(r.attrs?.label || ''),
            lat: r.attrs?.lat,
            lon: r.attrs?.lon,
            featureId: r.attrs?.featureId
        }));
    } catch (error) {
        console.error('[MapSearch] Address search failed:', error);
        return [];
    }
}

/**
 * Fetches EGID, EGRID & address components from the Swiss GWR register
 */
async function fetchBuildingDetails(featureId) {
    if (!featureId) return null;

    const url = `https://api3.geo.admin.ch/rest/services/ech/MapServer/ch.bfs.gebaeude_wohnungs_register/${encodeURIComponent(featureId)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const attrs = data.feature?.attributes || {};

        return {
            egid: attrs.egid || null,
            egrid: attrs.egrid || null,
            streetAndNumber: attrs.strname_deinr || null,
            zip: attrs.dplz4 ? String(attrs.dplz4) : null,
            city: attrs.ggdename || null,
            canton: attrs.gdekt || null
        };
    } catch (error) {
        console.error('[MapSearch] Building detail fetch failed:', error);
        return null;
    }
}

/**
 * Pans the overview map and moves the marker to new coordinates
 */
function updateMapPosition(lng, lat) {
    const mapContainer = document.getElementById('overview-map');
    if (!mapContainer || !mapContainer._mapInstance) return;

    const map = mapContainer._mapInstance;

    if (mapContainer._marker) {
        mapContainer._marker.remove();
    }

    const marker = new maplibregl.Marker({ color: '#dc0018' })
        .setLngLat([lng, lat])
        .addTo(map);

    mapContainer._marker = marker;
    map.flyTo({ center: [lng, lat], zoom: 15 });
    updateGoogleMapsLink(lat, lng);
}

/**
 * Refreshes the read-only address and EGID/EGRID display fields from currentProject
 */
function updateAddressDisplay() {
    const addressEl = document.getElementById('edit-address-display');
    const egidEl = document.getElementById('edit-egid');
    const egridEl = document.getElementById('edit-egrid');

    if (addressEl) {
        const address = [
            ((currentProject.street || '') + ' ' + (currentProject.streetNumber || '')).trim(),
            ((currentProject.zip || '') + ' ' + (currentProject.city || '')).trim(),
            currentProject.canton || '',
            currentProject.country || ''
        ].filter(s => s).join(', ');
        addressEl.textContent = address || '–';
    }

    if (egidEl) egidEl.textContent = currentProject.egid || '–';
    if (egridEl) egridEl.textContent = currentProject.egrid || '–';

    const coordsEl = document.getElementById('edit-coordinates');
    if (coordsEl) {
        coordsEl.textContent = currentProject.coordinates
            ? currentProject.coordinates[0].toFixed(6) + ', ' + currentProject.coordinates[1].toFixed(6)
            : '–';
    }
}

/**
 * Initializes the map search overlay: debounced input, results dropdown, selection handler
 */
function initMapSearch() {
    const input = document.getElementById('map-search-input');
    const resultsContainer = document.getElementById('map-search-results');
    if (!input || !resultsContainer) return;

    let currentResults = [];

    const performSearch = debounce(async (query) => {
        if (query.length < 3) {
            resultsContainer.classList.remove('map-search__results--visible');
            resultsContainer.innerHTML = '';
            return;
        }

        // Loading state
        resultsContainer.innerHTML = `<div class="map-search__result-item map-search__result-item--loading">${escapeHtml(I18n.t('overview.searching'))}</div>`;
        resultsContainer.classList.add('map-search__results--visible');

        currentResults = await searchSwisstopoAddress(query);

        if (currentResults.length === 0) {
            resultsContainer.innerHTML = `<div class="map-search__result-item map-search__result-item--loading">${escapeHtml(I18n.t('overview.noResults'))}</div>`;
            return;
        }

        resultsContainer.innerHTML = currentResults.map((result, index) =>
            `<div class="map-search__result-item" data-index="${index}" tabindex="0">${escapeHtml(result.label)}</div>`
        ).join('');

        resultsContainer.querySelectorAll('.map-search__result-item[data-index]').forEach(item => {
            item.addEventListener('click', () => selectSearchResult(parseInt(item.dataset.index, 10)));
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') selectSearchResult(parseInt(item.dataset.index, 10));
            });
        });
    }, CONFIG.SEARCH_DEBOUNCE_MS);

    input.addEventListener('input', (e) => {
        performSearch(e.target.value.trim());
    });

    // Close results on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#map-search-overlay')) {
            resultsContainer.classList.remove('map-search__results--visible');
        }
    });

    async function selectSearchResult(index) {
        const result = currentResults[index];
        if (!result) return;

        input.value = result.label;
        resultsContainer.classList.remove('map-search__results--visible');

        // Move map
        updateMapPosition(result.lon, result.lat);
        currentProject.coordinates = [result.lon, result.lat];

        // Fetch EGID/EGRID from GWR
        const details = await fetchBuildingDetails(result.featureId);

        if (details) {
            if (details.streetAndNumber) {
                const match = details.streetAndNumber.match(/^(.+?)\s+(\d+\w*)$/);
                if (match) {
                    currentProject.street = match[1];
                    currentProject.streetNumber = match[2];
                } else {
                    currentProject.street = details.streetAndNumber;
                    currentProject.streetNumber = '';
                }
            }
            if (details.zip) currentProject.zip = details.zip;
            if (details.city) currentProject.city = details.city;
            if (details.canton) currentProject.canton = details.canton;
            if (details.egid) currentProject.egid = details.egid;
            if (details.egrid) currentProject.egrid = details.egrid;
        }

        updateAddressDisplay();
    }
}

// === DOCUMENT SELECTION STATE ===
const DocumentSelection = {
    selectedIds: new Set(),

    toggle(id) {
        if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id);
        } else {
            this.selectedIds.add(id);
        }
        this.updateUI();
    },

    selectAll() {
        const projectDocuments = currentProject
            ? mockDocuments.filter(doc => doc.projectId === currentProject.id)
            : mockDocuments;
        projectDocuments.forEach(doc => this.selectedIds.add(doc.id));
        this.updateUI();
    },

    deselectAll() {
        this.selectedIds.clear();
        this.updateUI();
    },

    isSelected(id) {
        return this.selectedIds.has(id);
    },

    getSelectedCount() {
        return this.selectedIds.size;
    },

    updateUI() {
        const count = this.getSelectedCount();
        const projectDocuments = currentProject
            ? mockDocuments.filter(doc => doc.projectId === currentProject.id)
            : mockDocuments;
        const total = projectDocuments.length;

        // Update selected count text
        const countEl = safeGetElementById('documents-selected-count');
        if (countEl) {
            countEl.textContent = I18n.t('table.selected', { count: count });
        }

        // Update select all checkbox state
        const selectAllCheckbox = safeGetElementById('select-all-documents');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = count === total && total > 0;
            selectAllCheckbox.indeterminate = count > 0 && count < total;
        }

        // Update row checkboxes and styles
        const tbody = safeGetElementById('document-table-body');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(row => {
                const docId = safeParseInt(row.dataset.documentId);
                const checkbox = row.querySelector('.document-checkbox');
                const isSelected = this.isSelected(docId);

                if (checkbox) {
                    checkbox.checked = isSelected;
                }
                row.classList.toggle('is-selected', isSelected);
            });
        }

        // Update action buttons
        const editBtn = safeGetElementById('edit-document-btn');
        const deleteBtn = safeGetElementById('delete-documents-btn');

        if (editBtn) {
            editBtn.disabled = count !== 1;
        }
        if (deleteBtn) {
            deleteBtn.disabled = count === 0;
        }
    }
};

// === DOCUMENT RENDERING ===
function renderDocuments() {
    const tbody = document.getElementById('document-table-body');
    if (!tbody) return;

    // Reset selection when re-rendering
    DocumentSelection.deselectAll();

    // Filter documents by current project
    const projectDocuments = currentProject
        ? mockDocuments.filter(doc => doc.projectId === currentProject.id)
        : mockDocuments;

    tbody.innerHTML = projectDocuments.map(doc => {
        const scoreStatus = getScoreIconStatus(doc.score);

        return `
            <tr data-document-id="${safeParseInt(doc.id)}" tabindex="0">
                <td class="table__checkbox-col">
                    <label class="checkbox">
                        <input type="checkbox" class="document-checkbox" data-doc-id="${safeParseInt(doc.id)}" aria-label="Select floor plan ${escapeHtml(doc.name)}">
                        <span class="checkbox__mark"></span>
                    </label>
                </td>
                <td>${escapeHtml(doc.name)}</td>
                <td>${escapeHtml(formatUserTimestamp(doc.createdBy, doc.createdAt))}</td>
                <td>${escapeHtml(formatUserTimestamp(doc.lastEditedBy, doc.lastEditedAt))}</td>
                <td class="text-right">${safeParseInt(doc.score)}%</td>
                <td class="table__status-col">${renderStatusIcon(scoreStatus)}</td>
            </tr>
        `;
    }).join('');

    // Re-initialize Lucide icons for status icons
    initLucideIcons(tbody);

    // Add click handlers for checkbox labels to stop propagation (replaces inline onclick)
    tbody.querySelectorAll('.checkbox').forEach(label => {
        label.addEventListener('click', (e) => e.stopPropagation());
    });

    // Add click and keyboard handlers for row selection (not on checkbox)
    tbody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', (e) => {
            // If clicking on checkbox label/input, don't open document
            if (e.target.closest('.checkbox')) {
                return;
            }
            const docId = safeParseInt(row.dataset.documentId);
            if (docId > 0) {
                openValidationView(docId);
            }
        });
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                if (e.target.closest('.checkbox')) return;
                e.preventDefault();
                const docId = safeParseInt(row.dataset.documentId);
                if (docId > 0) {
                    openValidationView(docId);
                }
            }
        });
    });

    // Add checkbox change handlers
    tbody.querySelectorAll('.document-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const docId = safeParseInt(e.target.dataset.docId);
            DocumentSelection.toggle(docId);
        });
    });

    // Setup select all checkbox
    setupSelectAllDocuments();
}

/**
 * Sets up the select all checkbox functionality
 */
function setupSelectAllDocuments() {
    const selectAllCheckbox = safeGetElementById('select-all-documents');
    if (!selectAllCheckbox) return;

    // Remove existing listener to prevent duplicates
    selectAllCheckbox.replaceWith(selectAllCheckbox.cloneNode(true));
    const newCheckbox = safeGetElementById('select-all-documents');

    if (newCheckbox) {
        newCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                DocumentSelection.selectAll();
            } else {
                DocumentSelection.deselectAll();
            }
        });
    }
}

/**
 * Sets up document action buttons
 */
function setupDocumentActions() {
    const newBtn = safeGetElementById('new-document-btn');
    const editBtn = safeGetElementById('edit-document-btn');
    const deleteBtn = safeGetElementById('delete-documents-btn');

    if (newBtn) {
        newBtn.addEventListener('click', () => {
            openModal('new-document-modal');
        });
    }

    const newDocForm = safeGetElementById('new-document-form');
    if (newDocForm) {
        newDocForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(newDocForm);
            const name = formData.get('name');
            showToast(I18n.t('toast.floorPlanCreated', { name: name }), 'success');
            closeModal('new-document-modal');
            newDocForm.reset();
        });
    }

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const selectedIds = Array.from(DocumentSelection.selectedIds);
            if (selectedIds.length === 1) {
                const doc = mockDocuments.find(d => d.id === selectedIds[0]);
                if (doc) {
                    showToast(I18n.t('toast.editComingSoon', { name: doc.name }), 'info');
                }
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const count = DocumentSelection.getSelectedCount();
            if (count > 0) {
                showConfirmModal(
                    I18n.t('action.delete'),
                    I18n.t('toast.deleteFloorPlansConfirm', { count: count }),
                    I18n.t('action.delete'),
                    () => {
                        // Remove selected documents from mockDocuments
                        const selectedIds = Array.from(DocumentSelection.selectedIds);
                        selectedIds.forEach(id => {
                            const index = mockDocuments.findIndex(d => d.id === id);
                            if (index !== -1) {
                                mockDocuments.splice(index, 1);
                            }
                        });

                        // Update document count in tab
                        const countEl = safeGetElementById('tab-documents-count');
                        if (countEl) {
                            const projectDocuments = currentProject
                                ? mockDocuments.filter(doc => doc.projectId === currentProject.id)
                                : mockDocuments;
                            countEl.textContent = projectDocuments.length;
                        }

                        // Re-render and show toast
                        renderDocuments();
                        showToast(I18n.t('toast.floorPlansDeleted', { count: count }), 'success');
                    }
                );
            }
        });
    }
}

// === USER SELECTION STATE ===
const UserSelection = {
    selectedIds: new Set(),

    toggle(id) {
        if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id);
        } else {
            this.selectedIds.add(id);
        }
        this.updateUI();
    },

    selectAll() {
        mockUsers.forEach(user => this.selectedIds.add(user.id));
        this.updateUI();
    },

    deselectAll() {
        this.selectedIds.clear();
        this.updateUI();
    },

    isSelected(id) {
        return this.selectedIds.has(id);
    },

    getSelectedCount() {
        return this.selectedIds.size;
    },

    updateUI() {
        const count = this.getSelectedCount();
        const total = mockUsers.length;

        // Update selected count text
        const countEl = safeGetElementById('users-selected-count');
        if (countEl) {
            countEl.textContent = I18n.t('table.selected', { count: count });
        }

        // Update select all checkbox state
        const selectAllCheckbox = safeGetElementById('select-all-users');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = count === total && total > 0;
            selectAllCheckbox.indeterminate = count > 0 && count < total;
        }

        // Update row checkboxes and styles
        const tbody = safeGetElementById('user-table-body');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(row => {
                const userId = safeParseInt(row.dataset.userId);
                const checkbox = row.querySelector('.user-checkbox');
                const isSelected = this.isSelected(userId);

                if (checkbox) {
                    checkbox.checked = isSelected;
                }
                row.classList.toggle('is-selected', isSelected);
            });
        }

        // Update action buttons
        const editBtn = safeGetElementById('edit-user-btn');
        const deleteBtn = safeGetElementById('delete-users-btn');

        if (editBtn) {
            editBtn.disabled = count !== 1;
        }
        if (deleteBtn) {
            deleteBtn.disabled = count === 0;
        }
    }
};

// === USER RENDERING ===
function renderUsers() {
    const tbody = safeGetElementById('user-table-body');
    if (!tbody) return;

    // Reset selection when re-rendering
    UserSelection.deselectAll();

    tbody.innerHTML = mockUsers.map(user => {
        return `
            <tr data-user-id="${safeParseInt(user.id)}" tabindex="0">
                <td class="table__checkbox-col">
                    <label class="checkbox">
                        <input type="checkbox" class="user-checkbox" data-user-id="${safeParseInt(user.id)}" aria-label="${I18n.t('table.selectAll')}">
                        <span class="checkbox__mark"></span>
                    </label>
                </td>
                <td>${escapeHtml(user.name)}</td>
                <td>${escapeHtml(user.email)}</td>
                <td>${escapeHtml(formatDateTimeDisplay(user.lastActivity))}</td>
            </tr>
        `;
    }).join('');

    // Add click handlers for checkbox labels to stop propagation (replaces inline onclick)
    tbody.querySelectorAll('.checkbox').forEach(label => {
        label.addEventListener('click', (e) => e.stopPropagation());
    });

    // Add checkbox change handlers
    tbody.querySelectorAll('.user-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const userId = safeParseInt(e.target.dataset.userId);
            UserSelection.toggle(userId);
        });
    });

    // Setup select all checkbox
    setupSelectAllUsers();

    // Update tab count
    const tabCountEl = safeGetElementById('tab-users-count');
    if (tabCountEl) {
        tabCountEl.textContent = mockUsers.length;
    }
}

/**
 * Sets up the select all checkbox functionality for users
 */
function setupSelectAllUsers() {
    const selectAllCheckbox = safeGetElementById('select-all-users');
    if (!selectAllCheckbox) return;

    // Remove existing listener to prevent duplicates
    selectAllCheckbox.replaceWith(selectAllCheckbox.cloneNode(true));
    const newCheckbox = safeGetElementById('select-all-users');

    if (newCheckbox) {
        newCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                UserSelection.selectAll();
            } else {
                UserSelection.deselectAll();
            }
        });
    }
}

/**
 * Sets up user action buttons
 */
function setupUserActions() {
    const inviteBtn = safeGetElementById('invite-user-btn');
    const overviewInviteBtn = safeGetElementById('overview-invite-btn');
    const editBtn = safeGetElementById('edit-user-btn');
    const deleteBtn = safeGetElementById('delete-users-btn');

    if (inviteBtn) {
        inviteBtn.addEventListener('click', () => {
            openModal('invite-user-modal');
        });
    }

    if (overviewInviteBtn) {
        overviewInviteBtn.addEventListener('click', () => {
            openModal('invite-user-modal');
        });
    }

    // Overview edit button — inline edit mode within the overview tab
    const overviewEditBtn = safeGetElementById('overview-edit-btn');
    const overviewSaveBtn = safeGetElementById('overview-save-btn');
    const overviewCancelBtn = safeGetElementById('overview-cancel-btn');

    if (overviewEditBtn) {
        overviewEditBtn.addEventListener('click', () => {
            enterOverviewEditMode();
        });
    }

    if (overviewCancelBtn) {
        overviewCancelBtn.addEventListener('click', () => {
            exitOverviewEditMode(false);
        });
    }

    if (overviewSaveBtn) {
        overviewSaveBtn.addEventListener('click', () => {
            saveOverviewChanges();
            exitOverviewEditMode(true);
        });
    }

    const inviteForm = safeGetElementById('invite-user-form');
    if (inviteForm) {
        inviteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(inviteForm);
            const email = formData.get('email');
            const role = formData.get('role');
            const roleLabels = { viewer: I18n.t('role.viewer'), editor: I18n.t('role.editor'), admin: I18n.t('role.admin') };
            showToast(I18n.t('toast.invitationSent', { email: email, role: roleLabels[role] }), 'success');
            closeModal('invite-user-modal');
            inviteForm.reset();
        });
    }

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const selectedIds = Array.from(UserSelection.selectedIds);
            if (selectedIds.length === 1) {
                const user = mockUsers.find(u => u.id === selectedIds[0]);
                if (user) {
                    showToast(I18n.t('toast.userEditComingSoon', { name: user.name }), 'info');
                }
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const count = UserSelection.getSelectedCount();
            if (count > 0) {
                showConfirmModal(
                    I18n.t('action.delete'),
                    I18n.t('toast.deleteUsersConfirm', { count: count }),
                    I18n.t('action.delete'),
                    () => {
                        // Remove selected users from mockUsers
                        const selectedIds = Array.from(UserSelection.selectedIds);
                        selectedIds.forEach(id => {
                            const index = mockUsers.findIndex(u => u.id === id);
                            if (index !== -1) {
                                mockUsers.splice(index, 1);
                            }
                        });

                        // Re-render and show toast
                        renderUsers();
                        showToast(I18n.t('toast.usersRemoved', { count: count }), 'success');
                    }
                );
            }
        });
    }
}

// === RULES RENDERING ===
function renderRules() {
    const tbody = document.getElementById('rules-table-body');
    if (!tbody) return;

    // Get rules from the project's rule set, or first available rule set
    const ruleSetId = currentProject ? currentProject.ruleSetId : 1;
    const ruleSet = mockRuleSets.find(rs => rs.id === ruleSetId);
    const rules = ruleSet ? ruleSet.rules : [];

    tbody.innerHTML = rules.map(rule => {
        return `
            <tr>
                <td><code>${escapeHtml(rule.code)}</code></td>
                <td>${escapeHtml(rule.name)}</td>
                <td><span class="badge badge--secondary">${escapeHtml(rule.category)}</span></td>
                <td>${escapeHtml(rule.description)}</td>
            </tr>
        `;
    }).join('');
}

// === SETTINGS TAB ===
function populateSettings() {
    if (!currentProject) return;

    // General fields
    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value ?? '';
    };
    setVal('settings-project-number', currentProject.number);
    setVal('settings-project-name', currentProject.name);
    setVal('settings-project-phase', currentProject.phase);
    setVal('settings-project-language', currentProject.language);
    setVal('settings-project-status', currentProject.status);

    // Rule set dropdown
    const ruleSelect = document.getElementById('settings-project-ruleset');
    if (ruleSelect) {
        ruleSelect.innerHTML = mockRuleSets.map(rs =>
            `<option value="${rs.id}"${rs.id === currentProject.ruleSetId ? ' selected' : ''}>${escapeHtml(rs.name)}</option>`
        ).join('');
    }

    // Project image preview
    const imgPreview = document.getElementById('settings-project-image-preview');
    if (imgPreview) {
        imgPreview.src = (currentProject.imageUrls && currentProject.imageUrls[0]) || currentProject.imageUrl || '';
    }
}

function setupSettingsHandlers() {
    const controller = getListenerController('settings');
    const signal = controller.signal;

    // Save
    const form = document.getElementById('project-settings-form');
    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentProject) return;

        currentProject.number = document.getElementById('settings-project-number').value;
        currentProject.name = document.getElementById('settings-project-name').value;
        currentProject.phase = document.getElementById('settings-project-phase').value;
        currentProject.language = document.getElementById('settings-project-language').value;
        currentProject.status = document.getElementById('settings-project-status').value;

        const ruleSetVal = document.getElementById('settings-project-ruleset').value;
        currentProject.ruleSetId = parseInt(ruleSetVal, 10);

        // Refresh the detail view with updated data
        openProjectDetail(currentProject.id, true);

        showToast(I18n.t('toast.settingsSaved'), 'success');
    }, { signal });

    // Cancel — reset form to current project values
    document.getElementById('settings-cancel-btn')?.addEventListener('click', () => {
        populateSettings();
        showToast(I18n.t('toast.changesDiscarded'), 'info');
    }, { signal });

    // Archive
    document.getElementById('settings-archive-btn')?.addEventListener('click', () => {
        if (!currentProject) return;
        currentProject.status = 'completed';
        openProjectDetail(currentProject.id, true);
        showToast(I18n.t('toast.projectArchived'), 'success');
    }, { signal });

    // Delete
    document.getElementById('settings-delete-btn')?.addEventListener('click', () => {
        if (!currentProject) return;
        const idx = mockProjects.findIndex(p => p.id === currentProject.id);
        if (idx !== -1) {
            mockProjects.splice(idx, 1);
            currentProject = null;
            switchView('buildings');
            renderProjects();
            showToast(I18n.t('toast.projectDeleted'), 'success');
        }
    }, { signal });

    // Image change
    document.getElementById('settings-project-image-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const imgPreview = document.getElementById('settings-project-image-preview');
            if (imgPreview) imgPreview.src = ev.target.result;
            if (currentProject) {
                if (!currentProject.imageUrls) currentProject.imageUrls = [];
                currentProject.imageUrls[0] = ev.target.result;
            }
        };
        reader.readAsDataURL(file);
    }, { signal });
}

// === VALIDATION VIEW ===
function openValidationView(documentId, skipHashUpdate = false) {
    currentDocument = mockDocuments.find(d => d.id === documentId);
    if (!currentDocument) return;

    // Update breadcrumbs
    document.getElementById('breadcrumb-val-building').textContent = currentProject.internalId + ' – ' + currentProject.name;
    document.getElementById('breadcrumb-val-document').textContent = currentDocument.name;

    // Update step 1 score KPI with current document's score
    const scoreValue = currentDocument.score;
    document.getElementById('step1-score-value').textContent = `${scoreValue}%`;
    const scoreCard = document.getElementById('step1-score-card');
    const scoreClass = getScoreStatus(scoreValue);
    scoreCard.className = `metric-card metric-card--${scoreClass}`;

    // Update step 1 metrics from geometry data
    const docRooms = mockGeometry.filter(g => g.type === 'room' && g.documentId === documentId);
    const docAreas = mockGeometry.filter(g => g.type === 'area' && g.documentId === documentId);
    const docErrors = mockCheckingResults.filter(r => r.documentId === documentId);

    // Room count
    document.getElementById('step1-room-count').textContent = docRooms.length;

    // Calculate NGF (Net Floor Area) - sum of all room areas as approximation
    const totalNGF = docRooms.reduce((sum, r) => sum + r.area, 0);
    document.getElementById('step1-ngf').textContent = totalNGF > 0
        ? `${totalNGF.toLocaleString('de-CH')} m²`
        : '0 m²';

    // Update step 2 metrics
    document.getElementById('step2-dwg-rooms').textContent = docRooms.length;
    document.getElementById('step2-excel-rooms').textContent = docRooms.length; // Same for now (mock)
    document.getElementById('step2-ngf').textContent = totalNGF > 0
        ? `${totalNGF.toLocaleString('de-CH')} m²`
        : '0 m²';

    // Step 2 errors are Excel matching errors (simulated: last N rooms don't match)
    const step2ExcelErrors = Math.min(CONFIG.MAX_EXCEL_ERRORS_SHOWN, docRooms.length);
    document.getElementById('step2-error-count').textContent = step2ExcelErrors;

    // Update error card styling based on error count
    const errorCard = document.getElementById('step2-error-card');
    if (errorCard) {
        errorCard.className = step2ExcelErrors > 0 ? 'metric-card metric-card--error' : 'metric-card';
    }

    // Reset to step 1 (DWG hochladen)
    currentStep = 1;
    updateStepper();

    // Switch view FIRST to make container visible
    if (skipHashUpdate) {
        // Directly switch view without updating hash
        document.querySelectorAll('.view').forEach(view => view.classList.remove('view--active'));
        document.getElementById('view-validation')?.classList.add('view--active');
        currentView = 'validation';
        // Re-initialize Lucide icons
        initLucideIcons(document.getElementById('view-validation'));
    } else {
        switchView('validation');
    }

    // Render content AFTER view is visible
    renderRooms();
    renderAreaPolygons();
    renderErrors();
    updateValidationTabCounts();

    // Initialize the validation view with Canvas viewer
    if (typeof ValidationView !== 'undefined') {
        ValidationView.init(documentId);
    }
}

// === STEPPER NAVIGATION ===
function updateStepper() {
    const stepItems = document.querySelectorAll('.stepper__item');
    const stepper = document.querySelector('.stepper');

    stepItems.forEach((item, index) => {
        const stepNumber = index + 1;

        // Remove all state classes
        item.classList.remove('stepper__item--complete', 'stepper__item--current', 'stepper__item--disabled');

        // Add appropriate class based on current step
        if (stepNumber < currentStep) {
            item.classList.add('stepper__item--complete');
        } else if (stepNumber === currentStep) {
            item.classList.add('stepper__item--current');
        }
        // All steps are clickable
        item.style.cursor = 'pointer';
    });

    // Re-initialize Lucide icons only within the stepper for performance
    initLucideIcons(stepper);

    // Update button states
    updateStepButtons();

    // Update step content visibility
    updateStepContent();
}

function updateStepContent() {
    // Hide all step content containers
    for (let i = 1; i <= 4; i++) {
        const stepContent = document.getElementById(`step-content-${i}`);
        if (stepContent) {
            stepContent.style.display = 'none';
        }
    }

    // Hide step detail content (metrics + tabs + split view)
    const step1DetailContent = document.getElementById('step-1-content');
    const step2DetailContent = document.getElementById('step-2-content');
    if (step1DetailContent) step1DetailContent.style.display = 'none';
    if (step2DetailContent) step2DetailContent.style.display = 'none';

    // Show current step content
    const currentStepContent = document.getElementById(`step-content-${currentStep}`);
    if (currentStepContent) {
        currentStepContent.style.display = 'block';
    }

    // Step 1 shows the detailed floor plan viewer
    if (currentStep === 1) {
        if (step1DetailContent) {
            step1DetailContent.style.display = 'block';
        }
    }

    // Step 2 shows the room matching validation
    if (currentStep === 2) {
        if (step2DetailContent) {
            step2DetailContent.style.display = 'block';
        }
        renderStep2Rooms();
        renderStep2Errors();
    }
}

function updateStepButtons() {
    const prevBtn = document.getElementById('prev-step-btn');
    const nextBtn = document.getElementById('next-step-btn');

    if (prevBtn) {
        prevBtn.disabled = currentStep === 1;
        prevBtn.style.opacity = currentStep === 1 ? '0.5' : '1';
        prevBtn.style.cursor = currentStep === 1 ? 'not-allowed' : 'pointer';
    }

    if (nextBtn) {
        // Update button text based on current step
        if (currentStep === 4) {
            nextBtn.textContent = I18n.t('nav.completeOrder');
        } else {
            nextBtn.textContent = I18n.t('nav.nextStep');
        }
    }
}

function navigateToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > 4) return;

    currentStep = stepNumber;
    updateStepper();

    // Show toast notification
    const stepNames = [
        I18n.t('stepper.step1'),
        I18n.t('stepper.step2'),
        I18n.t('stepper.step3'),
        I18n.t('stepper.step4')
    ];

    showToast(I18n.t('toast.stepInfo', { step: stepNumber, name: stepNames[stepNumber - 1] }), 'info');
}

function previousStep() {
    if (currentStep > 1) {
        navigateToStep(currentStep - 1);
    }
}

function nextStep() {
    if (currentStep < 4) {
        navigateToStep(currentStep + 1);
    } else if (currentStep === 4) {
        // On final step, go to results view
        switchView('results');
        renderPieChart();
        showToast(I18n.t('toast.validationDone'), 'success');
    }
}

// === ROOM RENDERING ===
function renderRooms() {
    const tbody = document.getElementById('room-table-body');
    if (!tbody) return;

    // Filter rooms for current document
    const documentRooms = currentDocument
        ? mockGeometry.filter(g => g.type === 'room' && g.documentId === currentDocument.id)
        : mockGeometry.filter(g => g.type === 'room');

    tbody.innerHTML = documentRooms.map(room => {
        return `
            <tr>
                <td>${escapeHtml(room.aoid)}</td>
                <td class="text-right">${Math.round(room.area || 0)}</td>
                <td>${escapeHtml(room.aofunction)}</td>
                <td class="text-center">${renderStatusIcon(room.status)}</td>
            </tr>
        `;
    }).join('');

    // Re-initialize Lucide icons only within the table for performance
    initLucideIcons(tbody);
}

// === ERROR RENDERING ===
function renderErrors() {
    const errorList = document.getElementById('error-list');
    if (!errorList) return;

    // Filter checking results for current document
    const documentErrors = currentDocument
        ? mockCheckingResults.filter(r => r.documentId === currentDocument.id)
        : mockCheckingResults;

    const validSeverities = ['error', 'warning', 'info'];
    errorList.innerHTML = documentErrors.map(error => {
        const severity = validSeverities.includes(error.severity) ? error.severity : 'error';
        return `
            <div class="error-item error-item--${severity}">
                <div class="error-item__header">
                    <span class="error-item__code">${escapeHtml(error.ruleCode)}</span>
                    <span class="error-item__severity error-item__severity--${severity}">${escapeHtml(error.severity)}</span>
                </div>
                <div class="error-item__message">${escapeHtml(error.message)}</div>
            </div>
        `;
    }).join('');
}

// === AREA POLYGONS RENDERING ===
function renderAreaPolygons() {
    const tbody = document.getElementById('area-polygons-table-body');
    if (!tbody) return;

    // Filter areas for current document
    const documentAreas = currentDocument
        ? mockGeometry.filter(g => g.type === 'area' && g.documentId === currentDocument.id)
        : mockGeometry.filter(g => g.type === 'area');

    tbody.innerHTML = documentAreas.map(polygon => {
        return `
            <tr>
                <td>${escapeHtml(polygon.aoid)}</td>
                <td class="text-right">${Math.round(polygon.area || 0).toLocaleString('de-CH')}</td>
                <td>${escapeHtml(polygon.aofunction)}</td>
                <td class="text-center">${renderStatusIcon(polygon.status)}</td>
            </tr>
        `;
    }).join('');

    // Re-initialize Lucide icons only within the table for performance
    initLucideIcons(tbody);
}

// === TAB COUNT UPDATES ===
function updateValidationTabCounts() {
    const docId = currentDocument ? currentDocument.id : null;

    // Count rooms for current document
    const roomCount = docId
        ? mockGeometry.filter(g => g.type === 'room' && g.documentId === docId).length
        : mockGeometry.filter(g => g.type === 'room').length;

    // Count areas for current document
    const areaCount = docId
        ? mockGeometry.filter(g => g.type === 'area' && g.documentId === docId).length
        : mockGeometry.filter(g => g.type === 'area').length;

    // Count errors for current document
    const errorCount = docId
        ? mockCheckingResults.filter(r => r.documentId === docId).length
        : mockCheckingResults.length;

    // Count layers (static mock)
    const layerCount = 9;

    // Count rules from project's rule set
    const ruleSetId = currentProject ? currentProject.ruleSetId : 1;
    const ruleSet = mockRuleSets.find(rs => rs.id === ruleSetId);
    const rulesCount = ruleSet ? ruleSet.rules.length : 0;

    // Update Step 1 (validation view) tab counts
    const valLayersCount = document.getElementById('val-tab-layers-count');
    const valRoomsCount = document.getElementById('val-tab-rooms-count');
    const valAreasCount = document.getElementById('val-tab-areas-count');
    const valErrorsCount = document.getElementById('val-tab-errors-count');
    const valRulesCount = document.getElementById('val-tab-rules-count');

    if (valLayersCount) valLayersCount.textContent = layerCount;
    if (valRoomsCount) valRoomsCount.textContent = roomCount;
    if (valAreasCount) valAreasCount.textContent = areaCount;
    if (valErrorsCount) valErrorsCount.textContent = errorCount;
    if (valRulesCount) valRulesCount.textContent = rulesCount;

    // Update Step 2 tab counts
    // Step 2 errors are simulated Excel matching errors (last N rooms don't match)
    const step2ExcelErrorCount = Math.min(CONFIG.MAX_EXCEL_ERRORS_SHOWN, roomCount);
    const step2RoomsCount = document.getElementById('step2-tab-rooms-count');
    const step2ErrorsCount = document.getElementById('step2-tab-errors-count');

    if (step2RoomsCount) step2RoomsCount.textContent = roomCount;
    if (step2ErrorsCount) step2ErrorsCount.textContent = step2ExcelErrorCount;
}

// === STEP 2 RENDERING ===
function renderStep2Rooms() {
    const tbody = document.getElementById('step2-room-table-body');
    if (!tbody) return;

    // Filter rooms for current document
    const rooms = currentDocument
        ? mockGeometry.filter(g => g.type === 'room' && g.documentId === currentDocument.id)
        : mockGeometry.filter(g => g.type === 'room');

    tbody.innerHTML = rooms.map((room, index) => {
        // Simulate Excel matching - last N rooms don't match
        const hasExcelMatch = index < rooms.length - CONFIG.MAX_EXCEL_ERRORS_SHOWN;
        const matchStatus = hasExcelMatch ? 'ok' : 'error';

        return `
            <tr>
                <td class="text-center">${renderStatusIcon(matchStatus)}</td>
                <td>${escapeHtml(room.aoid)}</td>
                <td>Raum ${escapeHtml(room.aoid)}</td>
                <td class="text-right">${Math.round(room.area || 0)}</td>
                <td>${escapeHtml(room.aofunction)}</td>
            </tr>
        `;
    }).join('');

    // Re-initialize Lucide icons only within the table for performance
    initLucideIcons(tbody);
}

function renderStep2Errors() {
    // Excel matching errors
    const excelErrors = [
        {
            code: 'EXCEL-001',
            severity: 'error',
            message: 'Raum "EG-022" aus DWG nicht in Excel-Raumliste gefunden. Bitte Raumliste ergänzen.'
        },
        {
            code: 'EXCEL-002',
            severity: 'error',
            message: 'Raum "EG-021" aus DWG nicht in Excel-Raumliste gefunden. Bitte Raumliste ergänzen.'
        },
        {
            code: 'EXCEL-003',
            severity: 'error',
            message: 'Raum "EG-020" aus DWG nicht in Excel-Raumliste gefunden. Bitte Raumliste ergänzen.'
        }
    ];

    const tbody = document.getElementById('step2-error-table-body');
    if (!tbody) return;

    tbody.innerHTML = excelErrors.map(error => {
        const severity = ['error', 'warning', 'info'].includes(error.severity) ? error.severity : 'error';
        return `
            <tr>
                <td class="text-center">${renderStatusIcon(severity)}</td>
                <td>${escapeHtml(error.code)}</td>
                <td>${escapeHtml(error.message)}</td>
            </tr>
        `;
    }).join('');

    initLucideIcons(tbody);
}

// === PIE CHART RENDERING ===
function renderPieChart() {
    const slicesGroup = document.getElementById('pie-chart-slices');
    const legend = document.getElementById('pie-legend');

    if (!slicesGroup || !legend) return;

    const data = [
        { label: 'HNF (Primary use area)', value: 3200, color: '#2E7D32' },
        { label: 'NNF (Secondary use area)', value: 400, color: '#558B2F' },
        { label: 'VF (Circulation area)', value: 300, color: '#7CB342' },
        { label: 'FF (Functional area)', value: 100, color: '#AED581' },
        { label: 'KF (Construction area)', value: 500, color: '#C5E1A5' }
    ];

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const radius = 120;
    const centerX = 150;
    const centerY = 150;

    let currentAngle = -90; // Start at top

    slicesGroup.innerHTML = data.map(item => {
        const percentage = (item.value / total) * 100;
        const angle = (percentage / 100) * 360;
        const endAngle = currentAngle + angle;

        const startRad = (currentAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = centerX + radius * Math.cos(startRad);
        const y1 = centerY + radius * Math.sin(startRad);
        const x2 = centerX + radius * Math.cos(endRad);
        const y2 = centerY + radius * Math.sin(endRad);

        const largeArc = angle > 180 ? 1 : 0;

        const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

        currentAngle = endAngle;

        return `<path d="${path}" fill="${item.color}" stroke="white" stroke-width="2"/>`;
    }).join('');

    legend.innerHTML = data.map(item => {
        const percentage = ((item.value / total) * 100).toFixed(1);
        return `
            <div class="pie-chart__legend-item">
                <div class="pie-chart__legend-color" style="background: ${item.color}"></div>
                <span>${item.label}: ${percentage}%</span>
            </div>
        `;
    }).join('');
}

// === TAB SWITCHING ===
function setupTabs() {
    // Get AbortController for cleanup on re-initialization
    const controller = getListenerController('tabs');
    const signal = controller.signal;

    // Project detail tabs (overview, documents, rules)
    setupTabGroup('data-tab', 'tab-', ['tab-overview', 'tab-documents', 'tab-rules'], signal);

    // Validation view tabs - Step 1 (overview, rooms, areas, errors, rules)
    setupTabGroup('data-val-tab', 'val-tab-', ['val-tab-overview', 'val-tab-rooms', 'val-tab-areas', 'val-tab-errors', 'val-tab-rules'], signal);

    // Step 2 tabs (rooms, errors)
    setupTabGroup('data-step2-tab', 'step2-tab-', ['step2-tab-rooms', 'step2-tab-errors'], signal);
}

// === PROJECT SEARCH ===
function setupSearch() {
    const searchInput = document.getElementById('project-search');
    if (searchInput) {
        // Debounce search to avoid excessive DOM queries on every keystroke
        const handleSearch = debounce((query) => {
            const lowerQuery = query.toLowerCase();
            document.querySelectorAll('.card').forEach(card => {
                const titleEl = card.querySelector('.card__title');
                const metaEl = card.querySelector('.card__meta');
                const title = titleEl ? titleEl.textContent.toLowerCase() : '';
                const meta = metaEl ? metaEl.textContent.toLowerCase() : '';
                if (title.includes(lowerQuery) || meta.includes(lowerQuery)) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        }, 300);

        searchInput.addEventListener('input', (e) => {
            handleSearch(e.target.value);
        });
    }
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    // Header brand navigation to dashboard
    const headerBrand = document.getElementById('header-brand-link');
    if (headerBrand) {
        headerBrand.addEventListener('click', (e) => {
            e.preventDefault();
            // Close API docs if visible
            var apiContainer = document.getElementById('api-docs-container');
            if (apiContainer && apiContainer.style.display !== 'none') {
                apiContainer.style.display = 'none';
                document.querySelector('main').style.display = '';
                document.querySelector('.footer').style.display = '';
            }
            const currentView = document.querySelector('.view--active').id;
            if (currentView !== 'view-login') {
                switchView('buildings');
                renderProjects();
            }
        });
    }

    // Login form
    const loginForm = document.querySelector('.login__form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            switchView('buildings');
            renderProjects();
        });
    }

    // Demo button in header (visible only on login view)
    const demoBtn = document.getElementById('demo-btn');
    if (demoBtn) {
        demoBtn.addEventListener('click', () => {
            switchView('buildings');
            renderProjects();
        });
    }

    // User icon → navigate to login (simulate logout)
    const userMenuBtn = document.getElementById('user-menu-btn');
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', () => {
            switchView('login');
        });
    }

    // Back to projects from project detail
    const backBtn = document.getElementById('back-to-overview');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            switchView('buildings');
            renderProjects();
        });
    }

    // Back to project detail from validation view
    const backToProjectBtn = document.getElementById('back-to-project');
    if (backToProjectBtn) {
        backToProjectBtn.addEventListener('click', () => {
            switchView('building-detail');
        });
    }

    // Back to project detail from results view
    const backToProjectResultsBtn = document.getElementById('back-to-project-results');
    if (backToProjectResultsBtn) {
        backToProjectResultsBtn.addEventListener('click', () => {
            switchView('building-detail');
        });
    }

    // Footer API docs link
    const navApiLink = document.getElementById('nav-api');
    if (navApiLink) {
        navApiLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelector('main').style.display = 'none';
            document.querySelector('.footer').style.display = 'none';
            initApiDocs();
        });
    }

    // Breadcrumb navigation
    document.querySelectorAll('#breadcrumb-buildings, #breadcrumb-val-buildings, #breadcrumb-results-buildings').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('buildings');
            renderProjects();
        });
    });

    document.querySelectorAll('#breadcrumb-val-building, #breadcrumb-results-building').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('building-detail');
        });
    });

    // Workflow navigation buttons
    document.getElementById('prev-step-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        previousStep();
    });

    document.getElementById('next-step-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        nextStep();
    });

    // Stepper item click navigation
    document.querySelectorAll('.stepper__item').forEach((item, index) => {
        item.addEventListener('click', () => {
            const stepNumber = index + 1;
            navigateToStep(stepNumber);
        });
    });

    // View toggle with accessibility support (grid / list / map / dashboard)
    document.querySelectorAll('.view-toggle__btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-toggle__btn').forEach(b => {
                b.classList.remove('seg-btn--active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('seg-btn--active');
            btn.setAttribute('aria-pressed', 'true');

            const viewType = btn.dataset.view;
            const cardGrid = document.getElementById('project-grid');
            const mapContainer = document.getElementById('project-map');
            const dashboardContainer = document.getElementById('project-dashboard');
            const searchWrapper = document.querySelector('.search');

            // Hide all project-view containers
            if (cardGrid) cardGrid.style.display = 'none';
            if (mapContainer) mapContainer.style.display = 'none';
            if (dashboardContainer) dashboardContainer.style.display = 'none';
            if (cardGrid) cardGrid.classList.remove('card-grid--list');

            switch (viewType) {
                case 'grid':
                    if (cardGrid) cardGrid.style.display = '';
                    destroyProjectMap();
                    break;
                case 'list':
                    if (cardGrid) {
                        cardGrid.style.display = '';
                        cardGrid.classList.add('card-grid--list');
                    }
                    destroyProjectMap();
                    break;
                case 'map':
                    if (mapContainer) mapContainer.style.display = '';
                    initProjectMap();
                    if (projectMap) projectMap.resize();
                    break;
                case 'dashboard':
                    if (dashboardContainer) {
                        dashboardContainer.style.display = '';
                        renderDashboard();
                    }
                    destroyProjectMap();
                    break;
            }

            // Update URL with current view type
            updateUrlHash();
        });
    });

    // File upload handlers
    setupFileUploads();
}

// === FILE UPLOAD ===
function setupFileUploads() {
    // DWG file upload
    const dwgInput = document.getElementById('dwg-file-input');
    const dwgBtn = document.getElementById('dwg-select-btn');
    const dwgZone = document.getElementById('dwg-upload-zone');

    if (dwgBtn && dwgInput) {
        dwgBtn.addEventListener('click', () => dwgInput.click());
        dwgZone.addEventListener('click', (e) => {
            if (e.target !== dwgBtn) dwgInput.click();
        });
        dwgInput.addEventListener('change', (e) => handleFileSelect(e, 'dwg'));
    }

    // Excel file upload
    const excelInput = document.getElementById('excel-file-input');
    const excelBtn = document.getElementById('excel-select-btn');
    const excelZone = document.getElementById('excel-upload-zone');

    if (excelBtn && excelInput) {
        excelBtn.addEventListener('click', () => excelInput.click());
        excelZone.addEventListener('click', (e) => {
            if (e.target !== excelBtn) excelInput.click();
        });
        excelInput.addEventListener('change', (e) => handleFileSelect(e, 'excel'));
    }
}

function handleFileSelect(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size based on type
    const maxSize = type === 'dwg' ? CONFIG.MAX_DWG_SIZE : CONFIG.MAX_EXCEL_SIZE;
    if (file.size > maxSize) {
        showToast(I18n.t(type === 'dwg' ? 'toast.dwgTooLarge' : 'toast.excelTooLarge', { size: formatFileSize(maxSize) }), 'error');
        event.target.value = '';
        return;
    }

    const fileSize = formatFileSize(file.size);
    const sanitizedName = sanitizeFilename(file.name);

    if (type === 'dwg') {
        const nameEl = document.getElementById('dwg-file-name');
        const sizeEl = document.getElementById('dwg-file-size');
        const uploadedEl = document.getElementById('dwg-uploaded-file');
        if (nameEl) nameEl.textContent = sanitizedName;
        if (sizeEl) sizeEl.textContent = fileSize;
        if (uploadedEl) uploadedEl.style.display = 'block';
        showToast(I18n.t('toast.dwgSelected', { name: sanitizedName }), 'success');
    } else if (type === 'excel') {
        const nameEl = document.getElementById('excel-file-name');
        const sizeEl = document.getElementById('excel-file-size');
        const uploadedEl = document.getElementById('excel-uploaded-file');
        if (nameEl) nameEl.textContent = sanitizedName;
        if (sizeEl) sizeEl.textContent = fileSize;
        if (uploadedEl) uploadedEl.style.display = 'block';
        showToast(I18n.t('toast.excelSelected', { name: sanitizedName }), 'success');
    }
}

function formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(CONFIG.BYTES_PER_KB));
    if (i >= sizes.length) return 'File too large';
    return parseFloat((bytes / Math.pow(CONFIG.BYTES_PER_KB, i)).toFixed(2)) + ' ' + sizes[i];
}

// === TOAST NOTIFICATIONS ===
function showToast(message, type = 'info') {
    const validTypes = ['info', 'success', 'warning', 'error'];
    const toastType = validTypes.includes(type) ? type : 'info';

    const toast = document.createElement('div');
    toast.className = `toast toast--${toastType}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message; // textContent is safe from XSS
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, CONFIG.TOAST_DURATION_MS);
}

// === ENHANCED INTERACTIONS ===
let _interactionsInitialized = false;

function enhanceInteractions() {
    // Only initialize once - use event delegation for dynamic content
    if (_interactionsInitialized) return;
    _interactionsInitialized = true;

    // Add ripple effect to buttons using event delegation
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.btn');
        if (!btn) return;

        const ripple = document.createElement('span');
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.5);
            left: ${x}px;
            top: ${y}px;
            pointer-events: none;
            animation: ripple ${CONFIG.RIPPLE_ANIMATION_MS / 1000}s ease-out;
        `;

        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), CONFIG.RIPPLE_ANIMATION_MS);
    });

    // Room table hover using event delegation (works with dynamically rendered rows)
    const roomTableBody = document.getElementById('room-table-body');
    if (roomTableBody) {
        roomTableBody.addEventListener('mouseenter', (e) => {
            const row = e.target.closest('tr');
            if (!row) return;
            const index = Array.from(roomTableBody.children).indexOf(row);
            const rooms = document.querySelectorAll('.floorplan__room');
            if (rooms[index]) {
                rooms[index].classList.add('floorplan__room--selected');
            }
        }, true); // Use capture phase for delegation

        roomTableBody.addEventListener('mouseleave', (e) => {
            const row = e.target.closest('tr');
            if (!row) return;
            document.querySelectorAll('.floorplan__room').forEach(r => {
                r.classList.remove('floorplan__room--selected');
            });
        }, true);
    }

    // Error item clicks using event delegation
    document.addEventListener('click', (e) => {
        const errorItem = e.target.closest('.error-item');
        if (errorItem) {
            showToast(I18n.t('toast.errorHighlighted'), 'info');
        }
    });
}

// === KEYBOARD SHORTCUTS ===
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K for search focus
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('project-search');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }

        // Escape to close/go back
        if (e.key === 'Escape') {
            // Don't navigate if a modal is open (modal handler closes it)
            const openModal = document.querySelector('.modal:not([hidden])');
            if (openModal) return;

            // Don't navigate if the lightbox is open (lightbox handler closes it)
            const lightbox = document.getElementById('image-lightbox');
            if (lightbox && !lightbox.hidden) return;

            if (currentView !== 'login' && currentView !== 'buildings') {
                switchView('buildings');
            }
        }
    });
}

// === API DOCUMENTATION ===

const API_METHOD_COLORS = {
    get: 'success',
    post: 'primary',
    put: 'warning',
    delete: 'error',
    patch: 'warning'
};

function apiResolveRef(spec, ref) {
    const path = ref.replace('#/', '').split('/');
    let obj = spec;
    for (const key of path) {
        if (obj === undefined || obj === null) return null;
        obj = obj[key];
    }
    return obj || null;
}

function apiResolveSchema(spec, schema) {
    if (!schema) return null;
    if (schema.$ref) return apiResolveRef(spec, schema.$ref);
    return schema;
}

function apiSchemaToExample(spec, schema, depth) {
    if (depth === undefined) depth = 0;
    if (!schema || depth > 5) return null;
    if (schema.$ref) {
        schema = apiResolveRef(spec, schema.$ref);
        if (!schema) return null;
    }
    if (schema.example !== undefined) return schema.example;

    if (schema.type === 'object' && schema.properties) {
        var obj = {};
        for (var key of Object.keys(schema.properties)) {
            obj[key] = apiSchemaToExample(spec, schema.properties[key], depth + 1);
        }
        return obj;
    }
    if (schema.type === 'array' && schema.items) {
        return [apiSchemaToExample(spec, schema.items, depth + 1)];
    }
    if (schema.enum) return schema.enum[0];

    var defaults = { string: 'string', integer: 0, number: 0.0, boolean: true };
    return defaults[schema.type] !== undefined ? defaults[schema.type] : null;
}

function apiRenderSchemaProps(spec, schema) {
    if (!schema) return '';
    if (schema.$ref) schema = apiResolveRef(spec, schema.$ref);
    if (schema.type !== 'object' || !schema.properties) return '';

    var rows = '';
    for (var name of Object.keys(schema.properties)) {
        var prop = schema.properties[name];
        var resolved = prop.$ref ? apiResolveRef(spec, prop.$ref) : prop;
        var type = resolved.type || 'object';
        if (resolved.format) type += ' (' + resolved.format + ')';
        if (resolved.enum) type = resolved.enum.join(' | ');
        if (resolved.type === 'array') {
            var itemType = resolved.items && resolved.items.$ref
                ? resolved.items.$ref.split('/').pop()
                : (resolved.items && resolved.items.type) || 'object';
            type = itemType + '[]';
        }
        var required = schema.required && schema.required.includes(name) ? '<span class="api-docs__required">required</span>' : '';
        var desc = resolved.description || '';
        rows += '<tr>' +
            '<td><code>' + escapeHtml(name) + '</code> ' + required + '</td>' +
            '<td class="api-docs__type">' + escapeHtml(type) + '</td>' +
            '<td>' + escapeHtml(desc) + '</td>' +
            '</tr>';
    }
    return '<table class="api-docs__schema"><thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function apiRenderEndpoint(spec, method, path, op) {
    var colorClass = API_METHOD_COLORS[method] || 'primary';
    var id = op.operationId || (method + '-' + path.replace(/[^a-z0-9]/gi, '-'));

    // Parameters
    var paramsHtml = '';
    if (op.parameters && op.parameters.length) {
        var paramRows = '';
        for (var p of op.parameters) {
            var s = p.schema || {};
            paramRows += '<tr>' +
                '<td><code>' + escapeHtml(p.name) + '</code>' + (p.required ? ' <span class="api-docs__required">required</span>' : '') + '</td>' +
                '<td class="api-docs__type">' + escapeHtml(s.type || 'string') + (s.format ? ' (' + escapeHtml(s.format) + ')' : '') + '</td>' +
                '<td>' + escapeHtml(p.in) + '</td>' +
                '<td>' + escapeHtml(p.description || '') + '</td>' +
                '</tr>';
        }
        paramsHtml = '<div class="api-docs__section-label">Parameter</div>' +
            '<table class="api-docs__schema"><thead><tr><th>Name</th><th>Type</th><th>In</th><th>Description</th></tr></thead><tbody>' + paramRows + '</tbody></table>';
    }

    // Request body
    var bodyHtml = '';
    if (op.requestBody) {
        var content = op.requestBody.content;
        var contentType = Object.keys(content)[0];
        var bodySchema = content[contentType] && content[contentType].schema;
        if (bodySchema) {
            bodyHtml = '<div class="api-docs__section-label">Request Body <span class="api-docs__content-type">' + contentType + '</span></div>';
            bodyHtml += apiRenderSchemaProps(spec, bodySchema);
        }
    }

    // Responses
    var responsesHtml = '';
    for (var code of Object.keys(op.responses)) {
        var resp = op.responses[code];
        var statusClass = code.startsWith('2') ? 'success' : code.startsWith('4') ? 'error' : 'warning';
        responsesHtml += '<div class="api-docs__response">' +
            '<span class="api-docs__status api-docs__status--' + statusClass + '">' + code + '</span>' +
            '<span>' + escapeHtml(resp.description) + '</span>' +
            '</div>';

        var respContent = resp.content;
        if (respContent) {
            var ct = Object.keys(respContent)[0];
            var respSchema = respContent[ct] && respContent[ct].schema;
            if (respSchema && ct === 'application/json') {
                var resolved = apiResolveSchema(spec, respSchema);
                if (resolved) {
                    responsesHtml += apiRenderSchemaProps(spec, resolved);
                    var example = apiSchemaToExample(spec, resolved);
                    if (example) {
                        responsesHtml += '<pre class="api-docs__example">' + JSON.stringify(example, null, 2) + '</pre>';
                    }
                }
            }
        }
    }

    // cURL example
    var baseUrl = (spec.servers && spec.servers[0] && spec.servers[0].url) || 'https://api.example.com';
    var curl = 'curl -X ' + method.toUpperCase() + ' "' + baseUrl + path + '"';
    curl += ' \\\n  -H "X-API-Key: YOUR_API_KEY"';
    if (op.requestBody) {
        var reqCt = Object.keys(op.requestBody.content)[0];
        if (reqCt === 'application/json') {
            curl += ' \\\n  -H "Content-Type: application/json"';
            var reqBodySchema = op.requestBody.content[reqCt] && op.requestBody.content[reqCt].schema;
            var bodyExample = reqBodySchema ? apiSchemaToExample(spec, reqBodySchema) : {};
            curl += " \\\n  -d '" + JSON.stringify(bodyExample, null, 2) + "'";
        } else if (reqCt === 'multipart/form-data') {
            curl += ' \\\n  -F "file=@grundriss.dwg"';
        }
    }

    var pathHighlighted = path.replace(/\{(\w+)\}/g, '<span class="api-docs__param">{$1}</span>');

    return '<div class="api-docs__endpoint" id="' + id + '">' +
        '<div class="api-docs__endpoint-header" data-toggle="' + id + '-detail">' +
            '<span class="api-docs__method api-docs__method--' + colorClass + '">' + method.toUpperCase() + '</span>' +
            '<span class="api-docs__path">' + pathHighlighted + '</span>' +
            '<span class="api-docs__summary">' + escapeHtml(op.summary || '') + '</span>' +
            '<svg class="api-docs__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</div>' +
        '<div class="api-docs__detail" id="' + id + '-detail">' +
            (op.description ? '<p class="api-docs__desc">' + escapeHtml(op.description) + '</p>' : '') +
            paramsHtml +
            bodyHtml +
            '<div class="api-docs__section-label">Responses</div>' +
            responsesHtml +
            '<div class="api-docs__section-label">Example</div>' +
            '<pre class="api-docs__example">' + escapeHtml(curl) + '</pre>' +
        '</div>' +
    '</div>';
}

async function initApiDocs() {
    var resp = await fetch('data/openapi.json');
    var spec = await resp.json();

    var container = document.getElementById('api-docs-container');
    container.style.display = 'block';

    // Group endpoints by tag
    var tagGroups = {};
    if (spec.tags) {
        for (var tag of spec.tags) {
            tagGroups[tag.name] = { description: tag.description, endpoints: [] };
        }
    }

    for (var path of Object.keys(spec.paths)) {
        var methods = spec.paths[path];
        for (var method of Object.keys(methods)) {
            var op = methods[method];
            var tag = (op.tags && op.tags[0]) || 'General';
            if (!tagGroups[tag]) tagGroups[tag] = { description: '', endpoints: [] };
            tagGroups[tag].endpoints.push({ method: method, path: path, op: op });
        }
    }

    // Render
    var contentHtml = '';

    // Header section
    contentHtml += '<div class="api-docs__hero">' +
        '<h1 class="api-docs__title">' + spec.info.title + '</h1>' +
        '<div class="api-docs__meta">' +
            '<span class="api-docs__version">v' + spec.info.version + '</span>' +
            '<span class="api-docs__server">' + ((spec.servers && spec.servers[0] && spec.servers[0].url) || '') + '</span>' +
        '</div>' +
        '<p class="api-docs__intro">' + spec.info.description + '</p>' +
    '</div>';

    // Auth section
    var authBaseUrl = (spec.servers && spec.servers[0] && spec.servers[0].url) || '';
    contentHtml += '<div class="api-docs__auth" id="auth">' +
        '<h2 class="api-docs__group-title">Authentication</h2>' +
        '<p>All requests require an API key in the <code>X-API-Key</code> header. Keys can be requested through the BBL portal.</p>' +
        '<pre class="api-docs__example">curl -H "X-API-Key: YOUR_API_KEY" ' + authBaseUrl + '/health</pre>' +
    '</div>';

    for (var tagName of Object.keys(tagGroups)) {
        var group = tagGroups[tagName];
        var tagId = tagName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        var endpointsHtml = '';
        for (var ep of group.endpoints) {
            endpointsHtml += apiRenderEndpoint(spec, ep.method, ep.path, ep.op);
        }
        contentHtml += '<div class="api-docs__group" id="tag-' + tagId + '">' +
            '<h2 class="api-docs__group-title">' + tagName + '</h2>' +
            (group.description ? '<p class="api-docs__group-desc">' + escapeHtml(group.description) + '</p>' : '') +
            endpointsHtml +
        '</div>';
    }

    container.innerHTML = '<div class="api-docs__main">' + contentHtml + '</div>';

    // Collapse/expand handlers
    container.querySelectorAll('.api-docs__endpoint-header').forEach(function(header) {
        header.addEventListener('click', function() {
            var targetId = header.dataset.toggle;
            var detail = document.getElementById(targetId);
            var endpoint = header.closest('.api-docs__endpoint');
            if (detail) {
                detail.classList.toggle('open');
                endpoint.classList.toggle('expanded');
            }
        });
    });

}

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', async () => {
    // Load data from JSON files first
    await loadData();

    // Initialize i18n
    await I18n.init();

    setupEventListeners();
    setupTabs();
    setupSearch();
    setupKeyboardShortcuts();
    setupRouting();
    setupModals();
    setupDocumentActions();
    setupUserActions();
    setupSettingsHandlers();
    initFilters();

    // Initialize Lucide icons (global initialization on page load)
    initLucideIcons();

    // Default to login view if no valid hash
    // Note: setupRouting() already handles hash-based navigation on page load,
    // so we only need to set the default view when there's no hash
    const hash = window.location.hash;
    if (!hash || hash === '#/login' || hash === '#/' || hash === '#') {
        switchView('login');
    }
    // Navigation for other hashes is handled by setupRouting() to avoid race conditions

    // Add welcome message
    console.log('%c BBL Plan-Check Area Management ', 'background: #DC0018; color: white; font-size: 14px; padding: 4px 8px;');
    console.log('%c Prototype v1.0 - Swiss Federal Design System ', 'background: #006699; color: white; font-size: 12px; padding: 4px 8px;');

    // Language selector
    document.querySelectorAll('.lang-selector__item').forEach(function(btn) {
        btn.addEventListener('click', function() {
            I18n.setLocale(btn.getAttribute('data-lang'));
        });
    });

    // Enhance interactions - now uses event delegation so no delay needed
    enhanceInteractions();
});
