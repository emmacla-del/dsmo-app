// lib/core/focus/renderers/vt_table_defs.dart
//
// Concrete VtTableDef instances for Vocational Training's grid fields.
// Row labels and option lists below are copied verbatim from the same
// PDF-verified source already used by the backend PDF export mapper
// (pdf-data-mapper.service.ts's VT_ACADEMIC_DIPLOMA_ROWS et al.) and the
// frozen normalizer's row-key constants of the same name — kept here at
// the renderer layer rather than in onefop_ast.dart, matching
// TableSpecBuilder's own convention (e.g. _cspRowLabelsI18n) of owning
// display labels separately from the AST's field-shape declarations.
//
// All 22 VT table fields (4.1-4.11, 5.2-5.4, 6.3, 8.1-8.4, 8.6-8.8) are
// wired into vtTableDefFor() below — see that function's own doc comment.
// vtTableDefFor() still returns null for any template/prefix that isn't
// (or is no longer) one of those 22, so an unwired grid renders nothing
// rather than crashing.

import '../../i18n/localized_text.dart';
import 'vt_table_types.dart';

// ─────────────────────────────────────────────────────────────
// Row-label / option-list data (PDF-confirmed)
// ─────────────────────────────────────────────────────────────

const List<MapEntry<String, LocalizedText>> vtAcademicDiplomaRows = [
  MapEntry('doctorat', LocalizedText(fr: 'Doctorat/PhD', en: 'Doctorate/PhD')),
  MapEntry('master2', LocalizedText.same('Master II/DEA/DESS')),
  MapEntry('maitrise', LocalizedText(fr: 'Maîtrise/Master I', en: 'Master I (Maîtrise)')),
  MapEntry('licence', LocalizedText(fr: 'Licence', en: 'Bachelor')),
  MapEntry('deug_dut', LocalizedText.same('DEUG/DUT')),
  MapEntry('bacc_general', LocalizedText(fr: 'BACC Général', en: 'GCE A-Level (General)')),
  MapEntry('bacc_technique', LocalizedText(fr: 'BACC Technique', en: 'GCE A-Level (Technical)')),
  MapEntry('probatoire', LocalizedText(fr: 'Probatoire', en: 'Form 6')),
  MapEntry('bepc', LocalizedText.same('BEPC/GCE O-Level')),
  MapEntry('cep', LocalizedText.same('CEP/CEPE/FSLC')),
  MapEntry('sans_diplome_academique',
      LocalizedText(fr: 'Sans diplôme académique', en: 'No academic qualification')),
];

const List<MapEntry<String, LocalizedText>> vtProfessionalDiplomaRows = [
  MapEntry('dipleg_dipes2', LocalizedText.same('DIPLEG/DIPES II')),
  MapEntry('ingenieur_master_pro',
      LocalizedText(fr: 'Ingénieur/Master Pro', en: 'Engineer/Professional Master')),
  MapEntry('dipceg_dipes1', LocalizedText.same('DIPCEG/DIPES I')),
  MapEntry('licence_pro', LocalizedText(fr: 'Licence Pro', en: 'Professional Bachelor')),
  MapEntry('bts_hnd', LocalizedText.same('BTS/HND')),
  MapEntry('bep_bp_bacpro', LocalizedText.same('BEP/BP/BAC PRO')),
  MapEntry('capieg', LocalizedText.same('CAPIEG/CAPIEMP')),
  MapEntry('capiaeg', LocalizedText.same('CAPIAEG/CAPIA')),
  MapEntry('cap', LocalizedText.same('CAP')),
  MapEntry('dqp', LocalizedText.same('DQP/VQD')),
  MapEntry('cqp', LocalizedText.same('CQP/VQC')),
  MapEntry('autres_pro', LocalizedText(fr: 'Autres', en: 'Others')),
  MapEntry('sans_diplome_professionnel',
      LocalizedText(fr: 'Sans diplôme professionnel', en: 'No vocational qualification')),
];

// Roster diploma-picker codes — the academic list is numbered 1-11, the
// professional list 1-12 on the paper form (12 shared by "Autres" and
// "Sans diplôme professionnel", printed that way on the source PDF itself
// — see VT design note §13.3, PDF-confirmed). Kept as two distinct rows
// with the same printed code, matching the paper form exactly.
List<VtOption> _diplomaOptions(
        List<MapEntry<String, LocalizedText>> rows, List<String> codes) =>
    [
      for (var i = 0; i < rows.length; i++)
        VtOption(value: rows[i].key, code: codes[i], label: rows[i].value),
    ];

final List<VtOption> vtAcademicDiplomaOptions = _diplomaOptions(
    vtAcademicDiplomaRows, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
final List<VtOption> vtProfessionalDiplomaOptions = _diplomaOptions(
    vtProfessionalDiplomaRows,
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '12']);

const List<VtOption> vtSexOptions = [
  VtOption(value: '1', code: '1', label: LocalizedText(fr: 'Homme', en: 'Man')),
  VtOption(value: '2', code: '2', label: LocalizedText(fr: 'Femme', en: 'Woman')),
];

const List<VtOption> vtTrainerStatusOptions = [
  VtOption(
      value: '1',
      code: '1',
      label: LocalizedText(fr: 'Vacataire professionnel', en: 'Part-time vocational')),
  VtOption(
      value: '2',
      code: '2',
      label: LocalizedText(fr: 'Vacataire non professionnel', en: 'Part-time non-vocational')),
  VtOption(value: '3', code: '3', label: LocalizedText(fr: 'Permanent', en: 'Permanent')),
];

// Fixed row-key lists below are copied verbatim from
// flat-key-normalizer.ts's own VT_*_ROWS constants (VT_AGE_BAND_ROWS,
// VT_TRAINER_AGE_BAND_ROWS, VT_EDUCATION_LEVEL_ROWS,
// VT_VULNERABLE_CATEGORY_ROWS, VT_TRAINER_DISABILITY_ROWS,
// VT_INFRASTRUCTURE_ROWS, VT_FURNITURE_ROWS) — the row key is what the
// normalizer's flat-key pattern expects verbatim (e.g. `s4q7_${ageBand}_
// entrant_male`), so these lists must stay byte-for-byte in sync with
// that file, not be re-derived independently.

