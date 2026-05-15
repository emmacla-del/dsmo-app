import { MapperKey } from '../schema/field-schema';
export type MapperFn = (value: string) => number;
export declare const MAPPERS: Record<MapperKey, MapperFn>;
