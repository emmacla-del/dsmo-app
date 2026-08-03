// lib/core/focus/renderers/table_spec_builder.dart

import 'package:flutter/widgets.dart' show Locale;

import '../../i18n/localized_text.dart';
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
    required Locale locale,
  }) {
    switch (template) {
      case 'csp_gender_age_table':
      case 'csp_table':
        return _buildCspGenderAge(prefix, locale);

      case 'diploma_gender_age_table':
      case 'diploma_table':
        return _buildDiploma(prefix, locale);

      case 'csp_status_gender_table':
      case 'disability_table':
        return _buildCspStatusGender(prefix, locale);

      case 'vulnerable_table':
      case 'vulnerable_named_rows_table':
        return _buildVulnerableNamedRows(prefix, locale);

      case 'departure_table':
        return _buildDeparture(prefix, locale);

      case 'dismissal_unemployment_table':
        return _buildDismissalUnemployment(prefix, locale);

      case 'first_time_workers_table':
        return _buildFirstTimeWorkers(prefix, locale);

      case 'internship_table':
        return _buildInternship(prefix, locale);

      case 'reasons_table':
        return _buildReasons(prefix, locale);

      case 'skills_table':
        return _buildSkills(prefix, locale);

      case 'training_table':
        return _buildTraining(prefix, locale);

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

  static const _cspRowLabelsI18n = [
    LocalizedText(fr: 'Cadres', en: 'Executives'),
    LocalizedText(fr: 'Agents de Maîtrise', en: 'Foremen'),
    LocalizedText(fr: "Agents d'exécution", en: 'Field workers'),
    LocalizedText.same('Total'),
  ];

  static List<String> _cspRowLabels(Locale locale) =>
      _cspRowLabelsI18n.map((t) => t.of(locale)).toList();

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

  static List<HeaderNode> _genderAgeHeaders(Locale locale) {
    const ages = ['15–24', '25–34', '35+', 'Total'];
    return [
      HeaderNode(const LocalizedText(fr: 'Homme', en: 'Male').of(locale),
          children: [for (final a in ages) HeaderNode(a)]),
      HeaderNode(const LocalizedText(fr: 'Femme', en: 'Female').of(locale),
          children: [for (final a in ages) HeaderNode(a)]),
      HeaderNode('Total', children: [for (final a in ages) HeaderNode(a)]),
    ];
  }

  static List<HeaderNode> _genderOnlyHeadersShort() => const [
        HeaderNode('M'),
        HeaderNode('F'),
        HeaderNode('Total'),
      ];

  static List<HeaderNode> _statusGenderHeaders(Locale locale) => [
        for (final s in [
          const LocalizedText(fr: 'Permanent', en: 'Permanent').of(locale),
          const LocalizedText(fr: 'Temporaire', en: 'Temporary').of(locale),
          'Total',
        ])
          HeaderNode(s, children: [
            HeaderNode(const LocalizedText(fr: 'Homme', en: 'Male').of(locale)),
            HeaderNode(const LocalizedText(fr: 'Femme', en: 'Female').of(locale)),
            const HeaderNode('Total'),
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
  static GridRenderSpec _buildCspGenderAge(String prefix, Locale locale) {
    final matrix = [
      for (final r in _cspDataRows) _genderAgeRow(prefix, r),
      _genderAgeRow(prefix, 'total'),
    ];
    return GridRenderSpec(
      id: prefix,
      rowLabels: _cspRowLabels(locale),
      matrix: matrix,
      headers: _genderAgeHeaders(locale),
      cornerLabel: const LocalizedText(fr: 'Sexe', en: 'Sex').of(locale),
      cornerLabel2: const LocalizedText(
              fr: "Tranche d'âge (ans)", en: 'Age group (years)')
          .of(locale),
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S22Q03
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildDiploma(String prefix, Locale locale) {
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
    // Diploma acronyms — mostly language-neutral certificate names shared
    // across the FR/EN education systems; a few carry a short qualifier.
    const labelsI18n = [
      LocalizedText.same('CEP / CEPE / FSLC'),
      LocalizedText.same('BEPC / CAP / GCE-OL'),
      LocalizedText(fr: 'Probatoire', en: 'Lower sixth'),
      LocalizedText.same('BAC / GCE-AL'),
      LocalizedText.same('BTS / DUT / HND'),
      LocalizedText(fr: 'Licence (Bac+3)', en: 'Bachelor'),
      LocalizedText(fr: 'Maîtrise (Bac+4)', en: 'Master 1'),
      LocalizedText(fr: 'Master (Bac+5)', en: 'Master 2'),
      LocalizedText.same('DQP / PQD'),
      LocalizedText.same('CQP / CPQ'),
      LocalizedText(fr: 'Autres', en: 'Others'),
      LocalizedText(fr: 'Sans diplôme', en: 'Without diploma'),
      LocalizedText.same('Total'),
    ];
    final matrix = [
      for (final r in dataRows) _genderAgeRow(prefix, r),
      _genderAgeRow(prefix, 'total'),
    ];
    return GridRenderSpec(
      id: prefix,
      rowLabels: labelsI18n.map((t) => t.of(locale)).toList(),
      matrix: matrix,
      headers: _genderAgeHeaders(locale),
      cornerLabel: const LocalizedText(fr: 'Sexe', en: 'Sex').of(locale),
      cornerLabel2: const LocalizedText(
              fr: "Tranche d'âge (ans)", en: 'Age group (years)')
          .of(locale),
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S22Q04
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildCspStatusGender(String prefix, Locale locale) {
    final matrix = [
      for (final r in _cspDataRows) _statusGenderRow(prefix, r),
      _statusGenderRow(prefix, 'total'),
    ];
    return GridRenderSpec(
      id: prefix,
      rowLabels: _cspRowLabels(locale),
      matrix: matrix,
      headers: _statusGenderHeaders(locale),
      cornerLabel: 'CSP / SPC',
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S22Q05
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildVulnerableNamedRows(String prefix, Locale locale) {
    const dataRows = ['deplaces_internes', 'refugies', 'orphelins'];
    const rowLabelsI18n = [
      LocalizedText(fr: 'Déplacés internes', en: 'Internal displaced'),
      LocalizedText(fr: 'Réfugiés', en: 'Refugees'),
      LocalizedText(fr: 'Orphelins', en: 'Orphans'),
      LocalizedText.same('Total'),
    ];
    final matrix = [
      for (final r in dataRows) _statusGenderRow(prefix, r),
      _statusGenderRow(prefix, 'total'),
    ];
    return GridRenderSpec(
      id: prefix,
      rowLabels: rowLabelsI18n.map((t) => t.of(locale)).toList(),
      matrix: matrix,
      headers: _statusGenderHeaders(locale),
      cornerLabel: const LocalizedText(
              fr: 'Nature de vulnérabilité', en: 'Nature of vulnerability')
          .of(locale),
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S3Q01
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildDeparture(String prefix, Locale locale) {
    const types = [
      'dismissal',
      'resignation',
      'retirement',
      'other',
      'ensemble'
    ];
    const typeLabelsI18n = [
      LocalizedText(fr: 'Licenciements', en: 'Dismissal'),
      LocalizedText(fr: 'Démissions', en: 'Resignation'),
      LocalizedText(fr: 'Départ à la retraite', en: 'Retirement'),
      LocalizedText(fr: 'Autres départs', en: 'Other departure'),
      LocalizedText(fr: 'Ensemble', en: 'Whole'),
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
      rowLabels: _cspRowLabels(locale),
      matrix: matrix,
      headers: [
        for (final tl in typeLabelsI18n)
          HeaderNode(tl.of(locale), children: const [
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
  static GridRenderSpec _buildDismissalUnemployment(
      String prefix, Locale locale) {
    const types = ['dismissal', 'technical_unemployment', 'total'];
    const typeLabelsI18n = [
      LocalizedText(fr: 'Licenciement', en: 'Dismissal'),
      LocalizedText(fr: 'Chômage technique', en: 'Technical unemployment'),
      LocalizedText.same('Total'),
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
      rowLabels: _cspRowLabels(locale),
      matrix: matrix,
      headers: [
        for (final tl in typeLabelsI18n)
          HeaderNode(tl.of(locale), children: const [
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
  static GridRenderSpec _buildFirstTimeWorkers(String prefix, Locale locale) {
    const contracts = ['permanent', 'temporary'];
    const contractLabelsI18n = [
      LocalizedText.same('Permanent'),
      LocalizedText(fr: 'Temporaire', en: 'Temporary'),
    ];
    final matrix = <List<String>>[];
    final rowLabels = <String>[];
    for (int ci = 0; ci < contracts.length; ci++) {
      final c = contracts[ci];
      for (int ri = 0; ri < _cspDataRows.length; ri++) {
        matrix.add(_genderAgeRow(prefix, '${c}_${_cspDataRows[ri]}'));
        rowLabels.add(_cspRowLabelsI18n[ri].of(locale));
      }
      matrix.add(_genderAgeRow(prefix, '${c}_total'));
      rowLabels.add('Total');
    }
    return GridRenderSpec(
      id: prefix,
      rowLabels: rowLabels,
      matrix: matrix,
      headers: _genderAgeHeaders(locale),
      leadingGroupHeader: const LocalizedText(fr: 'Statut', en: 'Status').of(locale),
      leadingGroupLabels:
          contractLabelsI18n.map((t) => t.of(locale)).toList(),
      leadingGroupRowCounts: [
        _cspDataRows.length + 1,
        _cspDataRows.length + 1,
      ],
      leadingGroupColWidth: GridTheme.leadingGroupColWidth,
      cornerLabel: const LocalizedText(fr: 'Sexe', en: 'Sex').of(locale),
      cornerLabel2:
          const LocalizedText(fr: "Tranche d'âge", en: 'Age group').of(locale),
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S4Q01
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildInternship(String prefix, Locale locale) {
    const dataRows = ['vacation', 'academic', 'professional', 'pre_employment'];
    const labelsI18n = [
      LocalizedText(fr: 'Stage de vacance', en: 'Holiday jobs'),
      LocalizedText(fr: 'Stage académique', en: 'Academic internship'),
      LocalizedText(fr: 'Stage professionnel', en: 'Professional internship'),
      LocalizedText(fr: 'Stage pré-emploi', en: 'Pre-work internship'),
      LocalizedText.same('Total'),
    ];
    final matrix = [
      for (final r in dataRows) _genderRow(prefix, r),
      _genderRow(prefix, 'total'),
    ];
    return GridRenderSpec(
      id: prefix,
      rowLabels: labelsI18n.map((t) => t.of(locale)).toList(),
      matrix: matrix,
      headers: _genderOnlyHeadersShort(),
      cornerLabel: const LocalizedText(
              fr: 'Nature du stage', en: 'Nature of internship')
          .of(locale),
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S3Q02 — editable first column (reasons)
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildReasons(String prefix, Locale locale) {
    const dataRows = ['reason_1', 'reason_2', 'reason_3'];
    // One hint per row — matches the specific row number.
    const hintsI18n = [
      LocalizedText(fr: 'Motif 1', en: 'Reason 1'),
      LocalizedText(fr: 'Motif 2', en: 'Reason 2'),
      LocalizedText(fr: 'Motif 3', en: 'Reason 3'),
    ];
    final hints = hintsI18n.map((t) => t.of(locale)).toList();
    final cornerLabel = const LocalizedText(fr: 'Motif', en: 'Reason').of(locale);

    final matrix = [
      for (final r in dataRows) _genderRow(prefix, r),
      _genderRow(prefix, 'total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: [...hints, 'Total'],
      matrix: matrix,
      headers: _genderOnlyHeadersShort(),
      cornerLabel: cornerLabel,
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
            hint: idx >= 0 ? hints[idx] : cornerLabel,
          );
        }
        return _cell(id);
      },
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S4Q02 — editable first column (skills)
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildSkills(String prefix, Locale locale) {
    const dataRows = ['skill_1', 'skill_2', 'skill_3'];
    // One hint per row — matches the specific row number.
    const hintsI18n = [
      LocalizedText(fr: 'Compétence 1', en: 'Skill 1'),
      LocalizedText(fr: 'Compétence 2', en: 'Skill 2'),
      LocalizedText(fr: 'Compétence 3', en: 'Skill 3'),
    ];
    final hints = hintsI18n.map((t) => t.of(locale)).toList();
    final cornerLabel =
        const LocalizedText(fr: 'Compétence', en: 'Skill').of(locale);

    final matrix = [
      for (final r in dataRows) _genderRow(prefix, r),
      _genderRow(prefix, 'total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: [...hints, 'Total'],
      matrix: matrix,
      headers: _genderOnlyHeadersShort(),
      cornerLabel: cornerLabel,
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
            hint: idx >= 0 ? hints[idx] : cornerLabel,
          );
        }
        return _cell(id);
      },
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S4Q03 — editable first column (training domains)
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildTraining(String prefix, Locale locale) {
    const dataRows = ['domain_1', 'domain_2', 'domain_3'];
    // One hint per row — matches the specific row number.
    const hintsI18n = [
      LocalizedText(fr: 'Domaine 1', en: 'Domain 1'),
      LocalizedText(fr: 'Domaine 2', en: 'Domain 2'),
      LocalizedText(fr: 'Domaine 3', en: 'Domain 3'),
    ];
    final hints = hintsI18n.map((t) => t.of(locale)).toList();
    final cornerLabel = const LocalizedText(
            fr: 'Domaine de formation', en: 'Domain of training')
        .of(locale);

    final matrix = [
      for (final r in dataRows) _genderRow(prefix, r),
      _genderRow(prefix, 'total'),
    ];

    return GridRenderSpec(
      id: prefix,
      rowLabels: [...hints, 'Total'],
      matrix: matrix,
      headers: _genderOnlyHeadersShort(),
      cornerLabel: cornerLabel,
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
            hint: idx >= 0 ? hints[idx] : cornerLabel,
          );
        }
        return _cell(id);
      },
    );
  }
}
