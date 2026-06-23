import {
  Controller, Post, Body, UseGuards, Req, Get, Patch,
  Param, Query, Res, ParseIntPipe, NotFoundException
} from '@nestjs/common';
import type { Response } from 'express';
import { DsmoService } from './dsmo.service';
import { NotificationService } from './notification.service';
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
  ) { }

  // ===== COMPANY PROFILE =====

  @Get('company')
  @Roles('COMPANY')
  async getMyCompany(@Req() req: any) {
    const company = await this.dsmoService.getMyCompany(req.user.id);
    if (!company) throw new NotFoundException('Aucun profil entreprise trouvé.');
    return company;
  }

  @Post('company')
  @Roles('COMPANY')
  async saveCompanyProfile(@Req() req: any, @Body() dto: RegisterCompanyProfileDto) {
    return this.dsmoService.saveCompanyProfile(req.user.id, dto);
  }

  @Get('companies')
  @Roles('SUPER_ADMIN', 'SUPER_ADMIN_DSMO', 'SUPER_ADMIN_ONEFOP')
  async listCompanies(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.dsmoService.listCompanies({
      search,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  // ===== CORE DECLARATION ENDPOINTS =====

  @Get('active-period')
  async getActivePeriod() {
    return this.dsmoService.getActivePeriod();
  }

  @Post('declaration')
  @Roles('COMPANY')
  async submitDeclaration(@Req() req: any, @Body() dto: SubmitDeclarationDto) {
    return this.dsmoService.submitDeclaration(req.user.id, dto);
  }

  @Get('declarations/pending')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL', 'SUPER_ADMIN')
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
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL', 'SUPER_ADMIN', 'SUPER_ADMIN_DSMO')
  async getDeclarationStats(
    @Query('year', ParseIntPipe) year: number,
    @Query('region') region?: string,
    @Query('department') department?: string,
  ) {
    return this.dsmoService.getDeclarationStats(year, region, department);
  }

  // ===== NOTIFICATION & COMPLIANCE ENDPOINTS =====

  @Post('notifications/send')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL', 'SUPER_ADMIN', 'SUPER_ADMIN_DSMO', 'SUPER_ADMIN_ONEFOP')
  async sendNotification(
    @Req() req: any,
    @Body('subject') subject: string,
    @Body('message') message: string,
    @Body('filters') filters: any,
  ) {
    return this.notificationService.sendNotification(req.user.id, subject, message, filters);
  }

  // Static route — must come before GET 'notifications/:id' below, otherwise
  // Nest would never reach this one.
  @Get('notifications')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL', 'SUPER_ADMIN', 'SUPER_ADMIN_DSMO', 'SUPER_ADMIN_ONEFOP')
  async getNotifications(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.notificationService.getNotifications(req.user.id, page, limit);
  }

  @Get('notifications/:id')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL', 'SUPER_ADMIN', 'SUPER_ADMIN_DSMO', 'SUPER_ADMIN_ONEFOP')
  async getNotificationDetails(@Param('id') id: string) {
    return this.notificationService.getNotificationDetails(id);
  }

  @Get('notifications/:id/stats')
  @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL', 'SUPER_ADMIN', 'SUPER_ADMIN_DSMO', 'SUPER_ADMIN_ONEFOP')
  async getNotificationStats(@Param('id') id: string) {
    return this.notificationService.getNotificationStats(id);
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