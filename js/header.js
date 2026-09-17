// =============================================
// Header controls shared by every view: language selector and mobile menu
// =============================================

import { setLocale, getLocale } from './i18n.js';

/** Wires the language buttons and the hamburger menu; onLocaleChange runs after a language switch. */
export function initHeader({ onLocaleChange } = {}) {
    const buttons = document.querySelectorAll('.lang-selector__item');
    const syncButtons = () => {
        for (const btn of buttons) {
            const active = btn.dataset.lang === getLocale();
            btn.classList.toggle('lang-selector__item--active', active);
            btn.setAttribute('aria-pressed', String(active));
        }
    };
    syncButtons();
    for (const btn of buttons) {
        btn.addEventListener('click', async () => {
            await setLocale(btn.dataset.lang);
            syncButtons();
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
