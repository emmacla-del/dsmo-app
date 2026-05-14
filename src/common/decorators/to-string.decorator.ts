// src/common/decorators/to-string.decorator.ts
import { Transform } from 'class-transformer';

/**
 * Automatically converts any value to a string during validation.
 * Handles:
 * - numbers → string (1 → "1")
 * - null/undefined → empty string
 * - objects → JSON string
 * - already strings → unchanged
 */
export const ToString = () => Transform(({ value }) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
});