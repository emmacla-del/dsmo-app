import { Controller, Post, Body, UseGuards, Req, Get, Patch, Param, Query } from '@nestjs/common';
import { DsmoService } from './dsmo.service';
import { NotificationService } from './notification.service';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SubmitDeclarationDto } from './dto/submit-declaration.dto';

@Controller('dsmo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DsmoController {
  constructor(
    private readonly dsmoService: DsmoService,
    private readonly notificationService: NotificationService,
    private readonly analyticsService: AnalyticsService,
  ) { }

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
  async validate(@Param('id') id: string, @Req() req: any, @Body('accept') accept: boolean, @Body('rejectionReason') rejectionReason?: string) {
    return this.dsmoService.validateDeclaration(id, req.user.id, accept, rejectionReason);
  }

  @Patch('declarations/:id/approve')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL')
  async approveDeclaration(@Param('id') id: string, @Req() req: any, @Body('notes') notes?: string) {
    return this.dsmoService.approveDeclaration(id, req.user.id, notes);
  }

  @Patch('declarations/:id/reject')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL')
  async rejectDeclaration(@Param('id') id: string, @Req() req: any, @Body('reason') reason: string) {
    return this.dsmoService.rejectDeclaration(id, req.user.id, reason);
  }

  @Get('declarations')
  async getDeclarations(
    @Req() req: any,
    @Query('year') year?: number,
    @Query('status') status?: string,
    @Query('region') region?: string,
    @Query('department') department?: string,
  ) {
    return this.dsmoService.getDeclarationsForUser(req.user.id, { year, status: status as any, region, department });
  }

  @Get('declarations/:id')
  async getDeclaration(@Param('id') id: string, @Req() req: any) {
    return this.dsmoService.getDeclarationWithAccess(req.user.id, id);
  }

  @Get('declarations/:id/stats')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL')
  async getDeclarationStats(
    @Query('year') year: number,
    @Query('region') region?: string,
    @Query('department') department?: string,
  ) {
    return this.dsmoService.getDeclarationStats(year, region, department);
  }

  // ===== NOTIFICATION ENDPOINTS =====

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

  @Post('notifications/deadline-reminder')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL')
  async sendDeadlineReminders(
    @Body('year') year: number,
    @Body('deadlineDate') deadlineDate: Date,
    @Body('regionFilter') regionFilter?: string,
    @Body('departmentFilter') departmentFilter?: string,
  ) {
    return this.notificationService.sendDeadlineReminders(year, new Date(deadlineDate), regionFilter, departmentFilter);
  }

  @Get('notifications')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL')
  async getNotifications(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.notificationService.getNotifications(req.user.id, page, limit);
  }

  @Get('notifications/:id')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL')
  async getNotificationDetails(@Param('id') id: string, @Req() req: any) {
    return this.notificationService.getNotificationDetails(id);
  }

  @Get('notifications/:id/stats')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL')
  async getNotificationStats(@Param('id') id: string) {
    return this.notificationService.getNotificationStats(id);
  }

  // ===== ANALYTICS ENDPOINTS =====

  @Get('analytics/employment-by-region')
  @Roles('CENTRAL')
  async getEmploymentByRegion(@Query('year') year: number) {
    return this.analyticsService.getEmploymentByRegion(year);
  }

  @Get('analytics/employment-trends')
  @Roles('CENTRAL')
  async getEmploymentTrends(
    @Query('startYear') startYear: number,
    @Query('endYear') endYear: number,
  ) {
    return this.analyticsService.getEmploymentTrends(startYear, endYear);
  }

  @Get('analytics/sector-distribution')
  @Roles('CENTRAL')
  async getSectorDistribution(@Query('year') year: number) {
    return this.analyticsService.getSectorDistribution(year);
  }

  @Get('analytics/gender-distribution')
  @Roles('CENTRAL')
  async getGenderDistribution(
    @Query('year') year: number,
    @Query('region') region?: string,
  ) {
    return this.analyticsService.getGenderDistribution(year, region);
  }

  @Get('analytics/category-distribution')
  @Roles('CENTRAL')
  async getCategoryDistribution(@Query('year') year: number) {
    return this.analyticsService.getCategoryDistribution(year);
  }

  @Get('analytics/recruitment-forecast')
  @Roles('CENTRAL')
  async getRecruitmentForecast(
    @Query('years') years: number = 3,
    @Query('forecastYears') forecastYears: number = 2,
  ) {
    return this.analyticsService.getRecruitmentForecast(years, forecastYears);
  }

  @Get('analytics/unemployment-risk')
  @Roles('CENTRAL')
  async getUnemploymentRiskRegions(@Query('year') year: number) {
    return this.analyticsService.getUnemploymentRiskRegions(year);
  }

  @Get('analytics/labor-shortages')
  @Roles('CENTRAL')
  async getSectorLaborShortages(@Query('year') year: number) {
    return this.analyticsService.getSectorLaborShortages(year);
  }

  @Get('analytics/recruitment-plans')
  @Roles('CENTRAL')
  async getCompaniesWithRecruitmentPlans(
    @Query('year') year: number,
    @Query('limit') limit: number = 20,
  ) {
    return this.analyticsService.getCompaniesWithRecruitmentPlans(year, limit);
  }

  @Get('analytics/dashboard-summary')
  @Roles('CENTRAL')
  async getDashboardSummary(
    @Query('year') year: number,
    @Query('region') region?: string,
  ) {
    return this.analyticsService.getDashboardSummary(year, region);
  }
}