/// 4.7 — 24 age bands, PDF page 9.
const List<MapEntry<String, LocalizedText>> vtAgeBandRows = [
  MapEntry('under_14', LocalizedText(fr: 'Moins de 14 ans', en: 'Less than 14 years old')),
  MapEntry('age_14', LocalizedText(fr: '14 ans', en: '14 years old')),
  MapEntry('age_15', LocalizedText(fr: '15 ans', en: '15 years old')),
  MapEntry('age_16', LocalizedText(fr: '16 ans', en: '16 years old')),
  MapEntry('age_17', LocalizedText(fr: '17 ans', en: '17 years old')),
  MapEntry('age_18', LocalizedText(fr: '18 ans', en: '18 years old')),
  MapEntry('age_19', LocalizedText(fr: '19 ans', en: '19 years old')),
  MapEntry('age_20', LocalizedText(fr: '20 ans', en: '20 years old')),
  MapEntry('age_21', LocalizedText(fr: '21 ans', en: '21 years old')),
  MapEntry('age_22', LocalizedText(fr: '22 ans', en: '22 years old')),
  MapEntry('age_23', LocalizedText(fr: '23 ans', en: '23 years old')),
  MapEntry('age_24', LocalizedText(fr: '24 ans', en: '24 years old')),
  MapEntry('age_25', LocalizedText(fr: '25 ans', en: '25 years old')),
  MapEntry('age_26', LocalizedText(fr: '26 ans', en: '26 years old')),
  MapEntry('age_27', LocalizedText(fr: '27 ans', en: '27 years old')),
  MapEntry('age_28', LocalizedText(fr: '28 ans', en: '28 years old')),
  MapEntry('age_29', LocalizedText(fr: '29 ans', en: '29 years old')),
  MapEntry('age_30', LocalizedText(fr: '30 ans', en: '30 years old')),
  MapEntry('age_31', LocalizedText(fr: '31 ans', en: '31 years old')),
  MapEntry('age_32', LocalizedText(fr: '32 ans', en: '32 years old')),
  MapEntry('age_33', LocalizedText(fr: '33 ans', en: '33 years old')),
  MapEntry('age_34', LocalizedText(fr: '34 ans', en: '34 years old')),
  MapEntry('age_35', LocalizedText(fr: '35 ans', en: '35 years old')),
  MapEntry('above_35', LocalizedText(fr: 'Supérieur à 35 ans', en: 'Above 35 years old')),
];

/// 8.3 — 4 trainer age bands, PDF page 16.
const List<MapEntry<String, LocalizedText>> vtTrainerAgeBandRows = [
  MapEntry('age_18_24', LocalizedText(fr: 'De 18 à 24 ans', en: 'From 18 to 24 years')),
  MapEntry('age_25_39', LocalizedText(fr: 'De 25 à 39 ans', en: 'From 25 to 39 years')),
  MapEntry('age_40_59', LocalizedText(fr: 'De 40 à 59 ans', en: 'From 40 to 59 years')),
  MapEntry('age_60_plus', LocalizedText(fr: '60 ans et plus', en: '60 years and above')),
];

/// 4.8 — 8 education levels, PDF page 9.
const List<MapEntry<String, LocalizedText>> vtEducationLevelRows = [
  MapEntry('non_alphabetise', LocalizedText(fr: 'Non alphabétisé', en: 'Illiterate')),
  MapEntry('primaire', LocalizedText(fr: 'Education primaire', en: 'Primary education')),
  MapEntry('premier_cycle_general',
      LocalizedText(
          fr: "Premier cycle de l'enseignement secondaire général",
          en: 'Lower general secondary education')),
  MapEntry('premier_cycle_technique',
      LocalizedText(
          fr: "Premier cycle de l'enseignement secondaire technique",
          en: 'Lower technical secondary education')),
  MapEntry('second_cycle_general',
      LocalizedText(
          fr: "Second cycle de l'enseignement secondaire général",
          en: 'Upper general secondary education')),
  MapEntry('second_cycle_technique',
      LocalizedText(
          fr: "Second cycle de l'enseignement secondaire technique",
          en: 'Upper technical secondary education')),
  MapEntry('enseignement_normal',
      LocalizedText(fr: 'Enseignement normal', en: 'Teacher training')),
  MapEntry('enseignement_superieur',
      LocalizedText(fr: 'Enseignement supérieur', en: 'Higher education')),
];

/// 4.9 — 11 vulnerability categories, PDF page 10.
const List<MapEntry<String, LocalizedText>> vtVulnerableCategoryRows = [
  MapEntry('moteur',
      LocalizedText(fr: 'Moteur (ou physique)', en: 'Mobility (physical) impairment')),
  MapEntry('visuel', LocalizedText(fr: 'Visuel', en: 'Visual impairment')),
  MapEntry('auditif', LocalizedText(fr: 'Auditif', en: 'Hearing impairment')),
  MapEntry('polyhandicapes', LocalizedText(fr: 'Polyhandicapés', en: 'Polyhandicapped')),
  MapEntry('refugies', LocalizedText(fr: 'Réfugiés', en: 'Refugees')),
  MapEntry('orphelins_vulnerables',
      LocalizedText(
          fr: 'Enfants Orphelins Vulnérables', en: 'Vulnerable orphaned children')),
  MapEntry('deplaces_internes',
      LocalizedText(fr: 'Déplacés Internes', en: 'Internally displaced people')),
  MapEntry('retournes',
      LocalizedText(fr: 'Apprenants RETOURNES', en: 'Returned learners')),
  MapEntry('bororo',
      LocalizedText(
          fr: 'Population autochtone BORORO',
          en: 'Indigenous population: Bororo')),
  MapEntry('baka',
      LocalizedText(
          fr: 'Population autochtone BAKA', en: 'Indigenous population: Baka')),
  MapEntry('baguieli',
      LocalizedText(
          fr: 'Population autochtone BAGUIELI',
          en: 'Indigenous population: Bagyeli')),
];

/// 8.6 — 4 trainer disability categories, PDF page 17.
const List<MapEntry<String, LocalizedText>> vtTrainerDisabilityRows = [
  MapEntry('moteur', LocalizedText(fr: 'Handicap moteur (ou physique)', en: 'Mobility (physical) impairment')),
  MapEntry('visuel', LocalizedText(fr: 'Handicap visuel', en: 'Visual impairment')),
  MapEntry('auditif', LocalizedText(fr: 'Handicap auditif', en: 'Hearing impairment')),
  MapEntry('polyhandicapes', LocalizedText(fr: 'Polyhandicapés', en: 'Polyhandicapped')),
];

