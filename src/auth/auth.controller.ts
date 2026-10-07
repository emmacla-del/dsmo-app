import { Controller, Post, Body, UseGuards, UsePipes, ValidationPipe, Request, Get, Patch, Delete, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { StaffInvitationService } from './staff-invitation.service';
import { StaffInvitationLinkService } from './staff-invitation-link.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { READ_ONLY_NATIONAL_ROLES, TERRITORIAL_APPROVER_ROLES, USER_ADMIN_ROLES } from './staff-scope';
import { territoryFromUser } from './territory';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { AssistedRegistrationDto } from './dto/assisted-registration.dto';
import { ResubmitRegistrationDto } from './dto/resubmit-registration.dto';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { ActiveCompanyGuard } from './active-company.guard';
import { AllowInactiveCompany } from './allow-inactive-company.decorator';
import { UserStatus } from '../types/prisma.types';

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
// The statuses a company may still act under while its registration is being
// reviewed: account self-service and the correction flow stay reachable so a
// pending company is not locked out of its own account. REJECTED is absent,
// and isActive=false is denied by ActiveCompanyGuard regardless of this list.
const UNDER_REVIEW_STATUSES = [UserStatus.PENDING_APPROVAL, UserStatus.COMPLEMENTS_REQUESTED];

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private staffInvitations: StaffInvitationService,
    private staffInvitationLinks: StaffInvitationLinkService,
  ) { }

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
  @UseGuards(JwtAuthGuard, ActiveCompanyGuard)
  @AllowInactiveCompany()
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.id);
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
        regionId: body.regionId,
        departmentId: body.departmentId,
        subdivisionId: body.subdivisionId,
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
  // D1: ADMIN_ONEFOP too; the service limits it to ONEFOP staff roles.
  @Post('admin/create-minefop-user')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles('SUPER_ADMIN', 'ADMIN_ONEFOP')
  async adminCreateMinefopUser(@Request() req: any, @Body() body: {
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
    return this.authService.adminCreateMinefopUser(body, req.user.role, req.user.id);
  }

  // ── Staff invitations (see staff-invitation.service.ts) ──
  // An administrator invites an agent by link instead of creating the
  // account with a temporary password. The agent is placed in the MINEFOP
  // organigramme (serviceCode + positionType); the role is the service's.
  // SUPER_ADMIN invites into any service, ADMIN_ONEFOP into the
  // deconcentrated (territorial) services only.
  @Post('admin/staff-invitations')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles('SUPER_ADMIN', 'ADMIN_ONEFOP')
  async createStaffInvitation(@Request() req: any, @Body() body: {
    email?: string;
    serviceCode?: string;
    positionType?: string;
    region?: string;
    department?: string;
    grantAdminOnefop?: boolean;
  }) {
    return this.staffInvitations.create(body, { id: req.user.id, role: req.user.role });
  }

  // Public: the invited agent is not signed in. POST rather than GET so the
  // token travels in the body, not in a URL that ends up in access logs.
  @Throttle(RECOVERY_THROTTLE)
  @Post('staff-invitations/preview')
  async previewStaffInvitation(@Body() body: { token?: string }) {
    return this.staffInvitations.preview(body?.token);
  }

  @Throttle(RECOVERY_THROTTLE)
  @Post('staff-invitations/accept')
  async acceptStaffInvitation(@Body() body: {
    token?: string;
    firstName?: string;
    lastName?: string;
    matricule?: string;
    password?: string;
  }) {
    return this.staffInvitations.accept(body);
  }

  // ── Group invitation links (see staff-invitation-link.service.ts) ──
  // One link for a group of staff, posted in a WhatsApp group; each person
  // picks their service and post within the link's scope and gets an account
  // that waits for approval.
  @Post('admin/staff-invitation-links')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles('SUPER_ADMIN', 'ADMIN_ONEFOP')
  async createStaffInvitationLink(@Request() req: any, @Body() body: {
    label?: string;
    level?: string;
    region?: string;
    department?: string;
    expiresInDays?: number;
    maxUses?: number;
  }) {
    return this.staffInvitationLinks.create(body, { id: req.user.id, role: req.user.role });
  }

  @Get('admin/staff-invitation-links')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles('SUPER_ADMIN', 'ADMIN_ONEFOP')
  async listStaffInvitationLinks(@Request() req: any) {
    return this.staffInvitationLinks.list({ role: req.user.role });
  }

  @Patch('admin/staff-invitation-links/:id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles('SUPER_ADMIN', 'ADMIN_ONEFOP')
  async revokeStaffInvitationLink(@Request() req: any, @Param('id') id: string) {
    return this.staffInvitationLinks.revoke(id, { id: req.user.id, role: req.user.role });
  }

  // Public: the person holding the link is not signed in. Token in the body,
  // not the URL, so it stays out of access logs.
  @Throttle(RECOVERY_THROTTLE)
  @Post('staff-invitation-links/preview')
  async previewStaffInvitationLink(@Body() body: { token?: string }) {
    return this.staffInvitationLinks.preview(body?.token);
  }

  @Throttle(RECOVERY_THROTTLE)
  @Post('staff-invitation-links/sign-up')
  async signUpWithStaffInvitationLink(@Body() body: {
    token?: string;
    email?: string;
    serviceCode?: string;
    positionType?: string;
    firstName?: string;
    lastName?: string;
    matricule?: string;
    password?: string;
  }) {
    return this.staffInvitationLinks.signUp(body);
  }

  // Admin-assisted declarant registration — Phase 2 of
  // docs/plans/territorial-admin-monitoring.md. The field-work counterpart to
  // the public register-company route: a territorial admin registers a
  // declarant it met on a visit or over the phone.
  //
  // Same @Roles set as the registration review queue, because it is the same
  // population of reviewers; the service narrows a territorial actor to its
  // own ressort with assertTerritorialAuthority, so the guard's four roles are
  // the outer bound and not the whole check.
  //
  // The ValidationPipe override matches the public route's: the global pipe
  // sets skipMissingProperties: true, which would skip validation of any field
  // the client omits entirely and defeat the requiredness checks on the DTO.
  // whitelist strips anything the DTO does not declare — `password`,
  // `registrationMethod` and `createdBy` among them, so a caller cannot set
  // its own attribution or pick the declarant's password.
  @Post('admin/register-company')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles('SUPER_ADMIN', 'ADMIN_ONEFOP', 'REGIONAL_ADMIN', 'DIVISIONAL_ADMIN')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true, skipMissingProperties: false }))
  async adminRegisterCompany(@Request() req: any, @Body() body: AssistedRegistrationDto) {
    return this.authService.adminRegisterCompany(
      {
        email: body.email,
        name: body.companyName,
        parentCompany: body.parentCompany,
        mainActivity: body.mainActivity,
        secondaryActivity: body.secondaryActivity,
        region: body.region,
        department: body.department,
        subdivision: body.subdivision,
        regionId: body.regionId,
        departmentId: body.departmentId,
        subdivisionId: body.subdivisionId,
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
      },
      { ...territoryFromUser(req.user), id: req.user.id },
    );
  }

  @Get('pending-minefop')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles('SUPER_ADMIN')
  async getPendingMinefopUsers() {
    return this.authService.getPendingMinefopUsers();
  }

  // D3: REGIONAL_ADMIN / DIVISIONAL_ADMIN may review COMPANY registrations
  // in their territory (assertTerritorialAuthority in the company path).
  // They may not approve or reject STAFF accounts: the staff path,
  // assertCanApproveRegistration, refuses them (decision of 2026-10-07).
  // Added alongside USER_ADMIN_ROLES, which also guards list / suspend /
  // delete / re-role.
  // The former 'ADMIN_ONEFOP' entry is dropped: it now maps to ADMIN_ONEFOP,
  // which USER_ADMIN_ROLES already covers.
  @Patch('approve-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles(...USER_ADMIN_ROLES, ...TERRITORIAL_APPROVER_ROLES)
  // The body carries the review dialog's confirmations: the "structure
  // centrale" checkbox for an ADMINISTRATION file, and the reviewer's marks on
  // the entity's name, phone, contact email and CNPS. The service refuses the
  // approval unless every one that applies is strictly `true`; the dialog is
  // only the prompt, not the check. The pipe override validates the body as a
  // DTO (the global pipe skips missing properties) so a non-boolean is a 400.
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true, skipMissingProperties: false }))
  async approveUser(@Param('id') id: string, @Request() req: any, @Body() body: ApproveRegistrationDto) {
    return this.authService.approveUser(id, req.user.id, req.user.role, territoryFromUser(req.user), {
      centralStructureConfirmed: body?.centralStructureConfirmed,
      nameVerified: body?.nameVerified,
      phoneVerified: body?.phoneVerified,
      contactEmailVerified: body?.contactEmailVerified,
      cnpsVerified: body?.cnpsVerified,
    });
  }

  @Patch('reject-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles(...USER_ADMIN_ROLES, ...TERRITORIAL_APPROVER_ROLES)
  async rejectUser(@Param('id') id: string, @Request() req: any, @Body('reason') reason?: string) {
    return this.authService.rejectUser(id, req.user.id, req.user.role, territoryFromUser(req.user), reason ?? '');
  }

  @Patch('request-complements/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles(...USER_ADMIN_ROLES, ...TERRITORIAL_APPROVER_ROLES)
  async requestComplements(@Param('id') id: string, @Request() req: any, @Body('message') message?: string) {
    return this.authService.requestComplements(
      id,
      req.user.id,
      req.user.role,
      territoryFromUser(req.user),
      message ?? '',
    );
  }

  @Get('company-registrations')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles(...USER_ADMIN_ROLES, ...TERRITORIAL_APPROVER_ROLES, ...READ_ONLY_NATIONAL_ROLES)
  async listCompanyRegistrations(
    @Request() req: any,
    @Query('entityType') entityType?: string,
    @Query('region') region?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('createdBy') createdBy?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.authService.listCompanyRegistrations(territoryFromUser(req.user), {
      entityType,
      region,
      from,
      to,
      search,
      status,
      createdBy,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post('resubmit-registration')
  @UseGuards(JwtAuthGuard, ActiveCompanyGuard)
  @AllowInactiveCompany({ statuses: [UserStatus.COMPLEMENTS_REQUESTED] })
  // forbidNonWhitelisted, so an unknown key is a 400 rather than being quietly
  // dropped — that is what keeps establishmentId unreachable from this route.
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, skipMissingProperties: false }))
  async resubmitRegistration(@Request() req: any, @Body() body?: ResubmitRegistrationDto) {
    return this.authService.resubmitRegistration(req.user.id, body);
  }

  // ===== ACTIVE USER MANAGEMENT (excludes pending-approval flow above) =====

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
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
    @Query('fromCreatedAt') fromCreatedAt?: string,
    @Query('toCreatedAt') toCreatedAt?: string,
  ) {
    return this.authService.listUsers({
      search,
      role,
      roles,
      region,
      status,
      isActive,
      fromCreatedAt,
      toCreatedAt,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    }, req.user.role);
  }

  // Autocomplete for the audit journal's actor filter, which matches
  // AuditLog.userId exactly and therefore needs an id, not a typed name.
  // Declared ahead of the `users/:id/*` block: no GET takes an :id today,
  // but a literal segment registered after a parameterised one is read as
  // an id, so keeping the order makes adding GET users/:id safe.
  @Get('users/search')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles(...USER_ADMIN_ROLES)
  async searchUsers(@Request() req: any, @Query('q') q?: string) {
    return this.authService.searchUsers(q, req.user.role);
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles(...USER_ADMIN_ROLES)
  async updateUserRole(
    @Param('id') id: string,
    @Body('role') role: string,
    @Request() req: any,
  ) {
    return this.authService.updateUserRole(id, role, req.user.id, req.user.role);
  }

  // D1: ADMIN_ONEFOP too; updateUserTerritory already calls
  // assertCanManageRole on the target's current role and on the new role.
  @Patch('users/:id/territory')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles('SUPER_ADMIN', 'ADMIN_ONEFOP')
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
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles(...USER_ADMIN_ROLES)
  async suspendUser(@Param('id') id: string, @Request() req: any) {
    return this.authService.setUserActive(id, false, req.user.id, req.user.role);
  }

  @Patch('users/:id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles(...USER_ADMIN_ROLES)
  async activateUser(@Param('id') id: string, @Request() req: any) {
    return this.authService.setUserActive(id, true, req.user.id, req.user.role);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles(...USER_ADMIN_ROLES)
  async deleteUser(@Param('id') id: string, @Request() req: any) {
    return this.authService.deleteUser(id, req.user.id, req.user.role);
  }

  // Break-glass: recovers a user locked out of their account because their
  // 2FA code email never arrived. See AuthService.adminSetTwoFactorEnabled.
  @Patch('users/:id/two-factor')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles('SUPER_ADMIN')
  async adminSetTwoFactor(@Param('id') id: string, @Body('enabled') enabled: boolean) {
    return this.authService.adminSetTwoFactorEnabled(id, enabled);
  }

  // Admin-mediated reset: SUPER_ADMIN verifies identity out-of-band, then
  // this issues a reset token and emails the link directly to the user.
  @Post('admin/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles('SUPER_ADMIN')
  async adminResetPassword(@Body('email') email: string, @Request() req: any) {
    return this.authService.adminResetPassword(email, req.user.id);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard, ActiveCompanyGuard)
  @AllowInactiveCompany({ statuses: UNDER_REVIEW_STATUSES })
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
  @UseGuards(JwtAuthGuard, ActiveCompanyGuard)
  @AllowInactiveCompany({ statuses: UNDER_REVIEW_STATUSES })
  async deleteOwnAccount(@Request() req: any) {
    return this.authService.deactivateOwnAccount(req.user.id);
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard, ActiveCompanyGuard)
  @AllowInactiveCompany({ statuses: UNDER_REVIEW_STATUSES })
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
  @UseGuards(JwtAuthGuard, ActiveCompanyGuard)
  @AllowInactiveCompany({ statuses: UNDER_REVIEW_STATUSES })
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
  @UseGuards(JwtAuthGuard, ActiveCompanyGuard)
  async getAttestation(@Request() req: any) {
    return this.authService.getAttestation(req.user.id);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard, ActiveCompanyGuard)
  @AllowInactiveCompany({ statuses: UNDER_REVIEW_STATUSES })
  async resendVerification(@Request() req: any) {
    return this.authService.resendVerificationEmail(req.user.id);
  }
}