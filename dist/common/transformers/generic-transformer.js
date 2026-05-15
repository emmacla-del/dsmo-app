"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = transform;
exports.setDeep = setDeep;
exports.getIndexSize = getIndexSize;
exports.resolvePath = resolvePath;
const flat_index_builder_1 = require("./flat-index-builder");
const FLAT_INDEX = (0, flat_index_builder_1.buildFlatIndex)();
function transform(flatData, options) {
    const output = {
        organizationType: options.entityType,
        formType: options.entityType,
        surveyYear: options.surveyYear ?? new Date().getFullYear(),
    };
    for (const [flatKey, rawValue] of Object.entries(flatData)) {
        const entry = FLAT_INDEX.get(flatKey);
        if (!entry)
            continue;
        const resolved = resolveValue(rawValue, entry);
        setDeep(output, entry.dtoPath, resolved);
    }
    return output;
}
function resolveValue(raw, entry) {
    if (entry.kind === 'number')
        return toNumber(raw);
    if (entry.kind === 'string')
        return raw ?? '';
    const s = entry;
    if (s.mapper)
        return s.mapper(String(raw ?? ''));
    if (s.type === 'number')
        return toNumber(raw);
    return raw ?? '';
}
function toNumber(value) {
    if (typeof value === 'number')
        return value;
    if (value === undefined || value === null || value === '')
        return 0;
    const n = parseInt(String(value), 10);
    return isNaN(n) ? 0 : n;
}
function setDeep(obj, path, value) {
    const segments = tokenizePath(path);
    let cursor = obj;
    for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        const nextSeg = segments[i + 1];
        const nextIsIdx = isIndex(nextSeg);
        if (cursor[seg] === undefined || cursor[seg] === null) {
            cursor[seg] = nextIsIdx ? [] : {};
        }
        cursor = cursor[seg];
    }
    const lastSeg = segments[segments.length - 1];
    cursor[lastSeg] = value;
}
const PATH_SEGMENT_RE = /([^.[]+)|\[(\d+)\]/g;
function tokenizePath(path) {
    const parts = [];
    let match;
    while ((match = PATH_SEGMENT_RE.exec(path)) !== null) {
        parts.push(match[1] ?? match[2]);
    }
    return parts;
}
function isIndex(seg) {
    return /^\d+$/.test(seg);
}
function getIndexSize() {
    return FLAT_INDEX.size;
}
function resolvePath(flatKey) {
    return FLAT_INDEX.get(flatKey)?.dtoPath;
}
//# sourceMappingURL=generic-transformer.js.map