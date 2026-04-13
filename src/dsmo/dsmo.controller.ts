import {
  Controller, Post, Body, UseGuards, Req, Get, Patch,
  Param, Query, Res, ParseIntPipe
} from '@nestjs/common';
import type { Response } from 'express';
import { DsmoService } from './dsmo.service';
import { NotificationService } from './notification.service';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SubmitDeclarationDto } from './dto/submit-declaration.dto';
import { RegisterCompanyProfileDto } from './dto/register-company-profile.dto';
import { DeclarationStatus } from '../types/prisma.types';

@Controller('dsmo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DsmoController {
  constructor(
    private readonly dsmoService: DsmoService,
    private readonly notificationService: NotificationService,
    private readonly analyticsService: AnalyticsService,
  ) { }

  // ===== COMPANY PROFILE =====

  @Get('company')
  @Roles('COMPANY')
  async getMyCompany(@Req() req: any) {
    return this.dsmoService.getMyCompany(req.user.id);
  }

  @Post('company')
  @Roles('COMPANY')
  async saveCompanyProfile(@Req() req: any, @Body() dto: RegisterCompanyProfileDto) {
    return this.dsmoService.saveCompanyProfile(req.user.id, dto);
  }

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

  // ===== ANALYTICS & INTELLIGENCE ENDPOINTS (with SUPER_ADMIN added) =====

  @Get('analytics/employment-by-region')
  @Roles('CENTRAL', 'SUPER_ADMIN')
  async getEmploymentByRegion(@Query('year', ParseIntPipe) year: number) {
    return this.analyticsService.getEmploymentByRegion(year);
  }

  @Get('analytics/gender-distribution')
  @Roles('CENTRAL', 'SUPER_ADMIN')
  async getGenderDistribution(
    @Query('year', ParseIntPipe) year: number,
    @Query('region') region?: string,
  ) {
    return this.analyticsService.getGenderDistribution(year, region);
  }

  @Get('analytics/dashboard-summary')
  @Roles('CENTRAL', 'REGIONAL', 'SUPER_ADMIN')
  async getDashboardSummary(
    @Query('year', ParseIntPipe) year: number,
    @Query('region') region?: string,
  ) {
    return this.analyticsService.getDashboardSummary(year, region);
  }

  @Get('analytics/employment-trends')
  @Roles('CENTRAL', 'REGIONAL', 'SUPER_ADMIN')
  async getEmploymentTrends(
    @Query('startYear', ParseIntPipe) startYear: number,
    @Query('endYear', ParseIntPipe) endYear: number,
    @Query('region') region?: string,
  ) {
    return this.analyticsService.getEmploymentTrends(startYear, endYear, region);
  }

  @Get('analytics/sector-distribution')
  @Roles('CENTRAL', 'REGIONAL', 'SUPER_ADMIN')
  async getSectorDistribution(
    @Query('year', ParseIntPipe) year: number,
    @Query('region') region?: string,
  ) {
    return this.analyticsService.getSectorDistribution(year, region);
  }

  // ===== DOCUMENT MANAGEMENT ENDPOINTS =====

  @Get('declarations/:id/pdf/:copy')
  async downloadPdf(
    @Param('id') id: string,
    @Param('copy', ParseIntPipe) copy: number,
    @Req() req: any,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.dsmoService.getPdfPath(id, req.user.id, copy);
    res.redirect(url);
  }
}