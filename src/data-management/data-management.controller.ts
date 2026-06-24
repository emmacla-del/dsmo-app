import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { DataManagementService } from './data-management.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../types/prisma.types';

@Controller('data-management')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DataManagementController {
  constructor(private dataManagementService: DataManagementService) { }

  @Get('regions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGIONAL)
  async getRegions() {
    return this.dataManagementService.getRegions();
  }

  @Get('sectors')
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGIONAL)
  async getSectors() {
    return this.dataManagementService.getSectors();
  }

  @Patch('regions/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async updateRegion(@Param('id') id: string, @Body() data: { name?: string; code?: string; nameEn?: string }) {
    return this.dataManagementService.updateRegion(id, data);
  }

  @Delete('regions/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteRegion(@Param('id') id: string) {
    return this.dataManagementService.deleteRegion(id);
  }

  @Patch('sectors/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async updateSector(
    @Param('id') id: string,
    @Body() data: { name?: string; code?: string; category?: string; nameEn?: string },
  ) {
    return this.dataManagementService.updateSector(id, data);
  }

  @Delete('sectors/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteSector(@Param('id') id: string) {
    return this.dataManagementService.deleteSector(id);
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGIONAL)
  async getDataStats() {
    return this.dataManagementService.getDataStats();
  }

  @Post('export/submissions')
  @Roles(UserRole.SUPER_ADMIN)
  async exportSubmissions(@Body() filters: any) {
    return this.dataManagementService.exportSubmissions(filters);
  }
}
