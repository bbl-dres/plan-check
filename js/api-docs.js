// =============================================
// API reference view: renders assets/openapi.json (English only, like the specification itself)
// =============================================

import { esc } from './utils.js';

const METHOD_COLORS = { get: 'success', post: 'primary', put: 'warning', delete: 'error', patch: 'warning' };
const EXAMPLE_UPLOAD = 'floor-plan.dwg';

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');

function resolveRef(spec, ref) {
    let obj = spec;
    for (const key of ref.replace(/^#\//, '').split('/')) {
        obj = obj?.[key.replace(/~1/g, '/').replace(/~0/g, '~')];
    }
    return obj;
}

function resolveSchema(spec, schema) {
    if (!schema) return null;
    return schema.$ref ? resolveRef(spec, schema.$ref) : schema;
}

function schemaToExample(spec, schema, depth = 0) {
    if (!schema || depth > 5) return null;
    schema = resolveSchema(spec, schema);
    if (!schema) return null;
    if (schema.example !== undefined) return schema.example;
    if (schema.type === 'object' && schema.properties) {
        const obj = {};
        for (const [key, prop] of Object.entries(schema.properties)) obj[key] = schemaToExample(spec, prop, depth + 1);
        return obj;
    }
    if (schema.type === 'array' && schema.items) return [schemaToExample(spec, schema.items, depth + 1)];
    if (schema.enum) return schema.enum[0];
    return { string: 'string', integer: 0, number: 0.0, boolean: true }[schema.type] ?? null;
}

function renderSchemaProps(spec, schema) {
    schema = resolveSchema(spec, schema);
    if (!schema || schema.type !== 'object' || !schema.properties) return '';
    let rows = '';
    for (const [name, prop] of Object.entries(schema.properties)) {
        const resolved = resolveSchema(spec, prop) || {};
        let type = resolved.type || 'object';
        if (resolved.format) type += ` (${resolved.format})`;
        if (resolved.enum) type = resolved.enum.join(' | ');
        if (resolved.type === 'array') {
            const itemType = resolved.items?.$ref ? resolved.items.$ref.split('/').pop() : (resolved.items?.type || 'object');
            type = `${itemType}[]`;
        }
        const required = schema.required?.includes(name) ? ' <span class="api-docs__required">required</span>' : '';
        rows += `<tr><td><code>${esc(name)}</code>${required}</td><td class="api-docs__type">${esc(type)}</td><td>${esc(resolved.description || '')}</td></tr>`;
    }
    return `<table class="api-docs__schema"><thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function firstContent(body) {
    const content = body?.content || {};
    const contentType = Object.keys(content)[0];
    return contentType ? { contentType, schema: content[contentType]?.schema } : null;
}

function renderEndpoint(spec, method, path, op) {
    const id = slug(op.operationId || `${method}-${path}`);

    let paramsHtml = '';
    if (op.parameters?.length) {
        const rows = op.parameters.map(p => {
            const s = p.schema || {};
            return `<tr><td><code>${esc(p.name)}</code>${p.required ? ' <span class="api-docs__required">required</span>' : ''}</td>` +
                `<td class="api-docs__type">${esc(s.type || 'string')}${s.format ? ` (${esc(s.format)})` : ''}</td><td>${esc(p.in)}</td><td>${esc(p.description || '')}</td></tr>`;
        }).join('');
        paramsHtml = `<div class="api-docs__section-label">Parameters</div><table class="api-docs__schema"><thead><tr><th>Name</th><th>Type</th><th>In</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    let bodyHtml = '';
    const requestBody = firstContent(op.requestBody);
    if (requestBody?.schema) {
        bodyHtml = `<div class="api-docs__section-label">Request Body <span class="api-docs__content-type">${esc(requestBody.contentType)}</span></div>` + renderSchemaProps(spec, requestBody.schema);
    }

    let responsesHtml = '';
    for (const [code, resp] of Object.entries(op.responses || {})) {
        const statusClass = code.startsWith('2') ? 'success' : code.startsWith('4') ? 'error' : 'warning';
        responsesHtml += `<div class="api-docs__response"><span class="api-docs__status api-docs__status--${statusClass}">${esc(code)}</span><span>${esc(resp.description || '')}</span></div>`;
        const content = firstContent(resp);
        if (content?.schema && content.contentType === 'application/json') {
            responsesHtml += renderSchemaProps(spec, content.schema);
            const example = schemaToExample(spec, content.schema);
            if (example) responsesHtml += `<pre class="api-docs__example">${esc(JSON.stringify(example, null, 2))}</pre>`;
        }
    }

    const baseUrl = spec.servers?.[0]?.url || 'https://api.example.com';
    let curl = `curl -X ${method.toUpperCase()} "${baseUrl}${path}" \\\n  -H "X-API-Key: YOUR_API_KEY"`;
    if (requestBody?.contentType === 'application/json') {
        curl += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(schemaToExample(spec, requestBody.schema) || {}, null, 2)}'`;
    } else if (requestBody?.contentType === 'multipart/form-data') {
        curl += ` \\\n  -F "file=@${EXAMPLE_UPLOAD}"`;
    }

    const pathHtml = esc(path).replace(/\{(\w+)\}/g, '<span class="api-docs__param">{$1}</span>');
    return `<div class="api-docs__endpoint" id="${id}">
        <button type="button" class="api-docs__endpoint-header" aria-expanded="false" aria-controls="${id}-detail">
            <span class="api-docs__method api-docs__method--${METHOD_COLORS[method] || 'primary'}">${esc(method.toUpperCase())}</span>
            <span class="api-docs__path">${pathHtml}</span>
            <span class="api-docs__summary">${esc(op.summary || '')}</span>
            <svg class="api-docs__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="api-docs__detail" id="${id}-detail">
            ${op.description ? `<p class="api-docs__desc">${esc(op.description)}</p>` : ''}
            ${paramsHtml}
            ${bodyHtml}
            <div class="api-docs__section-label">Responses</div>
            ${responsesHtml}
            <div class="api-docs__section-label">Example</div>
            <pre class="api-docs__example">${esc(curl)}</pre>
        </div>
    </div>`;
}

