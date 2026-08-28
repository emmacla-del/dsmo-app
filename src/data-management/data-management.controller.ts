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

  // Streams the ONEFOP Excel workbook directly to the response, sheet by
  // sheet (see streamOnefopSubmissionsExcel), instead of building the whole
  // multi-sheet workbook in memory and returning it as one Buffer — this
  // replaces the ONEFOP branch the old 'export/submissions' endpoint used
  // to handle, which no longer scales past a few thousand submissions.
  @Post('export/submissions/excel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP)
  async exportOnefopSubmissionsExcel(@Body() filters: any, @Res() res: Response) {
    await this.dataManagementService.streamOnefopSubmissionsExcel(filters, res);
  }

  // The .sps syntax half — fast and bounded (see buildSpssManifest's own
  // doc comment) regardless of how many submissions match the filters, so
  // this stays a plain JSON response. Call this first, then
  // 'export/submissions/spss/csv' with the same filters for the data
  // itself — the two are split so the (potentially large, slow) data
  // fetch is a real streamed file download rather than sharing a request/
  // response cycle with this quick manifest call.
  @Post('export/submissions/spss/manifest')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP)
  async exportSubmissionsSpssManifest(@Body() filters: any) {
    return this.dataManagementService.buildSpssManifest(filters);
  }

  // Streams the CSV directly to the response as it's computed (see
  // streamApprovedOnefopSubmissionsCsv) instead of buffering the whole
  // export in memory and returning it as one JSON string — the part of
  // this feature that actually has to scale with submission count.
  @Post('export/submissions/spss/csv')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP)
  async exportSubmissionsSpssCsv(@Body() filters: any, @Res() res: Response) {
    await this.dataManagementService.streamApprovedOnefopSubmissionsCsv(filters, res);
  }
}