/// 5.3 — 9 infrastructure types, PDF page 11.
const List<MapEntry<String, LocalizedText>> vtInfrastructureRows = [
  MapEntry('salle_classe', LocalizedText(fr: 'Salle de classe', en: 'Classrooms')),
  MapEntry('ateliers_pratiques',
      LocalizedText(fr: 'Ateliers de pratiques équipés', en: 'Equipped practice workshops')),
  MapEntry('laboratoires',
      LocalizedText(
          fr: 'Laboratoires de formation équipés', en: 'Equipped training laboratories')),
  MapEntry('blocs_administratifs',
      LocalizedText(fr: 'Blocs administratifs', en: 'Administrative blocks')),
  MapEntry('salle_reunion', LocalizedText(fr: 'Salle de réunion', en: 'Meeting halls')),
  MapEntry('salle_formateurs', LocalizedText(fr: 'Salle de formateurs', en: "Trainers' rooms")),
  MapEntry('bureaux', LocalizedText(fr: 'Bureaux', en: 'Offices')),
  MapEntry('magasin', LocalizedText(fr: 'Magasin', en: 'Warehouses')),
  MapEntry('espaces_temporaires', LocalizedText(fr: 'Espaces temporaires', en: 'Temporary spaces')),
];

/// 5.4 — 8 furniture types, PDF page 12.
const List<MapEntry<String, LocalizedText>> vtFurnitureRows = [
  MapEntry('banc_1_place', LocalizedText(fr: 'Table-banc — 1 place', en: 'School bench — one-seater')),
  MapEntry('banc_2_places', LocalizedText(fr: 'Table-banc — 2 places', en: 'School bench — two-seater')),
  MapEntry('banc_3_places', LocalizedText(fr: 'Table-banc — 3 places', en: 'School bench — three-seater')),
  MapEntry('banc_4_places_plus',
      LocalizedText(fr: 'Table-banc — 4 places et +', en: 'School bench — four-seater and more')),
  MapEntry('chaises_formateurs', LocalizedText(fr: 'Chaises pour formateurs', en: 'Chairs for trainers')),
  MapEntry('tables_formateurs', LocalizedText(fr: 'Tables pour formateurs', en: 'Tables for trainers')),
  MapEntry('armoires', LocalizedText(fr: 'Armoires ou placards', en: 'Cabinets or cupboards')),
  MapEntry('tableaux', LocalizedText(fr: 'Tableaux', en: 'Blackboards')),
];

/// 4.11 — 2 scholarship categories, PDF page 10. Fixed rows (the paper form
/// prints these two category names directly), not free-text/repeating.
const List<MapEntry<String, LocalizedText>> vtScholarshipCategoryRows = [
  MapEntry('other_admin',
      LocalizedText(
          fr: 'Bourses offertes par autres administrations',
          en: 'Scholarships offered by other administrations')),
  MapEntry('international',
      LocalizedText(fr: 'Bourses internationales', en: 'International scholarships')),
];

// ─────────────────────────────────────────────────────────────
// Shared factories
// ─────────────────────────────────────────────────────────────

/// 4.1 / 4.2 / 8.1 / 8.2 shape — fixed diploma rows × Hommes/Femmes.
/// 4.1 / 4.2 / 8.1 / 8.2 shape — fixed diploma rows × gender, with a
/// computed Total column (confirmed via get_screenshot against Figma's
/// own excel-grid mockup for 4.1 — a "Σ Total" column with a per-row
/// computed sum was there the whole time; this def just hadn't modeled
/// it yet, unlike vtTrainerDisabilityTableDef's identical shape below,
/// which already had one for the same reason on its own PDF page).
VtTableDef vtDiplomaTableDef({
  required String prefix,
  required String paperCode,
  required LocalizedText title,
  required List<MapEntry<String, LocalizedText>> diplomaRows,
}) {
  return VtTableDef(
    prefix: prefix,
    paperCode: paperCode,
    title: title,
    progressNoun: const LocalizedText(fr: 'diplômes', en: 'diplomas'),
    rows: [
      for (final d in diplomaRows) VtRowDef(id: '${prefix}_${d.key}', fixedLabel: d.value),
    ],
    cells: [
      const VtCellDef(
          key: 'male', label: LocalizedText(fr: 'Hommes', en: 'Men'), kind: VtCellKind.number),
      const VtCellDef(
          key: 'female', label: LocalizedText(fr: 'Femmes', en: 'Women'), kind: VtCellKind.number),
      VtCellDef(
        key: 'total',
        label: const LocalizedText(fr: 'Σ Total', en: 'Σ Total'),
        kind: VtCellKind.computed,
        computeValue: (rowId, data) =>
            (data['${rowId}_male'] as int? ?? 0) + (data['${rowId}_female'] as int? ?? 0),
      ),
    ],
  );
}

/// 4.3 / 4.4 / 4.5 / 8.4 shape — specialty free text × FI/FC × gender,
/// repeating rows (fixed display capacity, no add/remove).
VtTableDef vtSpecialtyFiFcTableDef({
  required String prefix,
  required String paperCode,
  required LocalizedText title,
  int rows = 12,
}) {
  return VtTableDef(
    prefix: prefix,
    paperCode: paperCode,
    title: title,
    progressNoun: const LocalizedText(fr: 'lignes', en: 'rows'),
    progressiveRows: true,
    rows: [
      for (var i = 1; i <= rows; i++)
        VtRowDef(id: '${prefix}_row$i', labelFromCells: const ['specialtyText']),
    ],
    cells: const [
      VtCellDef(
          key: 'specialtyText',
          label: LocalizedText(fr: 'Spécialité', en: 'Specialty'),
          kind: VtCellKind.text),
      VtCellDef(
          key: 'fiMale',
          label: LocalizedText(fr: 'FI — Hommes', en: 'IT — Men'),
          kind: VtCellKind.number),
      VtCellDef(
          key: 'fiFemale',
          label: LocalizedText(fr: 'FI — Femmes', en: 'IT — Women'),
          kind: VtCellKind.number),
      VtCellDef(
          key: 'fcMale',
          label: LocalizedText(fr: 'FC — Hommes', en: 'CT — Men'),
          kind: VtCellKind.number),
      VtCellDef(
          key: 'fcFemale',
          label: LocalizedText(fr: 'FC — Femmes', en: 'CT — Women'),
          kind: VtCellKind.number),
    ],
  );
}

