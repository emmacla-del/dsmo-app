export declare class RegionDto {
    id: string;
    name: string;
    code?: string;
}
export declare class DepartmentDto {
    id: string;
    name: string;
    code?: string;
    regionId: string;
}
export declare class SubdivisionDto {
    id: string;
    name: string;
    code?: string;
    departmentId: string;
}
