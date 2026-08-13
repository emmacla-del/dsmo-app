// src/analytics/bilan-pdf.service.ts
//
// Renders a company's own Bilan RH (BilanRhResponse) as a downloadable PDF.
// Deliberately NOT styled like the official MINEFOP government reports in
// report-pdf.service.ts (no letterhead, coat of arms, reference number, or
// signature block) — this is the company's own working document, generated
// on demand and not persisted, so it's built fresh in-memory and streamed
// straight back in the HTTP response (see BilanController.getBilanPdf).

import { Injectable } from '@nestjs/common';
import { BilanRhResponse, CspGenderCount } from './bilan.service';

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 44;
const CONTENT_W = A4_W - MARGIN * 2;

const CLR_PRIMARY = '#0A6640'; // matches UltraTheme.primary
const CLR_DARK = '#191A1E';
const CLR_MUTED = '#6B6F76';
const CLR_BORDER = '#DEDAD1';

@Injectable()
export class BilanPdfService {
    private readonly PDFDocument = require('pdfkit');

    async generate(bilan: BilanRhResponse): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            const doc = new this.PDFDocument({
                size: 'A4',
                margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
                bufferPages: true,
                info: {
                    Title: `Bilan RH ${bilan.year} — ${bilan.companyName}`,
                    Author: bilan.companyName,
                    Creator: 'DSMO',
                },
            });

