// src/onefop/onefop.controller.ts
import {
    Controller,
    Post,
    Get,
    Body,
    UseGuards,
    Req,
    Query,
    Param,
    ParseUUIDPipe,
} from '@nestjs/common';
import { OnefopService } from './onefop.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OnefopSubmissionDto } from '../dto/onefop-submission.dto';

@Controller('onefop')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnefopController {
    constructor(private readonly onefopService: OnefopService) { }

    @Post('submit')
    @Roles('COMPANY')
    async submitForm(@Req() req: any, @Body() dto: OnefopSubmissionDto) {
        return this.onefopService.submitForm(req.user.id, dto);
    }

    @Post('preview')
    @Roles('COMPANY')
    async previewForm(@Req() req: any, @Body() dto: OnefopSubmissionDto) {
        return this.onefopService.previewForm(req.user.id, dto);
    }

    @Get('submissions')
    @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL', 'SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP')
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
    @Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL', 'SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP')
    async getSubmissionDetail(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.onefopService.getSubmissionDetail(req.user.id, id);
    }

    @Get('active-quarter')
    async getActiveQuarter() {
        return this.onefopService.getActiveQuarter();
    }
}