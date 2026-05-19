// lib/core/focus/renderers/table_spec_builder.dart
//
// ══════════════════════════════════════════════════════════════
// TABLE SPEC BUILDER
//
// Converts a template name + prefix into a GridRenderSpec that
// GenericSpreadsheetTable renders pixel-perfectly.
//
// CHANGES:
//   • S22Q05 now uses 'vulnerable_named_rows_table' for ALL
//     entity types (cooperative, CTD, ONG, enterprise).
//     The row labels are:
//       Déplacés internes / Internal displaced
//       Réfugiés / Refugees
//       Orphelins / Orphans
//     The CSP-row variant ('vulnerable_csp_rows_table') has been
//     removed — it was incorrect per the official ONEFOP PDFs.
//
//   • S23Q02 now has a leading "Statut / Status" grouped column
//     whose two sub-headers are:
//       Permanent / Permanent
//       Temporaire / Temporary
//     matching the official PDF layout exactly (both FR and EN).
//
//   • Corner labels match the official ONEFOP PDF exactly,
//     table by table:
//
//     Template                    cornerLabel / cornerLabel2
//     ──────────────────────────────────────────────────────
//     csp_gender_age_table        "Sexe / Sex" /
//     (S21Q01, S22Q01, S22Q02,    "Tranche d'âge (ans) /
//      S23Q01)                     Age group (years)"
//
//     diploma_gender_age_table    "Sexe / Sex" /
//     (S22Q03)                    "Tranche d'âge (ans) /
//                                  Age group (years)"
//
//     csp_status_gender_table /   "CSP / SPC"
//     disability_table (S22Q04)   (single merged — top header
//                                  = Permanent/Temporary/Total)
//
//     vulnerable_named_rows_table "Nature de vulnérabilité /
//     (S22Q05 — ALL entity types)  Nature of vulnerability"
//     Rows: Déplacés internes / Réfugiés / Orphelins
//
//     first_time_workers_table    "Statut / Status" (leading col)
//     (S23Q02)                    sub-headers: Permanent |
//                                 Temporaire; then "Sexe / Sex" /
//                                 "Tranche d'âge / Age group"
//
//     departure_table (S3Q01)     "CSP / SPC"
//
//     dismissal_unemployment_     "CSP / SPC"
//     table (S3Q03)
//
//     internship_table (S4Q01)    "Nature du stage /
//                                  Nature of internship"
//
//     reasons_table  (S3Q02)      "Motif / Reason"
//
//     skills_table   (S4Q02)      "Compétence / Skill"
//
//     training_table (S4Q03)      "Domaine de formation /
//                                  Domain of training"
//
//   • Third CSP row label:
//     "Agents d'exécution / Field workers"
// ══════════════════════════════════════════════════════════════

import 'grid_render_spec.dart';
import 'grid_theme.dart';

class TableSpecBuilder {
  TableSpecBuilder._();

