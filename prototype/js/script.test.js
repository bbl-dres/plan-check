// ========================================
// BBL Prüfplattform Flächenmanagement
// Unit Tests for Critical Functions
// ========================================

/**
 * Simple test runner for browser-based testing
 * Run by opening test.html in a browser or via Node.js with jsdom
 */

const TestRunner = {
    passed: 0,
    failed: 0,
    results: [],

    assert(condition, message) {
        if (condition) {
            this.passed++;
            this.results.push({ status: 'PASS', message });
        } else {
            this.failed++;
            this.results.push({ status: 'FAIL', message });
            console.error(`FAIL: ${message}`);
        }
    },

    assertEqual(actual, expected, message) {
        const condition = actual === expected;
        this.assert(condition, `${message} - Expected: ${expected}, Got: ${actual}`);
    },

    assertNotNull(value, message) {
        this.assert(value !== null && value !== undefined, `${message} - Value should not be null/undefined`);
    },

    run(testSuite) {
        console.log(`\n=== Running ${testSuite.name} ===\n`);
        for (const [testName, testFn] of Object.entries(testSuite.tests)) {
            try {
                testFn();
                console.log(`✓ ${testName}`);
            } catch (error) {
                this.failed++;
                this.results.push({ status: 'ERROR', message: `${testName}: ${error.message}` });
                console.error(`✗ ${testName}: ${error.message}`);
            }
        }
    },

    summary() {
        console.log(`\n=== Test Summary ===`);
        console.log(`Passed: ${this.passed}`);
        console.log(`Failed: ${this.failed}`);
        console.log(`Total:  ${this.passed + this.failed}`);
        return this.failed === 0;
    }
};

// === SECURITY UTILITY TESTS ===
const SecurityTests = {
    name: 'Security Utilities',
    tests: {
        'escapeHtml should escape HTML special characters': () => {
            TestRunner.assertEqual(
                escapeHtml('<script>alert("xss")</script>'),
                '&lt;script&gt;alert("xss")&lt;/script&gt;',
                'HTML tags should be escaped'
            );
        },

        'escapeHtml should handle ampersands': () => {
            TestRunner.assertEqual(
                escapeHtml('Tom & Jerry'),
                'Tom &amp; Jerry',
                'Ampersands should be escaped'
            );
        },

        'escapeHtml should handle quotes': () => {
            TestRunner.assertEqual(
                escapeHtml('Say "hello"'),
                'Say "hello"',
                'Double quotes should be preserved (textContent handles them)'
            );
        },

        'escapeHtml should handle null and undefined': () => {
            TestRunner.assertEqual(escapeHtml(null), '', 'Null should return empty string');
            TestRunner.assertEqual(escapeHtml(undefined), '', 'Undefined should return empty string');
        },

        'escapeHtml should handle numbers': () => {
            TestRunner.assertEqual(escapeHtml(42), '42', 'Numbers should be converted to string');
        },

        'sanitizeFilename should remove dangerous characters': () => {
            TestRunner.assertEqual(
                sanitizeFilename('file<script>.dwg'),
                'file_script_.dwg',
                'Dangerous characters should be replaced'
            );
        },

        'sanitizeFilename should handle path traversal attempts': () => {
            const result = sanitizeFilename('../../../etc/passwd');
            TestRunner.assert(
                !result.includes('..'),
                'Path traversal should be neutralized'
            );
        },

        'sanitizeFilename should handle empty input': () => {
            TestRunner.assertEqual(sanitizeFilename(''), '', 'Empty string should return empty');
            TestRunner.assertEqual(sanitizeFilename(null), '', 'Null should return empty');
        }
    }
};

// === PARSING UTILITY TESTS ===
const ParsingTests = {
    name: 'Parsing Utilities',
    tests: {
        'safeParseInt should parse valid integers': () => {
            TestRunner.assertEqual(safeParseInt('42'), 42, 'Should parse "42"');
            TestRunner.assertEqual(safeParseInt('0'), 0, 'Should parse "0"');
            TestRunner.assertEqual(safeParseInt('-5'), -5, 'Should parse negative numbers');
        },

        'safeParseInt should return fallback for invalid input': () => {
            TestRunner.assertEqual(safeParseInt('abc'), 0, 'Invalid string should return default 0');
            TestRunner.assertEqual(safeParseInt('abc', 99), 99, 'Invalid string should return custom fallback');
            TestRunner.assertEqual(safeParseInt(''), 0, 'Empty string should return default');
            TestRunner.assertEqual(safeParseInt(null), 0, 'Null should return default');
        },

        'safeParseInt should handle float strings': () => {
            TestRunner.assertEqual(safeParseInt('3.14'), 3, 'Float string should parse to integer');
        }
    }
};

