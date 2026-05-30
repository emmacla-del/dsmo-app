import { Controller, Get, Post, Body, UseGuards, Req, Query } from '@nestjs/common';
import { DataManagementService } from './data-management.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../types/prisma.types';

@Controller('api/data-management')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DataManagementController {
  constructor(private dataManagementService: DataManagementService) { }

  @Get('regions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGIONAL)
  async getRegions() {
    return this.dataManagementService.getRegions();
  }

  @Get('sectors')
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGIONAL)
  async getSectors() {
    return this.dataManagementService.getSectors();
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGIONAL)
  async getDataStats() {
    return this.dataManagementService.getDataStats();
  }

  @Post('export/submissions')
  @Roles(UserRole.SUPER_ADMIN)
  async exportSubmissions(@Body() filters: any) {
    return this.dataManagementService.exportSubmissions(filters);
  }
}
