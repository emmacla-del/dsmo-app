import { Controller, Post, Body, UseGuards, Request, Get, Patch, Param, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  // ── Health check — wakes Render server on app startup ──
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any) {
    return this.authService.login(req.user);
  }

  // ── Session restoration — called by Flutter on app startup ──
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.id);
  }

  @Post('register')
  async register(@Body() body: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    region?: string;
    department?: string;
    matricule?: string;
    poste?: string;
    serviceCode?: string;
  }) {
    try {
      const user = await this.authService.register(
        body.email,
        body.password,
        body.firstName,
        body.lastName,
        body.role,
        body.region,
        body.department,
        body.matricule,
        body.poste,
        body.serviceCode,
      );
      if (body.role !== 'COMPANY') {
        return { message: "Inscription reçue. Votre compte est en attente d'approbation par un administrateur." };
      }
      return this.authService.login(user);
    } catch (error) {
      throw error;
    }
  }

  @Post('register-company')
  async registerCompany(@Body() body: {
    email: string;
    password: string;
    companyName: string;
    parentCompany?: string;
    mainActivity: string;
    secondaryActivity?: string;
    region: string;
    department: string;
    subdivision: string;
    address: string;
    taxNumber: string;
    cnpsNumber?: string;
    socialCapital?: number;
    contactName?: string;
    entityType?: string;
    area?: string;
    sectorId?: string;
    phone?: string;
    phone2?: string;
    poBox?: string;
    legalStatus?: string;
    cooperativeType?: string;
    ctdType?: string;
    yearOfCreation?: string;
    mainMission?: string;
    registrationNumber?: string;
    trainingDomains?: string;
    respondentPhone?: string;
    respondentPhone2?: string;
    respondentFunction?: string;
    respondentFirstName?: string;
    respondentLastName?: string;
    firstName?: string;
    lastName?: string;
    branch?: string;
  }) {
    return this.authService.registerCompany(
      body.email,
      body.password,
      {
        name: body.companyName,
        parentCompany: body.parentCompany,
        mainActivity: body.mainActivity,
        secondaryActivity: body.secondaryActivity,
        region: body.region,
        department: body.department,
        subdivision: body.subdivision,
        address: body.address,
        taxNumber: body.taxNumber,
        cnpsNumber: body.cnpsNumber,
        socialCapital: body.socialCapital,
        contactName: body.contactName,
        entityType: body.entityType,
        area: body.area,
        sectorId: body.sectorId,
        phone: body.phone,
        phone2: body.phone2,
        poBox: body.poBox,
        legalStatus: body.legalStatus,
        cooperativeType: body.cooperativeType,
        ctdType: body.ctdType,
        yearOfCreation: body.yearOfCreation,
        mainMission: body.mainMission,
        registrationNumber: body.registrationNumber,
        trainingDomains: body.trainingDomains,
        respondentPhone: body.respondentPhone,
        respondentPhone2: body.respondentPhone2,
        respondentFunction: body.respondentFunction,
        respondentFirstName: body.respondentFirstName ?? body.firstName,
        respondentLastName: body.respondentLastName ?? body.lastName,
        branch: body.branch,
      }
    );
  }

  // ===== ADMIN ENDPOINTS =====

  @Get('pending-minefop')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async getPendingMinefopUsers() {
    return this.authService.getPendingMinefopUsers();
  }

  @Patch('approve-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async approveUser(@Param('id') id: string) {
    return this.authService.approveUser(id);
  }

  @Patch('reject-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async rejectUser(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.authService.rejectUser(id);
  }

  // Admin-mediated reset: SUPER_ADMIN verifies identity out-of-band, then
  // generates a one-time temporary password to relay to the user directly.
  @Post('admin/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async adminResetPassword(@Body('email') email: string, @Request() req: any) {
    return this.authService.adminResetPassword(email, req.user.id);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(
      req.user.id,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Get('check-email')
  async checkEmail(@Query('email') email: string) {
    const available = await this.authService.isEmailAvailable(email);
    return { available };
  }

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Post('verify-email')
  async verifyEmail(@Body('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  async resendVerification(@Request() req: any) {
    return this.authService.resendVerificationEmail(req.user.id);
  }
}