export async function initApiDocs() {
    const container = document.getElementById('api-docs-container');
    container.hidden = false;
    let spec;
    try {
        const resp = await fetch('assets/openapi.json');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        spec = await resp.json();
    } catch (err) {
        container.innerHTML = `<div class="api-docs__main"><p class="api-docs__desc">The API specification could not be loaded (${esc(err.message)}).</p></div>`;
        return;
    }

    const groups = {};
    for (const tag of spec.tags || []) groups[tag.name] = { description: tag.description, endpoints: [] };
    for (const [path, methods] of Object.entries(spec.paths || {})) {
        for (const [method, op] of Object.entries(methods)) {
            const tag = op.tags?.[0] || 'General';
            (groups[tag] ??= { description: '', endpoints: [] }).endpoints.push({ method, path, op });
        }
    }

    const serverUrl = spec.servers?.[0]?.url || '';
    let html = `<div class="api-docs__hero">
        <h1 class="api-docs__title">${esc(spec.info?.title || 'API')}</h1>
        <div class="api-docs__meta"><span class="api-docs__version">v${esc(spec.info?.version || '')}</span><span class="api-docs__server">${esc(serverUrl)}</span></div>
        <p class="api-docs__intro">${esc(spec.info?.description || '')}</p>
    </div>
    <div class="api-docs__auth" id="auth">
        <h2 class="api-docs__group-title">Authentication</h2>
        <p class="api-docs__text">All requests require an API key in the <code>X-API-Key</code> header. Keys can be requested through the BBL portal.</p>
        <pre class="api-docs__example">curl -H "X-API-Key: YOUR_API_KEY" ${esc(serverUrl)}/health</pre>
    </div>`;
    for (const [name, group] of Object.entries(groups)) {
        html += `<div class="api-docs__group" id="tag-${slug(name)}">
            <h2 class="api-docs__group-title">${esc(name)}</h2>
            ${group.description ? `<p class="api-docs__text">${esc(group.description)}</p>` : ''}
            ${group.endpoints.map(e => renderEndpoint(spec, e.method, e.path, e.op)).join('')}
        </div>`;
    }
    container.innerHTML = `<div class="api-docs__main">${html}</div>`;

    container.addEventListener('click', e => {
        const header = e.target.closest('.api-docs__endpoint-header');
        if (!header) return;
        const detail = document.getElementById(header.getAttribute('aria-controls'));
        const open = detail.classList.toggle('open');
        header.closest('.api-docs__endpoint').classList.toggle('expanded', open);
        header.setAttribute('aria-expanded', String(open));
    });
}
