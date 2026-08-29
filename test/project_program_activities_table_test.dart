// Phase 1 — Projects & Programs Section 2 activities table widget test.
// Exercises the actual rendering/persistence path (ActivitiesTable),
// mirroring administration_table_rendering_test.dart's discipline of not
// relying exclusively on AST-level assertions — a widget-level test would
// have caught the P0-A-class bug (row-aware rendering silently diverging
// from a correct AST) had one existed there. Uses a small explicit row
// count (2) rather than the real 13 so widgets stay within the default
// test viewport — the row-building logic is identical regardless of count.
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/activities_table.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Widget wrap(Map<String, TextEditingController> controllers, {int rows = 2}) {
    return MaterialApp(
      locale: const Locale('fr'),
      supportedLocales: const [Locale('fr'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Scaffold(
        body: SingleChildScrollView(
          child: ActivitiesTable(
            prefix: 's2',
            rows: rows,
            hybridController: (id) =>
                controllers.putIfAbsent(id, () => TextEditingController()),
          ),
        ),
      ),
    );
  }

  testWidgets('renders N rows, each with the 6 expected fields',
      (tester) async {
    final controllers = <String, TextEditingController>{};
    await tester.pumpWidget(wrap(controllers, rows: 2));
    await tester.pumpAndSettle();

    expect(find.text('Ligne 1'), findsOneWidget);
    expect(find.text('Ligne 2'), findsOneWidget);
    expect(find.text('Ligne 3'), findsNothing);
    // 2 rows x (description + startDate + duration) plain TextFormFields.
    expect(find.byType(TextFormField), findsNWidgets(2 * 3));
    // 2 rows x (targetPopulation + supportType + scope) dropdowns.
    expect(find.byType(DropdownButtonFormField<String>), findsNWidgets(2 * 3));
  });

  testWidgets(
      'typing into row 1 description persists via the hybrid controller, '
      'row 2 stays untouched', (tester) async {
    final controllers = <String, TextEditingController>{};
    await tester.pumpWidget(wrap(controllers, rows: 2));
    await tester.pumpAndSettle();

    final descriptionField =
        find.widgetWithText(TextFormField, 'Prestations offertes').first;
    await tester.enterText(descriptionField, 'Formation professionnelle');
    await tester.pumpAndSettle();

    expect(controllers['s2_row1_description']?.text,
        'Formation professionnelle');
    expect(controllers['s2_row2_description']?.text ?? '', isEmpty);
  });

  testWidgets(
      'selecting a coded dropdown option writes the raw code, not the label',
      (tester) async {
    final controllers = <String, TextEditingController>{};
    await tester.pumpWidget(wrap(controllers, rows: 1));
    await tester.pumpAndSettle();

    final dropdown = find.byType(DropdownButtonFormField<String>).first;
    await tester.ensureVisible(dropdown);
    await tester.tap(dropdown);
    await tester.pumpAndSettle();
    final option = find.text('3 — Femme').last;
    await tester.ensureVisible(option);
    await tester.tap(option);
    await tester.pumpAndSettle();

    expect(controllers['s2_row1_targetPopulation']?.text, '3');
  });

  test('row capacity/field-suffix constants match the AST tableSpec', () {
    expect(kActivitiesTableRowCount, 13);
    expect(kActivitiesTableFieldSuffixes, [
      'description', 'targetPopulation', 'supportType', 'scope',
      'startDate', 'duration',
    ]);
  });
}
