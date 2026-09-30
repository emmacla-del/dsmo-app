import { Controller, Post, Body, UseGuards, UsePipes, ValidationPipe, Request, Get, Patch, Delete, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { USER_ADMIN_ROLES } from './staff-scope';
import { RegisterCompanyDto } from './dto/register-company.dto';

// The app-wide default (60 req/60s per IP, app.module.ts) is too loose for
// credential/account-recovery endpoints — it doesn't stop someone rotating
// IPs from grinding through security-question answers or spamming
// registrations. These routes get a tighter, endpoint-specific override.
const AUTH_THROTTLE = { default: { limit: 8, ttl: 60_000 } };
const RECOVERY_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
// reset/verify is the actual account-takeover surface flagged in the audit
// (security-question answers are low-entropy and partly public) — tightest
// limit of the group.
const SECURITY_ANSWER_THROTTLE = { default: { limit: 5, ttl: 15 * 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  // ── Health check — wakes Render server on app startup ──
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @UseGuards(LocalAuthGuard)
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  async login(@Request() req: any) {
    if (req.user.twoFactorEnabled) {
      return this.authService.initiateTwoFactorChallenge(req.user);
    }
    return this.authService.login(req.user);
  }

  // Step 2 of 2FA login — see AuthService.initiateTwoFactorChallenge.
  @Throttle(AUTH_THROTTLE)
  @Post('2fa/verify')
  async verifyTwoFactor(@Body() body: { challengeToken: string; code: string }) {
    return this.authService.verifyTwoFactorCode(body.challengeToken, body.code);
  }

  // ── Session restoration — called by Flutter on app startup ──
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.id);
  }

  @Throttle(RECOVERY_THROTTLE)
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

  @Throttle(RECOVERY_THROTTLE)
  @Post('register-company')
  // Route-local override: the global pipe (main.ts) sets
  // skipMissingProperties: true, which would silently skip validation of
  // any field the client omits entirely from the body — defeating
  // @IsString()/@ValidateIf() requiredness checks below.
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true, skipMissingProperties: false }))
  async registerCompany(@Body() body: RegisterCompanyDto) {
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
        sigle: body.sigle,
        cfpType: body.cfpType,
        educationSystem: body.educationSystem,
        functionalStatus: body.functionalStatus,
        nonFunctionalReason: body.nonFunctionalReason,
        nonFunctionalReasonOther: body.nonFunctionalReasonOther,
        promoterName: body.promoterName,
        promoterSex: body.promoterSex,
        promoterPhone1: body.promoterPhone1,
        promoterPhone2: body.promoterPhone2,
      }
    );
  }

  // ===== ADMIN ENDPOINTS =====

  // Replaces the removed public MINEFOP self-registration flow: a
  // SUPER_ADMIN creates the agent account directly (ACTIVE immediately,
  // mustChangePassword: true) instead of the agent registering and
  // waiting for approve-user below.
  @Post('admin/create-minefop-user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async adminCreateMinefopUser(@Body() body: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    region?: string;
    department?: string;
    matricule?: string;
    poste?: string;
    serviceCode?: string;
    positionType?: string;
  }) {
    return this.authService.adminCreateMinefopUser(body);
  }

  @Get('pending-minefop')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async getPendingMinefopUsers() {
    return this.authService.getPendingMinefopUsers();
  }

  @Patch('approve-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...USER_ADMIN_ROLES)
  async approveUser(@Param('id') id: string, @Request() req: any) {
    return this.authService.approveUser(id, req.user.role);
  }

  @Patch('reject-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...USER_ADMIN_ROLES)
  async rejectUser(@Param('id') id: string, @Request() req: any, @Body('reason') reason?: string) {
    return this.authService.rejectUser(id, req.user.role);
  }

  // ===== ACTIVE USER MANAGEMENT (excludes pending-approval flow above) =====

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...USER_ADMIN_ROLES)
  async listUsers(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('roles') roles?: string,
    @Query('region') region?: string,
  ) {
    return this.authService.listUsers({
      search,
      role,
      roles,
      region,
      status,
      isActive,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    }, req.user.role);
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...USER_ADMIN_ROLES)
  async updateUserRole(
    @Param('id') id: string,
    @Body('role') role: string,
    @Request() req: any,
  ) {
    return this.authService.updateUserRole(id, role, req.user.id, req.user.role);
  }

  @Patch('users/:id/territory')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async updateUserTerritory(
    @Param('id') id: string,
    @Body('role') role: string,
    @Body('region') region: string,
    @Body('department') department: string,
    @Request() req: any,
  ) {
    return this.authService.updateUserTerritory(
      id,
      role,
      region ?? null,
      department ?? null,
      req.user.id,
      req.user.role,
    );
  }

  @Patch('users/:id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...USER_ADMIN_ROLES)
  async suspendUser(@Param('id') id: string, @Request() req: any) {
    return this.authService.setUserActive(id, false, req.user.id, req.user.role);
  }

  @Patch('users/:id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...USER_ADMIN_ROLES)
  async activateUser(@Param('id') id: string, @Request() req: any) {
    return this.authService.setUserActive(id, true, req.user.id, req.user.role);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...USER_ADMIN_ROLES)
  async deleteUser(@Param('id') id: string, @Request() req: any) {
    return this.authService.deleteUser(id, req.user.id, req.user.role);
  }

  // Break-glass: recovers a user locked out of their account because their
  // 2FA code email never arrived. See AuthService.adminSetTwoFactorEnabled.
  @Patch('users/:id/two-factor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async adminSetTwoFactor(@Param('id') id: string, @Body('enabled') enabled: boolean) {
    return this.authService.adminSetTwoFactorEnabled(id, enabled);
  }

  // Admin-mediated reset: SUPER_ADMIN verifies identity out-of-band, then
  // this issues a reset token and emails the link directly to the user.
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

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteOwnAccount(@Request() req: any) {
    return this.authService.deactivateOwnAccount(req.user.id);
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  async updatePreferences(
    @Request() req: any,
    @Body()
    body: {
      emailNotificationsEnabled?: boolean;
      pushNotificationsEnabled?: boolean;
      weeklyDigestEnabled?: boolean;
      smsNotificationsEnabled?: boolean;
    },
  ) {
    return this.authService.updatePreferences(req.user.id, body);
  }

  @Patch('two-factor')
  @UseGuards(JwtAuthGuard)
  async setTwoFactor(@Request() req: any, @Body('enabled') enabled: boolean) {
    return this.authService.setTwoFactorEnabled(req.user.id, enabled);
  }

  @Get('check-email')
  async checkEmail(@Query('email') email: string) {
    const available = await this.authService.isEmailAvailable(email);
    return { available };
  }

  @Throttle(RECOVERY_THROTTLE)
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Throttle(RECOVERY_THROTTLE)
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  // Self-service reset via security questions — demo-grade (low-entropy,
  // partly-public answers), so this and reset/verify below now carry the
  // tightest throttle in the controller rather than relying on the app-wide
  // default, which a rotating-IP attacker could otherwise use to grind
  // through answer guesses.
  @Throttle(RECOVERY_THROTTLE)
  @Post('reset/questions')
  async getResetSecurityQuestions(@Body('login') login: string) {
    return this.authService.getSecurityQuestions(login);
  }

  @Throttle(SECURITY_ANSWER_THROTTLE)
  @Post('reset/verify')
  async verifyResetSecurityAnswers(
    @Body()
    body: {
      login: string;
      answers: Record<string, string>;
      newPassword: string;
    },
  ) {
    return this.authService.resetPasswordWithSecurityAnswers(
      body.login,
      body.answers,
      body.newPassword,
    );
  }

  @Post('verify-email')
  async verifyEmail(@Body('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  // Self-service "identifiant oublié" — public, mirrors the reset/questions
  // and reset/verify security-question flow above but recovers the
  // establishmentId instead of resetting the password.
  @Throttle(RECOVERY_THROTTLE)
  @Post('identifier/find')
  async findIdentifier(
    @Body() body: { companyName: string; taxNumber: string; phone: string },
  ) {
    return this.authService.findIdentifier(body.companyName, body.taxNumber, body.phone);
  }

  @Get('attestation')
  @UseGuards(JwtAuthGuard)
  async getAttestation(@Request() req: any) {
    return this.authService.getAttestation(req.user.id);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  async resendVerification(@Request() req: any) {
    return this.authService.resendVerificationEmail(req.user.id);
  }
}