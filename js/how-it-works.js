// =============================================
// The explainer film of the landing page: media/how-it-works-<lang>.webm, rendered from media/how-it-works.html by
// media/render.py, in a player of the page's own (as in plan-extract): a play mark over the poster, a bar with
// play/pause, the timeline, the clock, replay and full screen. Nothing plays by itself.
// =============================================

import { getLocale, t } from './i18n.js';

const ICONS = {
    play: '<polygon points="6 4 20 12 6 20" fill="currentColor" stroke="none"/>',
    pause: '<rect x="5" y="4" width="5" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="5" height="16" rx="1" fill="currentColor" stroke="none"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const SEEK_STEP = 5;   // seconds per arrow key
const LENGTH = 37.5;   // seconds, until the file tells its own
const duration = video => (Number.isFinite(video.duration) && video.duration > 0 ? video.duration : LENGTH);

let el = null;
let lang = null;

/** Loads the film of the current language (a switch while it plays starts the new one from the same second). */
export function updateFilmLanguage() {
    if (!el || getLocale() === lang) return;
    lang = getLocale();
    const at = el.currentTime, playing = !el.paused;
    el.poster = `media/how-it-works-${lang}.jpg`;
    el.src = `media/how-it-works-${lang}.webm`;
    if (at || playing) el.addEventListener('loadedmetadata', () => { el.currentTime = at; if (playing) el.play().catch(() => {}); }, { once: true });
}

export function pauseFilm() {
    if (el && !el.paused) el.pause();
}

export function initHowItWorks() {
    el = document.getElementById('how-film');
    const stage = document.getElementById('how-stage');
    const player = document.getElementById('how-player');
    const toggleBtn = document.getElementById('how-toggle');
    const time = document.getElementById('how-time');
    const shown = document.getElementById('how-clock');
    if (!el || !stage || !player) return;
    el.playsInline = true;
    updateFilmLanguage();

    const toggle = () => { if (el.paused) el.play().catch(() => {}); else el.pause(); };
    const state = () => {
        stage.classList.toggle('paused', el.paused);
        toggleBtn.innerHTML = icon(el.paused ? 'play' : 'pause');
        const key = el.paused ? 'how.play' : 'how.pause';
        toggleBtn.dataset.i18nAriaLabel = key;     // a language switch names the button for its current state
        toggleBtn.setAttribute('aria-label', t(key));
    };
    const tick = () => {
        const d = duration(el);
        time.max = d; time.value = el.currentTime;
        shown.textContent = `${clock(el.currentTime)} / ${clock(d)}`;
    };

    stage.addEventListener('click', toggle);
    toggleBtn.addEventListener('click', toggle);
    document.getElementById('how-replay').addEventListener('click', () => { el.currentTime = 0; el.play().catch(() => {}); });
    document.getElementById('how-fullscreen').addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (player.requestFullscreen) player.requestFullscreen().catch(() => {});
        else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();   // iOS: the video alone, in the system player
    });
    el.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
        else if (e.key === 'ArrowRight') el.currentTime = Math.min(duration(el), el.currentTime + SEEK_STEP);
        else if (e.key === 'ArrowLeft') el.currentTime = Math.max(0, el.currentTime - SEEK_STEP);
        else if (e.key === 'Home') el.currentTime = 0;
    });
    for (const ev of ['play', 'pause', 'ended']) el.addEventListener(ev, state);
    for (const ev of ['loadedmetadata', 'timeupdate']) el.addEventListener(ev, tick);
    time.addEventListener('input', () => { el.currentTime = +time.value; tick(); });
    state();
}
