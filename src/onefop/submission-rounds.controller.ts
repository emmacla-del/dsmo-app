// src/onefop/submission-rounds.controller.ts
import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { SubmissionRoundsService } from './submission-rounds.service';
import { CreateRoundDto } from '../dto/submission-round.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin/submission-rounds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SubmissionRoundsController {
    constructor(private readonly roundsService: SubmissionRoundsService) { }

    @Get()
    async list() {
        return this.roundsService.list();
    }

    @Post()
    async create(@Body() dto: CreateRoundDto) {
        return this.roundsService.create(dto);
    }

    @Patch(':id/open')
    async open(@Param('id') id: string, @Req() req: any) {
        return this.roundsService.open(id, req.user.id);
    }

    @Patch(':id/close')
    async close(@Param('id') id: string, @Req() req: any) {
        return this.roundsService.close(id, req.user.id);
    }
}
