"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFlatIndex = buildFlatIndex;
const field_schema_1 = require("../schema/field-schema");
const field_mappers_1 = require("../mappers/field-mappers");
function buildFlatIndex() {
    const index = new Map();
    for (const [dtoPath, def] of Object.entries(field_schema_1.SCALAR_SCHEMA)) {
        const entry = { kind: 'scalar', dtoPath };
        if (def.map)
            entry.mapper = field_mappers_1.MAPPERS[def.map];
        if (def.type)
            entry.type = def.type;
        index.set(def.flat, entry);
    }
    for (const spec of field_schema_1.TABLE_SCHEMA) {
        switch (spec.kind) {
            case 'matrix':
                expandMatrix(spec, index);
                break;
            case 'contract_matrix':
                expandContractMatrix(spec, index);
                break;
            case 'typed_matrix':
                expandTypedMatrix(spec, index);
                break;
            case 'indexed_list':
                expandIndexedList(spec, index);
                break;
        }
    }
    return index;
}
function expandMatrix(spec, index) {
    const rows = withTotalRow(spec.rows);
    for (const row of rows) {
        expandCell(index, spec.axes, `${spec.prefix}_${row.flatKey}`, `${spec.dtoPath}.${row.dtoKey}`);
    }
}
function expandContractMatrix(spec, index) {
    for (const contract of spec.contracts) {
        for (const row of spec.rows) {
            expandCell(index, spec.axes, `${spec.prefix}_${contract}_${row.flatKey}`, `${spec.dtoPath}.${contract}.${row.dtoKey}`);
        }
        expandCell(index, spec.axes, `${spec.prefix}_${contract}_subtotal`, `${spec.dtoPath}.${contract}.subtotal`);
    }
    expandCell(index, spec.axes, `${spec.prefix}_grandtotal`, `${spec.dtoPath}.total`);
}
function expandTypedMatrix(spec, index) {
    for (const row of spec.rows) {
        for (const type of spec.types) {
            expandCell(index, spec.axes, `${spec.prefix}_${row.flatKey}_${type.flatKey}`, `${spec.dtoPath}.${row.dtoKey}.${type.dtoKey}`);
        }
    }
}
function expandIndexedList(spec, index) {
    const leafAxis = spec.axes[spec.axes.length - 1];
    for (let i = 1; i <= spec.count; i++) {
        const dtoPfx = `${spec.dtoPath}[${i - 1}]`;
        index.set(`${spec.prefix}_${spec.textField}_${i}_text`, { kind: 'string', dtoPath: `${dtoPfx}.${spec.textDtoField}` });
        for (const col of field_schema_1.AXIS_COLS[leafAxis]) {
            index.set(`${spec.prefix}_${spec.textField}_${i}_${col.flatKey}`, { kind: 'number', dtoPath: `${dtoPfx}.${col.dtoKey}` });
        }
    }
}
function expandCell(index, axes, flatPfx, dtoPfx) {
    const [head, ...rest] = axes;
    for (const col of field_schema_1.AXIS_COLS[head]) {
        const fk = `${flatPfx}_${col.flatKey}`;
        const dp = `${dtoPfx}.${col.dtoKey}`;
        if (rest.length === 0) {
            index.set(fk, { kind: 'number', dtoPath: dp });
        }
        else {
            expandCell(index, rest, fk, dp);
        }
    }
}
function withTotalRow(rows) {
    return rows.some(r => r.flatKey === 'total')
        ? rows
        : [...rows, { flatKey: 'total', dtoKey: 'total' }];
}
//# sourceMappingURL=flat-index-builder.js.map