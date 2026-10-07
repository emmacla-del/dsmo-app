import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res, Request, UseGuards, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { DataManagementService } from './data-management.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveCompanyGuard } from '../auth/active-company.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../types/prisma.types';
import { territoryFromUser } from '../auth/territory';

@Controller('data-management')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
export class DataManagementController {
  constructor(private dataManagementService: DataManagementService) { }

  @Get('regions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN, UserRole.CENTRAL_AGENT)
  async getRegions() {
    return this.dataManagementService.getRegions();
  }

  @Get('sectors')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN, UserRole.CENTRAL_AGENT)
  async getSectors() {
    return this.dataManagementService.getSectors();
  }

  @Patch('regions/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP)
  async updateRegion(@Param('id') id: string, @Body() data: { name?: string; code?: string; nameEn?: string }) {
    return this.dataManagementService.updateRegion(id, data);
  }

  @Delete('regions/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP)
  async deleteRegion(@Param('id') id: string) {
    return this.dataManagementService.deleteRegion(id);
  }

  @Patch('sectors/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP)
  async updateSector(
    @Param('id') id: string,
    @Body() data: { name?: string; code?: string; category?: string; nameEn?: string },
  ) {
    return this.dataManagementService.updateSector(id, data);
  }

  @Delete('sectors/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP)
  async deleteSector(@Param('id') id: string) {
    return this.dataManagementService.deleteSector(id);
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN, UserRole.CENTRAL_AGENT)
  async getDataStats(@Request() req: any) {
    const territory = territoryFromUser(req?.user);
    return this.dataManagementService.getDataStats(territory);
  }

  @Get('export/submissions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN)
  async getExportSubmissions(@Query() queryFilters: any, @Res({ passthrough: true }) res: Response, @Request() req: any) {
    return this.handleExportSubmissions(queryFilters, res, req);
  }

  @Post('export/submissions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN)
  async postExportSubmissions(@Body() bodyFilters: any, @Res({ passthrough: true }) res: Response, @Request() req: any) {
    return this.handleExportSubmissions(bodyFilters, res, req);
  }

  private async handleExportSubmissions(filters: any, res: Response, req?: any) {
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

  @Get('export/history')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN)
  async getExportHistory(@Query('limit') limit?: string) {
    const lim = limit ? parseInt(limit, 10) : 20;
    return this.dataManagementService.getExportHistory(lim);
  }

  @Get('export/submissions/excel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN)
  async getExportOnefopSubmissionsExcel(@Query() queryFilters: any, @Res() res: Response, @Request() req: any) {
    this.dataManagementService.logExport(req.user?.id, 'EXCEL', { filters: queryFilters });
    await this.dataManagementService.streamOnefopSubmissionsExcel(queryFilters || {}, res, territoryFromUser(req.user));
  }

  @Post('export/submissions/excel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN)
  async postExportOnefopSubmissionsExcel(@Body() bodyFilters: any, @Res() res: Response, @Request() req: any) {
    this.dataManagementService.logExport(req.user?.id, 'EXCEL', { filters: bodyFilters });
    await this.dataManagementService.streamOnefopSubmissionsExcel(bodyFilters || {}, res, territoryFromUser(req.user));
  }

  @Get('export/submissions/spss/manifest')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN)
  async getExportSubmissionsSpssManifest(@Query() queryFilters: any, @Request() req: any) {
    return this.dataManagementService.buildSpssManifest(queryFilters || {}, territoryFromUser(req.user));
  }

  @Post('export/submissions/spss/manifest')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN)
  async postExportSubmissionsSpssManifest(@Body() bodyFilters: any, @Request() req: any) {
    return this.dataManagementService.buildSpssManifest(bodyFilters || {}, territoryFromUser(req.user));
  }

  @Get('export/submissions/spss/csv')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN)
  async getExportSubmissionsSpssCsv(@Query() queryFilters: any, @Res() res: Response, @Request() req: any) {
    this.dataManagementService.logExport(req.user?.id, 'SPSS_CSV', { filters: queryFilters });
    await this.dataManagementService.streamApprovedOnefopSubmissionsCsv(queryFilters || {}, res, territoryFromUser(req.user));
  }

  @Post('export/submissions/spss/csv')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN)
  async postExportSubmissionsSpssCsv(@Body() bodyFilters: any, @Res() res: Response, @Request() req: any) {
    this.dataManagementService.logExport(req.user?.id, 'SPSS_CSV', { filters: bodyFilters });
    await this.dataManagementService.streamApprovedOnefopSubmissionsCsv(bodyFilters || {}, res, territoryFromUser(req.user));
  }

  @Get('export/submissions/spss/sav')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN)
  async getExportSubmissionsSpssSav(@Query() queryFilters: any, @Res() res: Response, @Request() req: any) {
    this.dataManagementService.logExport(req.user?.id, 'SPSS_SAV', { filters: queryFilters });
    await this.dataManagementService.streamApprovedOnefopSubmissionsSav(queryFilters || {}, res, territoryFromUser(req.user));
  }

  @Post('export/submissions/spss/sav')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN)
  async postExportSubmissionsSpssSav(@Body() bodyFilters: any, @Res() res: Response, @Request() req: any) {
    this.dataManagementService.logExport(req.user?.id, 'SPSS_SAV', { filters: bodyFilters });
    await this.dataManagementService.streamApprovedOnefopSubmissionsSav(bodyFilters || {}, res, territoryFromUser(req.user));
  }
}
