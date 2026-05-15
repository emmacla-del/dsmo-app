export interface ScalarEntry {
    kind: 'scalar';
    dtoPath: string;
    mapper?: (v: string) => number;
    type?: 'number';
}
export interface NumberEntry {
    kind: 'number';
    dtoPath: string;
}
export interface StringEntry {
    kind: 'string';
    dtoPath: string;
}
export type IndexEntry = ScalarEntry | NumberEntry | StringEntry;
export declare function buildFlatIndex(): Map<string, IndexEntry>;