// === UI UTILITY TESTS ===
const UITests = {
    name: 'UI Utilities',
    tests: {
        'renderStatusIcon should render success icon': () => {
            const result = renderStatusIcon('ok');
            TestRunner.assert(result.includes('status-pill--success'), 'Should have success class');
            TestRunner.assert(result.includes('data-lucide="check"'), 'Should have check icon');
        },

        'renderStatusIcon should render warning icon': () => {
            const result = renderStatusIcon('warning');
            TestRunner.assert(result.includes('status-pill--warning'), 'Should have warning class');
            TestRunner.assert(result.includes('data-lucide="alert-triangle"'), 'Should have alert icon');
        },

        'renderStatusIcon should render error icon': () => {
            const result = renderStatusIcon('error');
            TestRunner.assert(result.includes('status-pill--error'), 'Should have error class');
            TestRunner.assert(result.includes('data-lucide="x"'), 'Should have x icon');
        },

        'renderStatusIcon should default to error for unknown status': () => {
            const result = renderStatusIcon('unknown');
            TestRunner.assert(result.includes('status-pill--error'), 'Unknown status should default to error');
        },

        'formatFileSize should format bytes correctly': () => {
            TestRunner.assertEqual(formatFileSize(0), '0 Bytes', 'Zero bytes');
            TestRunner.assertEqual(formatFileSize(500), '500 Bytes', '500 bytes');
            TestRunner.assertEqual(formatFileSize(1024), '1 KB', '1 KB');
            TestRunner.assertEqual(formatFileSize(1536), '1.5 KB', '1.5 KB');
            TestRunner.assertEqual(formatFileSize(1048576), '1 MB', '1 MB');
        },

        'formatFileSize should handle edge cases': () => {
            TestRunner.assertEqual(formatFileSize(-1), '0 Bytes', 'Negative should return 0 Bytes');
            TestRunner.assertEqual(formatFileSize(null), '0 Bytes', 'Null should return 0 Bytes');
        }
    }
};

// === STATE MANAGEMENT TESTS ===
const StateTests = {
    name: 'State Management',
    tests: {
        'AppState should have initial values': () => {
            TestRunner.assertEqual(AppState.currentView, 'login', 'Initial view should be login');
            TestRunner.assertEqual(AppState.currentStep, 1, 'Initial step should be 1');
            TestRunner.assertEqual(AppState.currentProject, null, 'Initial project should be null');
        },

        'AppState.setStep should validate step range': () => {
            const originalStep = AppState.currentStep;
            AppState.setStep(3);
            TestRunner.assertEqual(AppState.currentStep, 3, 'Should set valid step');
            AppState.setStep(0);
            TestRunner.assertEqual(AppState.currentStep, 3, 'Should not set step below 1');
            AppState.setStep(5);
            TestRunner.assertEqual(AppState.currentStep, 3, 'Should not set step above STEP_COUNT');
            AppState.currentStep = originalStep; // Reset
        },

        'AppState.setView should update view': () => {
            const original = AppState.currentView;
            AppState.setView('projects');
            TestRunner.assertEqual(AppState.currentView, 'projects', 'View should be updated');
            AppState.currentView = original; // Reset
        }
    }
};

// === CONFIGURATION TESTS ===
const ConfigTests = {
    name: 'Configuration',
    tests: {
        'CONFIG should have required properties': () => {
            TestRunner.assertNotNull(CONFIG.SPECKLE_PROJECT_ID, 'Should have Speckle project ID');
            TestRunner.assertNotNull(CONFIG.SPECKLE_MODEL_ID, 'Should have Speckle model ID');
            TestRunner.assertNotNull(CONFIG.TOAST_DURATION_MS, 'Should have toast duration');
            TestRunner.assertNotNull(CONFIG.STEP_COUNT, 'Should have step count');
            TestRunner.assertNotNull(CONFIG.BYTES_PER_KB, 'Should have bytes per KB');
        },

        'CONFIG should have file size limits': () => {
            TestRunner.assertNotNull(CONFIG.MAX_IMAGE_SIZE, 'Should have max image size');
            TestRunner.assertNotNull(CONFIG.MAX_DWG_SIZE, 'Should have max DWG size');
            TestRunner.assertNotNull(CONFIG.MAX_EXCEL_SIZE, 'Should have max Excel size');
            TestRunner.assert(CONFIG.MAX_DWG_SIZE > CONFIG.MAX_IMAGE_SIZE, 'DWG limit should be larger than image limit');
        },

        'CONFIG should have score thresholds': () => {
            TestRunner.assertNotNull(CONFIG.SCORE_SUCCESS_THRESHOLD, 'Should have success threshold');
            TestRunner.assertNotNull(CONFIG.SCORE_WARNING_THRESHOLD, 'Should have warning threshold');
            TestRunner.assert(CONFIG.SCORE_SUCCESS_THRESHOLD > CONFIG.SCORE_WARNING_THRESHOLD, 'Success threshold should be higher than warning');
        },

        'CONFIG.STEP_COUNT should be 4': () => {
            TestRunner.assertEqual(CONFIG.STEP_COUNT, 4, 'Should have 4 steps');
        },

        'CONFIG.BYTES_PER_KB should be 1024': () => {
            TestRunner.assertEqual(CONFIG.BYTES_PER_KB, 1024, 'Should be 1024');
        },

        'getSpeckleViewerUrl should return valid URL': () => {
            const url = getSpeckleViewerUrl();
            TestRunner.assert(url.includes('app.speckle.systems'), 'Should contain Speckle domain');
            TestRunner.assert(url.includes(CONFIG.SPECKLE_PROJECT_ID), 'Should contain project ID');
            TestRunner.assert(url.includes(CONFIG.SPECKLE_MODEL_ID), 'Should contain model ID');
        }
    }
};

