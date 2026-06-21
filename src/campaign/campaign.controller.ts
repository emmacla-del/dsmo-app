// src/campaign/campaign.controller.ts
import {
    Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../types/prisma.types';

@Controller('campaigns')          // FIX 1: was 'api/campaigns' — caused /api/api/campaigns double prefix
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampaignController {
    constructor(private campaignService: CampaignService) { }

    @Post()
    @Roles(UserRole.SUPER_ADMIN, UserRole.CENTRAL)
    async createCampaign(@Body() data: any, @Req() req: any) {
        return this.campaignService.createCampaign({ ...data, createdBy: req.user.id });
    }

    @Get()
    @Roles(UserRole.SUPER_ADMIN, UserRole.CENTRAL, UserRole.REGIONAL)
    async listCampaigns(
        @Query('status') status?: string,
        @Query('type') type?: string,
        @Req() req?: any,
    ) {
        return this.campaignService.listCampaigns(status, type, req?.user);
    }

    // FIX 2: static routes must come BEFORE param routes (:id)
    // otherwise GET /campaigns/active/current matches :id with id='active'
    @Get('active/current')
    async getActiveCampaignsForCompany(@Req() req: any) {
        return this.campaignService.getActiveCampaignsForCompany(req.user.id);
    }

    // Lets the create-campaign dialog warn the admin before submitting if a
    // campaign already collecting for this module would be overwritten.
    @Get('conflicts')
    @Roles(UserRole.SUPER_ADMIN, UserRole.CENTRAL)
    async checkConflict(
        @Query('collectionType') collectionType: string,
        @Query('excludeId') excludeId?: string,
    ) {
        return this.campaignService.findActiveCampaignForModule(collectionType, excludeId);
    }

    @Get(':id')
    @Roles(UserRole.SUPER_ADMIN, UserRole.CENTRAL, UserRole.REGIONAL)
    async getCampaign(@Param('id') id: string) {
        return this.campaignService.getCampaign(id);
    }

    @Put(':id')
    @Roles(UserRole.SUPER_ADMIN, UserRole.CENTRAL)
    async updateCampaign(@Param('id') id: string, @Body() data: any) {
        return this.campaignService.updateCampaign(id, data);
    }

    @Delete(':id')
    @Roles(UserRole.SUPER_ADMIN)
    async deleteCampaign(@Param('id') id: string) {
        return this.campaignService.deleteCampaign(id);
    }

    @Post(':id/activate')
    @Roles(UserRole.SUPER_ADMIN, UserRole.CENTRAL)
    async activateCampaign(@Param('id') id: string, @Req() req: any) {
        return this.campaignService.activateCampaign(id, req.user.id);
    }

    @Post(':id/pause')
    @Roles(UserRole.SUPER_ADMIN, UserRole.CENTRAL)
    async pauseCampaign(@Param('id') id: string, @Req() req: any) {
        return this.campaignService.pauseCampaign(id, req.user.id);
    }

    @Post(':id/close')
    @Roles(UserRole.SUPER_ADMIN, UserRole.CENTRAL)
    async closeCampaign(@Param('id') id: string, @Req() req: any) {
        return this.campaignService.closeCampaign(id, req.user.id);
    }

    @Post(':id/extend')
    @Roles(UserRole.SUPER_ADMIN, UserRole.CENTRAL)
    async extendDeadline(@Param('id') id: string, @Body('newDeadline') newDeadline: string) {
        return this.campaignService.extendDeadline(id, new Date(newDeadline));
    }

    @Get(':id/progress')
    @Roles(UserRole.SUPER_ADMIN, UserRole.CENTRAL, UserRole.REGIONAL)
    async getProgress(@Param('id') id: string) {
        return this.campaignService.getCampaignProgress(id);
    }

    @Get(':id/submissions')
    @Roles(UserRole.SUPER_ADMIN, UserRole.CENTRAL, UserRole.REGIONAL)
    async getSubmissions(@Param('id') id: string, @Query('status') status?: string) {
        return this.campaignService.getCampaignSubmissions(id, { status });
    }

    @Post(':id/remind')
    @Roles(UserRole.SUPER_ADMIN, UserRole.CENTRAL)
    async sendReminders(@Param('id') id: string, @Body('type') type: string) {
        return this.campaignService.sendReminders(id, type);
    }
}