/// 4.6 shape — specialty x year-of-study (1ère/2ème année) x gender.
VtTableDef vtSpecialtyYearTableDef({
  required String prefix,
  required String paperCode,
  required LocalizedText title,
  int rows = 12,
}) {
  return VtTableDef(
    prefix: prefix,
    paperCode: paperCode,
    title: title,
    progressNoun: const LocalizedText(fr: 'lignes', en: 'rows'),
    progressiveRows: true,
    rows: [
      for (var i = 1; i <= rows; i++)
        VtRowDef(id: '${prefix}_row$i', labelFromCells: const ['specialtyText']),
    ],
    cells: const [
      VtCellDef(
          key: 'specialtyText',
          label: LocalizedText(fr: 'Spécialité', en: 'Specialty'),
          kind: VtCellKind.text),
      VtCellDef(
          key: 'year1Male',
          label: LocalizedText(fr: '1ère année — Hommes', en: 'Year 1 — Men'),
          kind: VtCellKind.number),
      VtCellDef(
          key: 'year1Female',
          label: LocalizedText(fr: '1ère année — Femmes', en: 'Year 1 — Women'),
          kind: VtCellKind.number),
      VtCellDef(
          key: 'year2Male',
          label: LocalizedText(fr: '2ème année — Hommes', en: 'Year 2 — Men'),
          kind: VtCellKind.number),
      VtCellDef(
          key: 'year2Female',
          label: LocalizedText(fr: '2ème année — Femmes', en: 'Year 2 — Women'),
          kind: VtCellKind.number),
    ],
  );
}

/// 4.10 / 6.3 shape — specialty x gender, with a computed read-only Total
/// column. The paper form prints Hommes/Femmes/Total as three columns per
/// row, but Total is never something the user fills in (UX rule 4) — it's
/// derived live from the row's own male/female cells, never persisted.
VtTableDef vtSpecialtyGenderTotalTableDef({
  required String prefix,
  required String paperCode,
  required LocalizedText title,
  int rows = 10,
}) {
  return VtTableDef(
    prefix: prefix,
    paperCode: paperCode,
    title: title,
    progressNoun: const LocalizedText(fr: 'lignes', en: 'rows'),
    progressiveRows: true,
    rows: [
      for (var i = 1; i <= rows; i++)
        VtRowDef(id: '${prefix}_row$i', labelFromCells: const ['specialtyText']),
    ],
    cells: [
      const VtCellDef(
          key: 'specialtyText',
          label: LocalizedText(fr: 'Spécialité', en: 'Specialty'),
          kind: VtCellKind.text),
      const VtCellDef(
          key: 'male', label: LocalizedText(fr: 'Hommes', en: 'Men'), kind: VtCellKind.number),
      const VtCellDef(
          key: 'female',
          label: LocalizedText(fr: 'Femmes', en: 'Women'),
          kind: VtCellKind.number),
      VtCellDef(
        key: 'total',
        label: const LocalizedText(fr: 'Total (calculé)', en: 'Total (computed)'),
        kind: VtCellKind.computed,
        computeValue: (rowId, data) =>
            (data['${rowId}_male'] as int? ?? 0) + (data['${rowId}_female'] as int? ?? 0),
      ),
    ],
  );
}

/// 8.7 shape — specialty x FI/FC headcount, no gender split (the paper
/// form's own columns here are just Formation Initiale / Formation
/// Continue counts, not Hommes/Femmes).
VtTableDef vtSpecialtyFiFcCountTableDef({
  required String prefix,
  required String paperCode,
  required LocalizedText title,
  int rows = 10,
}) {
  return VtTableDef(
    prefix: prefix,
    paperCode: paperCode,
    title: title,
    progressNoun: const LocalizedText(fr: 'lignes', en: 'rows'),
    progressiveRows: true,
    rows: [
      for (var i = 1; i <= rows; i++)
        VtRowDef(id: '${prefix}_row$i', labelFromCells: const ['specialtyText']),
    ],
    cells: const [
      VtCellDef(
          key: 'specialtyText',
          label: LocalizedText(fr: 'Spécialité', en: 'Specialty'),
          kind: VtCellKind.text),
      VtCellDef(
          key: 'fiCount',
          label: LocalizedText(fr: 'Formation Initiale (FI)', en: 'Initial Training (IT)'),
          kind: VtCellKind.number),
      VtCellDef(
          key: 'fcCount',
          label: LocalizedText(fr: 'Formation Continue (FC)', en: 'Continuing Training (CT)'),
          kind: VtCellKind.number),
    ],
  );
}

/// 4.7 shape — fixed age-band rows × (Entrants/Sortants/Abandons) × gender.
/// Matches `buildVtTraineeAgeFlowRows`'s flat key
/// `s4q7_${ageBand}_${flowStatus}_${gender}` exactly (cellId composes
/// `${row.id}_${cell.key}` = `s4q7_${ageBand}_${flowStatus}_${gender}`).
/// No Total column — PDF page 9 prints only Hommes/Femmes per flow group
/// for this table (unlike 4.8/4.9, which do print one).
VtTableDef vtTraineeAgeFlowTableDef({required String prefix, required String paperCode}) {
  const flows = [
    ('entrant', LocalizedText(fr: 'Entrants', en: 'Incoming')),
    ('sortant', LocalizedText(fr: 'Sortants', en: 'Outgoing')),
    ('abandon', LocalizedText(fr: 'Abandons', en: 'Dropouts')),
  ];
  return VtTableDef(
    prefix: prefix,
    paperCode: paperCode,
    title: const LocalizedText(
        fr: 'Effectifs des apprenants par âge', en: 'Number of trainees per age group'),
    progressNoun: const LocalizedText(fr: 'tranches d\'âge', en: 'age groups'),
    rows: [
      for (final a in vtAgeBandRows) VtRowDef(id: '${prefix}_${a.key}', fixedLabel: a.value),
    ],
    cells: [
      for (final (flowKey, flowLabel) in flows) ...[
        VtCellDef(
            key: '${flowKey}_male',
            label: LocalizedText(
                fr: '${flowLabel.fr} — Hommes', en: '${flowLabel.en} — Men'),
            kind: VtCellKind.number),
        VtCellDef(
            key: '${flowKey}_female',
            label: LocalizedText(
                fr: '${flowLabel.fr} — Femmes', en: '${flowLabel.en} — Women'),
            kind: VtCellKind.number),
      ],
    ],
  );
}

