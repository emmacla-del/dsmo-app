export interface TransformOptions {
    entityType: string;
    surveyYear?: number;
}
export declare function transform(flatData: Record<string, unknown>, options: TransformOptions): Record<string, unknown>;
export declare function setDeep(obj: Record<string, unknown>, path: string, value: unknown): void;
export declare function getIndexSize(): number;
export declare function resolvePath(flatKey: string): string | undefined;
