// src/auth/auth.controller.ts
import { Controller, Post, Body, UseGuards, Request, ConflictException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';

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
      );
      // Return a JWT immediately so the client doesn't need a second login call
      return this.authService.login(user);
    } catch (error) {
      // Pass through NestJS exceptions
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
    district: string;
    address: string;
    taxNumber: string;
    cnpsNumber?: string;
    socialCapital?: number;
    contactName?: string;
  }) {
    return this.authService.registerCompany(body.email, body.password, {
      name: body.companyName,
      parentCompany: body.parentCompany,
      mainActivity: body.mainActivity,
      secondaryActivity: body.secondaryActivity,
      region: body.region,
      department: body.department,
      district: body.district,
      address: body.address,
      taxNumber: body.taxNumber,
      cnpsNumber: body.cnpsNumber,
      socialCapital: body.socialCapital,
      contactName: body.contactName,
    });
  }
}