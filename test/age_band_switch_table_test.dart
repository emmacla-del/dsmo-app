// Visual-audit + smoke test for AgeBandSwitchTable (ONEFOP Phase 2 —
// S22Q03) — pumps it directly with synthetic data so the desktop
// sticky-column/age-switcher path can be checked without driving the
// whole form deep into section2 past validation-gated navigation first.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/age_band_switch_table.dart';
import 'package:dsmo_app/core/focus/renderers/grid_render_spec.dart';
import 'package:dsmo_app/core/focus/schema/form_schema_v2.dart';
import 'package:dsmo_app/core/focus/schema/navigation_engine.dart';
import 'package:dsmo_app/core/focus/schema/navigation_graph.dart';
import 'package:dsmo_app/core/focus/unified_focus_manager_v2.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';

const _diplomas = ['cep', 'bepc', 'bac'];
const _diplomaLabels = ['CEP', 'BEPC', 'BAC'];
const _ages = ['15_24', '25_34', '35_plus', 'total'];

List<String> _genderAgeRow(String prefix, String rowKey) => [
      for (final g in ['male', 'female', 'total'])
        for (final a in _ages) '${prefix}_${rowKey}_${g}_$a',
    ];

GridRenderSpec _fullSpec(String prefix) {
  final matrix = [for (final d in _diplomas) _genderAgeRow(prefix, d)];
  return GridRenderSpec(
    id: prefix,
    rowLabels: _diplomaLabels,
    matrix: matrix,
    headers: const [HeaderNode('Homme'), HeaderNode('Femme'), HeaderNode('Total')],
    cornerLabel: 'Sexe',
    cellSpec: (id) => CellSpec(id: id, type: CellType.number, editable: !id.contains('_total')),
    isTotalCell: (id) => id.contains('_total'),
  );
}

// Distinct value per age band on each diploma row's gender="total"
// column so switching bands is observable — value = 1-based index of
// the age band among _ages, ×111 (111 for 15–24, 222 for 25–34, ...,
// 444 for the Total/all-ages band). Cell id = "<prefix>_<diploma>
// _total_<age>" — gender="total" (the 3rd of the 3 sliced columns,
// index 8+ageIdx), age varies with _ages[a].
Map<String, int> _numberValues(String prefix) => {
      for (final d in _diplomas)
        for (var a = 0; a < _ages.length; a++) '${prefix}_${d}_total_${_ages[a]}': (a + 1) * 111,
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
  // AgeBandSwitchTable's sliced Homme/Femme/Total headers are locale-aware
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
  testWidgets('shows 4 age segments, 3 data columns, diploma names always visible',
      (tester) async {
    const prefix = 's22q03';
    await _pump(
      tester,
      AgeBandSwitchTable(
        spec: _fullSpec(prefix),
        config: const AgeBandSwitcherConfig(labels: ['15–24', '25–34', '35+', 'Total (tous âges)']),
        numberValues: const {},
        onNumberChanged: (_, __) {},
        focusManager: _fm(),
        tableId: prefix,
      ),
    );

    expect(find.text('15–24'), findsOneWidget);
    expect(find.text('25–34'), findsOneWidget);
    expect(find.text('35+'), findsOneWidget);
    expect(find.text('Total (tous âges)'), findsOneWidget);

    expect(find.text('Homme'), findsOneWidget);
    expect(find.text('Femme'), findsOneWidget);
    // 'Total' appears both as a column header and inside cell text — just
    // confirm the column header set is exactly 3 (Homme/Femme/Total).
    expect(find.text('Total'), findsWidgets);

    for (final label in _diplomaLabels) {
      expect(find.text(label), findsOneWidget);
    }

    await expectLater(find.byType(AgeBandSwitchTable),
        matchesGoldenFile('goldens/age_band_switch_15_24.png'));
  });

  testWidgets('switching age band changes the displayed total values', (tester) async {
    const prefix = 's22q03';
    await _pump(
      tester,
      AgeBandSwitchTable(
        spec: _fullSpec(prefix),
        config: const AgeBandSwitcherConfig(labels: ['15–24', '25–34', '35+', 'Total (tous âges)']),
        numberValues: _numberValues(prefix),
        onNumberChanged: (_, __) {},
        focusManager: _fm(),
        tableId: prefix,
      ),
    );

    // Age index 0 (15–24) → total_total value is (0+1)*111 = 111.
    expect(find.text('111'), findsWidgets);
    expect(find.text('444'), findsNothing);

    await tester.tap(find.text('Total (tous âges)'));
    await tester.pump();

    // Age index 3 (Total/all ages) → (3+1)*111 = 444 — same diploma rows,
    // same row labels, different visible values (same underlying cells).
    expect(find.text('444'), findsWidgets);
    expect(find.text('111'), findsNothing);
    for (final label in _diplomaLabels) {
      expect(find.text(label), findsOneWidget);
    }

    await expectLater(find.byType(AgeBandSwitchTable),
        matchesGoldenFile('goldens/age_band_switch_total.png'));
  });
}
