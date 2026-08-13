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
    Res,
    UseGuards,
    ParseIntPipe,
    DefaultValuePipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BilanService } from './bilan.service';
import { BilanPdfService } from './bilan-pdf.service';

// ── replace with your actual JWT guard import ──────────────────────────────
// e.g. import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// We use a placeholder so the file compiles without your guard path.
// If you don't use a guard decorator (middleware-based auth), just remove
// the @UseGuards line below.
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dsmo/analytics')
export class BilanController {
    constructor(
        private readonly bilanService: BilanService,
        private readonly bilanPdfService: BilanPdfService,
    ) { }

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

    /**
     * GET /dsmo/analytics/bilan/years
     *
     * Years the authenticated company has an approved Bilan RH for,
     * most recent first. Lets the Flutter screen offer a year selector
     * instead of assuming the current calendar year always has one.
     */
    @UseGuards(JwtAuthGuard)
    @Get('bilan/years')
    @HttpCode(HttpStatus.OK)
    async getBilanYears(@Req() req: Request & { user: { id: string } }) {
        const years = await this.bilanService.getAvailableYears(req.user.id);
        return { years };
    }

    /**
     * GET /dsmo/analytics/bilan/pdf?year=2026
     *
     * Same data as getBilan() above, rendered as a downloadable PDF.
     * Generated fresh on every request — not persisted to storage, unlike
     * the DSMO declaration / ONEFOP submission PDFs, since this is a
     * convenience export of already-live data rather than a legal document
     * that needs a durable, retrievable copy.
     */
    @UseGuards(JwtAuthGuard)
    @Get('bilan/pdf')
    async getBilanPdf(
        @Req() req: Request & { user: { id: string } },
        @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe)
        year: number,
        @Res() res: Response,
    ) {
        const bilan = await this.bilanService.getBilan(req.user.id, year);
        const buffer = await this.bilanPdfService.generate(bilan);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="bilan-rh-${year}.pdf"`);
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    }
}