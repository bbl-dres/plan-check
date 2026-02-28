// ─────────────────────────────────────────────
// i18n — Lightweight internationalization module
// ─────────────────────────────────────────────

const SUPPORTED = ['de', 'fr', 'it', 'en'];
const DEFAULT   = 'de';
const STORE_KEY = 'plan-check-lang';

let locale   = DEFAULT;
let messages = {};
const cache  = {};

/**
 * Translate a key with optional {param} interpolation.
 * Pluralization: when params.count is provided and key is missing,
 * tries key_one (count===1) or key_other.
 */
export function t(key, params) {
    let str = messages[key];

    if (str === undefined && params && 'count' in params) {
        str = messages[key + (params.count === 1 ? '_one' : '_other')];
    }

    if (str === undefined) {
        // Fallback to German cache if available
        if (cache[DEFAULT] && cache[DEFAULT][key] !== undefined) {
            str = cache[DEFAULT][key];
            if (str === undefined && params && 'count' in params) {
                str = cache[DEFAULT][key + (params.count === 1 ? '_one' : '_other')];
            }
        }
        if (str === undefined) {
            console.warn(`[i18n] Missing: "${key}" (${locale})`);
            return `[${key}]`;
        }
    }

    if (params) {
        str = str.replace(/\{(\w+)\}/g, (_, k) =>
            params[k] !== undefined ? String(params[k]) : `{${k}}`);
    }
    return str;
}

/** Current locale code. */
export function getLocale() { return locale; }

/** Supported locale codes. */
export function getSupportedLocales() { return SUPPORTED; }

/**
 * Load a locale JSON, update state, persist choice, re-translate DOM.
 */
export async function setLocale(lang) {
    if (!SUPPORTED.includes(lang)) lang = DEFAULT;

    if (!cache[lang]) {
        try {
            const base = import.meta.url.replace(/js\/i18n\.js.*$/, '');
            const resp = await fetch(`${base}locales/${lang}.json`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            cache[lang] = await resp.json();
        } catch (err) {
            console.error(`[i18n] Failed to load "${lang}":`, err);
            cache[lang] = lang !== DEFAULT && cache[DEFAULT] ? { ...cache[DEFAULT] } : {};
        }
    }

    locale   = lang;
    messages = cache[lang];

    try { localStorage.setItem(STORE_KEY, lang); } catch (_) { /* private mode */ }
    document.documentElement.lang = lang;
    translatePage();

    // Update URL parameter
    const url = new URL(window.location);
    url.searchParams.set('lang', lang);
    history.replaceState(null, '', url);
}

/**
 * Walk all data-i18n* attributes in the DOM and apply translations.
 */
export function translatePage() {
    for (const el of document.querySelectorAll('[data-i18n]')) {
        const k = el.getAttribute('data-i18n');
        if (k) el.textContent = t(k);
    }
    for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
        const k = el.getAttribute('data-i18n-placeholder');
        if (k) el.placeholder = t(k);
    }
    for (const el of document.querySelectorAll('[data-i18n-title]')) {
        const k = el.getAttribute('data-i18n-title');
        if (k) el.title = t(k);
    }
    for (const el of document.querySelectorAll('[data-i18n-aria-label]')) {
        const k = el.getAttribute('data-i18n-aria-label');
        if (k) el.setAttribute('aria-label', t(k));
    }
    for (const el of document.querySelectorAll('[data-i18n-alt]')) {
        const k = el.getAttribute('data-i18n-alt');
        if (k) el.alt = t(k);
    }
    for (const el of document.querySelectorAll('[data-i18n-html]')) {
        const k = el.getAttribute('data-i18n-html');
        if (k) el.innerHTML = t(k);
    }
    // Update <title>
    const titleKey = document.querySelector('title')?.getAttribute('data-i18n');
    if (titleKey) document.title = t(titleKey);
}

/**
 * Detect initial locale from URL param → localStorage → navigator.language → default.
 */
export async function initI18n() {
    let lang = DEFAULT;

    // 1. Check URL parameter (?lang=de)
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    if (urlLang && SUPPORTED.includes(urlLang)) {
        lang = urlLang;
    } else {
        // 2. Check localStorage
        try {
            const stored = localStorage.getItem(STORE_KEY);
            if (stored && SUPPORTED.includes(stored)) lang = stored;
        } catch (_) { /* private */ }

        // 3. Check browser language
        if (lang === DEFAULT) {
            const browser = (navigator.language || '').split('-')[0].toLowerCase();
            if (SUPPORTED.includes(browser)) lang = browser;
        }
    }

    // Always pre-cache German as fallback
    if (lang !== DEFAULT) {
        await setLocale(DEFAULT);
    }
    await setLocale(lang);
}