            doc.on('data', (c: Buffer) => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            let y = this.drawHeader(doc, bilan);

            y = this.drawWorkforceSnapshot(doc, y, bilan);
            y = this.drawRecruitmentTable(doc, y, bilan);
            y = this.drawDeparturesTable(doc, y, bilan);

            if (bilan.internships.total > 0) {
                y = this.ensureSpace(doc, y, 90);
                y = this.drawInternships(doc, y, bilan);
            }

            if (bilan.skillNeeds.length > 0 || bilan.trainingNeeds.length > 0) {
                y = this.ensureSpace(doc, y, 100);
                y = this.drawSkillsTraining(doc, y, bilan);
            }

            if (bilan.vulnerableWorkers.total > 0 || bilan.disabledRecruitments.total > 0) {
                y = this.ensureSpace(doc, y, 80);
                this.drawInclusion(doc, y, bilan);
            }

            this.drawFooters(doc);
            doc.end();
        });
    }

    // ── Layout helpers ────────────────────────────────────────────

    private ensureSpace(doc: any, y: number, needed: number): number {
        if (y + needed > A4_H - MARGIN) {
            doc.addPage();
            return MARGIN;
        }
        return y;
    }

    private sectionTitle(doc: any, y: number, label: string): number {
        doc.rect(MARGIN, y, 3, 16).fill(CLR_PRIMARY);
        doc.fillColor(CLR_DARK).font('Helvetica-Bold').fontSize(12);
        doc.text(label, MARGIN + 10, y + 1, { lineBreak: false });
        doc.fillColor(CLR_DARK);
        return y + 24;
    }

    // ── Header ────────────────────────────────────────────────────

    private drawHeader(doc: any, bilan: BilanRhResponse): number {
        doc.fillColor(CLR_DARK).font('Helvetica-Bold').fontSize(18);
        doc.text(bilan.companyName, MARGIN, MARGIN, { width: CONTENT_W });

        doc.fillColor(CLR_PRIMARY).font('Helvetica-Bold').fontSize(13);
        doc.text(`Bilan RH ${bilan.year}`, MARGIN, MARGIN + 26, { width: CONTENT_W });

        const generatedLine = bilan.quarterCount > 1
            ? `Données cumulées sur ${bilan.quarterCount} déclarations ONEFOP approuvées · Généré le ${this.today()}`
            : `Données issues de votre déclaration ONEFOP approuvée · Généré le ${this.today()}`;
        doc.fillColor(CLR_MUTED).font('Helvetica').fontSize(9);
        doc.text(generatedLine, MARGIN, MARGIN + 46, { width: CONTENT_W });

        const ruleY = MARGIN + 64;
        doc.moveTo(MARGIN, ruleY).lineTo(MARGIN + CONTENT_W, ruleY)
            .strokeColor(CLR_BORDER).lineWidth(1).stroke();
        doc.strokeColor('#000000');

        return ruleY + 20;
    }

    // ── Workforce snapshot (3 stat tiles) ────────────────────────

    private drawWorkforceSnapshot(doc: any, y: number, bilan: BilanRhResponse): number {
        y = this.sectionTitle(doc, y, 'Effectifs');
        const tileW = (CONTENT_W - 20) / 3;
        const tiles: Array<[string, string, string?]> = [
            ['Employés permanents', `${bilan.permanentWorkers}`],
            ['Postes vacants', `${bilan.vacancies}`, `${bilan.vacancyRate.toFixed(1)}%`],
            ['Taux de rotation', `${bilan.turnoverRate.toFixed(1)}%`],
        ];
        tiles.forEach(([label, value, badge], i) => {
            const x = MARGIN + i * (tileW + 10);
            doc.roundedRect(x, y, tileW, 56, 4).strokeColor(CLR_BORDER).lineWidth(1).stroke();
            doc.fillColor(CLR_MUTED).font('Helvetica').fontSize(8);
            doc.text(label, x + 10, y + 10, { width: tileW - 20 });
            doc.fillColor(CLR_DARK).font('Helvetica-Bold').fontSize(18);
            doc.text(value, x + 10, y + 24, { width: tileW - 20 });
            if (badge) {
                doc.fillColor(CLR_MUTED).font('Helvetica').fontSize(8);
                doc.text(badge, x + 10, y + 44, { width: tileW - 20 });
            }
        });
        doc.strokeColor('#000000').fillColor(CLR_DARK);
        return y + 56 + 24;
    }

    // ── Simple CSP × gender table (recruitments) ─────────────────

    private drawRecruitmentTable(doc: any, y: number, bilan: BilanRhResponse): number {
        y = this.ensureSpace(doc, y, 140);
        y = this.sectionTitle(doc, y, 'Recrutements par catégorie');
        const rows: Array<[string, CspGenderCount]> = [
            ['Cadres', bilan.recruitments.combined.executives],
            ['Agents de maîtrise', bilan.recruitments.combined.foremen],
            ['Ouvriers / employés', bilan.recruitments.combined.workers],
        ];
        return this.drawGenderTable(doc, y, rows, bilan.recruitments.combined.total);
    }

    private drawDeparturesTable(doc: any, y: number, bilan: BilanRhResponse): number {
        y = this.ensureSpace(doc, y, 140);
        y = this.sectionTitle(doc, y, 'Départs');
        const allRows: Array<[string, CspGenderCount]> = [
            ['Licenciements', bilan.departures.dismissals],
            ['Démissions', bilan.departures.resignations],
            ['Retraites', bilan.departures.retirements],
            ['Autres', bilan.departures.others],
        ];
        const rows = allRows.filter(([, v]) => v.total > 0);
        if (rows.length === 0) {
            doc.fillColor(CLR_MUTED).font('Helvetica').fontSize(9);
            doc.text('Aucun départ enregistré.', MARGIN, y);
            doc.fillColor(CLR_DARK);
            return y + 20;
        }
        return this.drawGenderTable(doc, y, rows, bilan.departures.total);
    }

    /** Label | Homme | Femme | Total — with a bold grand-total row. */
    private drawGenderTable(
        doc: any,
        y: number,
        rows: Array<[string, CspGenderCount]>,
        total: CspGenderCount,
    ): number {
        const labelW = CONTENT_W - 3 * 70;
        const colX = [MARGIN, MARGIN + labelW, MARGIN + labelW + 70, MARGIN + labelW + 140];

        doc.fillColor(CLR_MUTED).font('Helvetica-Bold').fontSize(8);
        doc.text('', colX[0], y);
        doc.text('Hommes', colX[1], y, { width: 70, align: 'center' });
        doc.text('Femmes', colX[2], y, { width: 70, align: 'center' });
        doc.text('Total', colX[3], y, { width: 70, align: 'center' });
        y += 14;
        doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).strokeColor(CLR_BORDER).stroke();
        y += 6;

        doc.font('Helvetica').fontSize(9);
        for (const [label, counts] of rows) {
            doc.fillColor(CLR_DARK);
            doc.text(label, colX[0], y, { width: labelW - 10 });
            doc.text(`${counts.male}`, colX[1], y, { width: 70, align: 'center' });
            doc.text(`${counts.female}`, colX[2], y, { width: 70, align: 'center' });
            doc.text(`${counts.total}`, colX[3], y, { width: 70, align: 'center' });
            y += 16;
        }

        doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).strokeColor(CLR_BORDER).stroke();
        y += 6;
        doc.font('Helvetica-Bold').fontSize(9).fillColor(CLR_DARK);
        doc.text('Total', colX[0], y, { width: labelW - 10 });
        doc.text(`${total.male}`, colX[1], y, { width: 70, align: 'center' });
        doc.text(`${total.female}`, colX[2], y, { width: 70, align: 'center' });
        doc.fillColor(CLR_PRIMARY);
        doc.text(`${total.total}`, colX[3], y, { width: 70, align: 'center' });

        doc.strokeColor('#000000').fillColor(CLR_DARK).font('Helvetica');
        return y + 26;
    }

    private drawInternships(doc: any, y: number, bilan: BilanRhResponse): number {
        y = this.sectionTitle(doc, y, 'Stagiaires');
        const allRows: Array<[string, number]> = [
            ['Vacances', bilan.internships.holiday],
            ['Académiques', bilan.internships.academic],
            ['Professionnels', bilan.internships.professional],
            ['Pré-emploi', bilan.internships.preWork],
        ];
        const rows = allRows.filter(([, v]) => v > 0);

        doc.font('Helvetica').fontSize(9);
        for (const [label, count] of rows) {
            doc.fillColor(CLR_DARK).text(`${label} : ${count}`, MARGIN, y);
            y += 15;
        }
        doc.font('Helvetica-Bold').text(`Total : ${bilan.internships.total}`, MARGIN, y);
        doc.font('Helvetica');
        return y + 24;
    }

    private drawSkillsTraining(doc: any, y: number, bilan: BilanRhResponse): number {
        y = this.sectionTitle(doc, y, 'Besoins en compétences et formation');
        doc.font('Helvetica').fontSize(9);
        if (bilan.skillNeeds.length > 0) {
            doc.fillColor(CLR_MUTED).font('Helvetica-Bold').fontSize(8);
            doc.text('COMPÉTENCES', MARGIN, y);
            y += 13;
            doc.font('Helvetica').fontSize(9).fillColor(CLR_DARK);
            for (const s of bilan.skillNeeds) {
                y = this.ensureSpace(doc, y, 16);
                doc.text(`•  ${s.description}  (${s.totalCount})`, MARGIN, y, { width: CONTENT_W });
                y += 15;
            }
            y += 6;
        }
        if (bilan.trainingNeeds.length > 0) {
            y = this.ensureSpace(doc, y, 30);
            doc.fillColor(CLR_MUTED).font('Helvetica-Bold').fontSize(8);
            doc.text('FORMATIONS', MARGIN, y);
            y += 13;
            doc.font('Helvetica').fontSize(9).fillColor(CLR_DARK);
            for (const t of bilan.trainingNeeds) {
                y = this.ensureSpace(doc, y, 16);
                doc.text(`•  ${t.domain}  (${t.totalCount})`, MARGIN, y, { width: CONTENT_W });
                y += 15;
            }
        }
        return y + 10;
    }

    private drawInclusion(doc: any, y: number, bilan: BilanRhResponse): number {
        y = this.sectionTitle(doc, y, 'Impact social');
        doc.font('Helvetica').fontSize(9).fillColor(CLR_DARK);
        if (bilan.vulnerableWorkers.total > 0) {
            doc.text(
                `${bilan.vulnerableWorkers.total} travailleur(s) issu(s) de catégories vulnérables recruté(s) ` +
                `(${bilan.vulnerableWorkers.internalDisplaced.total} déplacés internes, ` +
                `${bilan.vulnerableWorkers.refugees.total} réfugiés, ` +
                `${bilan.vulnerableWorkers.orphans.total} orphelins).`,
                MARGIN, y, { width: CONTENT_W },
            );
            y += 30;
        }
        if (bilan.disabledRecruitments.total > 0) {
            doc.text(
                `${bilan.disabledRecruitments.total} personne(s) en situation de handicap recrutée(s).`,
                MARGIN, y, { width: CONTENT_W },
            );
            y += 20;
        }
        return y;
    }

    private drawFooters(doc: any): void {
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(range.start + i);
            doc.fillColor(CLR_MUTED).font('Helvetica').fontSize(7);
            doc.text(
                `Document généré automatiquement · Usage interne · Page ${i + 1} / ${range.count}`,
                MARGIN, A4_H - MARGIN + 12,
                { width: CONTENT_W, align: 'center' },
            );
        }
    }

    private today(): string {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
}
