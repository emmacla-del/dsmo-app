// src/onefop/onefop.controller.ts
import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    UseGuards,
    Req,
    Res,
    Query,
    Param,
    ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { OnefopService } from './onefop.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('onefop')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnefopController {
    constructor(private readonly onefopService: OnefopService) { }

    @Get('submissions')
    @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL', 'SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP', 'COMPANY')
    async getSubmissions(
        @Req() req: any,
        @Query('status') status?: string,
        @Query('entityType') entityType?: string,
        @Query('region') region?: string,
        @Query('establishmentId') establishmentId?: string,
        @Query('quarterCode') quarterCode?: string,
    ) {
        return this.onefopService.getSubmissions(req.user, {
            status,
            entityType,
            region,
            establishmentId,
            quarterCode,
        });
    }

    @Get('submissions/:id')
    @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL', 'SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP', 'COMPANY')
    async getSubmissionDetail(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.onefopService.getSubmissionDetail(req.user, id);
    }

    @Get('submissions/:id/pdf')
    @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL', 'SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP', 'COMPANY')
    async downloadSubmissionPdf(@Param('id', ParseUUIDPipe) id: string, @Req() req: any, @Res() res: Response) {
        const url = await this.onefopService.getSubmissionPdfUrl(id, req.user);
        res.redirect(url);
    }

    @Get('active-quarter')
    async getActiveQuarter() {
        return this.onefopService.getActiveQuarter();
    }

    @Post('draft')
    @Roles('COMPANY')
    async saveDraft(
        @Req() req: any,
        @Body('quarterCode') quarterCode: string,
        @Body('entityType') entityType: string,
        @Body('draftData') draftData: any,
    ) {
        return this.onefopService.saveDraft(req.user.id, { quarterCode, entityType, draftData });
    }

    @Get('draft')
    @Roles('COMPANY')
    async getDrafts(@Req() req: any) {
        return this.onefopService.getDrafts(req.user.id);
    }

    @Delete('draft/:quarterCode')
    @Roles('COMPANY')
    async deleteDraft(@Req() req: any, @Param('quarterCode') quarterCode: string) {
        await this.onefopService.deleteDraft(req.user.id, quarterCode);
        return { success: true };
    }
}