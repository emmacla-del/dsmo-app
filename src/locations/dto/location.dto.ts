export class RegionDto {
  id: string;
  name: string;
  code?: string;
}

export class DepartmentDto {
  id: string;
  name: string;
  code?: string;
  regionId: string;
}

export class SubdivisionDto {
  id: string;
  name: string;
  code?: string;
  departmentId: string;
}
