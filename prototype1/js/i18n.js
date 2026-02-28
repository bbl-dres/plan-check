// ─────────────────────────────────────────────
// i18n — Lightweight internationalization module
// Adapted for prototype1 (IIFE / non-module pattern)
// ─────────────────────────────────────────────

/* eslint-disable no-var */
/* global */
var I18n = (function () {
    'use strict';

    var SUPPORTED = ['de', 'fr', 'it', 'en'];
    var DEFAULT   = 'de';
    var STORE_KEY = 'plan-check-proto-lang';

    var locale   = DEFAULT;
    var messages = {};
    var cache    = {};

    /**
     * Translate a key with optional {param} interpolation.
     * Pluralization: when params.count is provided and key is missing,
     * tries key_one (count===1) or key_other.
     */
    function t(key, params) {
        var str = messages[key];

        if (str === undefined && params && 'count' in params) {
            str = messages[key + (params.count === 1 ? '_one' : '_other')];
        }

        if (str === undefined) {
            // Fallback to German cache
            if (cache[DEFAULT] && cache[DEFAULT][key] !== undefined) {
                str = cache[DEFAULT][key];
                if (str === undefined && params && 'count' in params) {
                    str = cache[DEFAULT][key + (params.count === 1 ? '_one' : '_other')];
                }
            }
            if (str === undefined) {
                console.warn('[i18n] Missing: "' + key + '" (' + locale + ')');
                return '[' + key + ']';
            }
        }

        if (params) {
            str = str.replace(/\{(\w+)\}/g, function (_, k) {
                return params[k] !== undefined ? String(params[k]) : '{' + k + '}';
            });
        }
        return str;
    }

    /** Current locale code. */
    function getLocale() { return locale; }

    /** Supported locale codes. */
    function getSupportedLocales() { return SUPPORTED; }

    /**
     * Load a locale JSON, update state, persist choice, re-translate DOM.
     */
    function setLocale(lang) {
        if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT;

        if (!cache[lang]) {
            // Determine base URL relative to this script
            var scripts = document.getElementsByTagName('script');
            var base = '';
            for (var i = 0; i < scripts.length; i++) {
                var src = scripts[i].src || '';
                if (src.indexOf('i18n.js') !== -1) {
                    base = src.replace(/js\/i18n\.js.*$/, '');
                    break;
                }
            }
            if (!base) {
                // Fallback: use current page location
                base = window.location.href.replace(/[^/]*$/, '');
            }

            return fetch(base + 'locales/' + lang + '.json')
                .then(function (resp) {
                    if (!resp.ok) throw new Error('HTTP ' + resp.status);
                    return resp.json();
                })
                .then(function (data) {
                    cache[lang] = data;
                    locale = lang;
                    messages = cache[lang];
                    applyLocale(lang);
                })
                .catch(function (err) {
                    console.error('[i18n] Failed to load "' + lang + '":', err);
                    cache[lang] = lang !== DEFAULT && cache[DEFAULT] ? Object.assign({}, cache[DEFAULT]) : {};
                    locale = lang;
                    messages = cache[lang];
                    applyLocale(lang);
                });
        }

        locale = lang;
        messages = cache[lang];
        applyLocale(lang);
        return Promise.resolve();
    }

    function applyLocale(lang) {
        try { localStorage.setItem(STORE_KEY, lang); } catch (_) { /* private mode */ }
        document.documentElement.lang = lang;

        // Update URL parameter
        var url = new URL(window.location);
        url.searchParams.set('lang', lang);
        history.replaceState(null, '', url);

        translatePage();

        // Update language selector buttons
        var buttons = document.querySelectorAll('.lang-selector__item');
        buttons.forEach(function (btn) {
            btn.classList.toggle('lang-selector__item--active', btn.getAttribute('data-lang') === lang);
        });
    }

    /**
     * Walk all data-i18n* attributes in the DOM and apply translations.
     */
    function translatePage() {
        var els;

        els = document.querySelectorAll('[data-i18n]');
        for (var a = 0; a < els.length; a++) {
            var k1 = els[a].getAttribute('data-i18n');
            if (k1) els[a].textContent = t(k1);
        }

        els = document.querySelectorAll('[data-i18n-placeholder]');
        for (var b = 0; b < els.length; b++) {
            var k2 = els[b].getAttribute('data-i18n-placeholder');
            if (k2) els[b].placeholder = t(k2);
        }

        els = document.querySelectorAll('[data-i18n-title]');
        for (var c = 0; c < els.length; c++) {
            var k3 = els[c].getAttribute('data-i18n-title');
            if (k3) els[c].title = t(k3);
        }

        els = document.querySelectorAll('[data-i18n-aria-label]');
        for (var d = 0; d < els.length; d++) {
            var k4 = els[d].getAttribute('data-i18n-aria-label');
            if (k4) els[d].setAttribute('aria-label', t(k4));
        }

        els = document.querySelectorAll('[data-i18n-alt]');
        for (var e = 0; e < els.length; e++) {
            var k5 = els[e].getAttribute('data-i18n-alt');
            if (k5) els[e].alt = t(k5);
        }

        els = document.querySelectorAll('[data-i18n-html]');
        for (var f = 0; f < els.length; f++) {
            var k6 = els[f].getAttribute('data-i18n-html');
            if (k6) els[f].innerHTML = t(k6);
        }

        // Update <title>
        var titleEl = document.querySelector('title');
        var titleKey = titleEl ? titleEl.getAttribute('data-i18n') : null;
        if (titleKey) document.title = t(titleKey);
    }

    /**
     * Detect initial locale from URL param → localStorage → navigator.language → default.
     */
    function init() {
        var lang = DEFAULT;

        // 1. Check URL parameter (?lang=de)
        var urlParams = new URLSearchParams(window.location.search);
        var urlLang = urlParams.get('lang');
        if (urlLang && SUPPORTED.indexOf(urlLang) !== -1) {
            lang = urlLang;
        } else {
            // 2. Check localStorage
            try {
                var stored = localStorage.getItem(STORE_KEY);
                if (stored && SUPPORTED.indexOf(stored) !== -1) lang = stored;
            } catch (_) { /* private */ }

        }

        // Always pre-cache German as fallback
        var p = Promise.resolve();
        if (lang !== DEFAULT) {
            p = setLocale(DEFAULT);
        }
        return p.then(function () {
            return setLocale(lang);
        });
    }

    // --- Public API ---
    return {
        t: t,
        getLocale: getLocale,
        getSupportedLocales: getSupportedLocales,
        setLocale: setLocale,
        translatePage: translatePage,
        init: init
    };
})();
