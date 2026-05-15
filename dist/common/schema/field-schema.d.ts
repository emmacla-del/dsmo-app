export type MapperKey = 'area' | 'sector' | 'legalStatus' | 'size' | 'cooperativeType' | 'ctdType' | 'councilType';
export interface ScalarField {
    flat: string;
    map?: MapperKey;
    type?: 'number';
}
export interface RowDef {
    flatKey: string;
    dtoKey: string;
}
export type AxisType = 'age' | 'status' | 'gender';
export declare const AXIS_COLS: Record<AxisType, RowDef[]>;
export interface MatrixSpec {
    kind: 'matrix';
    prefix: string;
    dtoPath: string;
    rows: RowDef[];
    axes: AxisType[];
}
export interface ContractMatrixSpec {
    kind: 'contract_matrix';
    prefix: string;
    dtoPath: string;
    contracts: string[];
    rows: RowDef[];
    axes: AxisType[];
}
export interface TypedMatrixSpec {
    kind: 'typed_matrix';
    prefix: string;
    dtoPath: string;
    rows: RowDef[];
    types: RowDef[];
    axes: AxisType[];
}
export interface IndexedListSpec {
    kind: 'indexed_list';
    prefix: string;
    dtoPath: string;
    count: number;
    textField: string;
    textDtoField: string;
    axes: AxisType[];
}
export type TableSpec = MatrixSpec | ContractMatrixSpec | TypedMatrixSpec | IndexedListSpec;
export declare const SCALAR_SCHEMA: Record<string, ScalarField>;
export declare const TABLE_SCHEMA: TableSpec[];
