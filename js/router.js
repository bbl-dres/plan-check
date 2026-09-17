// =============================================
// View router: ?view=api-docs shows the API reference, everything else the checker
// =============================================

import { initI18n } from './i18n.js';

await initI18n();

const view = new URLSearchParams(location.search).get('view');

if (view === 'api-docs') {
    document.querySelector('.container').hidden = true;
    const { initHeader } = await import('./header.js');
    initHeader();
    const { initApiDocs } = await import('./api-docs.js');
    await initApiDocs();
} else {
    await import('./app.js');
}