// === SCORE STATUS TESTS ===
const ScoreStatusTests = {
    name: 'Score Status Utilities',
    tests: {
        'getScoreStatus should return success for high scores': () => {
            TestRunner.assertEqual(getScoreStatus(100), 'success', '100 should be success');
            TestRunner.assertEqual(getScoreStatus(95), 'success', '95 should be success');
            TestRunner.assertEqual(getScoreStatus(90), 'success', '90 should be success');
        },

        'getScoreStatus should return warning for medium scores': () => {
            TestRunner.assertEqual(getScoreStatus(89), 'warning', '89 should be warning');
            TestRunner.assertEqual(getScoreStatus(75), 'warning', '75 should be warning');
            TestRunner.assertEqual(getScoreStatus(60), 'warning', '60 should be warning');
        },

        'getScoreStatus should return error for low scores': () => {
            TestRunner.assertEqual(getScoreStatus(59), 'error', '59 should be error');
            TestRunner.assertEqual(getScoreStatus(30), 'error', '30 should be error');
            TestRunner.assertEqual(getScoreStatus(0), 'error', '0 should be error');
        },

        'getScoreIconStatus should return ok for high scores': () => {
            TestRunner.assertEqual(getScoreIconStatus(90), 'ok', '90 should be ok');
        },

        'getScoreIconStatus should return warning for medium scores': () => {
            TestRunner.assertEqual(getScoreIconStatus(75), 'warning', '75 should be warning');
        },

        'getScoreIconStatus should return error for low scores': () => {
            TestRunner.assertEqual(getScoreIconStatus(50), 'error', '50 should be error');
        }
    }
};

// === DEBOUNCE TESTS ===
const DebounceTests = {
    name: 'Debounce Utility',
    tests: {
        'debounce should return a function': () => {
            const debouncedFn = debounce(() => {}, 100);
            TestRunner.assertEqual(typeof debouncedFn, 'function', 'Should return a function');
        },

        'debounce should be defined': () => {
            TestRunner.assertNotNull(debounce, 'debounce function should exist');
        }
    }
};

// === EVENT LISTENER MANAGEMENT TESTS ===
const EventListenerTests = {
    name: 'Event Listener Management',
    tests: {
        'eventListenerControllers should exist': () => {
            TestRunner.assertNotNull(eventListenerControllers, 'Should have eventListenerControllers object');
        },

        'getListenerController should return AbortController': () => {
            const controller = getListenerController('tabs');
            TestRunner.assertNotNull(controller, 'Should return a controller');
            TestRunner.assertNotNull(controller.signal, 'Controller should have a signal');
        },

        'getListenerController should abort previous controller': () => {
            const controller1 = getListenerController('tabs');
            const signal1 = controller1.signal;
            const controller2 = getListenerController('tabs');
            TestRunner.assert(signal1.aborted, 'Previous signal should be aborted');
            TestRunner.assert(!controller2.signal.aborted, 'New signal should not be aborted');
        }
    }
};

// === RUN ALL TESTS ===
function runAllTests() {
    console.log('========================================');
    console.log('BBL Prüfplattform - Unit Test Suite');
    console.log('========================================');

    TestRunner.run(SecurityTests);
    TestRunner.run(ParsingTests);
    TestRunner.run(UITests);
    TestRunner.run(StateTests);
    TestRunner.run(ConfigTests);
    TestRunner.run(ScoreStatusTests);
    TestRunner.run(DebounceTests);
    TestRunner.run(EventListenerTests);

    const success = TestRunner.summary();

    console.log('\n========================================');
    console.log(success ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
    console.log('========================================\n');

    return success;
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runAllTests, TestRunner };
}

// Auto-run if this is the main script
if (typeof window !== 'undefined' && window.runTests) {
    runAllTests();
}