/// 4.8 / 4.9 shape — fixed category rows × (Entrants/Sortants/Abandons) ×
/// (Hommes/Femmes/Total). Matches `buildVtEducationLevelFlowRows`/
/// `buildVtTraineeVulnerableRows`'s flat key
/// `${prefix}_${category}_${flowStatus}_${gender}`. Total is computed
/// display-only (male + female), never written back — same "Total is
/// never something the user fills in" rule already applied by
/// [vtSpecialtyGenderTotalTableDef] — so the normalizer's `_total` key
/// simply never appears in the data, which it already tolerates (skips
/// any flat key with no raw value).
VtTableDef vtFlowCategoryTotalTableDef({
  required String prefix,
  required String paperCode,
  required LocalizedText title,
  required List<MapEntry<String, LocalizedText>> categoryRows,
}) {
  const flows = [
    ('entrant', LocalizedText(fr: 'Entrants', en: 'Incoming')),
    ('sortant', LocalizedText(fr: 'Sortants', en: 'Outgoing')),
    ('abandon', LocalizedText(fr: 'Abandons', en: 'Dropouts')),
  ];
  return VtTableDef(
    prefix: prefix,
    paperCode: paperCode,
    title: title,
    progressNoun: const LocalizedText(fr: 'catégories', en: 'categories'),
    rows: [
      for (final c in categoryRows) VtRowDef(id: '${prefix}_${c.key}', fixedLabel: c.value),
    ],
    cells: [
      for (final (flowKey, flowLabel) in flows) ...[
        VtCellDef(
            key: '${flowKey}_male',
            label: LocalizedText(
                fr: '${flowLabel.fr} — Hommes', en: '${flowLabel.en} — Men'),
            kind: VtCellKind.number),
        VtCellDef(
            key: '${flowKey}_female',
            label: LocalizedText(
                fr: '${flowLabel.fr} — Femmes', en: '${flowLabel.en} — Women'),
            kind: VtCellKind.number),
        VtCellDef(
          key: '${flowKey}_total',
          label: LocalizedText(
              fr: '${flowLabel.fr} — Total (calculé)', en: '${flowLabel.en} — Total (computed)'),
          kind: VtCellKind.computed,
          computeValue: (rowId, data) =>
              (data['${rowId}_${flowKey}_male'] as int? ?? 0) +
              (data['${rowId}_${flowKey}_female'] as int? ?? 0),
        ),
      ],
    ],
  );
}

/// 8.3 shape — fixed trainer age-band rows × gender, no Total (PDF page 16
/// prints only Hommes/Femmes). Matches `buildVtTrainerAgeRows`'s flat key
/// `s8q3_${ageBand}_${gender}`.
/// 8.3 shape — fixed age-band rows × gender, NO computed Total —
/// vt_missing_renderers_test.dart's own "8.3 vt_trainer_age_table"
/// case pins this at 2 cells with the cited reason "male/female, no
/// Total per PDF p.16": the real paper form's page 16 genuinely omits a
/// Total column here, unlike 8.6 (disability, page 17, which has one)
/// and unlike vtDiplomaTableDef above (which a Figma screenshot showed
/// one for, with no PDF evidence against it). That page-cited assertion
/// is stronger ground truth than Figma's own mockup, so — unlike
/// vtDiplomaTableDef — this shape stays exactly as before.
VtTableDef vtTrainerAgeTableDef({required String prefix, required String paperCode}) {
  return VtTableDef(
    prefix: prefix,
    paperCode: paperCode,
    title: const LocalizedText(
        fr: 'Effectifs des formateurs par tranche d\'âge', en: 'Number of trainers per age group'),
    progressNoun: const LocalizedText(fr: 'tranches d\'âge', en: 'age groups'),
    rows: [
      for (final a in vtTrainerAgeBandRows)
        VtRowDef(id: '${prefix}_${a.key}', fixedLabel: a.value),
    ],
    cells: const [
      VtCellDef(key: 'male', label: LocalizedText(fr: 'Hommes', en: 'Men'), kind: VtCellKind.number),
      VtCellDef(
          key: 'female', label: LocalizedText(fr: 'Femmes', en: 'Women'), kind: VtCellKind.number),
    ],
  );
}

/// 8.6 shape — fixed disability-category rows × gender, with a computed
/// Total (PDF page 17 prints Hommes/Femmes/Total). Matches
/// `buildVtTrainerDisabilityRows`'s flat key `s8q6_${category}_${gender}`.
VtTableDef vtTrainerDisabilityTableDef({required String prefix, required String paperCode}) {
  return VtTableDef(
    prefix: prefix,
    paperCode: paperCode,
    title: const LocalizedText(
        fr: 'Effectifs des formateurs par type de handicap',
        en: 'Number of trainers per type of impairment'),
    progressNoun: const LocalizedText(fr: 'catégories', en: 'categories'),
    rows: [
      for (final c in vtTrainerDisabilityRows)
        VtRowDef(id: '${prefix}_${c.key}', fixedLabel: c.value),
    ],
    cells: [
      const VtCellDef(
          key: 'male', label: LocalizedText(fr: 'Hommes', en: 'Men'), kind: VtCellKind.number),
      const VtCellDef(
          key: 'female', label: LocalizedText(fr: 'Femmes', en: 'Women'), kind: VtCellKind.number),
      VtCellDef(
        key: 'total',
        label: const LocalizedText(fr: 'Total (calculé)', en: 'Total (computed)'),
        kind: VtCellKind.computed,
        computeValue: (rowId, data) =>
            (data['${rowId}_male'] as int? ?? 0) + (data['${rowId}_female'] as int? ?? 0),
      ),
    ],
  );
}

