import { LocationsService } from './locations.service';
export declare class LocationsController {
    private readonly locationsService;
    constructor(locationsService: LocationsService);
    getAllRegions(): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string | null;
        nameEn: string | null;
    }[]>;
    getDepartmentsByRegion(regionId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        regionId: string;
        code: string | null;
        nameEn: string | null;
    }[]>;
    getSubdivisionsByDepartment(departmentId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        departmentId: string;
        code: string | null;
        nameEn: string | null;
    }[]>;
    getRegionById(id: string): Promise<({
        departments: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            regionId: string;
            code: string | null;
            nameEn: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string | null;
        nameEn: string | null;
    }) | null>;
    getDepartmentById(id: string): Promise<({
        subdivisions: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            departmentId: string;
            code: string | null;
            nameEn: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        regionId: string;
        code: string | null;
        nameEn: string | null;
    }) | null>;
}