  static GridRenderSpec build({
    required String template,
    required String prefix,
    required Map<String, int> gridValues,
    required void Function(String, int) onCellChanged,
    required String entityType,
  }) {
    switch (template) {
      // ── S21Q01, S22Q01, S22Q02, S23Q01 ───────────────────────
      case 'csp_gender_age_table':
      case 'csp_table':
        return _buildCspGenderAge(prefix);

      // ── S22Q03 ────────────────────────────────────────────────
      case 'diploma_gender_age_table':
      case 'diploma_table':
        return _buildDiploma(prefix);

      // ── S22Q04 ────────────────────────────────────────────────
      case 'csp_status_gender_table':
      case 'disability_table':
        return _buildCspStatusGender(prefix);

      // ── S22Q05 — ALL entity types use named vulnerability rows ─
      // The CSP-row variant was incorrect; all official PDFs
      // (cooperative, CTD, ONG, enterprise) use the three named
      // rows: Déplacés internes / Réfugiés / Orphelins.
      case 'vulnerable_table':
      case 'vulnerable_named_rows_table':
        return _buildVulnerableNamedRows(prefix);

      // ── S3Q01 ─────────────────────────────────────────────────
      case 'departure_table':
        return _buildDeparture(prefix);

      // ── S3Q03 ─────────────────────────────────────────────────
      case 'dismissal_unemployment_table':
        return _buildDismissalUnemployment(prefix);

      // ── S23Q02 ────────────────────────────────────────────────
      case 'first_time_workers_table':
        return _buildFirstTimeWorkers(prefix);

      // ── S4Q01 ─────────────────────────────────────────────────
      case 'internship_table':
        return _buildInternship(prefix);

      // ── S3Q02 ─────────────────────────────────────────────────
      case 'reasons_table':
        return _buildReasons(prefix);

      // ── S4Q02 ─────────────────────────────────────────────────
      case 'skills_table':
        return _buildSkills(prefix);

      // ── S4Q03 ─────────────────────────────────────────────────
      case 'training_table':
        return _buildTraining(prefix);

      default:
        return GridRenderSpec(
          id: prefix,
          headers: const [],
          rowLabels: const [],
        );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SHARED CONSTANTS
  // ─────────────────────────────────────────────────────────────

  /// Standard CSP data-row keys (all tables that use CSP rows).
  static const _cspDataRows = ['cadres', 'foremen', 'workers'];

  /// Standard CSP display labels — corrected to match PDF wording.
  /// Third row: "Agents d'exécution / Field workers" (not "Ouvriers").
  static const _cspRowLabels = [
    'Cadres / Executives',
    'Agents de Maîtrise / Foremen',
    "Agents d'exécution / Field workers",
    'Total',
  ];

  // ─────────────────────────────────────────────────────────────
  // SHARED HELPERS
  // ─────────────────────────────────────────────────────────────

  static bool _isTotal(String id) => id.contains('_total');

  static CellSpec _cell(String id) => CellSpec(
        id: id,
        type: CellType.number,
        editable: !_isTotal(id),
        backgroundColor: _isTotal(id) ? GridTheme.totalBg : null,
        textStyle: _isTotal(id) ? GridTheme.totalStyle : GridTheme.dataStyle,
      );

  // ── Header trees ─────────────────────────────────────────────

  /// Two-level gender × age headers.
  /// Top  : Homme/Male | Femme/Female | Total
  /// Sub  : 15–24 | 25–34 | 35+ | Total  (per gender group)
  /// Used by: S21Q01, S22Q01, S22Q02, S22Q03, S23Q01, S23Q02.
  static List<HeaderNode> _genderAgeHeaders() {
    const ages = ['15–24', '25–34', '35+', 'Total'];
    return [
      HeaderNode('Homme / Male',
          children: [for (final a in ages) HeaderNode(a)]),
      HeaderNode('Femme / Female',
          children: [for (final a in ages) HeaderNode(a)]),
      HeaderNode('Total', children: [for (final a in ages) HeaderNode(a)]),
    ];
  }

  /// Single-level gender-only headers.
  /// Row: Homme/Male | Femme/Female | Total
  /// Used by: S4Q01, S3Q02, S4Q02, S4Q03.
  static List<HeaderNode> _genderOnlyHeaders() => const [
        HeaderNode('Homme / Male'),
        HeaderNode('Femme / Female'),
        HeaderNode('Total'),
      ];

  /// Two-level status × gender headers.
  /// Top : Permanent | Temporaire | Total
  /// Sub : Homme/Male | Femme/Female | Total  (per status group)
  /// Used by: S22Q04, S22Q05.
  static List<HeaderNode> _statusGenderHeaders() => [
        for (final s in [
          'Permanent / Permanent',
          'Temporaire / Temporary',
          'Total',
        ])
          HeaderNode(s, children: const [
            HeaderNode('Homme / Male'),
            HeaderNode('Femme / Female'),
            HeaderNode('Total'),
          ]),
      ];

  // ── Cell-id builders ─────────────────────────────────────────

  /// Gender-only cell ids: {prefix}_{rowKey}_{male|female|total}
  static List<String> _genderRow(String prefix, String rowKey) =>
      ['male', 'female', 'total'].map((g) => '${prefix}_${rowKey}_$g').toList();

  /// Gender × age cell ids (12 per row: 3 genders × (3 ages + total)).
  static List<String> _genderAgeRow(String prefix, String rowKey) {
    final ids = <String>[];
    for (final g in ['male', 'female', 'total']) {
      for (final age in ['15_24', '25_34', '35_plus']) {
        ids.add('${prefix}_${rowKey}_${g}_$age');
      }
      ids.add('${prefix}_${rowKey}_${g}_total');
    }
    return ids;
  }

  /// Status × gender cell ids (9 per row: 3 statuses × 3 genders).
  static List<String> _statusGenderRow(String prefix, String rowKey) => [
        for (final s in ['permanent', 'temporary', 'total'])
          for (final g in ['male', 'female', 'total'])
            '${prefix}_${rowKey}_${s}_$g',
      ];

  // ─────────────────────────────────────────────────────────────
  // S21Q01 / S22Q01 / S22Q02 / S23Q01
  // CSP × GENDER × AGE
  //
  // PDF corner (two-row split):
  //   row 0 → "Sexe / Sex"
  //   row 1 → "Tranche d'âge (ans) / Age group (years)"
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildCspGenderAge(String prefix) {
    final matrix = [
      for (final r in _cspDataRows) _genderAgeRow(prefix, r),
      _genderAgeRow(prefix, 'total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: _cspRowLabels,
      matrix: matrix,
      headers: _genderAgeHeaders(),
      cornerLabel: 'Sexe / Sex',
      cornerLabel2: "Tranche d'âge (ans) / Age group (years)",
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S22Q03
  // DIPLOMA × GENDER × AGE
  //
  // PDF corner (two-row split):
  //   row 0 → "Sexe / Sex"
  //   row 1 → "Tranche d'âge (ans) / Age group (years)"
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildDiploma(String prefix) {
    const dataRows = [
      'cep',
      'bepc',
      'probatoire',
      'bac',
      'bts',
      'licence',
      'maitrise',
      'master',
      'dqp',
      'cqp',
      'autres',
      'sans_diplome',
    ];
    const labels = [
      'CEP / CEPE / FSLC',
      'BEPC / CAP / GCE-OL',
      'Probatoire / Lower sixth',
      'BAC / GCE-AL',
      'BTS / DUT / HND',
      'Licence (Bac+3) / Bachelor',
      'Maîtrise (Bac+4) / Master 1',
      'Master (Bac+5) / Master 2',
      'DQP / PQD',
      'CQP / CPQ',
      'Autres / Others',
      'Sans diplôme / Without diploma',
      'Total',
    ];

    final matrix = [
      for (final r in dataRows) _genderAgeRow(prefix, r),
      _genderAgeRow(prefix, 'total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: labels,
      matrix: matrix,
      headers: _genderAgeHeaders(),
      cornerLabel: 'Sexe / Sex',
      cornerLabel2: "Tranche d'âge (ans) / Age group (years)",
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S22Q04
  // CSP × STATUS × GENDER  (disability / handicap)
  //
  // PDF corner: single merged "CSP / SPC"
  // Top header row = Permanent / Temporary / Total (not "Sexe/Sex")
  // → no split corner needed.
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildCspStatusGender(String prefix) {
    final matrix = [
      for (final r in _cspDataRows) _statusGenderRow(prefix, r),
      _statusGenderRow(prefix, 'total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: _cspRowLabels,
      matrix: matrix,
      headers: _statusGenderHeaders(),
      cornerLabel: 'CSP / SPC',
      // No cornerLabel2 — single merged corner matches the PDF.
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S22Q05  —  ALL entity types (cooperative, CTD, ONG, enterprise)
  // VULNERABLE (named rows) × STATUS × GENDER
  //
  // FIX: All official ONEFOP PDFs use the three named vulnerability
  // rows below — NOT CSP rows. The cooperative/CTD/ONG forms
  // previously (incorrectly) showed Cadres/AM/AE; corrected here.
  //
  // PDF corner: single merged
  //   "Nature de vulnérabilité / Nature of vulnerability"
  // Rows: Déplacés internes | Réfugiés | Orphelins
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildVulnerableNamedRows(String prefix) {
    const dataRows = ['deplaces_internes', 'refugies', 'orphelins'];
    const rowLabels = [
      'Déplacés internes / Internal displaced',
      'Réfugiés / Refugees',
      'Orphelins / Orphans',
      'Total',
    ];

    final matrix = [
      for (final r in dataRows) _statusGenderRow(prefix, r),
      _statusGenderRow(prefix, 'total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: rowLabels,
      matrix: matrix,
      headers: _statusGenderHeaders(),
      cornerLabel: 'Nature de vulnérabilité / Nature of vulnerability',
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S3Q01
  // DEPARTURE TYPE × CSP × GENDER
  //
  // PDF corner: single merged "CSP / SPC"
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildDeparture(String prefix) {
    const types = [
      'dismissal',
      'resignation',
      'retirement',
      'other',
      'ensemble',
    ];
    const typeLabels = [
      'Licenciements / Dismissal',
      'Démissions / Resignation',
      'Départ à la retraite / Retirement',
      'Autres départs / Other departure',
      'Ensemble / Whole',
    ];

    List<String> typeGenderRow(String rowKey) => [
          for (final t in types)
            for (final g in ['male', 'female', 'total'])
              '${prefix}_${rowKey}_${t}_$g',
        ];

    final matrix = [
      for (final r in _cspDataRows) typeGenderRow(r),
      typeGenderRow('total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: _cspRowLabels,
      matrix: matrix,
      headers: [
        for (final tl in typeLabels)
          HeaderNode(tl, children: const [
            HeaderNode('Homme / Male'),
            HeaderNode('Femme / Female'),
            HeaderNode('Total'),
          ]),
      ],
      cornerLabel: 'CSP / SPC',
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S3Q03
  // DISMISSAL / TECHNICAL UNEMPLOYMENT × CSP × GENDER
  //
  // PDF corner: single merged "CSP / SPC"
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildDismissalUnemployment(String prefix) {
    const types = ['dismissal', 'technical_unemployment', 'total'];
    const typeLabels = [
      'Licenciement / Dismissal',
      'Chômage technique / Technical unemployment',
      'Total',
    ];

    List<String> typeGenderRow(String rowKey) => [
          for (final t in types)
            for (final g in ['male', 'female', 'total'])
              '${prefix}_${rowKey}_${t}_$g',
        ];

    final matrix = [
      for (final r in _cspDataRows) typeGenderRow(r),
      typeGenderRow('total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: _cspRowLabels,
      matrix: matrix,
      headers: [
        for (final tl in typeLabels)
          HeaderNode(tl, children: const [
            HeaderNode('Homme / Male'),
            HeaderNode('Femme / Female'),
            HeaderNode('Total'),
          ]),
      ],
      cornerLabel: 'CSP / SPC',
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S23Q02
  // FIRST-TIME WORKERS × STATUT × CSP × GENDER × AGE
  //
  // FIX: The official PDF has a leading "Statut / Status" column
  // as the very first header column, spanning the full row height,
  // with two visible sub-row groups:
  //   • Permanent / Permanent  (rows: Cadres, AM, AE, Total)
  //   • Temporaire / Temporary (rows: Cadres, AM, AE, Total)
  // followed by a grand TOTAL row.
  //
  // This is modelled here as a leading grouped column header:
  //   leadingGroupHeader: 'Statut / Status'
  //   leadingGroupLabels: ['Permanent / Permanent',
  //                        'Temporaire / Temporary']
  //
  // The remaining column headers are the standard gender × age tree:
  //   cornerLabel  → "Sexe / Sex"
  //   cornerLabel2 → "Tranche d'âge / Age group"
  //   (PDF uses the shorter form without "(ans)" for this table)
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildFirstTimeWorkers(String prefix) {
    const contracts = ['permanent', 'temporary'];

    // Leading group labels: French on first line, English on second.
    // '\n' produces a real line-break inside the merged vertical cell.
    const contractLabels = [
      'Permanent\nPermanent',
      'Temporaire\nTemporary',
    ];

    // Row labels: French on first line, English on second.
    const cspSubLabels = [
      'Cadres\nExecutives',
      'Agents de Maîtrise\nForemen',
      "Agents d'exécution\nField workers",
    ];

    final matrix = <List<String>>[];
    final rowLabels = <String>[];

    for (int ci = 0; ci < contracts.length; ci++) {
      final c = contracts[ci];
      for (int ri = 0; ri < _cspDataRows.length; ri++) {
        matrix.add(_genderAgeRow(prefix, '${c}_${_cspDataRows[ri]}'));
        rowLabels.add(cspSubLabels[ri]);
      }
      // Sub-total row per contract status.
      matrix.add(_genderAgeRow(prefix, '${c}_total'));
      rowLabels.add('Total');
    }
    // ── No grand-total row — removed per official PDF layout ──

    return GridRenderSpec(
      id: prefix,
      rowLabels: rowLabels,
      matrix: matrix,
      headers: _genderAgeHeaders(),
      // Leading "Statut" column — FR\nEN stacked.
      leadingGroupHeader: 'Statut\nStatus',
      leadingGroupLabels: contractLabels,
      // Each group = 3 CSP rows + 1 sub-total = 4 rows.
      leadingGroupRowCounts: [
        _cspDataRows.length + 1, // 4  (Permanent group)
        _cspDataRows.length + 1, // 4  (Temporary group)
      ],
      leadingGroupColWidth: GridTheme.leadingGroupColWidth,
      // Corner of the data section (right of Statut column).
      // PDF uses the shorter form without "(ans)" here.
      cornerLabel: 'Sexe / Sex',
      cornerLabel2: "Tranche d'âge / Age group",
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S4Q01
  // INTERNSHIP TYPE × GENDER  (no age dimension)
  //
  // PDF corner: single merged
  //   "Nature du stage / Nature of internship"
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildInternship(String prefix) {
    const dataRows = ['vacation', 'academic', 'professional', 'pre_employment'];
    const labels = [
      'Stage de vacance / Holiday jobs',
      'Stage académique / Academic internship',
      'Stage professionnel / Professional internship',
      'Stage pré-emploi / Pre-work internship',
      'Total',
    ];

    final matrix = [
      for (final r in dataRows) _genderRow(prefix, r),
      _genderRow(prefix, 'total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: labels,
      matrix: matrix,
      headers: _genderOnlyHeaders(),
      cornerLabel: 'Nature du stage / Nature of internship',
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S3Q02
  // DISMISSAL REASONS × GENDER
  //
  // PDF corner: single merged "Motif / Reason"
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildReasons(String prefix) {
    const dataRows = ['reason_1', 'reason_2', 'reason_3'];
    const labels = [
      'Motif 1 / Reason 1',
      'Motif 2 / Reason 2',
      'Motif 3 / Reason 3',
      'Total',
    ];

    final matrix = [
      for (final r in dataRows) _genderRow(prefix, r),
      _genderRow(prefix, 'total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: labels,
      matrix: matrix,
      headers: _genderOnlyHeaders(),
      cornerLabel: 'Motif / Reason',
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S4Q02
  // SKILL NEEDS × GENDER
  //
  // PDF corner: single merged "Compétence / Skill"
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildSkills(String prefix) {
    const dataRows = ['skill_1', 'skill_2', 'skill_3'];
    const labels = [
      'Compétence 1 / Skill 1',
      'Compétence 2 / Skill 2',
      'Compétence 3 / Skill 3',
      'Total',
    ];

    final matrix = [
      for (final r in dataRows) _genderRow(prefix, r),
      _genderRow(prefix, 'total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: labels,
      matrix: matrix,
      headers: _genderOnlyHeaders(),
      cornerLabel: 'Compétence / Skill',
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S4Q03
  // TRAINING DOMAIN NEEDS × GENDER
  //
  // PDF corner: single merged
  //   "Domaine de formation / Domain of training"
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildTraining(String prefix) {
    const dataRows = ['domain_1', 'domain_2', 'domain_3'];
    const labels = [
      'Domaine 1 / Domain 1',
      'Domaine 2 / Domain 2',
      'Domaine 3 / Domain 3',
      'Total',
    ];

    final matrix = [
      for (final r in dataRows) _genderRow(prefix, r),
      _genderRow(prefix, 'total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: labels,
      matrix: matrix,
      headers: _genderOnlyHeaders(),
      cornerLabel: 'Domaine de formation / Domain of training',
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }
}
