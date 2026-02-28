/**
 * API Documentation Renderer
 * Reads an OpenAPI 3.0 JSON spec and renders Swagger-style documentation.
 */

import { esc } from './utils.js';

const METHOD_COLORS = {
    get: 'success',
    post: 'primary',
    put: 'warning',
    delete: 'error',
    patch: 'warning'
};

function resolveRef(spec, ref) {
    const path = ref.replace('#/', '').split('/');
    let obj = spec;
    for (const key of path) obj = obj[key];
    return obj;
}

function resolveSchema(spec, schema) {
    if (!schema) return null;
    if (schema.$ref) return resolveRef(spec, schema.$ref);
    return schema;
}

function schemaToExample(spec, schema, depth = 0) {
    if (!schema || depth > 5) return null;
    if (schema.$ref) schema = resolveRef(spec, schema.$ref);
    if (schema.example !== undefined) return schema.example;

    if (schema.type === 'object' && schema.properties) {
        const obj = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
            obj[key] = schemaToExample(spec, prop, depth + 1);
        }
        return obj;
    }
    if (schema.type === 'array' && schema.items) {
        return [schemaToExample(spec, schema.items, depth + 1)];
    }
    if (schema.enum) return schema.enum[0];

    const defaults = { string: 'string', integer: 0, number: 0.0, boolean: true };
    return defaults[schema.type] ?? null;
}

