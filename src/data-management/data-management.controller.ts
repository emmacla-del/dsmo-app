import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res, UseGuards, StreamableFile } from '@nestjs/common';
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL, UserRole.DATA_MANAGER, UserRole.ANALYST, UserRole.REGIONAL)
  async getRegions() {
    return this.dataManagementService.getRegions();
  }

  @Get('sectors')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL, UserRole.DATA_MANAGER, UserRole.ANALYST, UserRole.REGIONAL)
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL, UserRole.DATA_MANAGER, UserRole.ANALYST, UserRole.REGIONAL)
  async getDataStats() {
    return this.dataManagementService.getDataStats();
  }

  @Get('export/submissions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL, UserRole.DATA_MANAGER, UserRole.ANALYST, UserRole.REGIONAL)
  async getExportSubmissions(@Query() queryFilters: any, @Res({ passthrough: true }) res: Response) {
    return this.handleExportSubmissions(queryFilters, res);
  }

  @Post('export/submissions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL, UserRole.DATA_MANAGER, UserRole.ANALYST, UserRole.REGIONAL)
  async postExportSubmissions(@Body() bodyFilters: any, @Res({ passthrough: true }) res: Response) {
    return this.handleExportSubmissions(bodyFilters, res);
  }

  private async handleExportSubmissions(filters: any, res: Response) {
    const result = await this.dataManagementService.exportSubmissions(filters || {});

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

  @Get('export/submissions/excel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL, UserRole.DATA_MANAGER, UserRole.ANALYST, UserRole.REGIONAL)
  async getExportOnefopSubmissionsExcel(@Query() queryFilters: any, @Res() res: Response) {
    await this.dataManagementService.streamOnefopSubmissionsExcel(queryFilters || {}, res);
  }

  @Post('export/submissions/excel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL, UserRole.DATA_MANAGER, UserRole.ANALYST, UserRole.REGIONAL)
  async postExportOnefopSubmissionsExcel(@Body() bodyFilters: any, @Res() res: Response) {
    await this.dataManagementService.streamOnefopSubmissionsExcel(bodyFilters || {}, res);
  }

  @Get('export/submissions/spss/manifest')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL, UserRole.DATA_MANAGER, UserRole.ANALYST, UserRole.REGIONAL)
  async getExportSubmissionsSpssManifest(@Query() queryFilters: any) {
    return this.dataManagementService.buildSpssManifest(queryFilters || {});
  }

  @Post('export/submissions/spss/manifest')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL, UserRole.DATA_MANAGER, UserRole.ANALYST, UserRole.REGIONAL)
  async postExportSubmissionsSpssManifest(@Body() bodyFilters: any) {
    return this.dataManagementService.buildSpssManifest(bodyFilters || {});
  }

  @Get('export/submissions/spss/csv')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL, UserRole.DATA_MANAGER, UserRole.ANALYST, UserRole.REGIONAL)
  async getExportSubmissionsSpssCsv(@Query() queryFilters: any, @Res() res: Response) {
    await this.dataManagementService.streamApprovedOnefopSubmissionsCsv(queryFilters || {}, res);
  }

  @Post('export/submissions/spss/csv')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL, UserRole.DATA_MANAGER, UserRole.ANALYST, UserRole.REGIONAL)
  async postExportSubmissionsSpssCsv(@Body() bodyFilters: any, @Res() res: Response) {
    await this.dataManagementService.streamApprovedOnefopSubmissionsCsv(bodyFilters || {}, res);
  }

  @Get('export/submissions/spss/sav')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL, UserRole.DATA_MANAGER, UserRole.ANALYST, UserRole.REGIONAL)
  async getExportSubmissionsSpssSav(@Query() queryFilters: any, @Res() res: Response) {
    await this.dataManagementService.streamApprovedOnefopSubmissionsSav(queryFilters || {}, res);
  }

  @Post('export/submissions/spss/sav')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL, UserRole.DATA_MANAGER, UserRole.ANALYST, UserRole.REGIONAL)
  async postExportSubmissionsSpssSav(@Body() bodyFilters: any, @Res() res: Response) {
    await this.dataManagementService.streamApprovedOnefopSubmissionsSav(bodyFilters || {}, res);
  }
}
