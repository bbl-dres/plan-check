/**
 * View Router
 * Reads ?view= URL parameter and loads the appropriate module.
 * Shared header and footer remain visible in all views.
 */

const view = new URLSearchParams(location.search).get('view');

if (view === 'api-docs') {
    document.querySelector('.container').style.display = 'none';
    const { initApiDocs } = await import('./api-docs.js');
    initApiDocs();
} else {
    await import('./app.js');
}
