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
    required void Function(String, int?) onCellChanged,
    required String entityType,
    required Locale locale,
    List<String>? rows,
  }) {
    switch (template) {
      case 'csp_gender_age_table':
      case 'csp_table':
        return _buildCspGenderAge(prefix, locale, rows: rows);

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
        return _buildDeparture(prefix, locale, rows: rows);

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

      case 'kpi_period_table':
        return _buildKpiPeriod(prefix, locale);

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

  // Row-id → label lookup covering both the default CSP rows (Enterprise/
  // Cooperative/CTD/ONG) and Administration's SFP (civil-service status)
  // rows for S21Q01/S22Q01/S3Q01 — see table_spec_builder's `rows` param,
  // sourced from the AST's tableSpec['rows'] via TableRenderer. An id with
  // no entry here falls back to itself (defensive; every row id currently
  // produced by the AST is covered).
  static const _rowLabelsById = <String, LocalizedText>{
    'cadres': LocalizedText(fr: 'Cadres', en: 'Executives'),
    'foremen': LocalizedText(fr: 'Agents de Maîtrise', en: 'Foremen'),
    'workers': LocalizedText(fr: "Agents d'exécution", en: 'Field workers'),
    'fonctionnaire': LocalizedText(fr: 'Fonctionnaire', en: 'Civil servant'),
    'decisionnaire':
        LocalizedText(fr: 'Décisionnaire', en: 'Decision-maker'),
    'contractuelle': LocalizedText(fr: 'Contractuelle', en: 'Contractual'),
  };

  static List<LocalizedText> _rowLabelsFor(List<String> rows) =>
      [for (final r in rows) _rowLabelsById[r] ?? LocalizedText.same(r)];

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

  static const _statusKeys = ['permanent', 'temporary', 'total'];

  static List<String> _statusLabels(Locale locale) => [
        const LocalizedText(fr: 'Permanent', en: 'Permanent').of(locale),
        const LocalizedText(fr: 'Temporaire', en: 'Temporary').of(locale),
        'Total',
      ];

  // ── Middle-axis × gender mini-grids ─────────────────────────────
  // Mobile fallback for StatusSwitchTable-shaped tables (any table
  // whose columns are N middle-axis groups (status, departure reason,
  // dismissal type, …) of 3 gender columns each) — the middle axis
  // becomes the outer segmented axis (matching desktop 1:1), one
  // CategoryMiniGrid per data row within each middle-axis group, each a
  // single row of the 3 already-existing gender cells for that (row,
  // middleKey) pair — reuses _genderRow verbatim with a combined rowKey
  // ('<row>_<middleKey>'), same cell IDs the matching StatusSwitchTable
  // slices from the full matrix on desktop.
  static List<CategoryGridGroup> _middleAxisCategoryGroups(
    String prefix,
    List<String> middleKeys,
    List<String> middleLabels,
    List<String> dataRows,
    List<LocalizedText> rowLabelsI18n,
    Locale locale,
  ) {
    return [
      for (int mi = 0; mi < middleKeys.length; mi++)
        CategoryGridGroup(
          outerLabel: middleLabels[mi],
          categories: [
            for (int ri = 0; ri < dataRows.length; ri++)
              CategoryMiniGrid(
                label: rowLabelsI18n[ri].of(locale),
                spec: GridRenderSpec(
                  id: '${prefix}_${dataRows[ri]}_${middleKeys[mi]}',
                  rowLabels: const [''],
                  matrix: [_genderRow(prefix, '${dataRows[ri]}_${middleKeys[mi]}')],
                  headers: _genderOnlyHeadersShort(),
                  cellSpec: _cell,
                  isTotalCell: _isTotal,
                ),
              ),
          ],
        ),
    ];
  }

  // S22Q04/S22Q05 specifically — status as the middle axis.
  static List<CategoryGridGroup> _statusCategoryGroups(
    String prefix,
    List<String> dataRows,
    List<LocalizedText> rowLabelsI18n,
    Locale locale,
  ) =>
      _middleAxisCategoryGroups(
          prefix, _statusKeys, _statusLabels(locale), dataRows, rowLabelsI18n, locale);

  // ── CSP category mini-grids ────────────────────────────────────
  // One CSP row's 12 _genderAgeRow cell IDs (male×4, female×4, total×4,
  // each age-major) are already exactly a 3×4 shape — just interpreted
  // today as 1 row of 12 flat columns. Re-chunking them into 3 matrix
  // rows (Male/Female/Total) × 4 columns (age bands + Total) is a pure
  // re-render: no new cell IDs, and _isTotal/_cell already do the right
  // thing for both the Total row (gender='total', matches "_total") and
  // the Total column (age='total', also matches "_total").
  static GridRenderSpec _categoryMiniGrid(
      String prefix, String rowKey, Locale locale) {
    final ids = _genderAgeRow(prefix, rowKey);
    const ages = ['15–24', '25–34', '35+', 'Total'];
    return GridRenderSpec(
      id: '${prefix}_$rowKey',
      rowLabels: [
        const LocalizedText(fr: 'Homme', en: 'Male').of(locale),
        const LocalizedText(fr: 'Femme', en: 'Female').of(locale),
        'Total',
      ],
      matrix: [ids.sublist(0, 4), ids.sublist(4, 8), ids.sublist(8, 12)],
      headers: [for (final a in ages) HeaderNode(a)],
      cornerLabel:
          const LocalizedText(fr: "Âge", en: 'Age').of(locale),
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  /// One CategoryMiniGrid per data row (Cadres/Foremen/Field workers by
  /// default, or Administration's Fonctionnaire/Décisionnaire/Contractuelle
  /// when [dataRows]/[labelsI18n] are supplied) — [rowKeyPrefix] lets a
  /// table with an outer axis (S23Q02's permanent_/temporary_ status) reuse
  /// this for each outer group.
  static List<CategoryMiniGrid> _categoryMiniGrids(
      String prefix, String rowKeyPrefix, Locale locale,
      {List<String>? dataRows, List<LocalizedText>? labelsI18n}) {
    final rows = dataRows ?? _cspDataRows;
    final labels = labelsI18n ?? _cspRowLabelsI18n;
    return [
      for (int i = 0; i < rows.length; i++)
        CategoryMiniGrid(
          label: labels[i].of(locale),
          spec: _categoryMiniGrid(prefix, '$rowKeyPrefix${rows[i]}', locale),
        ),
    ];
  }

  // ─────────────────────────────────────────────────────────────
  // S21Q01 / S22Q01 / S22Q02 / S23Q01
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildCspGenderAge(String prefix, Locale locale,
      {List<String>? rows}) {
    final dataRows = rows ?? _cspDataRows;
    final rowLabelsI18n = _rowLabelsFor(dataRows);
    final matrix = [
      for (final r in dataRows) _genderAgeRow(prefix, r),
      _genderAgeRow(prefix, 'total'),
    ];
    return GridRenderSpec(
      id: prefix,
      rowLabels: [
        ...rowLabelsI18n.map((t) => t.of(locale)),
        const LocalizedText.same('Total').of(locale),
      ],
      matrix: matrix,
      headers: _genderAgeHeaders(locale),
      cornerLabel: const LocalizedText(fr: 'Sexe', en: 'Sex').of(locale),
      cornerLabel2: const LocalizedText(
              fr: "Tranche d'âge (ans)", en: 'Age group (years)')
          .of(locale),
      categoryGridGroups: [
        CategoryGridGroup(
            categories: _categoryMiniGrids(prefix, '', locale,
                dataRows: dataRows, labelsI18n: rowLabelsI18n)),
      ],
      // Spreadsheet Mode (desktop) renders this flat spec directly —
      // every category as one row, no card wrapper — with a compact
      // "Aucun cas" toggle in each row's label cell (see
      // GenericSpreadsheetTable.rowAccessoryBuilder). '${prefix}_$r'
      // matches CategoryMiniGrid.spec.id's convention exactly (same
      // _categoryMiniGrids(prefix, '', locale) call above), so a skip
      // flag set from either rendering is recognized by the other. The
      // trailing '' is the computed Total row — nothing to skip there.
      rowKeys: [for (final r in dataRows) '${prefix}_$r', ''],
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
    // Desktop (Phase 2): AgeBandSwitchTable — a segmented 15–24/25–34/
    // 35+/Total control picks which 3 of the 12 gender×age columns show
    // as Male/Female/Total, for every diploma row at once, instead of
    // the old education-level-grouped boxed tables. Mobile (temporary):
    // reuses categoryGridGroups' per-diploma expandable cards, the same
    // mechanism Phase 1 built for CSP categories — see TableRenderer
    // .renderTable's dispatch (ageBandSwitcher is desktop-only).
    return GridRenderSpec(
      id: prefix,
      rowLabels: labelsI18n.map((t) => t.of(locale)).toList(),
      matrix: matrix,
      headers: _genderAgeHeaders(locale),
      cornerLabel: const LocalizedText(fr: 'Sexe', en: 'Sex').of(locale),
      cornerLabel2: const LocalizedText(
              fr: "Tranche d'âge (ans)", en: 'Age group (years)')
          .of(locale),
      ageBandSwitcher: AgeBandSwitcherConfig(labels: [
        '15–24',
        '25–34',
        '35+',
        const LocalizedText(fr: 'Total (tous âges)', en: 'Total (all ages)')
            .of(locale),
      ]),
      // Same '${prefix}_$r' convention _buildCspGenderAge's rowKeys uses —
      // lets Spreadsheet Mode's AgeBandSwitchTable show the same per-row
      // "Aucun cas à signaler" toggle the mobile/Simple Mode cards above
      // already have. Trailing '' is the computed Total row — nothing to
      // skip there, matching _buildCspGenderAge (not the extra 'total'
      // CategoryMiniGrid above, which is its own pre-existing quirk).
      rowKeys: [for (final r in dataRows) '${prefix}_$r', ''],
      categoryGridGroups: [
        CategoryGridGroup(categories: [
          for (int i = 0; i < dataRows.length; i++)
            CategoryMiniGrid(
              label: labelsI18n[i].of(locale),
              spec: _categoryMiniGrid(prefix, dataRows[i], locale),
            ),
          CategoryMiniGrid(
            label: labelsI18n.last.of(locale),
            spec: _categoryMiniGrid(prefix, 'total', locale),
          ),
        ]),
      ],
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
    // Desktop: StatusSwitchTable — a segmented Permanent/Temporaire/Total
    // control picks which 3 of the 9 status×gender columns show as
    // Male/Female/Total, for every CSP row at once. Mobile (temporary):
    // reuses categoryGridGroups' per-row expandable cards, status as the
    // outer segmented axis — same mechanism S23Q02 already uses.
    return GridRenderSpec(
      id: prefix,
      rowLabels: _cspRowLabels(locale),
      matrix: matrix,
      headers: _statusGenderHeaders(locale),
      cornerLabel: 'CSP / SPC',
      statusSwitcher:
          StatusSwitcherConfig(labels: _statusLabels(locale), keys: _statusKeys),
      // Composed as '${rowKeys[r]}_${_statusKeys[statusIdx]}' by
      // StatusSwitchTable — same per-(row, status) granularity as the
      // categoryGridGroups cards below (_statusCategoryGroups), so a skip
      // flag set on either platform is recognized by the other. Trailing
      // '' is the computed Total row.
      rowKeys: [for (final r in _cspDataRows) '${prefix}_$r', ''],
      categoryGridGroups: _statusCategoryGroups(
          prefix, _cspDataRows, _cspRowLabelsI18n, locale),
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
    // Same StatusSwitchTable (desktop) / categoryGridGroups (mobile)
    // split as S22Q04 — see its comment.
    return GridRenderSpec(
      id: prefix,
      rowLabels: rowLabelsI18n.map((t) => t.of(locale)).toList(),
      matrix: matrix,
      headers: _statusGenderHeaders(locale),
      cornerLabel: const LocalizedText(
              fr: 'Nature de vulnérabilité', en: 'Nature of vulnerability')
          .of(locale),
      statusSwitcher:
          StatusSwitcherConfig(labels: _statusLabels(locale), keys: _statusKeys),
      rowKeys: [for (final r in dataRows) '${prefix}_$r', ''],
      categoryGridGroups:
          _statusCategoryGroups(prefix, dataRows, rowLabelsI18n, locale),
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // S3Q01
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildDeparture(String prefix, Locale locale,
      {List<String>? rows}) {
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
      LocalizedText(fr: 'Autres départs', en: 'Other departures'),
      LocalizedText(fr: 'Ensemble', en: 'Total'),
    ];
    final dataRows = rows ?? _cspDataRows;
    final rowLabelsI18n = _rowLabelsFor(dataRows);
    List<String> typeGenderRow(String rowKey) => [
          for (final t in types)
            for (final g in ['male', 'female', 'total'])
              '${prefix}_${rowKey}_${t}_$g',
        ];
    final matrix = [
      for (final r in dataRows) typeGenderRow(r),
      typeGenderRow('total'),
    ];
    final typeLabels = typeLabelsI18n.map((t) => t.of(locale)).toList();
    // Desktop: StatusSwitchTable (same N-groups-of-3-gender-columns
    // mechanism as S22Q04/S22Q05, just with departure-reason segments
    // instead of status ones — the widget itself doesn't care which).
    // Mobile: categoryGridGroups, reason as the outer segmented axis.
    return GridRenderSpec(
      id: prefix,
      rowLabels: [
        ...rowLabelsI18n.map((t) => t.of(locale)),
        const LocalizedText.same('Total').of(locale),
      ],
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
      statusSwitcher: StatusSwitcherConfig(labels: typeLabels, keys: types),
      rowKeys: [for (final r in dataRows) '${prefix}_$r', ''],
      categoryGridGroups: _middleAxisCategoryGroups(
          prefix, types, typeLabels, dataRows, rowLabelsI18n, locale),
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
    final typeLabels = typeLabelsI18n.map((t) => t.of(locale)).toList();
    // Same StatusSwitchTable (desktop) / categoryGridGroups (mobile)
    // split as S3Q01 above.
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
      statusSwitcher: StatusSwitcherConfig(labels: typeLabels, keys: types),
      rowKeys: [for (final r in _cspDataRows) '${prefix}_$r', ''],
      categoryGridGroups: _middleAxisCategoryGroups(
          prefix, types, typeLabels, _cspDataRows, _cspRowLabelsI18n, locale),
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
    final rowKeys = <String>[];
    final leadingGroupRowCounts = <int>[];
    for (int ci = 0; ci < contracts.length; ci++) {
      final c = contracts[ci];
      for (int ri = 0; ri < _cspDataRows.length; ri++) {
        matrix.add(_genderAgeRow(prefix, '${c}_${_cspDataRows[ri]}'));
        rowLabels.add(_cspRowLabelsI18n[ri].of(locale));
        // Matches CategoryMiniGrid.spec.id's convention exactly (built by
        // the same _categoryMiniGrids(prefix, '${contracts[ci]}_', locale)
        // call below) — a skip flag set from either rendering is
        // recognized by the other.
        rowKeys.add('${prefix}_${c}_${_cspDataRows[ri]}');
      }
      matrix.add(_genderAgeRow(prefix, '${c}_total'));
      rowLabels.add('Total');
      rowKeys.add(''); // computed row — nothing to skip
      leadingGroupRowCounts.add(_cspDataRows.length + 1);
    }
    final contractLabels = contractLabelsI18n.map((t) => t.of(locale)).toList();
    return GridRenderSpec(
      id: prefix,
      rowLabels: rowLabels,
      matrix: matrix,
      headers: _genderAgeHeaders(locale),
      cornerLabel: const LocalizedText(fr: 'Sexe', en: 'Sex').of(locale),
      cornerLabel2:
          const LocalizedText(fr: "Tranche d'âge", en: 'Age group').of(locale),
      // Two renderings share this same spec: Simple Mode / mobile use the
      // Permanent/Temporaire outer axis of categoryGridGroups (a
      // segmented control switches between them — see
      // CategoryGridGroupsView, untouched by the flatten-Spreadsheet-Mode
      // change). Desktop Spreadsheet Mode instead splits by row via
      // leadingGroupHeader/Labels/RowCounts (GridRenderSpec
      // .splitByLeadingGroup) and renders one flat table at a time behind
      // a tab strip — see LeadingGroupSwitchTable and TableRenderer's
      // `!mobile && hasLeadingGroup` dispatch branch, which fires before
      // the categoryGridGroups branch below ever sees this spec on
      // desktop. leadingGroupHeader itself is never actually displayed
      // (LeadingGroupSwitchTable builds its own tab strip instead of
      // GenericSpreadsheetTable's frozen-column treatment for it) — it
      // only exists to make hasLeadingGroup/splitByLeadingGroup usable.
      leadingGroupHeader: 'Statut / Status',
      leadingGroupLabels: contractLabels,
      leadingGroupRowCounts: leadingGroupRowCounts,
      rowKeys: rowKeys,
      categoryGridGroups: [
        for (int ci = 0; ci < contracts.length; ci++)
          CategoryGridGroup(
            outerLabel: contractLabelsI18n[ci].of(locale),
            categories: _categoryMiniGrids(prefix, '${contracts[ci]}_', locale),
          ),
      ],
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
      LocalizedText(fr: 'Stage pré-emploi', en: 'Pre-employment internship'),
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
      // No categoryGridGroups for this one (flat table on every platform,
      // see TableRenderer's dispatch), so this only reaches Spreadsheet
      // Mode's rowAccessoryBuilder — mobile/Simple Mode's MobileCardTable
      // has no per-row skip-toggle slot to plug this into today.
      rowKeys: [for (final r in dataRows) '${prefix}_$r', ''],
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

  // ─────────────────────────────────────────────────────────────
  // Projects & Programs — Section 3 outcomes/perspectives KPI grid.
  // A small fixed 4-row x 3-column table, no gender/age breakdown and
  // no computed total row/column (the paper form has none) — closest
  // existing precedent is _buildInternship's shape (rowLabels + matrix,
  // no switchers, no categoryGridGroups).
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec _buildKpiPeriod(String prefix, Locale locale) {
    const dataRows = ['employed', 'self_employed', 'jobs_created', 'trained'];
    const rowLabelsI18n = [
      LocalizedText(
        fr: 'Nombre de bénéficiaires insérés comme employés',
        en: 'Number of beneficiaries inserted as employees',
      ),
      LocalizedText(
        fr: 'Nombre de bénéficiaires insérés en auto emploi',
        en: 'Number of beneficiaries inserted in self-employment',
      ),
      LocalizedText(
        fr: "Nombre d'emplois créés par les bénéficiaires employeurs",
        en: 'Number of jobs created by beneficiary employers',
      ),
      LocalizedText(
        fr: 'Nombre de bénéficiaires formés dans les domaines divers',
        en: 'Number of beneficiaries trained in various fields',
      ),
    ];
    const periods = ['current', 'outlook_dec', 'outlook_june'];
    const periodLabelsI18n = [
      LocalizedText(
        fr: 'Du 1er Janvier 2026 à ce jour',
        en: 'From 1st January 2026 to date',
      ),
      LocalizedText(
        fr: 'Perspectives au 31/12/2026',
        en: 'Outlook at 31/12/2026',
      ),
      LocalizedText(
        fr: 'Perspectives au 30/06/2026',
        en: 'Outlook at 30/06/2026',
      ),
    ];
    final matrix = [
      for (final r in dataRows)
        [for (final p in periods) '${prefix}_${r}_$p'],
    ];
    return GridRenderSpec(
      id: prefix,
      rowLabels: rowLabelsI18n.map((t) => t.of(locale)).toList(),
      matrix: matrix,
      headers: [for (final p in periodLabelsI18n) HeaderNode(p.of(locale))],
      cornerLabel: const LocalizedText(fr: 'Indicateur', en: 'Indicator').of(locale),
      rowKeys: [for (final r in dataRows) '${prefix}_$r'],
      cellSpec: _cell,
      isTotalCell: _isTotal,
    );
  }
}