/// 4.11 shape — 2 fixed scholarship-category rows × (Octroyée/Bénéficiée) ×
/// (Hommes/Femmes/Total). Matches `buildVtScholarshipRows`'s flat key
/// `s4q11_${category}_${status}_${gender}`.
VtTableDef vtScholarshipTableDef({required String prefix, required String paperCode}) {
  const statuses = [
    ('granted', LocalizedText(fr: 'Octroyée', en: 'Granted')),
    ('received', LocalizedText(fr: 'Bénéficiée', en: 'Received')),
  ];
  return VtTableDef(
    prefix: prefix,
    paperCode: paperCode,
    title: const LocalizedText(
        fr: 'Effectifs des apprenants par types de bourse',
        en: 'Number of trainees by scholarship type'),
    progressNoun: const LocalizedText(fr: 'types de bourse', en: 'scholarship types'),
    rows: [
      for (final c in vtScholarshipCategoryRows)
        VtRowDef(id: '${prefix}_${c.key}', fixedLabel: c.value),
    ],
    cells: [
      for (final (statusKey, statusLabel) in statuses) ...[
        VtCellDef(
            key: '${statusKey}_male',
            label: LocalizedText(
                fr: '${statusLabel.fr} — Hommes', en: '${statusLabel.en} — Men'),
            kind: VtCellKind.number),
        VtCellDef(
            key: '${statusKey}_female',
            label: LocalizedText(
                fr: '${statusLabel.fr} — Femmes', en: '${statusLabel.en} — Women'),
            kind: VtCellKind.number),
        VtCellDef(
          key: '${statusKey}_total',
          label: LocalizedText(
              fr: '${statusLabel.fr} — Total (calculé)',
              en: '${statusLabel.en} — Total (computed)'),
          kind: VtCellKind.computed,
          computeValue: (rowId, data) =>
              (data['${rowId}_${statusKey}_male'] as int? ?? 0) +
              (data['${rowId}_${statusKey}_female'] as int? ?? 0),
        ),
      ],
    ],
  );
}

/// 5.2 shape — specialty free text × 2 Oui/Non questions, repeating rows
/// (15, fixed display capacity, no add/remove) — same repeating-row
/// convention as [vtSpecialtyFiFcTableDef] but with boolean cells instead
/// of numeric ones. Matches `buildVtCurriculumRows`'s flat key
/// `s5q2_row${i}_${field}`. `hasCurriculum`/`isApproved` use
/// [VtCellKind.boolean]'s default identity encode (a real Dart bool) —
/// `toBoolFromYesNo` in the normalizer accepts a native boolean directly
/// (checked before the string-parsing branch), so no custom
/// encodeBoolean/decodeBoolean is needed here. `isApproved` ("is it
/// approved") only makes sense once a curriculum has been said to exist
/// at all, so it's gated behind `hasCurriculum` via dependsOnKey — hidden
/// (not merely shown-but-irrelevant) until that answer is Oui.
VtTableDef vtCurriculumTableDef({required String prefix, required String paperCode, int rows = 15}) {
  return VtTableDef(
    prefix: prefix,
    paperCode: paperCode,
    title: const LocalizedText(fr: 'Référentiel de formation', en: 'Training curricula'),
    progressNoun: const LocalizedText(fr: 'lignes', en: 'rows'),
    progressiveRows: true,
    rows: [
      for (var i = 1; i <= rows; i++)
        VtRowDef(id: '${prefix}_row$i', labelFromCells: const ['specialtyText']),
    ],
    cells: const [
      VtCellDef(
          key: 'specialtyText',
          label: LocalizedText(fr: 'Spécialité', en: 'Specialty'),
          kind: VtCellKind.text),
      VtCellDef(
          key: 'hasCurriculum',
          label: LocalizedText(
              fr: 'Existence d\'un référentiel de formation',
              en: 'Existence of a training curriculum'),
          kind: VtCellKind.boolean),
      VtCellDef(
          key: 'isApproved',
          label: LocalizedText(fr: 'Le référentiel est-il homologué ?', en: 'Is it approved?'),
          kind: VtCellKind.boolean,
          dependsOnKey: 'hasCurriculum'),
    ],
  );
}

/// 5.3 shape — fixed infrastructure-type rows × 4 numeric counts. All 4
/// columns (including "Nombre total de locaux") are independently printed,
/// fillable boxes on the paper form, not a derived sum — so all 4 are
/// plain [VtCellKind.number] cells, matching `buildVtInfrastructureRows`'s
/// flat key `s5q3_${type}_${column}` for each of totalCount/
/// permanentGoodCount/permanentBadCount/temporaryCount.
VtTableDef vtInfrastructureTableDef({required String prefix, required String paperCode}) {
  return VtTableDef(
    prefix: prefix,
    paperCode: paperCode,
    title: const LocalizedText(
        fr: 'Nombre d\'infrastructures en fonction de leur état',
        en: 'Number of infrastructure facilities by condition'),
    progressNoun: const LocalizedText(fr: 'types d\'infrastructure', en: 'infrastructure types'),
    rows: [
      for (final t in vtInfrastructureRows) VtRowDef(id: '${prefix}_${t.key}', fixedLabel: t.value),
    ],
    cells: const [
      VtCellDef(
          key: 'totalCount',
          label: LocalizedText(fr: 'Nombre total de locaux', en: 'Total number of rooms'),
          kind: VtCellKind.number),
      VtCellDef(
          key: 'permanentGoodCount',
          label: LocalizedText(
              fr: 'Définitif — Bon état', en: 'Permanent construction — Good condition'),
          kind: VtCellKind.number),
      VtCellDef(
          key: 'permanentBadCount',
          label: LocalizedText(
              fr: 'Définitif — Mauvais état', en: 'Permanent construction — Bad condition'),
          kind: VtCellKind.number),
      VtCellDef(
          key: 'temporaryCount',
          label: LocalizedText(fr: 'Provisoire', en: 'Temporary construction'),
          kind: VtCellKind.number),
    ],
  );
}

/// 5.4 shape — fixed furniture-type rows × Bon état/Mauvais état. Matches
/// `buildVtFurnitureRows`'s flat key `s5q4_${type}_${column}` for
/// goodCount/badCount.
VtTableDef vtFurnitureTableDef({required String prefix, required String paperCode}) {
  return VtTableDef(
    prefix: prefix,
    paperCode: paperCode,
    title: const LocalizedText(fr: 'Equipements mobiliers', en: 'Furniture'),
    progressNoun: const LocalizedText(fr: 'types d\'équipement', en: 'equipment types'),
    rows: [
      for (final t in vtFurnitureRows) VtRowDef(id: '${prefix}_${t.key}', fixedLabel: t.value),
    ],
    cells: const [
      VtCellDef(
          key: 'goodCount',
          label: LocalizedText(fr: 'Bon état', en: 'Good condition'),
          kind: VtCellKind.number),
      VtCellDef(
          key: 'badCount',
          label: LocalizedText(fr: 'Mauvais état', en: 'Bad condition'),
          kind: VtCellKind.number),
    ],
  );
}

