import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AnalyticsReportInput {
    reportId: string;
    title: string;
    /** 'completionRate' | 'employmentTrends' | 'genderParity' | etc. */
    type: string;
    sections: string[];
    scope: Record<string, any>;
    data: any;
    generatedAt: Date;
}

export interface AnalyticsReportResult {
    url: string;
    storagePath: string;
    hash: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS — portrait A4
// ═══════════════════════════════════════════════════════════════════════════════

const A4_W = 595.28;
const A4_H = 841.89;
const A_ML = 40;
const A_MR = 40;
const A_MT = 40;
const A_MB = 40;
const A_C_W = A4_W - A_ML - A_MR; // 515.28

// ── Design tokens ─────────────────────────────────────────────────────────────

const CLR_PRIMARY = '#0F6E56';
const CLR_PRIMARY_L = '#E1F5EE';
const CLR_ACCENT = '#1D9E75';
const CLR_DARK = '#1A2B22';
const CLR_MID = '#4A6358';
const CLR_MUTED = '#8BA898';
const CLR_BORDER = '#D5E8E1';
const CLR_BG_ROW = '#F7FBF9';
const CLR_ERROR = '#C0392B';
const CLR_WARNING = '#E67E22';
const CLR_WHITE = '#FFFFFF';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function fmtDate(d: Date | string): string {
    const dt = d instanceof Date ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${dt.getFullYear()}`;
}

function trunc(s: string, max: number): string {
    return s.length <= max ? s : s.slice(0, max - 1) + '\u2026';
}

function typeLabel(type: string): string {
    const map: Record<string, string> = {
        completionRate: 'Taux de compl\u00E9tion',
        employmentTrends: 'Tendances emploi',
        genderParity: 'Parit\u00E9 & inclusion',
        regionalComparison: 'Comparaison r\u00E9gionale',
        skillsGap: 'Analyse comp\u00E9tences',
        customMix: 'Rapport sur mesure',
    };
    return map[type] ?? type;
}

function sectionLabel(section: string): string {
    const map: Record<string, string> = {
        kpi: 'Indicateurs cl\u00E9s',
        regionalBreakdown: 'D\u00E9tail par r\u00E9gion',
        trends: 'Tendances temporelles',
        sectorAnalysis: 'Analyse sectorielle',
        establishmentPanel: 'Panel \u00E9tablissements',
        demographics: 'Parit\u00E9 & inclusion',
        insights: 'Recommandations',
    };
    return map[section] ?? section;
}

function rateColor(rate: number): string {
    if (rate >= 80) return CLR_PRIMARY;
    if (rate >= 50) return CLR_WARNING;
    return CLR_ERROR;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

@Injectable()
export class ReportPdfService {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    private readonly PDFDocument = require('pdfkit');
    private readonly supabase: SupabaseClient;
    private readonly bucketName = 'dsmo-pdfs';
    private readonly signedUrlExpirySeconds = 7 * 24 * 60 * 60; // 7 days
    private coatOfArmsBuffer: Buffer | null = null;

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error(
                'Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.',
            );
        }

        this.supabase = createClient(supabaseUrl, supabaseServiceKey);
        this.loadCoatOfArms();
    }

    // ── Coat of arms loader ──────────────────────────────────────────────────────
    // Tries local asset first (fast in dev), then falls back to Supabase storage.
    // Copy the PNG from your Flutter project:
    //   FROM: C:\Users\win\dsmo_app\assets\images\coat_of_arms.png
    //   TO:   <nestjs-root>/assets/images/coat_of_arms.png

    private async loadCoatOfArms(): Promise<void> {
        // 1 — local file (works without Supabase in dev)
        try {
            const localPath = path.join(process.cwd(), 'assets', 'images', 'coat_of_arms.png');
            if (fs.existsSync(localPath)) {
                this.coatOfArmsBuffer = fs.readFileSync(localPath);
                return;
            }
        } catch { /* fall through */ }

        // 2 — Supabase storage (production)
        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .download('assets/coat_of_arms.png');
            if (error || !data) return;
            this.coatOfArmsBuffer = Buffer.from(await data.arrayBuffer());
        } catch { /* non-fatal — placeholder circle used instead */ }
    }

    // ── Coat-of-arms watermark ───────────────────────────────────────────────────

    private drawCoatOfArmsWatermark(
        doc: any,
        pageW: number,
        pageH: number,
        opacity = 0.06,
        size = 220,
    ): void {
        if (!this.coatOfArmsBuffer) return;
        doc.save();
        doc.opacity(opacity);
        doc.image(
            this.coatOfArmsBuffer,
            (pageW - size) / 2,
            (pageH - size) / 2,
            { width: size, height: size },
        );
        doc.restore();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Generate a dynamic analytics report PDF and upload it to Supabase.
     *
     * Usage in report.service.ts:
     *
     *   const { url } = await this.reportPdfService.generateAnalyticsReport({
     *     reportId:    report.id,
     *     title:       report.name,
     *     type:        params.baseType,
     *     sections:    params.sections,
     *     scope:       params.scope,
     *     data:        completionRateOrPanelData,
     *     generatedAt: new Date(),
     *   });
     *   await this.prisma.report.update({
     *     where: { id: report.id },
     *     data:  { status: 'READY', fileUrl: url },
     *   });
     */
    async generateAnalyticsReport(input: AnalyticsReportInput): Promise<AnalyticsReportResult> {
        const buffer = await this.buildAnalyticsReport(input);
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');

        const year = input.scope?.year ?? new Date().getFullYear();
        const storagePath = `reports/${year}/${input.type}-${input.reportId}.pdf`;

        const { error: uploadError } = await this.supabase.storage
            .from(this.bucketName)
            .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });

        if (uploadError) {
            throw new Error(`Analytics PDF upload failed: ${uploadError.message}`);
        }

        const { data: signedData, error: signedError } = await this.supabase.storage
            .from(this.bucketName)
            .createSignedUrl(storagePath, this.signedUrlExpirySeconds);

        if (signedError || !signedData) {
            throw new Error(`Analytics PDF signed URL failed: ${signedError?.message}`);
        }

        return { url: signedData.signedUrl, storagePath, hash: `sha256:${hash}` };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PDF BUILDER
    // ═══════════════════════════════════════════════════════════════════════════

    private buildAnalyticsReport(input: AnalyticsReportInput): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            const doc = new this.PDFDocument({
                size: 'A4',
                layout: 'portrait',
                margins: { top: A_MT, bottom: A_MB, left: A_ML, right: A_MR },
                autoFirstPage: true,
                bufferPages: true,
                info: {
                    Title: input.title,
                    Author: 'MINEFOP \u2014 Syst\u00E8me de Suivi',
                    Subject: typeLabel(input.type),
                    Creator: 'MINEFOP Analytics',
                },
            });

            doc.on('data', (c: Buffer) => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Cover page — letterhead + title (NO background watermark on page 1;
            // the coat-of-arms already appears prominently in the letterhead itself)
            let y = this._drawReportCover(doc, input);

            // Body sections
            for (const section of input.sections) {
                y = this._ensureSpace(doc, y, 80);
                y = this._drawSectionDivider(doc, y, sectionLabel(section));

                switch (section) {
                    case 'kpi': y = this._drawKpiSection(doc, y, input); break;
                    case 'regionalBreakdown': y = this._drawRegionalBreakdown(doc, y, input); break;
                    case 'trends': y = this._drawTrendsSection(doc, y, input); break;
                    case 'sectorAnalysis': y = this._drawSectorAnalysis(doc, y, input); break;
                    case 'establishmentPanel': y = this._drawEstablishmentPanel(doc, y, input); break;
                    case 'demographics': y = this._drawDemographics(doc, y, input); break;
                    case 'insights': y = this._drawInsights(doc, y, input); break;
                    default: break;
                }

                y += 16;
            }

            // Post-process: add watermark + page numbers to all pages
            this._drawPageNumbers(doc);
            doc.end();
        });
    }

    // ── Cover page ───────────────────────────────────────────────────────────────

    private _drawReportCover(doc: any, input: AnalyticsReportInput): number {
        const { scope, type, generatedAt, sections } = input;

        const colFrW = Math.round(A_C_W * 0.37);
        const colLoW = Math.round(A_C_W * 0.26);
        const colEnW = A_C_W - colFrW - colLoW;
        const colFrX = A_ML;
        const colLoX = A_ML + colFrW;
        const colEnX = A_ML + colFrW + colLoW;

        let y = 18;

        const frLines = [
            { text: 'REPUBLIQUE DU CAMEROUN', bold: true, size: 7.5 },
            { text: 'Paix \u2013 Travail \u2013 Patrie', bold: false, size: 7.5 },
            { text: '-----------', bold: false, size: 6.5, muted: true },
            { text: "MINISTERE DE L\u2019EMPLOI ET DE LA FORMATION PROFESSIONNELLE", bold: true, size: 7 },
            { text: '-----------', bold: false, size: 6.5, muted: true },
            { text: 'SECRETARIAT GENERAL', bold: false, size: 7 },
            { text: '-----------', bold: false, size: 6.5, muted: true },
            { text: "OBSERVATOIRE NATIONAL DE L\u2019EMPLOI ET DE LA FORMATION PROFESSIONNELLE", bold: false, size: 7 },
            { text: '-----------', bold: false, size: 6.5, muted: true },
        ];

        const enLines = [
            { text: 'REPUBLIC OF CAMEROON', bold: true, size: 7.5 },
            { text: 'Peace \u2013 Work \u2013 Fatherland', bold: false, size: 7.5 },
            { text: '-----------', bold: false, size: 6.5, muted: true },
            { text: 'MINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING', bold: true, size: 7 },
            { text: '-----------', bold: false, size: 6.5, muted: true },
            { text: 'SECRETARIAT GENERAL', bold: false, size: 7 },
            { text: '-----------', bold: false, size: 6.5, muted: true },
            { text: 'NATIONAL OBSERVATORY OF EMPLOYMENT AND VOCATIONAL TRAINING', bold: false, size: 7 },
            { text: '-----------', bold: false, size: 6.5, muted: true },
        ];

        let fy = y;
        for (const l of frLines) {
            doc.fillColor((l as any).muted ? '#444444' : '#000000')
                .font(l.bold ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(l.size);
            doc.text(l.text, colFrX, fy, { width: colFrW, align: 'center', lineBreak: false });
            fy += l.size * 1.45;
        }

        let ey = y;
        for (const l of enLines) {
            doc.fillColor((l as any).muted ? '#444444' : '#000000')
                .font(l.bold ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(l.size);
            doc.text(l.text, colEnX, ey, { width: colEnW, align: 'center', lineBreak: false });
            ey += l.size * 1.45;
        }

        // Centre coat-of-arms (visible / not watermark — part of the letterhead)
        const logoSize = 28;
        const logoX = colLoX + (colLoW - logoSize) / 2;
        const logoY = y + 2;
        if (this.coatOfArmsBuffer) {
            doc.image(this.coatOfArmsBuffer, logoX, logoY, { width: logoSize, height: logoSize });
        } else {
            doc.circle(colLoX + colLoW / 2, logoY + logoSize / 2, logoSize / 2).stroke('#AAAAAA');
        }

        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(5.5);
        doc.text(
            "OBSERVATOIRE NATIONAL DE L\u2019EMPLOI\nET DE LA FORMATION PROFESSIONNELLE",
            colLoX, logoY + logoSize + 3,
            { width: colLoW, align: 'center' },
        );

        // Dark-blue title bar
        const barY = Math.max(fy, ey) + 4;
        const barH = 22;
        doc.rect(0, barY, A4_W, barH).fill('#1F3864');
        doc.fillColor(CLR_WHITE).font('Helvetica-Bold').fontSize(8);
        doc.text(
            "COLLECTE DES DONN\u00C9ES SUR LES EMPLOIS CR\u00C9\u00C9S PAR LE SECTEUR MODERNE DE L\u2019\u00C9CONOMIE",
            A_ML, barY + 5,
            { width: A_C_W, align: 'center', lineBreak: false },
        );
        doc.fillColor(CLR_WHITE).font('Helvetica-Oblique').fontSize(7);
        doc.text(
            `\u2013 ${typeLabel(type)} \u2013`,
            A_ML, barY + 14,
            { width: A_C_W, align: 'center', lineBreak: false },
        );

        // Confidentiality notice
        const confY = barY + barH + 4;
        const confH = 22;
        doc.rect(A_ML, confY, A_C_W, confH).stroke('#000000');
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(6.5);
        doc.text(
            "Les informations contenues dans ce document sont confidentielles et ne pourront \u00EAtre utilis\u00E9es " +
            "\u00E0 des fins de poursuites judiciaires, de contr\u00F4le fiscal ou de r\u00E9pression \u00E9conomique, " +
            "conform\u00E9ment \u00E0 la Loi N\u00B0 2020/010 du 20 juillet 2020 relative aux recensements et enqu\u00EAtes Statistiques.",
            A_ML + 3, confY + 3,
            { width: A_C_W - 6, lineBreak: true },
        );

        // Report title block
        const titleY = confY + confH + 14;
        doc.fillColor(CLR_DARK).font('Helvetica-Bold').fontSize(18);
        doc.text(typeLabel(type).toUpperCase(), A_ML, titleY, { width: A_C_W, align: 'center' });

        const scopeLine = [
            scope?.year ? `Ann\u00E9e ${scope.year}` : null,
            scope?.region ? scope.region : 'Nationale',
            scope?.fromQuarter && scope?.toQuarter
                ? `${scope.fromQuarter} \u2192 ${scope.toQuarter}` : null,
        ].filter(Boolean).join('   \u00B7   ');

        doc.fillColor(CLR_MID).font('Helvetica').fontSize(10);
        doc.text(scopeLine, A_ML, titleY + 26, { width: A_C_W, align: 'center' });
        doc.fillColor(CLR_MUTED).font('Helvetica').fontSize(8);
        doc.text(`G\u00E9n\u00E9r\u00E9 le ${fmtDate(generatedAt)}`, A_ML, titleY + 42, { width: A_C_W, align: 'center' });

        // Sections index strip
        const stripY = titleY + 58;
        const stripH = 18;
        doc.rect(0, stripY, A4_W, stripH).fill('#1F3864');
        doc.fillColor(CLR_WHITE).font('Helvetica').fontSize(7);
        doc.text(
            sections.map(sectionLabel).join('   \u00B7   '),
            A_ML, stripY + 5,
            { width: A_C_W, align: 'center' },
        );

        // Green separator rule
        const ruleY = stripY + stripH + 8;
        doc.moveTo(A_ML, ruleY).lineTo(A_ML + A_C_W, ruleY)
            .strokeColor(CLR_ACCENT).lineWidth(1.5).stroke();
        doc.strokeColor('#000000').lineWidth(1);

        doc.fillColor(CLR_DARK);
        return ruleY + 14;
    }

    // ── Layout helpers ────────────────────────────────────────────────────────────

    private _ensureSpace(doc: any, y: number, needed: number): number {
        if (y + needed > A4_H - A_MB) {
            doc.addPage();
            return A_MT;
        }
        return y;
    }

    private _drawSectionDivider(doc: any, y: number, label: string): number {
        doc.rect(A_ML, y, 4, 20).fill(CLR_ACCENT);
        doc.fillColor(CLR_DARK).font('Helvetica-Bold').fontSize(11);
        doc.text(label.toUpperCase(), A_ML + 12, y + 4, { lineBreak: false });
        doc.moveTo(A_ML + 12, y + 20).lineTo(A_ML + A_C_W, y + 20)
            .strokeColor(CLR_BORDER).lineWidth(0.5).stroke();
        doc.strokeColor('black').lineWidth(1);
        return y + 30;
    }

    /**
     * Post-process: called after all content is written.
     * Adds coat-of-arms watermark (pages 2+) and footer page numbers to every page.
     */
    private _drawPageNumbers(doc: any): void {
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(range.start + i);

            // Coat-of-arms background watermark on every body page (skip cover —
            // coat-of-arms already in the letterhead there)
            if (i > 0) {
                this.drawCoatOfArmsWatermark(doc, A4_W, A4_H, 0.06, 220);
            }

            // Footer rule
            doc.moveTo(A_ML, A4_H - A_MB + 10).lineTo(A_ML + A_C_W, A4_H - A_MB + 10)
                .strokeColor(CLR_BORDER).lineWidth(0.5).stroke();
            doc.strokeColor('#000000').lineWidth(1);

            // Page number
            doc.fillColor(CLR_MUTED).font('Helvetica').fontSize(7);
            doc.text(
                `MINEFOP  \u00B7  Confidentiel  \u00B7  Page ${i + 1} / ${range.count}`,
                A_ML, A4_H - A_MB + 14,
                { width: A_C_W, align: 'center', lineBreak: false },
            );
        }
    }

    // ── KPI cards ─────────────────────────────────────────────────────────────────

    private _drawKpiSection(doc: any, y: number, input: AnalyticsReportInput): number {
        const { data, type } = input;
        const summary = data?.summary ?? {};
        const cards: Array<{ label: string; value: string; sub?: string; color?: string }> = [];

        if (type === 'completionRate') {
            const rate = parseFloat(summary.completionRate ?? '0');
            cards.push(
                { label: 'Taux de compl\u00E9tion', value: `${summary.completionRate ?? '\u2013'}%`, color: rateColor(rate) },
                { label: 'Total \u00E9tablissements', value: String(summary.total ?? '\u2013') },
                { label: 'Soumis', value: String(summary.submitted ?? '\u2013'), color: CLR_PRIMARY },
                { label: 'Valid\u00E9s', value: String(summary.validated ?? '\u2013'), color: CLR_ACCENT },
                { label: 'En cours', value: String(summary.inProgress ?? '\u2013'), color: CLR_WARNING },
                { label: 'Non d\u00E9marr\u00E9s', value: String(summary.notStarted ?? '\u2013'), color: CLR_ERROR },
            );
        } else if (type === 'employmentTrends') {
            cards.push(
                { label: '\u00C9tablissements', value: String(summary.totalEstablishments ?? '\u2013') },
                { label: 'Observations', value: String(summary.totalObservations ?? '\u2013') },
                { label: 'P\u00E9riode', value: summary.quartersRange ?? '\u2013' },
            );
        } else {
            for (const [k, v] of Object.entries(summary)) {
                cards.push({ label: k, value: String(v) });
            }
        }

        const cols = 3;
        const cardW = (A_C_W - (cols - 1) * 12) / cols;
        const cardH = 62;
        const cardPad = 10;

        for (let i = 0; i < cards.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cx = A_ML + col * (cardW + 12);
            const cy = y + row * (cardH + 10);

            y = this._ensureSpace(doc, cy, cardH + 10);
            const actualY = col === 0 && i > 0 ? y : cy;

            doc.rect(cx, actualY, cardW, cardH).fillAndStroke(CLR_BG_ROW, CLR_BORDER);
            doc.rect(cx, actualY, 3, cardH).fill(cards[i].color ?? CLR_ACCENT);

            doc.fillColor(CLR_MUTED).font('Helvetica').fontSize(7.5);
            doc.text(cards[i].label, cx + cardPad, actualY + 10, { width: cardW - cardPad - 6, lineBreak: false });

            doc.fillColor(cards[i].color ?? CLR_DARK).font('Helvetica-Bold').fontSize(22);
            doc.text(cards[i].value, cx + cardPad, actualY + 24, { width: cardW - cardPad - 6, lineBreak: false });

            if (cards[i].sub) {
                doc.fillColor(CLR_MUTED).font('Helvetica').fontSize(7);
                doc.text(cards[i].sub!, cx + cardPad, actualY + 50, { lineBreak: false });
            }
        }

        const rows = Math.ceil(cards.length / cols);
        return y + rows * (cardH + 10) + 8;
    }

    // ── Regional breakdown ────────────────────────────────────────────────────────

    private _drawRegionalBreakdown(doc: any, y: number, input: AnalyticsReportInput): number {
        const rawData: any[] = Array.isArray(input.data?.data) ? input.data.data : [];

        const byRegion: Record<string, { total: number; submitted: number }> = {};
        for (const item of rawData) {
            const region = item.region ?? item.company?.region ?? 'Inconnue';
            if (!byRegion[region]) byRegion[region] = { total: 0, submitted: 0 };
            byRegion[region].total++;
            if (['SUBMITTED', 'VALIDATED', 'APPROVED'].includes(item.status)) {
                byRegion[region].submitted++;
            }
        }

        const rows = Object.entries(byRegion).sort((a, b) => b[1].total - a[1].total);
        if (rows.length === 0) {
            doc.fillColor(CLR_MUTED).font('Helvetica-Oblique').fontSize(9);
            doc.text('Aucune donn\u00E9e r\u00E9gionale disponible.', A_ML, y);
            return y + 20;
        }

        const colW = [180, 80, 80, A_C_W - 340];
        const hdrs = ['R\u00E9gion', 'Total', 'Soumis', 'Taux'];
        const rowH = 18;
        const hdrH = 20;

        let cx = A_ML;
        doc.rect(A_ML, y, A_C_W, hdrH).fill(CLR_PRIMARY);
        doc.fillColor(CLR_WHITE).font('Helvetica-Bold').fontSize(8);
        for (let i = 0; i < hdrs.length; i++) {
            doc.text(hdrs[i], cx + 4, y + 6, { width: colW[i] - 8, align: i > 0 ? 'center' : 'left', lineBreak: false });
            cx += colW[i];
        }
        y += hdrH;

        for (let r = 0; r < rows.length; r++) {
            y = this._ensureSpace(doc, y, rowH + 2);
            const [region, counts] = rows[r];
            const rate = counts.total > 0 ? Math.round((counts.submitted / counts.total) * 100) : 0;
            const shade = r % 2 === 0 ? CLR_WHITE : CLR_BG_ROW;

            doc.rect(A_ML, y, A_C_W, rowH).fill(shade);
            doc.rect(A_ML, y, A_C_W, rowH).stroke(CLR_BORDER);

            const barMaxW = colW[3] - 28;
            const barW = Math.round((rate / 100) * barMaxW);
            const barX = A_ML + colW[0] + colW[1] + colW[2] + 4;
            const barYY = y + 5;
            doc.rect(barX, barYY, barMaxW, 8).fill('#EBF5F2');
            if (barW > 0) doc.rect(barX, barYY, barW, 8).fill(rateColor(rate));

            cx = A_ML;
            const cells = [region, String(counts.total), String(counts.submitted), `${rate}%`];
            doc.fillColor(CLR_DARK).font('Helvetica').fontSize(8);
            for (let i = 0; i < cells.length; i++) {
                if (i < 3) {
                    doc.text(cells[i], cx + 4, y + 5, { width: colW[i] - 8, align: i > 0 ? 'center' : 'left', lineBreak: false });
                } else {
                    doc.fillColor(rateColor(rate)).font('Helvetica-Bold');
                    doc.text(`${rate}%`, barX + barMaxW + 4, y + 5, { lineBreak: false });
                    doc.fillColor(CLR_DARK).font('Helvetica');
                }
                cx += colW[i];
            }
            y += rowH;
        }
        return y + 10;
    }

    // ── Trends bar chart ──────────────────────────────────────────────────────────

    private _drawTrendsSection(doc: any, y: number, input: AnalyticsReportInput): number {
        const panelData: any[] = Array.isArray(input.data) ? input.data : (input.data?.data ?? []);

        const quarterTotals: Record<string, number> = {};
        for (const est of panelData) {
            for (const q of Object.keys(est.quarters ?? {})) {
                quarterTotals[q] = (quarterTotals[q] ?? 0) + 1;
            }
        }

        const quarters = Object.keys(quarterTotals).sort();
        if (quarters.length === 0) {
            doc.fillColor(CLR_MUTED).font('Helvetica-Oblique').fontSize(9);
            doc.text('Aucune donn\u00E9e de tendance disponible.', A_ML, y);
            return y + 20;
        }

        const chartH = 80;
        const barArea = A_C_W - 60;
        const barW = Math.min(40, Math.floor(barArea / quarters.length) - 6);
        const maxVal = Math.max(...Object.values(quarterTotals));

        doc.fillColor(CLR_MUTED).font('Helvetica').fontSize(7.5);
        doc.text('Soumissions approuv\u00E9es par trimestre', A_ML, y);
        y += 14;

        doc.moveTo(A_ML + 40, y).lineTo(A_ML + 40 + barArea, y + chartH)
            .strokeColor(CLR_BORDER).lineWidth(0.5).stroke();
        doc.moveTo(A_ML + 40, y).lineTo(A_ML + 40, y + chartH)
            .strokeColor(CLR_BORDER).lineWidth(0.5).stroke();
        doc.strokeColor('black').lineWidth(1);

        let bx = A_ML + 44;
        for (const q of quarters) {
            const val = quarterTotals[q];
            const bH = maxVal > 0 ? Math.round((val / maxVal) * (chartH - 10)) : 0;
            const by = y + chartH - bH;

            doc.rect(bx, by, barW, bH).fill(CLR_PRIMARY_L);
            doc.rect(bx, by, barW, 2).fill(CLR_ACCENT);

            doc.fillColor(CLR_MUTED).font('Helvetica').fontSize(6);
            doc.text(q.replace('-', '\n'), bx, y + chartH + 3, { width: barW, align: 'center', lineBreak: true });

            doc.fillColor(CLR_DARK).font('Helvetica-Bold').fontSize(7);
            doc.text(String(val), bx, by - 10, { width: barW, align: 'center', lineBreak: false });

            bx += barW + 6;
        }
        return y + chartH + 28;
    }

    // ── Sector analysis ───────────────────────────────────────────────────────────

    private _drawSectorAnalysis(doc: any, y: number, input: AnalyticsReportInput): number {
        const rawData: any[] = Array.isArray(input.data?.data) ? input.data.data
            : Array.isArray(input.data) ? input.data : [];

        const bySector: Record<string, number> = {};
        for (const item of rawData) {
            const sector = item.company?.sector?.name ?? item.sector ?? 'Non classifi\u00E9';
            bySector[sector] = (bySector[sector] ?? 0) + 1;
        }

        const entries = Object.entries(bySector).sort((a, b) => b[1] - a[1]);
        const total = entries.reduce((s, [, v]) => s + v, 0);

        if (entries.length === 0) {
            doc.fillColor(CLR_MUTED).font('Helvetica-Oblique').fontSize(9);
            doc.text('Aucune donn\u00E9e sectorielle disponible.', A_ML, y);
            return y + 20;
        }

        const rowH = 20;
        const barMax = A_C_W * 0.45;

        for (const [sector, count] of entries) {
            y = this._ensureSpace(doc, y, rowH + 4);
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const barW = Math.round((pct / 100) * barMax);

            doc.fillColor(CLR_DARK).font('Helvetica').fontSize(8.5);
            doc.text(trunc(sector, 30), A_ML, y + 4, { width: 160, lineBreak: false });

            doc.rect(A_ML + 165, y + 4, barMax, 12).fill('#EBF5F2');
            if (barW > 0) doc.rect(A_ML + 165, y + 4, barW, 12).fill(CLR_ACCENT);

            doc.fillColor(CLR_MID).font('Helvetica-Bold').fontSize(8);
            doc.text(`${count}  (${pct}%)`, A_ML + 165 + barMax + 8, y + 4, { lineBreak: false });

            y += rowH;
        }
        return y + 8;
    }

    // ── Establishment panel ───────────────────────────────────────────────────────

    private _drawEstablishmentPanel(doc: any, y: number, input: AnalyticsReportInput): number {
        const panel: any[] = Array.isArray(input.data) ? input.data
            : (Array.isArray(input.data?.data) ? input.data.data : []);

        if (panel.length === 0) {
            doc.fillColor(CLR_MUTED).font('Helvetica-Oblique').fontSize(9);
            doc.text('Aucune donn\u00E9e de panel disponible.', A_ML, y);
            return y + 20;
        }

        const allQuarters = Array.from(
            new Set(panel.flatMap((e) => Object.keys(e.quarters ?? {}))),
        ).sort();
        const displayQ = allQuarters.slice(-8);

        const nameW = 160;
        const qColW = Math.min(48, Math.floor((A_C_W - nameW) / Math.max(displayQ.length, 1)));
        const rowH = 16;
        const hdrH = 22;

        doc.rect(A_ML, y, A_C_W, hdrH).fill(CLR_PRIMARY);
        doc.fillColor(CLR_WHITE).font('Helvetica-Bold').fontSize(7);
        doc.text('\u00C9tablissement', A_ML + 4, y + 7, { width: nameW - 8, lineBreak: false });
        let qx = A_ML + nameW;
        for (const q of displayQ) {
            doc.text(q, qx + 2, y + 7, { width: qColW - 4, align: 'center', lineBreak: false });
            qx += qColW;
        }
        y += hdrH;

        const displayRows = panel.slice(0, 30);
        for (let r = 0; r < displayRows.length; r++) {
            y = this._ensureSpace(doc, y, rowH + 2);
            const est = displayRows[r];
            const shade = r % 2 === 0 ? CLR_WHITE : CLR_BG_ROW;

            doc.rect(A_ML, y, A_C_W, rowH).fill(shade);
            doc.rect(A_ML, y, A_C_W, rowH).stroke(CLR_BORDER);

            doc.fillColor(CLR_DARK).font('Helvetica').fontSize(7);
            doc.text(
                trunc(est.companyName ?? est.establishmentId ?? '\u2013', 28),
                A_ML + 4, y + 4,
                { width: nameW - 8, lineBreak: false },
            );

            qx = A_ML + nameW;
            for (const q of displayQ) {
                const qData = est.quarters?.[q];
                const dot = qData?.status === 'APPROVED' ? CLR_PRIMARY
                    : qData?.status === 'SUBMITTED' ? CLR_ACCENT
                        : qData ? CLR_WARNING
                            : null;

                if (dot) {
                    const cxc = qx + qColW / 2;
                    const cyc = y + rowH / 2;
                    doc.circle(cxc, cyc, 4).fill(dot);
                    doc.fillColor(CLR_WHITE).font('Helvetica-Bold').fontSize(5);
                    doc.text('\u2713', cxc - 2.5, cyc - 3.5, { lineBreak: false });
                } else {
                    doc.fillColor(CLR_BORDER).font('Helvetica').fontSize(8);
                    doc.text('\u2013', qx + qColW / 2 - 2, y + 4, { lineBreak: false });
                }
                qx += qColW;
            }
            y += rowH;
        }

        if (panel.length > 30) {
            doc.fillColor(CLR_MUTED).font('Helvetica-Oblique').fontSize(7.5);
            doc.text(`+ ${panel.length - 30} \u00E9tablissements non affich\u00E9s`, A_ML, y + 6);
            y += 18;
        }

        y += 10;
        const legendItems = [
            { color: CLR_PRIMARY, label: 'Approuv\u00E9' },
            { color: CLR_ACCENT, label: 'Soumis' },
            { color: CLR_WARNING, label: 'En cours' },
        ];
        let lx = A_ML;
        for (const li of legendItems) {
            doc.circle(lx + 4, y + 4, 4).fill(li.color);
            doc.fillColor(CLR_MID).font('Helvetica').fontSize(7.5);
            doc.text(li.label, lx + 12, y, { lineBreak: false });
            lx += 80;
        }
        return y + 16;
    }

    // ── Demographics ──────────────────────────────────────────────────────────────

    private _drawDemographics(doc: any, y: number, input: AnalyticsReportInput): number {
        const rawData: any[] = Array.isArray(input.data?.data) ? input.data.data
            : Array.isArray(input.data) ? input.data : [];

        let men = 0;
        let women = 0;
        for (const item of rawData) {
            men += item.company?.menCount ?? item.menCount ?? 0;
            women += item.company?.womenCount ?? item.womenCount ?? 0;
        }

        const total = men + women;
        const menPct = total > 0 ? Math.round((men / total) * 100) : 0;
        const wPct = 100 - menPct;

        if (total === 0) {
            doc.fillColor(CLR_MUTED).font('Helvetica-Oblique').fontSize(9);
            doc.text('Aucune donn\u00E9e d\u00E9mographique disponible.', A_ML, y);
            return y + 20;
        }

        const barH2 = 24;
        const barW2 = A_C_W * 0.7;
        const menW = Math.round((menPct / 100) * barW2);
        const womenW = barW2 - menW;

        doc.rect(A_ML, y, menW, barH2).fill('#3B82C4');
        doc.rect(A_ML + menW, y, womenW, barH2).fill('#E95F8A');
        doc.fillColor(CLR_WHITE).font('Helvetica-Bold').fontSize(9);
        if (menW > 30) doc.text(`H ${menPct}%`, A_ML + 6, y + 7, { lineBreak: false });
        if (womenW > 30) doc.text(`F ${wPct}%`, A_ML + menW + 6, y + 7, { lineBreak: false });

        y += barH2 + 12;

        const cardW2 = (A_C_W - 12) / 2;
        const cards2 = [
            { label: 'Hommes', value: men.toLocaleString('fr-FR'), color: '#3B82C4' },
            { label: 'Femmes', value: women.toLocaleString('fr-FR'), color: '#E95F8A' },
        ];
        for (let i = 0; i < cards2.length; i++) {
            const cx2 = A_ML + i * (cardW2 + 12);
            doc.rect(cx2, y, cardW2, 44).fillAndStroke(CLR_BG_ROW, CLR_BORDER);
            doc.rect(cx2, y, 3, 44).fill(cards2[i].color);
            doc.fillColor(CLR_MUTED).font('Helvetica').fontSize(7.5);
            doc.text(cards2[i].label, cx2 + 10, y + 8, { lineBreak: false });
            doc.fillColor(cards2[i].color).font('Helvetica-Bold').fontSize(18);
            doc.text(cards2[i].value, cx2 + 10, y + 20, { lineBreak: false });
        }
        return y + 56;
    }

    // ── Insights ──────────────────────────────────────────────────────────────────

    private _drawInsights(doc: any, y: number, input: AnalyticsReportInput): number {
        const { data, type, scope } = input;
        const summary = data?.summary ?? {};
        const insights: Array<{ icon: string; text: string; level: 'info' | 'warn' | 'ok' }> = [];

        if (type === 'completionRate') {
            const rate = parseFloat(summary.completionRate ?? '0');
            if (rate >= 80) {
                insights.push({ icon: '\u2713', text: `Taux de compl\u00E9tion de ${summary.completionRate}% \u2014 objectif atteint.`, level: 'ok' });
            } else if (rate >= 50) {
                insights.push({ icon: '!', text: `Taux de compl\u00E9tion de ${summary.completionRate}% \u2014 des relances sont recommand\u00E9es pour les ${summary.notStarted ?? 0} \u00E9tablissements non d\u00E9marr\u00E9s.`, level: 'warn' });
            } else {
                insights.push({ icon: '\u2715', text: `Taux de compl\u00E9tion faible (${summary.completionRate}%) \u2014 une campagne de sensibilisation est n\u00E9cessaire.`, level: 'warn' });
            }
            if ((summary.inProgress ?? 0) > 0) {
                insights.push({ icon: 'i', text: `${summary.inProgress} d\u00E9clarations en cours \u2014 un suivi individuel peut acc\u00E9l\u00E9rer la finalisation.`, level: 'info' });
            }
        }

        if (type === 'employmentTrends') {
            insights.push({ icon: 'i', text: `Analyse couvrant ${summary.totalEstablishments ?? '\u2013'} \u00E9tablissements sur la p\u00E9riode ${summary.quartersRange ?? '\u2013'}.`, level: 'info' });
            insights.push({ icon: 'i', text: `Croiser ces donn\u00E9es avec les indicateurs sectoriels permet d\u2019identifier les besoins en formation.`, level: 'info' });
        }

        if (scope?.region) {
            insights.push({ icon: 'i', text: `Rapport limit\u00E9 \u00E0 la r\u00E9gion ${scope.region}. Pour une vue nationale, relancer sans filtre r\u00E9gional.`, level: 'info' });
        }

        if (insights.length === 0) {
            insights.push({ icon: 'i', text: 'Aucune recommandation automatique disponible pour ce type de rapport.', level: 'info' });
        }

        const colors = { ok: CLR_PRIMARY, warn: CLR_WARNING, info: CLR_ACCENT };
        const bgs = { ok: '#EBF8F4', warn: '#FEF5E7', info: '#EBF4FD' };

        for (const ins of insights) {
            const lineH = 36;
            y = this._ensureSpace(doc, y, lineH + 8);

            doc.rect(A_ML, y, A_C_W, lineH).fill(bgs[ins.level]);
            doc.rect(A_ML, y, 3, lineH).fill(colors[ins.level]);

            doc.circle(A_ML + 16, y + lineH / 2, 8).fill(colors[ins.level]);
            doc.fillColor(CLR_WHITE).font('Helvetica-Bold').fontSize(8);
            doc.text(ins.icon, A_ML + 12, y + lineH / 2 - 4, { lineBreak: false });

            doc.fillColor(CLR_DARK).font('Helvetica').fontSize(8.5);
            doc.text(ins.text, A_ML + 30, y + 8, { width: A_C_W - 38, lineBreak: true });

            y += lineH + 6;
        }
        return y + 8;
    }
}