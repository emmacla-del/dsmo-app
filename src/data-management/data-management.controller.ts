import { Controller, Get, Post, Patch, Delete, Body, Param, Res, UseGuards, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.REGIONAL)
  async getRegions() {
    return this.dataManagementService.getRegions();
  }

  @Get('sectors')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.REGIONAL)
  async getSectors() {
    return this.dataManagementService.getSectors();
  }

  @Patch('regions/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP)
  async updateRegion(@Param('id') id: string, @Body() data: { name?: string; code?: string; nameEn?: string }) {
    return this.dataManagementService.updateRegion(id, data);
  }

  @Delete('regions/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP)
  async deleteRegion(@Param('id') id: string) {
    return this.dataManagementService.deleteRegion(id);
  }

  @Patch('sectors/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP)
  async updateSector(
    @Param('id') id: string,
    @Body() data: { name?: string; code?: string; category?: string; nameEn?: string },
  ) {
    return this.dataManagementService.updateSector(id, data);
  }

  @Delete('sectors/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP)
  async deleteSector(@Param('id') id: string) {
    return this.dataManagementService.deleteSector(id);
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.REGIONAL)
  async getDataStats() {
    return this.dataManagementService.getDataStats();
  }

  @Post('export/submissions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP)
  async exportSubmissions(@Body() filters: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.dataManagementService.exportSubmissions(filters);

    if (Buffer.isBuffer(result)) {
      const date = new Date().toISOString().slice(0, 10);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="onefop_submissions_${date}.xlsx"`,
      });
      return new StreamableFile(result);
    }

    return result;
  }

  @Post('export/submissions/spss')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP)
  async exportSubmissionsSpss(@Body() filters: any) {
    return this.dataManagementService.exportSubmissionsSpss(filters);
  }
}