// ─────────────────────────────────────────────────────────────
// 8.8 — named trainer/administrative-staff roster (max 14 rows)
// ─────────────────────────────────────────────────────────────

final VtTableDef vtTrainerRosterTableDef = VtTableDef(
  prefix: 's8q8',
  paperCode: '8.8',
  title: const LocalizedText(fr: 'Liste nominative des formateurs', en: 'Named trainer roster'),
  progressNoun: const LocalizedText(fr: 'formateurs', en: 'trainers'),
  isRoster: true,
  rows: [
    for (var i = 1; i <= 14; i++)
      VtRowDef(id: 's8q8_row$i', labelFromCells: const ['lastName', 'firstName']),
  ],
  cells: [
    const VtCellDef(
        key: 'lastName', label: LocalizedText(fr: 'Nom', en: 'Last name'), kind: VtCellKind.text),
    const VtCellDef(
        key: 'firstName',
        label: LocalizedText(fr: 'Prénom', en: 'First name'),
        kind: VtCellKind.text),
    const VtCellDef(
        key: 'sex',
        label: LocalizedText(fr: 'Sexe', en: 'Sex'),
        kind: VtCellKind.radioCode,
        options: vtSexOptions),
    const VtCellDef(
        key: 'trainerStatus',
        label: LocalizedText(fr: 'Statut', en: 'Status'),
        kind: VtCellKind.radioCode,
        options: vtTrainerStatusOptions),
    const VtCellDef(
        key: 'isAdminPersonnel',
        label: LocalizedText(fr: 'Personnel administratif', en: 'Administrative staff'),
        kind: VtCellKind.boolean),
    VtCellDef(
        key: 'academicDiploma',
        label: const LocalizedText(fr: 'Diplôme académique', en: 'Academic diploma'),
        kind: VtCellKind.radioCode,
        options: vtAcademicDiplomaOptions),
    VtCellDef(
        key: 'professionalDiploma',
        label: const LocalizedText(fr: 'Diplôme professionnel', en: 'Vocational diploma'),
        kind: VtCellKind.radioCode,
        options: vtProfessionalDiplomaOptions),
  ],
);

// ─────────────────────────────────────────────────────────────
// 7.1.3 — five stakeholder rows, each a single Oui/Non toggle.
//
// The printed form has no channel-selection list at all — confirmed
// during the VT verification pass (two independent extractions of the
// PDF text, both showing exactly one "Oui / Yes  Non / No" pair per
// stakeholder row, no channel headers, no channel options anywhere on
// the page). So this is not a checkbox/multi-select field despite the
// existing `String[]` column shape — it's a plain per-row Boolean.
//
// All five rows already have a persisted OnefopVocationalTrainingDetail
// column (pupilsCommsChannels / teachingStaffCommsChannels /
// nonTeachingStaffCommsChannels / parentsCommsChannels /
// schoolCouncilCommsChannels, all String[]) — none need the "no
// persisted field, render disabled" fallback this batch's instructions
// allowed for.
//
// Reusing the existing String[] column without a schema/migration change
// (explicitly out of scope this pass): 'informed' (a real one-element
// array) = Oui, 'not_informed' = Non, [] = never answered — three
// distinguishable states from two sentinel strings, so "Non" and
// "unanswered" don't collapse into the same value the way a naive
// true/false-only encoding would. These sentinels are answer markers,
// not channel names — they don't touch VT-2's "channel vocabulary not
// invented" decision, which was specifically about *how* someone was
// informed, not *whether*.
final VtTableDef vt713CommsInformedTableDef = VtTableDef(
  prefix: 'vt713',
  paperCode: '7.1.3',
  // PDF-confirmed (p.14) intro sentence for this table, restored here
  // rather than the earlier short gloss:
  title: const LocalizedText(
      fr: "Si oui, veuillez indiquer, parmi les parties prenantes de "
          "votre établissement ci-dessous, celles qui ont été informées "
          "des mesures et préciser le mode de communication utilisé pour "
          "chaque catégorie au cours de l'année scolaire",
      en: "If yes, indicate which stakeholders were informed this "
          "school year and the channel used"),
  progressNoun: const LocalizedText(fr: 'catégories', en: 'categories'),
  singleCellPerRow: true,
  rows: const [
    VtRowDef(id: 'VT7_7', fixedLabel: LocalizedText(fr: 'Élèves', en: 'Pupils')),
    VtRowDef(
        id: 'VT7_8',
        fixedLabel: LocalizedText(fr: 'Personnel Enseignant', en: 'Teaching Staff')),
    VtRowDef(
        id: 'VT7_9',
        fixedLabel:
            LocalizedText(fr: 'Personnel Non Enseignant', en: 'Non-Teaching Staff')),
    VtRowDef(
        id: 'VT7_10',
        fixedLabel: LocalizedText(fr: 'Parents/Tuteurs', en: 'Parents/Guardians')),
    VtRowDef(
        id: 'VT7_11',
        fixedLabel:
            LocalizedText(fr: "Conseil d'établissement", en: 'School Council')),
  ],
  cells: [
    VtCellDef(
      key: 'informed',
      label: const LocalizedText(fr: 'Informé(e) des mesures ?', en: 'Informed of the measures?'),
      kind: VtCellKind.boolean,
      encodeBoolean: (v) => v ? const ['informed'] : const ['not_informed'],
      decodeBoolean: (stored) {
        if (stored is List && stored.contains('informed')) return true;
        if (stored is List && stored.contains('not_informed')) return false;
        return null;
      },
    ),
  ],
);

// ─────────────────────────────────────────────────────────────
// Dispatch — tableSpec['template'] (+ prefix) → VtTableDef
// ─────────────────────────────────────────────────────────────

