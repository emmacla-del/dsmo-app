// Visual-audit + smoke test for CategoryGridGroupsView (ONEFOP Phase 1
// table rework) — pumps it directly with synthetic data so the collapsible-
// card accordion (now shared by desktop and mobile/Simple Mode alike) can
// be checked without driving the whole form through validation-gated
// navigation first.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/category_mini_grids.dart';
import 'package:dsmo_app/core/focus/renderers/grid_render_spec.dart';
import 'package:dsmo_app/core/focus/schema/form_schema_v2.dart';
import 'package:dsmo_app/core/focus/schema/navigation_engine.dart';
import 'package:dsmo_app/core/focus/schema/navigation_graph.dart';
import 'package:dsmo_app/core/focus/unified_focus_manager_v2.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';

GridRenderSpec _miniSpec(String prefix, String rowKey) {
  final ids = [
    for (final g in ['male', 'female', 'total'])
      for (final age in ['15_24', '25_34', '35_plus', 'total'])
        '${prefix}_${rowKey}_${g}_$age',
  ];
  return GridRenderSpec(
    id: '${prefix}_$rowKey',
    rowLabels: const ['Homme', 'Femme', 'Total'],
    matrix: [ids.sublist(0, 4), ids.sublist(4, 8), ids.sublist(8, 12)],
    headers: const [HeaderNode('15–24'), HeaderNode('25–34'), HeaderNode('35+'), HeaderNode('Total')],
    cornerLabel: 'Âge',
    cellSpec: (id) => CellSpec(id: id, type: CellType.number, editable: !id.contains('_total')),
    isTotalCell: (id) => id.contains('_total'),
  );
}

List<CategoryGridGroup> _groups(String prefix, {bool withOuterAxis = false}) {
  const categories = ['cadres', 'foremen', 'workers'];
  const labels = ['Cadres', 'Agents de Maîtrise', "Agents d'exécution"];
  List<CategoryMiniGrid> cats(String rowKeyPrefix) => [
        for (var i = 0; i < categories.length; i++)
          CategoryMiniGrid(label: labels[i], spec: _miniSpec(prefix, '$rowKeyPrefix${categories[i]}')),
      ];
  if (!withOuterAxis) {
    return [CategoryGridGroup(categories: cats(''))];
  }
  return [
    CategoryGridGroup(outerLabel: 'Permanent', categories: cats('permanent_')),
    CategoryGridGroup(outerLabel: 'Temporaire', categories: cats('temporary_')),
  ];
}

UnifiedFocusManagerV2 _fm() => UnifiedFocusManagerV2(NavigationEngine(const FormSchemaV2(
      sections: [],
      fields: [],
      grids: [],
      navigation: NavigationGraph(next: {}, prev: {}, gridNeighbors: {}),
    )));

