// src/analytics/bilan.controller.ts
//
// Adds:  GET /dsmo/analytics/bilan?year=YYYY
//
// Drop this controller into your existing analytics module
// (or create a new BilanModule — see bottom of file).
//
// Auth: expects the same JWT guard used elsewhere in your app.
// The userId is extracted from req.user.id (standard NestJS pattern).
// Adjust the guard name / decorator if your project uses a different one.

import {
    Controller,
    Get,
    Query,
    Req,
    UseGuards,
    ParseIntPipe,
    DefaultValuePipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { BilanService } from './bilan.service';

// ── replace with your actual JWT guard import ──────────────────────────────
// e.g. import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// We use a placeholder so the file compiles without your guard path.
// If you don't use a guard decorator (middleware-based auth), just remove
// the @UseGuards line below.
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dsmo/analytics')
export class BilanController {
    constructor(private readonly bilanService: BilanService) { }

    /**
     * GET /dsmo/analytics/bilan?year=2025
     *
     * Returns the authenticated company's HR analytics for the given year.
     * Responds with 404 if no approved submission exists for that year —
     * the Flutter screen uses this to show the locked state.
     */
    @UseGuards(JwtAuthGuard)
    @Get('bilan')
    @HttpCode(HttpStatus.OK)
    async getBilan(
        @Req() req: Request & { user: { id: string } },
        @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe)
        year: number,
    ) {
        return this.bilanService.getBilan(req.user.id, year);
    }
}

// ─────────────────────────────────────────────────────────────
// MODULE (if you need a standalone module)
// Copy this into a separate bilan.module.ts or merge into your
// existing AnalyticsModule.
// ─────────────────────────────────────────────────────────────
//
// import { Module } from '@nestjs/common';
// import { PrismaModule } from '../prisma/prisma.module';
// import { BilanController } from './bilan.controller';
// import { BilanService } from './bilan.service';
//
// @Module({
//   imports: [PrismaModule],
//   controllers: [BilanController],
//   providers: [BilanService],
// })
// export class BilanModule {}
//
// Then add BilanModule to your AppModule imports array.