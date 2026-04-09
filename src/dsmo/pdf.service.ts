import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
  salary?: number;
}

interface MovementBreakdown {
  cat1_3: number;
  cat4_6: number;
  cat7_9: number;
  cat10_12: number;
  catNonDeclared: number;
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
  fax?: string;
  taxNumber: string;
  cnpsNumber?: string;
  socialCapital?: number;
  totalEmployees: number;
  menCount?: number;
  womenCount?: number;
  lastYearMenCount?: number;
  lastYearWomenCount?: number;
  lastYearTotal?: number;
  recruitments?: MovementBreakdown;
  promotions?: MovementBreakdown;
  dismissals?: MovementBreakdown;
  retirements?: MovementBreakdown;
  deaths?: MovementBreakdown;
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
  language?: 'fr' | 'en';
}

// ── i18n ──────────────────────────────────────────────────────────────────────

const LABELS = {
  fr: {
    republic: 'REPUBLIQUE DU CAMEROUN',
    motto: 'Paix - Travail - Patrie',
    ministry: "MINISTERE DE L'EMPLOI ET DE LA FORMATION PROFESSIONNELLE",
    direction: "Direction de l'Emploi",
    service: "Service des Statistiques de l'Emploi et de la Main-d'Oeuvre",
    formTitle: "DECLARATION SUR LA SITUATION DE LA MAIN D'OEUVRE",
    partATitle: "PARTIE A: INFORMATIONS CONCERNANT L'ETABLISSEMENT OU L'ENTREPRISE",
    budgetYear: 'Annee Budgetaire',
    fillingDate: 'Date de remplissage',
    companyName: 'Raison sociale',
    parentCompany: "Raison sociale de l'entreprise dont depend l'Ets",
    mainActivity: 'Activite principale',
    secondaryActivity: 'Activite secondaire',
    region: 'Region',
    department: 'Departement',
    district: 'Arrondissement',
    address: 'Adresse',
    fax: 'Fax',
    taxNumber: 'No Contribuable',
    socialCapital: 'Capital social',
    cnps: "No d'affiliation a la CNPS",
    currentEmployeesLabel: "Nombres d'employes au 31 Decembre de l'annee en cours :",
    lastYearEmployeesLabel: "Nombre d'employes au 31 Decembre de l'annee dernier :",
    men: 'Hommes',
    women: 'Femmes',
    total: 'Total',
    movementsLabel: "Mouvement des employes dans l'Etablissement durant l'annee",
    categoriesTitle: 'Categories socioprofessionnelles',
    catCols: ['Aucune', '1 a 3', '4 a 6', '7 a 9', '10 a 12', 'Non Declare', 'TOTAL'],
    movements: [
      { key: 'recruitments', label: 'Recrutement' },
      { key: 'promotions', label: 'Avancement' },
      { key: 'dismissals', label: 'Licenciement' },
      { key: 'retirements', label: 'Retraite' },
      { key: 'deaths', label: 'Decede' },
    ],
    qualTitle: "Informations supplementaires concernant l'Etablissement ou l'entreprise",
    qualResponse: 'Reponse',
    yes: 'Oui',
    no: 'Non',
    q1: "Votre entreprise dispose-t-elle d'un centre de formation pour son personnel ?",
    q2: "Votre entreprise procedera-t-elle a des recrutements l'annee prochaine ?",
    q3: "Votre entreprise dispose-t-elle d'un plan de camerounisation des postes ?",
    q4: "Votre entreprise fait-elle recours aux entreprises de travail temporaires ?",
    q4detail: "Si oui, preciser lesquelles ainsi que le nombre de travailleurs mis a votre disposition par l'entreprise.",
    partBTitle: 'PARTIE B : INFORMATIONS CONCERNANT LES EMPLOYES',
    partBCols: [
      { label: 'No', width: 25 },
      { label: 'Noms et Prenoms', width: 148 },
      { label: 'Sexe', width: 32 },
      { label: 'Age', width: 32 },
      { label: 'Nationalite', width: 72 },
      { label: 'Diplome', width: 68 },
      { label: 'Fonction', width: 92 },
      { label: 'Anciennete', width: 52 },
      { label: 'Categorie', width: 52 },
      { label: 'Salaire', width: 80 },
    ],
    senioritySuffix: 'ans',
    trackingLabel: 'Numero de suivi',
    dateLabel: 'Date',
    signatureLabel: "Signature et cachet de l'employeur",
    authorityLabel: "A remplir par l'autorite competente",
    visaLabel: 'Visa',
    legalNote:
      'NB : Ces informations sont strictement confidentielles pour les besoins de statistique conformement ' +
      'a la loi No 91/023 du 16 decembre 1991 relative aux recensements.\n\n' +
      "La fiche dument remplie doit etre expediee avant le 31 Janvier de l'annee suivante sous pli " +
      'recommande en trois exemplaires dates et signes au chef de la circonscription en charge des ' +
      "questions d'emploi et de la main d'oeuvre du ressort duquel se trouve situe l'etablissement.",
    watermarks: { 1: 'ORIGINAL - EMPLOYEUR', 2: 'DUPLICATA - AUTORITE', 3: 'TRIPLICATA - ARCHIVES' } as Record<1 | 2 | 3, string>,
    fcfa: 'FCFA',
  },

  en: {
    republic: 'REPUBLIC OF CAMEROON',
    motto: 'Peace - Work - Fatherland',
    ministry: 'MINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING',
    direction: 'Employment Directorate',
    service: 'Employment and Labour Statistics Service',
    formTitle: 'DECLARATION ON THE LABOUR SITUATION',
    partATitle: 'PART A: INFORMATION ON THE ESTABLISHMENT OR ENTERPRISE',
    budgetYear: 'Budget Year',
    fillingDate: 'Date of Completion',
    companyName: 'Business Name',
    parentCompany: 'Name of parent enterprise',
    mainActivity: 'Main Activity',
    secondaryActivity: 'Secondary Activity',
    region: 'Region',
    department: 'Division',
    district: 'Sub-Division',
    address: 'Address',
    fax: 'Fax',
    taxNumber: 'Taxpayer Number',
    socialCapital: 'Share Capital',
    cnps: 'CNPS Affiliation Number',
    currentEmployeesLabel: 'Number of employees as at 31 December of the current year:',
    lastYearEmployeesLabel: 'Number of employees as at 31 December of the previous year:',
    men: 'Men',
    women: 'Women',
    total: 'Total',
    movementsLabel: 'Staff movements in the Establishment during the year',
    categoriesTitle: 'Socio-professional Categories',
    catCols: ['None', '1 to 3', '4 to 6', '7 to 9', '10 to 12', 'Not Declared', 'TOTAL'],
    movements: [
      { key: 'recruitments', label: 'Recruitment' },
      { key: 'promotions', label: 'Promotion' },
      { key: 'dismissals', label: 'Dismissal' },
      { key: 'retirements', label: 'Retirement' },
      { key: 'deaths', label: 'Death' },
    ],
    qualTitle: 'Additional information on the Establishment or Enterprise',
    qualResponse: 'Response',
    yes: 'Yes',
    no: 'No',
    q1: 'Does your enterprise have a training centre for its staff?',
    q2: 'Will your enterprise carry out recruitments next year?',
    q3: 'Does your enterprise have a Cameroonisation plan for its positions?',
    q4: 'Does your enterprise use temporary employment agencies?',
    q4detail: 'If yes, please specify which ones and the number of workers made available to you.',
    partBTitle: 'PART B: INFORMATION ON EMPLOYEES',
    partBCols: [
      { label: 'No', width: 25 },
      { label: 'Full Name', width: 148 },
      { label: 'Gender', width: 32 },
      { label: 'Age', width: 32 },
      { label: 'Nationality', width: 72 },
      { label: 'Diploma', width: 68 },
      { label: 'Position', width: 92 },
      { label: 'Seniority', width: 52 },
      { label: 'Category', width: 52 },
      { label: 'Salary', width: 80 },
    ],
    senioritySuffix: 'yrs',
    trackingLabel: 'Tracking Number',
    dateLabel: 'Date',
    signatureLabel: "Employer's signature and stamp",
    authorityLabel: 'To be completed by the competent authority',
    visaLabel: 'Visa',
    legalNote:
      'NB: This information is strictly confidential for statistical purposes in accordance with Law ' +
      'No. 91/023 of 16 December 1991 on censuses.\n\n' +
      'The duly completed form must be sent before 31 January of the following year by registered mail ' +
      'in three dated and signed copies to the head of the local office responsible for employment and ' +
      'labour matters in the area where the establishment is located.',
    watermarks: { 1: 'ORIGINAL - EMPLOYER', 2: 'DUPLICATE - AUTHORITY', 3: 'TRIPLICATE - ARCHIVES' } as Record<1 | 2 | 3, string>,
    fcfa: 'FCFA',
  },
};

