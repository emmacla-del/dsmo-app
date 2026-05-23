// lib/core/focus/renderers/table_spec_builder.dart

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
      case 'csp_gender_age_table':
      case 'csp_table':
        return _buildCspGenderAge(prefix);

      case 'diploma_gender_age_table':
      case 'diploma_table':
        return _buildDiploma(prefix);

      case 'csp_status_gender_table':
      case 'disability_table':
        return _buildCspStatusGender(prefix);

      case 'vulnerable_table':
      case 'vulnerable_named_rows_table':
        return _buildVulnerableNamedRows(prefix);

      case 'departure_table':
        return _buildDeparture(prefix);

      case 'dismissal_unemployment_table':
        return _buildDismissalUnemployment(prefix);

      case 'first_time_workers_table':
        return _buildFirstTimeWorkers(prefix);

      case 'internship_table':
        return _buildInternship(prefix);

      case 'reasons_table':
        return _buildReasons(prefix);

      case 'skills_table':
        return _buildSkills(prefix);

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

  static const _cspDataRows = ['cadres', 'foremen', 'workers'];

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

  static List<HeaderNode> _genderOnlyHeadersShort() => const [
        HeaderNode('M'),
        HeaderNode('F'),
        HeaderNode('Total'),
      ];

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

  static List<String> _genderRow(String prefix, String rowKey) =>
      ['male', 'female', 'total'].map((g) => '${prefix}_${rowKey}_$g').toList();

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

  static List<String> _statusGenderRow(String prefix, String rowKey) => [
        for (final s in ['permanent', 'temporary', 'total'])
          for (final g in ['male', 'female', 'total'])
            '${prefix}_${rowKey}_${s}_$g',
      ];

  // ─────────────────────────────────────────────────────────────
  // S21Q01 / S22Q01 / S22Q02 / S23Q01
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
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S22Q05
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
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildDeparture(String prefix) {
    const types = [
      'dismissal',
      'resignation',
      'retirement',
      'other',
      'ensemble'
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
            HeaderNode('M'),
            HeaderNode('F'),
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
            HeaderNode('M'),
            HeaderNode('F'),
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
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildFirstTimeWorkers(String prefix) {
    const contracts = ['permanent', 'temporary'];
    const contractLabels = [
      'Permanent\nPermanent',
      'Temporaire\nTemporary',
    ];
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
      matrix.add(_genderAgeRow(prefix, '${c}_total'));
      rowLabels.add('Total');
    }
    return GridRenderSpec(
      id: prefix,
      rowLabels: rowLabels,
      matrix: matrix,
      headers: _genderAgeHeaders(),
      leadingGroupHeader: 'Statut\nStatus',
      leadingGroupLabels: contractLabels,
      leadingGroupRowCounts: [
        _cspDataRows.length + 1,
        _cspDataRows.length + 1,
      ],
      leadingGroupColWidth: GridTheme.leadingGroupColWidth,
      cornerLabel: 'Sexe / Sex',
      cornerLabel2: "Tranche d'âge / Age group",
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S4Q01
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
      headers: _genderOnlyHeadersShort(),
      cornerLabel: 'Nature du stage / Nature of internship',
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S3Q02 — editable first column (reasons)
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildReasons(String prefix) {
    const dataRows = ['reason_1', 'reason_2', 'reason_3'];
    const labels = [
      'Motif 1 / Reason 1',
      'Motif 2 / Reason 2',
      'Motif 3 / Reason 3',
      'Total',
    ];
    // One hint per row — matches the specific row number.
    const hints = [
      'Motif 1 / Reason 1',
      'Motif 2 / Reason 2',
      'Motif 3 / Reason 3',
    ];

    final matrix = [
      for (final r in dataRows) _genderRow(prefix, r),
      _genderRow(prefix, 'total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: labels,
      matrix: matrix,
      headers: _genderOnlyHeadersShort(),
      cornerLabel: 'Motif / Reason',
      isTotalCell: _isTotal,
      firstColWidthOverride: 220,
      rowLabelCellIds: [
        for (final r in dataRows) '${prefix}_${r}_label',
        '', // total row — static, not editable
      ],
      cellSpec: (id) {
        if (id.endsWith('_label')) {
          final idx = dataRows.indexWhere((r) => id.contains(r));
          return CellSpec(
            id: id,
            type: CellType.text,
            editable: true,
            hint: idx >= 0 ? hints[idx] : 'Motif / Reason',
          );
        }
        return _cell(id);
      },
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S4Q02 — editable first column (skills)
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildSkills(String prefix) {
    const dataRows = ['skill_1', 'skill_2', 'skill_3'];
    const labels = [
      'Compétence 1 / Skill 1',
      'Compétence 2 / Skill 2',
      'Compétence 3 / Skill 3',
      'Total',
    ];
    // One hint per row — matches the specific row number.
    const hints = [
      'Compétence 1 / Skill 1',
      'Compétence 2 / Skill 2',
      'Compétence 3 / Skill 3',
    ];

    final matrix = [
      for (final r in dataRows) _genderRow(prefix, r),
      _genderRow(prefix, 'total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: labels,
      matrix: matrix,
      headers: _genderOnlyHeadersShort(),
      cornerLabel: 'Compétence / Skill',
      isTotalCell: _isTotal,
      firstColWidthOverride: 220,
      rowLabelCellIds: [
        for (final r in dataRows) '${prefix}_${r}_label',
        '', // total row — static, not editable
      ],
      cellSpec: (id) {
        if (id.endsWith('_label')) {
          final idx = dataRows.indexWhere((r) => id.contains(r));
          return CellSpec(
            id: id,
            type: CellType.text,
            editable: true,
            hint: idx >= 0 ? hints[idx] : 'Compétence / Skill',
          );
        }
        return _cell(id);
      },
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S4Q03 — editable first column (training domains)
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildTraining(String prefix) {
    const dataRows = ['domain_1', 'domain_2', 'domain_3'];
    const labels = [
      'Domaine 1 / Domain 1',
      'Domaine 2 / Domain 2',
      'Domaine 3 / Domain 3',
      'Total',
    ];
    // One hint per row — matches the specific row number.
    const hints = [
      'Domaine 1 / Domain 1',
      'Domaine 2 / Domain 2',
      'Domaine 3 / Domain 3',
    ];

    final matrix = [
      for (final r in dataRows) _genderRow(prefix, r),
      _genderRow(prefix, 'total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: labels,
      matrix: matrix,
      headers: _genderOnlyHeadersShort(),
      cornerLabel: 'Domaine de formation / Domain of training',
      firstColWidthOverride: 220,
      isTotalCell: _isTotal,
      rowLabelCellIds: [
        for (final r in dataRows) '${prefix}_${r}_label',
        '', // total row — static, not editable
      ],
      cellSpec: (id) {
        if (id.endsWith('_label')) {
          final idx = dataRows.indexWhere((r) => id.contains(r));
          return CellSpec(
            id: id,
            type: CellType.text,
            editable: true,
            hint: idx >= 0
                ? hints[idx]
                : 'Domaine de formation / Domain of training',
          );
        }
        return _cell(id);
      },
    );
  }
}
