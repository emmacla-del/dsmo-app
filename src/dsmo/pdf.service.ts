import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Employee {
  fullName: string;
  gender: string;
  age: number;
  nationality: string;
  diploma?: string;
  function: string;
  seniority: number;
  salaryCategory?: string;
}

interface Company {
  name: string;
  parentCompany?: string;
  mainActivity: string;
  secondaryActivity?: string;
  region: string;
  department: string;
  district: string;
  address: string;
  taxNumber: string;
  cnpsNumber?: string;
  socialCapital?: number;
  totalEmployees: number;
  menCount?: number;
  womenCount?: number;
  recruitments?: number;
  promotions?: number;
  dismissals?: number;
  retirements?: number;
  deaths?: number;
}

interface Qualitative {
  hasTrainingCenter?: boolean;
  recruitmentPlansNext?: boolean;
  camerounisationPlan?: boolean;
  usesTempAgencies?: boolean;
  tempAgencyDetails?: string;
}

export interface PdfData {
  trackingNumber: string;
  year: number;
  fillingDate?: string;
  company: Company;
  qualitative?: Qualitative;
  employees: Employee[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const ML = 50;   // margin left
const MR = 50;   // margin right
const MT = 40;   // margin top (header starts here)
const MB = 50;   // margin bottom

const CONTENT_W = PAGE_W - ML - MR;
const PAGE_BOTTOM = PAGE_H - MB;

const WATERMARKS: Record<1 | 2 | 3, string> = {
  1: 'ORIGINAL - EMPLOYEUR',
  2: 'DUPLICATA - AUTORITÉ',
  3: 'TRIPLICATA - ARCHIVES',
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PdfService {
  private readonly storageBase: string;

  constructor() {
    this.storageBase = path.join(process.cwd(), 'storage', 'dsmo');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async generateDeclarationPdfs(data: PdfData): Promise<{ urls: string[]; hashes: string[] }> {
    const yearDir = path.join(this.storageBase, String(data.year));
    fs.mkdirSync(yearDir, { recursive: true });

    const urls: string[] = [];
    const hashes: string[] = [];

    for (let copy = 1 as 1 | 2 | 3; copy <= 3; copy++) {
      const filename = `${data.trackingNumber}-copy${copy}.pdf`;
      const filePath = path.join(yearDir, filename);
      const buffer = await this.buildPdf(data, copy);
      fs.writeFileSync(filePath, buffer);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      hashes.push(`sha256:${hash}`);
      urls.push(`/storage/dsmo/${data.year}/${filename}`);
    }

    return { urls, hashes };
  }

  getFilePath(trackingNumber: string, year: number, copy: number): string {
    return path.join(this.storageBase, String(year), `${trackingNumber}-copy${copy}.pdf`);
  }

  // ── PDF Builder ────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  private readonly PDFDocument = require('pdfkit');

  private buildPdf(data: PdfData, copy: 1 | 2 | 3): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new this.PDFDocument({
        size: 'A4',
        margins: { top: MT, bottom: MB, left: ML, right: MR },
        autoFirstPage: true,
        bufferPages: true,
        info: {
          Title: `DSMO ${data.year} - ${data.trackingNumber}`,
          Author: 'Système DSMO - MINEFOP Cameroun',
          Subject: 'Déclaration sur la situation de la main-d\'œuvre',
        },
      });

      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Page 1: Header + Part A ──────────────────────────────────
      this.drawWatermark(doc, copy);
      const headerBottom = this.drawHeader(doc, MT);
      this.drawPartA(doc, data, headerBottom + 8);

      // ── Page 2+: Part B ──────────────────────────────────────────
      doc.addPage();
      this.drawWatermark(doc, copy);
      this.drawPartBTitle(doc, data.trackingNumber, data.year);
      this.drawEmployeeTable(doc, data.employees, copy);

      doc.end();
    });
  }

  // ── Watermark ─────────────────────────────────────────────────────────────

  private drawWatermark(doc: any, copy: 1 | 2 | 3): void {
    const text = WATERMARKS[copy];
    doc.save();
    doc
      .translate(PAGE_W / 2, PAGE_H / 2)
      .rotate(-45)
      .font('Helvetica-Bold')
      .fontSize(52)
      .fillColor('#CCCCCC')
      .fillOpacity(0.22)
      .text(text, -200, -26, { width: 400, align: 'center', lineBreak: false });
    doc.restore();
    doc.fillColor('black').fillOpacity(1);
  }

  // ── Header ────────────────────────────────────────────────────────────────

  /** Draws the bilingual Republic header + DSMO title. Returns bottom y. */
  private drawHeader(doc: any, y: number): number {
    const x = ML;
    const w = CONTENT_W;
    const mid = x + w / 2;
    const BOX_H = 100;

    // Outer border
    doc.rect(x, y, w, BOX_H).lineWidth(1).stroke();
    // Centre divider
    doc.moveTo(mid, y).lineTo(mid, y + BOX_H).lineWidth(0.5).stroke();

    // ── French (left) ──────────────────────────────────────────────
    const lw = w / 2 - 4;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
    doc.text('REPUBLIQUE DU CAMEROUN', x + 2, y + 7, { width: lw, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(8);
    doc.text('Paix - Travail - Patrie', x + 2, y + 19, { width: lw, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(6.5);
    doc.text(
      'MINISTERE DE L\'EMPLOI ET DE\nLA FORMATION PROFESSIONNELLE\nDirection de l\'Emploi\nService des Statistiques de l\'Emploi\net de la Main-d\'Œuvre',
      x + 2, y + 36, { width: lw, align: 'center' },
    );

    // ── English (right) ────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('REPUBLIC OF CAMEROON', mid + 2, y + 7, { width: lw, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(8);
    doc.text('Peace - Work - Fatherland', mid + 2, y + 19, { width: lw, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(6.5);
    doc.text(
      'MINISTRY OF EMPLOYMENT AND\nVOCATIONAL TRAINING\nEmployment Department\nEmployment Statistics and\nWorkforce Division',
      mid + 2, y + 36, { width: lw, align: 'center' },
    );

    // ── Title ──────────────────────────────────────────────────────
    const titleY = y + BOX_H + 6;
    doc.font('Helvetica-Bold').fontSize(13).fillColor('black');
    doc.text(
      'DÉCLARATION SUR LA SITUATION DE LA MAIN D\'ŒUVRE',
      x, titleY, { width: w, align: 'center', lineBreak: false },
    );

    // Underline title
    const ulW = 430;
    const ulX = x + (w - ulW) / 2;
    doc.moveTo(ulX, titleY + 17).lineTo(ulX + ulW, titleY + 17).lineWidth(0.7).stroke().lineWidth(1);

    return titleY + 22;
  }

  // ── Part A ────────────────────────────────────────────────────────────────

  private drawPartA(doc: any, data: PdfData, startY: number): void {
    const x = ML;
    const w = CONTENT_W;
    let y = startY;

    const sectionBar = (title: string) => {
      doc.rect(x, y, w, 16).fill('#E5E5E5').stroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
      doc.text(title, x + 5, y + 4, { width: w - 10, lineBreak: false });
      y += 16;
    };

    const hr = (lineWidth = 0.3) => {
      doc.moveTo(x, y).lineTo(x + w, y).lineWidth(lineWidth).stroke().lineWidth(1);
    };

    const row = (label: string, value: string, labelW = 170) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
      doc.text(label, x + 5, y + 3, { width: labelW, lineBreak: false });
      doc.font('Helvetica');
      doc.text(value || '-', x + 5 + labelW, y + 3, { width: w - labelW - 10, lineBreak: false });
      y += 15;
      hr();
    };

    // ── Section: Identité ───────────────────────────────────────────
    sectionBar('PARTIE A : INFORMATIONS CONCERNANT L\'ÉTABLISSEMENT');

    // Year / Date
    doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
    doc.text('Année Budgétaire :', x + 5, y + 3, { width: 115, lineBreak: false });
    doc.font('Helvetica').text(`${data.year}`, x + 120, y + 3, { width: 100, lineBreak: false });
    doc.font('Helvetica-Bold').text('Date de remplissage :', x + 265, y + 3, { width: 130, lineBreak: false });
    doc.font('Helvetica').text(data.fillingDate || '-', x + 395, y + 3, { width: 95, lineBreak: false });
    y += 15;
    hr();

    row('Raison sociale (Entreprise) :', data.company.parentCompany || data.company.name);
    row('Raison sociale (Établissement) :', data.company.name);
    row('Activité principale :', data.company.mainActivity);
    row('Activité secondaire :', data.company.secondaryActivity || '-');

    // Region / Department (same line)
    doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
    doc.text('Région :', x + 5, y + 3, { width: 46, lineBreak: false });
    doc.font('Helvetica').text(data.company.region, x + 51, y + 3, { width: 130, lineBreak: false });
    doc.font('Helvetica-Bold').text('Département :', x + 235, y + 3, { width: 80, lineBreak: false });
    doc.font('Helvetica').text(data.company.department, x + 315, y + 3, { width: 170, lineBreak: false });
    y += 15; hr();

    row('Arrondissement / Sous-division :', data.company.district, 190);
    row('Adresse :', data.company.address, 55);

    // NIU / CNPS (same line)
    doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
    doc.text('N° Contribuable (NIU) :', x + 5, y + 3, { width: 130, lineBreak: false });
    doc.font('Helvetica').text(data.company.taxNumber, x + 135, y + 3, { width: 115, lineBreak: false });
    doc.font('Helvetica-Bold').text('N° Affiliation CNPS :', x + 270, y + 3, { width: 115, lineBreak: false });
    doc.font('Helvetica').text(data.company.cnpsNumber || '-', x + 385, y + 3, { width: 100, lineBreak: false });
    y += 15; hr();

    // Capital
    doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
    doc.text('Capital social :', x + 5, y + 3, { width: 88, lineBreak: false });
    doc.font('Helvetica');
    const cap = data.company.socialCapital
      ? `${data.company.socialCapital.toLocaleString('fr-FR')} FCFA`
      : '-';
    doc.text(cap, x + 93, y + 3, { width: w - 98, lineBreak: false });
    y += 15;
    doc.moveTo(x, y).lineTo(x + w, y).lineWidth(1).stroke().lineWidth(1);

    // ── Section: Effectifs ──────────────────────────────────────────
    sectionBar('Effectifs au 31 décembre de l\'année considérée (N)');

    doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
    const efFields: [string, string, number][] = [
      ['Hommes :', String(data.company.menCount ?? 0), 0],
      ['Femmes :', String(data.company.womenCount ?? 0), 155],
      ['Total :', String(data.company.totalEmployees), 305],
    ];
    for (const [label, val, ox] of efFields) {
      doc.font('Helvetica-Bold').text(label, x + 8 + ox, y + 3, { width: 58, lineBreak: false });
      doc.font('Helvetica').text(val, x + 66 + ox, y + 3, { width: 80, lineBreak: false });
    }
    y += 15;
    doc.moveTo(x, y).lineTo(x + w, y).lineWidth(0.5).stroke().lineWidth(1);

    // ── Section: Mouvements ─────────────────────────────────────────
    sectionBar('Mouvement des employés dans l\'année');

    const mvs: [string, string][] = [
      ['Recrutements :', String(data.company.recruitments ?? 0)],
      ['Avancements :', String(data.company.promotions ?? 0)],
      ['Licenciements :', String(data.company.dismissals ?? 0)],
      ['Retraites :', String(data.company.retirements ?? 0)],
      ['Décès :', String(data.company.deaths ?? 0)],
    ];
    let mx = x + 6;
    for (const [label, val] of mvs) {
      doc.font('Helvetica-Bold').fontSize(9).text(label, mx, y + 3, { width: 76, lineBreak: false });
      doc.font('Helvetica').text(val, mx + 76, y + 3, { width: 22, lineBreak: false });
      mx += 98;
    }
    y += 15;
    doc.moveTo(x, y).lineTo(x + w, y).lineWidth(0.5).stroke().lineWidth(1);

    // ── Section: Catégories ─────────────────────────────────────────
    sectionBar('Répartition par catégories socioprofessionnelles');

    const cats = this.calcCategoryDistribution(data.employees);
    const catItems: [string, string][] = [
      ['Aucune :', String(cats.none)],
      ['Cat. 1-3 :', String(cats.cat1_3)],
      ['Cat. 4-6 :', String(cats.cat4_6)],
      ['Cat. 7-9 :', String(cats.cat7_9)],
      ['Cat. 10-12 :', String(cats.cat10_12)],
      ['Non décl. :', String(cats.nonDeclared)],
      ['TOTAL :', String(data.employees.length)],
    ];
    let cx = x + 4;
    for (const [label, val] of catItems) {
      doc.font('Helvetica-Bold').fontSize(8.5).text(label, cx, y + 3, { width: 54, lineBreak: false });
      doc.font('Helvetica').text(val, cx + 54, y + 3, { width: 14, lineBreak: false });
      cx += 70;
    }
    y += 15;
    doc.moveTo(x, y).lineTo(x + w, y).lineWidth(0.5).stroke().lineWidth(1);

    // ── Section: Questions qualitatives ────────────────────────────
    sectionBar('Questions qualitatives');

    const qual = data.qualitative;
    const yn = (v?: boolean) => v ? 'OUI' : 'NON';
    const qItems: [string, string][] = [
      ['Votre établissement dispose-t-il d\'un centre de formation ?', yn(qual?.hasTrainingCenter)],
      ['Prévoyez-vous des recrutements l\'année prochaine ?', yn(qual?.recruitmentPlansNext)],
      ['Disposez-vous d\'un plan de camerounisation des postes ?', yn(qual?.camerounisationPlan)],
      ['Avez-vous recours aux entreprises de travail temporaire ?', yn(qual?.usesTempAgencies)],
    ];
    for (const [question, answer] of qItems) {
      doc.font('Helvetica').fontSize(9).fillColor('black');
      doc.text(`• ${question}`, x + 8, y + 3, { width: 380, lineBreak: false });
      doc.font('Helvetica-Bold').text(`${answer}`, x + 390, y + 3, { width: 90, lineBreak: false });
      doc.font('Helvetica');
      y += 14;
    }
    if (qual?.usesTempAgencies && qual.tempAgencyDetails) {
      doc.font('Helvetica').fontSize(8.5);
      doc.text(`  Détails : ${qual.tempAgencyDetails}`, x + 20, y + 2, { width: w - 30, lineBreak: false });
      y += 13;
    }
    y += 2;

    // Outer border for entire Part A block
    doc.rect(x, startY, w, y - startY).lineWidth(1).stroke();
  }

  // ── Part B ────────────────────────────────────────────────────────────────

  private drawPartBTitle(doc: any, trackingNumber: string, year: number): void {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('black');
    doc.text(
      'PARTIE B : INFORMATIONS CONCERNANT LES EMPLOYÉS',
      ML, 46, { width: CONTENT_W, align: 'center', lineBreak: false },
    );
    doc.font('Helvetica').fontSize(8);
    doc.text(`Réf : ${trackingNumber}   —   Année ${year}`, ML, 62, { width: CONTENT_W, align: 'right', lineBreak: false });
    doc.moveTo(ML, 72).lineTo(ML + CONTENT_W, 72).lineWidth(1).stroke();
  }

  private drawEmployeeTable(doc: any, employees: Employee[], copy: 1 | 2 | 3): void {
    const TL = 28;                     // table left
    const TR = PAGE_W - 28;           // table right
    const TW = TR - TL;               // ≈ 539.28

    // Columns (widths must sum to TW)
    const cols = [
      { h: 'N°',            w: 22,  align: 'center' as const },
      { h: 'Noms et Prénoms', w: 148, align: 'left'   as const },
      { h: 'Sexe',          w: 28,  align: 'center' as const },
      { h: 'Âge',           w: 26,  align: 'center' as const },
      { h: 'Nationalité',   w: 72,  align: 'center' as const },
      { h: 'Diplôme',       w: 62,  align: 'center' as const },
      { h: 'Fonction',      w: 80,  align: 'left'   as const },
      { h: 'Ancien.',       w: 48,  align: 'center' as const },
      { h: 'Catég.',        w: 53,  align: 'center' as const },
    ];
    // Total: 22+148+28+26+72+62+80+48+53 = 539 ✓

    const HEADER_H = 28;
    const ROW_H = 15;

    const drawHeader = (yPos: number): number => {
      doc.rect(TL, yPos, TW, HEADER_H).fill('#D4E8FF').stroke();
      doc.fillColor('black');
      let cx = TL;
      for (const col of cols) {
        doc.font('Helvetica-Bold').fontSize(7.5);
        doc.text(col.h, cx + 2, yPos + 4, { width: col.w - 4, align: 'center', lineBreak: false });
        // Sub-line for "Ancienneté" label
        if (col !== cols[cols.length - 1]) {
          doc.moveTo(cx + col.w, yPos).lineTo(cx + col.w, yPos + HEADER_H).lineWidth(0.5).stroke().lineWidth(1);
        }
        cx += col.w;
      }
      doc.rect(TL, yPos, TW, HEADER_H).lineWidth(1).stroke();
      return yPos + HEADER_H;
    };

    let y = drawHeader(78);

    for (let i = 0; i < employees.length; i++) {
      // New page check
      if (y + ROW_H > PAGE_BOTTOM - 110) {
        doc.addPage();
        this.drawWatermark(doc, copy);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
        doc.text('PARTIE B (suite) : INFORMATIONS CONCERNANT LES EMPLOYÉS', TL, 46, {
          width: TW, align: 'center', lineBreak: false,
        });
        y = drawHeader(60);
      }

      const emp = employees[i];
      const bg = i % 2 === 0 ? 'white' : '#F6F6F6';
      doc.rect(TL, y, TW, ROW_H).fill(bg).stroke();
      doc.fillColor('black');

      const cells = [
        String(i + 1),
        (emp.fullName || '').substring(0, 30),
        emp.gender || '',
        String(emp.age ?? ''),
        (emp.nationality || '').substring(0, 14),
        (emp.diploma || '').substring(0, 12),
        (emp.function || '').substring(0, 17),
        String(emp.seniority ?? ''),
        emp.salaryCategory || '',
      ];

      let cx = TL;
      for (let j = 0; j < cols.length; j++) {
        const col = cols[j];
        doc.font('Helvetica').fontSize(7);
        doc.text(cells[j], cx + 2, y + 4, {
          width: col.w - 4,
          align: col.align,
          lineBreak: false,
        });
        if (j < cols.length - 1) {
          doc.moveTo(cx + col.w, y).lineTo(cx + col.w, y + ROW_H).lineWidth(0.5).stroke().lineWidth(1);
        }
        cx += col.w;
      }
      y += ROW_H;
    }

    // NB note
    y += 10;
    if (y + 130 > PAGE_BOTTOM) {
      doc.addPage();
      this.drawWatermark(doc, copy);
      y = 60;
    }

    doc.font('Helvetica-Oblique').fontSize(8).fillColor('black');
    doc.text(
      'NB : Cette liste doit être exhaustive. Ajouter des feuilles supplémentaires si nécessaire.',
      TL, y, { width: TW },
    );
    y += 22;

    this.drawLegalFooter(doc, y, copy);
  }

  // ── Legal Footer ──────────────────────────────────────────────────────────

  private drawLegalFooter(doc: any, y: number, copy: 1 | 2 | 3): void {
    const x = ML;
    const xRight = ML + CONTENT_W;
    const w = CONTENT_W;

    if (y + 125 > PAGE_BOTTOM) {
      doc.addPage();
      this.drawWatermark(doc, copy);
      y = 60;
    }

    // Signature block
    doc.font('Helvetica').fontSize(9).fillColor('black');
    doc.text('Date : ___________________', x + 5, y + 6, { lineBreak: false });
    doc.text('Signature et cachet de l\'employeur :', x + 205, y + 6, { lineBreak: false });
    y += 52;

    // Dashed separator
    doc.moveTo(x, y).lineTo(xRight, y).dash(3, { space: 3 }).lineWidth(0.5).stroke().undash().lineWidth(1);
    y += 12;

    // Authority block
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('À remplir par l\'autorité compétente :', x + 5, y + 4, { lineBreak: false });
    y += 16;
    doc.font('Helvetica').fontSize(9);
    doc.text('Visa : __________________________________________', x + 5, y + 4, { lineBreak: false });
    y += 28;

    // Legal notice box
    const NOTICE_H = 72;
    doc.rect(x, y, w, NOTICE_H).lineWidth(1).stroke();
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('black');
    doc.text(
      'NB : Ces informations sont strictement confidentielles pour les besoins de statistique conformément à la ' +
      'loi No 91/023 du 16 décembre 1991 relative aux recensements.\n\n' +
      'La fiche dûment remplie doit être expédiée avant le 31 Janvier de l\'année suivante sous pli recommandé ' +
      'en trois exemplaires datés et signés au chef de la circonscription en charge des questions d\'emploi et de la main d\'œuvre.',
      x + 7, y + 7, { width: w - 14 },
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private calcCategoryDistribution(employees: Employee[]) {
    let none = 0, cat1_3 = 0, cat4_6 = 0, cat7_9 = 0, cat10_12 = 0, nonDeclared = 0;
    for (const emp of employees) {
      const cat = (emp.salaryCategory || '').trim();
      if (!cat || cat.toLowerCase() === 'aucune') none++;
      else if (['1', '2', '3'].includes(cat)) cat1_3++;
      else if (['4', '5', '6'].includes(cat)) cat4_6++;
      else if (['7', '8', '9'].includes(cat)) cat7_9++;
      else if (['10', '11', '12'].includes(cat)) cat10_12++;
      else nonDeclared++;
    }
    return { none, cat1_3, cat4_6, cat7_9, cat10_12, nonDeclared };
  }

  // ── Legacy stubs (kept for interface compatibility) ───────────────────────

  async generateDeclarationPdf(company: any, employees: any[], year: number): Promise<Buffer> {
    return Buffer.from('');
  }

  async generateReceipt(declarationId: string, companyName: string, year: number): Promise<Buffer> {
    return Buffer.from('');
  }
}
