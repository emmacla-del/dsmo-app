import { normalizeFlatKeys } from '../common/normalizers/flat-key-normalizer';
import {
  mapEnterpriseData,
  mapCooperativeData,
  mapCtdData,
  mapOngData,
  mapAdministrationData,
  mapProjectProgramData,
  mapVocationalTrainingData,
} from './pdf-data-mapper.service';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { OnefopSchemaLoaderService } from '../onefop-schema-validation/onefop-schema-loader.service';

describe('PDF Flow end-to-end data and template test', () => {
  beforeAll(() => {
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('neq', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('or', (a: any, b: any) => a || b);
    Handlebars.registerHelper('and', (a: any, b: any) => a && b);
    Handlebars.registerHelper('add', (a: any, b: any) => (a ?? 0) + (b ?? 0));
    Handlebars.registerHelper('inc', (index: any) => (typeof index === 'number' ? index + 1 : index));
    Handlebars.registerHelper('includes', (arr: any, value: any) => Array.isArray(arr) && arr.includes(value));
    Handlebars.registerHelper('t', (key: any) => key);
    Handlebars.registerHelper('yesno', (value: any) => {
      const isYes = value === true;
      const isNo = value === false;
      return new Handlebars.SafeString(
        `<span class="yesno"><span class="circle${isYes ? ' checked' : ''}"></span>Oui</span>`
      );
    });
    Handlebars.registerHelper('checkbox', (checked: any) => {
      return new Handlebars.SafeString(`<span class="checkbox${checked ? ' checked' : ''}"></span>`);
    });
    Handlebars.registerHelper('formatCell', (value: any) => {
      if (value === null || value === undefined || value === 0) return '';
      return `<span style="color:#1F3864;font-weight:bold">${value}</span>`;
    });
    Handlebars.registerHelper('phoneBoxes', (value: any, length: any) => {
      const n = typeof length === 'number' ? length : 9;
      let digits = (value === null || value === undefined ? '' : String(value)).replace(/\D/g, '');
      if (digits.length === n + 3 && digits.startsWith('237')) {
        digits = digits.slice(3);
      } else if (digits.length === n + 5 && digits.startsWith('00237')) {
        digits = digits.slice(5);
      }
      let html = `<span class="ph-box" data-val="${digits}">`;
      for (let i = 0; i < n; i++) {
        html += `<span class="pd">${digits.charAt(i) || ''}</span>`;
      }
      html += '</span>';
      return new Handlebars.SafeString(html);
    });
    Handlebars.registerHelper('digitBoxes', (value: any, length: any) => {
      const digits = (value === null || value === undefined ? '' : String(value)).replace(/\D/g, '');
      const n = typeof length === 'number' ? length : 0;
      let html = '<span class="digit-boxes">';
      for (let i = 0; i < n; i++) {
        html += `<span class="box">${digits.charAt(i) || ''}</span>`;
      }
      html += '</span>';
      return new Handlebars.SafeString(html);
    });

    // Register partials
    const partialsDir = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'partials');
    if (fs.existsSync(partialsDir)) {
      const files = fs.readdirSync(partialsDir);
      for (const file of files) {
        if (file.endsWith('.hbs')) {
          const name = path.basename(file, '.hbs');
          const content = fs.readFileSync(path.join(partialsDir, file), 'utf-8');
          Handlebars.registerPartial(name, content);
        }
      }
    }
  });

  it('checks CTD data flow and template rendering', () => {
    const rawData = {
      S0Q01: 'Maire Paul',
      S0Q02: 'Maire',
      S0Q03_TEL1: '677112233',
      CTD_S1Q01: 'Commune/ Council',
      CTD_S1Q01_NAME: 'Commune de Yaoundé 1',
      CTD_S1Q02: 'Commune d’Arrondissement',
      CTD_S1Q03: '1987',
      CTD_S1Q04: 'Urbain/ Urban',
      CTD_S1Q05_REGION: 'Centre',
      CTD_S1Q05_DEPT: 'Mfoundi',
      CTD_S1Q05_SUBDIV: 'Yaoundé 1',
      CTD_S1Q05_LOCALITY: 'Nlongkak',
      CTD_S1Q06_TEL1: '222111333',
      CTD_S1Q06_BP: '100',
      CTD_S1Q07: 'Tertiaire',
      CTD_S1Q08: 'Administration publique',
      CTD_S1Q09: '120',
      CTD_S1Q10: '10',
      // S3 & S4 text inputs
      S3Q02_REASON_1_TEXT: 'Fin de contrat',
      s3q02_reason_1_male: 5,
      S4Q02_DOMAIN_1_TEXT: 'Gestion de projet',
      s4q02_skill_1_male: 3,
      S4Q03_DOMAIN_1_TEXT: 'Informatique',
      s4q03_domain_1_male: 4,
    };

    const normalized = normalizeFlatKeys(rawData, 'ctd');
    const mapped = mapCtdData(normalized, '2026-T1');

    expect(mapped.ctdName).toBe('Commune de Yaoundé 1');
    expect(mapped.respondentName).toBe('Maire Paul');
    expect(mapped.dismissalReasons[0].text).toBe('Fin de contrat');
    expect(mapped.skills[0].description).toBe('Gestion de projet');
    expect(mapped.trainingNeeds[0].domain).toBe('Informatique');

    // Compile and render ctd.hbs template
    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'ctd.hbs');
    const template = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'));
    const html = template(mapped);

    expect(html).toContain('Commune de Yaoundé 1');
    expect(html).toContain('Fin de contrat');
    expect(html).toContain('Gestion de projet');
    expect(html).toContain('Informatique');
    expect(html).toContain('<span class="pd">6</span><span class="pd">7</span><span class="pd">7</span>');
    expect(html).not.toContain('<<br />');
    expect(html).not.toContain('<<td');
    expect(html).not.toContain('<<span');
  });

  it('checks Enterprise data flow and template rendering', () => {
    const rawData = {
      S0Q01: 'Jean Dupont',
      S0Q02: 'Directeur',
      S0Q03_TEL1: '+237 671234567',
      S1Q01: 'SARL',
      S1Q02: 'Acme Corp',
      S1Q05_TEL1: '699887766',
      S3Q02_REASON_1_TEXT: 'Restructuration économique',
      S4Q02_DOMAIN_1_TEXT: 'Comptabilité approfondie',
      S4Q03_DOMAIN_1_TEXT: 'Marketing digital',
    };

    const normalized = normalizeFlatKeys(rawData, 'enterprise');
    const mapped = mapEnterpriseData(normalized, '2026-T1');

    expect(mapped.companyName).toBe('Acme Corp');
    expect(mapped.dismissalReasons[0].text).toBe('Restructuration économique');
    expect(mapped.skills[0].description).toBe('Comptabilité approfondie');
    expect(mapped.trainingNeeds[0].domain).toBe('Marketing digital');

    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'enterprise.hbs');
    const template = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'));
    const html = template(mapped);

    expect(html).toContain('Acme Corp');
    expect(html).toContain('Restructuration économique');
    expect(html).toContain('Comptabilité approfondie');
    expect(html).toContain('Marketing digital');
    // Verify phone digit boxes were filled directly on server
    expect(html).toContain('<span class="pd">6</span><span class="pd">7</span><span class="pd">1</span>');
  });

  it('checks Cooperative data flow and template rendering', () => {
    const rawData = {
      S0Q01: 'President Jean',
      COOP_S1Q01: 'COOPAGRO',
      COOP_S1Q06_TEL1: '677112233',
      S3Q02_REASON_1_TEXT: 'Départ volontaire',
      S4Q02_DOMAIN_1_TEXT: 'Agronomie',
      S4Q03_DOMAIN_1_TEXT: 'Gestion coopérative',
    };

    const normalized = normalizeFlatKeys(rawData, 'cooperative');
    const mapped = mapCooperativeData(normalized, '2026-T1');

    expect(mapped.cooperativeName).toBe('COOPAGRO');
    expect(mapped.dismissalReasons[0].text).toBe('Départ volontaire');
    expect(mapped.skills[0].description).toBe('Agronomie');
    expect(mapped.trainingNeeds[0].domain).toBe('Gestion coopérative');

    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'cooperative.hbs');
    const template = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'));
    const html = template(mapped);

    expect(html).toContain('COOPAGRO');
    expect(html).toContain('Départ volontaire');
    expect(html).toContain('Agronomie');
    expect(html).toContain('Gestion coopérative');
    expect(html).not.toContain('<<br />');
  });

  it('checks ONG data flow and template rendering', () => {
    const rawData = {
      S0Q01: 'Directrice Marie',
      ONG_S1Q01: 'ONG Espoir',
      ONG_S1Q06_TEL1: '699445566',
      S3Q02_REASON_1_TEXT: 'Fin de financement projet',
      S4Q02_DOMAIN_1_TEXT: 'Action humanitaire',
      S4Q03_DOMAIN_1_TEXT: 'Suivi-évaluation',
    };

    const normalized = normalizeFlatKeys(rawData, 'ong');
    const mapped = mapOngData(normalized, '2026-T1');

    expect(mapped.ongName).toBe('ONG Espoir');
    expect(mapped.dismissalReasons[0].text).toBe('Fin de financement projet');
    expect(mapped.skills[0].description).toBe('Action humanitaire');
    expect(mapped.trainingNeeds[0].domain).toBe('Suivi-évaluation');

    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'ong.hbs');
    const template = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'));
    const html = template(mapped);

    expect(html).toContain('ONG Espoir');
    expect(html).toContain('Fin de financement projet');
    expect(html).toContain('Action humanitaire');
    expect(html).toContain('Suivi-évaluation');
    expect(html).not.toContain('<<br />');
    expect(html).not.toContain('<<td');
    expect(html).not.toContain('<<span');
  });

  it('checks Administration data flow and template rendering', () => {
    const rawData = {
      S0Q01: 'Secrétaire Général',
      ADMIN_S1Q01: 'MINEFOP',
      ADMIN_S1Q05_TEL1: '222230000',
      S3Q02_REASON_1_TEXT: 'Mutation de service',
      S4Q02_DOMAIN_1_TEXT: 'Management public',
    };

    const normalized = normalizeFlatKeys(rawData, 'administration');
    const mapped = mapAdministrationData(normalized, '2026-T1');

    expect(mapped.administrationName).toBe('MINEFOP');
    expect(mapped.dismissalReasons[0].text).toBe('Mutation de service');
    expect(mapped.skills[0].description).toBe('Management public');

    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'administration.hbs');
    const template = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'));
    const html = template(mapped);

    expect(html).toContain('MINEFOP');
    expect(html).toContain('Mutation de service');
    expect(html).toContain('Management public');
    expect(html).not.toContain('<<br />');
    expect(html).not.toContain('<<span');
  });

  it('checks Vocational Training data flow and template rendering', () => {
    const rawData = {
      VT1_15_NAME: 'Directeur VT',
      VT1_15_TITLE: 'Directeur Général',
      VT1_15_TEL1: '670001122',
      VT1_2: 'CFP Excellence',
      VT1_3: 'CFPE',
      VT1_16_NAME: 'Promoteur Pierre',
    };

    const normalized = normalizeFlatKeys(rawData, 'vocationalTraining');
    const mapped = mapVocationalTrainingData(normalized, '2026-T1');

    expect(mapped.identification.nomCFP).toBe('CFP Excellence');
    expect(mapped.identification.respondent.nomPrenoms).toBe('Directeur VT');
    expect(mapped.identification.respondent.qualite).toBe('Directeur Général');
    expect(mapped.identification.respondent.telephone1).toBe('670001122');
    expect(mapped.identification.promoteur.nomPrenoms).toBe('Promoteur Pierre');

    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'vocationalTraining.hbs');
    const template = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'));
    const html = template(mapped);

    expect(html).toContain('CFP Excellence');
    expect(html).toContain('Directeur VT');
    expect(html).toContain('Promoteur Pierre');
  });

  it('7.1.3 prints each channel by its label, and "Autre" with the row’s précisez', () => {
    const mapped = mapVocationalTrainingData(
      {
        VT7_6_INFORMED: 'Oui/ Yes',
        VT7_7: ['06', '96'],
        VT7_7_OTHER: 'Radio communautaire',
        VT7_10: ['01', '05'],
        VT7_11: ['96'],
        VT7_9: 'Réunion pédagogique', // typed before the channels were coded
      },
      'QUARTERLY_2026_T4_001',
    ) as any;
    const rows = mapped.transversal.partiesPrenantesInformees;
    expect(rows[0]).toMatchObject({ informee: true, modeCommunication: 'WhatsApp, Autre : Radio communautaire' });
    expect(rows[1]).toMatchObject({ informee: false, modeCommunication: '' });
    expect(rows[2].modeCommunication).toBe('Réunion pédagogique');
    expect(rows[3].modeCommunication).toBe('Lettre / correspondance officielle, Appel téléphonique / SMS');
    expect(rows[4].modeCommunication).toBe('Autre');

    const en = mapVocationalTrainingData({ VT7_7: ['07', '96'], VT7_7_OTHER: 'Radio' }, 'QUARTERLY_2026_T4_001', 'en') as any;
    expect(en.transversal.partiesPrenantesInformees[0].modeCommunication).toBe('Email, Other: Radio');
  });

  // The values below are exactly what the wizard stored for submission
  // b1a1404c (VT E2E run, 2026-10-15): each radio/checkbox answer is the
  // schema option value, never a short key.
  it('ticks radio and checkbox answers stored as schema option values', () => {
    const mapped = mapVocationalTrainingData(
      {
        VT1_10: 'Privé laïc/ Lay private',
        VT1_11: 'Centre de Formation Professionnelle Privé (CFPP)/ Private Vocational Training Centre (PVTC)',
        VT2_18: ['Formation Initiale (FI)/ Initial Training (IT)'],
        VT2_23: 'Oui/ Yes',
        VT2_25: ['ENEO/ ENEO'],
        VT2_27: ['CAMWATER/ Tap Water'],
        VT2_33: 'Oui, entièrement/ Yes, entirely',
        VT2_38: ["WC avec chasse d'eau/ Flushing toilet"],
        VT6_2: ['Pendant la formation/ During the training'],
        VT6_5: ["Orientation d'insertion/ Insertion orientation"],
        VT6_8: ['Téléphonique/ Telephone'],
        VT9_1: 'Oui/ Yes',
        VT9_2: ['Coût de la formation/ Training cost', 'Insécurité/ Insecurity'],
      },
      'QUARTERLY_2026_T4_001',
    ) as any;

    expect(mapped.identification.ordreEnseignement).toBe('prive_laic');
    expect(mapped.identification.typeCFP).toBe('cfpp');
    expect(mapped.general.typesFormation).toEqual(['FI']);
    expect(mapped.general.energie.sources).toEqual(['eneo']);
    expect(mapped.general.eau.sources).toEqual(['camwater']);
    expect(mapped.general.cloture).toBe('entierement');
    expect(mapped.general.latrines.types).toEqual(['wc_chasse']);
    expect(mapped.orientation.moments).toEqual(['pendant']);
    expect(mapped.orientation.accompagnements).toEqual(['insertion']);
    expect(mapped.orientation.suiviPostFormation.mecanismes).toEqual(['telephonique']);
    expect(mapped.difficultes.types).toEqual(['cout_formation', 'insecurite']);

    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'vocationalTraining.hbs');
    const html = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'))(mapped);
    const ticked = (label: string) => html.includes(`<span class="checkbox checked"></span> ${label}`);
    expect(ticked('2. Privé laïc/ Lay private')).toBe(true);
    expect(ticked('1. Public/ Public')).toBe(false);
    expect(ticked('3. Centre de Formation Professionnelle Privé (CFPP)')).toBe(true);
    expect(ticked('Formation Initiale (FI)')).toBe(true);
    expect(ticked('Formation Continue (FC)')).toBe(false);
    expect(ticked('ENEO')).toBe(true);
    expect(ticked('Oui, entièrement')).toBe(true);
    expect(ticked('2. Coût de la formation')).toBe(true);
  });

  it('leaves an answer that matches no schema option unticked', () => {
    const mapped = mapVocationalTrainingData(
      { VT1_10: 'Privé', VT2_25: ['Panneaux'], VT2_33: 'Oui' },
      'QUARTERLY_2026_T4_001',
    ) as any;
    expect(mapped.identification.ordreEnseignement).toBe('');
    expect(mapped.general.energie.sources).toEqual([]);
    expect(mapped.general.cloture).toBe('');
  });

  // vtChoiceKeys maps by position, so each PDF list must follow the schema's
  // option order. Options are append-only: a new schema option fails this
  // until the PDF list gains it at the same position.
  it("keeps each PDF option list in the schema's option order", () => {
    const fields = new OnefopSchemaLoaderService().getFlattenedFields('vocationalTraining');
    const mapped = mapVocationalTrainingData({}, 'QUARTERLY_2026_T4_001') as any;
    const plain = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const lists: [string, { label: string }[]][] = [
      ['VT1_10', mapped.ordreEnseignementOptions],
      ['VT1_11', mapped.typeCFPOptions],
      ['VT1_13', mapped.raisonNonFonctionnelleOptions],
      ['VT2_2', mapped.conventionTypeOptions],
      ['VT2_25', mapped.energieSourceOptions],
      ['VT2_27', mapped.eauSourceOptions],
      ['VT2_38', mapped.latrineTypeOptions],
      ['VT2_42', mapped.aireJeuxTypeOptions],
      ['VT3_2', mapped.typeCriseOptions],
      ['VT6_2', mapped.momentOrientationOptions],
      ['VT6_5', mapped.accompagnementOptions],
      ['VT6_8', mapped.mecanismeSuiviOptions],
      ['VT9_2', mapped.difficulteOptions],
    ];
    for (const [fieldId, pdfOptions] of lists) {
      const schemaOptions = fields.get(fieldId)!.options ?? [];
      expect([fieldId, pdfOptions.length]).toEqual([fieldId, schemaOptions.length]);
      schemaOptions.forEach((o, i) => {
        const french = plain(o.value.split('/')[0]);
        expect([fieldId, i, plain(pdfOptions[i].label).includes(french)]).toEqual([fieldId, i, true]);
      });
    }
    expect((fields.get('VT2_18')!.options ?? []).map((o) => /\((F[IC])\)/.exec(o.value)?.[1])).toEqual(['FI', 'FC']);
    expect((fields.get('VT2_33')!.options ?? []).map((o) => plain(o.value.split('/')[0]))).toEqual([
      'oui, entierement',
      'oui, partiellement',
      'non',
    ]);
  });

  it('defect 1: renders table 8.8 roster with man (1), woman (2), and empty rows without defaulting to 2', () => {
    const rawData = {
      // Row 1: Man using stored code "1"
      s8q8_row1_lastName: 'Kamga',
      s8q8_row1_firstName: 'Paul',
      s8q8_row1_sex: '1',
      s8q8_row1_trainerStatus: '1',
      s8q8_row1_isAdminPersonnel: true,
      s8q8_row1_academicDiploma: 'MASTER',
      s8q8_row1_professionalDiploma: 'DQP',
      // Row 2: Woman using stored code "2"
      s8q8_row2_lastName: 'Ngo',
      s8q8_row2_firstName: 'Marie',
      s8q8_row2_sex: '2',
      s8q8_row2_trainerStatus: '3',
      s8q8_row2_isAdminPersonnel: false,
      s8q8_row2_academicDiploma: 'LICENCE',
      s8q8_row2_professionalDiploma: 'CQP',
      // Row 3: Woman using text 'Femme'
      s8q8_row3_lastName: 'Bello',
      s8q8_row3_firstName: 'Amina',
      s8q8_row3_sex: 'Femme',
      s8q8_row3_trainerStatus: '2',
      // Rows 4..14 are empty
    };

    const mapped = mapVocationalTrainingData(rawData, 'QUARTERLY_2026_T4_001') as any;
    expect(mapped.formateurs.personnel[0].sexe).toBe('M');
    expect(mapped.formateurs.personnel[1].sexe).toBe('F');
    expect(mapped.formateurs.personnel[2].sexe).toBe('F');
    expect(mapped.formateurs.personnel[3].sexe).toBe('');

    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'vocationalTraining.hbs');
    const html = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'))(mapped);

    // Extract table 8.8 tbody rows
    const tbodyMatch = /8\.8\s+État nominatif[\s\S]*?<table[^>]*class="[^"]*data-table[^"]*"[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i.exec(html);
    expect(tbodyMatch).not.toBeNull();
    const rowsHtml = tbodyMatch![1];
    const rowMatches = [...rowsHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
    expect(rowMatches.length).toBe(14);

    const parseCells = (rowStr: string) => [...rowStr.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(m => m[1].trim());

    // Row 1: Kamga Paul, sex 1, admin 1
    const row1Cells = parseCells(rowMatches[0][1]);
    expect(row1Cells[1]).toBe('Kamga');
    expect(row1Cells[2]).toBe('Paul');
    expect(row1Cells[3]).toBe('1'); // Sexe: 1
    expect(row1Cells[5]).toBe('1'); // Admin: 1

    // Row 2: Ngo Marie, sex 2, admin 2
    const row2Cells = parseCells(rowMatches[1][1]);
    expect(row2Cells[1]).toBe('Ngo');
    expect(row2Cells[2]).toBe('Marie');
    expect(row2Cells[3]).toBe('2'); // Sexe: 2
    expect(row2Cells[5]).toBe('2'); // Admin: 2

    // Row 3: Bello Amina, sex 2, admin empty
    const row3Cells = parseCells(rowMatches[2][1]);
    expect(row3Cells[1]).toBe('Bello');
    expect(row3Cells[2]).toBe('Amina');
    expect(row3Cells[3]).toBe('2'); // Sexe: 2
    expect(row3Cells[5]).toBe(''); // Admin: empty, not defaulting to 2

    // Row 4 (empty): sex empty, admin empty
    const row4Cells = parseCells(rowMatches[3][1]);
    expect(row4Cells[1]).toBe('');
    expect(row4Cells[2]).toBe('');
    expect(row4Cells[3]).toBe(''); // Sexe: empty, NOT 2
    expect(row4Cells[5]).toBe(''); // Admin: empty, NOT 2
  });

  it('8.8 Admin column reads booleans stored as the strings "true" / "false"', () => {
    const rawData = {
      s8q8_row1_lastName: 'Kamga',
      s8q8_row1_sex: '1',
      s8q8_row1_isAdminPersonnel: 'true',
      s8q8_row2_lastName: 'Ngo',
      s8q8_row2_sex: '2',
      s8q8_row2_isAdminPersonnel: 'false',
      s8q8_row3_lastName: 'Bello',
      s8q8_row3_sex: '2',
      s8q8_row3_isAdminPersonnel: ' TRUE ',
    };
    const mapped = mapVocationalTrainingData(rawData, 'QUARTERLY_2026_T4_001') as any;
    expect(mapped.formateurs.personnel[0].personnelAdministratif).toBe(true);
    expect(mapped.formateurs.personnel[1].personnelAdministratif).toBe(false);
    expect(mapped.formateurs.personnel[2].personnelAdministratif).toBe(true);
    expect(mapped.formateurs.personnel[3].personnelAdministratif).toBeUndefined();

    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'vocationalTraining.hbs');
    const html = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'))(mapped);
    const rowsHtml = /8\.8\s+État nominatif[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i.exec(html)![1];
    const admin = [...rowsHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
      .slice(0, 4)
      .map((r) => [...r[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((m) => m[1].trim())[5]);
    expect(admin).toEqual(['1', '2', '1', '']);
  });
});