type Lang = typeof LABELS.fr;

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const ML = 28;
const MR = 28;
const MT = 34;
const MB = 34;
const CONTENT_W = PAGE_W - ML - MR;
const PAGE_BOT = PAGE_H - MB;

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyBreakdown(): MovementBreakdown {
  return { cat1_3: 0, cat4_6: 0, cat7_9: 0, cat10_12: 0, catNonDeclared: 0 };
}

function rowTotal(b: MovementBreakdown): number {
  return b.cat1_3 + b.cat4_6 + b.cat7_9 + b.cat10_12 + b.catNonDeclared;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PdfService {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  private readonly PDFDocument = require('pdfkit');
  private readonly supabase: SupabaseClient;
  private readonly bucketName = 'dsmo-pdfs';
  private readonly signedUrlExpirySeconds = 7 * 24 * 60 * 60; // 7 days

  // Coat of arms loaded once at startup via Supabase Storage
  private coatOfArmsBuffer: Buffer | null = null;

  constructor() {
    // ✅ Supabase client — reads from environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load coat of arms from Supabase Storage at startup
    this.loadCoatOfArms();
  }

  // ── Load coat of arms from Supabase Storage ────────────────────────────────

  private async loadCoatOfArms(): Promise<void> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download('assets/coat_of_arms.png');

      if (error || !data) {
        console.log('Coat of arms not found, using placeholder');
        return;
      }
      this.coatOfArmsBuffer = Buffer.from(await data.arrayBuffer());
      console.log('Coat of arms loaded successfully from Supabase');
    } catch (error) {
      console.log('Could not load coat of arms from Supabase, using placeholder');
      // Non-fatal — coat of arms will be replaced with placeholder
    }
  }

  // ── Generate PDFs and upload to Supabase Storage (Private Bucket) ──────────

  async generateDeclarationPdfs(data: PdfData): Promise<{ urls: string[]; hashes: string[] }> {
    const urls: string[] = [];
    const hashes: string[] = [];

    for (let copy = 1 as 1 | 2 | 3; copy <= 3; copy++) {
      const storagePath = this.getStoragePath(data.trackingNumber, data.year, copy);
      const buffer = await this.buildPdf(data, copy);

      // Check file size (5MB limit from bucket)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (buffer.length > maxSize) {
        throw new Error(`PDF copy ${copy} exceeds ${maxSize / 1024 / 1024}MB limit`);
      }

      // ✅ Upload to Supabase Storage (private bucket)
      const { error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(storagePath, buffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Failed to upload PDF copy ${copy} to Supabase: ${uploadError.message}`);
      }

      // ✅ Generate signed URL (expires after expiry period)
      const { data: signedUrlData, error: signedUrlError } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(storagePath, this.signedUrlExpirySeconds);

      if (signedUrlError || !signedUrlData) {
        throw new Error(`Failed to generate signed URL for copy ${copy}: ${signedUrlError?.message}`);
      }

      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      hashes.push(`sha256:${hash}`);
      urls.push(signedUrlData.signedUrl);
    }

    return { urls, hashes };
  }

  // ── Get signed URL for an existing PDF (for later access) ─────────────────

  async getSignedUrl(trackingNumber: string, year: number, copy: number, expiresInSeconds?: number): Promise<string> {
    const storagePath = this.getStoragePath(trackingNumber, year, copy);
    const expiry = expiresInSeconds || this.signedUrlExpirySeconds;

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(storagePath, expiry);

    if (error || !data) {
      throw new Error(`Failed to generate signed URL: ${error?.message}`);
    }

    return data.signedUrl;
  }

  // ── Check if PDF exists in storage ─────────────────────────────────────────

  async pdfExists(trackingNumber: string, year: number, copy: number): Promise<boolean> {
    const storagePath = this.getStoragePath(trackingNumber, year, copy);

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .list(storagePath.split('/').slice(0, -1).join('/'), {
        search: storagePath.split('/').pop(),
        limit: 1,
      });

    if (error) return false;
    return data && data.length > 0;
  }

  // ── Delete PDF from storage ────────────────────────────────────────────────

  async deletePdf(trackingNumber: string, year: number, copy: number): Promise<void> {
    const storagePath = this.getStoragePath(trackingNumber, year, copy);

    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove([storagePath]);

    if (error) {
      throw new Error(`Failed to delete PDF: ${error.message}`);
    }
  }

  // ── Get public URL (deprecated - use getSignedUrl for private buckets) ─────
  // Note: This only works if bucket is public. For private buckets, use getSignedUrl.

  getPublicUrl(trackingNumber: string, year: number, copy: number): string {
    const storagePath = this.getStoragePath(trackingNumber, year, copy);
    const { data } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(storagePath);
    return data.publicUrl;
  }

  // ── Storage path helper ────────────────────────────────────────────────────

  private getStoragePath(trackingNumber: string, year: number, copy: number): string {
    return `declarations/${year}/${trackingNumber}-copy${copy}.pdf`;
  }

  // ── Backward compatibility for existing code ───────────────────────────────

  getFilePath(trackingNumber: string, year: number, copy: number): string {
    // Returns a signed URL for backward compatibility
    // Note: This returns a Promise, so existing sync calls will need to be updated
    return this.getSignedUrl(trackingNumber, year, copy) as unknown as string;
  }

  // ── PDF builder (unchanged from original) ─────────────────────────────────

  private buildPdf(data: PdfData, copy: 1 | 2 | 3): Promise<Buffer> {
    const lang: Lang = data.language === 'en' ? LABELS.en : LABELS.fr;
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new this.PDFDocument({
        size: 'A4', layout: 'landscape',
        margins: { top: MT, bottom: MB, left: ML, right: MR },
        autoFirstPage: true, bufferPages: true,
        info: {
          Title: `DSMO ${data.year} - ${data.trackingNumber}`,
          Author: 'MINEFOP Cameroun',
          Subject: lang.formTitle,
        },
      });
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.drawWatermark(doc, copy, lang);
      const headerBottom = this.drawBilingualHeader(doc, MT, lang);
      this.drawPartA(doc, data, headerBottom + 5, lang);

      doc.addPage();
      this.drawWatermark(doc, copy, lang);
      this.drawPartB(doc, data, copy, lang);

      doc.end();
    });
  }

  // ── Watermark ──────────────────────────────────────────────────────────────

  private drawWatermark(doc: any, copy: 1 | 2 | 3, lang: Lang): void {
    doc.save();
    doc.translate(PAGE_W / 2, PAGE_H / 2).rotate(-45)
      .font('Helvetica-Bold').fontSize(46)
      .fillColor('#CCCCCC').fillOpacity(0.18)
      .text(lang.watermarks[copy], -210, -20, { width: 420, align: 'center', lineBreak: false });
    doc.restore();
    doc.fillColor('black').fillOpacity(1);
  }

  // ── Bilingual header ───────────────────────────────────────────────────────

  private drawBilingualHeader(doc: any, y: number, lang: Lang): number {
    const x = ML;
    const w = CONTENT_W;
    const cw = w / 3;

    const fr = LABELS.fr;
    const en = LABELS.en;

    doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
    doc.text(fr.republic, x, y, { width: cw, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(8);
    doc.text(fr.motto, x, y + 12, { width: cw, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(6.8);
    doc.text(`${fr.ministry}\n${fr.direction}\n${fr.service}`, x, y + 24, { width: cw, align: 'center' });

    const coatX = x + cw;
    const imgSize = 62;
    const imgLeft = coatX + (cw - imgSize) / 2;

    if (this.coatOfArmsBuffer) {
      doc.image(this.coatOfArmsBuffer, imgLeft, y, { width: imgSize, height: imgSize });
    } else {
      const cx = coatX + cw / 2;
      const cy = y + 32;
      doc.circle(cx, cy, 28).stroke();
      doc.circle(cx, cy, 22).stroke();
      doc.font('Helvetica').fontSize(18).fillColor('#AAAAAA');
      doc.text('*', cx - 7, cy - 12, { lineBreak: false });
      doc.fillColor('black').font('Helvetica').fontSize(5.5);
      doc.text('COAT OF ARMS', cx - 20, cy + 16, { lineBreak: false });
    }

    const enX = x + cw * 2;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
    doc.text(en.republic, enX, y, { width: cw, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(8);
    doc.text(en.motto, enX, y + 12, { width: cw, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(6.8);
    doc.text(`${en.ministry}\n${en.direction}\n${en.service}`, enX, y + 24, { width: cw, align: 'center' });

    const divY = y + 70;
    doc.moveTo(x, divY).lineTo(x + w, divY).stroke();

    const titleY = divY + 4;
    doc.font('Helvetica-Bold').fontSize(12).fillColor('black');
    doc.text(lang.formTitle, x, titleY, { width: w, align: 'center', lineBreak: false });

    return titleY + 17;
  }

  // ── Part A ─────────────────────────────────────────────────────────────────

  private drawPartA(doc: any, data: PdfData, startY: number, lang: Lang): void {
    const x = ML;
    const w = CONTENT_W;
    let y = startY;
    const rH = 15;

    doc.rect(x, y, w, rH + 2).fillAndStroke('#E8E8E8', 'black');
    doc.fillColor('black').font('Helvetica-Bold').fontSize(8.5);
    doc.text(lang.partATitle, x + 2, y + 4, { width: w - 4, align: 'center' });
    y += rH + 2;

    doc.font('Helvetica').fontSize(7.8);
    const h2 = w * 0.5;

    const row2 = (l: string, r: string) => {
      doc.rect(x, y, h2, rH).stroke();
      doc.text(l, x + 3, y + 4, { width: h2 - 6 });
      doc.rect(x + h2, y, h2, rH).stroke();
      doc.text(r, x + h2 + 3, y + 4, { width: h2 - 6 });
      y += rH;
    };

    const row1 = (t: string, shade = false) => {
      if (shade) { doc.rect(x, y, w, rH).fillAndStroke('#F2F2F2', 'black'); doc.fillColor('black'); }
      else doc.rect(x, y, w, rH).stroke();
      doc.text(t, x + 3, y + 4, { width: w - 6 });
      y += rH;
    };

    const row3 = (a: string, b: string, c: string) => {
      const cw = w / 3;
      [a, b, c].forEach((t, i) => {
        doc.rect(x + i * cw, y, cw, rH).stroke();
        doc.text(t, x + i * cw + 3, y + 4, { width: cw - 6 });
      });
      y += rH;
    };

    row2(`${lang.budgetYear} : ${data.year}`, `${lang.fillingDate} : ${data.fillingDate ?? ''}`);
    row2(`${lang.companyName} : ${data.company.name}`, `${lang.parentCompany} : ${data.company.parentCompany ?? ''}`);
    row2(`${lang.mainActivity} : ${data.company.mainActivity}`, `${lang.secondaryActivity} : ${data.company.secondaryActivity ?? ''}`);
    row3(`${lang.region} : ${data.company.region}`, `${lang.department} : ${data.company.department}`, `${lang.district} : ${data.company.district}`);

    const aW = w * 0.50, fW = w * 0.14, nW = w - aW - fW;
    doc.rect(x, y, aW, rH).stroke();
    doc.text(`${lang.address} : ${data.company.address}`, x + 3, y + 4, { width: aW - 6 });
    doc.rect(x + aW, y, fW, rH).stroke();
    doc.text(`${lang.fax} : ${data.company.fax ?? ''}`, x + aW + 3, y + 4, { width: fW - 6 });
    doc.rect(x + aW + fW, y, nW, rH).stroke();
    doc.text(`${lang.taxNumber} : ${data.company.taxNumber}`, x + aW + fW + 3, y + 4, { width: nW - 6 });
    y += rH;

    row2(
      `${lang.socialCapital} : ${data.company.socialCapital != null ? data.company.socialCapital.toLocaleString('fr-FR') + ' ' + lang.fcfa : ''}`,
      `${lang.cnps} : ${data.company.cnpsNumber ?? ''}`,
    );

    row1(lang.currentEmployeesLabel, true);
    row3(`${lang.men} : ${data.company.menCount ?? ''}`, `${lang.women} : ${data.company.womenCount ?? ''}`, `${lang.total} : ${data.company.totalEmployees}`);
    row1(lang.lastYearEmployeesLabel, true);
    row3(`${lang.men} : ${data.company.lastYearMenCount ?? ''}`, `${lang.women} : ${data.company.lastYearWomenCount ?? ''}`, `${lang.total} : ${data.company.lastYearTotal ?? ''}`);
    row1(lang.movementsLabel, true);

    const remainH = PAGE_BOT - y - 2;
    this.drawBottomBlock(doc, data, x, y, w, remainH, lang);
  }

  // ── Bottom block ───────────────────────────────────────────────────────────

  private drawBottomBlock(
    doc: any, data: PdfData,
    x: number, y: number, w: number, height: number,
    lang: Lang,
  ): void {
    const leftW = w * 0.62;
    const rightW = w - leftW;
    const qual = data.qualitative;

    doc.rect(x, y, w, height).stroke();
    doc.moveTo(x + leftW, y).lineTo(x + leftW, y + height).stroke();

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('black');
    doc.text(lang.categoriesTitle, x + 3, y + 4, { width: leftW - 6, align: 'center' });

    const gridHeaderH = 18;
    const gridHeaderY = y + 18;
    const rowLblW = leftW * 0.17;
    const dataColW = (leftW - rowLblW) / lang.catCols.length;

    doc.rect(x, gridHeaderY, rowLblW, gridHeaderH).stroke();

    doc.font('Helvetica-Bold').fontSize(6.2).fillColor('black');
    for (let i = 0; i < lang.catCols.length; i++) {
      const cx = x + rowLblW + i * dataColW;
      doc.rect(cx, gridHeaderY, dataColW, gridHeaderH).stroke();
      doc.text(lang.catCols[i], cx + 1, gridHeaderY + 3, { width: dataColW - 2, align: 'center' });
    }

    const dataStartY = gridHeaderY + gridHeaderH;
    const numRows = lang.movements.length + 1;
    const dataH = height - (dataStartY - y);
    const dataRowH = dataH / numRows;
    const colTotals = new Array(lang.catCols.length).fill(0);

    for (let r = 0; r < lang.movements.length; r++) {
      const { key, label } = lang.movements[r];
      const mv = (data.company[key as keyof Company] as MovementBreakdown | undefined) ?? emptyBreakdown();
      const ry = dataStartY + r * dataRowH;

      doc.rect(x, ry, rowLblW, dataRowH).stroke();
      doc.font('Helvetica').fontSize(7).fillColor('black');
      doc.text(label, x + 2, ry + dataRowH / 2 - 4, { width: rowLblW - 4 });
      doc.rect(x + rowLblW, ry, dataColW, dataRowH).stroke();

      const vals = [mv.cat1_3, mv.cat4_6, mv.cat7_9, mv.cat10_12, mv.catNonDeclared];
      for (let c = 0; c < vals.length; c++) {
        const cx = x + rowLblW + (c + 1) * dataColW;
        doc.rect(cx, ry, dataColW, dataRowH).stroke();
        doc.font('Helvetica').fontSize(7);
        doc.text(String(vals[c]), cx + 1, ry + dataRowH / 2 - 4, { width: dataColW - 2, align: 'center' });
        colTotals[c + 1] += vals[c];
      }

      const tot = rowTotal(mv);
      const totCx = x + rowLblW + 6 * dataColW;
      doc.rect(totCx, ry, dataColW, dataRowH).stroke();
      doc.font('Helvetica-Bold').fontSize(7);
      doc.text(String(tot), totCx + 1, ry + dataRowH / 2 - 4, { width: dataColW - 2, align: 'center' });
      colTotals[6] += tot;
    }

    const totRowY = dataStartY + lang.movements.length * dataRowH;
    doc.rect(x, totRowY, rowLblW, dataRowH).fillAndStroke('#E8E8E8', 'black');
    doc.fillColor('black').font('Helvetica-Bold').fontSize(7);
    doc.text('TOTAL', x + 2, totRowY + dataRowH / 2 - 4, { width: rowLblW - 4, align: 'center' });
    doc.rect(x + rowLblW, totRowY, dataColW, dataRowH).fillAndStroke('#E8E8E8', 'black');
    doc.fillColor('black');

    for (let c = 1; c <= 5; c++) {
      const cx = x + rowLblW + c * dataColW;
      doc.rect(cx, totRowY, dataColW, dataRowH).fillAndStroke('#E8E8E8', 'black');
      doc.fillColor('black').font('Helvetica-Bold').fontSize(7);
      doc.text(String(colTotals[c]), cx + 1, totRowY + dataRowH / 2 - 4, { width: dataColW - 2, align: 'center' });
    }

    const gtCx = x + rowLblW + 6 * dataColW;
    doc.rect(gtCx, totRowY, dataColW, dataRowH).fillAndStroke('#E8E8E8', 'black');
    doc.fillColor('black').font('Helvetica-Bold').fontSize(7);
    doc.text(String(colTotals[6]), gtCx + 1, totRowY + dataRowH / 2 - 4, { width: dataColW - 2, align: 'center' });

    // RIGHT: qualitative questions
    const rx = x + leftW;

    doc.font('Helvetica-Bold').fontSize(7.2).fillColor('black');
    doc.text(lang.qualTitle, rx + 3, y + 4, { width: rightW - 6 });

    const hdrY = y + 26;
    const hdrH = 13;
    const qTextW = rightW * 0.66;
    const ynW = (rightW - qTextW) / 2;

    doc.rect(rx, hdrY, qTextW, hdrH).stroke();
    doc.font('Helvetica-Bold').fontSize(6.5);
    doc.text(lang.qualResponse ?? 'Reponse', rx + 3, hdrY + 3, { width: qTextW - 6 });
    doc.rect(rx + qTextW, hdrY, ynW, hdrH).stroke();
    doc.text(lang.yes, rx + qTextW + 2, hdrY + 3, { width: ynW - 4, align: 'center' });
    doc.rect(rx + qTextW + ynW, hdrY, ynW, hdrH).stroke();
    doc.text(lang.no, rx + qTextW + ynW + 2, hdrY + 3, { width: ynW - 4, align: 'center' });

    let ly = hdrY + hdrH;
    const qRowH = (height - (hdrY - y) - hdrH) / 5;

    const drawQ = (label: string, answer: boolean | undefined) => {
      doc.rect(rx, ly, qTextW, qRowH).stroke();
      doc.font('Helvetica').fontSize(6.2).fillColor('black');
      doc.text(label, rx + 3, ly + 3, { width: qTextW - 6 });
      doc.rect(rx + qTextW, ly, ynW, qRowH).stroke();
      if (answer === true) {
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text('X', rx + qTextW + 2, ly + qRowH / 2 - 5, { width: ynW - 4, align: 'center' });
      }
      doc.rect(rx + qTextW + ynW, ly, ynW, qRowH).stroke();
      if (answer === false) {
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text('X', rx + qTextW + ynW + 2, ly + qRowH / 2 - 5, { width: ynW - 4, align: 'center' });
      }
      ly += qRowH;
    };

    drawQ(lang.q1, qual?.hasTrainingCenter);
    drawQ(lang.q2, qual?.recruitmentPlansNext);
    drawQ(lang.q3, qual?.camerounisationPlan);
    drawQ(lang.q4, qual?.usesTempAgencies);

    const lastH = height - (ly - y);
    doc.rect(rx, ly, rightW, lastH).stroke();
    doc.font('Helvetica').fontSize(6.2).fillColor('black');
    doc.text(`${lang.q4detail}\n${qual?.tempAgencyDetails ?? ''}`, rx + 3, ly + 3, { width: rightW - 6 });
  }

  // ── Part B: employee table ─────────────────────────────────────────────────

  private drawPartB(doc: any, data: PdfData, copy: 1 | 2 | 3, lang: Lang): void {
    const x = ML;
    const w = CONTENT_W;
    const employees = data.employees;
    const cols = lang.partBCols;
    const tableW = cols.reduce((s, c) => s + c.width, 0);
    const startX = x + (w - tableW) / 2;

    const headerH = 18;
    const rowH = 18;

    let currentEmpIdx = 0;
    let pageNum = 0;

    while (currentEmpIdx < employees.length || pageNum === 0) {
      if (pageNum > 0) {
        doc.addPage();
        this.drawWatermark(doc, copy, lang);
      }

      let y = MT;

      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('black');
      const titleSuffix = lang.republic.startsWith('REPUBLIC OF') ? ' (Continued)' : ' (Suite)';
      const titleText = pageNum === 0 ? lang.partBTitle : `${lang.partBTitle}${titleSuffix}`;
      doc.text(titleText, x, y, { width: w, align: 'center' });
      y += 24;

      let cx = startX;
      doc.font('Helvetica-Bold').fontSize(7.2);
      for (const col of cols) {
        doc.rect(cx, y, col.width, headerH).fillAndStroke('#E8E8E8', 'black');
        doc.fillColor('black').text(col.label, cx + 2, y + 4, { width: col.width - 4, align: 'center' });
        cx += col.width;
      }
      y += headerH;

      const rowsThisPage = pageNum === 0 ? 10 : 25;
      doc.font('Helvetica').fontSize(7.5).fillColor('black');

      for (let i = 0; i < rowsThisPage; i++) {
        const emp = employees[currentEmpIdx];
        cx = startX;

        const cells = emp ? [
          String(currentEmpIdx + 1),
          emp.fullName ?? '',
          emp.gender ?? '',
          emp.age != null ? String(emp.age) : '',
          emp.nationality ?? '',
          emp.diploma ?? '',
          emp.function ?? '',
          emp.seniority != null ? `${emp.seniority} ${lang.senioritySuffix}` : '',
          emp.salaryCategory ?? '',
          emp.salary != null ? emp.salary.toLocaleString('fr-FR') : '',
        ] : [String(currentEmpIdx + 1), '', '', '', '', '', '', '', '', ''];

        for (let j = 0; j < cols.length; j++) {
          doc.rect(cx, y, cols[j].width, rowH).stroke();
          const numericLabels = ['No', 'Age', 'Seniority', 'Anciennete', 'Salaire', 'Salary', 'Sexe', 'Gender', 'Categorie', 'Category'];
          const align = numericLabels.includes(cols[j].label) ? 'center' : 'left';
          doc.text(cells[j], cx + 2, y + 5, { width: cols[j].width - 4, lineBreak: false, align });
          cx += cols[j].width;
        }

        y += rowH;
        currentEmpIdx++;

        if (currentEmpIdx >= employees.length && (pageNum > 0 || i >= 9)) break;
      }

      const isLastPage = currentEmpIdx >= employees.length;
      if (isLastPage) {
        y += 10;
        this.drawLegalFooter(doc, data, copy, y, startX, tableW, lang);
      }

      pageNum++;
    }
  }

  // ── Legal footer ───────────────────────────────────────────────────────────

  private drawLegalFooter(
    doc: any, data: PdfData, copy: 1 | 2 | 3,
    y: number, startX: number, tableW: number, lang: Lang,
  ): void {
    if (y + 110 > PAGE_BOT) {
      doc.addPage();
      this.drawWatermark(doc, copy, lang);
      y = 50;
    }

    doc.font('Helvetica').fontSize(8).fillColor('black');
    doc.text(`${lang.trackingLabel} : ${data.trackingNumber}`, startX, y);
    y += 13;
    doc.text(`${lang.dateLabel} : ___________________`, startX, y);
    doc.text(`${lang.signatureLabel} : ____________________`, startX + 290, y);
    y += 46;

    doc.font('Helvetica-Bold').fontSize(8);
    doc.text(`${lang.authorityLabel} :`, startX, y);
    y += 13;
    doc.font('Helvetica').fontSize(8);
    doc.text(`${lang.visaLabel} : __________________________________________`, startX, y);
    y += 26;

    const noteH = 62;
    doc.rect(startX, y, tableW, noteH).stroke();
    doc.font('Helvetica-Oblique').fontSize(6.3);
    doc.text(lang.legalNote, startX + 5, y + 5, { width: tableW - 10 });
  }

  // ── Legacy stubs ───────────────────────────────────────────────────────────

  async generateDeclarationPdf(_c: any, _e: any[], _y: number): Promise<Buffer> { return Buffer.from(''); }
  async generateReceipt(_id: string, _name: string, _year: number): Promise<Buffer> { return Buffer.from(''); }
}