function renderSchemaProps(spec, schema) {
    if (!schema) return '';
    if (schema.$ref) schema = resolveRef(spec, schema.$ref);
    if (schema.type !== 'object' || !schema.properties) return '';

    let rows = '';
    for (const [name, prop] of Object.entries(schema.properties)) {
        const resolved = prop.$ref ? resolveRef(spec, prop.$ref) : prop;
        let type = resolved.type || 'object';
        if (resolved.format) type += ` (${resolved.format})`;
        if (resolved.enum) type = resolved.enum.join(' | ');
        if (resolved.type === 'array') {
            const itemType = resolved.items?.$ref
                ? resolved.items.$ref.split('/').pop()
                : resolved.items?.type || 'object';
            type = `${itemType}[]`;
        }
        const required = schema.required?.includes(name) ? '<span class="api-docs__required">required</span>' : '';
        const desc = resolved.description || '';
        rows += `<tr>
            <td><code>${esc(name)}</code> ${required}</td>
            <td class="api-docs__type">${esc(type)}</td>
            <td>${esc(desc)}</td>
        </tr>`;
    }
    return `<table class="api-docs__schema"><thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderEndpoint(spec, method, path, op) {
    const colorClass = METHOD_COLORS[method] || 'primary';
    const id = op.operationId || `${method}-${path.replace(/[^a-z0-9]/gi, '-')}`;

    // Parameters
    let paramsHtml = '';
    if (op.parameters?.length) {
        let paramRows = '';
        for (const p of op.parameters) {
            const s = p.schema || {};
            paramRows += `<tr>
                <td><code>${esc(p.name)}</code>${p.required ? ' <span class="api-docs__required">required</span>' : ''}</td>
                <td class="api-docs__type">${esc(s.type || 'string')}${s.format ? ` (${esc(s.format)})` : ''}</td>
                <td>${esc(p.in)}</td>
                <td>${esc(p.description || '')}</td>
            </tr>`;
        }
        paramsHtml = `<div class="api-docs__section-label">Parameter</div>
            <table class="api-docs__schema"><thead><tr><th>Name</th><th>Type</th><th>In</th><th>Description</th></tr></thead><tbody>${paramRows}</tbody></table>`;
    }

    // Request body
    let bodyHtml = '';
    if (op.requestBody) {
        const content = op.requestBody.content;
        const contentType = Object.keys(content)[0];
        const bodySchema = content[contentType]?.schema;
        if (bodySchema) {
            bodyHtml = `<div class="api-docs__section-label">Request Body <span class="api-docs__content-type">${contentType}</span></div>`;
            bodyHtml += renderSchemaProps(spec, bodySchema);
        }
    }

    // Responses
    let responsesHtml = '';
    for (const [code, resp] of Object.entries(op.responses)) {
        const statusClass = code.startsWith('2') ? 'success' : code.startsWith('4') ? 'error' : 'warning';
        responsesHtml += `<div class="api-docs__response">
            <span class="api-docs__status api-docs__status--${statusClass}">${code}</span>
            <span>${esc(resp.description)}</span>
        </div>`;

        const content = resp.content;
        if (content) {
            const ct = Object.keys(content)[0];
            const respSchema = content[ct]?.schema;
            if (respSchema && ct === 'application/json') {
                const resolved = resolveSchema(spec, respSchema);
                if (resolved) {
                    responsesHtml += renderSchemaProps(spec, resolved);
                    const example = schemaToExample(spec, resolved);
                    if (example) {
                        responsesHtml += `<pre class="api-docs__example">${JSON.stringify(example, null, 2)}</pre>`;
                    }
                }
            }
        }
    }

    // cURL example
    const baseUrl = spec.servers?.[0]?.url || 'https://api.example.com';
    let curl = `curl -X ${method.toUpperCase()} "${baseUrl}${path}"`;
    curl += ' \\\n  -H "X-API-Key: YOUR_API_KEY"';
    if (op.requestBody) {
        const ct = Object.keys(op.requestBody.content)[0];
        if (ct === 'application/json') {
            curl += ` \\\n  -H "Content-Type: application/json"`;
            const bodySchema = op.requestBody.content[ct]?.schema;
            const bodyExample = bodySchema ? schemaToExample(spec, bodySchema) : {};
            curl += ` \\\n  -d '${JSON.stringify(bodyExample, null, 2)}'`;
        } else if (ct === 'multipart/form-data') {
            curl += ` \\\n  -F "file=@grundriss.dwg"`;
        }
    }

    return `<div class="api-docs__endpoint" id="${id}">
        <div class="api-docs__endpoint-header" data-toggle="${id}-detail">
            <span class="api-docs__method api-docs__method--${colorClass}">${method.toUpperCase()}</span>
            <span class="api-docs__path">${path.replace(/\{(\w+)\}/g, '<span class="api-docs__param">{$1}</span>')}</span>
            <span class="api-docs__summary">${esc(op.summary || '')}</span>
            <svg class="api-docs__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
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
    const resp = await fetch('assets/openapi.json');
    const spec = await resp.json();

    const container = document.getElementById('api-docs-container');
    container.style.display = 'block';

    // Group endpoints by tag
    const tagGroups = {};
    for (const tag of spec.tags || []) {
        tagGroups[tag.name] = { description: tag.description, endpoints: [] };
    }

    for (const [path, methods] of Object.entries(spec.paths)) {
        for (const [method, op] of Object.entries(methods)) {
            const tag = op.tags?.[0] || 'General';
            if (!tagGroups[tag]) tagGroups[tag] = { description: '', endpoints: [] };
            tagGroups[tag].endpoints.push({ method, path, op });
        }
    }

    // Render
    let contentHtml = '';

    // Header section
    contentHtml += `<div class="api-docs__hero">
        <h1 class="api-docs__title">${spec.info.title}</h1>
        <div class="api-docs__meta">
            <span class="api-docs__version">v${spec.info.version}</span>
            <span class="api-docs__server">${spec.servers?.[0]?.url || ''}</span>
        </div>
        <p class="api-docs__intro">${spec.info.description}</p>
    </div>`;

    // Auth section
    contentHtml += `<div class="api-docs__auth" id="auth">
        <h2 class="api-docs__group-title">Authentication</h2>
        <p>All requests require an API key in the <code>X-API-Key</code> header. Keys can be requested through the BBL portal.</p>
        <pre class="api-docs__example">curl -H "X-API-Key: YOUR_API_KEY" ${spec.servers?.[0]?.url || ''}/health</pre>
    </div>`;

    for (const [tagName, group] of Object.entries(tagGroups)) {
        const tagId = tagName.toLowerCase().replace(/[^a-z0-9]/g, '-');

        contentHtml += `<div class="api-docs__group" id="tag-${tagId}">
            <h2 class="api-docs__group-title">${tagName}</h2>
            ${group.description ? `<p class="api-docs__group-desc">${esc(group.description)}</p>` : ''}
            ${group.endpoints.map(e => renderEndpoint(spec, e.method, e.path, e.op)).join('')}
        </div>`;
    }

    container.innerHTML = `<div class="api-docs__main">${contentHtml}</div>`;

    // Collapse/expand handlers
    container.querySelectorAll('.api-docs__endpoint-header').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.dataset.toggle;
            const detail = document.getElementById(targetId);
            const endpoint = header.closest('.api-docs__endpoint');
            if (detail) {
                detail.classList.toggle('open');
                endpoint.classList.toggle('expanded');
            }
        });
    });

}
