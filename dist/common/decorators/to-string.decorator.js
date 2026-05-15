"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToString = void 0;
const class_transformer_1 = require("class-transformer");
const ToString = () => (0, class_transformer_1.Transform)(({ value }) => {
    if (value === null || value === undefined)
        return '';
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number')
        return value.toString();
    if (typeof value === 'boolean')
        return value.toString();
    if (typeof value === 'object')
        return JSON.stringify(value);
    return String(value);
});
exports.ToString = ToString;
//# sourceMappingURL=to-string.decorator.js.map