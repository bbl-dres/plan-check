// =============================================
// Pure 2D geometry helpers (no DOM, no shared state)
// All inputs are in drawing units; callers convert to metres via mmPerUnit.
// =============================================

const TAU = Math.PI * 2;

// ── Polygons ──

/** Circular segment area added by a bulged edge of the given chord length (sign follows the bulge). */
function bulgeSegmentArea(bulge, chord) {
    if (!bulge || chord < 1e-12) return 0;
    const theta = 4 * Math.atan(Math.abs(bulge));
    const r = chord / (2 * Math.sin(theta / 2));
    return Math.sign(bulge) * (r * r / 2) * (theta - Math.sin(theta));
}

/**
 * Polygon area (absolute, drawing units squared). Vertices may carry a DWG bulge;
 * the circular segments of bulged edges are added to the shoelace area.
 */
function polygonArea(verts) {
    let twiceSigned = 0;
    let segments = 0;
    const n = verts.length;
    for (let i = 0; i < n; i++) {
        const a = verts[i], b = verts[(i + 1) % n];
        twiceSigned += a.x * b.y - b.x * a.y;
        if (a.bulge) segments += bulgeSegmentArea(a.bulge, Math.hypot(b.x - a.x, b.y - a.y));
    }
    return Math.abs(twiceSigned / 2 + segments);
}

/** Polygon area in m² for a drawing whose unit is mmPerUnit millimetres. */
export function polygonAreaM2(verts, mmPerUnit = 1) {
    return polygonArea(verts) * mmPerUnit * mmPerUnit / 1e6;
}

/** Ray-casting point-in-polygon test; points exactly on the boundary are undefined. */
export function pointInPolygon(px, py, verts) {
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i].x, yi = verts[i].y;
        const xj = verts[j].x, yj = verts[j].y;
        if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

/** Point-in-polygon with a bounding-box pre-check and a boundary tolerance (points within eps of an edge count as inside). */
export function pointInPolygonTolerant(px, py, verts, bounds, eps = 0) {
    if (bounds && (px < bounds.minX - eps || px > bounds.maxX + eps || py < bounds.minY - eps || py > bounds.maxY + eps)) return false;
    if (pointInPolygon(px, py, verts)) return true;
    return eps > 0 && distancePointToRing(px, py, verts) <= eps;
}

export function distancePointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-12) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Shortest distance from a point to the outline of a polygon (closed ring). */
function distancePointToRing(px, py, verts) {
    let min = Infinity;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const d = distancePointToSegment(px, py, verts[i].x, verts[i].y, verts[j].x, verts[j].y);
        if (d < min) min = d;
    }
    return min;
}

/** Shortest distance from a point to an open or closed polyline. */
export function distancePointToPolyline(px, py, verts, closed) {
    let min = Infinity;
    for (let i = 1; i < verts.length; i++) {
        min = Math.min(min, distancePointToSegment(px, py, verts[i - 1].x, verts[i - 1].y, verts[i].x, verts[i].y));
    }
    if (closed && verts.length > 2) {
        const a = verts[verts.length - 1], b = verts[0];
        min = Math.min(min, distancePointToSegment(px, py, a.x, a.y, b.x, b.y));
    }
    return min;
}