/// Returns null for any VT template/prefix not wired yet — the field then
/// falls through to whatever it renders today (nothing). As of batch 3, all
/// 22 VT table fields (4.1–4.11, 5.2–5.4, 6.3, 8.1–8.4, 8.6–8.8) are wired.
/// The checkbox-shaped fields (§2/§3/§6/§9 multi-select questions) are a
/// separate gap, unrelated to this dispatcher — see CheckboxGroupField in
/// onefop_form_widgets.dart.
VtTableDef? vtTableDefFor(String template, Map<String, dynamic> spec) {
  final prefix = (spec['prefix'] as String? ?? '').toLowerCase();
  switch (template) {
    case 'vt_trainee_age_flow_table':
      if (prefix == 's4q7') {
        return vtTraineeAgeFlowTableDef(prefix: prefix, paperCode: '4.7');
      }
      return null;
    case 'vt_education_level_flow_table':
      if (prefix == 's4q8') {
        return vtFlowCategoryTotalTableDef(
          prefix: prefix,
          paperCode: '4.8',
          title: const LocalizedText(
              fr: "Effectifs par niveau d'études à l'entrée",
              en: 'Number of trainees by level of education at entry'),
          categoryRows: vtEducationLevelRows,
        );
      }
      return null;
    case 'vt_vulnerable_table':
      if (prefix == 's4q9') {
        return vtFlowCategoryTotalTableDef(
          prefix: prefix,
          paperCode: '4.9',
          title: const LocalizedText(
              fr: 'Effectifs des personnes socialement vulnérables',
              en: 'Number of socially vulnerable trainees'),
          categoryRows: vtVulnerableCategoryRows,
        );
      }
      return null;
    case 'vt_scholarship_table':
      if (prefix == 's4q11') {
        return vtScholarshipTableDef(prefix: prefix, paperCode: '4.11');
      }
      return null;
    case 'vt_curriculum_table':
      if (prefix == 's5q2') {
        return vtCurriculumTableDef(prefix: prefix, paperCode: '5.2');
      }
      return null;
    case 'vt_infrastructure_table':
      if (prefix == 's5q3') {
        return vtInfrastructureTableDef(prefix: prefix, paperCode: '5.3');
      }
      return null;
    case 'vt_furniture_table':
      if (prefix == 's5q4') {
        return vtFurnitureTableDef(prefix: prefix, paperCode: '5.4');
      }
      return null;
    case 'vt_trainer_age_table':
      if (prefix == 's8q3') {
        return vtTrainerAgeTableDef(prefix: prefix, paperCode: '8.3');
      }
      return null;
    case 'vt_trainer_disability_table':
      if (prefix == 's8q6') {
        return vtTrainerDisabilityTableDef(prefix: prefix, paperCode: '8.6');
      }
      return null;
    case 'vt_diploma_table':
      switch (prefix) {
        case 's4q1':
          return vtDiplomaTableDef(
            prefix: prefix,
            paperCode: '4.1',
            title: const LocalizedText(
                fr: 'Apprenants par diplôme académique', en: 'Trainees by academic diploma'),
            diplomaRows: vtAcademicDiplomaRows,
          );
        case 's4q2':
          return vtDiplomaTableDef(
            prefix: prefix,
            paperCode: '4.2',
            title: const LocalizedText(
                fr: 'Apprenants par diplôme professionnel',
                en: 'Trainees by vocational diploma'),
            diplomaRows: vtProfessionalDiplomaRows,
          );
        case 's8q1':
          return vtDiplomaTableDef(
            prefix: prefix,
            paperCode: '8.1',
            title: const LocalizedText(
                fr: 'Formateurs par diplôme académique', en: 'Trainers by academic diploma'),
            diplomaRows: vtAcademicDiplomaRows,
          );
        case 's8q2':
          return vtDiplomaTableDef(
            prefix: prefix,
            paperCode: '8.2',
            title: const LocalizedText(
                fr: 'Formateurs par diplôme professionnel',
                en: 'Trainers by vocational diploma'),
            diplomaRows: vtProfessionalDiplomaRows,
          );
      }
      return null;
    case 'vt_specialty_fi_fc_table':
      switch (prefix) {
        case 's4q3':
          return vtSpecialtyFiFcTableDef(
            prefix: prefix,
            paperCode: '4.3',
            title: const LocalizedText(
                fr: 'Apprenants non occupés par spécialité',
                en: 'Not-working-age trainees by specialty'),
          );
        case 's4q4':
          return vtSpecialtyFiFcTableDef(
            prefix: prefix,
            paperCode: '4.4',
            title: const LocalizedText(
                fr: 'Apprenants du secteur informel par spécialité',
                en: 'Informal-sector trainees by specialty'),
          );
        case 's4q5':
          return vtSpecialtyFiFcTableDef(
            prefix: prefix,
            paperCode: '4.5',
            title: const LocalizedText(
                fr: 'Apprenants par spécialité', en: 'Trainees by specialty'),
          );
        case 's8q4':
          return vtSpecialtyFiFcTableDef(
            prefix: prefix,
            paperCode: '8.4',
            rows: 10,
            title: const LocalizedText(
                fr: 'Formateurs par spécialité', en: 'Trainers by specialty'),
          );
      }
      return null;
    case 'vt_specialty_year_table':
      if (prefix == 's4q6') {
        return vtSpecialtyYearTableDef(
          prefix: prefix,
          paperCode: '4.6',
          title: const LocalizedText(
              fr: 'Apprenants par spécialité, 1ère/2ème année (FI)',
              en: 'Trainees by specialty, year 1/2 (Initial Training)'),
        );
      }
      return null;
    case 'vt_specialty_gender_total_table':
      switch (prefix) {
        case 's4q10':
          return vtSpecialtyGenderTotalTableDef(
            prefix: prefix,
            paperCode: '4.10',
            title: const LocalizedText(
                fr: 'Sortants par spécialité (année antérieure)',
                en: 'Leavers by specialty (previous year)'),
          );
        case 's6q3':
          return vtSpecialtyGenderTotalTableDef(
            prefix: prefix,
            paperCode: '6.3',
            title: const LocalizedText(
                fr: 'Sortants insérés par spécialité (année antérieure)',
                en: 'Integrated leavers by specialty (previous year)'),
          );
      }
      return null;
    case 'vt_specialty_fi_fc_count_table':
      if (prefix == 's8q7') {
        return vtSpecialtyFiFcCountTableDef(
          prefix: prefix,
          paperCode: '8.7',
          title: const LocalizedText(
              fr: "Capacité d'accueil par spécialité", en: 'Hosting capacity by specialty'),
        );
      }
      return null;
    case 'vt_trainer_roster_table':
      return vtTrainerRosterTableDef;
  }
  return null; // every other VT template — later milestones
}
