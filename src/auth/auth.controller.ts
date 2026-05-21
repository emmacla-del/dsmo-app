import { Controller, Post, Body, UseGuards, Request, Get, Patch, Param, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any) {
    return this.authService.login(req.user);
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
    respondentFirstName?: string;   // ← ADD THIS
    respondentLastName?: string;    // ← ADD THIS
    firstName?: string;             // ← ADD THIS (Flutter also sends this)
    lastName?: string;              // ← ADD THIS (Flutter also sends this)
    branch?: string;                // ← ADD THIS (was also missing)
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
        respondentFirstName: body.respondentFirstName ?? body.firstName,  // ← ADD
        respondentLastName: body.respondentLastName ?? body.lastName,     // ← ADD
        branch: body.branch,                                               // ← ADD
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

  @Get('check-email')
  async checkEmail(@Query('email') email: string) {
    const available = await this.authService.isEmailAvailable(email);
    return { available };
  }
}