Future<void> _pump(WidgetTester tester, Widget child, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  // CategoryGridGroupsView's progress line / grand total / skip-toggle
  // copy is locale-aware (LocalizedText) — pin French explicitly so this
  // suite's goldens/assertions don't depend on the test binding's own
  // default locale.
  await tester.pumpWidget(MaterialApp(
    locale: const Locale('fr'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(body: SingleChildScrollView(child: child)),
  ));
}

void main() {
  group('categoryFillStatus distinguishes missing from confirmed zero', () {
    final category = _groups('s21q01').single.categories.first;
    final ids = category.spec.matrix.expand((row) => row).where((id) => !id.contains('_total')).toList();

    test('untouched cells (absent from enteredValues) are empty', () {
      final status = categoryFillStatus(category, const {}, false, enteredValues: const {});
      expect(status, CategoryFillStatus.empty);
    });

    test('explicit zeros in enteredValues count as filled, not empty', () {
      final entered = {for (final id in ids) id: 0};
      final status = categoryFillStatus(category, const {}, false, enteredValues: entered);
      expect(status, CategoryFillStatus.complete);
    });

    test('a mix of entered zeros and untouched cells is partial, not empty', () {
      final entered = {ids.first: 0};
      final status = categoryFillStatus(category, const {}, false, enteredValues: entered);
      expect(status, CategoryFillStatus.partial);
    });

    test('without an enteredValues map, falls back to numberValues != 0', () {
      final numberValues = {for (final id in ids) id: 0};
      final status = categoryFillStatus(category, numberValues, false);
      expect(status, CategoryFillStatus.empty);
    });
  });

  testWidgets(
      'desktop: no outer axis renders 3 collapsible cards, no segment control, all expanded',
      (tester) async {
    await _pump(
      tester,
      CategoryGridGroupsView(
        groups: _groups('s21q01'),
        prefix: 's21q01',
        numberValues: const {},
        onNumberChanged: (_, __) {},
        focusManager: _fm(),
        mobile: false,
      ),
      const Size(900, 1400),
    );

    expect(find.text('Cadres'), findsOneWidget);
    expect(find.text('Agents de Maîtrise'), findsOneWidget);
    expect(find.text("Agents d'exécution"), findsOneWidget);
    expect(find.text('Permanent'), findsNothing);
    // Every category starts expanded on desktop Spreadsheet Mode — the
    // point of Spreadsheet Mode next to Simple Mode/mobile (which still
    // default to only the first category open, see the mobile test below)
    // is seeing and filling several categories at a glance, not clicking
    // each one open first.
    expect(find.text('Homme'), findsNWidgets(3));

    // Still individually collapsible, just not collapsed by default.
    await tester.tap(find.text('Cadres'));
    await tester.pump();
    expect(find.text('Homme'), findsNWidgets(2));

    await tester.tap(find.text('Cadres'));
    await tester.pump();
    expect(find.text('Homme'), findsNWidgets(3));

    await expectLater(find.byType(CategoryGridGroupsView),
        matchesGoldenFile('goldens/category_grid_desktop_no_axis.png'));
  });

  testWidgets(
      'desktop: outer axis renders one group at a time behind horizontal tabs, all its categories expanded',
      (tester) async {
    await _pump(
      tester,
      CategoryGridGroupsView(
        groups: _groups('s23q02', withOuterAxis: true),
        prefix: 's23q02',
        numberValues: const {},
        onNumberChanged: (_, __) {},
        focusManager: _fm(),
        mobile: false,
      ),
      const Size(900, 1400),
    );

    // Both tabs are visible, but only the first group's (Permanent)
    // categories are mounted — no side-by-side columns. All 3 of that
    // group's categories start expanded (desktop Spreadsheet Mode default).
    expect(find.text('Permanent'), findsOneWidget);
    expect(find.text('Temporaire'), findsOneWidget);
    expect(find.text('Cadres'), findsOneWidget);
    expect(find.text('Agents de Maîtrise'), findsOneWidget);
    expect(find.text("Agents d'exécution"), findsOneWidget);
    expect(find.text('Homme'), findsNWidgets(3));

    // The tab buttons size to their label, not to half the row each —
    // "Permanent" and "Temporaire" together shouldn't come anywhere near
    // the 900px test viewport width.
    final tabsRowWidth = tester
        .getRect(find.ancestor(
          of: find.text('Permanent'),
          matching: find.byType(Row),
        ).first)
        .width;
    expect(tabsRowWidth, lessThan(400));

    await expectLater(find.byType(CategoryGridGroupsView),
        matchesGoldenFile('goldens/category_grid_desktop_with_axis.png'));

    // Tapping "Temporaire" switches to the second group — same shape,
    // still only one group mounted at a time, and its categories are
    // already expanded too (both groups' cards were seeded expanded up
    // front, not just the group shown first).
    await tester.tap(find.text('Temporaire'));
    await tester.pump();
    expect(find.text('Cadres'), findsOneWidget);
    expect(find.text('Homme'), findsNWidgets(3));

    await expectLater(find.byType(CategoryGridGroupsView),
        matchesGoldenFile('goldens/category_grid_desktop_with_axis_temporaire.png'));
  });

  testWidgets('mobile: categories render as collapsible cards, first expanded',
      (tester) async {
    await _pump(
      tester,
      CategoryGridGroupsView(
        groups: _groups('s21q01'),
        prefix: 's21q01',
        numberValues: const {},
        onNumberChanged: (_, __) {},
        focusManager: _fm(),
        mobile: true,
      ),
      const Size(390, 1400),
    );

    expect(find.text('Cadres'), findsOneWidget);
    // First category starts expanded — its grid is visible.
    expect(find.text('Homme'), findsOneWidget);

    // Collapse it, confirm the grid disappears.
    await tester.tap(find.text('Cadres'));
    await tester.pump();
    expect(find.text('Homme'), findsNothing);

    // Expand the second category instead.
    await tester.tap(find.text('Agents de Maîtrise'));
    await tester.pump();
    expect(find.text('Homme'), findsOneWidget);

    await expectLater(find.byType(CategoryGridGroupsView),
        matchesGoldenFile('goldens/category_grid_mobile.png'));
  });

  testWidgets(
      'mobile: rows reveal one at a time within a category, then all together for review, '
      'then Tab cascades to the next category',
      (tester) async {
    final fm = _fm();
    await _pump(
      tester,
      CategoryGridGroupsView(
        groups: _groups('s21q01'),
        prefix: 's21q01',
        numberValues: const {},
        onNumberChanged: (_, __) {},
        focusManager: fm,
        mobile: true,
      ),
      const Size(390, 1400),
    );

    // Cadres starts expanded, but only Homme — its first fillable row —
    // is shown; Femme/Total wait their turn. ("Total" is still the
    // column header's own label, hence the 1 not 0.)
    expect(find.text('Homme'), findsOneWidget);
    expect(find.text('Femme'), findsNothing);
    expect(find.text('Total'), findsOneWidget);

    fm.focus('s21q01_cadres_male_15_24');
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // -> male_25_34
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // -> male_35_plus
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // last of Homme -> Femme
    await tester.pumpAndSettle();

    // Homme collapsed, Femme opened in its place, focus followed into
    // its first cell.
    expect(find.text('Homme'), findsNothing);
    expect(find.text('Femme'), findsOneWidget);
    expect(fm.activeId, 's21q01_cadres_female_15_24');

    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // -> female_25_34
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // -> female_35_plus
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // last fillable row -> review
    await tester.pumpAndSettle();

    // Every row, Total included, shown together for cross-checking —
    // still Cadres, still the same cell focused (nothing moved yet).
    expect(find.text('Homme'), findsOneWidget);
    expect(find.text('Femme'), findsOneWidget);
    expect(find.text('Total'), findsNWidgets(2)); // column header + row
    expect(tester.widget<MiniCategoryGrid>(find.byType(MiniCategoryGrid)).category.label,
        'Cadres');
    expect(fm.activeId, 's21q01_cadres_female_35_plus');

    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // review's true last cell -> next category
    await tester.pumpAndSettle();

    // Landed on Agents de Maîtrise's own first row/first cell — not
    // wherever Cadres's own cascade happened to end.
    expect(tester.widget<MiniCategoryGrid>(find.byType(MiniCategoryGrid)).category.label,
        'Agents de Maîtrise');
    expect(find.text('Homme'), findsOneWidget);
    expect(find.text('Femme'), findsNothing);
    expect(fm.activeId, 's21q01_foremen_male_15_24');

    // Shift+Tab off that first cell walks straight back to the previous
    // category (review mode, not row-by-row — nothing to "un-reveal" a
    // row into on the way in from the end).
    await tester.sendKeyDownEvent(LogicalKeyboardKey.shiftLeft);
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.sendKeyUpEvent(LogicalKeyboardKey.shiftLeft);
    await tester.pumpAndSettle();

    expect(tester.widget<MiniCategoryGrid>(find.byType(MiniCategoryGrid)).category.label,
        'Cadres');
    expect(find.text('Homme'), findsOneWidget);
    expect(find.text('Femme'), findsOneWidget);
    expect(fm.activeId, 's21q01_cadres_female_35_plus');
  });

  testWidgets('english locale: progress line, grand total, and skip copy translate',
      (tester) async {
    tester.view.physicalSize = const Size(900, 1400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final skipped = <String>{};
    await tester.pumpWidget(MaterialApp(
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: SingleChildScrollView(
          child: StatefulBuilder(
            // mobile: true — the progress line and grand-total summary
            // are Simple Mode/mobile-only (Spreadsheet Mode's flat table
            // already shows its own Total row/column inline), so that's
            // the shape that actually exercises them.
            builder: (context, setState) => CategoryGridGroupsView(
              groups: _groups('s21q01'),
              prefix: 's21q01',
              numberValues: const {},
              onNumberChanged: (_, __) {},
              focusManager: _fm(),
              mobile: true,
              isCategorySkipped: skipped.contains,
              onCategorySkipChanged: (key, value, cellIds) => setState(
                  () => value ? skipped.add(key) : skipped.remove(key)),
            ),
          ),
        ),
      ),
    ));

    // This fixture's own Homme/Femme/Total row labels are hardcoded test
    // data (unlike the real schema, which builds them via LocalizedText
    // too — see TableSpecBuilder._categoryMiniGrid), so they're not a
    // useful signal here. What this file itself renders — the progress
    // line, grand total, and skip copy — should read in English instead
    // of silently staying French.
    //
    // _ProgressLine renders via a bare RichText, not Text/Text.rich —
    // find.text/find.textContaining only match Text and EditableText, so
    // this walks RichText widgets directly instead.
    final progressLine = find.byWidgetPredicate(
        (w) => w is RichText && w.text.toPlainText().contains('categories started'));
    expect(progressLine, findsOneWidget);
    expect(find.text('Grand total'), findsOneWidget);
    expect(find.textContaining('Not filled in'), findsWidgets);

    // Mobile's skip control is the full switch+label row inside an
    // expanded card (not RowSkipToggle's icon, which is Spreadsheet
    // Mode's flat-table equivalent) — Cadres starts expanded by default.
    expect(find.text('Nothing to report for this category'), findsOneWidget);
    final skipSwitch = find.byType(MiniSwitch).first;
    await tester.tap(skipSwitch);
    await tester.pump();

    // Toggling it swaps the card's subtitle to the English "Nothing to
    // report" too — proving the runtime language switch, not just the
    // static labels, actually resolves per-locale.
    expect(find.text('Nothing to report'), findsOneWidget);
  });

  testWidgets(
      'mobile: Grand Total splits into Male/Female and updates live as cells fill in',
      (tester) async {
    tester.view.physicalSize = const Size(390, 1400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final values = <String, int>{};
    await tester.pumpWidget(MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: SingleChildScrollView(
          child: StatefulBuilder(
            builder: (context, setState) => CategoryGridGroupsView(
              groups: _groups('s21q01'),
              prefix: 's21q01',
              numberValues: values,
              onNumberChanged: (id, v) => setState(() {
                if (v == null) {
                  values.remove(id);
                } else {
                  values[id] = v;
                }
              }),
              focusManager: _fm(),
              mobile: true,
            ),
          ),
        ),
      ),
    ));

    // Scoped to the Grand Total's own row — the category cards above it
    // also show their own dashes/numbers (e.g. a row's unrelated computed
    // Total cell), which aren't what this test is checking.
    final grandTotalRow =
        find.ancestor(of: find.text('Total général'), matching: find.byType(Row));
    expect(grandTotalRow, findsOneWidget);

    // Nothing filled anywhere yet — Grand Total reads as dashes for both
    // Male and Female.
    expect(find.descendant(of: grandTotalRow, matching: find.text('—')),
        findsNWidgets(2));

    // Cadres starts expanded, its Homme (male) row revealed first — call
    // the same onNumberChanged callback a real NumberField's onChanged
    // invokes, rather than driving actual keyboard/text input, to fill in
    // its own 15-24 cell.
    void setCell(String id, int value) => tester
        .widget<CategoryGridGroupsView>(find.byType(CategoryGridGroupsView))
        .onNumberChanged(id, value);

    setCell('s21q01_cadres_male_15_24', 7);
    await tester.pump();

    // Grand Total's Male figure picked it up live; Female is still
    // unfilled — only its own dash remains.
    expect(find.descendant(of: grandTotalRow, matching: find.text('7')),
        findsOneWidget);
    expect(find.descendant(of: grandTotalRow, matching: find.text('—')),
        findsOneWidget);

    setCell('s21q01_cadres_female_15_24', 3);
    await tester.pump();

    // Both figures now read live from numberValues — 7 (male) + 3
    // (female) as two separate stats within the Grand Total row itself,
    // not the old combined person-count wording this replaced.
    expect(find.descendant(of: grandTotalRow, matching: find.text('7')),
        findsOneWidget);
    expect(find.descendant(of: grandTotalRow, matching: find.text('3')),
        findsOneWidget);
    expect(find.descendant(of: grandTotalRow, matching: find.text('—')),
        findsNothing);
  });
}