function cross(ax, ay, bx, by, cx, cy) {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/** True when segments a→b and c→d properly intersect (touching endpoints do not count). */
function segmentsIntersect(a, b, c, d) {
    const d1 = cross(c.x, c.y, d.x, d.y, a.x, a.y);
    const d2 = cross(c.x, c.y, d.x, d.y, b.x, b.y);
    const d3 = cross(a.x, a.y, b.x, b.y, c.x, c.y);
    const d4 = cross(a.x, a.y, b.x, b.y, d.x, d.y);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
           ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** O(n²) self-intersection test for a closed polygon. */
export function hasSelfIntersection(verts) {
    const n = verts.length;
    if (n < 4) return false;
    for (let i = 0; i < n; i++) {
        const i2 = (i + 1) % n;
        for (let j = i + 2; j < n; j++) {
            if (i === 0 && j === n - 1) continue; // adjacent edges share a vertex
            if (segmentsIntersect(verts[i], verts[i2], verts[j], verts[(j + 1) % n])) return true;
        }
    }
    return false;
}

/**
 * Orientation- and start-independent hash of a polygon at 0.1-unit precision, for duplicate detection.
 * A repeated closing vertex is dropped, the ring is rotated to its smallest vertex and forced counter-clockwise.
 */
export function canonicalPolygonHash(verts) {
    const pts = verts.map(v => [Math.round(v.x * 10), Math.round(v.y * 10)]);
    if (pts.length > 1) {
        const f = pts[0], l = pts[pts.length - 1];
        if (f[0] === l[0] && f[1] === l[1]) pts.pop();
    }
    if (pts.length === 0) return '';
    let twice = 0;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        twice += a[0] * b[1] - b[0] * a[1];
    }
    if (twice < 0) pts.reverse();
    let start = 0;
    for (let i = 1; i < pts.length; i++) {
        if (pts[i][0] < pts[start][0] || (pts[i][0] === pts[start][0] && pts[i][1] < pts[start][1])) start = i;
    }
    const rotated = pts.slice(start).concat(pts.slice(0, start));
    return rotated.map(p => p[0] + ',' + p[1]).join('|');
}

// ── Axis-aligned bounds ──

export function createBounds() {
    return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

export function expandBounds(b, x, y) {
    if (x < b.minX) b.minX = x;
    if (x > b.maxX) b.maxX = x;
    if (y < b.minY) b.minY = y;
    if (y > b.maxY) b.maxY = y;
    return b;
}

export function boundsOfPoints(points) {
    const b = createBounds();
    for (const p of points) expandBounds(b, p.x, p.y);
    return b;
}

export function mergeBounds(target, other) {
    expandBounds(target, other.minX, other.minY);
    return expandBounds(target, other.maxX, other.maxY);
}

export function isFiniteBounds(b) {
    return !!b && Number.isFinite(b.minX) && Number.isFinite(b.maxX) && Number.isFinite(b.minY) && Number.isFinite(b.maxY);
}

export function boundsIntersect(a, b) {
    return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export function boundsContain(outer, inner, tolerance = 0) {
    return inner.minX >= outer.minX - tolerance && inner.maxX <= outer.maxX + tolerance &&
           inner.minY >= outer.minY - tolerance && inner.maxY <= outer.maxY + tolerance;
}

// ── Affine transforms: [a, b, c, d, e, f] maps (x, y) → (a·x + c·y + e, b·x + d·y + f) ──

const IDENTITY = [1, 0, 0, 1, 0, 0];

export function affineApply(m, x, y) {
    return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/** Applies only the linear part (for direction vectors). */
function affineApplyVector(m, x, y) {
    return { x: m[0] * x + m[2] * y, y: m[1] * x + m[3] * y };
}

/** parent ∘ child: the child's coordinates are transformed first, then the parent's. */
export function affineMultiply(p, c) {
    return [
        p[0] * c[0] + p[2] * c[1],
        p[1] * c[0] + p[3] * c[1],
        p[0] * c[2] + p[2] * c[3],
        p[1] * c[2] + p[3] * c[3],
        p[0] * c[4] + p[2] * c[5] + p[4],
        p[1] * c[4] + p[3] * c[5] + p[5],
    ];
}

/** Block insertion: translate(-base) → scale → rotate → translate(insertion point). */
export function affineFromInsert(x, y, scaleX, scaleY, rotation, baseX = 0, baseY = 0) {
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    const a = cos * scaleX, b = sin * scaleX, c = -sin * scaleY, d = cos * scaleY;
    return [a, b, c, d, x - (a * baseX + c * baseY), y - (b * baseX + d * baseY)];
}

/** Determinant sign (mirroring), uniform scale factor and whether the transform is a similarity. */
export function affineInfo(m) {
    const det = m[0] * m[3] - m[1] * m[2];
    const sx = Math.hypot(m[0], m[1]);
    const sy = Math.hypot(m[2], m[3]);
    return {
        mirrored: det < 0,
        scale: Math.sqrt(Math.abs(det)),
        uniform: Math.abs(sx - sy) <= 1e-9 * Math.max(sx, sy, 1) && Math.abs(m[0] * m[2] + m[1] * m[3]) <= 1e-9 * Math.max(sx * sy, 1),
    };
}

// ── Arcs ──

/**
 * Circle through (x1,y1) and (x2,y2) for a DWG bulge value (tan of a quarter of the arc angle).
 * Returns null for coincident points. `clockwise` is true for negative bulges.
 */
export function bulgeArc(x1, y1, x2, y2, bulge) {
    const dx = x2 - x1, dy = y2 - y1;
    const chord = Math.hypot(dx, dy);
    if (chord < 1e-10) return null;
    const sagitta = Math.abs(bulge) * chord / 2;
    const radius = ((chord / 2) * (chord / 2) + sagitta * sagitta) / (2 * sagitta);
    const offset = (bulge > 0 ? 1 : -1) * (radius - sagitta);
    const cx = (x1 + x2) / 2 - dy / chord * offset;
    const cy = (y1 + y2) / 2 + dx / chord * offset;
    return {
        cx, cy, radius: Math.abs(radius),
        startAngle: Math.atan2(y1 - cy, x1 - cx),
        endAngle: Math.atan2(y2 - cy, x2 - cx),
        clockwise: bulge < 0,
    };
}

/** Counter-clockwise sweep from startAngle to endAngle, in (0, 2π]. */
function ccwSweep(startAngle, endAngle) {
    let sweep = (endAngle - startAngle) % TAU;
    if (sweep < 0) sweep += TAU;
    return sweep === 0 ? TAU : sweep;
}

/** True when `angle` lies on the counter-clockwise arc from startAngle to endAngle. */
export function angleOnArc(angle, startAngle, endAngle) {
    let rel = (angle - startAngle) % TAU;
    if (rel < 0) rel += TAU;
    return rel <= ccwSweep(startAngle, endAngle) + 1e-9;
}

/** Samples an arc (inclusive of both ends), counter-clockwise when ccw is true. */
export function sampleArc(cx, cy, r, startAngle, endAngle, ccw = true, minSteps = 12) {
    const sweep = ccw ? ccwSweep(startAngle, endAngle) : ccwSweep(endAngle, startAngle);
    const steps = Math.max(minSteps, Math.ceil(sweep / (Math.PI / 16)));
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const a = ccw ? startAngle + sweep * i / steps : startAngle - sweep * i / steps;
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    return pts;
}

/** Samples an elliptic arc given the major axis vector and the minor/major ratio (parametric angles). */
export function sampleEllipse(cx, cy, majorX, majorY, ratio, startAngle = 0, endAngle = TAU, ccw = true, minSteps = 24) {
    const majorLen = Math.hypot(majorX, majorY) || 1;
    const rot = Math.atan2(majorY, majorX);
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const minorLen = majorLen * ratio;
    const sweep = ccw ? ccwSweep(startAngle, endAngle) : ccwSweep(endAngle, startAngle);
    const steps = Math.max(minSteps, Math.ceil(sweep / (Math.PI / 24)));
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const a = ccw ? startAngle + sweep * i / steps : startAngle - sweep * i / steps;
        const lx = majorLen * Math.cos(a), ly = minorLen * Math.sin(a);
        pts.push({ x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos });
    }
    return pts;
}

/** Evaluates a (rational) B-spline into sample points; falls back to the control polygon for invalid data. */
export function sampleSpline(degree, knots, controlPoints, weights, samplesPerSpan = 8) {
    const n = controlPoints.length;
    if (!(degree >= 1) || n <= degree || !knots || knots.length < n + degree + 1) return controlPoints.slice();
    const uStart = knots[degree], uEnd = knots[n];
    const spans = Math.max(1, n - degree);
    const total = spans * samplesPerSpan;
    const pts = [];
    for (let s = 0; s <= total; s++) {
        const u = s === total ? uEnd : uStart + (uEnd - uStart) * s / total;
        // Find the knot span containing u
        let k = degree;
        while (k < n - 1 && u >= knots[k + 1]) k++;
        // De Boor in homogeneous coordinates
        const d = [];
        for (let j = 0; j <= degree; j++) {
            const p = controlPoints[k - degree + j];
            const w = weights ? (weights[k - degree + j] ?? 1) : 1;
            d.push([p.x * w, p.y * w, w]);
        }
        for (let r = 1; r <= degree; r++) {
            for (let j = degree; j >= r; j--) {
                const i = k - degree + j;
                const denom = knots[i + degree - r + 1] - knots[i];
                const alpha = denom === 0 ? 0 : (u - knots[i]) / denom;
                d[j] = [
                    (1 - alpha) * d[j - 1][0] + alpha * d[j][0],
                    (1 - alpha) * d[j - 1][1] + alpha * d[j][1],
                    (1 - alpha) * d[j - 1][2] + alpha * d[j][2],
                ];
            }
        }
        const w = d[degree][2] || 1;
        pts.push({ x: d[degree][0] / w, y: d[degree][1] / w });
    }
    return pts;
}

// ── Label placement ──

const MAX_INITIAL_CELLS = 4096;

/**
 * Pole of inaccessibility: the interior point farthest from any edge.
 * Unlike the centroid it stays inside concave and L-shaped rooms.
 */
export function visualCenter(verts) {
    if (verts.length < 3) {
        let cx = 0, cy = 0;
        for (const v of verts) { cx += v.x; cy += v.y; }
        return { x: cx / (verts.length || 1), y: cy / (verts.length || 1) };
    }

    const b = boundsOfPoints(verts);
    const width = b.maxX - b.minX;
    const height = b.maxY - b.minY;
    if (width < 1e-10 && height < 1e-10) return { x: b.minX, y: b.minY };

    // Signed distance to the outline: positive inside, negative outside
    const signedDistance = (px, py) => {
        const d = distancePointToRing(px, py, verts);
        return pointInPolygon(px, py, verts) ? d : -d;
    };

    // Slivers would produce millions of initial cells; cap the grid instead
    let cellSize = Math.min(width, height);
    if ((width / cellSize) * (height / cellSize) > MAX_INITIAL_CELLS) cellSize = Math.max(width, height) / 64;
    let h = cellSize / 2;
    const precision = cellSize * 0.01;

    const queue = [];
    for (let x = b.minX; x < b.maxX; x += cellSize) {
        for (let y = b.minY; y < b.maxY; y += cellSize) {
            const d = signedDistance(x + h, y + h);
            queue.push({ x: x + h, y: y + h, h, d, max: d + h * Math.SQRT2 });
        }
    }

    // Centroid is the initial best guess
    let cx = 0, cy = 0;
    for (const v of verts) { cx += v.x; cy += v.y; }
    cx /= verts.length; cy /= verts.length;
    let bestD = signedDistance(cx, cy);
    let bestX = cx, bestY = cy;

    // Ascending by potential; pop from the end = most promising cell first
    queue.sort((p, q) => p.max - q.max);

    let iterations = 0;
    while (queue.length > 0 && iterations++ < 5000) {
        const cell = queue.pop();
        if (cell.d > bestD) { bestD = cell.d; bestX = cell.x; bestY = cell.y; }
        if (cell.max - bestD <= precision) continue;

        h = cell.h / 2;
        for (const [dx, dy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
            const nx = cell.x + dx * h;
            const ny = cell.y + dy * h;
            const d = signedDistance(nx, ny);
            const item = { x: nx, y: ny, h, d, max: d + h * Math.SQRT2 };
            let lo = 0, hi = queue.length;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (queue[mid].max < item.max) lo = mid + 1; else hi = mid;
            }
            queue.splice(lo, 0, item);
        }
    }

    return { x: bestX, y: bestY };
}
