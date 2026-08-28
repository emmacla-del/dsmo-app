// Visual-audit + smoke test for StatusSwitchTable (S22Q04/S22Q05) —
// pumps it directly with synthetic data, mirroring
// age_band_switch_table_test.dart's approach.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/grid_render_spec.dart';
import 'package:dsmo_app/core/focus/renderers/status_switch_table.dart';
import 'package:dsmo_app/core/focus/schema/form_schema_v2.dart';
import 'package:dsmo_app/core/focus/schema/navigation_engine.dart';
import 'package:dsmo_app/core/focus/schema/navigation_graph.dart';
import 'package:dsmo_app/core/focus/unified_focus_manager_v2.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';

const _rows = ['cadres', 'foremen', 'workers'];
const _rowLabels = ['Cadres', 'Agents de Maîtrise', "Agents d'exécution"];
const _statuses = ['permanent', 'temporary', 'total'];

List<String> _statusGenderRow(String prefix, String rowKey) => [
      for (final s in _statuses)
        for (final g in ['male', 'female', 'total']) '${prefix}_${rowKey}_${s}_$g',
    ];

GridRenderSpec _fullSpec(String prefix) {
  final matrix = [for (final r in _rows) _statusGenderRow(prefix, r)];
  return GridRenderSpec(
    id: prefix,
    rowLabels: _rowLabels,
    matrix: matrix,
    headers: const [HeaderNode('Homme'), HeaderNode('Femme'), HeaderNode('Total')],
    cornerLabel: 'CSP / SPC',
    cellSpec: (id) => CellSpec(id: id, type: CellType.number, editable: !id.contains('_total')),
    isTotalCell: (id) => id.contains('_total'),
  );
}

// Distinct value per status on each row's gender="total" column — value
// = 1-based index of the status among _statuses, ×111.
Map<String, int> _numberValues(String prefix) => {
      for (final r in _rows)
        for (var s = 0; s < _statuses.length; s++) '${prefix}_${r}_${_statuses[s]}_total': (s + 1) * 111,
    };

UnifiedFocusManagerV2 _fm() => UnifiedFocusManagerV2(NavigationEngine(const FormSchemaV2(
      sections: [],
      fields: [],
      grids: [],
      navigation: NavigationGraph(next: {}, prev: {}, gridNeighbors: {}),
    )));

Future<void> _pump(WidgetTester tester, Widget child) async {
  tester.view.physicalSize = const Size(1000, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  // StatusSwitchTable's sliced Homme/Femme/Total headers are locale-aware
  // (LocalizedText) — pin French explicitly rather than relying on the
  // test binding's own default (English), which this suite's assertions
  // below assume isn't in play.
  await tester.pumpWidget(MaterialApp(
    locale: const Locale('fr'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(body: SingleChildScrollView(child: child)),
  ));
}

void main() {
  testWidgets('shows 3 status segments, 3 data columns, CSP row names always visible',
      (tester) async {
    const prefix = 's22q04';
    await _pump(
      tester,
      StatusSwitchTable(
        spec: _fullSpec(prefix),
        config: const StatusSwitcherConfig(
            labels: ['Permanent', 'Temporaire', 'Total'], keys: _statuses),
        numberValues: const {},
        onNumberChanged: (_, __) {},
        focusManager: _fm(),
        tableId: prefix,
      ),
    );

    expect(find.text('Permanent'), findsOneWidget);
    expect(find.text('Temporaire'), findsOneWidget);
    // 'Total' appears both as a segment label and a column header — just
    // confirm it's present at least twice.
    expect(find.text('Total'), findsWidgets);

    expect(find.text('Homme'), findsOneWidget);
    expect(find.text('Femme'), findsOneWidget);

    for (final label in _rowLabels) {
      expect(find.text(label), findsOneWidget);
    }

    await expectLater(find.byType(StatusSwitchTable),
        matchesGoldenFile('goldens/status_switch_permanent.png'));
  });

  testWidgets('switching status changes the displayed total values', (tester) async {
    const prefix = 's22q04';
    await _pump(
      tester,
      StatusSwitchTable(
        spec: _fullSpec(prefix),
        config: const StatusSwitcherConfig(
            labels: ['Permanent', 'Temporaire', 'Total'], keys: _statuses),
        numberValues: _numberValues(prefix),
        onNumberChanged: (_, __) {},
        focusManager: _fm(),
        tableId: prefix,
      ),
    );

    // Status index 0 (Permanent) → total column value = (0+1)*111 = 111.
    expect(find.text('111'), findsWidgets);
    expect(find.text('333'), findsNothing);

    // Tap the *segment* labelled "Total" (index 2) — not the column
    // header of the same name, which is also on screen.
    final totalSegment = find.ancestor(
      of: find.text('Total').first,
      matching: find.byType(InkWell),
    );
    await tester.tap(totalSegment.first);
    await tester.pump();

    // Status index 2 (Total) → (2+1)*111 = 333 — same row labels,
    // different visible values (same underlying cells).
    expect(find.text('333'), findsWidgets);
    expect(find.text('111'), findsNothing);
    for (final label in _rowLabels) {
      expect(find.text(label), findsOneWidget);
    }

    await expectLater(find.byType(StatusSwitchTable),
        matchesGoldenFile('goldens/status_switch_total.png'));
  });

  testWidgets('works with 5 segments too (S3Q01-shaped: 5 reasons × 3 genders)',
      (tester) async {
    const prefix = 's3q01';
    const reasonKeys = ['dismissal', 'resignation', 'retirement', 'other', 'ensemble'];
    const reasonLabels = ['Licenciements', 'Démissions', 'Retraite', 'Autres', 'Ensemble'];

    List<String> reasonGenderRow(String rowKey) => [
          for (final r in reasonKeys)
            for (final g in ['male', 'female', 'total']) '${prefix}_${rowKey}_${r}_$g',
        ];
    final spec = GridRenderSpec(
      id: prefix,
      rowLabels: _rowLabels,
      matrix: [for (final r in _rows) reasonGenderRow(r)],
      headers: const [HeaderNode('Homme'), HeaderNode('Femme'), HeaderNode('Total')],
      cornerLabel: 'CSP / SPC',
      cellSpec: (id) => CellSpec(id: id, type: CellType.number, editable: !id.contains('_total')),
      isTotalCell: (id) => id.contains('_total'),
    );
    // Distinct value per reason on each row's gender="total" column.
    final numberValues = {
      for (final r in _rows)
        for (var i = 0; i < reasonKeys.length; i++)
          '${prefix}_${r}_${reasonKeys[i]}_total': (i + 1) * 111,
    };

    await _pump(
      tester,
      StatusSwitchTable(
        spec: spec,
        config: const StatusSwitcherConfig(labels: reasonLabels, keys: reasonKeys),
        numberValues: numberValues,
        onNumberChanged: (_, __) {},
        focusManager: _fm(),
        tableId: prefix,
      ),
    );

    for (final label in reasonLabels) {
      expect(find.text(label), findsOneWidget);
    }
    // Segment 0 (dismissal, index 0) selected by default → value 111.
    expect(find.text('111'), findsWidgets);
    expect(find.text('555'), findsNothing);

    // Switch to the last segment ("Ensemble", index 4) → contiguous
    // column slice [12,13,14] out of 15 total columns.
    await tester.tap(find.text('Ensemble'));
    await tester.pump();
    expect(find.text('555'), findsWidgets);
    expect(find.text('111'), findsNothing);
    for (final label in _rowLabels) {
      expect(find.text(label), findsOneWidget);
    }
  });
}
