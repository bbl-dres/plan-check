// =============================================
// Lightweight internationalisation: flat JSON dictionaries per locale
// =============================================

const SUPPORTED = ['de', 'fr', 'it', 'en'];
const DEFAULT = 'de';
const STORE_KEY = 'plan-check-lang';

let locale = DEFAULT;
let messages = {};
const cache = {};

function lookup(dict, key, params) {
    if (!dict) return undefined;
    let str = dict[key];
    // Plural forms: key_one / key_other when the plain key is absent
    if (str === undefined && params && 'count' in params) {
        str = dict[key + (params.count === 1 ? '_one' : '_other')];
    }
    return str;
}

/** True when the key exists in the current locale or the German fallback. */
export function has(key) {
    return lookup(messages, key) !== undefined || lookup(cache[DEFAULT], key) !== undefined;
}

/** Translates a key with optional {param} interpolation; falls back to German, then to "[key]". */
export function t(key, params) {
    let str = lookup(messages, key, params) ?? lookup(cache[DEFAULT], key, params);
    if (str === undefined) {
        console.warn(`[i18n] Missing: "${key}" (${locale})`);
        return `[${key}]`;
    }
    if (params) {
        str = str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
    }
    return str;
}

export function getLocale() { return locale; }

/** Loads a locale (once), activates it, persists the choice and re-translates the static DOM. */
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

    locale = lang;
    messages = cache[lang];

    try { localStorage.setItem(STORE_KEY, lang); } catch (_) { /* storage unavailable */ }
    document.documentElement.lang = lang;
    translatePage();

    const url = new URL(window.location);
    url.searchParams.set('lang', lang);
    history.replaceState(null, '', url);
}

const ATTRIBUTE_TARGETS = [
    ['data-i18n', (el, v) => { el.textContent = v; }],
    ['data-i18n-placeholder', (el, v) => { el.placeholder = v; }],
    ['data-i18n-title', (el, v) => { el.title = v; }],
    ['data-i18n-aria-label', (el, v) => el.setAttribute('aria-label', v)],
    ['data-i18n-alt', (el, v) => { el.alt = v; }],
    ['data-i18n-html', (el, v) => { el.innerHTML = v; }],
];

/** Applies translations to every element carrying a data-i18n* attribute. */
function translatePage() {
    for (const [attr, apply] of ATTRIBUTE_TARGETS) {
        for (const el of document.querySelectorAll(`[${attr}]`)) {
            const key = el.getAttribute(attr);
            if (key) apply(el, t(key));
        }
    }
    const titleKey = document.querySelector('title')?.getAttribute('data-i18n');
    if (titleKey) document.title = t(titleKey);
}

/** Initial locale: URL parameter, then stored choice, then German. German is always loaded as fallback. */
export async function initI18n() {
    let lang = DEFAULT;
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang && SUPPORTED.includes(urlLang)) {
        lang = urlLang;
    } else {
        try {
            const stored = localStorage.getItem(STORE_KEY);
            if (stored && SUPPORTED.includes(stored)) lang = stored;
        } catch (_) { /* storage unavailable */ }
    }
    if (lang !== DEFAULT) await setLocale(DEFAULT);
    await setLocale(lang);
}
