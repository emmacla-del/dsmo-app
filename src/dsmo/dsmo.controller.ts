import {
  Controller, Post, Body, UseGuards, Req, Get, Patch,
  Param, Query, Res, StreamableFile, ParseIntPipe
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import { DsmoService } from './dsmo.service';
import { NotificationService } from './notification.service';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SubmitDeclarationDto } from './dto/submit-declaration.dto';
import { DeclarationStatus } from '../types/prisma.types';

@Controller('dsmo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DsmoController {
  constructor(
    private readonly dsmoService: DsmoService,
    private readonly notificationService: NotificationService,
    private readonly analyticsService: AnalyticsService,
  ) { }

  // ===== CORE DECLARATION ENDPOINTS =====

  @Post('declaration')
  @Roles('COMPANY')
  async submitDeclaration(@Req() req: any, @Body() dto: SubmitDeclarationDto) {
    return this.dsmoService.submitDeclaration(req.user.id, dto);
  }

  @Get('declarations/pending')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL')
  async getPending(@Req() req: any) {
    return this.dsmoService.getPendingDeclarations(req.user);
  }

  /**
   * Universal Validation Endpoint
   * Used for both approval and rejection via a single boolean toggle.
   */
  @Patch('declarations/:id/validate')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL')
  async validate(
    @Param('id') id: string,
    @Req() req: any,
    @Body('accept') accept: boolean,
    @Body('rejectionReason') rejectionReason?: string,
  ) {
    return this.dsmoService.validateDeclaration(id, req.user.id, accept, rejectionReason);
  }

  @Get('declarations')
  async getDeclarations(
    @Req() req: any,
    @Query('year') year?: string,
    @Query('status') status?: DeclarationStatus,
    @Query('region') region?: string,
    @Query('department') department?: string,
  ) {
    return this.dsmoService.getDeclarationsForUser(req.user.id, {
      year: year ? parseInt(year, 10) : undefined,
      status,
      region,
      department,
    });
  }

  @Get('declarations/:id')
  async getDeclaration(@Param('id') id: string, @Req() req: any) {
    return this.dsmoService.getDeclarationWithAccess(req.user.id, id);
  }

  @Get('stats/summary')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL')
  async getDeclarationStats(
    @Query('year', ParseIntPipe) year: number,
    @Query('region') region?: string,
    @Query('department') department?: string,
  ) {
    return this.dsmoService.getDeclarationStats(year, region, department);
  }

  // ===== NOTIFICATION & COMPLIANCE ENDPOINTS =====

  @Post('notifications/send')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL')
  async sendNotification(
    @Req() req: any,
    @Body('subject') subject: string,
    @Body('message') message: string,
    @Body('filters') filters: any,
  ) {
    return this.notificationService.sendNotification(req.user.id, subject, message, filters);
  }

  @Get('notifications')
  async getNotifications(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.notificationService.getNotifications(req.user.id, page, limit);
  }

  // ===== ANALYTICS & INTELLIGENCE ENDPOINTS =====

  @Get('analytics/employment-by-region')
  @Roles('CENTRAL')
  async getEmploymentByRegion(@Query('year', ParseIntPipe) year: number) {
    return this.analyticsService.getEmploymentByRegion(year);
  }

  @Get('analytics/gender-distribution')
  @Roles('CENTRAL')
  async getGenderDistribution(
    @Query('year', ParseIntPipe) year: number,
    @Query('region') region?: string,
  ) {
    return this.analyticsService.getGenderDistribution(year, region);
  }

  @Get('analytics/dashboard-summary')
  @Roles('CENTRAL', 'REGIONAL')
  async getDashboardSummary(
    @Query('year', ParseIntPipe) year: number,
    @Query('region') region?: string,
  ) {
    return this.analyticsService.getDashboardSummary(year, region);
  }

  // ===== DOCUMENT MANAGEMENT ENDPOINTS =====

  @Get('declarations/:id/pdf/:copy')
  async downloadPdf(
    @Param('id') id: string,
    @Param('copy', ParseIntPipe) copy: number,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const filePath = await this.dsmoService.getPdfPath(id, req.user.id, copy);
    const filename = filePath.split(/[\\/]/).pop();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    const file = fs.createReadStream(filePath);
    return new StreamableFile(file);
  }
}