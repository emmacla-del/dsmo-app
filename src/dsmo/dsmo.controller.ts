import {
  Controller, Post, Body, UseGuards, Req, Get, Patch, Delete,
  Param, Query, Res, ParseIntPipe, NotFoundException
} from '@nestjs/common';
import type { Response } from 'express';
import { DsmoService } from './dsmo.service';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveCompanyGuard } from '../auth/active-company.guard';
import { Roles } from '../auth/roles.decorator';
import { SubmitDeclarationDto } from './dto/submit-declaration.dto';
import { RegisterCompanyProfileDto } from './dto/register-company-profile.dto';
import { DeclarationStatus, UserStatus } from '../types/prisma.types';
import { AllowInactiveCompany } from '../auth/allow-inactive-company.decorator';

@Controller('dsmo')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
export class DsmoController {
  constructor(
    private readonly dsmoService: DsmoService,
    private readonly notificationService: NotificationService,
  ) { }

  // ===== COMPANY PROFILE =====

  @Get('company')
  @Roles('COMPANY')
  // Prefills the registration-correction form, so a company under review has
  // to be able to read its own profile back. POST stays fully guarded.
  @AllowInactiveCompany({ statuses: [UserStatus.PENDING_APPROVAL, UserStatus.COMPLEMENTS_REQUESTED] })
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

  // The establishment register (GET /companies, GET /companies/stats) moved
  // to CompaniesController — it is the register of every registered entity,
  // not a DSMO surface.

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

  @Post('declaration/draft')
  @Roles('COMPANY')
  async saveDraft(
    @Req() req: any,
    @Body('year') year: number,
    @Body('draftData') draftData: any,
  ) {
    return this.dsmoService.saveDraft(req.user.id, year, draftData);
  }

  @Get('declaration/draft')
  @Roles('COMPANY')
  async getDraft(@Req() req: any) {
    return this.dsmoService.getDraft(req.user.id);
  }

  @Delete('declaration/draft')
  @Roles('COMPANY')
  async deleteDraft(@Req() req: any) {
    await this.dsmoService.deleteDraft(req.user.id);
    return { success: true };
  }

  @Post('declaration/preview')
  @Roles('COMPANY')
  async previewDeclaration(
    @Body() dto: SubmitDeclarationDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.dsmoService.previewDeclarationPdf(dto);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="apercu-declaration.pdf"');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  @Get('declarations/pending')
  @Roles('DIVISIONAL_ADMIN', 'REGIONAL_ADMIN', 'ADMIN_ONEFOP', 'SUPER_ADMIN')
  async getPending(@Req() req: any) {
    return this.dsmoService.getPendingDeclarations(req.user);
  }

  @Patch('declarations/:id/validate')
  @Roles('DIVISIONAL_ADMIN', 'REGIONAL_ADMIN', 'ADMIN_ONEFOP', 'SUPER_ADMIN')
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
  @Roles('DIVISIONAL_ADMIN', 'REGIONAL_ADMIN', 'ADMIN_ONEFOP', 'SUPER_ADMIN')
  async getDeclarationStats(
    @Query('year', ParseIntPipe) year: number,
    @Query('region') region?: string,
    @Query('department') department?: string,
  ) {
    return this.dsmoService.getDeclarationStats(year, region, department);
  }

  // ===== NOTIFICATION & COMPLIANCE ENDPOINTS =====

  @Post('notifications/send')
  @Roles('DIVISIONAL_ADMIN', 'REGIONAL_ADMIN', 'ADMIN_ONEFOP', 'SUPER_ADMIN')
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
  @Roles('DIVISIONAL_ADMIN', 'REGIONAL_ADMIN', 'ADMIN_ONEFOP', 'SUPER_ADMIN')
  async getNotifications(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.notificationService.getNotifications(req.user.id, page, limit);
  }

  @Get('notifications/:id')
  @Roles('DIVISIONAL_ADMIN', 'REGIONAL_ADMIN', 'ADMIN_ONEFOP', 'SUPER_ADMIN')
  async getNotificationDetails(@Param('id') id: string) {
    return this.notificationService.getNotificationDetails(id);
  }

  @Get('notifications/:id/stats')
  @Roles('DIVISIONAL_ADMIN', 'REGIONAL_ADMIN', 'ADMIN_ONEFOP', 'SUPER_ADMIN')
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