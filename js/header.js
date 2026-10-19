// =============================================
// Header controls shared by every view: language select and mobile menu
// =============================================

import { setLocale, getLocale } from './i18n.js';

/** Wires the language select and the hamburger menu; onLocaleChange runs after a language switch. */
export function initHeader({ onLocaleChange } = {}) {
    const select = document.getElementById('lang-select');
    if (select) {
        select.value = getLocale();
        select.addEventListener('change', async () => {
            await setLocale(select.value);
            select.value = getLocale();
            onLocaleChange?.();
        });
    }

    const menuBtn = document.getElementById('header-menu-btn');
    const nav = document.getElementById('header-nav');
    if (menuBtn && nav) {
        menuBtn.addEventListener('click', () => {
            menuBtn.setAttribute('aria-expanded', String(nav.classList.toggle('open')));
        });
    }
}
