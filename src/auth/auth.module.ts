// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { StaffInvitationService } from './staff-invitation.service';
import { StaffInvitationLinkService } from './staff-invitation-link.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { LocalStrategy } from './local.strategy';
import { DsmoModule } from '../dsmo/dsmo.module';
import { getJwtSecret } from './jwt-secret';

import { ActiveCompanyGuard } from './active-company.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
    DsmoModule,
  ],
  providers: [AuthService, StaffInvitationService, StaffInvitationLinkService, JwtStrategy, LocalStrategy, ActiveCompanyGuard],
  controllers: [AuthController],
  exports: [AuthService, ActiveCompanyGuard], // ✅ Export AuthService and ActiveCompanyGuard
})
export class AuthModule { }