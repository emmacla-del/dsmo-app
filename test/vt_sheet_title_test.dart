// VT-UI/UX-04 P1 — content-aware _VtRowSheet title. Reuses vtRowLabel, the
// exact same resolution the row tile already uses (extracted from
// VtRowEditor._rowLabel so the two can never diverge): a fixed-taxonomy
// row's own static label, or — once the user has typed something
// identifying — that live text instead of the generic "Détails de la
// ligne" fallback. Isolated VtRowEditor pumps (same established pattern as
// vt_row_editor_screenshot_test.dart), not the full navigation stack.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_row_editor.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

const _genericTitle = 'Détails de la ligne';

OnefopFormController _controller({Map<String, dynamic> initialData = const {}}) {
  return OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: initialData,
    onSave: (_) async {},
  );
}

Future<OnefopFormController> _pumpAndOpen(
  WidgetTester tester,
  VtTableDef def,
  String rowTileText, {
  Map<String, dynamic> initialData = const {},
}) async {
  final ctrl = _controller(initialData: initialData);
  addTearDown(ctrl.dispose);
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        backgroundColor: kCanvas,
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(12),
          child: VtRowEditor(ctrl: ctrl, def: def),
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.tap(find.text(rowTileText));
  await tester.pumpAndSettle();
  return ctrl;
}

void main() {
  group('fixed-taxonomy table (4.1 diploma) — title is always its static row label', () {
    testWidgets('blank row: title is the row\'s own fixed label, never the generic fallback',
        (tester) async {
      final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;
      await _pumpAndOpen(tester, def, 'Doctorat/PhD');

      // The sheet header text — the drag handle above it is a plain
      // Container, so this is unambiguous.
      expect(find.text('Doctorat/PhD'), findsWidgets); // row tile (dimmed) + sheet title
      expect(find.text(_genericTitle), findsNothing);
    });

    testWidgets('filled row: title stays the same fixed label — content doesn\'t change it',
        (tester) async {
      final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;
      await _pumpAndOpen(tester, def, 'Doctorat/PhD',
          initialData: const {'s4q1_doctorat_male': 3, 's4q1_doctorat_female': 2});

      expect(find.text('Doctorat/PhD'), findsWidgets);
      expect(find.text(_genericTitle), findsNothing);
    });
  });

  group('roster (8.8) — generic title until identifying content exists', () {
    testWidgets('blank row: generic title', (tester) async {
      final def = vtTrainerRosterTableDef;
      await _pumpAndOpen(tester, def, 'Ligne 1');

      expect(find.text(_genericTitle), findsOneWidget);
    });

    testWidgets('row opened with an existing name: content-aware title, no generic fallback',
        (tester) async {
      final def = vtTrainerRosterTableDef;
      await _pumpAndOpen(tester, def, 'Nkoa Paul',
          initialData: const {'s8q8_row1_lastName': 'Nkoa', 's8q8_row1_firstName': 'Paul'});

      expect(find.text('Nkoa Paul'), findsWidgets); // row tile (dimmed) + sheet title
      expect(find.text(_genericTitle), findsNothing);
    });

    testWidgets('typing a name while the sheet is open updates the title live, no reopen needed',
        (tester) async {
      final def = vtTrainerRosterTableDef;
      await _pumpAndOpen(tester, def, 'Ligne 1');
      expect(find.text(_genericTitle), findsOneWidget);

      await tester.enterText(find.widgetWithText(TextFormField, 'Nom'), 'Ateba');
      await tester.pump();

      expect(find.text(_genericTitle), findsNothing);
      expect(find.text('Ateba'), findsWidgets); // sheet title + the field's own current text

      // Elapse both a short focus/selection timer EditableText schedules
      // internally and hybridController's own debounced autosave
      // (schedAS) — same "no pending timers left behind" requirement as
      // vt_required_cell_test.dart's Terminé-close test.
      await tester.pump(const Duration(milliseconds: 700));
      await tester.pump(const Duration(seconds: 3));
    });
  });

  group('progressive specialty table (4.3) — same rule as the roster', () {
    testWidgets('blank row: generic title', (tester) async {
      final def = vtTableDefFor('vt_specialty_fi_fc_table', {'prefix': 's4q3'})!;
      await _pumpAndOpen(tester, def, 'Ligne 1');

      expect(find.text(_genericTitle), findsOneWidget);
    });

    testWidgets('row opened with an existing specialty: content-aware title', (tester) async {
      final def = vtTableDefFor('vt_specialty_fi_fc_table', {'prefix': 's4q3'})!;
      await _pumpAndOpen(tester, def, 'Coiffure',
          initialData: const {'s4q3_row1_specialtyText': 'Coiffure'});

      expect(find.text('Coiffure'), findsWidgets);
      expect(find.text(_genericTitle), findsNothing);
    });
  });
}
