import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { LocationsService } from './locations.service';

/**
 * Public reference data — intentionally unguarded.
 *
 * /sectors: national economic sector nomenclature.
 * /locations/*: administrative hierarchy (regions, departments,
 * subdivisions) published by the state.
 *
 * No PII, no per-user data. Guarding these adds friction without
 * protecting anything sensitive. If this assumption changes, add
 * @UseGuards(JwtAuthGuard).
 */
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) { }

  @Get('regions')
  @HttpCode(HttpStatus.OK)
  async getAllRegions() {
    return this.locationsService.getAllRegions();
  }

  @Get('regions/:regionId/departments')
  @HttpCode(HttpStatus.OK)
  async getDepartmentsByRegion(@Param('regionId') regionId: string) {
    return this.locationsService.getDepartmentsByRegion(regionId);
  }

  @Get('departments/:departmentId/subdivisions')
  @HttpCode(HttpStatus.OK)
  async getSubdivisionsByDepartment(@Param('departmentId') departmentId: string) {
    return this.locationsService.getSubdivisionsByDepartment(departmentId);
  }

  @Get('structure')
  @HttpCode(HttpStatus.OK)
  async getFullStructure() {
    return this.locationsService.getFullStructure();
  }

  @Get('regions/:id')
  @HttpCode(HttpStatus.OK)
  async getRegionById(@Param('id') id: string) {
    return this.locationsService.getRegionById(id);
  }

  @Get('departments/:id')
  @HttpCode(HttpStatus.OK)
  async getDepartmentById(@Param('id') id: string) {
    return this.locationsService.getDepartmentById(id);
  }
}